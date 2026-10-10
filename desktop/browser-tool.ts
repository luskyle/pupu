import type { WebContents } from "electron";
import { type PageAction, pageTool } from "./page-tool";

type DOMNode = {
  backendNodeId: number;
  children?: DOMNode[];
  shadowRoots?: DOMNode[];
};

function staleNode(error: unknown): boolean {
  return error instanceof Error && /No node with given id found|Could not find node with given id/.test(error.message);
}

// CDP resolves closed shadow roots into an unprivileged isolated world.
// The model cannot supply code, node IDs, or debugger commands.
export async function browserTool(
  contents: {
    debugger: Pick<WebContents["debugger"], "isAttached" | "attach" | "detach" | "sendCommand">;
    isDestroyed: () => boolean;
  },
  action: PageAction,
  args: object = {},
): Promise<unknown> {
  const api = contents.debugger;
  if (api.isAttached()) throw new Error("平台调试工具被占用，请先关闭开发者工具");
  api.attach("1.3");
  try {
    const { frameTree } = await api.sendCommand("Page.getFrameTree");
    const { executionContextId } = await api.sendCommand("Page.createIsolatedWorld", {
      frameId: frameTree.frame.id,
      worldName: "pupu-page-tools",
    });
    const objects: { objectId: string }[] = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      objects.length = 0;
      try {
        const { root } = await api.sendCommand("DOM.getDocument", { depth: -1, pierce: true });
        const roots: number[] = [];
        const visit = (node: DOMNode) => {
          for (const shadow of node.shadowRoots || []) {
            roots.push(shadow.backendNodeId);
            visit(shadow);
          }
          for (const child of node.children || []) visit(child);
        };
        visit(root);
        for (const backendNodeId of roots) {
          const { object } = await api.sendCommand("DOM.resolveNode", {
            backendNodeId,
            executionContextId,
            objectGroup: "pupu-tool",
          });
          if (!object.objectId) throw new Error("无法访问平台编辑器，请重新打开页面");
          objects.push({ objectId: object.objectId });
        }
        break;
      } catch (error) {
        if (!staleNode(error)) throw error;
        if (attempt === 2)
          throw new Error("平台正在持续重渲染，无法获取稳定的编辑器节点；本次未执行页面操作，请稍后重试");
        await api.sendCommand("Runtime.releaseObjectGroup", { objectGroup: "pupu-tool" });
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }
    // Do not retry this command: fill/submit may have executed before a transport error.
    const result = await api.sendCommand("Runtime.callFunctionOn", {
      executionContextId,
      functionDeclaration: `function(...roots) { return (${pageTool.toString()})(${JSON.stringify(action)}, ${JSON.stringify(args)}, roots); }`,
      arguments: objects,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      const description = result.exceptionDetails.exception?.description || result.exceptionDetails.text;
      throw new Error(description.split("\n")[0].replace(/^Error:\s*/, ""));
    }
    return result.result.value;
  } finally {
    if (!contents.isDestroyed() && api.isAttached()) {
      try {
        await api.sendCommand("Runtime.releaseObjectGroup", { objectGroup: "pupu-tool" });
      } finally {
        api.detach();
      }
    }
  }
}
