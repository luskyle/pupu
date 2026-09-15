// 把 Plasmo 生产产物打包成 CRX3，供 Chrome / Edge 直接拖入扩展管理页安装。
//
// 扩展 ID 由签名密钥决定，必须长期稳定，因此密钥只从下面两处读取，绝不自动生成：
//   - CRX_PRIVATE_KEY 环境变量（CI 中来自仓库 Secret）
//   - keys/pupu.pem（本地开发；已被 .gitignore 忽略）
// 找不到密钥时跳过打包（本地开发通常没有密钥），设置 CRX_REQUIRED=1 则视为失败。
import { createHash, createPrivateKey, createPublicKey } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const writeCRX3File = require("crx3");
const createConfiguration = require("crx3/lib/configuration");

const KEY_PATH = "keys/pupu.pem";
const SRC_DIR = "build/chrome-mv3-prod";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const crxPath = `build/${pkg.name}-v${pkg.version}.crx`;

const skip = (message) => {
  if (process.env.CRX_REQUIRED === "1") {
    console.error(message);
    process.exit(1);
  }
  console.warn(message);
  process.exit(0);
};

if (!existsSync(SRC_DIR)) {
  skip(`⚠️ 未找到构建产物 ${SRC_DIR}，跳过 CRX 打包`);
}

const envKey = process.env.CRX_PRIVATE_KEY?.trim();
if (envKey) {
  mkdirSync("keys", { recursive: true });
  writeFileSync(KEY_PATH, `${envKey}\n`, { mode: 0o600 });
} else if (!existsSync(KEY_PATH)) {
  skip(`⚠️ 未找到 CRX 签名密钥（${KEY_PATH} 或 CRX_PRIVATE_KEY），跳过 CRX 打包`);
}

let publicKeyDer;
try {
  publicKeyDer = createPublicKey(createPrivateKey(readFileSync(KEY_PATH))).export({ type: "spki", format: "der" });
} catch (error) {
  // 密钥存在但不可用时必须中断：crx3 会另生成一对密钥，扩展 ID 随之改变
  console.error(` 无法加载签名密钥 ${KEY_PATH}：${error.message}`);
  process.exit(1);
}

const extensionId = [...createHash("sha256").update(publicKeyDer).digest().subarray(0, 16)]
  .flatMap((byte) => [byte >> 4, byte & 0x0f])
  .map((nibble) => String.fromCharCode(97 + nibble))
  .join("");

const config = createConfiguration({
  srcPaths: [SRC_DIR],
  crxPath,
  keyPath: KEY_PATH,
  zipPath: "",
});

const info = await writeCRX3File(config.srcPaths, config);

if (info?.appId && info.appId !== extensionId) {
  console.error(`❌ 扩展 ID 不一致：脚本算出 ${extensionId}，crx3 给出 ${info.appId}`);
  process.exit(1);
}

console.log(`✅ CRX 已生成: ${crxPath}`);
console.log(`   扩展 ID: ${extensionId}`);
console.log(`   可直接拖入 chrome://extensions 或 edge://extensions 安装（需开启开发者模式）`);