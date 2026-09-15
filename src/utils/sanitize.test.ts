// @vitest-environment jsdom
//
// 消毒是安全控制，必须锁住行为：既不能被绕过（脚本/事件处理器必须消失），
// 也不能过度清除（文章常用标签与内联样式要保留，否则导入的文章样式会丢）。
import { describe, expect, it } from "vitest";
import { renderMarkdownSafely, sanitizeHtml } from "~utils/sanitize";

describe("sanitizeHtml 移除可执行内容", () => {
  it("移除 <script>", () => {
    const out = sanitizeHtml("<p>正文</p><script>alert(1)</script>");
    expect(out).toContain("正文");
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert(1)");
  });

  it("移除行内事件处理器", () => {
    const out = sanitizeHtml('<img src="https://a.com/x.png" onerror="alert(1)">');
    expect(out).toContain("a.com/x.png");
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("alert(1)");

    const out2 = sanitizeHtml('<div onclick="alert(1)" onmouseover="alert(2)">x</div>');
    expect(out2).not.toContain("onclick");
    expect(out2).not.toContain("onmouseover");
  });

  it("移除 javascript: 链接", () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">点我</a>');
    expect(out).toContain("点我");
    expect(out).not.toContain("javascript:");
  });

  it("移除 iframe / object / embed", () => {
    const out = sanitizeHtml('<iframe src="https://evil.com"></iframe><object data="x"></object>');
    expect(out).not.toContain("<iframe");
    expect(out).not.toContain("<object");
  });

  it("移除 <style> 元素（避免 CSS 注入）", () => {
    const out = sanitizeHtml("<style>body{display:none}</style><p>正文</p>");
    expect(out).toContain("正文");
    expect(out).not.toContain("<style");
    expect(out).not.toContain("display:none");
  });

  it("处理 svg 内嵌脚本等变形写法", () => {
    const out = sanitizeHtml("<svg><script>alert(1)</script></svg>");
    expect(out).not.toContain("alert(1)");
  });

  it("移除表单控件（导入内容不需要，避免渲染出假表单）", () => {
    const out = sanitizeHtml('<form action="https://evil.com"><input name="pwd"><button>提交</button></form>');
    expect(out).not.toContain("<form");
    expect(out).not.toContain("<input");
    expect(out).not.toContain("<button");
    expect(out).not.toContain("evil.com");
  });
});

describe("sanitizeHtml 保留文章正常内容", () => {
  it("保留常用排版标签", () => {
    const html =
      "<h1>标题</h1><h2>二级</h2><p><strong>粗</strong><em>斜</em></p>" +
      "<ul><li>一</li><li>二</li></ul><ol><li>1</li></ol>" +
      "<blockquote>引用</blockquote><pre><code>code</code></pre>";
    const out = sanitizeHtml(html);
    for (const tag of ["<h1>", "<h2>", "<strong>", "<em>", "<ul>", "<li>", "<ol>", "<blockquote>", "<pre>", "<code>"]) {
      expect(out).toContain(tag);
    }
  });

  it("保留链接与图片及其属性", () => {
    const out = sanitizeHtml('<a href="https://a.com/x" title="t">链接</a><img src="https://a.com/i.png" alt="图">');
    expect(out).toContain('href="https://a.com/x"');
    expect(out).toContain('src="https://a.com/i.png"');
    expect(out).toContain('alt="图"');
  });

  it("保留表格结构", () => {
    const out = sanitizeHtml("<table><thead><tr><th>列</th></tr></thead><tbody><tr><td>值</td></tr></tbody></table>");
    for (const tag of ["<table>", "<thead>", "<tr>", "<th>", "<tbody>", "<td>"]) {
      expect(out).toContain(tag);
    }
  });

  it("保留 class 与 data-* 属性（平台适配与样式依赖）", () => {
    const out = sanitizeHtml('<div class="rich-text" data-id="12">x</div>');
    expect(out).toContain('class="rich-text"');
    expect(out).toContain('data-id="12"');
  });

  it("保留内联 style 属性（导入文章的排版保真度依赖它）", () => {
    const out = sanitizeHtml('<p style="color:red;text-align:center">文字</p>');
    expect(out).toContain('style="color:red;text-align:center"');
  });

  it("保留图片上同时存在的 style 与 data-* 属性", () => {
    const out = sanitizeHtml('<img src="https://a.com/i.png" style="width:100%" data-src="https://a.com/i.png">');
    expect(out).toContain('style="width:100%"');
    expect(out).toContain('data-src="https://a.com/i.png"');
  });

  it("保留 figure / figcaption / svg / video", () => {
    const out = sanitizeHtml(
      '<figure><img src="https://a.com/i.png"><figcaption>图注</figcaption></figure>' +
        '<svg viewBox="0 0 10 10"><path d="M0 0"></path></svg><video src="https://a.com/v.mp4"></video>',
    );
    expect(out).toContain("<figure>");
    expect(out).toContain("<figcaption>");
    expect(out).toContain("<svg");
    expect(out).toContain("<video");
  });

  it("链接的 target 会被去掉（默认安全取舍，避免反向标签劫持）", () => {
    const out = sanitizeHtml('<a href="https://a.com" target="_blank" rel="noopener">x</a>');
    expect(out).toContain('href="https://a.com"');
    expect(out).not.toContain("target=");
  });
});

describe("renderMarkdownSafely", () => {
  it("正常渲染 Markdown 结构", () => {
    const out = renderMarkdownSafely("# 标题\n\n- 一\n- 二\n\n**粗体**");
    expect(out).toContain("<h1");
    expect(out).toContain("<li>");
    expect(out).toContain("<strong>");
  });

  it("清除 Markdown 内联 HTML 中的事件处理器", () => {
    const out = renderMarkdownSafely('<img src="https://a.com/x.png" onerror="alert(1)">');
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("alert(1)");
  });

  it("清除 Markdown 内联 <script>", () => {
    const out = renderMarkdownSafely("<script>alert(1)</script>\n\n正文");
    expect(out).toContain("正文");
    expect(out).not.toContain("alert(1)");
  });

  it("清除 javascript: 形式的 Markdown 链接", () => {
    const out = renderMarkdownSafely("[点我](javascript:alert(1))");
    expect(out).not.toContain("javascript:");
  });

  it("保留普通 Markdown 链接与图片", () => {
    const out = renderMarkdownSafely("[链接](https://a.com/x)\n\n![图](https://a.com/i.png)");
    expect(out).toContain('href="https://a.com/x"');
    expect(out).toContain('src="https://a.com/i.png"');
  });
});
