// 语言包一致性检查。
//
// 目的：杜绝「界面直接显示原始 key」这类问题 —— 它不会报错、测试无法覆盖 UI，很容易漏到线上。
// 检查两件事：
//   1) 每个语言包都必须覆盖 zh_CN 的全部 key（en 曾漏 3 个 key，就是这里漏掉的）；
//   2) src 中传给 getMessage 的字面量 key 必须真实存在。
//
// 对第 2 点，这里解析的是括号配平后的整个实参，因此像
// `getMessage(isDark ? "themeSwitchToLight" : "themeSwitchToDark")` 这种间接写法也能覆盖。
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const LOCALES_DIR = "locales";
const SRC_DIR = "src";
const DEFAULT_LOCALE = "zh_CN";

type Messages = Record<string, { message: string }>;

const readMessages = (locale: string): Messages =>
  JSON.parse(readFileSync(join(LOCALES_DIR, locale, "messages.json"), "utf8")) as Messages;

const listLocales = (): string[] =>
  readdirSync(LOCALES_DIR).filter((name) => statSync(join(LOCALES_DIR, name)).isDirectory());

const collectSourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(full);
    if (!/\.tsx?$/.test(entry.name)) return [];
    if (/\.(test|spec)\.tsx?$/.test(entry.name)) return [];
    return [full];
  });

/** 去掉注释，避免把注释里出现过的 key 当作真实调用（例如 `// alert(getMessage("x"))`）。 */
const stripComments = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

/** 取出所有 `getMessage(...)` 的实参文本（括号配平，跳过字符串内的括号）。 */
const findGetMessageArgs = (code: string): string[] => {
  const args: string[] = [];
  const marker = "getMessage(";
  let index = code.indexOf(marker);

  while (index !== -1) {
    let cursor = index + marker.length;
    let depth = 1;
    let quote: string | null = null;
    const start = cursor;

    while (cursor < code.length && depth > 0) {
      const char = code[cursor];
      if (quote) {
        if (char === "\\") {
          cursor += 2;
          continue;
        }
        if (char === quote) quote = null;
      } else if (char === '"' || char === "'" || char === "`") {
        quote = char;
      } else if (char === "(") {
        depth++;
      } else if (char === ")") {
        depth--;
      }
      cursor++;
    }

    args.push(code.slice(start, cursor - 1));
    index = code.indexOf(marker, cursor);
  }

  return args;
};

// 本项目的语言包 key 统一是 lowerCamelCase。用这个形状过滤，可排除实参里混入的
// 其它字面量（例如 `getMessage(type === "DYNAMIC" ? "optionsDynamicTab" : ...)` 中的类型枚举）。
const KEY_SHAPE = /^[a-z][A-Za-z0-9]*$/;

/** 从实参文本里取出单/双引号字面量（模板字符串里的动态拼接不在此列）。 */
const extractLiteralKeys = (args: string): string[] => {
  const keys = new Set<string>();
  for (const match of args.matchAll(/"([^"\\]+)"|'([^'\\]+)'/g)) {
    const value = match[1] ?? match[2];
    if (value && KEY_SHAPE.test(value)) keys.add(value);
  }
  return [...keys];
};

/** 收集 src 下真正调用 getMessage 时用到的字面量 key。 */
const collectUsedKeys = (): Map<string, string[]> => {
  const used = new Map<string, string[]>();

  for (const file of collectSourceFiles(SRC_DIR)) {
    const code = stripComments(readFileSync(file, "utf8"));
    for (const args of findGetMessageArgs(code)) {
      for (const key of extractLiteralKeys(args)) {
        used.set(key, [...(used.get(key) ?? []), file]);
      }
    }
  }

  return used;
};

describe("语言包", () => {
  const zhCN = readMessages(DEFAULT_LOCALE);

  it("每个语言包都覆盖 zh_CN 的全部 key", () => {
    for (const locale of listLocales()) {
      const messages = readMessages(locale);
      const missing = Object.keys(zhCN).filter((key) => !(key in messages));
      expect(missing, `${locale} 缺少 ${missing.length} 个 key`).toEqual([]);
    }
  });

  it("每个语言包的 message 都非空", () => {
    for (const locale of listLocales()) {
      const messages = readMessages(locale);
      const empty = Object.entries(messages)
        .filter(([, value]) => !value?.message?.trim())
        .map(([key]) => key);
      expect(empty, `${locale} 存在空 message`).toEqual([]);
    }
  });

  it("src 中 getMessage 用到的字面量 key 都存在于 zh_CN", () => {
    const report = [...collectUsedKeys()]
      .filter(([key]) => !(key in zhCN))
      .map(([key, files]) => `${key} <- ${[...new Set(files)].join(", ")}`);
    expect(report, `发现 ${report.length} 个未定义的 key`).toEqual([]);
  });

  it("收集到的 key 数量合理（防止扫描逻辑失效后静默通过）", () => {
    // 当前代码里约有 270+ 处调用；若扫描逻辑被改坏导致取不到 key，这里会失败而不是静默通过
    expect(collectUsedKeys().size).toBeGreaterThan(200);
  });
});
