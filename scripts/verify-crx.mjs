// 独立校验 CRX3 产物：按 CRX3 规范解析头部、验证 RSA-SHA256 签名、核对扩展 ID 与包内
// manifest 版本。CI 与本地都没有浏览器可用来试装，因此这是确认 .crx 真正有效的关键一步
// （只看文件存不存在是不够的）。
//
// 用法: node scripts/verify-crx.mjs [crx 路径]
import { execFileSync } from "node:child_process";
import { createHash, createPublicKey, createVerify, verify } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const crxPath = process.argv[2] ?? `build/${pkg.name}-v${pkg.version}.crx`;
const KEY_PATH = "keys/pupu.pem";

const problems = [];
const check = (ok, message) => {
  console.log(`${ok ? "✅" : "❌"} ${message}`);
  if (!ok) problems.push(message);
};

const crx = readFileSync(crxPath);

// CRX3 文件布局: "Cr24" | uint32LE 版本 | uint32LE 头部长度 | 头部(protobuf) | zip 载荷
check(crx.subarray(0, 4).toString("latin1") === "Cr24", "魔数为 Cr24");
check(crx.readUInt32LE(4) === 3, `格式版本为 3（实际 ${crx.readUInt32LE(4)}）`);

const headerLength = crx.readUInt32LE(8);
const header = crx.subarray(12, 12 + headerLength);
const archive = crx.subarray(12 + headerLength);
check(headerLength > 0 && header.length === headerLength, `头部长度 ${headerLength} 字节`);
check(archive.subarray(0, 2).toString("latin1") === "PK", "载荷以 zip 签名 PK 开头");

const readVarint = (buffer, offset) => {
  let result = 0;
  let shift = 0;
  let byte;
  do {
    byte = buffer[offset++];
    if (offset > buffer.length) throw new Error("varint 越界");
    result += (byte & 0x7f) * 2 ** shift;
    shift += 7;
  } while (byte & 0x80);
  return [result, offset];
};

const readFields = (buffer) => {
  const fields = [];
  let offset = 0;
  while (offset < buffer.length) {
    const [key, afterKey] = readVarint(buffer, offset);
    const wireType = key % 8;
    offset = afterKey;
    if (wireType === 2) {
      const [length, afterLength] = readVarint(buffer, offset);
      fields.push([Math.floor(key / 8), buffer.subarray(afterLength, afterLength + length)]);
      offset = afterLength + length;
    } else if (wireType === 0) {
      [, offset] = readVarint(buffer, offset);
    } else {
      throw new Error(`不支持的 protobuf wire type: ${wireType}`);
    }
  }
  return fields;
};

const headerFields = readFields(header);
const signedHeaderData = headerFields.find(([field]) => field === 10000)?.[1];
const rsaProofRaw = headerFields.find(([field]) => field === 2)?.[1];
check(Boolean(signedHeaderData), "头部含 signed_header_data（字段 10000）");
check(Boolean(rsaProofRaw), "头部含 sha256_with_rsa 签名（字段 2）");

const rsaProofFields = readFields(rsaProofRaw ?? Buffer.alloc(0));
const publicKeyDer = rsaProofFields.find(([field]) => field === 1)?.[1];
const signature = rsaProofFields.find(([field]) => field === 2)?.[1];
check(Boolean(publicKeyDer), "签名块含公钥（SPKI DER）");
check(Boolean(signature), "签名块含 signature");

if (!publicKeyDer || !signature || !signedHeaderData) {
  console.error(`\n❌ CRX3 头部结构不完整，无法继续校验（共 ${problems.length} 项问题）`);
  process.exit(1);
}

const toExtensionId = (der) =>
  [...createHash("sha256").update(der).digest().subarray(0, 16)]
    .flatMap((byte) => [byte >> 4, byte & 0x0f])
    .map((nibble) => String.fromCharCode(97 + nibble))
    .join("");

const extensionId = toExtensionId(publicKeyDer);
console.log(`   扩展 ID: ${extensionId}`);

// signed_header_data 里记录的 crx_id 必须等于由公钥算出的扩展 ID
const crxId = readFields(signedHeaderData ?? Buffer.alloc(0)).find(([field]) => field === 1)?.[1];
check(crxId?.toString("hex") === createHash("sha256").update(publicKeyDer).digest().subarray(0, 16).toString("hex"), "signed_header_data 中的 crx_id 与公钥一致");

// 签名输入: "CRX3 SignedData\0" | uint32LE 长度 | signed_header_data | 整个 zip 载荷
const sizeOctets = Buffer.allocUnsafe(4);
sizeOctets.writeUInt32LE(signedHeaderData.length, 0);
const signedPayload = Buffer.concat([
  Buffer.from("CRX3 SignedData\u0000", "latin1"),
  sizeOctets,
  signedHeaderData,
  archive,
]);

let signatureValid = false;
try {
  const verifier = createVerify("sha256");
  verifier.update(signedPayload);
  verifier.end();
  signatureValid = verifier.verify({ key: publicKeyDer, format: "der", type: "spki" }, signature);
} catch (error) {
  console.log(`   验签异常: ${error.message}`);
}
check(signatureValid, "RSA-SHA256 签名验证通过（签名覆盖整个 zip 载荷）");

// 若本地存在签名密钥，确认 CRX 正是用它签的（扩展 ID 不会漂移）
if (existsSync(KEY_PATH)) {
  const expectedId = toExtensionId(
    createPublicKey(readFileSync(KEY_PATH)).export({ type: "spki", format: "der" }),
  );
  check(expectedId === extensionId, `与当前签名密钥匹配（期望 ID ${expectedId}）`);
} else {
  console.log("ℹ️ 本地无签名密钥，跳过密钥一致性核对");
}

// 载荷是带 12 字节头前缀的 zip，先剥掉头部再交给 unzip，避免依赖 unzip 对前缀的容错
const tempDir = mkdtempSync(join(tmpdir(), "verify-crx-"));
try {
  const zipPath = join(tempDir, "payload.zip");
  writeFileSync(zipPath, archive);
  const manifest = JSON.parse(execFileSync("unzip", ["-p", zipPath, "manifest.json"], { encoding: "utf8" }));
  check(manifest.manifest_version === 3, `包内 manifest_version 为 3（实际 ${manifest.manifest_version}）`);
  check(manifest.version === pkg.version, `包内 manifest 版本与 package.json 一致（${manifest.version} / ${pkg.version}）`);
  const files = execFileSync("unzip", ["-l", zipPath], { encoding: "utf8" });
  for (const required of ["pdf.worker.min.mjs", "wasm/jbig2.wasm", "assets/platforms/51cto.ico"]) {
    check(files.includes(required), `包内含 ${required}`);
  }
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

if (problems.length > 0) {
  console.error(`\n❌ 校验未通过，共 ${problems.length} 项问题`);
  process.exit(1);
}
console.log("\n✅ CRX3 校验全部通过");