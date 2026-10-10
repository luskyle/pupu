// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncData } from "../common";
import { DynamicRednote } from "./rednote";

vi.mock("~agent/title", () => ({ fillTitleWithAgent: vi.fn().mockResolvedValue(undefined) }));
vi.mock("~utils/logger", () => ({ logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const data: SyncData = {
  platforms: [{ name: "DYNAMIC_REDNOTE" }],
  isAutoPublish: true,
  data: {
    title: "测试标题",
    content: "正文",
    images: [{ name: "image.png", url: "blob:test", type: "image/png" }],
    videos: [],
  },
};

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<span class="title">上传图文</span><input type="file">';
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("image", { headers: { "Content-Type": "image/png" } })),
  );
  class TestDataTransfer {
    files: File[] = [];
    items = { add: (file: File) => this.files.push(file) };
  }
  vi.stubGlobal("DataTransfer", TestDataTransfer);
  const input = document.querySelector("input");
  if (input) Object.defineProperty(input, "files", { writable: true, value: [] });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("小红书 Agent 试点执行边界", () => {
  it("即使任务开启自动发布，试点只填充，不发送提交消息", async () => {
    const post = vi.spyOn(window, "postMessage").mockImplementation((message) => {
      if (message.type === "XHS_IS_UPLOAD_DONE") {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: {
              type: "XHS_IS_UPLOAD_DONE_RESULT",
              requestId: message.requestId,
              done: true,
            },
          }),
        );
      }
      if (message.type === "XHS_FILL_EDITOR") {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: {
              type: "XHS_FILL_EDITOR_RESULT",
              requestId: message.requestId,
              titleFilled: false,
              contentFilled: true,
            },
          }),
        );
      }
    });
    const pending = DynamicRednote(data, true, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(6000);
    await pending;
    expect(post.mock.calls.some(([message]) => message.type === "XHS_CLICK_PUBLISH")).toBe(false);
    const fill = post.mock.calls.find(([message]) => message.type === "XHS_FILL_EDITOR")?.[0];
    expect(fill.title).toBe("");
    expect(fill.content).toBe("正文");
  });
  it("已取消任务不会上传", async () => {
    const controller = new AbortController();
    controller.abort(new Error("用户停止"));
    await expect(DynamicRednote(data, true, controller.signal)).rejects.toThrow("用户停止");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("试点素材下载失败不能继续填写", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 404 })));
    const failure = expect(DynamicRednote(data, true)).rejects.toThrow("404");
    await vi.advanceTimersByTimeAsync(4000);
    await failure;
  });
});
