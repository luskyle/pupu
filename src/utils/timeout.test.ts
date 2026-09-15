import { describe, expect, it, vi } from "vitest";
import { TimeoutError, withTimeout } from "~utils/timeout";

describe("withTimeout", () => {
  it("未超时则原样返回结果", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 1000)).resolves.toBe("ok");
  });

  it("超时以 TimeoutError 拒绝", async () => {
    vi.useFakeTimers();
    try {
      const pending = new Promise(() => {});
      const guarded = withTimeout(pending, 1000, "填充超时");
      const assertion = expect(guarded).rejects.toBeInstanceOf(TimeoutError);
      await vi.advanceTimersByTimeAsync(1000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it("超时信息使用传入的文案", async () => {
    vi.useFakeTimers();
    try {
      const guarded = withTimeout(new Promise(() => {}), 500, "填充超过 60 秒仍未完成");
      const assertion = expect(guarded).rejects.toThrow("填充超过 60 秒仍未完成");
      await vi.advanceTimersByTimeAsync(500);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it("原始失败（非超时）原样透传，不包装成 TimeoutError", async () => {
    await expect(withTimeout(Promise.reject(new Error("页面元素未找到")), 1000)).rejects.toThrow("页面元素未找到");
  });

  it("即使先失败，之后到点的定时器也不会再触发拒绝", async () => {
    vi.useFakeTimers();
    try {
      await expect(withTimeout(Promise.reject(new Error("提前失败")), 1000)).rejects.toThrow("提前失败");
      await vi.advanceTimersByTimeAsync(5000);
    } finally {
      vi.useRealTimers();
    }
  });
});
