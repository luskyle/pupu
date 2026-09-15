// 日志分级门禁的单测：这里锁的是「生产环境不要往外喷调试日志」这个行为，
// 一旦被改坏（例如把所有级别都直通 console），线上会重新出现大量噪音与潜在数据泄漏。
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loadLogger = async (nodeEnv: string) => {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.resetModules();
  return (await import("~utils/logger")).logger;
};

let spies: {
  log: ReturnType<typeof vi.spyOn>;
  info: ReturnType<typeof vi.spyOn>;
  warn: ReturnType<typeof vi.spyOn>;
  error: ReturnType<typeof vi.spyOn>;
};

beforeEach(() => {
  spies = {
    log: vi.spyOn(console, "log").mockImplementation(() => {}),
    info: vi.spyOn(console, "info").mockImplementation(() => {}),
    warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
    error: vi.spyOn(console, "error").mockImplementation(() => {}),
  };
  // 重置调试开关（赋 undefined 而非 delete，避免 noDelete 规则告警；判断用的是 === true）
  (globalThis as { __PUPU_DEBUG__?: boolean }).__PUPU_DEBUG__ = undefined;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("生产环境（NODE_ENV=production）", () => {
  it("debug / info 静默", async () => {
    const logger = await loadLogger("production");
    logger.debug("调试信息");
    logger.info("普通信息");
    expect(spies.log).not.toHaveBeenCalled();
    expect(spies.info).not.toHaveBeenCalled();
  });

  it("warn / error 照常输出", async () => {
    const logger = await loadLogger("production");
    logger.warn("警告");
    logger.error("错误");
    expect(spies.warn).toHaveBeenCalledWith("警告");
    expect(spies.error).toHaveBeenCalledWith("错误");
  });

  it("可用 window.__PUPU_DEBUG__ = true 临时打开全部级别", async () => {
    const logger = await loadLogger("production");
    logger.debug("应当被静默");
    expect(spies.log).not.toHaveBeenCalled();

    (globalThis as { __PUPU_DEBUG__?: boolean }).__PUPU_DEBUG__ = true;
    logger.debug("临时排查时可见");
    logger.info("同上");
    expect(spies.log).toHaveBeenCalledWith("临时排查时可见");
    expect(spies.info).toHaveBeenCalledWith("同上");
  });
});

describe("开发环境（NODE_ENV=development）", () => {
  it("debug 用 console.log 输出，保持与改造前一致的可见性", async () => {
    const logger = await loadLogger("development");
    logger.debug("流程追踪");
    expect(spies.log).toHaveBeenCalledWith("流程追踪");
  });

  it("info / warn / error 均输出", async () => {
    const logger = await loadLogger("development");
    logger.info("信息");
    logger.warn("警告");
    logger.error("错误");
    expect(spies.info).toHaveBeenCalledWith("信息");
    expect(spies.warn).toHaveBeenCalledWith("警告");
    expect(spies.error).toHaveBeenCalledWith("错误");
  });

  it("透传多个参数（与 console 用法兼容）", async () => {
    const logger = await loadLogger("development");
    logger.debug("已填写标题", 42, { ok: true });
    expect(spies.log).toHaveBeenCalledWith("已填写标题", 42, { ok: true });
  });
});

describe("logger 模块的产物体积前提", () => {
  it("不得引入任何依赖（平台适配器会大量引用它，带上重库会撑大分包）", () => {
    const source = readFileSync("src/utils/logger.ts", "utf8");
    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source).not.toMatch(/require\(/);
  });
});
