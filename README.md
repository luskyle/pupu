<div align="center">
  <img src="assets/icon.png" width="200" height="200" alt="pupu Logo" />

  # pupu 🐙

  > 一款多平台内容发布浏览器扩展，一次编辑，轻松将内容同步发布到多个社交平台。

  [![CI](https://github.com/luskyle/pupu/actions/workflows/ci.yml/badge.svg)](https://github.com/luskyle/pupu/actions/workflows/ci.yml)
  [![Release](https://github.com/luskyle/pupu/actions/workflows/release.yml/badge.svg)](https://github.com/luskyle/pupu/actions/workflows/release.yml)
  [![Deploy Pages](https://github.com/luskyle/pupu/actions/workflows/pages.yml/badge.svg)](https://github.com/luskyle/pupu/actions/workflows/pages.yml)
  [![Latest Release](https://img.shields.io/github/v/release/luskyle/pupu?color=7c5cff)](https://github.com/luskyle/pupu/releases/latest)
  [![Chrome](https://img.shields.io/badge/Chrome%20Extension-MV3-brightgreen)](https://github.com/luskyle/pupu/releases/latest)
  [![License](https://img.shields.io/github/license/luskyle/pupu)](./LICENSE)

   **官网 / 文档**：<https://luskyle.github.io/pupu/> · 📦 **下载**：<https://github.com/luskyle/pupu/releases/latest>
</div>

## ✨ 特性

- 🌗 **暗 / 亮主题切换**：默认暗色主题，顶栏一键切换浅色 / 暗色
- 🚀 **自动 / 手动发布**：底部开关一键切换，右侧文字随状态实时显示「自动发布 / 手动发布」；自动发布时填充后直接发布，手动发布则仅填充内容
- 🧭 **极简布局**：动态 / 视频 / 文章三个发布 Tab + 关于页；发布时通过侧边栏选择平台并确认
- 🖼️ **动态**：只填内容即可；支持添加图片、导入 **PPT / PDF**（自动逐页转图片随动态发布）；内容工具栏提供 `#` 话题（支持选中文字一键包裹为 `#话题#`）与 **emoji 分类面板（9 类，含颜文字）**；输入框内 `#话题#` 实时蓝色高亮预览
- 🎬 **视频**：上传视频并发布到支持视频的平台
- 📝 **文章**：导入本地 **Markdown** 并可视化编辑 / 预览渲染，图片随正文一起发布
- 📌 **平台分组**：动态 / 视频 / 文章各自的首选平台单独列出（动态：微博、小红书、知乎、X、脸书；视频：抖音、快手、微信视频号、bilibili、微博、小红书、Youtube；文章：微信公众号、知乎、CSDN、51CTO），其余平台归入「其它」
- 🗂️ **侧边栏联动**：侧边栏显示当前编辑类型的平台列表，切换 Tab 实时跟随；切到「关于」页时自动关闭侧边栏
- 🖼️ **平台图标离线化**：各平台图标内置本地，国内平台按流量池排序置前
- 🧠 **平台细节适配**：如发布到小红书时自动将 `#话题#` 转为小红书格式 `#话题[话题]#`，标题超过 20 字自动跳过标题
- 🧑‍🎨 **账户头像（12 生肖）**：顶栏账户头像按**当前月份显示 12 生肖**（悬停同时显示生肖与星座），账户名「本地用户」；点击头像一键展开侧边栏，在侧边栏中可**刷新账号** / **清空账号缓存**（轻量弹窗二次确认）
- 🔄 **刷新账号**：仅点击「刷新账号」才真正抓取各平台账号（打开侧边栏秒开、不自动刷新）；**清空账号缓存后会自动重新刷新一次账号**；列表**已登录平台排最前**、常用平台其次、其余平台折叠收纳；刷新时展示从左到右飞驰的小圆点动画（整组结束后短暂停顿再循环）
- 💨 **轻量弹窗**：提示 / 确认 / 配置弹窗均为**纯 CSS 轻量弹窗**（淡入缩放 + 退场动画），不依赖重型动画库、不渲染到文档根，弹出跟手流畅不卡顿
- 🎨 **可爱 Logo**：紫色章鱼形象（来自 Twemoji，CC BY 4.0）

## ⏸️ 暂时屏蔽的功能

以下功能由于效果 / 稳定性暂不理想，已从界面中暂时屏蔽（相关代码与依赖保留，便于后续恢复）：

- 🎬 **动态发视频**：动态 Tab 的「添加视频」入口已屏蔽（动态视频发布流程尚不稳定），仅保留图片
- 📄 **Word/WPS 导入**：动态导入 Word/WPS 转图片功能已屏蔽（渲染效果不佳），PPT / PDF 导入保留
- 😆 **在线表情包（GIF）**：动态的在线 GIF 表情包搜索 / 插入功能已屏蔽（在线源稳定性不足），emoji 面板与颜文字保留
- 🔗 **插入链接**：动态内容工具栏的「插入链接」功能已屏蔽，`#` 话题与 emoji 保留

## 📦 安装使用

**安装方式：下载 `.zip` 并「加载已解压的扩展程序」**

1. 到 [Releases](https://github.com/luskyle/pupu/releases/latest) 下载 `pupu-v<version>.zip` 并解压（解压后目录中应能看到 `manifest.json`）
2. 打开 `chrome://extensions`（Edge 为 `edge://extensions`），开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」，选择解压出的目录

> **为什么没有 `.crx`？** 自签名 CRX **无法**通过拖拽或普通安装流程安装：Chromium 会校验 CRX 里的
> proof 是否由 Chrome 应用商店的私钥签名，否则报 `CRX_REQUIRED_PROOF_MISSING`（依据见 Chromium
> `crx_verifier.cc`：off-store 的 CRX 按 `CRX3_WITH_PUBLISHER_PROOF` 校验）。这与我们怎么打包无关，
> 加 manifest 的 `key` 字段或 `update_url` 都不解决。唯一可用的 CRX 路径是**机器级强制企业策略**
> （`ExtensionInstallAllowlist` + `ExtensionInstallSources`），普通用户请用上面的 zip 方式；
> 想彻底摆脱「开发者模式」，唯一途径是上架 Chrome Web Store / Edge 加载项商店。

> - 扩展 ID：**`nffpajdealkjpdmjjboneelajanbboig`**（由签名密钥决定，各版本固定不变；将来上架商店需沿用同一密钥）
> - Edge 与 Chrome 同为 Chromium，使用同一份 `.zip`，无需分别下载
> - 安装需要开启「开发者模式」：这是不经过应用商店安装的浏览器限制，与扩展本身无关
> - Safari 暂不支持：Safari 扩展必须由 Xcode 打包成 App 分发，且本扩展依赖的 `sidePanel` / `tabGroups` 在 Safari 上并不存在

> 更详细的安装、使用与常见问题见 **在线文档**：<https://luskyle.github.io/pupu/guide.html>

## 🚀 快速开始

### 开发

```bash
pnpm install
pnpm dev        # 启动 Plasmo 开发模式（热更新）
```

### 构建

```bash
pnpm build      # 本地构建：只产出可「加载已解压」的目录（不出 zip / crx）
pnpm build:ci   # 构建并打包 zip（CI 使用）
pnpm package    # 只把已构建的产物打包成 zip
pnpm crx        # 只打包 CRX（自托管/企业策略场景用，需签名密钥；不能拖拽安装）
pnpm verify:crx # 校验 CRX3 签名与包内内容
```

**本地构建刻意不产出 zip / crx**（那些由 CI 生成并附加到 Release），只输出 `build/chrome-mv3-prod/`，
在扩展管理页「加载已解压的扩展程序」中直接导入即可；需要本地打包时用 `pnpm build:ci`。

> 🔑 CRX 签名密钥决定扩展 ID，若将来要做企业策略自托管或上架商店，必须沿用同一密钥：本地放
> `keys/pupu.pem`（已被 `.gitignore` 忽略），CI 从仓库 Secret `CRX_PRIVATE_KEY` 读取。
> **没有密钥时 `pnpm crx` 会跳过而不是自动生成新密钥** —— 新密钥意味着新扩展 ID。生成方式：
>
> ```bash
> openssl genrsa -out keys/pupu.pem 2048
> gh secret set CRX_PRIVATE_KEY < keys/pupu.pem
> ```
>
> 注意：Release **不再附带 CRX**（自签名 CRX 无法安装，见上文「为什么没有 .crx」）。
> CRX 的打包能力仍由 CI 用**临时密钥**做冒烟测试，保证这条路径不会失效。

> ⚠️ 构建后会自动执行 `scripts/copy-pdf-worker.mjs`（复制 PDF worker、PDF 图像解码器 WASM 与离线平台图标到产物），
> 若直接用 `npx plasmo build` 则需手动补跑，否则 PDF 转图片与平台图标会缺失。

### 代码检查与测试

```bash
pnpm lint       # 代码检查（Biome）
pnpm lint:fix   # 自动修复
pnpm format     # 格式化
pnpm typecheck  # 类型检查（tsc --noEmit）
pnpm test       # 单元测试（vitest）
pnpm test:watch # 单元测试（watch 模式）
```

> **不要往 `package.json` 里加 `engines` 字段。** Parcel 会把 `engines` 当作构建 targets 读取，
> 加了之后扩展构建会直接失败（`Failed to resolve '../../src/options/index.tsx'`），
> 因为整份产物会按 Node 目标去解析。Node 版本请用 `.nvmrc` 声明（当前为 24）。
>
> ⚠️ 需要浏览器专有的工具模块（带 `chrome.*`、依赖 DOM 的）保持**按需引入**：
> 平台适配器只做「文本 + 自建标签」拼接时，请从 `~utils/escape-html` 这类无依赖模块导入，
> 不要从 `~utils/sanitize`（它会带上 DOMPurify 与 marked，约 70 KB）导入。
> 详见 `OPTIMIZATION.md` 的 P2-1。

## 🔁 CI / CD

仓库内置三条 GitHub Actions 工作流（见 `.github/workflows/`）：

| 工作流 | 触发条件 | 作用 |
| --- | --- | --- |
| [`CI`](.github/workflows/ci.yml) | push 到 `main`、PR、手动 | `pnpm install` → `pnpm lint` → `pnpm typecheck` → `pnpm test` → `pnpm build:ci`，校验产物（manifest 版本、PDF worker、WASM、平台图标），并用临时密钥打包 CRX 做冒烟测试，最后上传 zip 与解压目录为构建产物 |
| [`Release`](.github/workflows/release.yml) | 推送 `v*` 标签、手动 | 校验标签与 `package.json` 版本一致 → `lint` + `typecheck` + `test`（发布前自证）→ 构建 → 校验产物 → 创建 GitHub Release（**只附 zip**，不再附 CRX）→ 触发站点重部署以同步站点版本号 |
| [`Deploy Pages`](.github/workflows/pages.yml) | push 到 `main` 且改动 `docs/**`、发布后自动触发、手动 | 注入最新版本号到 `docs/` 并部署到 GitHub Pages（官网与文档站） |

### 发布一个新版本

**先改版本号并提交，再打标签**（顺序不能反 —— 扩展内「关于」页显示的版本取自构建时的 manifest，而 manifest 版本来自 `package.json`；标签与 `package.json` 不一致时发布流程会直接失败）：

```bash
pnpm pkg set version=0.2.10        # 改成要发布的版本
git commit -am "chore(release): 0.2.10"
git push origin main
git tag v0.2.10 && git push origin v0.2.10
```

推送标签后会自动构建并发布 Release（附件为 `pupu-v<version>.zip`）；也可以在 Actions 页面手动运行 `Release` 工作流并填写版本号（留空则使用 `package.json` 中的版本号），工作流会自动创建对应标签（手动触发时不做一致性校验，会按填写值同步）。

**版本号会显示在这几处，均已自动化，无需手工同步**：

| 位置 | 来源 |
| --- | --- |
| 扩展内「关于」页 | 构建时 manifest（即 `package.json`） |
| 官网 / 文档站 | 部署时由 `scripts/inject-site-version.mjs` 从**最新 `v*` 标签**注入静态兜底值，页面再用 GitHub API 覆盖为最新 release |
| README 徽章 | shields 动态读取最新 release |

> 🔐 Release 已不再需要 `CRX_PRIVATE_KEY`（不再产出 CRX）；该 Secret 与 `keys/pupu.pem` 建议保留 ——
> 将来做企业策略自托管或上架商店时必须沿用同一密钥，否则扩展 ID 会变、已安装用户收不到更新。

> ℹ️ 官网与文档站部署需要一次性在仓库 **Settings → Pages** 将 **Source** 设为 **GitHub Actions**。

## 🧱 技术栈

- [Plasmo](https://www.plasmo.com/) — 浏览器扩展框架（Chrome MV3）
- [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/) + [HeroUI](https://heroui.com/)
- [marked](https://github.com/markedjs/marked) / [turndown](https://github.com/mixmark-io/turndown) — Markdown 与 HTML 互转
- [pptx-preview](https://github.com/Zoomdata-Inc/pptx-preview) — PPT 渲染逐页转图
- [pdfjs-dist](https://github.com/mozilla/pdfjs-dist) — PDF 逐页渲染转图
- [html-to-image](https://github.com/bubkoo/html-to-image) / [html2canvas](https://html2canvas.hertzen.com/) — 页面截图
- [lucide-react](https://lucide.dev/) — 界面图标
- [react-viewer](https://github.com/infeng/react-viewer) — 图片大图预览

## 🙏 致谢

- [luskyle](https://github.com/luskyle) — pupu 的开发者
- [Twemoji](https://github.com/twitter/twemoji) — Logo 章鱼图标（CC BY 4.0）

## 👤 作者

[luskyle](https://github.com/luskyle)

---

> ⚠️ 本项目为个人学习 / 交流项目，请遵守各平台的使用规范与当地法律法规。