import { describe, expect, it } from "vitest";
import { type PublishTabResult, publishBadgeText, summarizePublishResults } from "~utils/publish-result";

const result = (status: PublishTabResult["status"]): PublishTabResult => ({ status, at: 0 });

describe("summarizePublishResults", () => {
  it("空列表汇总为零", () => {
    expect(summarizePublishResults([])).toEqual({
      total: 0,
      pending: 0,
      filled: 0,
      unconfirmed: 0,
      failed: 0,
    });
  });

  it("按状态分别计数", () => {
    const summary = summarizePublishResults([
      result("filled"),
      result("filled"),
      result("failed"),
      result("unconfirmed"),
      result("pending"),
    ]);

    expect(summary).toEqual({ total: 5, pending: 1, filled: 2, unconfirmed: 1, failed: 1 });
  });

  it("尚无回执的标签页按「进行中」计入（不是成功也不是失败）", () => {
    const summary = summarizePublishResults([undefined, undefined]);

    expect(summary).toEqual({ total: 2, pending: 2, filled: 0, unconfirmed: 0, failed: 0 });
  });

  it("全部失败时 filled 为 0", () => {
    const summary = summarizePublishResults([result("failed"), result("failed")]);

    expect(summary.failed).toBe(2);
    expect(summary.filled).toBe(0);
  });
});

describe("publishBadgeText", () => {
  it("没有失败时返回空串（清除 badge）", () => {
    expect(publishBadgeText(summarizePublishResults([]))).toBe("");
    expect(publishBadgeText(summarizePublishResults([result("filled")]))).toBe("");
  });

  it("「待确认」不计入 badge —— 它可能只是仍在填充", () => {
    expect(publishBadgeText(summarizePublishResults([result("unconfirmed"), result("pending")]))).toBe("");
  });

  it("失败数写到 badge 上", () => {
    expect(publishBadgeText(summarizePublishResults([result("failed"), result("filled")]))).toBe("1");
    expect(publishBadgeText(summarizePublishResults([result("failed"), result("failed"), result("failed")]))).toBe("3");
  });
});
