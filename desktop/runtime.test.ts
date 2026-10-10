// @vitest-environment node
import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalRuntime } from "./runtime";

const mocks = vi.hoisted(() => ({ spawn: vi.fn(), readFile: vi.fn(), access: vi.fn() }));
vi.mock("node:child_process", () => ({ spawn: mocks.spawn }));
vi.mock("node:fs/promises", () => ({
  readFile: mocks.readFile,
  access: mocks.access,
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
  vi.useRealTimers();
});

describe("本地运行时生命周期", () => {
  it("复用已有服务，并发检查合并，不结束用户服务", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    const runtime = new LocalRuntime("/config", vi.fn());
    await Promise.all([runtime.ensure(), runtime.ensure()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    runtime.stop();
    expect(mocks.spawn).not.toHaveBeenCalled();
  });
  it("配置缺失或无效时明确失败，不执行任意程序", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("离线")));
    mocks.readFile.mockResolvedValue("{}");
    const runtime = new LocalRuntime("/config", vi.fn());
    await expect(runtime.ensure()).rejects.toThrow("配置无效");
    mocks.readFile.mockRejectedValue(new Error("missing"));
    await expect(runtime.ensure()).rejects.toThrow("未配置");
    expect(mocks.spawn).not.toHaveBeenCalled();
  });
  it("只启动一个本机服务并在结束时关闭自有进程", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("离线")).mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    mocks.readFile.mockResolvedValue(JSON.stringify({ executable: "/bin/ollama", models: "/models" }));
    const child = Object.assign(new EventEmitter(), { kill: vi.fn(), stderr: new EventEmitter() });
    mocks.spawn.mockReturnValue(child);
    const runtime = new LocalRuntime("/config", vi.fn());
    const pending = Promise.all([runtime.ensure(), runtime.ensure()]);
    await vi.advanceTimersByTimeAsync(250);
    await pending;
    expect(mocks.spawn).toHaveBeenCalledTimes(1);
    expect(mocks.spawn.mock.calls[0][2].env).toMatchObject({ OLLAMA_HOST: "127.0.0.1:11434", OLLAMA_NO_CLOUD: "1" });
    runtime.stop();
    expect(child.kill).toHaveBeenCalledTimes(1);
    runtime.stop();
    expect(child.kill).toHaveBeenCalledTimes(1);
  });
});
