// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { installWorkspaceChrome, registerWorkspaceAdapters } from "./workspace-chrome";

afterEach(() => vi.unstubAllGlobals());

describe("workspace Chromium compatibility", () => {
  it("dispatches only registered adapters, handles storage events and reports unsupported messages", async () => {
    let onEvent;
    const invoke = vi.fn(async (action) => ({
      ok: true,
      data:
        action === "config"
          ? {
              version: "0.3.0",
              messages: { test: { message: "Hello $NAME$", placeholders: { name: { content: "$1" } } } },
            }
          : action === "storageGet"
            ? { key: "value" }
            : { completed: true },
    }));
    vi.stubGlobal("fetch", vi.fn());
    const chromeAPI = await installWorkspaceChrome({
      invoke,
      onEvent: (callback) => {
        onEvent = callback;
      },
    });
    expect(chromeAPI.i18n.getMessage("test", ["pupu"])).toBe("Hello pupu");
    const listener = vi.fn();
    chromeAPI.storage.onChanged.addListener(listener);
    onEvent({ type: "storage", area: "local", changes: { key: { newValue: 1 } } });
    expect(listener).toHaveBeenCalledWith({ key: { newValue: 1 } }, "local");
    chromeAPI.storage.onChanged.removeListener(listener);
    onEvent({ type: "storage", area: "local", changes: {} });
    expect(listener).toHaveBeenCalledTimes(1);
    const read = vi.fn();
    await chromeAPI.storage.local.get("key", read);
    expect(read).toHaveBeenCalledWith({ key: "value" });
    await expect(chromeAPI.runtime.sendMessage({ action: "unknown" })).rejects.toThrow("尚不支持");
    const adapter = () => {};
    registerWorkspaceAdapters({ TEST: { name: "TEST", injectFunction: adapter } });
    await expect(
      chromeAPI.scripting.executeScript({ target: { tabId: 1 }, func: () => {}, args: [{}] }),
    ).rejects.toThrow("任意脚本");
    await chromeAPI.scripting.executeScript({
      target: { tabId: 1 },
      func: adapter,
      args: [{ data: { content: "test" } }],
    });
    expect(invoke).toHaveBeenCalledWith("execute", { id: 1, platform: "TEST", data: { data: { content: "test" } } });
  });
  it("propagates main-process errors rather than claiming success", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const api = await installWorkspaceChrome({
      invoke: async (action) =>
        action === "config"
          ? { ok: true, data: { version: "0.3.0", messages: {} } }
          : { ok: false, error: "平台加载失败" },
      onEvent: () => {},
    });
    await expect(api.tabs.create({ url: "https://weibo.com" })).rejects.toThrow("平台加载失败");
  });
});
