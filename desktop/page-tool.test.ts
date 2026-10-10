// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseFillRequest } from "./input";
import { type PageObservation, pageTool } from "./page-tool";

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    width: 400,
    height: 40,
    left: 0,
    right: 400,
    top: 0,
    bottom: 40,
    toJSON: () => ({}),
  });
  document.body.innerHTML =
    '<input aria-label="搜索"><input aria-label="作品名称"><textarea aria-label="正文内容"></textarea>';
});
afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  Reflect.deleteProperty(document, "execCommand");
});
const observe = () => pageTool("observe") as PageObservation;

describe("图文入口定位", () => {
  it("排除真实平台的屏幕外副本和近透明副本，只点击实际入口", () => {
    document.body.innerHTML =
      '<div><span class="title" id="offscreen">上传图文</span></div><div style="opacity:0.00001"><span class="title">上传图文</span></div><div><span class="title" id="actual">上传图文</span></div>';
    Object.defineProperty(document.getElementById("offscreen")!, "getBoundingClientRect", {
      value: () => ({
        x: -9710,
        y: -9910,
        width: 64,
        height: 24,
        left: -9710,
        right: -9646,
        top: -9910,
        bottom: -9886,
        toJSON: () => ({}),
      }),
    });
    const click = vi.fn();
    document.getElementById("actual")!.onclick = click;
    pageTool("prepareImages");
    expect(click).toHaveBeenCalledTimes(1);
  });
  it("排除隐藏父容器中的重复入口", () => {
    document.body.innerHTML =
      '<div style="display:none"><span class="title">上传图文</span></div><div style="opacity:0"><span class="title">上传图文</span></div><div aria-hidden="true"><span class="title">上传图文</span></div><button id="valid">上传图文</button>';
    const click = vi.fn();
    document.getElementById("valid")!.onclick = click;
    pageTool("prepareImages");
    expect(click).toHaveBeenCalledTimes(1);
  });
  it("检查 closed shadow host 的可见性，不把隐藏组件算作入口", () => {
    document.body.innerHTML = '<button id="valid">上传图文</button>';
    const host = document.createElement("div");
    host.style.display = "none";
    const root = host.attachShadow({ mode: "closed" });
    root.innerHTML = "<button>上传图文</button>";
    document.body.append(host);
    const click = vi.fn();
    document.getElementById("valid")!.onclick = click;
    pageTool("prepareImages", {}, [root]);
    expect(click).toHaveBeenCalledTimes(1);
  });
  it("真正冲突时提供候选位置和结构，不盲目点击第一个", () => {
    document.body.innerHTML = '<button class="first">上传图文</button><button class="second">上传图文</button>';
    expect(() => pageTool("prepareImages")).toThrow("2 个可见独立入口");
    expect(() => pageTool("prepareImages")).toThrow("class=first");
  });
  it("同一入口的按钮、tab 和内部 span 只点击一次", () => {
    document.body.innerHTML = '<button role="tab"><span class="title">上传图文</span></button>';
    const click = vi.fn();
    document.querySelector("button")!.onclick = click;
    expect(pageTool("prepareImages")).toEqual({ prepared: true });
    expect(click).toHaveBeenCalledTimes(1);
  });
  it("已进入图文编辑器时不再点击切换入口", () => {
    document.body.innerHTML += '<input type="file" accept="image/*"><button>上传图文</button><button>上传图文</button>';
    const clicks = vi.fn();
    for (const button of document.querySelectorAll("button")) button.onclick = clicks;
    expect(pageTool("prepareImages")).toEqual({ prepared: true });
    expect(clicks).not.toHaveBeenCalled();
  });
  it("多个入口中唯一已选中的图文 tab 不需要重复点击", () => {
    document.body.innerHTML = '<button role="tab" aria-selected="true">上传图文</button><button>上传图文</button>';
    const click = vi.fn();
    for (const button of document.querySelectorAll("button")) button.onclick = click;
    expect(pageTool("prepareImages")).toEqual({ prepared: true });
    expect(click).not.toHaveBeenCalled();
  });
  it("排除隐藏和禁用入口，但真正独立的歧义仍停止", () => {
    document.body.innerHTML =
      '<button disabled>上传图文</button><button style="display:none">上传图文</button><button id="valid">上传图文</button>';
    const click = vi.fn();
    document.getElementById("valid")!.onclick = click;
    pageTool("prepareImages");
    expect(click).toHaveBeenCalledTimes(1);
    document.body.innerHTML += "<button>上传图文</button>";
    expect(() => pageTool("prepareImages")).toThrow("入口不唯一");
  });
});

describe("桌面受控页面工具", () => {
  it("只观察标签，不读取正文值", () => {
    document.querySelector("textarea")!.value = "私密内容";
    const result = observe();
    expect(result.bodyId).toBe("e2");
    expect(JSON.stringify(result)).not.toContain("私密内容");
  });
  it("填写并回读唯一目标，不点击提交", () => {
    const snapshot = observe();
    const target = { observationId: snapshot.observationId, id: "e1", text: "测试" };
    expect(pageTool("fill", target)).toEqual({ value: "测试" });
    expect(pageTool("read", target)).toEqual({ value: "测试" });
    expect(document.querySelector("input")!.value).toBe("");
  });
  it("拒绝未知 ID、旧观察和节点替换", () => {
    const snapshot = observe();
    expect(() => pageTool("fill", { observationId: snapshot.observationId, id: "e99", text: "x" })).toThrow();
    expect(() => pageTool("fill", { observationId: "old", id: "e1", text: "x" })).toThrow();
    document.body.innerHTML = "<input>";
    expect(() => pageTool("fill", { observationId: snapshot.observationId, id: "e1", text: "x" })).toThrow();
  });
  it("已有相同文字可核验，不覆盖不同内容", () => {
    const snapshot = observe();
    const target = { observationId: snapshot.observationId, id: "e1", text: "已有" };
    pageTool("fill", target);
    expect(pageTool("fill", target)).toEqual({ value: "已有" });
    expect(() => pageTool("fill", { ...target, text: "其他" })).toThrow("不会自动覆盖");
  });
  it("密码框、readonly、无关弹窗不进入候选", () => {
    document.body.innerHTML += '<input type="password"><input readonly><div role="dialog"><input></div>';
    expect(observe().candidates).toHaveLength(3);
  });
  it("支持 open shadow DOM 的原生标题框", () => {
    const host = document.createElement("div");
    host.attachShadow({ mode: "open" }).innerHTML = '<input placeholder="标题">';
    document.body.append(host);
    expect(observe().candidates.at(-1)?.placeholder).toBe("标题");
  });
  it("支持由执行器提供的 closed shadow DOM，不重复收集 open root", () => {
    const host = document.createElement("div");
    const closed = host.attachShadow({ mode: "closed" });
    closed.innerHTML = '<input placeholder="标题">';
    document.body.append(host);
    const result = pageTool("observe", {}, [closed]) as PageObservation;
    expect(result.candidates).toHaveLength(4);
    const args = { observationId: result.observationId, id: "e3", text: "闭合编辑器" };
    expect(pageTool("fill", args, [closed])).toEqual({ value: "闭合编辑器" });
    const openHost = document.createElement("div");
    const open = openHost.attachShadow({ mode: "open" });
    open.innerHTML = '<input placeholder="别名">';
    document.body.append(openHost);
    expect((pageTool("observe", {}, [closed, open]) as PageObservation).candidates).toHaveLength(5);
  });
  it("填写后编辑器移除占位提示仍能回读并提交，不重复填写", () => {
    document.body.innerHTML += '<button id="publish">发布</button>';
    const body = document.querySelector("textarea")!;
    body.setAttribute("data-placeholder", "输入正文");
    const snapshot = observe();
    const title = { observationId: snapshot.observationId, id: "e1", text: "标题" };
    const content = { observationId: snapshot.observationId, id: "e2", text: "正文" };
    const input = vi.fn(() => body.removeAttribute("data-placeholder"));
    body.addEventListener("input", input);
    pageTool("fill", title);
    pageTool("fill", content);
    expect(pageTool("read", content)).toEqual({ value: "正文" });
    expect(pageTool("fill", content)).toEqual({ value: "正文" });
    expect(input).toHaveBeenCalledTimes(1);
    const click = vi.fn();
    document.getElementById("publish")!.onclick = click;
    expect(pageTool("submit", { ...title, expectedTitle: "标题", bodyId: "e2", expectedContent: "正文" })).toEqual({
      submitted: true,
    });
    expect(click).toHaveBeenCalledTimes(1);
  });
  it("支持富文本内部占位段落在输入后异步消失", async () => {
    document.body.innerHTML = '<div contenteditable="true"><p data-placeholder="输入正文"></p></div>';
    const editor = document.querySelector<HTMLElement>("[contenteditable]")!;
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn(() => {
        editor.textContent = "正文";
        return true;
      }),
    });
    const snapshot = observe();
    const args = { observationId: snapshot.observationId, id: "e0", text: "正文" };
    pageTool("fill", args);
    await Promise.resolve();
    expect(pageTool("read", args)).toEqual({ value: "正文" });
  });
  it("占位提示变化不能掩盖内容篡改、节点替换或标签改变", () => {
    const body = document.querySelector("textarea")!;
    body.placeholder = "正文";
    const snapshot = observe();
    const args = { observationId: snapshot.observationId, id: "e2", text: "正文" };
    pageTool("fill", args);
    body.removeAttribute("placeholder");
    body.value = "已改变";
    expect(() => pageTool("read", args)).toThrow("字段标签或占位提示");
    body.value = "正文";
    body.setAttribute("aria-label", "搜索");
    expect(() => pageTool("read", args)).toThrow();
    body.replaceWith(body.cloneNode(true));
    expect(() => pageTool("read", args)).toThrow("节点被替换");
  });
  it("未由工具填写的占位提示消失仍需重新观察", () => {
    const body = document.querySelector("textarea")!;
    body.placeholder = "正文";
    const snapshot = observe();
    body.removeAttribute("placeholder");
    expect(() => pageTool("read", { observationId: snapshot.observationId, id: "e2" })).toThrow();
  });
  it("平台重渲染已写入节点时仅重新绑定唯一且全文一致的同身份字段", () => {
    const snapshot = observe();
    const args = { observationId: snapshot.observationId, id: "e2", text: "正文" };
    pageTool("fill", args);
    const body = document.querySelector("textarea")!;
    const replacement = body.cloneNode(true) as HTMLTextAreaElement;
    replacement.value = "正文";
    body.replaceWith(replacement);
    expect(pageTool("read", args)).toEqual({ value: "正文" });
    replacement.value = "不同内容";
    expect(pageTool("read", args)).toEqual({ value: "不同内容" });
    expect(() => pageTool("fill", args)).toThrow("不会自动覆盖");
  });
  it("重渲染后文本不一致或出现两个同身份字段时拒绝重新绑定", () => {
    const snapshot = observe();
    const args = { observationId: snapshot.observationId, id: "e2", text: "正文" };
    pageTool("fill", args);
    const body = document.querySelector("textarea")!;
    const replacement = body.cloneNode(true) as HTMLTextAreaElement;
    replacement.value = "不同内容";
    body.replaceWith(replacement);
    expect(() => pageTool("read", args)).toThrow("节点被替换");
    replacement.value = "正文";
    document.body.append(replacement.cloneNode(true));
    expect(() => pageTool("read", args)).toThrow("节点被替换");
  });
});

describe("桌面请求验证", () => {
  it("接受有限长度标题与明确上传标记", () => {
    expect(parseFillRequest({ title: "标题", content: "", model: "qwen3:4b" }).upload).toBe(false);
  });

  describe("受控自动提交", () => {
    function prepare() {
      document.body.innerHTML += '<button id="submit">发布</button><p role="status" id="result"></p>';
      const snapshot = observe();
      pageTool("fill", { observationId: snapshot.observationId, id: "e1", text: "标题" });
      pageTool("fill", { observationId: snapshot.observationId, id: "e2", text: "正文" });
      const click = vi.fn(() => {
        document.getElementById("result")!.textContent = "发布成功";
      });
      document.getElementById("submit")!.onclick = click;
      return {
        click,
        args: {
          observationId: snapshot.observationId,
          id: "e1",
          expectedTitle: "标题",
          bodyId: "e2",
          expectedContent: "正文",
        },
      };
    }
    it("精确匹配发布按钮，提交前再核对文字，并只触发一次 click", () => {
      const { click, args } = prepare();
      expect(pageTool("publishState")).toMatchObject({ submitReady: true, success: false });
      expect(pageTool("submit", args)).toEqual({ submitted: true });
      expect(click).toHaveBeenCalledTimes(1);
      expect(pageTool("publishState")).toMatchObject({ success: true });
      expect(() => pageTool("submit", args)).toThrow();
    });
    it("不把点击或页面中提到发布成功当成成功回执", () => {
      prepare();
      document.body.innerHTML += "<p>操作说明：发布成功之后去内容管理</p><button>定时发布</button>";
      expect(pageTool("publishState")).toMatchObject({ success: false, submitReady: true });
    });
    it("禁用、多个发布入口或验证码时拒绝提交", () => {
      const { click, args } = prepare();
      document.getElementById("submit")!.setAttribute("disabled", "");
      expect(() => pageTool("submit", args)).toThrow();
      document.getElementById("submit")!.removeAttribute("disabled");
      document.body.innerHTML += "<button>发布</button>";
      expect(() => pageTool("submit", args)).toThrow();
      document.body.innerHTML += '<div role="dialog">请完成安全验证</div>';
      expect(pageTool("publishState")).toMatchObject({ blocked: true });
      expect(click).not.toHaveBeenCalled();
    });
    it("提交前内容变化时拒绝点击", () => {
      const { click, args } = prepare();
      document.querySelector("textarea")!.value = "被修改";
      expect(() => pageTool("submit", args)).toThrow("文字核验失败");
      expect(click).not.toHaveBeenCalled();
    });
  });
  it("拒绝无效参数、超长标题和非布尔上传指令", () => {
    for (const value of [
      null,
      {},
      { title: "x".repeat(21), content: "", model: "qwen3:4b" },
      { title: "x", content: "", model: "qwen3:4b", upload: "yes" },
    ]) {
      expect(() => parseFillRequest(value)).toThrow();
    }
  });
});
