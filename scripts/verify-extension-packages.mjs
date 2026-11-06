import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { name, version } = JSON.parse(readFileSync("package.json", "utf8"));
const expectedVersion = process.argv[2] || version;
assert.ok(name && version, "package.json 缺少 name 或 version");
assert.equal(version, expectedVersion, "预期版本与 package.json 不一致");

for (const browser of ["chrome", "firefox"]) {
  const zip = join("build", `${name}${browser === "firefox" ? "-firefox" : ""}-v${version}.zip`);
  const entries = new Set(execFileSync("unzip", ["-Z1", zip], { encoding: "utf8" }).split("\n").filter(Boolean));
  const manifest = JSON.parse(execFileSync("unzip", ["-p", zip, "manifest.json"], { encoding: "utf8" }));
  const requireFile = (file) => assert.ok(entries.has(file.replace(/^\.\//, "")), `${zip} 缺少 ${file}`);

  assert.equal(manifest.manifest_version, 3, `${zip} 不是 MV3`);
  assert.equal(manifest.version, expectedVersion, `${zip} 的 manifest 版本不正确`);
  for (const file of [
    "pdf.worker.min.mjs",
    "wasm/jbig2.wasm",
    "wasm/openjpeg.wasm",
    "assets/platforms/51cto.ico",
    "_locales/zh_CN/messages.json",
    "_locales/en/messages.json",
    manifest.action?.default_popup,
    manifest.options_ui?.page,
  ]) {
    assert.ok(typeof file === "string" && file.length > 0, `${zip} 缺少扩展页面配置`);
    requireFile(file);
  }
  for (const script of manifest.content_scripts || []) {
    for (const file of [...(script.js || []), ...(script.css || [])]) requireFile(file);
  }
  const workerPath =
    browser === "firefox"
      ? "pdfjs-dist/legacy/build/pdf.worker.min.mjs"
      : "pdfjs-dist/build/pdf.worker.min.mjs";
  const worker = execFileSync("unzip", ["-p", zip, "pdf.worker.min.mjs"], { maxBuffer: 10 * 1024 * 1024 });
  assert.ok(worker.equals(readFileSync(require.resolve(workerPath))), `${zip} 的 PDF worker 与浏览器目标不匹配`);

  if (browser === "chrome") {
    assert.ok(manifest.background?.service_worker, `${zip} 缺少 Chromium service worker`);
    assert.ok(!manifest.background.scripts, `${zip} 不应包含 Firefox 后台脚本`);
    assert.ok(manifest.permissions.includes("sidePanel"), `${zip} 缺少 sidePanel 权限`);
    assert.ok(manifest.permissions.includes("tabGroups"), `${zip} 缺少 tabGroups 权限`);
    requireFile(manifest.background.service_worker);
    requireFile(manifest.side_panel?.default_path || "");
  } else {
    assert.ok(Array.isArray(manifest.background?.scripts) && manifest.background.scripts.length > 0, `${zip} 缺少 Firefox 后台脚本`);
    assert.ok(!manifest.background.service_worker, `${zip} 不应使用 service worker`);
    for (const file of manifest.background.scripts) requireFile(file);
    assert.equal(manifest.browser_specific_settings?.gecko?.id, "pupu@luskyle.github.io", `${zip} 的 Firefox 扩展 ID 不正确`);
    assert.equal(manifest.browser_specific_settings.gecko.strict_min_version, "140.0");
    assert.deepEqual(manifest.browser_specific_settings.gecko.data_collection_permissions.required, [
      "personalCommunications",
      "websiteContent",
    ]);
    assert.ok(
      manifest.content_security_policy?.extension_pages?.includes("'wasm-unsafe-eval'"),
      `${zip} 缺少 PDF WASM 所需的内容安全策略`,
    );
    assert.ok(!manifest.side_panel, `${zip} 不应包含 Chromium 侧边栏配置`);
    requireFile("firefox-adapters.js");
    for (const permission of ["sidePanel", "tabGroups", "background"]) {
      assert.ok(!manifest.permissions.includes(permission), `${zip} 不应包含 ${permission} 权限`);
    }
    requireFile(manifest.sidebar_action?.default_panel || "");
  }

  console.log(`✅ ${zip}：版本、浏览器清单与资源校验通过`);
}
