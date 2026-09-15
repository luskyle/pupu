// 小红书（rednote）文案格式规则。
//
// 这些规则原先内联在 src/sync/dynamic/rednote.ts 的发布流程里，无法单测；
// 抽成纯函数后既能被测试覆盖，也避免多处实现逐渐走偏。

/** 小红书标题字数上限：超过则不填充标题（注意是「跳过」而不是「截断」）。 */
export const XHS_TITLE_MAX_LENGTH = 20;

/**
 * 把 `#话题#` 转换为小红书认可的格式 `#话题[话题]#`。
 *
 * 与原实现保持一致：话题名内不允许空白（`[^#\s]+`），因此 `#今日 好物#` 不会被转换。
 */
export const toXhsTopic = (text: string): string => text.replace(/#([^#\s]+)#/g, "#$1[话题]#");

/**
 * 取小红书标题：显式标题优先，否则退化为正文首行；
 * 结果超过 {@link XHS_TITLE_MAX_LENGTH} 字时返回空串（不填标题，而不是截断）。
 */
export const pickXhsTitle = (title?: string, content?: string): string => {
  const rawTitle = title || content?.split("\n")[0] || "";
  return rawTitle.length > XHS_TITLE_MAX_LENGTH ? "" : toXhsTopic(rawTitle);
};

/** 拼接动态正文与话题（话题以 `#话题#` 追加），并整体转换为小红书格式。 */
export const buildXhsContent = (content?: string, tags?: string[]): string =>
  toXhsTopic(`${content || ""}${tags?.length ? ` ${tags.map((t) => `#${t}#`).join(" ")}` : ""}`);
