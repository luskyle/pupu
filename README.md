<div align="center">
  <img src="assets/icon.png" width="200" height="200" alt="pupu Logo" />

  # pupu 🐙

  **v0.2.3**

  > 一款多平台内容发布浏览器扩展，一次编辑，轻松将内容同步发布到多个社交平台。
  > 一次编辑，轻松将内容同步发布到多个社交平台。

  [![Chrome](https://img.shields.io/badge/Chrome%20Extension-MV3-brightgreen)]()
  [![Version](https://img.shields.io/badge/version-0.2.3-blue)]()
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
- 🧑🎨 **账户头像（12 生肖）**：顶栏账户头像按**当前月份显示 12 生肖**（悬停同时显示生肖与星座），账户名「本地用户」；点击头像一键展开侧边栏，在侧边栏中可**刷新账号** / **清空账号缓存**（轻量弹窗二次确认）
- 🔄 **刷新账号**：仅点击「刷新账号」才真正抓取各平台账号（打开侧边栏秒开、不自动刷新）；**清空账号缓存后会自动重新刷新一次账号**；列表**已登录平台排最前**、常用平台其次、其余平台折叠收纳；刷新时展示从左到右飞驰的小圆点动画（整组结束后短暂停顿再循环）
- 💨 **轻量弹窗**：提示 / 确认 / 配置弹窗均为**纯 CSS 轻量弹窗**（淡入缩放 + 退场动画），不依赖重型动画库、不渲染到文档根，弹出跟手流畅不卡顿
- 🎨 **可爱 Logo**：紫色章鱼形象（来自 Twemoji，CC BY 4.0）

## ⏸️ 暂时屏蔽的功能

以下功能由于效果 / 稳定性暂不理想，已从界面中暂时屏蔽（相关代码与依赖保留，便于后续恢复）：

- 🎬 **动态发视频**：动态 Tab 的「添加视频」入口已屏蔽（动态视频发布流程尚不稳定），仅保留图片
- 📄 **Word/WPS 导入**：动态导入 Word/WPS 转图片功能已屏蔽（渲染效果不佳），PPT / PDF 导入保留
- 😆 **在线表情包（GIF）**：动态的在线 GIF 表情包搜索 / 插入功能已屏蔽（在线源稳定性不足），emoji 面板与颜文字保留
- 🔗 **插入链接**：动态内容工具栏的「插入链接」功能已屏蔽，`#` 话题与 emoji 保留

## 🚀 快速开始

### 开发

```bash
pnpm install
pnpm dev        # 启动 Plasmo 开发模式（热更新）
```

### 构建

```bash
pnpm build      # 版本号 +1 → 构建 → 复制 PDF worker / 平台图标 → 打包 zip
```

构建产物位于 `build/chrome-mv3-prod/`，可在浏览器扩展管理页「加载已解压的扩展程序」中导入；
打包后的压缩包为 `build/pupu-v<version>.zip`。

> ⚠️ 构建后会自动执行 `scripts/copy-pdf-worker.mjs`（复制 PDF worker 与离线平台图标到产物），
> 若直接用 `npx plasmo build` 则需手动补跑，否则 PDF 转图片与平台图标会缺失。

### 代码检查

```bash
pnpm lint       # 代码检查
pnpm lint:fix   # 自动修复
pnpm format     # 格式化
```

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
