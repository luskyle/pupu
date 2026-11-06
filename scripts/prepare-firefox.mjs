import { readFileSync, writeFileSync } from "node:fs";

const manifestPath = "build/firefox-mv3-prod/manifest.json";
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

if (
  manifest.manifest_version !== 3 ||
  !Array.isArray(manifest.background?.scripts) ||
  manifest.background.scripts.length === 0 ||
  manifest.background.service_worker ||
  !manifest.sidebar_action?.default_panel ||
  !Array.isArray(manifest.permissions)
) {
  throw new Error("Plasmo 未生成预期的 Firefox MV3 后台脚本和侧边栏");
}

manifest.permissions = manifest.permissions.filter((permission) => !["background", "sidePanel", "tabGroups"].includes(permission));
manifest.sidebar_action.open_at_install = false;
manifest.content_security_policy = {
  ...manifest.content_security_policy,
  extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
};
manifest.browser_specific_settings = {
  gecko: {
    id: "pupu@luskyle.github.io",
    strict_min_version: "140.0",
    data_collection_permissions: {
      required: ["personalCommunications", "websiteContent"],
    },
  },
};

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`✅ Firefox manifest 已配置: ${manifestPath}`);
