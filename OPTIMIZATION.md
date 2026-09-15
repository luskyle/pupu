# pupu 优化升级建议

> 审计日期：2026-09-15 ｜ 审计基线：v0.2.5（commit `abff568`）｜ 项目规模：183 个源文件 / 37,826 行 TS·TSX

## 关于本文档

**审计方式与边界**

- 只做了**静态分析 + 构建产物分析**（源码引用关系、`build/chrome-mv3-prod/` 各 chunk 体积、依赖版本与 npm 最新版对比、仓库设置查询）。
- **没有做浏览器实机验证**。因此凡是标注「需实机验收」的条目，请务必在 Chrome / Edge 里跑一遍再认为完成。
- 每条结论都附了可复现的证据（文件:行号、实测数字）或复现命令（见附录 A）。

**风险提示**

本文档最初起草时，P0-1（域名匹配越界）与 P0-2（Markdown 未消毒）**尚未修复**，在公开仓库里记录细节等同于公开披露漏洞。**这两项已于 2026-09-15 修复并附单元测试**（见下方修订记录与各条状态），因此现在可以安全提交本文档。剩余的 P0-3（生产日志）不属于可被利用的漏洞。

## 修订记录

| 日期 | 变更 |
| --- | --- |
| 2026-09-15 | 首次审计（基线 v0.2.5 / `abff568`） |
| 2026-09-15 | 完成第一批修复：P0-1、P0-2、P1-2、P2-6；P1-1 部分完成（引入 vitest + jsdom，35 个单测，已接入 CI） |
| 2026-09-15 | 审计修正：P0-1 实际存在 **2 处**（原文只记了 1 处）；P0-2 中「DynamicTab 同样需处理」为**误报**（该处已做转义）；新增发现 P1-7 |
| 2026-09-15 | 完成第二批修复：P1-7、P1-4、P1-5（部分）、P1-6（部分）；P1-1 继续补测（共 66 个用例） |
| 2026-09-15 | 新增发现：`engines` 字段会让 Parcel 构建失败（见 P1-5）；语言包校验自动化后又查出 3 个真实缺陷；`escapeHtml` 放错模块导致分包 +70 KB（见 P2-1） |
| 2026-09-15 | 完成第三批：P0-3（日志全量收敛）、P2-1、P2-2、P2-3（PNG 部分）、P2-5（部分）；P2-4 经查证后**主动推迟**（理由见该条） |
| 2026-09-15 | 第三批实测：`options` 首包 4191 → 1845 KB、`popup` 369 → 139 KB、平台图标 872 → 684 KB、zip 4.29 → 4.14 MB |

## 结论摘要

| 级别 | 项目 | 实测证据 | 建议 | 工作量 | 状态 |
| --- | --- | --- | --- | --- | --- |
| P0 | 可信域名通配符匹配可被绕过（**2 处**） | `trust-domain.ts:52-54`、`contents/extension.ts:24-26` | 加子域点边界判断 | 小 | **已修复** |
| P0 | Markdown 预览与发布载荷未消毒 | `ArticleTab.tsx:71,263` | 接入 DOMPurify | 小 | **已修复** |
| P0 | 生产代码 1153 处 `console.log` | 70 个文件 | 落地分级 logger | 中 | **已修复**（迁移 2311 处，src 内 console 归零） |
| P1 | 零测试（183 文件 / 3.8 万行） | 无 test 脚本、0 测试文件 | 引入 vitest，先测纯函数 | 中大 | **进行中**（66 个用例，已接入 CI） |
| P1 | husky 钩子未生效 | `.husky/` 下只有 `_` | 补 `pre-commit` / `commit-msg` | 小 | **已修复** |
| P1 | TS `strict: false` + 67 处 `any` | plasmo tsconfig.base | 分步开严格模式 | 大 | 待办 |
| P1 | CI 不做类型检查 | `.github/workflows/ci.yml` | 加 `tsc --noEmit` | 小 | **已修复** |
| P1 | 环境不固定（无 `engines` / `packageManager`） | package.json | 补版本声明 | 小 | **部分完成**（`packageManager` + `.nvmrc`；`engines` 因 Parcel 冲突不可用） |
| P1 | 分支无保护、Dependabot 关闭 | `gh api` 查询结果 | 开启必需检查与依赖告警 | 小 | **部分完成**（Dependabot 已配置；分支保护见下方说明） |
| P1 | 动态适配器把用户文本未转义拼进 `innerHTML` | `maimai.ts:59`、`weixinchannel.ts:253` | 先转义再拼 `<br>` | 小 | **已修复** |
| P2 | 产物 18 MB，重库全静态引入 | options chunk 4.16 MB | 重库改动态 `import()` | 中 | **已修复**（options 首包 4191 → 1845 KB） |
| P2 | popup 包 369 KB 只为跳转 | `popup/index.tsx` | 去掉无用 shadow CSS | 小 | **已修复**（369 → 139 KB，余量为 React 下限） |
| P2 | 平台图标 872 KB，单图最大 144 KB | 按 16–24px 显示 | 统一压到 32px | 小 | **PNG 已完成**（872 → 684 KB）；ICO 402 KB 待办 |
| P2 | `wasm/` 约 1 MB 为可选兜底件 | pdfjs fallback 与 quickjs | 评估剔除 | 小 | **已查证，主动推迟**（见该条） |
| P2 | 死代码 / 死依赖 | `utils/docx.ts` 0 引用等 | 清理依赖声明 | 小 | **部分完成**（移除 `uuid`、`@iconify/react`；docx 依赖按项目意图保留） |
| P2 | 英文语言包缺 3 个 key | en 缺 `optionsCoverImage` 等 | 补齐 | 小 | **已修复** |
| P3 | 一批大版本升级积压 | React 18 / HeroUI 2 / Tailwind 3 | 一次一个 PR | 大 | 待办 |
| P4 | 未上架商店、隐私说明缺失、权限过宽 | `host_permissions: https://*/*` | 上架 + 补文档 + 收窄权限 | 中 | 待办 |

---

## P0 · 安全

### P0-1 可信域名通配符匹配可被绕过

**状态：已修复**（2026-09-15）· 修复时发现该缺陷实际存在于 **2 处**，原文只记录了 1 处。

**位置**：

| 文件 | 角色 |
| --- | --- |
| `src/background/services/trust-domain.ts:52-54` | 后台侧闸门 |
| `src/contents/extension.ts:24-26` | 内容脚本（页面）侧闸门 —— 原文漏记 |

两处都是同一写法：

```ts
if (domain.startsWith("*.")) {
  const wildCardDomain = domain.slice(2);
  return hostname.endsWith(wildCardDomain);   // ← 缺陷在这里
}
return hostname === domain;
```

**问题**：`endsWith` 没有子域点边界判断，信任 `*.pupu.app` 会**连带信任 `evilpupu.app`、`notpupu.app`** 这类同后缀但不属于该域的域名。已实测确认：

```
hostname        : evilpupu.app
旧逻辑 endsWith : true   ← 被误判为可信（漏洞真实存在）
新逻辑（校验点）: false
```

**影响**：可信域名列表是「允许该网站通过扩展发布内容 / 调用扩展开放的 API」的授权凭据（见语言包 `settingsTrustedDomainsAllowPublish`、`settingsTrustedDomainsAllowAPI`）。同后缀域名一旦被信任，即获得发布与 API 调用能力。

**修复**：把两处重复逻辑收敛为可单测的纯函数 `src/utils/domain-match.ts`：

```ts
export const isHostnameTrusted = (hostname: string, trustedDomains: readonly { domain: string }[]): boolean => {
  const host = hostnameOf(hostname) || hostname.trim().toLowerCase();
  if (!host) return false;

  return trustedDomains.some(({ domain }) => {
    const pattern = domain.trim().toLowerCase();
    if (!pattern) return false;
    if (pattern.startsWith("*.")) {
      const base = pattern.slice(2);
      if (!base) return false;
      return host === base || host.endsWith(`.${base}`);   // 点边界
    }
    return host === pattern;
  });
};
```

两处调用点改为 `isHostnameTrusted(...)`，消除了重复实现（避免今后只修一处的风险）。

**配套测试**：`src/utils/domain-match.test.ts`（15 个用例）锁定「`pupu.app` 通过 / `a.pupu.app` 通过 / `evilpupu.app`、`pupu.app.evil.com`、`notpupu.app`、`evil-pupu.app` 一律拒绝」，另覆盖大小写、空值、`*.` 裸通配、完整 URL 输入等边界。

**仍需实机验收**：设置页添加 `*.pupu.app`，确认 `evilpupu.app` 不再被判定为可信。

---

### P0-2 Markdown 预览未消毒（`marked` 直出 + `dangerouslySetInnerHTML`）

**状态：已修复**（2026-09-15）

**位置**：`src/components/Sync/ArticleTab.tsx:263`（预览）与 `:71`（发布载荷）

```tsx
dangerouslySetInnerHTML={{ __html: marked.parse(mdSource || "") as string }}   // 修复前
const htmlContent = mdMode ? (marked.parse(mdSource) as string) : digest || ""; // 修复前
```

**问题**：`marked` 按设计**不做消毒**（官方文档明确要求调用方自行处理），Markdown 中的内联 HTML 会被原样渲染。而 `mdSource` 有三个来源：

1. 手动粘贴；
2. 导入本地文件；
3. **从 URL 导入** —— `src/utils/scrape-article.ts:49` 会真的 `fetch(sourceUrl)` 抓取远程内容。

渲染发生在 `chrome-extension://` 特权页面中（该页面可访问扩展的 `chrome.*` 能力与发布消息通道）。「把别人的文章导入进来再发」是这个扩展的正常用法，因此这是可被诱导触发的路径。

**影响面比原先估计的更大**：`htmlContent` 不只是用于预览 —— 它通过 `innerHTML` 注入到平台编辑器页面，共 **4 处**：

| 文件 | 用法 |
| --- | --- |
| `sync/article/dongchedi.ts:123` | `editorBody.innerHTML = articleData.htmlContent` |
| `sync/article/kuaichuanhao.ts:92` | `editor.innerHTML = ...` |
| `sync/article/sohu.ts:133` | `editor.innerHTML = ...` |
| `sync/article/tonghuashun.ts:117` | `editorBody.innerHTML = ...` |

另有若干处通过剪贴板 `text/html` 或 `pasteHtml` / `writeHtml` 写入编辑器（dingduanhao、douban、eastmoney、autohome、dayuhao、wordpress）。**在源头消毒即可覆盖以上全部消费方**，这也是选择在 `ArticleTab` 入口处理的原因。`markdownContent` 走的是表单提交与 turndown 转换，不作为 HTML 注入，无需处理。

> 注意：动态（动态 Tab）侧另有一套独立的 `innerHTML` 注入路径，**不在本次消毒覆盖范围内**，见新增的 P1-7。

**修复**：新增 `src/utils/sanitize.ts`，统一两个入口：

```ts
export const sanitizeHtml = (html: string): string => DOMPurify.sanitize(html, { FORBID_TAGS });
export const renderMarkdownSafely = (markdown: string): string => sanitizeHtml(marked.parse(markdown) as string);
```

`ArticleTab` 的两处分别改为 `renderMarkdownSafely(mdSource)` 与 `sanitizeHtml(digest || "")`，并移除了对 `marked` 的直接依赖（今后不会再有人绕过消毒）。

**实测确认的消毒行为**（`src/utils/sanitize.test.ts`，20 个用例）：

- 移除：`<script>`、`<style>` 元素、`<iframe>` / `<object>`、`on*` 事件处理器、`javascript:` 链接、表单控件（`form`/`input`/`button`/`select`/`textarea`/`label`/`option`）
- 保留：`h1-h6`、`p`、`strong`、`em`、`ul`/`ol`/`li`、`blockquote`、`pre`/`code`、`table` 系列、`a[href]`、`img[src/alt]`、`figure`/`figcaption`、`svg`、`video`、`class`、`data-*`、**内联 `style`**（导入文章的排版保真度依赖它）

**三个已确认的取舍**（已写入代码注释，属有意决定而非遗漏）：

1. **表单控件是额外加固**：DOMPurify 默认**放行** `<form>` / `<input>`，实测确认。文章内容并不需要表单控件，而导入内容来自任意站点，在扩展页里渲染出可输入的假表单（视觉伪装、收集输入）没有正当用途，因此显式加入 `FORBID_TAGS`。
2. **`style` 属性内的 CSS 不做解析**：实测 `style="background:url(javascript:alert(1))"` 会被原样保留。现代浏览器不会在 CSS 中执行 `javascript:`，而解析 CSS 需额外引入 CSS 消毒器并会影响样式保真度，故按此取舍。
3. **链接的 `target` 被去掉**（DOMPurify 默认行为），可避免反向标签劫持；副作用是导入内容里的外链从「新标签打开」变为「当前页打开」。

**审计修正**：原文「`DynamicTab.tsx` 也有一处 `dangerouslySetInnerHTML`，同样建议一并处理」是**误报**。该处由 `highlightTopics`（`DynamicTab.tsx:828`）先做 `&`/`<`/`>` 转义、再包裹 `<span>`，不存在注入。**无需改动**。

**体积成本**：DOMPurify 使 `options` 入口包 +28 KB（4163 KB → 4191 KB）。

**仍需实机验收**：从 URL 导入一篇含内联 HTML 的文章 → 预览与发布到 dongchedi / sohu 等平台，确认排版正常、脚本被剥离。

---

### P0-3 生产代码 1153 处 `console.log`（70 个文件）

**实测**：`grep -rn "console\.log" src/ | wc -l` = **1153**，分布在 **70** 个文件；典型如

```ts
// src/background/services/trust-domain.ts:22-24
console.log("request", request);   // 整个请求对象
console.log("domainId", domainId);
```

**问题**：

- 扩展会读取各平台登录态、账号信息、发布内容，把这些打到页面控制台是**信息泄漏面**（内容 / token / 账号信息）。
- 对用户来说是噪音，也让真正的错误难以被发现。

**已有的基础**：语言包里**已经存在**分级运行日志的设计（`optionsRunningLogs`、`optionsFilterLevel`、`optionsAllLevels`、`optionsInfo/Warning/Error`、`optionsFilterSource`），但 `src/utils/` 下**并没有**统一的 logger 工具（已确认不存在 `logger` / `LogLevel` / `createLogger`）。

**建议**：新增 `src/utils/logger.ts`，按「来源 + 级别」输出并写入运行日志：

- 生产构建下默认只保留 `warn` / `error`（用构建期常量或 `process.env.NODE_ENV` 裁剪 `debug` / `info`）；
- 敏感字段（request、cookies、token）**永不落日志**；
- 然后按文件分批把 1153 处 `console.log` 换成 `logger.debug/info/warn/error`，优先处理 `src/background/**`（安全敏感）与 `src/sync/**`（噪音最多、最容易泄漏账号信息）。

**实际处理**（2026-09-15）：**全量完成**。

- 新增 `src/utils/logger.ts`（零依赖，含 7 个用例）：`debug`/`info` 仅开发环境输出，`warn`/`error` 始终输出；
  开发环境 `debug` 走 `console.log` 以**保持改造前的可见性**（`console.debug` 会被 DevTools 收进 Verbose 过滤）；
  生产环境可在扩展页面控制台执行 `window.__PUPU_DEBUG__ = true` 临时打开全部级别，无需重新打包。
- **迁移了 2311 处**调用（`src/` 内 `console.*` 归零，logger 实现与测试文件除外），覆盖 `sync/{video,article,dynamic,account,podcast}`、`contents`、`components`、`utils`、`tabs`、`background`。
- 迁移方式：脚本逐行替换 + 跳过注释行，插入 import；随后由 `pnpm lint` / `typecheck` / `test` / `build:ci` 全量校验。
- **发布前专门核查**：产物中 `process.env.NODE_ENV` 已全部被 Plasmo 替换（0 残留），因此 service worker 与内容脚本里不会出现 `process is not defined`。

**仍然待办**：语言包里的「运行日志」页签（`optionsRunningLogs` 等 key）**至今没有实现**（那些 key 在 `src/` 里零引用）。本次只做了「不再喷日志」，把日志接入可视化面板是独立的一件事。

---

## P1 · 工程质量

### P1-1 零测试

**状态：部分完成**（2026-09-15）

**实测**（修复前）：无 `test` 脚本；`src/`、`scripts/` 下 **0 个** `*.test.*` / `*.spec.*` 文件。

**为什么这是最大风险**：代码量 183 文件 / 37,826 行，核心是 `src/sync/{account,article,dynamic,video}/**` 与 `src/contents/helper/**` 这 **100+ 个平台适配器**。这类代码的失败模式是**静默失败** —— 平台改一次 DOM，发布就没反应，而且你不可能手工回归 100 个平台。

**已完成**：

- 引入 `vitest`（+ `jsdom` 供 DOM 相关测试用）+ `vitest.config.mts`（补上 tsconfig 的 `~` → `src` 别名，注意 replacement 需带结尾斜杠）；
- `pnpm test` / `pnpm test:watch` 脚本，并已接入 CI（在 `pnpm typecheck` 之后、构建之前执行）；
- 共 **66 个用例**，5 个测试文件：

| 测试文件 | 用例数 | 覆盖内容 |
| --- | --- | --- |
| `src/utils/domain-match.test.ts` | 15 | 可信域名匹配（P0-1 的修复） |
| `src/utils/sanitize.test.ts` | 20 | HTML 消毒（P0-2 的修复） |
| `src/utils/escape-html.test.ts` | 7 | 文本转义 + 模块无依赖守护（P1-7） |
| `src/utils/rednote-text.test.ts` | 20 | 小红书话题格式与标题长度规则 |
| `src/locales.test.ts` | 4 | 语言包一致性（P2-6） |

- 已验证测试文件不会被 Plasmo 打进产物（产物中检索不到 test / vitest 字样）。

**后续落地顺序**（从收益/成本比最高的开始）：

1. **纯函数单测**（继续补）：
   - ~~话题转换：`#话题#` → 小红书 `#话题[话题]#`~~（已完成，`rednote-text.test.ts`）
   - ~~标题超长跳过（>20 字）~~（已完成，同上）
   - HTML ↔ Markdown 往返（`marked` / `turndown`）—— 待做
   - 平台归一化与分组（动态 / 视频 / 文章首选平台）—— 待做，需先把分组数据从侧边栏组件里抽出来
   - ~~trust-domain 匹配~~（已完成，P0-1）
2. **平台适配器契约测试**：挑 2–3 个平台，把「输入内容 → 期望填充结果」做成快照测试。
3. **冒烟检查**：对每个适配器断言「选择器表非空且无重复」（纯静态就能跑，能挡住大量手误）。

---

### P1-2 husky 钩子实际上没有生效

**状态：已修复**（2026-09-15）

**实测**（修复前）：

- `git config core.hooksPath` = `.husky/_`（husky 已接管钩子路径）；
- 但 `.husky/` 目录下**只有 `_`**，没有 `pre-commit`、`commit-msg` 文件。

**结论**：`package.json` 里配置的 `lint-staged` 与 `commitlint.config.js` **从未运行过** —— 是死配置。

**机制**（husky v9）：`.husky/_/h` 会取自身的 basename 作为钩子名，去找 `.husky/<钩子名>`；文件不存在就 `exit 0` 静默跳过，存在则用 `sh -e` 执行，并把 `node_modules/.bin` 前置到 `PATH`。因此钩子文件**不需要 shebang**，也可以直接调用 `lint-staged` / `commitlint`。

**修复**：

```sh
# .husky/pre-commit
lint-staged

# .husky/commit-msg
commitlint --edit "$1"
```

**验证方式**（直接调用 husky 的分发器，与 git 的调用路径一致）：

```
sh .husky/_/commit-msg /tmp/badmsg.txt   → exit=1（不规范信息被拒）
sh .husky/_/commit-msg /tmp/goodmsg.txt  → exit=0（规范信息通过）
sh .husky/_/pre-commit                   → exit=0（lint-staged 正常执行）
```

**备注**：`lint-staged` 跑的是 `biome check --write --unsafe`（会改写文件），只处理暂存文件。

---

### P1-3 TypeScript 严格模式关闭

**实测**：`node_modules/plasmo/templates/tsconfig.base.json` → `"strict": false`、`"noUnusedLocals": false`、`"noUnusedParameters": false`；`src/` 下 `any` 共 **67 处**，`@ts-ignore` / `@ts-expect-error` **0 处**（这点很好）。

**建议**：在你自己的 `tsconfig.json` 里**逐步**覆盖，不要一次开满：

1. 先 `"strictNullChecks": true`（对满屏 DOM 查询与可选返回值收益最大，能挡掉大量「选不到元素」的空值崩溃）；
2. 再 `"noUnusedLocals" / "noUnusedParameters": true`（顺手清掉死变量）；
3. 最后 `"strict": true`，期间用 `unknown` + 类型守卫替掉 67 处 `any`。

**注意**：每步单独提交，避免和功能改动混在一起。

---

### P1-4 CI 不做类型检查

**状态：已修复**（2026-09-15）

**实测**（修复前）：`.github/workflows/ci.yml` 只有 `pnpm lint`（Biome）+ `pnpm build:ci` + 产物校验 + CRX 冒烟测试，**没有类型检查**。Biome 只做语法/风格/lint，类型错误不会被 CI 拦住。

**关键前提（已实测）**：当前配置下 `tsc --noEmit` 是 **0 错误**，且并非空跑 —— 控制了实验验证：

```
tsc --noEmit --listFiles | grep -c src   → 186（确实在检查 186 个源文件）
植入一个错误类型赋值 → 立刻报 TS2322，随后已移除探针
```

也就是说类型检查可以直接设为门禁，不需要先修一堆历史错误。

**修复**：新增 `pnpm typecheck`（`tsc --noEmit`），并在 CI 中排在 `lint` 之后、`test` 之前。

**后续**：真正的类型收益来自 P1-3（打开 `strictNullChecks`），那会暴露出大量空值问题；届时再评估错误量、分步推进。

---

### P1-5 环境版本未固定

**实测**：无 `.nvmrc` / `.node-version`；`package.json` 无 `engines`、无 `packageManager`。CI 里的 Node 与 pnpm 版本目前是**硬编码在 workflow 里**的（Node 24 / pnpm 11.18.0）—— 本地与 CI 靠人工同步，容易漂移。

**修复**（已完成部分）：

```json
"packageManager": "pnpm@11.18.0"
```

加 `.nvmrc`（内容 `24`），并把两个 workflow 里硬编码的 `version: 11.18.0` 去掉 —— `pnpm/action-setup` 未指定版本时会读 `packageManager`，这样版本只有一个来源。

**重要发现：`engines` 字段不能用**（原方案里给了它，实测后移除）

加了 `"engines": { "node": ">=24", "pnpm": ">=11" }` 之后，扩展构建**直接失败**：

```
🔴 ERROR | Failed to resolve '../../src/options/index.tsx' from './.plasmo/static/options.tsx'
```

原因：**Parcel 会把 `package.json` 的 `engines` 当作构建 targets 读取**（Parcel 支持用 `engines` 声明目标环境）。于是整份扩展产物被按 Node 目标去解析，浏览器入口随之解析失败。

排查过程（可复现）：清空 `.plasmo` 缓存无效 → 用 `git stash -u` 隔离改动后构建**成功** → 仅移除 `engines`（其余改动全部保留）后构建**恢复成功**，因此可确证是 `engines` 导致。

结论：Node 版本要求用 `.nvmrc` 声明，**不要**在 `package.json` 里加 `engines`。README 已加显著提示防止今后误加。

---

### P1-6 分支无保护、Dependabot 关闭

**状态：部分完成**（Dependabot 配置与分支保护已完成；Dependabot security alerts 待你在网页开启）

**实测**（`gh api`）：

- `repos/luskyle/pupu/branches/main/protection` → **404 Branch not protected**（无必需状态检查、无 PR 审查要求）；
- `security_and_analysis.dependabot_security_updates.status` → **disabled**（`secret_scanning` 已 enabled）。

**建议**：

- 为 `main` 开启分支保护，把 `CI` 设为**必需状态检查**（这样已经建好的 CI 才真正起到闸门作用）；
- 开启 Dependabot alerts + security updates；
- 加 `.github/dependabot.yml`（`npm` 生态，每周一次，分组 minor/patch，避免 PR 洪水）。

**实际处理**（2026-09-15）：

- ✅ 新增 `.github/dependabot.yml`：npm 与 github-actions 每周检查；minor/patch 分组开 PR，**大版本一律不自动开**（避免 React 19 / Tailwind 4 之类被自动升级）。
- ✅ 已通过 API 为 `main` 开启分支保护，必需状态检查为 `代码检查与打包`（配置：`strict: false` 不强制分支最新、`enforce_admins: false`、禁止强制推送与删除）。
- ⚠️ 仍待你在 GitHub 网页开启 **Dependabot alerts / security updates**（API 侧 `dependabot_security_updates` 需仓库管理员在 Settings 里打开，本次未改动）。

**关于「直接推 main」会怎样（已实测）**：管理员推送仍会成功，但服务端会打印绕过记录 —— 这是有意保留的行为，因为本项目是单人维护、以直接推 main 为主：

```
remote: Bypassed rule violations for refs/heads/main:
remote: - Required status check "代码检查与打包" is expected.
```

也就是说：直接推 main 照常可用（并留下一条可见的绕过提示），而 **PR 合并被真正拦住了** —— Dependabot 开的 PR 必须等 CI 通过才能合并。若今后改为 PR 流程，可把 `enforce_admins` 设为 true。

---

### P1-7 动态适配器把用户文本未转义拼进 `innerHTML`（新增）

**状态：已修复**（2026-09-15）

**发现时间**：2026-09-15（修复 P0-2 时排查全仓 `innerHTML` 用法时发现）

**位置**：

```ts
// src/sync/dynamic/maimai.ts:58-60
const tagSuffix = tags?.length ? ` ${tags.map((t) => `#${t}`).join(" ")}` : "";
const htmlContent = `${(content || "").replace(/\n/g, "<br>")}${tagSuffix}`;
editor.innerHTML = htmlContent;

// src/sync/dynamic/weixinchannel.ts:253 + :274
const finalContent = `${content || ""}${tagSuffix}`;
editorElement.innerHTML = finalContent;
```

**问题**：两处都把动态正文（用户在扩展输入框里键入的文本）**未转义**直接拼进 HTML 再赋给 `innerHTML`。

**影响**（两个层面）：

1. **内容保真（实际更常发生）**：用户只要在动态里写下含 `<` / `>` 的文本（例如讲解 HTML 的 `用 <div> 排版`），这段内容就会被平台当作标签解析 —— 轻则字符消失，重则整段排版错乱。这是日常就会遇到的功能缺陷。
2. **注入（self-XSS 级别）**：键入/粘贴 `<img src=x onerror=...>` 会在该平台页面上执行脚本。属「用户自己输入触发自己」，不是外部攻击面，因此定级 P1 而非 P0。

**修复建议**：先转义再拼 `<br>`，例如

```ts
const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const htmlContent = `${escapeHtml(content || "").replace(/\n/g, "<br>")}${tagSuffix}`;
```

**实际修复**：

- 新增无依赖模块 `src/utils/escape-html.ts`（7 个用例覆盖，含 `&` 必须先转义、以及「先转义再插 `<br>`」的顺序要求）；
- `maimai.ts`：转义正文与话题后拼 `<br>`；
- `weixinchannel.ts`：**拆成两个变量** —— `rawContent`（给剪贴板 `text/plain`，必须保持原文）与 `htmlContent`（给 `innerHTML`，必须转义）。若共用一个变量，剪贴板里会出现 `&lt;` 这种实体；
- `DynamicTab.tsx` 的 `highlightTopics` 原来自己写了一遍转义，改为复用同一实现，消除重复。

**顺带排除**：`sync/dynamic/` 下其余 `innerHTML = ""` 只是清空编辑器；`weixin.ts` / `webhook.ts` 的 `tip.innerHTML` 模板经核查是**静态文案、无插值**，不存在注入。

**未一并处理（记录在案）**：`weixinchannel.ts` 的正文没有像 `maimai.ts` 那样把 `\n` 转成 `<br>`，因此多行动态在视频号编辑器里可能丢失换行。这属于既有行为、需要实机确认编辑器是否自行处理换行，故未在本次改动中一并调整。

---

## P2 · 体积与性能

**总量**：产物 `build/chrome-mv3-prod/` 未压缩 **18 MB**；分发包 zip 4.49 MB、crx 4.33 MB。

**入口包实测**：

| chunk | 体积 |
| --- | --- |
| `options.<hash>.js` | **4163 KB** |
| `sidepanel.<hash>.js` | **2444 KB** |
| `tabs/refresh-accounts.js` | 2184 KB |
| `tabs/trust-domain.js` | 1573 KB |
| `tabs/link-extension.js` | 1570 KB |
| `popup.<hash>.js` | 369 KB |
| `dist.<hash>.js`（共享） | 329 KB |
| `link-extension.<hash>.css` | 223 KB |
| `options.<hash>.css` | 44 KB |

### P2-1 重库全部静态引入（收益最大）

以下依赖都是**顶层 `import`**，却只在特定操作时才需要：

| 依赖 | 引入位置 | 何时才需要 |
| --- | --- | --- |
| `pdfjs-dist` | `src/utils/pdf.ts:1` | 导入 PDF 时 |
| `pptx-preview` | `src/utils/pptx.ts:3` | 导入 PPT 时 |
| `html2canvas` | `src/utils/pptx.ts:2`、`src/utils/docx.ts:3` | 截图时 |
| `html-to-image` | `src/utils/pptx.ts:1`、`src/utils/docx.ts:2` | 截图时 |
| `video-react` | `VideoTab.tsx:5`、`DynamicTab.tsx:17` | 视频预览时 |

而这些模块又被 `DynamicTab` / `ArticleTab` 静态引入，`DynamicTab` 又是 options 主界面的一部分 —— 所以**首屏就把 PDF/PPT/截图的整套工具链一起加载了**。

**建议**：把这些工具模块改为**动态导入**，只在用户真的点「导入 PDF / PPT」或打开视频预览时加载：

```ts
const { convertPdfToImages } = await import("~utils/pdf");
```

预期能把 `options` 首屏砍掉可观的一块（pdfjs 主库 + pptx-preview + 两个截图库 + video-react 均在其中）。改完请用「构建产物 chunk 体积对比」验收，别只看总大小。

**本轮已经踩到一次这个坑（实证）**：修 P1-7 时把 `escapeHtml` 放进了 `~utils/sanitize` 并从 `maimai.ts` / `weixinchannel.ts` 导入，结果这两个适配器可达于侧边栏分包，把 **DOMPurify + marked 一起拖了进去**：

```
sidepanel bundle:  2444 KB  →  2514 KB   （+70 KB）
zip:               4.29 MB  →  4.36 MB
```

拆出无依赖的 `src/utils/escape-html.ts` 后回落（2445 KB / 4.29 MB）。教训：**共享工具模块的「依赖重量」决定它能不能被平台适配器引用**，一个四行的转义函数不值得背上两个重库。已在 `escape-html.test.ts` 里加守护用例（禁止该模块引入任何依赖），并在 README 提示。

审核时请一并留意：`~utils/sanitize`（DOMPurify + marked）、`~utils/pdf`（pdfjs）、`~utils/pptx`（pptx-preview + 两个截图库）都属于「重量级」模块，只有真正需要它们的入口才应导入。

**实际处理**（2026-09-15）：已把 `~utils/pdf` 与 `~utils/pptx` 改为**按需加载**（在 `DynamicTab` 的处理函数里 `await import(...)`）。

实测结果：

```
options 首包（首次加载需解析执行的量）:  4191 KB → 1845 KB   （-56%）
新增按需分包:  pptx.<hash>.js 1927 KB、pdf.<hash>.js 456 KB
```

产物核对（无浏览器时能做的验证）：`options` 包中确实引用了这两个分包名、分包确实在 zip 内、且 `options` 首包已不含 pdfjs 主库（检索 `PDFDocumentLoadingTask` 为 0）。

**一个必须说清的结论：动态导入优化的是「首次加载/解析」，不是「下载体积」。**
zip 仅从 4.29 MB 降到 4.14 MB（其中绝大部分来自图标压缩），因为分包仍然要打进包里、只会在用到时才被拉取。想真正减小下载体积，必须**删掉**资源或依赖（见 P2-3 / P2-4 / P2-5）。

**关于 video-react（约 180 KB）**：它是以 JSX 组件形式使用的，需额外套一层 `React.lazy` + Suspense 才能延后加载。**未做** —— 因为 P2-5 计划用原生 `<video>` 直接移除这个停更库，先加包装层属于会被丢弃的改动。

### P2-2 popup 包 369 KB，只为跳转一次

`src/popup/index.tsx` 的实际逻辑是 `chrome.runtime.openOptionsPage()` 后 `window.close()`，**渲染一个空 div**；但它 `import "~style.css"` 并且用 `data-text:~style.css` 建了一个**永远不会被渲染**的 shadow 容器 —— 于是整套 Tailwind 被塞进了这个 stub。

**建议**：删掉 `data-text` / `getStyle` / `getShadowContainer` 这套 Plasmo 模板样板（该页不渲染 UI），只保留跳转逻辑。预期 369 KB → 接近 0。

**实际处理**（2026-09-15）：已精简为只保留 `useEffect` + `return null`，删除 `~style.css` / `data-text:~style.css` 与三个 shadow 相关导出。

```
popup 包:  369 KB → 139 KB
```

**139 KB 是下限**：已核实其中就是 React + ReactDOM + scheduler（`createRoot` 渲染空组件也需要它们），不再有可削的部分。同时核查了 Plasmo 为 popup 生成的静态入口：它只使用 `Component.default`，**完全不引用**被删掉的那三个导出（0 次）。

### P2-3 平台图标 872 KB（76 个文件，按 16–24px 显示）

单文件最大：

| 文件 | 体积 |
| --- | --- |
| `qingting.png` | **144 KB** |
| `dedao.ico` | 66 KB |
| `iqiyi.ico` | 31 KB |
| `spotify.png` | 27 KB |
| `sspai.ico` | 17 KB |

**建议**：统一重采样到 32×32（或转 webp/ico），预计可省约 **800 KB** —— 对 4.3 MB 的包来说是接近 20% 的削减。

**实际处理**（2026-09-15）：完成 **PNG 部分**。

- 用 sharp 把 20 个 PNG 重采样到 64×64（渲染 20px × 3 倍屏 = 60px，留余量），并加 `withoutEnlargement` 避免放大：
  **238 KB → 47 KB**（`qingting.png` 单文件 144 KB → 3 KB，原图是 2048×2048）；
- 整套图标目录 **872 KB → 684 KB**；只替换「确实变小且透明度未变」的文件，否则跳过（实测跳过了 7 个已足够小的文件）。
- 新增 `src/platform-icons.test.ts`：双向校验「src 中引用的图标都存在」+「assets 下没有无人引用的图标」，并含一条防扫描失效的数量断言。图标是字符串路径引用，写错扩展名只会表现为破图，这个测试把它变成会失败的检查。

**ICO 部分未做（402 KB）**：先查证了可行性 —— 46 个 `.ico` 中有 **44 个是 BMP(DIB) 编码**、仅 2 个内嵌 PNG，而 sharp（libvips）**不支持读取 ICO**；此外 `.ico` 的引用分散在 5 个文件共 75 处（`sync/{article,video,dynamic,account,podcast}.ts`）。也就是说要做完整转换需要一个 DIB 解码器 + 改 75 处引用，收益 402 KB 但改动面较大且容易改错扩展名（`platform-icons.test.ts` 现在能兜住这类错误）。建议作为独立一项处理。

### P2-4 `wasm/` 约 1 MB 属可选兜底件

| 文件 | 体积 | 说明 |
| --- | --- | --- |
| `quickjs-eval.wasm` | 458 KB | 仅 PDF 内嵌 JS 场景需要 |
| `openjpeg_nowasm_fallback.js` | 441 KB | 仅**无 WebAssembly** 环境的兜底 |
| `jbig2_nowasm_fallback.js` | 142 KB | 同上 |

Chrome MV3 环境**一定**有 WebAssembly，因此两个 `*_nowasm_fallback.js`（583 KB）在扩展里是永远不会走到的路径；`quickjs` 取决于是否需要 PDF 内嵌 JS。

**建议**：先在 `scripts/copy-pdf-worker.mjs` 里排除这两个 fallback 文件，**实机验证扫描版 PDF（JBIG2/CCITT 与 JPEG2000 编码）渲染正常**后再提交。属「需实机验收」项。

**实际处理**（2026-09-15）：**已查证，主动推迟**（不做）。

原以为「Chrome 一定有 WASM，所以兜底件是死代码」，但读了 pdfjs 的实现后发现兜底不是静态判断，而是**尝试-失败回落**：

```js
async #getJsModule(fallbackCallback) {
  let instance = null;
  try {
    const mod = await import(`${WasmImage.#wasmUrl}${this._noWasmFilename}`);   // 动态 import
    instance = mod.default();
  } catch (ex) {
    warn(`#getJsModule: ${ex}`);
  }
  fallbackCallback(instance);            // ← 拿不到就是 null
}
```

因此删掉这两个文件后，一旦 WASM 实例化失败（浏览器策略/开关、CSP、id 变化等），动态 `import()` 会 404 → `fallbackCallback(null)` → **扫描版 PDF 静默渲染成空白**，而不是报错。这个失败模式用户可见、且我在没有浏览器的情况下**无法验证**，所以不纳入本次发布。

**接入方式（验证后可一行启用）**：在 `scripts/copy-pdf-worker.mjs` 里排除这两个文件即可（`wasm/` 目录复制处加一个文件名过滤），收益 **583 KB**（zip 的约 13%）。验证方法：导入一本**扫描版** PDF（JBIG2/CCITT 或 JPEG2000 编码，例如黑白扫描书），确认逐页转图正常。

### P2-5 死代码与死依赖

**已确认（实测）**：

- `src/utils/docx.ts` —— **0 处引用**（Word/WPS 导入功能已屏蔽，实现保留但没有任何入口引用它）；
- `docx-preview` 与 `jspdf` —— 只被上面那个死文件使用，**在产物中出现在 0 个 js 里**（即没被打包，但依赖声明还在）；
- `html2canvas` 出现在 1 个产物 js 中（`utils/pptx.ts` 引的）；
- `@iconify/react` —— **0 处引用**（且在 devDependencies 里）；
- `uuid` —— 仅 1 处（`src/utils/keep-alive.ts:2`），可用原生 `crypto.randomUUID()` 替代，直接去掉依赖。

**建议**：

1. 若短期内不恢复 Word 导入：把 `docx-preview`、`jspdf` 从 `dependencies` 移出（死文件本身可保留在仓库或一并删除）；
2. `html2canvas` 与 `html-to-image` 功能重叠，`utils/pptx.ts` 同时引了两个做同一件事 —— 统一到 `html-to-image`，可再省一块；
3. 移除 `@iconify/react`；
4. `uuid` → `crypto.randomUUID()`；
5. `video-react` 已是 npm 上的最新版（0.16.0，实质停更）—— 视频预览用原生 `<video>` 即可替掉这个遗留库。

**实际处理**（2026-09-15）：**部分完成，并且纠正了本条审计里的两处错误判断**。

已做：

- ✅ 移除 `@iconify/react`（全仓库零导入，包括配置）；
- ✅ `uuid` → 原生 `crypto.randomUUID()`（`keep-alive.ts` 运行在 MV3 service worker 的安全上下文中，该 API 可用），并移除依赖。
- 两项移除后 lockfile 为**纯删除 21 行**，没有带动任何无关依赖升降级。

**审计纠错 1：`docx-preview` / `jspdf` 不删。** README 明确写着「Word/WPS 导入已屏蔽，**相关代码与依赖保留，便于后续恢复**」—— 这是项目的既有意图，不是遗漏。而 `src/utils/docx.ts` 存在就意味着删掉依赖会让 `pnpm typecheck` 直接报找不到模块。因此改为**保留依赖**，并在本条记录：该功能恢复时可直接启用。

**审计纠错 2：`html2canvas` 不是冗余，不能合并。** 读代码后发现 `utils/pptx.ts` 里它是**有意的回退路径**，注释写明「html-to-image 捕获失败，回退 html2canvas」：

```ts
try {
  const dataUrl = await toImagePng(slideEl, { ... });
} catch (error) {
  console.warn("html-to-image 捕获失败，回退 html2canvas:", error);
  const canvas = await html2canvas(slideEl, { ... });
}
```

合并两者会去掉容错，属于**功能退化**，故不做。

**仍未做**：`video-react` → 原生 `<video>`（需要实机确认预览/播放行为，且属 UI 行为变更）。

### P2-6 英文语言包缺 3 个 key

**状态：已修复**（2026-09-15）

**实测**（修复前）：`zh_CN` 380 键 / `en` 386 键，但 **`en` 缺 3 个 `zh_CN` 有的键**：

- `optionsEnterArticleDigest`
- `optionsCoverImage`
- `optionsUploadCover`

英文环境下这 3 处会直接显示原始 key 名。

**修复**：在 `locales/en/messages.json` 中补齐（`Enter Article Digest` / `Cover Image` / `Upload Cover`，风格对齐相邻条目）。修复后复查：`en` 389 键，**缺失 0 项**。

**已加自动化闸门（且立刻又查出 3 个缺陷）**：新增 `src/locales.test.ts`，随 `pnpm test` 在 CI 中执行：

1. 每个语言包必须覆盖 `zh_CN` 的全部 key；
2. 每个 `message` 必须非空；
3. `src` 中传给 `getMessage` 的字面量 key 必须真实存在（按括号配平解析实参，因此 `getMessage(isDark ? "A" : "B")` 这类间接写法也覆盖）；
4. 一条「收集到的 key 数 > 200」的合理性断言，防止扫描逻辑被改坏后静默通过。

启用后立刻查出并修复了 3 个此前无人发现的问题：

| 问题 | 影响 |
| --- | --- |
| `refreshAccountsNotLoggedIn` 不存在，且调用处**没有兜底** | 刷新账号取不到信息时，错误提示是**空白** |
| `devEnvironmentTitle` / `devEnvironmentContent` 不存在 | 开发模式种子文案取不到翻译，只有硬编码中文兜底 |
| `en` 的 `syncPublicPageTitle` 是**空串** | 英文用户看到中文兜底「发布中心」 |

> 扫描器的两处必要处理也记录在案：需**剥离注释**（有一处 key 只出现在注释掉的 `// alert(getMessage(...))` 里），以及按 lowerCamelCase 形状过滤实参里混入的类型枚举（如 `type === "DYNAMIC"` 中的 `DYNAMIC`）。

---

## P3 · 依赖升级

**好消息**：`plasmo` 0.90.5 **已是 npm 最新**，框架层没有升级项。

**当前 vs npm 最新（2026-09-15 实查）**：

| 依赖 | 当前 | 最新 | 建议 |
| --- | --- | --- | --- |
| `pdfjs-dist` | 6.2.108 | 6.3.289 | 低风险，可随手升 |
| `marked` | 18.0.9 | 18.0.13 | 低风险，可随手升 |
| `turndown` | 7.2.0 | 7.2.4 | 低风险，可随手升 |
| `react-viewer` | 3.2.2 | 3.2.5 | 已随 v0.2.5 升级 |
| `uuid` | 10.0.0 | 14.0.2 | 建议改为 `crypto.randomUUID()` 并移除依赖 |
| `html2canvas` / `html-to-image` / `jspdf` / `docx-preview` / `pptx-preview` / `video-react` / `@mozilla/readability` | 同最新 | 同最新 | 无升级项（`video-react` 属停更） |
| `react` / `react-dom` | 18.2.0 | 19.3.0 | **大版本**，需先确认 HeroUI 3.x 对 React 19 的支持 |
| `@heroui/react` | 2.7.8 | 3.2.5 | **大版本**，组件 API 有变 |
| `tailwindcss` | 3.3.5 | 4.3.3 | **大版本**，配置由 JS 改为 CSS-first，破坏性最大 |
| `typescript` | 5.2.2 | 7.0.2 | **跳跃很大**，建议先完成 P1-3 再升 |
| `@biomejs/biome` | 1.9.4 | 2.5.13 | **大版本**，`biome.json` schema 需迁移 |

**做法**：大版本**一个 PR 一个依赖**，每个都跑 `pnpm lint` + `pnpm typecheck` + `pnpm build:ci` 并实机验收相关功能，不要合并成一个巨型升级。

**新门禁立刻见效的一次实证（2026-09-15）**：Dependabot 上线几分钟后就开了 3 个 PR，其中「开发依赖 minor/patch 组」（9 个包）被 CI **拦下** —— 类型检查报 4 个错：

```
src/background/services/tabs.ts(14,67): error TS2694: Namespace 'chrome.tabs' has no exported member 'TabChangeInfo'.
src/components/Sidepanel/PublishConfirm.tsx(88,50): error TS2339: Property 'type' does not exist on type 'unknown'.
src/components/Sidepanel/PublishConfirm.tsx(88,86): error TS2339: Property 'data' does not exist on type 'unknown'.
src/components/Sync/DynamicTab.tsx(1072,33): error TS2339: Property 'type' does not exist on type 'unknown'.
```

原因是该 PR 顺带把 `@types/chrome` 0.0.251 → **0.2.9**、`typescript` 5.2.2 → **5.9.3**。这些是**纯类型层面**的破坏（运行时不受影响，Parcel 会剥离类型），但需要先改代码才能合：

- `chrome.tabs.TabChangeInfo` 在新版类型里已不存在，需改用现有类型（或用 `Parameters<...>` 推导）；
- 消息回调的参数在新版被推断为 `unknown`，需要在回调内收窄或用现有的 `ExtensionExternalRequest` 等类型标注。

**结论**：`@types/chrome` 与 `typescript` 的升级应作为独立任务处理（先修这 4 处），不建议混在分组 PR 里一起合。这也是「类型检查门禁」的价值所在 —— 没有它，这 9 个包会静默合入。

另：`package.json` 的 `pnpm.overrides`（21 条安全版本固定）**已被 pnpm 11 忽略**，需迁移到 `pnpm-workspace.yaml` 的 `overrides:`。实测该迁移会带动 `esbuild` 0.18.2 → 0.28.2（打包工具链跨大版本）与 `react-viewer` 3.2.2 → 3.2.5，lockfile 变动约 968 行，属「需实机验收」项，建议随一个独立版本发布。

---

## P4 · 发布与生态

### P4-1 上架 Chrome Web Store / Edge 加载项商店

现在已有固定签名密钥，上架条件具备。要点：

- **必须沿用同一把签名密钥**（`keys/pupu.pem`，Secret `CRX_PRIVATE_KEY`），否则扩展 ID 变化，已安装用户收不到更新；
- 商店提交用 `.zip`；
- 上架后商店会自动分发更新，用户不再需要「开发者模式」。

**2026-09-15 实测纠正：自签名 CRX 无法安装（本项目已不再提供 `.crx`）**

早期版本把 `.crx` 当作「可直接安装」的产物附加到 Release，并在文档里写成推荐方式 —— **这是错的**。用户在 Edge 里
拖入时得到：

```
包无效："CRX_REQUIRED_PROOF_MISSING"。
```

原因（依据 Chromium `components/crx_file/crx_verifier.cc`，Plasmo 有专文分析）：`VerifyCrx3` 在
`require_publisher_key` 为真时（off-store 下载按 `CRX3_WITH_PUBLISHER_PROOF` 校验）会要求 proof 的 key hash 命中写死的
**Chrome 应用商店公钥**；自签名 CRX 永远不可能满足，因此**拖拽 / 双击 / 普通安装流程一律失败**。

- 加 manifest 的 `key` 字段或 `update_url` **都不解决**；
- 唯一可行路径是机器级**强制**企业策略（`ExtensionInstallAllowlist` + `ExtensionInstallSources`；注意 recommended 会被忽略），这不是普通用户能做的；
- 因此现在：Release **只附 `.zip`**（`加载已解压` 是唯一可用的本地安装方式，仍受「开发者模式」限制）；
  `pnpm crx` / `pnpm verify:crx` 与 CI 里的临时密钥冒烟测试**保留**，将来要做企业策略自托管或上架时可随时启用。

教训：CRX 的**签名能被密码学校验通过 ≠ 浏览器会接受它**。我此前只做了前者（并明确标注了需实机验收），
这类「格式正确但平台拒绝」的问题只有真机安装才能发现。

### P4-2 `host_permissions` 过宽

当前：`https://*/*`、`http://127.0.0.1/*`、`http://localhost/*`；`permissions` 含 `cookies`、`activeTab`、`tabs`、`background`、`scripting`、`tabGroups`、`sidePanel`。

`https://*/*` 会拉长商店审核周期、也降低用户信任度。**建议评估**收窄为枚举主机或改用 `optional_host_permissions`（用户按需授权）——但注意这会改变内容脚本的注入时机，**必须实机验证**主要平台的填充/发布流程，属「需实机验收」项。

### P4-3 缺失的仓库配套

| 文件 | 用途 |
| --- | --- |
| `PRIVACY.md` | 商店必填：扩展读取 cookies / 浏览数据，需明确说明用途 |
| `SECURITY.md` | 漏洞上报渠道（对公开仓库尤其重要） |
| `CONTRIBUTING.md` | 提交规范（你已有 commitlint 约定，正好写进去） |
| `.github/ISSUE_TEMPLATE/*` | 平台适配类 issue 需要固定字段（平台名、页面 URL、失败现象） |
| `.github/pull_request_template.md` | 提醒跑 lint / typecheck / 实机验证 |

### P4-4 工作流与配置清理

- **Actions 固定到主版本号**（`@v7` 等）：供应链加固可 pin 到 commit SHA，配合 Dependabot 维护（收益 / 成本自行权衡）。
- `package.json` 的 `manifest.web_accessible_resources.matches` 为 `https://www.plasmo.com/*` —— Plasmo 模板残留，无实际用途，可清理。
- `pnpm-workspace.yaml` 里的 `onlyBuiltDependencies` 已被 pnpm 11 移除（`allowBuilds` 取代），属死配置，可删。
- 补 `.github/dependabot.yml`（见 P1-6）。

---

## 建议执行顺序

**第一批（低风险、消真实缺陷）—— 已完成 2026-09-15**

1. ~~P0-1 域名匹配修复 + 单元测试~~（2 处，已修复，15 个用例）
2. ~~P0-2 Markdown 消毒~~（已修复，20 个用例，覆盖预览与发布载荷）
3. ~~P1-2 husky 钩子接线~~（已修复并实测验证）
4. ~~P2-6 补齐英文语言包 3 个 key~~（已修复，缺失归零）
5. 顺带完成 P1-1 的起步（vitest + jsdom + CI 接入）

> 本文档现在可以安全提交：P0-1 / P0-2 均已修复。

**第二批（把质量闸门建起来）—— 已完成 2026-09-15（除注明待办外）**

6. ~~P1-7 动态适配器转义修复~~（已修复，含无依赖模块拆分与守护测试）
7. P1-4 CI 加类型检查（已修复，实测当前 0 错误可直接门禁）；P1-3 分步开启 `strictNullChecks` —— **待办**（真正的类型收益在这里，需先评估错误量）
8. ~~P1-5 `packageManager` / `.nvmrc`~~（已完成；`engines` 经实测不可用，原因见该条）
9. ~~P1-6 分支保护 + Dependabot~~（已完成；Dependabot security alerts 待你在网页开启）
10. ~~语言包键覆盖检查接入 CI~~（已完成，并借它查出并修复 3 个缺陷）
11. P1-1 继续补纯函数单测：话题转换与标题截断**已完成**；Markdown 往返、平台分组**待办**

**第三批（体积与可观测性）—— 已完成 2026-09-15（除注明外）**

12. ~~P2-1 重库动态导入~~（已完成：options 首包 4191 → 1845 KB）；~~P2-2 popup 瘦身~~（369 → 139 KB）；~~P2-3 图标压缩~~（**PNG 部分**完成：872 → 684 KB；ICO 402 KB 待办）
13. ~~P0-3 logger 落地~~（已完成：迁移 2311 处，src 内 console 归零）
14. P2-5 依赖清理（已移除 `uuid` / `@iconify/react`）；P2-4 wasm 可选件 —— **待办**（已查证失败模式，需实机验证扫描版 PDF 后再启用，见该条）
15. P3 中的低风险小升级：`pdfjs-dist` / `marked` / `turndown` —— 已有 Dependabot 自动开 PR（`pdfjs-dist` 6.3.289、`tailwindcss` 3.4.19、prod-patch 组均已过 CI）

**第四批（大版本与生态）**

16. P3 大版本升级（React 19 / HeroUI 3 / Tailwind 4 / TS / Biome），一次一个；
17. P4 商店上架 + `PRIVACY.md` / `SECURITY.md` + 权限收窄（需实机验收）。

---

## 附录 A · 审计数据与复现命令

以下命令均在仓库根目录执行（`/media/luskyle/DATA/project/pupu`）。

```bash
# 代码规模
find src -type f | wc -l
find src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec cat {} + | wc -l

# 测试与钩子
grep -nE '"test' package.json                # 无输出 = 无测试脚本
find src -name '*.test.*' -o -name '*.spec.*' # 无输出 = 无测试文件
git config core.hooksPath && ls -a .husky     # .husky 下只有 _ = 钩子未接线

# 类型安全
node -e "console.log(require('./node_modules/plasmo/templates/tsconfig.base.json').compilerOptions.strict)"
grep -rnE ':\s*any\b|as any' src/ | wc -l

# 日志与消毒
grep -rn 'console\.log' src/ | wc -l
grep -rn 'dangerouslySetInnerHTML' src/

# 产物体积
du -sh build/chrome-mv3-prod
find build/chrome-mv3-prod -maxdepth 1 -name '*.js' -printf '%s\t%f\n' | sort -rn | head
find build/chrome-mv3-prod/assets/platforms -type f -printf '%s\t%f\n' | sort -rn | head

# 依赖引用关系与死代码
for p in docx-preview jspdf html2canvas html-to-image video-react uuid @iconify/react; do
  echo "$p: $(grep -rF "from \"$p" src/ | wc -l)"
done
grep -rn 'docx' src/                          # utils/docx.ts 无任何引用

# 语言包覆盖
node -e "const zh=require('./locales/zh_CN/messages.json'),en=require('./locales/en/messages.json');console.log('缺失:',Object.keys(zh).filter(k=>!(k in en)))"

# 依赖版本对照
for p in react @heroui/react tailwindcss typescript @biomejs/biome pdfjs-dist; do
  echo "$p: $(npm view $p version)"
done

# 仓库设置
gh api repos/luskyle/pupu/branches/main/protection   # 404 = 无分支保护
gh api repos/luskyle/pupu --jq '.security_and_analysis'
```

### 本轮修复的验证命令

```bash
pnpm test          # 35 个单测（域名匹配 + HTML 消毒）
pnpm lint          # Biome（196 文件）
pnpm build:ci      # 构建：确认新代码可打包
pnpm verify:crx    # 校验 CRX3 签名与包内内容

# 确认测试文件没有被打进产物
grep -rl 'domain-match.test\|vitest' build/chrome-mv3-prod/ || echo "未泄漏"

# 确认 husky 钩子真的会触发（与 git 的调用路径一致）
sh .husky/_/commit-msg <(printf 'bad message')   # 期望 exit=1
sh .husky/_/pre-commit                            # 期望 exit=0
```

**未验证项（需实机验收）**：P0-1 修复后在设置页用 `*.pupu.app` 验证同后缀域名被拒；P0-2 修复后从 URL 导入含内联 HTML 的文章并发布；P2-1 动态导入后**首次导入 PDF / PPT 是否正常**（分包按需加载）；P2-4 剔除 wasm 兜底件后的扫描版 PDF 渲染；P3 大版本升级后的界面与发布流程；P4-2 收窄权限后的平台适配。

---

## 附录 B · 第三批新增的验证命令

```bash
# 三类静态验证
pnpm typecheck                                            # 迁移 2311 处日志后仍为 0 错误
pnpm test                                                 # 76 个用例（含 logger 分级门禁、图标一致性）
grep -rl "process.env.NODE_ENV" build/chrome-mv3-prod/     # 应为空；否则 service worker 里会 process is not defined

# 动态分包是否正确接线（无浏览器时可做的检查）
O=$(find build/chrome-mv3-prod -maxdepth 1 -name 'options.*.js' | head -1)
grep -c "pptx\." "$O" ; grep -c "pdf\." "$O"               # 首包应引用分包名
unzip -l build/pupu-v0.2.8.zip | grep -E "pptx\.|pdf\."    # 分包应在包内
grep -q PDFDocumentLoadingTask "$O" && echo "pdfjs 仍在首包" || echo "pdfjs 已移出首包"

# 体积
find build/chrome-mv3-prod -maxdepth 1 -name '*.js' -printf '%s\t%f\n' | sort -rn | head -5
du -sk assets/platforms
```