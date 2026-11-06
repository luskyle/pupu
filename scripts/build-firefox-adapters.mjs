import { build } from "esbuild";

await build({
  entryPoints: ["src/sync/firefox-adapters.ts"],
  outfile: "build/firefox-mv3-prod/firefox-adapters.js",
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "firefox140",
  minify: true,
  tsconfig: "tsconfig.json",
  // 仅在 Firefox 适配器包内拦截本地媒体读取，其他请求仍使用原生 fetch。
  inject: ["src/sync/firefox-fetch.ts"],
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.PUPU_DESKTOP": '"false"',
  },
});
console.log("✅ Firefox 平台适配器已打包: build/firefox-mv3-prod/firefox-adapters.js");
