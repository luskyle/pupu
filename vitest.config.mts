// vitest 不读取 tsconfig 的 paths，因此这里补上与 tsconfig.json 一致的 `~` → src 别名，
// 让测试文件可以沿用源码里的 `~utils/...` 导入写法。
// 改用 .mts 是因为 package.json 不能加 "type": "module"（tailwind/postcss 配置仍是 CJS）。
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const srcDir = fileURLToPath(new URL("./src/", import.meta.url));

export default defineConfig({
  resolve: {
    // 注意 replacement 必须带结尾斜杠：别名替换的是 `~` 本身，
    // 否则 `~utils/x` 会拼成 `<src>utils/x` 而少一层路径。
    alias: [{ find: /^~/, replacement: srcDir }],
  },
  test: {
    alias: { "~": srcDir },
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});