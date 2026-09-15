// 发布结果的状态与统计（纯函数，零依赖）。
//
// 状态语义刻意区分「填充成功」与「真的发出去了」：填充只代表内容已写入平台页面，
// 最终是否点下发布按钮取决于用户（手动发布模式）或平台页面（自动发布模式），
// 因此这里叫 filled 而不是 success —— 界面文案同样是「已填充，待确认」。

/** 单个平台标签页的填充状态。 */
export type PublishStatus = "pending" | "filled" | "failed" | "unconfirmed";

/** 除「进行中」之外的终态，即适配器注入后能直接得到的状态。 */
export type PublishOutcomeStatus = Exclude<PublishStatus, "pending">;

export interface PublishTabResult {
  status: PublishStatus;
  /** 失败原因（status 为 failed 时给出，便于用户自助排查） */
  error?: string;
  /** 结论时间戳（ms） */
  at: number;
}

export interface PublishSummary {
  total: number;
  pending: number;
  filled: number;
  unconfirmed: number;
  failed: number;
}

/** 汇总一组标签页结果；缺失结果的标签页（尚无回执）按「进行中」计入。 */
export function summarizePublishResults(results: Array<PublishTabResult | undefined>): PublishSummary {
  const summary: PublishSummary = { total: results.length, pending: 0, filled: 0, unconfirmed: 0, failed: 0 };
  for (const result of results) {
    summary[result?.status ?? "pending"] += 1;
  }
  return summary;
}

/**
 * 扩展图标上的数字：只统计失败，没有失败就返回空串（清除 badge）。
 * 「待确认」不计入 —— 它可能是填充仍在进行，标成红色会让用户误以为已经失败。
 */
export function publishBadgeText(summary: PublishSummary): string {
  return summary.failed > 0 ? String(summary.failed) : "";
}
