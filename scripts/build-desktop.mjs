import { build } from "esbuild";
import { copyFile, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { createDesktopPptxFixture } from "./desktop-test-fixtures.mjs";
import path from "node:path";

const output = path.resolve("build/desktop");
await mkdir(output, { recursive: true });
await build({
  entryPoints: ["desktop/main.ts"],
  outfile: path.join(output, "main.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["electron"],
  alias: { "~": path.resolve("src") },
});
for (const file of ["index.html", "renderer.js", "style.css", "preload.cjs", "fixture.html", "workspace.html", "workspace-preload.cjs", "workspace-fixture.html"]) {
  await copyFile(path.join("desktop", file), path.join(output, file));
}
await copyFile("assets/icon.png", path.join(output, "icon.png"));
const { version } = JSON.parse(await readFile("package.json", "utf8"));
await writeFile(path.join(output, "package.json"), JSON.stringify({
  name: "pupu-desktop", productName: "pupu", version, main: "main.cjs",
}));
const browser = {
  bundle: true, platform: "browser", target: "chrome144", tsconfig: "tsconfig.json",
  define: { "process.env.NODE_ENV": '"production"', "process.env.PUPU_DESKTOP": '"true"' },
};
await build({
  ...browser, entryPoints: ["desktop/workspace-bootstrap.js", "desktop/workspace-test-tools.ts"],
  outdir: output, format: "esm", splitting: true,
  plugins: [{
    name: "desktop-style",
    setup(builder) {
      builder.onResolve({ filter: /^data-text:/ }, () => ({ path: "desktop-style", namespace: "desktop-style" }));
      builder.onLoad({ filter: /.*/, namespace: "desktop-style" }, () => ({ contents: 'export default "";', loader: "js" }));
      builder.onLoad({ filter: /src\/style\.css$/ }, () => ({ contents: "", loader: "css" }));
    },
  }],
});
const adapterBanner = `globalThis.chrome = { runtime: { getURL: p => p }, i18n: { getMessage: p => p } };`;
await build({
  ...browser, entryPoints: ["desktop/workspace-adapters.ts"],
  outfile: path.join(output, "workspace-adapters.js"), format: "iife",
  globalName: "pupuWorkspaceAdapters", banner: { js: adapterBanner },
});
const context = vm.createContext({ console, setTimeout, clearTimeout, URL, TextEncoder, AbortController });
vm.runInContext(await readFile(path.join(output, "workspace-adapters.js"), "utf8"), context);
const metadata = Object.fromEntries(Object.entries(context.pupuWorkspaceAdapters.platforms).map(([name, info]) =>
  [name, { name, accountKey: info.accountKey, platformName: info.platformName, homeUrl: info.homeUrl, injectUrl: info.injectUrl }]));
await writeFile(path.join(output, "workspace-platforms.json"), JSON.stringify(metadata));
for (const [entry, file] of [["src/contents/helper.ts", "workspace-helper.js"], ["src/contents/xhs-shadow-capture.ts", "workspace-xhs.js"]]) {
  await build({ ...browser, entryPoints: [entry], outfile: path.join(output, file), format: "iife" });
}
const css = await postcss([tailwindcss(path.resolve("tailwind.config.js"))]).process(
  (await readFile("src/style.css", "utf8")).replace(/^@import url\([^\n]+\);\s*/m, ""),
  { from: "src/style.css" },
);
const layout = `
.desktop-tabbar { height:75px; position:sticky; top:0; display:flex; align-items:center; gap:8px; overflow-x:auto; background:#151b2c; color:white; z-index:999; padding:12px; }
.desktop-tabbar button { flex-shrink:0; border:1px solid #576179; padding:8px; border-radius:6px; max-width:220px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.desktop-tabbar button[aria-current="page"] { background:#4f46e5; border-color:#a5b4fc; }
.desktop-workspace { display:flex; align-items:flex-start; }
.desktop-editor { flex:1; min-width:0; }
.desktop-panel { width:360px; flex-shrink:0; border-left:1px solid #64748b; min-height:calc(100vh - 110px); }
.desktop-notice { background:#e0e7ff; color:#1e293b; padding:10px 16px; font-size:13px; }
.desktop-notice button { margin-left:12px; text-decoration:underline; }
`;
const playerCSS = await readFile(path.join(output, "workspace-bootstrap.css"), "utf8");
await writeFile(path.join(output, "workspace.css"), `${css.css}\n${playerCSS}\n${layout}`);
const require = createRequire(import.meta.url);
await copyFile(require.resolve("pdfjs-dist/build/pdf.worker.min.mjs"), path.join(output, "pdf.worker.min.mjs"));
await cp(path.join(path.dirname(require.resolve("pdfjs-dist/package.json")), "wasm"), path.join(output, "wasm"), { recursive: true });
await cp("assets", path.join(output, "assets"), { recursive: true });
await copyFile("locales/zh_CN/messages.json", path.join(output, "messages.json"));
await writeFile(path.join(output, "workspace-test.pptx"), await createDesktopPptxFixture());
console.log(`Desktop built: ${output}`);
