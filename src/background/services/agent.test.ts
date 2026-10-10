import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AGENT_SETTINGS_KEY } from "~agent/decision";
import { agentMessageHandler } from "./agent";

let get: ReturnType<typeof vi.fn>;
const editor = {
  id: "test-extension",
  frameId: 0,
  tab: {
    id: 1,
    index: 0,
    pinned: false,
    highlighted: false,
    windowId: 1,
    active: true,
    incognito: false,
    selected: true,
    discarded: false,
    autoDiscardable: true,
    groupId: -1,
  },
  url: "https://creator.xiaohongshu.com/publish/publish",
};
beforeEach(() => {
  get = vi.fn().mockResolvedValue({ [AGENT_SETTINGS_KEY]: { enabled: true, model: "qwen3:4b" } });
  vi.stubGlobal("chrome", {
    runtime: { id: "test-extension", getURL: (path: string) => `chrome-extension://test-extension/${path}` },
    storage: { local: { get } },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("本地模型消息权限", () => {
  it("不处理其他消息", () => {
    expect(agentMessageHandler({ type: "OTHER" }, {}, vi.fn())).toBe(false);
  });
  it("拒绝外部扩展、其他网站及子 frame", () => {
    for (const sender of [
      { ...editor, id: "external" },
      { ...editor, url: "https://evil.example/" },
      { ...editor, url: "https://creator.xiaohongshu.com.evil.example/" },
      { ...editor, frameId: 1 },
    ]) {
      const send = vi.fn();
      expect(agentMessageHandler({ type: "PUPU_AGENT_SELECT_TITLE", candidates: [] }, sender, send)).toBe(true);
      expect(send).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
    }
    expect(get).not.toHaveBeenCalled();
  });
  it("设置关闭时不调用模型", async () => {
    get.mockResolvedValue({ [AGENT_SETTINGS_KEY]: { enabled: false, model: "qwen3:4b" } });
    const response = await new Promise((resolve) => {
      agentMessageHandler({ type: "PUPU_AGENT_SELECT_TITLE", candidates: [] }, editor, resolve);
    });
    expect(response).toEqual({ ok: false, error: "本地 Agent 已关闭" });
  });
  it("设置页面 hash 不影响测试，平台页面不能发起连接测试", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: { content: '{"choice":"e1"}' } }))),
    );
    const response = await new Promise((resolve) => {
      agentMessageHandler(
        { type: "PUPU_AGENT_TEST" },
        { id: editor.id, url: "chrome-extension://test-extension/options.html#tab=about" },
        resolve,
      );
    });
    expect(response).toEqual({ ok: true, choice: "e1" });
    const send = vi.fn();
    agentMessageHandler({ type: "PUPU_AGENT_TEST" }, editor, send);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  });
});
