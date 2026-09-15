// 把 Plasmo package 产出的压缩包重命名为「项目名-v版本号.zip」（如 pupu-v0.2.0.zip）。
// 读取 package.json 的 name/version，将 build/chrome-mv3-prod.zip 重命名，并清掉旧的同名产物。
import { readFileSync, renameSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const name = pkg.name || "pupu";
const version = pkg.version || "0.0.0";
const targetName = `${name}-v${version}.zip`;
const buildDir = "build";

// Plasmo package 可能的默认产物名
const candidates = [
  join(buildDir, "chrome-mv3-prod.zip"),
  join(buildDir, "chrome-mv3.zip"),
  join(buildDir, `${name}.zip`),
];
let src = candidates.find((c) => existsSync(c));

// fallback：扫描 build 下未被命名为 项目名-v版本号 的 zip
if (!src && existsSync(buildDir)) {
  const zips = readdirSync(buildDir).filter(
    (f) => f.endsWith(".zip") && f !== targetName && !/^[\w-]+-v\d+\.\d+\.\d+\.zip$/.test(f),
  );
  if (zips.length > 0) src = join(buildDir, zips[0]);
}

if (!src) {
  console.warn("⚠️ 未找到 Plasmo package 产物 zip，请先执行 plasmo package");
  process.exit(0);
}

const dest = join(buildDir, targetName);
// 清掉旧的同名 zip，避免 renameSync 覆盖失败（Windows 上目标存在会报错）
if (existsSync(dest)) {
  unlinkSync(dest);
}
renameSync(src, dest);
console.log(`✅ 压缩包已重命名为: ${dest}`);
