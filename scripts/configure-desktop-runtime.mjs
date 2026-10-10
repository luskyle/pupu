import { access, mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const executable = path.resolve(process.argv[2] || ".local/ollama/bin/ollama");
const models = path.resolve(process.argv[3] || ".local/models");
await access(executable);
await mkdir(models, { recursive: true });
const configRoot = process.platform === "win32"
  ? path.join(process.env.APPDATA || path.join(homedir(), "AppData/Roaming"), "pupu-desktop")
  : process.platform === "darwin"
    ? path.join(homedir(), "Library/Application Support/pupu-desktop")
    : path.join(process.env.XDG_CONFIG_HOME || path.join(homedir(), ".config"), "pupu-desktop");
await mkdir(configRoot, { recursive: true });
const config = path.join(configRoot, "runtime.json");
await writeFile(config, JSON.stringify({ executable, models }, null, 2), { mode: 0o600 });
console.log(`Desktop runtime configured: ${config}`);
