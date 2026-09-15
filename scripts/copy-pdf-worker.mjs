// 构建/开发后把 pdf.js worker 复制到 Plasmo 产物根目录，供 chrome.runtime.getURL 引用。
// pdf.js worker 不能打进主 bundle（esbuild 会把其 Node API 调用注入顶层，浏览器执行
// 抛错导致扩展加载失败），也不能用 new URL(..., import.meta.url)（CJS 下被解析成
// 无效 file://）。必须以独立文件形式存在并复制到产物。
//
// 同时复制 assets/platforms 下的离线平台图标到产物（Plasmo 只复制 manifest
// web_accessible_resources 中列出的资源，因此必须手动复制；扩展页内通过
// chrome.runtime.getURL 访问扩展自身资源无需 web_accessible 声明）。
import { copyFileSync, mkdirSync, existsSync, readdirSync, cpSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const workerPath = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
// pdf.js 的 JBIG2 / OpenJPEG 图像解码器（WASM）目录，黑白扫描书（stencil/CCITT）必须依赖它，
// 否则渲染空白页。需随产物一并复制，供 pdf.ts 的 wasmUrl 引用。
const wasmSrc = join(dirname(require.resolve("pdfjs-dist/package.json")), "wasm");
const targets = new Set();

// 生产构建产物
if (existsSync("build/chrome-mv3-prod")) {
  targets.add("build/chrome-mv3-prod");
}

// 开发模式产物（.plasmo 下可能有多 target 目录）
const scan = (dir) => {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith("chrome-mv3")) {
        targets.add(full);
      } else {
        scan(full);
      }
    }
  }
};
scan(".plasmo");

for (const target of targets) {
  mkdirSync(target, { recursive: true });
  copyFileSync(workerPath, join(target, "pdf.worker.min.mjs"));
  console.log(`✅ PDF worker 已复制到 ${target}/pdf.worker.min.mjs`);

  // 复制 pdf.js 图像解码器 WASM（JBIG2/OpenJPEG，黑白扫描书必需）
  if (existsSync(wasmSrc)) {
    const wasmDest = join(target, "wasm");
    mkdirSync(wasmDest, { recursive: true });
    cpSync(wasmSrc, wasmDest, { recursive: true, force: true });
    console.log(`✅ PDF wasm 已复制到 ${wasmDest}`);
  } else {
    console.warn("⚠️ 未找到 pdfjs-dist wasm 目录");
  }

  // 复制离线平台图标
  if (existsSync("assets/platforms")) {
    const iconDest = join(target, "assets/platforms");
    mkdirSync(iconDest, { recursive: true });
    cpSync("assets/platforms", iconDest, { recursive: true, force: true });
    console.log(`✅ 平台图标已复制到 ${iconDest}`);
  }
}

if (targets.size === 0) {
  console.warn("⚠️ 未找到 Plasmo 产物目录，请先执行 plasmo build/dev");
}
