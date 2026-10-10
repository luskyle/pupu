import { afterEach, describe, expect, it, vi } from "vitest";
import { parseCandidates, parseChoice, parseSettings, selectTitle } from "./decision";

const candidates = [{ id: "e0", kind: "input" as const, label: "标题", placeholder: "" }];
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("本地有限选择", () => {
  it("默认关闭，拒绝无效设置", () => {
    expect(parseSettings(undefined).enabled).toBe(false);
    expect(() => parseSettings({ enabled: true, model: "" })).toThrow();
  });
  it("只接受当前候选或者 none", () => {
    expect(parseChoice('{"choice":"e0"}', candidates)).toBe("e0");
    expect(parseChoice('{"choice":"none"}', candidates)).toBeNull();
    for (const content of ['{"choice":"e9"}', '{"choice":"e0","code":"alert(1)"}', "broken", '{"choice":null}']) {
      expect(() => parseChoice(content, candidates)).toThrow();
    }
  });
  it("限制数量、长度和重复 ID，剥离不必要的字段", () => {
    expect(parseCandidates([{ ...candidates[0], value: "不应发送的正文" }])).toEqual(candidates);
    expect(() => parseCandidates([candidates[0], candidates[0]])).toThrow();
    expect(() => parseCandidates([{ ...candidates[0], label: "a".repeat(121) }])).toThrow();
    expect(() => parseCandidates(Array.from({ length: 21 }, (_, i) => ({ ...candidates[0], id: `e${i}` })))).toThrow();
  });
  it("无候选不调用模型", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await selectTitle("qwen3:4b", [])).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("候选文本超过字节预算时不调用模型", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const large = Array.from({ length: 10 }, (_, i) => ({
      ...candidates[0],
      id: `e${i}`,
      label: "标".repeat(120),
    }));
    await expect(selectTitle("qwen3:4b", large)).rejects.toThrow("输入预算");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("固定回环端点，约束输出，不发送候选值", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ message: { content: '{"choice":"e0"}' } })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await selectTitle("qwen3:4b", candidates)).toBe("e0");
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:11434/api/chat");
    expect(options.redirect).toBe("error");
    const body = JSON.parse(options.body);
    expect(body.format.properties.choice.enum).toEqual(["e0", "none"]);
    expect(body.messages[1].content).toBe(JSON.stringify(candidates));
  });
  it("HTTP 和无效响应显式失败", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    await expect(selectTitle("qwen3:4b", candidates)).rejects.toThrow("HTTP 503");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
    await expect(selectTitle("qwen3:4b", candidates)).rejects.toThrow("没有返回");
  });
  it("外部取消信号和超时真正中止模型请求", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_url, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener("abort", () => reject(options.signal?.reason), { once: true });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    const pending = selectTitle("qwen3:4b", candidates, { signal: controller.signal });
    const cancelled = expect(pending).rejects.toThrow("用户停止");
    controller.abort(new Error("用户停止"));
    await cancelled;
    expect(vi.getTimerCount()).toBe(0);
    const timeout = selectTitle("qwen3:4b", candidates, { timeoutMs: 100 });
    const timedOut = expect(timeout).rejects.toThrow("决策超时");
    await vi.advanceTimersByTimeAsync(100);
    await timedOut;
    expect(vi.getTimerCount()).toBe(0);
  });
  it("已取消的请求不访问模型", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    controller.abort(new Error("已取消"));
    await expect(selectTitle("qwen3:4b", candidates, { signal: controller.signal })).rejects.toThrow("已取消");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
