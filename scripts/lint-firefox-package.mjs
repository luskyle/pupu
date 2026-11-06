import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const { name, version } = JSON.parse(readFileSync("package.json", "utf8"));
if (!name || !version) throw new Error("package.json 缺少 name 或 version");

const archive = join("build", `${name}-firefox-v${version}.zip`);
const webExt = join(dirname(require.resolve("web-ext")), "bin", "web-ext.js");
const result = spawnSync(process.execPath, [webExt, "lint", "--source-dir", archive], { stdio: "inherit" });
if (result.error) throw result.error;
if (result.status === null) throw new Error(`Mozilla 校验被中断: ${result.signal}`);
process.exitCode = result.status;
