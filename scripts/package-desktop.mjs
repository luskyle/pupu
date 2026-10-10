import { packager } from "@electron/packager";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const electronVersion = require("electron/package.json").version;
const cache = path.join(homedir(), ".cache", "electron");
const zip = `electron-v${electronVersion}-${process.platform}-${process.arch}.zip`;
let zipDirectory;
if (existsSync(cache)) {
  for (const entry of await readdir(cache, { withFileTypes: true })) {
    if (entry.isDirectory() && existsSync(path.join(cache, entry.name, zip))) {
      zipDirectory = path.join(cache, entry.name);
      break;
    }
  }
}
const outputs = await packager({
  dir: "build/desktop",
  out: "build/desktop-release",
  name: "pupu",
  executableName: "pupu",
  platform: process.platform,
  arch: process.arch,
  electronVersion,
  electronZipDir: zipDirectory,
  overwrite: true,
  asar: true,
  prune: false,
  ignore: /verification(?:-platform)?\.(?:json|png)$/,
});
console.log(outputs.join("\n"));
