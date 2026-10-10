// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { PublishState } from "./page-tool";
import { type PublishSteps, runPublisher } from "./publish";

function steps(states: PublishState[]) {
  let index = 0;
  const controller = new AbortController();
  const value: PublishSteps = {
    signal: controller.signal,
    progress: vi.fn(),
    state: vi.fn(async () => states[Math.min(index++, states.length - 1)]),
    upload: vi.fn(async () => {}),
    observeAndFill: vi.fn(async () => {}),
    submit: vi.fn(async () => {}),
    submitted: vi.fn(),
    wait: vi.fn(async () => {}),
  };
  return { value, controller };
}
const ready = { submitReady: true, success: false, blocked: false };
describe("自动发布控制器", () => {
  it("自动上传、填写、提交一次并验证成功回执", async () => {
    const { value } = steps([ready, ready, { ...ready, success: true }]);
    expect(await runPublisher(value)).toEqual({ submitted: true, verified: true });
    expect(value.upload).toHaveBeenCalledTimes(1);
    expect(value.observeAndFill).toHaveBeenCalledTimes(1);
    expect(value.submit).toHaveBeenCalledTimes(1);
    expect(value.submitted).toHaveBeenCalledTimes(1);
  });
  it("登录或验证码阻塞时不上传不提交", async () => {
    const { value } = steps([{ ...ready, blocked: true }]);
    await expect(runPublisher(value)).rejects.toThrow("登录或安全验证");
    expect(value.upload).not.toHaveBeenCalled();
    expect(value.submit).not.toHaveBeenCalled();
  });
  it("发布按钮持续禁用或不唯一时不提交", async () => {
    const { value } = steps([{ ...ready, submitReady: false }]);
    await expect(runPublisher(value)).rejects.toThrow("未提交");
    expect(value.submit).not.toHaveBeenCalled();
  });
  it("已提交但没有成功回执时显式报告未知，不重试", async () => {
    const { value } = steps([ready]);
    await expect(runPublisher(value)).rejects.toThrow("不要直接重发");
    expect(value.submit).toHaveBeenCalledTimes(1);
  });
  it("填写核验失败时不点击发布", async () => {
    const { value } = steps([ready]);
    vi.mocked(value.observeAndFill).mockRejectedValue(new Error("文字核验失败"));
    await expect(runPublisher(value)).rejects.toThrow("核验失败");
    expect(value.submit).not.toHaveBeenCalled();
  });
  it("取消发生在填写期间时不提交", async () => {
    const { value, controller } = steps([ready]);
    vi.mocked(value.observeAndFill).mockImplementation(async () => controller.abort(new Error("已停止")));
    await expect(runPublisher(value)).rejects.toThrow("已停止");
    expect(value.submit).not.toHaveBeenCalled();
  });
  it("提交抛错也先记录尝试，防止不确定副作用被重试", async () => {
    const { value } = steps([ready]);
    vi.mocked(value.submit).mockRejectedValue(new Error("连接断开"));
    await expect(runPublisher(value)).rejects.toThrow("连接断开");
    expect(value.submitted).toHaveBeenCalledTimes(1);
    expect(value.submit).toHaveBeenCalledTimes(1);
  });
  it("已存在成功结果时不进行任何提交", async () => {
    const { value } = steps([{ ...ready, success: true }]);
    await expect(runPublisher(value)).rejects.toThrow("重复提交");
    expect(value.upload).not.toHaveBeenCalled();
  });
});
