// 平台图标资源一致性检查。
//
// 目的：图标是通过字符串路径引用的（如 `assets/platforms/xxx.ico`），写错扩展名或漏拷文件
// 只会表现为界面上的破图，既不会报错也不容易在回归时发现。这里把「引用 ↔ 文件」双向对齐。
//
// 注：这里的文件遍历工具与 locales.test.ts 各自保留一份（各约 8 行），
// 避免为了两个测试文件往 src/ 里塞一个仅供测试使用的共享模块。
import { readdirSync, statSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ASSETS_DIR = "assets/platforms";
const SRC_DIR = "src";

const collectSourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(full);
    if (!/\.tsx?$/.test(entry.name)) return [];
    if (/\.(test|spec)\.tsx?$/.test(entry.name)) return [];
    return [full];
  });

/** src 中通过 `platforms/<文件名>` 引用的图标文件名。 */
const referencedIcons = (): string[] => {
  const names = new Set<string>();
  for (const file of collectSourceFiles(SRC_DIR)) {
    const code = readFileSync(file, "utf8");
    for (const match of code.matchAll(/platforms\/([A-Za-z0-9_.-]+\.(?:png|ico|svg))/g)) {
      names.add(match[1]);
    }
  }
  return [...names].sort();
};

/** assets/platforms 下实际存在的图标文件名。 */
const existingIcons = (): string[] =>
  readdirSync(ASSETS_DIR)
    .filter((name) => statSync(join(ASSETS_DIR, name)).isFile())
    .sort();

describe("平台图标资源", () => {
  it("src 中引用的每个图标文件都真实存在", () => {
    const existing = new Set(existingIcons());
    const missing = referencedIcons().filter((name) => !existing.has(name));
    expect(missing, `以下图标被引用但文件不存在: ${missing.join(", ")}`).toEqual([]);
  });

  it("assets 下没有无人引用的图标（避免打包进用不到的资源）", () => {
    const referenced = new Set(referencedIcons());
    const unused = existingIcons().filter((name) => !referenced.has(name));
    expect(unused, `以下图标没有任何引用: ${unused.join(", ")}`).toEqual([]);
  });

  it("扫描到的引用数量合理（防止扫描逻辑失效后静默通过）", () => {
    // 当前约 122 处引用（含同一图标被多处引用）与 76 个图标文件
    expect(referencedIcons().length).toBeGreaterThan(60);
    expect(existingIcons().length).toBeGreaterThan(60);
  });
});
