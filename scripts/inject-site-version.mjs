// 把站点的版本号占位符 {{VERSION}} 替换为「最新已发布版本」，供 GitHub Pages 部署使用。
//
// 为什么需要它：站点上的版本号此前是写死在 HTML 里的静态兜底值，容易长期过期
// （页面会优先用 GitHub API 取最新 release，但接口失败/限流时就会显示那个过期值）。
//
// 版本取值：优先用最新的 v* 标签（= 最新已发布版本），拿不到标签时退回 package.json。
// 用法：node scripts/inject-site-version.mjs <源目录> <输出目录>
//
// 刻意输出到独立目录而不是就地改写：否则本地跑一次就会把占位符换成固定版本并提交进去，
// 反而失去了自动同步的能力。
import { execFileSync } from "node:child_process";
import { cpSync, readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const TOKEN = "{{VERSION}}";

const [srcArg, outArg] = process.argv.slice(2);
if (!srcArg || !outArg) {
  console.error("用法: node scripts/inject-site-version.mjs <源目录> <输出目录>");
  process.exit(1);
}

const srcDir = resolve(srcArg);
const outDir = resolve(outArg);

if (srcDir === outDir) {
  console.error("❌ 输出目录不能与源目录相同：该脚本刻意不改写已提交的文件");
  process.exit(1);
}

/** 最新已发布版本：优先最新 v* 标签，退回 package.json。 */
const resolveVersion = () => {
  try {
    const tags = execFileSync("git", ["tag", "--list", "v*", "--sort=-v:refname"], { encoding: "utf8" });
    const latest = tags.split("\n").map((t) => t.trim()).filter(Boolean)[0];
    if (latest) {
      return { version: latest.replace(/^v/, ""), source: `git tag ${latest}` };
    }
  } catch {
    // 没有 git 或没有标签时继续走下面的回退
  }
  const { version } = JSON.parse(readFileSync("package.json", "utf8"));
  return { version, source: "package.json" };
};

const { version, source } = resolveVersion();

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(srcDir, outDir, { recursive: true });

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });

let replacedFiles = 0;
let replacedTokens = 0;
for (const file of walk(outDir)) {
  if (!file.endsWith(".html")) continue;
  const content = readFileSync(file, "utf8");
  if (!content.includes(TOKEN)) continue;
  const count = content.split(TOKEN).length - 1;
  writeFileSync(file, content.split(TOKEN).join(version));
  replacedFiles += 1;
  replacedTokens += count;
}

// 兜底校验：输出目录里不应再残留占位符（防止改错标签或漏改）
const leftover = walk(outDir).filter((f) => f.endsWith(".html") && readFileSync(f, "utf8").includes(TOKEN));
if (leftover.length > 0) {
  console.error(`❌ 仍有未替换的 ${TOKEN}: ${leftover.join(", ")}`);
  process.exit(1);
}

console.log(`✅ 站点版本号已注入: ${version}（来源: ${source}）`);
console.log(`   替换 ${replacedTokens} 处占位符，涉及 ${replacedFiles} 个文件 → ${outArg}`);