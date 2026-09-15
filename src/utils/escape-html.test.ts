import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { escapeHtml } from "~utils/escape-html";

describe("escapeHtml", () => {
  it("转义 & < >", () => {
    expect(escapeHtml("a & b < c > d")).toBe("a &amp; b &lt; c &gt; d");
  });

  it("先转义 & 再转义尖括号，避免二次转义", () => {
    // 若不先处理 &，输入 "&lt;" 会得到错误结果
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
    expect(escapeHtml("&&")).toBe("&amp;&amp;");
  });

  it("原样保留引号、换行与普通文本（文本节点场景无需转义引号）", () => {
    expect(escapeHtml('他说 "你好"\n第二行')).toBe('他说 "你好"\n第二行');
  });

  it("空字符串安全", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("使 HTML 标记无法被当成标签解析", () => {
    const out = escapeHtml("<img src=x onerror=alert(1)>");
    expect(out).toBe("&lt;img src=x onerror=alert(1)&gt;");
    expect(out).not.toContain("<img");
  });

  it("先转义、再拼接自建 <br> 的顺序正确（平台编辑器场景）", () => {
    // 适配器里就是这么用的：先 escapeHtml(文本)，之后插入的 <br> 不应被转义
    const out = escapeHtml("<div>\n文字").replace(/\n/g, "<br>");
    expect(out).toBe("&lt;div&gt;<br>文字");
    expect(out).toContain("<br>");
  });
});

describe("escape-html 模块的产物体积前提", () => {
  it("不得引入任何依赖（否则会把 DOMPurify/marked 等重库带进侧边栏与内容脚本分包）", () => {
    // 背景：曾把 escapeHtml 放在 ~utils/sanitize 里导出，导致 maimai / weixinchannel
    // 引用它时把 DOMPurify + marked（约 70 KB）拖进 sidepanel 分包。这条测试守住该前提。
    const source = readFileSync("src/utils/escape-html.ts", "utf8");
    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source).not.toMatch(/require\(/);
  });
});
