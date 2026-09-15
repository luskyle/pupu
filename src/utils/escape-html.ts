/**
 * 把纯文本转义为可安全拼进 HTML 的片段。
 *
 * 刻意放在这个**不引入任何依赖**的模块里：它只需要三行字符串替换，
 * 而 `~utils/sanitize` 会带上 DOMPurify 与 marked（约 70 KB）。
 * 平台适配器只做「文本 + 自建标签」拼接时，务必从这里导入，
 * 否则会把这两个重库带进侧边栏/内容脚本等分包。
 *
 * 顺序上必须先替换 `&`，否则会把后续生成的实体二次转义。
 */
export const escapeHtml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
