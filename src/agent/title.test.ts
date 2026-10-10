// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fillTitleWithAgent } from "./title";

let sendMessage: ReturnType<typeof vi.fn>;
beforeEach(() => {
  sendMessage = vi.fn();
  vi.stubGlobal("chrome", { runtime: { sendMessage } });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: 200,
    height: 40,
    top: 0,
    left: 0,
    bottom: 40,
    right: 200,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
});
afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("受控标题填写", () => {
  it("唯一明确标题不请求模型，并回读核验", async () => {
    document.body.innerHTML = '<input placeholder="填写标题"><input type="password">';
    await fillTitleWithAgent("测试标题", new AbortController().signal);
    expect(document.querySelector("input")?.value).toBe("测试标题");
    expect(sendMessage).not.toHaveBeenCalled();
  });
  it("定位失败后使用候选 ID，不发送正文值", async () => {
    document.body.innerHTML = '<input placeholder="作品名称">';
    sendMessage.mockResolvedValue({ ok: true, choice: "e0" });
    await fillTitleWithAgent("标题", new AbortController().signal);
    expect(sendMessage.mock.calls[0][0].candidates).toEqual([
      { id: "e0", kind: "input", label: "", placeholder: "作品名称" },
    ]);
  });
  it("无匹配、未知 ID 不写入", async () => {
    for (const choice of [null, "e99"]) {
      document.body.innerHTML = "<input>";
      sendMessage.mockResolvedValue({ ok: true, choice });
      await expect(fillTitleWithAgent("标题", new AbortController().signal)).rejects.toThrow("未能确认");
      expect(document.querySelector("input")?.value).toBe("");
    }
  });
  it("拒绝覆盖已有内容", async () => {
    document.body.innerHTML = '<input placeholder="标题" value="用户内容">';
    await expect(fillTitleWithAgent("新标题", new AbortController().signal)).rejects.toThrow("已有内容");
    expect(document.querySelector("input")?.value).toBe("用户内容");
  });
  it("决策期间节点替换后不写入", async () => {
    document.body.innerHTML = "<input>";
    sendMessage.mockImplementation(async () => {
      document.body.innerHTML = "<input>";
      return { ok: true, choice: "e0" };
    });
    await expect(fillTitleWithAgent("标题", new AbortController().signal)).rejects.toThrow("页面已变化");
    expect(document.querySelector("input")?.value).toBe("");
  });
  it("取消后忽略迟到的模型结果", async () => {
    document.body.innerHTML = "<input>";
    const controller = new AbortController();
    sendMessage.mockImplementation(async () => {
      controller.abort(new Error("已停止"));
      return { ok: true, choice: "e0" };
    });
    await expect(fillTitleWithAgent("标题", controller.signal)).rejects.toThrow("已停止");
    expect(document.querySelector("input")?.value).toBe("");
  });
  it("已经停止时不发起模型调用", async () => {
    document.body.innerHTML = "<input>";
    const controller = new AbortController();
    controller.abort(new Error("已停止"));
    await expect(fillTitleWithAgent("标题", controller.signal)).rejects.toThrow("已停止");
    expect(sendMessage).not.toHaveBeenCalled();
  });
  it("候选改成密码输入框后停止写入", async () => {
    document.body.innerHTML = "<input>";
    sendMessage.mockImplementation(async () => {
      document.querySelector("input")?.setAttribute("type", "password");
      return { ok: true, choice: "e0" };
    });
    await expect(fillTitleWithAgent("标题", new AbortController().signal)).rejects.toThrow("页面已变化");
  });
  it("页面组件回退写入值时核验失败", async () => {
    document.body.innerHTML = '<input placeholder="标题">';
    document.querySelector("input")?.addEventListener("input", (event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement) target.value = "";
    });
    await expect(fillTitleWithAgent("标题", new AbortController().signal)).rejects.toThrow("核验失败");
  });
});
