/**
 * 分级日志工具。
 *
 * 刻意不引入任何依赖：平台适配器会大量引用它，若带上重库会把分包撑大（见 OPTIMIZATION.md P2-1）。
 *
 * 行为：
 * - `debug` / `info`：仅开发环境输出。生产环境静默 —— 这些是平台页面里的流程追踪，
 *   量大（改造前全仓 1153 处 console.log）、且可能带上页面内容等敏感数据。
 * - `warn` / `error`：始终输出。
 * - 需要在生产环境现场排查时，在扩展页面的控制台执行 `window.__PUPU_DEBUG__ = true`
 *   即可临时打开全部级别，无需重新打包。
 * - 开发环境用 `console.log` 输出 `debug`，保持与改造前一致的可见性
 *   （`console.debug` 在 DevTools 里默认被收进 Verbose 过滤，会让原来的调试输出"看不见")。
 */

const isDevelopment = process.env.NODE_ENV === "development";

const isVerboseEnabled = (): boolean =>
  isDevelopment || (globalThis as { __PUPU_DEBUG__?: boolean }).__PUPU_DEBUG__ === true;

export const logger = {
  debug: (...args: unknown[]): void => {
    if (!isVerboseEnabled()) {
      return;
    }
    console.log(...args);
  },

  info: (...args: unknown[]): void => {
    if (!isVerboseEnabled()) {
      return;
    }
    console.info(...args);
  },

  warn: (...args: unknown[]): void => {
    console.warn(...args);
  },

  error: (...args: unknown[]): void => {
    console.error(...args);
  },
};
