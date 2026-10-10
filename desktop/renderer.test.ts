// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import { describe, expect, it, vi } from "vitest";

describe("桌面静态脚本", () => {
  it("HTML 中的 renderer 是普通脚本，不能引入顶层 await 或模块语法", () => {
    const html = readFileSync("desktop/index.html", "utf8");
    expect(html).toContain('<script src="renderer.js"></script>');
    expect(() => new Script(readFileSync("desktop/renderer.js", "utf8"))).not.toThrow();
  });

  async function workbench(
    options: { title?: string; content?: string; images?: string[]; models?: string[]; offline?: boolean } = {},
  ) {
    document.documentElement.innerHTML = readFileSync("desktop/index.html", "utf8");
    const dom = {
      window,
      close: () => {
        document.documentElement.innerHTML = "";
      },
    };
    let offline = options.offline || false;
    const invoke = vi.fn(async (action: string) => {
      if (action === "draft")
        return { ok: true, data: { title: options.title || "", content: options.content || "", model: "qwen3:4b" } };
      if (action === "assetState") return { ok: true, data: options.images || [] };
      if (action === "status")
        return offline
          ? { ok: false, error: "Ollama 无法连接" }
          : { ok: true, data: { models: (options.models || ["qwen3:4b"]).map((name) => ({ name })) } };
      return { ok: true, data: { verified: true } };
    });
    const bridgeWindow = { pupuDesktop: { invoke, onProgress: vi.fn() } };
    new Function("window", "document", readFileSync("desktop/renderer.js", "utf8"))(bridgeWindow, document);
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledWith("status", undefined));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const button = dom.window.document.getElementById("publish") as HTMLButtonElement;
    const progress = () => dom.window.document.getElementById("progress")!.textContent;
    return {
      dom,
      invoke,
      button,
      progress,
      recover: () => {
        offline = false;
      },
    };
  }

  describe("发布按钮真实界面交互", () => {
    it.each([
      [{}, "请先输入标题"],
      [{ title: "标题" }, "请先输入正文"],
      [{ title: "标题", content: "正文" }, "重新选择图片"],
    ])("缺少条件不静默禁用，点击明确提示：%s", async (options, message) => {
      const ui = await workbench(options);
      try {
        expect(ui.button.disabled).toBe(false);
        ui.button.click();
        await vi.waitFor(() => expect(ui.progress()).toContain(message));
        expect(ui.invoke.mock.calls.some(([action]) => action === "publish")).toBe(false);
        expect(ui.button.disabled).toBe(false);
      } finally {
        ui.dom.close();
      }
    });
    it("模型不存在时可点击，显示原因并展开设置", async () => {
      const ui = await workbench({ title: "标题", content: "正文", images: ["a.png"], models: [] });
      try {
        expect(ui.button.disabled).toBe(false);
        ui.button.click();
        await vi.waitFor(() => expect(ui.progress()).toContain("未找到本地模型"));
        expect((ui.dom.window.document.getElementById("settings") as HTMLDetailsElement).open).toBe(true);
        expect(ui.button.disabled).toBe(false);
      } finally {
        ui.dom.close();
      }
    });
    it("启动连接失败后无需重启，点击会重新检查并执行发布", async () => {
      const ui = await workbench({ title: "标题", content: "正文", images: ["a.png"], offline: true });
      try {
        expect(ui.progress()).toContain("初始化未完成");
        expect(ui.button.disabled).toBe(false);
        ui.button.click();
        await vi.waitFor(() => expect(ui.progress()).toContain("任务暂停：Ollama 无法连接"));
        ui.recover();
        ui.button.click();
        expect(ui.button.disabled).toBe(true);
        await vi.waitFor(() => expect(ui.progress()).toContain("平台已显示发布成功"));
        expect(ui.invoke.mock.calls.filter(([action]) => action === "publish")).toHaveLength(1);
        expect(ui.button.disabled).toBe(false);
      } finally {
        ui.dom.close();
      }
    });
    it("条件齐全时按钮传递完整发布请求，并阻止执行期间重复点击", async () => {
      const ui = await workbench({ title: "标题", content: "正文", images: ["a.png"] });
      try {
        ui.button.click();
        ui.button.click();
        await vi.waitFor(() => expect(ui.progress()).toContain("平台已显示发布成功"));
        expect(ui.invoke).toHaveBeenCalledWith("publish", {
          title: "标题",
          content: "正文",
          model: "qwen3:4b",
          target: "rednote",
        });
        expect(ui.invoke.mock.calls.filter(([action]) => action === "publish")).toHaveLength(1);
      } finally {
        ui.dom.close();
      }
    });
  });
});
