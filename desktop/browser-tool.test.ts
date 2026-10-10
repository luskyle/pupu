// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { browserTool } from "./browser-tool";

function connection(failures = 0) {
  let remaining = failures;
  let documentCount = 0;
  let attached = false;
  const api = {
    isAttached: () => attached,
    attach: vi.fn(() => {
      attached = true;
    }),
    detach: vi.fn(() => {
      attached = false;
    }),
    sendCommand: vi.fn(async (command: string) => {
      if (command === "Page.getFrameTree") return { frameTree: { frame: { id: "main" } } };
      if (command === "Page.createIsolatedWorld") return { executionContextId: 99 };
      if (command === "DOM.getDocument") {
        documentCount++;
        return {
          root: { backendNodeId: 1, shadowRoots: [{ nodeId: documentCount, backendNodeId: 100 + documentCount }] },
        };
      }
      if (command === "DOM.resolveNode") {
        if (remaining-- > 0) throw new Error("No node with given id found");
        return { object: { objectId: "current-root" } };
      }
      if (command === "Runtime.callFunctionOn") return { result: { value: { submitted: true } } };
      return {};
    }),
  };
  const contents = { debugger: api, isDestroyed: () => false };
  return { api, contents };
}
describe("Chromium 节点生命周期", () => {
  it("使用后端节点 ID，不依赖短生命周期的前端 nodeId", async () => {
    const { api, contents } = connection();
    await browserTool(contents, "observe");
    expect(api.sendCommand).toHaveBeenCalledWith("DOM.resolveNode", {
      backendNodeId: 101,
      executionContextId: 99,
      objectGroup: "pupu-tool",
    });
    expect(api.detach).toHaveBeenCalledTimes(1);
  });
  it("解析前节点失效时重新观察，但提交命令只执行一次", async () => {
    const { api, contents } = connection(1);
    await browserTool(contents, "submit");
    expect(api.sendCommand.mock.calls.filter(([command]) => command === "DOM.getDocument")).toHaveLength(2);
    expect(api.sendCommand.mock.calls.filter(([command]) => command === "Runtime.callFunctionOn")).toHaveLength(1);
    expect(api.sendCommand).toHaveBeenCalledWith("DOM.resolveNode", {
      backendNodeId: 102,
      executionContextId: 99,
      objectGroup: "pupu-tool",
    });
  });
  it("持续失效时有界停止，不执行填写或提交", async () => {
    const { api, contents } = connection(3);
    await expect(browserTool(contents, "fill")).rejects.toThrow("持续重渲染");
    expect(api.sendCommand.mock.calls.filter(([command]) => command === "DOM.getDocument")).toHaveLength(3);
    expect(api.sendCommand.mock.calls.some(([command]) => command === "Runtime.callFunctionOn")).toBe(false);
    expect(api.detach).toHaveBeenCalledTimes(1);
  });
  it("已经调用页面动作后报错不重试，防止重复提交", async () => {
    const { api, contents } = connection();
    const original = api.sendCommand.getMockImplementation()!;
    api.sendCommand.mockImplementation(async (command) => {
      if (command === "Runtime.callFunctionOn") throw new Error("No node with given id found");
      return original(command);
    });
    await expect(browserTool(contents, "submit")).rejects.toThrow("No node");
    expect(api.sendCommand.mock.calls.filter(([command]) => command === "Runtime.callFunctionOn")).toHaveLength(1);
    expect(api.detach).toHaveBeenCalledTimes(1);
  });
});
