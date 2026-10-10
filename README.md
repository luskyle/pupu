<div align="center">
  <img src="assets/icon.png" width="200" height="200" alt="pupu Logo" />

  # pupu 🐙

  > 多平台内容发布扩展 + 本地 Agent 桌面工作台，一次编辑，减少重复操作。

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

### 桌面 Agent 实验版

Linux x64 用户可直接从 [Releases](https://github.com/luskyle/pupu/releases/latest) 下载
`pupu-desktop-v<version>-linux-x64.tar.gz`，解压完整目录后运行 `pupu-linux-x64/pupu`。
Ollama 和模型需要单独安装，不包含在归档内。Windows/macOS 尚未提供发行包。
本次版本详情见 [v0.3.0 更新说明](docs/releases/v0.3.0.md)。

除原扩展外，现有独立 Electron 工作台：本地草稿、图片选择、隔离的小红书登录窗口、
Ollama 标题候选决策、自动上传、受控填写、回读核验、自动提交与成功回执检查。
不需要加载浏览器扩展。**仅试点小红书图文，不代表原扩展全部平台已迁移。**

日常使用只需：**写标题和正文 → 添加图片 → 在平台窗口登录并确认账号 →
点击「让 Agent 自动发布」→ 确认本次任务**。观察字段和本地模型设置已收进内部流程/高级设置。
确认后 Agent 自动执行，不需要再到网页点击发布。遇到登录、验证码、编辑器或发布入口不明确时暂停，
停止无法撤销已经提交的内容；提交后结果不明时不会自动重发，需在平台内容管理核对。
自动发布按钮只在执行任务时禁用；缺少标题、正文、图片或本地模型时，点击会显示具体原因，
按钮下方也显示准备提示。图片选择目前不持久化，重启应用后需重新添加，草稿文字仍会恢复。

```bash
pnpm install
pnpm desktop:dev       # 构建并打开工作台
pnpm desktop:typecheck
pnpm desktop:smoke     # 无模型 Chromium / preload / IPC 冒烟，CI 使用
pnpm desktop:verify    # 真 Electron + 真模型 + 本地夹具，成功后自动退出
pnpm desktop:package   # 为当前 OS/CPU 生成独立可执行目录
```

本机已配置的运行时位于 `.local/ollama/bin/ollama`，模型存储在 `.local/models/`，
不进入 Git 或桌面安装包。桌面会自动启动已配置的 Ollama；退出时只关闭自己启动的服务，
不会关闭用户原先运行的 Ollama。运行时配置保存到系统应用数据目录的 `pupu-desktop/runtime.json`。
移动仓库或更换电脑后，请重新指定绝对路径：

```bash
node scripts/configure-desktop-runtime.mjs /absolute/path/to/ollama /absolute/path/to/models
```

其他电脑需先安装 [Ollama](https://ollama.com/download)，在工作台「选择 Ollama」后点击
「下载 Qwen3 4B」，或连接已运行于 `127.0.0.1:11434` 的服务并安装 `qwen3:4b`。
权重约 2.5 GB，模型首次启动可能较慢；应用不会向云端发送字段、正文或图片。
模型下载本身需要联网，小红书网页也需要联网。

验证方式：

1. 打开工作台，顶部显示「本地 Agent 已就绪」。
2. 输入 1–20 字标题和正文，打开「高级设置与本地演示」。
3. 点击「用当前内容演示自动发布」，确认本地模拟任务（不会联网发布）。
4. Agent 自动选择作品名称、填写文字、点击一次模拟发布，并等到成功回执。
   `desktop:verify` 还验证 closed shadow DOM、图片上传、覆盖保护、重复提交保护与界面发布链路，
   并输出 `build/desktop/verification.json` 与两张截图。
5. 打包后的 Linux 入口为 `build/desktop-release/pupu-linux-x64/pupu`；
   该入口也支持 `--verify`，报告写入系统应用数据目录的 `pupu-desktop/verification/`。
   分发时须保留整个可执行目录，而非只复制入口文件。

真实小红书需要在独立平台窗口**重新登录**，不读取 Chrome 的登录 Cookie；
账号登录后重启应用仍可保留。Agent 尝试自动选择「上传图文」并向唯一图片文件入口上传，
同一入口的外层按钮/tab 与内部文字会去重；已选中图文或已进入可识别的图文编辑器时不重复切换。
入口可见性包含父容器与 shadow host 的隐藏状态；真正存在歧义时错误会列出候选标签、class 和位置，
不包含正文或账号信息，方便根据实际页面排查。
已在真实小红书页面确认存在屏幕外与近透明的重复入口；筛选会排除视口外和父容器透明度低于 0.01 的副本。
真实平台已实测选择图文、上传测试图片、标题/正文填写及异步回读、发布按钮可用状态；
未点击真实发布按钮，最终提交及成功回执仍未实测。
准备阶段同一创作编辑路径的图文/视频查询参数切换会等待页面加载并重新观察，不再误报需要登录。
进入填写阶段后，导航仍会停止任务并丢弃旧目标。可用桌面入口的 `--check-navigation` 实测已登录平台
从视频切到图文时任务不中止（不上传、不填写、不提交）。
等待编辑器就绪、填写并回读，待唯一发布按钮可用后核对文字并提交一次。
平台显示明确的成功提示才算发布成功；不通过页面跳转或按钮被点击来猜测成功。
支持普通 DOM 及通过 Chromium 调试协议读取的 open/closed shadow DOM；
工具填写后，富文本编辑器隐藏空段落占位提示不会误判为目标失效；仍要求同一节点、字段身份未改、
文字与本次写入完全一致。重渲染替换节点时仅重新绑定同一文档/shadow root 内唯一、同身份且全文一致的字段，
不重新填写。无法唯一核对、标签变化或文字不一致仍会停止，不跳过提交前核验。
调试协议使用后端节点 ID；解析 shadow root 时遇到节点失效，只在执行页面动作前最多重新观察两次。
填写、上传和提交命令不会因通信错误自动重放，防止重复副作用。
不支持 iframe、验证码自动化；页面结构不支持时会停止，不能据夹具结果
宣称真实平台已验收。Windows/macOS 使用相同代码，但尚需对应系统构建、签名与实际验证；
这不是手机 App，移动端协作仍属于后续方案。

发行流程同时生成扩展 ZIP、Linux 桌面 tar.gz 和 `SHA256SUMS`；
桌面产物冒烟通过后才创建 Release，发布完成后触发 Pages 部署。
CI 不下载模型，真实 Qwen3 验收仍用 `desktop:verify`；Pages 的静态版本取自已发布 Release。

### 开发

```bash
pnpm install
pnpm dev        # 启动 Plasmo 开发模式（热更新）
```

### 构建

```bash
pnpm build         # 本地构建：只产出可「加载已解压」的目录（不出 zip / crx）
pnpm check:version # 检查本地产物/源码是否落后于最新发布（build 结束时也会自动跑）
pnpm build:ci      # 构建并打包 zip（CI 使用）
pnpm package       # 只把已构建的产物打包成 zip
pnpm crx           # 只打包 CRX（自托管/企业策略场景用，需签名密钥；不能拖拽安装）
pnpm verify:crx    # 校验 CRX3 签名与包内内容
```

**本地构建刻意不产出 zip / crx**（那些由 CI 生成并附加到 Release），只输出 `build/chrome-mv3-prod/`，
在扩展管理页「加载已解压的扩展程序」中直接导入即可；需要本地打包时用 `pnpm build:ci`。

> ⚠️ **本地产物不会自动跟随新发布**：`pnpm build` 用的是 `package.json` 的版本号，所以本地产物会停在
> 「上次构建时」的版本 —— 如果之后又发了新版本（或你在旧 commit 上构建），浏览器里加载它时「关于」页会
> 显示旧版本号。`pnpm build` 结束时会自动做一次检查，落后就会醒目提示；也可随时手动执行
> `pnpm check:version`。重新构建一次即可对齐。

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

## 🧭 演进方案

- [本地决策 Agent 设计方案](docs/agent-design.md)：借鉴 Jev 的有限选项决策思路，以小红书标题定位为试点，说明本地模型接入、受控执行、跨平台演进与验收标准。已实现首个实验原型，完整验收尚未完成。

### 本地 Agent 实验原型

默认关闭。在「关于」页的「本地 Agent」中启用，填写 Ollama 模型名称，点击「保存并测试连接」。
需要自行安装支持该模型和结构化输出的 Ollama，并下载模型，例如：

```bash
ollama pull qwen3:4b
ollama serve # 已有服务运行时无需再启动
```

扩展只访问 `http://127.0.0.1:11434`，不自动下载模型、不调用云端。如果服务拒绝扩展来源，
将当前扩展的 `chrome-extension://<扩展 ID>` 加入 Ollama 的 `OLLAMA_ORIGINS` 并重启服务；
不要配置通配来源或把服务监听地址改成公网地址。

- 仅小红书图文参与试点，启用后该平台**只填充、不自动提交**，其他平台保持原模式。
- 唯一明确的标题字段直接填写；否则本地模型只能选择当前候选 ID 或 `none`。
- 模型只接收字段类型、标签和占位文字，不接收正文、图片、字段当前值或账号凭据。
- 写入前拒绝覆盖不同的已有内容，并检查字段是否失效；写入后回读核验。
- 页面右下角显示阶段与停止按钮；停止不会自动撤销已有填写。失败时显示原因，由用户手动处理。
- 当前智能定位只支持普通 DOM 与 open shadow DOM 中的原生 input/textarea；
  closed shadow DOM、iframe 和富文本标题不支持智能填写，遇到时明确停止。
- 上传和正文仍沿用平台适配；其完成状态不是整个作品发布成功的证据，最后必须检查账号、素材和正文。

连接测试只验证服务与有限选择格式，不证明真实平台适配成功。当前未完成真实账号、
真实本地模型及设计方案中 100 场景的验收，不应作为稳定版全自动 Agent 宣传。

## 🙏 致谢

- [luskyle](https://github.com/luskyle) — pupu 的开发者
- [Twemoji](https://github.com/twitter/twemoji) — Logo 章鱼图标（CC BY 4.0）

## 👤 作者

[luskyle](https://github.com/luskyle)

---

> ⚠️ 本项目为个人学习 / 交流项目，请遵守各平台的使用规范与当地法律法规。