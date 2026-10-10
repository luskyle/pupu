import { build } from "esbuild";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
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
for (const file of ["index.html", "renderer.js", "style.css", "preload.cjs", "fixture.html"]) {
  await copyFile(path.join("desktop", file), path.join(output, file));
}
await copyFile("assets/icon.png", path.join(output, "icon.png"));
const { version } = JSON.parse(await readFile("package.json", "utf8"));
await writeFile(path.join(output, "package.json"), JSON.stringify({
  name: "pupu-desktop", productName: "pupu", version, main: "main.cjs",
}));
console.log(`Desktop built: ${output}`);
