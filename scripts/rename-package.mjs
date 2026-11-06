import { readFileSync, renameSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const { name, version } = pkg;
const browser = process.argv[2] || "chrome";
if (!name || !version) throw new Error("package.json 缺少 name 或 version");
if (browser !== "chrome" && browser !== "firefox") throw new Error(`不支持的浏览器构建目标: ${browser}`);

const targetName = `${name}${browser === "firefox" ? "-firefox" : ""}-v${version}.zip`;
const buildDir = "build";
const src = join(buildDir, `${browser}-mv3-prod.zip`);
if (!existsSync(src)) throw new Error(`未找到 Plasmo package 产物: ${src}`);

const dest = join(buildDir, targetName);
if (existsSync(dest)) {
  unlinkSync(dest);
}
renameSync(src, dest);
console.log(`✅ 压缩包已重命名为: ${dest}`);
