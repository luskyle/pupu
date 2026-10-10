import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, rm, rmdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { net, BrowserWindow, WebContentsView, app, ipcMain, session } from "electron";
import { type WorkspacePlatform, adapterAllowed, object, shouldReveal, webURL } from "./workspace-policy";
import { publishWorkspaceRednote } from "./workspace-rednote";
import { WorkspaceStorage } from "./workspace-storage";

interface PlatformTab {
  id: number;
  initialURL: string;
  view: WebContentsView;
  running: boolean;
  uncertain: boolean;
}
interface MediaAsset {
  file: string;
  size: number;
  written: number;
  type: string;
  ready: boolean;
}

export class WorkspaceHost {
  readonly window: BrowserWindow;
  readonly tabs = new Map<number, PlatformTab>();
  private nextId = 1;
  private selected = 0;
  private batch = false;
  private media = new Map<string, MediaAsset>();
  private mediaBytes = 0;
  private platforms: Record<string, WorkspacePlatform> = {};
  private adapters = "";
  private messages: unknown;
  private version = "";
  private storage: WorkspaceStorage;
  private uiURL: string;
  private allowedFetchHosts = new Set<string>();
  private directory: string;
  private helper = "";
  private xhs = "";
  private cleanupPromise: Promise<void> | undefined;

  constructor(
    private root: string,
    private smoke = false,
  ) {
    this.uiURL = pathToFileURL(path.join(root, "workspace.html")).href;
    this.directory = path.join(app.getPath("temp"), `pupu-media-${process.pid}-${randomUUID()}`);
    this.storage = new WorkspaceStorage(path.join(app.getPath("userData"), "workspace-storage.json"));
    this.window = new BrowserWindow({
      width: 1400,
      height: 920,
      minWidth: 1000,
      minHeight: 680,
      title: "pupu · 多平台内容工作台",
      icon: path.join(root, "icon.png"),
      webPreferences: {
        preload: path.join(root, "workspace-preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    this.window.webContents.on("will-navigate", (event) => event.preventDefault());
    this.window.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith("https://"))
        void this.create(webURL(url)).catch((error) => this.emit({ type: "error", error: String(error) }));
      return { action: "deny" };
    });
    this.window.on("resize", () => this.layout());
    this.window.on("closed", () => {
      for (const tab of this.tabs.values()) tab.view.webContents.close();
      this.tabs.clear();
      void this.cleanup().catch((error) => console.error("清理桌面素材失败", error));
    });
  }

  async start() {
    this.platforms = object(
      JSON.parse(await readFile(path.join(this.root, "workspace-platforms.json"), "utf8")),
    ) as Record<string, WorkspacePlatform>;
    this.adapters = await readFile(path.join(this.root, "workspace-adapters.js"), "utf8");
    this.helper = await readFile(path.join(this.root, "workspace-helper.js"), "utf8");
    this.xhs = await readFile(path.join(this.root, "workspace-xhs.js"), "utf8");
    this.messages = JSON.parse(await readFile(path.join(this.root, "messages.json"), "utf8"));
    this.version = JSON.parse(await readFile(path.join(this.root, "package.json"), "utf8")).version;
    for (const platform of Object.values(this.platforms)) {
      for (const url of [platform.homeUrl, platform.injectUrl]) {
        if (url.startsWith("https://")) this.allowedFetchHosts.add(new URL(url).hostname);
      }
    }
    for (const host of [
      "api.bilibili.com",
      "www.xiaohongshu.com",
      "api.zsxq.com",
      "mp.yiche.com",
      "dy.163.com",
      "om.qq.com",
      "creator.douyin.com",
      "www.tiktok.com",
      "b.alipay.com",
      "creator.autohome.com.cn",
      "creator.dewu.com",
      "mp.dayu.com",
      "yidian.com",
      "pinduoduo.com",
      "video.vivo.com.cn",
      "mp.sohu.com",
    ])
      this.allowedFetchHosts.add(host);
    await this.storage.load();
    if (this.smoke) {
      const fixture = await readFile(path.join(this.root, "workspace-fixture.html"), "utf8");
      const rednote = (await readFile(path.join(this.root, "fixture.html"), "utf8")).replace(
        "作品名称（给读者看到的图文名称）",
        "标题",
      );
      this.platformSession("https://weibo.com").protocol.handle(
        "https",
        (request) =>
          new Response(new URL(request.url).hostname === "creator.xiaohongshu.com" ? rednote : fixture, {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          }),
      );
    }
    for (const target of [
      session.defaultSession,
      this.platformSession("https://weibo.com"),
      this.platformSession("https://creator.xiaohongshu.com"),
    ]) {
      target.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
      target.setPermissionCheckHandler(() => false);
      if (!(await target.protocol.isProtocolHandled("pupu-media"))) {
        target.protocol.handle("pupu-media", (request) => {
          const asset = this.media.get(new URL(request.url).pathname.slice(1));
          if (!asset?.ready) return new Response("素材不存在或未完成", { status: 404 });
          return net.fetch(pathToFileURL(asset.file).href).then(
            (response) =>
              new Response(response.body, {
                headers: {
                  "Content-Type": asset.type || "application/octet-stream",
                  "Access-Control-Allow-Origin": "*",
                },
              }),
          );
        });
      }
    }
    ipcMain.handle("pupu:workspace", async (event, action, data) => {
      if (
        event.sender !== this.window.webContents ||
        event.senderFrame !== this.window.webContents.mainFrame ||
        event.senderFrame.url !== this.uiURL
      )
        return { ok: false, error: "不可信的桌面调用来源" };
      try {
        return { ok: true, data: await this.invoke(action, data) };
      } catch (error) {
        console.error("桌面操作失败", action, error instanceof Error ? error.message : error);
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    });
    await this.window.loadURL(this.uiURL);
  }

  private platformSession(url: string) {
    if (this.smoke) return session.fromPartition(`pupu-workspace-smoke-${process.pid}`);
    return session.fromPartition(
      new URL(url).hostname.endsWith("xiaohongshu.com") ? "persist:pupu-rednote" : "persist:pupu-platforms",
    );
  }
  private emit(data: unknown) {
    if (!this.window.isDestroyed()) this.window.webContents.send("pupu:workspace-event", data);
  }
  private describe(tab: PlatformTab) {
    return {
      id: tab.id,
      windowId: 1,
      active: this.selected === tab.id,
      title: tab.view.webContents.getTitle(),
      url: tab.view.webContents.getURL(),
      status: tab.view.webContents.isLoadingMainFrame() ? "loading" : "complete",
    };
  }
  private tab(id: unknown) {
    if (typeof id !== "number" || !this.tabs.has(id)) throw new Error("平台标签不存在");
    return this.tabs.get(id)!;
  }
  private layout() {
    const [width, height] = this.window.getContentSize();
    for (const tab of this.tabs.values()) {
      tab.view.setBounds({ x: 0, y: 75, width, height: Math.max(0, height - 75) });
      tab.view.setVisible(tab.id === this.selected);
    }
  }
  private async create(url: string) {
    const view = new WebContentsView({
      webPreferences: {
        session: this.platformSession(url),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        backgroundThrottling: false,
      },
    });
    const tab: PlatformTab = { id: this.nextId++, initialURL: url, view, running: false, uncertain: false };
    this.tabs.set(tab.id, tab);
    this.window.contentView.addChildView(view);
    view.setVisible(false);
    const hostname = new URL(url).hostname;
    const source =
      hostname === "creator.xiaohongshu.com"
        ? this.xhs
        : /^(t\.bilibili\.com|bsky\.app|www\.v2ex\.com|v2ex\.com|www\.xiaoheihe\.cn)$/.test(hostname)
          ? this.helper
          : "";
    if (source) {
      await view.webContents.loadURL("about:blank");
      view.webContents.debugger.attach("1.3");
      try {
        await view.webContents.debugger.sendCommand("Page.addScriptToEvaluateOnNewDocument", { source });
      } finally {
        view.webContents.debugger.detach();
      }
    }
    view.webContents.setWindowOpenHandler(({ url: requested }) => {
      if (requested.startsWith("https://")) {
        void view.webContents
          .loadURL(webURL(requested))
          .catch((error) => this.emit({ type: "error", error: String(error) }));
      }
      return { action: "deny" };
    });
    view.webContents.on("will-navigate", (event, requested) => {
      if (!requested.startsWith("https://")) event.preventDefault();
    });
    const updated = () =>
      this.emit({
        type: "updated",
        id: tab.id,
        tab: this.describe(tab),
        change: { status: view.webContents.isLoadingMainFrame() ? "loading" : "complete" },
      });
    view.webContents.on("did-start-loading", updated);
    view.webContents.on("did-stop-loading", updated);
    view.webContents.on("page-title-updated", updated);
    view.webContents.on("did-fail-load", (_event, code, description, _url, mainFrame) => {
      if (mainFrame && code !== -3) this.emit({ type: "error", id: tab.id, error: `平台加载失败：${description}` });
    });
    this.layout();
    if (!this.batch) {
      this.selected = tab.id;
      this.layout();
    }
    this.emit({ type: "updated", id: tab.id, tab: this.describe(tab), change: { status: "loading" } });
    void view.webContents.loadURL(url).catch((error) => this.emit({ type: "error", id: tab.id, error: String(error) }));
    return this.describe(tab);
  }

  private async execute(value: unknown) {
    const request = object(value);
    const tab = this.tab(request.id);
    if (tab.running || tab.uncertain) throw new Error("该标签已有执行或未确认结果；请先核对，不会自动重发");
    if (typeof request.platform !== "string") throw new Error("缺少平台适配器");
    const platform = this.platforms[request.platform];
    if (!platform || !adapterAllowed(platform, tab.initialURL, tab.view.webContents.getURL()))
      throw new Error("当前页面与平台适配器不匹配；请先在平台标签完成登录，再重试");
    const data = object(request.data);
    if (
      !Array.isArray(data.platforms) ||
      !data.platforms.some((item) => object(item).name === request.platform) ||
      typeof data.isAutoPublish !== "boolean" ||
      !data.data
    )
      throw new Error("发布数据无效");
    tab.running = true;
    tab.uncertain = data.isAutoPublish === true;
    const contents = tab.view.webContents;
    if (request.platform === "DYNAMIC_REDNOTE") {
      try {
        const body = object(data.data);
        if (
          typeof body.content !== "string" ||
          (body.title !== undefined && typeof body.title !== "string") ||
          !Array.isArray(body.images)
        )
          throw new Error("小红书图文数据无效");
        const files = body.images.map((image) => {
          const url = object(image).url;
          if (typeof url !== "string" || !url.startsWith("pupu-media://asset/"))
            throw new Error("小红书素材未完成本地传输");
          const asset = this.media.get(new URL(url).pathname.slice(1));
          if (!asset?.ready || !asset.type.startsWith("image/")) throw new Error("小红书素材不是可用图片");
          return asset.file;
        });
        if (
          body.tags !== undefined &&
          (!Array.isArray(body.tags) || !body.tags.every((tag) => typeof tag === "string"))
        )
          throw new Error("话题数据无效");
        const result = await publishWorkspaceRednote(
          contents,
          {
            title: typeof body.title === "string" ? body.title : "",
            content: body.content,
            tags: (body.tags || []) as string[],
            files,
            auto: data.isAutoPublish,
          },
          (message) => this.emit({ type: "progress", id: tab.id, message }),
        );
        return { ...result, textVerified: true };
      } finally {
        tab.running = false;
      }
    }
    if (contents.debugger.isAttached()) {
      tab.running = false;
      throw new Error("平台调试器已占用");
    }
    try {
      contents.debugger.attach("1.3");
      const { frameTree } = await contents.debugger.sendCommand("Page.getFrameTree");
      const { executionContextId } = await contents.debugger.sendCommand("Page.createIsolatedWorld", {
        frameId: frameTree.frame.id,
        worldName: "pupu-desktop-adapters",
        grantUniveralAccess: true,
      });
      const source = `${this.adapters}\n(async () => {
        const info = pupuWorkspaceAdapters.platforms[${JSON.stringify(request.platform)}];
        if (!info) throw new Error("平台适配器不存在");
        const errors = [];
        const previous = pupuWorkspaceAdapters.logger.error;
        pupuWorkspaceAdapters.logger.error = (...values) => {
          errors.push(values.map(value => value?.message || String(value)).join(" "));
          previous(...values);
        };
        try {
          const request = ${JSON.stringify(data)};
          await info.injectFunction(request);
          const normalize = text => String(text || "").replace(/\\s+/g, " ").trim();
          const fields = [...document.querySelectorAll('input, textarea, [contenteditable="true"]')]
            .map(element => normalize(element.value ?? element.textContent));
          const html = new DOMParser().parseFromString(request.data.htmlContent || "", "text/html");
          const title = normalize(request.data.title);
          const body = normalize(request.data.content ?? html.body.textContent);
          const textVerified = Boolean(title || body) &&
            (!title || fields.some(value => value.includes(title))) &&
            (!body || fields.some(value => value.includes(body)));
          if (errors.length) throw new Error(errors.join("; "));
          return { completed: true, textVerified };
        } finally {
          pupuWorkspaceAdapters.logger.error = previous;
        }
      })()`;
      const result = await contents.debugger.sendCommand("Runtime.evaluate", {
        expression: source,
        contextId: executionContextId,
        awaitPromise: true,
        returnByValue: true,
      });
      if (result.exceptionDetails)
        throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    } catch (error) {
      tab.uncertain = data.isAutoPublish === true;
      throw error;
    } finally {
      if (contents.debugger.isAttached()) contents.debugger.detach();
      tab.running = false;
    }
  }

  async invoke(action: unknown, value?: unknown): Promise<unknown> {
    switch (action) {
      case "config":
        return { version: this.version, messages: this.messages };
      case "batch":
        if (typeof value !== "boolean") throw new Error("任务状态无效");
        this.batch = value;
        return undefined;
      case "create":
        return this.create(webURL(object(value).url));
      case "get":
        return this.describe(this.tab(value));
      case "query":
        return [...this.tabs.values()].map((tab) => this.describe(tab));
      case "select":
        if (value !== 0) this.tab(value);
        this.selected = value as number;
        this.layout();
        this.emit({ type: "selected", id: value });
        return undefined;
      case "update": {
        const request = object(value);
        const update = object(request.properties);
        const tab = this.tab(request.id);
        if (update.url) {
          if (tab.running || tab.uncertain) throw new Error("执行中或结果未确认，禁止重新加载并重发");
          const url = webURL(update.url);
          tab.initialURL = url;
          void tab.view.webContents.loadURL(url).catch((error) => this.emit({ type: "error", error: String(error) }));
        }
        if (shouldReveal(update, this.batch)) {
          this.selected = tab.id;
          this.layout();
          this.emit({ type: "selected", id: tab.id });
        }
        return this.describe(tab);
      }
      case "reload": {
        const tab = this.tab(value);
        if (tab.running || tab.uncertain) throw new Error("请先核对当前任务，禁止自动重发");
        tab.view.webContents.reload();
        return undefined;
      }
      case "remove": {
        const ids = Array.isArray(value) ? value : [value];
        for (const id of ids) {
          const tab = this.tab(id);
          this.window.contentView.removeChildView(tab.view);
          tab.view.webContents.close();
          this.tabs.delete(tab.id);
          if (this.selected === tab.id) this.selected = 0;
          this.emit({ type: "removed", id });
        }
        this.layout();
        return undefined;
      }
      case "group":
        return 1;
      case "badge":
        if (typeof value !== "string") throw new Error("徽标无效");
        this.window.setTitle(value ? `pupu · ${value} 个平台失败，请查看发布结果` : "pupu · 多平台内容工作台");
        return undefined;
      case "execute":
        return this.execute(value);
      case "storageGet": {
        const request = object(value);
        return this.storage.get(request.area, request.keys);
      }
      case "storageSet":
      case "storageRemove":
      case "storageClear": {
        const request = object(value);
        let values = action === "storageSet" ? object(request.values) : {};
        if (action !== "storageSet") {
          const keys =
            action === "storageClear"
              ? Object.keys(this.storage.area(request.area))
              : typeof request.keys === "string"
                ? [request.keys]
                : request.keys;
          if (!Array.isArray(keys) || !keys.every((key) => typeof key === "string")) throw new Error("存储键无效");
          values = Object.fromEntries(keys.map((key) => [key, undefined]));
        }
        const changes = await this.storage.change(request.area, values, action !== "storageSet");
        this.emit({ type: "storage", area: request.area, changes });
        return undefined;
      }
      case "fetch": {
        const request = object(value);
        const url = webURL(request.url);
        if (!this.allowedFetchHosts.has(new URL(url).hostname)) throw new Error("该地址不在平台账号请求白名单");
        if (request.method !== "GET" && request.method !== "POST" && request.method !== "HEAD")
          throw new Error("不支持的请求方法");
        const response = await this.platformSession(url).fetch(url, {
          method: request.method,
          headers: request.headers as [string, string][],
          body: typeof request.body === "string" ? request.body : undefined,
          redirect: "error",
          signal: AbortSignal.timeout(30_000),
        });
        return { status: response.status, body: await response.text(), headers: [...response.headers.entries()] };
      }
      case "cookies": {
        const filter = object(value);
        const results = await Promise.all([
          this.platformSession("https://weibo.com").cookies.get(filter),
          this.platformSession("https://creator.xiaohongshu.com").cookies.get(filter),
        ]);
        return results.flat();
      }
      case "removeCookie": {
        const request = object(value);
        if (typeof request.url !== "string") throw new Error("Cookie 地址无效");
        const parsed = new URL(request.url);
        if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password)
          throw new Error("Cookie 地址无效");
        const url = parsed.href;
        if (typeof request.name !== "string") throw new Error("Cookie 名称无效");
        await this.platformSession(url).cookies.remove(url, request.name);
        return undefined;
      }
      case "mediaStart": {
        const request = object(value);
        if (
          typeof request.size !== "number" ||
          !Number.isSafeInteger(request.size) ||
          request.size < 0 ||
          request.size > 512 * 1024 * 1024 ||
          this.mediaBytes + request.size > 2 * 1024 ** 3
        )
          throw new Error("单素材上限 512 MB，当前会话素材总量上限 2 GB；请重启清理后重试");
        const token = randomUUID();
        const file = path.join(this.directory, token);
        await mkdir(this.directory, { recursive: true });
        await writeFile(file, "", { mode: 0o600 });
        this.media.set(token, {
          file,
          size: request.size,
          written: 0,
          type: typeof request.type === "string" ? request.type : "",
          ready: false,
        });
        this.mediaBytes += request.size;
        return { token, url: `pupu-media://asset/${token}` };
      }
      case "mediaChunk": {
        const request = object(value);
        const asset = typeof request.token === "string" ? this.media.get(request.token) : undefined;
        if (
          !asset ||
          asset.ready ||
          !(request.bytes instanceof Uint8Array) ||
          request.bytes.byteLength > 4 * 1024 * 1024 ||
          asset.written + request.bytes.byteLength > asset.size
        )
          throw new Error("素材分块无效");
        await appendFile(asset.file, request.bytes);
        asset.written += request.bytes.byteLength;
        return undefined;
      }
      case "mediaFinish": {
        const asset = typeof value === "string" ? this.media.get(value) : undefined;
        if (!asset || asset.written !== asset.size || (await stat(asset.file)).size !== asset.size)
          throw new Error("素材传输不完整，未执行发布");
        asset.ready = true;
        return undefined;
      }
      default:
        throw new Error(`桌面不支持该操作：${String(action)}`);
    }
  }

  cleanup() {
    if (!this.cleanupPromise)
      this.cleanupPromise = (async () => {
        for (const asset of this.media.values()) await rm(asset.file, { force: true });
        this.media.clear();
        await rmdir(this.directory).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== "ENOENT") throw error;
        });
      })();
    return this.cleanupPromise;
  }
  async shutdown() {
    for (const tab of this.tabs.values()) {
      if (!tab.view.webContents.isDestroyed()) tab.view.webContents.close();
    }
    await this.cleanup();
  }
}
