// 检查本地构建产物 / 源码版本是否落后于最新发布版本，落后就醒目提示。
//
// 由来：本地构建不再自动改版本号（发版由标签驱动），所以本地产物会停在「上次构建时」的版本。
// 典型场景：你在旧 commit 上构建，或本地已经落后于最新发布的标签 —— 这两种情况都会让浏览器里
// 加载的扩展「关于」页显示旧版本号，这里把它显式指出来。
//
// 用法：
//   node scripts/check-local-version.mjs      # 也可用 pnpm check:version
// 已接入 `pnpm build`（构建结束时自动跑）。**始终以 0 退出** —— 它只是提醒，不应让构建失败。
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const BUILT_MANIFEST = join("build", "chrome-mv3-prod", "manifest.json");

const parse = (version) =>
  String(version)
    .replace(/^v/, "")
    .split(/[.+-]/)
    .slice(0, 4)
    .map((part) => Number.parseInt(part, 10) || 0);

/** a 是否比 b 新（按 1～4 段数字逐段比较）。 */
const isNewer = (a, b) => {
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < 4; i += 1) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  }
  return false;
};

const latestTagVersion = (() => {
  try {
    const tags = execFileSync("git", ["tag", "--list", "v*", "--sort=-v:refname"], { encoding: "utf8" });
    const tag = tags.split("\n").map((t) => t.trim()).filter(Boolean)[0];
    return tag ? tag.replace(/^v/, "") : null;
  } catch {
    return null;
  }
})();

const pkgVersion = JSON.parse(readFileSync("package.json", "utf8")).version;
const builtVersion = existsSync(BUILT_MANIFEST)
  ? JSON.parse(readFileSync(BUILT_MANIFEST, "utf8")).version
  : null;

console.log("版本检查：");
console.log(`  package.json           ${pkgVersion}`);
console.log(`  最新发布标签           ${latestTagVersion ?? "（无 v* 标签）"}`);
console.log(`  本地构建产物           ${builtVersion ?? "（尚未构建）"}`);

if (!latestTagVersion) {
  console.log("→ 仓库里还没有 v* 标签，跳过落后检查。");
  process.exit(0);
}

const problems = [];
if (builtVersion && isNewer(latestTagVersion, builtVersion)) {
  problems.push(
    `本地构建产物是 ${builtVersion}，落后于最新发布 ${latestTagVersion} —— 浏览器里加载它时「关于」页会显示旧版本号。\n` +
      "   重新构建即可：pnpm build",
  );
}
if (isNewer(latestTagVersion, pkgVersion)) {
  problems.push(
    `当前源码版本 ${pkgVersion} 落后于最新发布 ${latestTagVersion} —— 可能没拉取最新代码，或正处在旧 commit 上。\n` +
      "   建议：git pull（然后在旧版本上构建出来的产物同样会显示旧版本号）",
  );
}

if (problems.length === 0) {
  console.log(`→ 一致：本地产物与源码均不落后于 ${latestTagVersion}`);
  process.exit(0);
}

console.log("");
for (const problem of problems) {
  console.log(`⚠️  ${problem}`);
}
console.log("");
console.log("提醒：本地产物不会自动跟随新发布，改过版本号或拉取新代码后需要重新构建一次。");
process.exit(0);