import type { WebContents } from "electron";
import { buildXhsContent, pickXhsTitle } from "../src/utils/rednote-text";
import { browserTool } from "./browser-tool";
import { isEditorPreparationNavigation } from "./navigation";
import type { PageObservation, PublishState } from "./page-tool";
import { runPublisher } from "./publish";

interface DOMNode {
  backendNodeId: number;
  nodeName: string;
  attributes?: string[];
  children?: DOMNode[];
  shadowRoots?: DOMNode[];
}

export async function publishWorkspaceRednote(
  contents: WebContents,
  request: { title: string; content: string; tags: string[]; files: string[]; auto: boolean },
  progress: (message: string) => void,
) {
  if (!request.files.length || request.files.length > 9) throw new Error("小红书图文需要 1–9 张图片");
  const title = pickXhsTitle(request.title, request.content);
  const content = buildXhsContent(request.content, request.tags);
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(new Error("小红书任务超时，请检查平台；不会自动重发")), 300_000);
  let preparing = true;
  let submitted = false;
  let previousURL = contents.getURL();
  const navigation = (_event: Electron.Event, url: string, _inPlace: boolean, mainFrame: boolean) => {
    if (!mainFrame) return;
    if (preparing && isEditorPreparationNavigation(previousURL, url, true)) {
      previousURL = url;
      return;
    }
    if (!submitted) controller.abort(new Error("页面离开编辑流程，请检查登录状态后重试"));
  };
  contents.on("did-start-navigation", navigation);
  const pause = async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    controller.signal.throwIfAborted();
  };
  const tool = async (action: Parameters<typeof browserTool>[1], args = {}) => {
    controller.signal.throwIfAborted();
    return browserTool(contents, action, args);
  };
  let snapshot: PageObservation;
  let choice: string;
  const steps = {
    signal: controller.signal,
    progress,
    state: async () => (await tool("publishState")) as PublishState,
    upload: async () => {
      await tool("prepareImages");
      for (let attempt = 0; contents.isLoadingMainFrame(); attempt++) {
        if (attempt === 60) throw new Error("图文页面加载超时");
        await pause();
      }
      const inputs: DOMNode[] = [];
      const visit = (node: DOMNode) => {
        const attributes = node.attributes || [];
        const type = attributes.indexOf("type");
        const accept = attributes.indexOf("accept");
        if (
          node.nodeName === "INPUT" &&
          attributes[type + 1] === "file" &&
          accept >= 0 &&
          /image|\.png|\.jpg/i.test(attributes[accept + 1])
        )
          inputs.push(node);
        for (const child of [...(node.children || []), ...(node.shadowRoots || [])]) visit(child);
      };
      contents.debugger.attach("1.3");
      try {
        const { root } = await contents.debugger.sendCommand("DOM.getDocument", { depth: -1, pierce: true });
        visit(root);
        if (inputs.length !== 1) throw new Error("图片上传入口不唯一，请检查平台；未上传");
        controller.signal.throwIfAborted();
        await contents.debugger.sendCommand("DOM.setFileInputFiles", {
          backendNodeId: inputs[0].backendNodeId,
          files: request.files,
        });
      } finally {
        if (contents.debugger.isAttached()) contents.debugger.detach();
      }
    },
    observeAndFill: async () => {
      let ready = false;
      for (let attempt = 0; attempt < 120; attempt++) {
        const observed = (await tool("observe")) as PageObservation;
        if (observed.bodyId && observed.candidates.length >= 2) {
          snapshot = observed;
          ready = true;
          break;
        }
        await pause();
      }
      if (!ready) throw new Error("上传后未能识别编辑器，请检查平台");
      preparing = false;
      const titles = snapshot.candidates.filter(
        (candidate) =>
          /标题|\btitle\b/i.test(candidate.label + candidate.placeholder) &&
          !/副标题|正文|搜索/i.test(candidate.label + candidate.placeholder),
      );
      if (titles.length !== 1) throw new Error("标题入口不唯一，请人工处理；多平台工作台不调用模型猜测");
      choice = titles[0].id;
      for (const [id, text] of [
        [choice, title],
        [snapshot.bodyId!, content],
      ]) {
        const target = { observationId: snapshot.observationId, id };
        const existing = (await tool("read", target)) as { value: string };
        if (existing.value.trim() && existing.value !== text) throw new Error("编辑器已有不同内容，拒绝覆盖");
        await tool("fill", { ...target, text });
      }
      await pause();
      for (const [id, expected] of [
        [choice, title],
        [snapshot.bodyId!, content],
      ]) {
        const checked = (await tool("read", { observationId: snapshot.observationId, id })) as { value: string };
        if (checked.value !== expected) throw new Error("内容回读不一致，已停止");
      }
    },
    submit: () =>
      tool("submit", {
        observationId: snapshot.observationId,
        id: choice,
        expectedTitle: title,
        bodyId: snapshot.bodyId,
        expectedContent: content,
      }).then(() => undefined),
    submitted: () => {
      submitted = true;
    },
    wait: pause,
  };
  try {
    if (request.auto) return await runPublisher(steps);
    progress("正在上传并填写小红书；手动模式不会点击发布");
    await steps.upload();
    await steps.observeAndFill();
    return { completed: true, submitted: false };
  } finally {
    clearTimeout(deadline);
    contents.removeListener("did-start-navigation", navigation);
  }
}
