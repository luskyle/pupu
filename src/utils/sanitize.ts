// HTML 消毒：任何要交给 dangerouslySetInnerHTML、或要注入第三方平台页面的字符串，
// 都必须先经过这里。
//
// 背景：marked 按设计不做消毒（Markdown 中的内联 HTML 会原样穿透），而从 URL 导入的文章
// 又来自任意站点；这些内容最终既会渲染在扩展的选项页（特权源），也会通过 innerHTML
// 注入各平台的编辑器页面（见 sync/article/*.ts），因此必须在入口处统一消毒。
import DOMPurify from "dompurify";
import { marked } from "marked";

// 文章内容不需要表单控件，而导入内容来自任意站点：显式禁止，避免在扩展页面里渲染出
// 可输入的假表单（视觉伪装、收集输入）。
const FORBID_TAGS = ["form", "input", "button", "select", "option", "textarea", "label"];

/**
 * 消毒 HTML 字符串。
 *
 * 采用 DOMPurify 默认白名单：保留文章常用标签（p / h1-h6 / ul / ol / li / a / img /
 * table / blockquote / pre / code / strong / em / figure 等）与 `style`、`class`、`data-*`
 * 等属性（导入文章的排版依赖内联样式，必须保留），移除 `<script>`、`<style>`、`<iframe>`、
 * `on*` 事件处理器与 `javascript:` 链接，并禁止表单控件。
 *
 * 已知取舍：`style` 属性内的 CSS 不做解析（即 `background:url(javascript:...)` 会被原样保留）。
 * 现代浏览器不会在 CSS 中执行 `javascript:`，而解析 CSS 需要额外引入 CSS 消毒器，
 * 且会影响导入文章的样式保真度，故按此取舍处理。
 */
export const sanitizeHtml = (html: string): string => DOMPurify.sanitize(html, { FORBID_TAGS });

/**
 * Markdown 转「可安全注入 DOM」的 HTML。
 *
 * 必须用这个函数而不是直接 `marked.parse`：后者会让 Markdown 里的内联 HTML
 * （含事件处理器）原样进入页面。
 */
export const renderMarkdownSafely = (markdown: string): string => sanitizeHtml(marked.parse(markdown) as string);
