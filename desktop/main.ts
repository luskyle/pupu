import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { BrowserWindow, type WebContents, app, dialog, ipcMain, session } from "electron";
import { parseSettings, selectTitle } from "../src/agent/decision";
import { browserTool } from "./browser-tool";
import { parseFillRequest } from "./input";
import { isEditorPreparationNavigation } from "./navigation";
import type { PageAction, PageObservation, PublishState } from "./page-tool";
import { runPublisher } from "./publish";
import { LocalRuntime } from "./runtime";

const verifyMode = process.argv.includes("--verify");
const smokeMode = process.argv.includes("--smoke");
app.setName("pupu-desktop");
if (verifyMode || smokeMode) app.setPath("userData", path.join(app.getPath("temp"), `pupu-verify-${process.pid}`));
else app.setPath("userData", path.join(app.getPath("appData"), "pupu-desktop"));
const configPath = path.join(app.getPath("appData"), "pupu-desktop", "runtime.json");
let workbench: BrowserWindow;
let platform: BrowserWindow | undefined;
let observation: PageObservation | undefined;
let operation: AbortController | undefined;
let downloading = false;
let downloadController: AbortController | undefined;
let assets: string[] = [];
let platformTarget: "fixture" | "rednote" | undefined;
let uploadedAssets: string[] = [];
let submitAttempted = false;
let confirming = false;
let publishing = false;
let preparingEditor = false;
const runtime = new LocalRuntime(configPath, (message) => {
  console.log(`[ollama] ${message}`);
});
const progress = (message: string) => {
  if (workbench && !workbench.isDestroyed()) workbench.webContents.send("pupu:progress", message);
};
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));
const fixtureURL = pathToFileURL(path.join(__dirname, "fixture.html")).href;
const platformURL = "https://creator.xiaohongshu.com/publish/publish?target=image";

function platformAllowed(url: string): boolean {
  if (url === fixtureURL) return true;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === "xiaohongshu.com" || parsed.hostname.endsWith(".xiaohongshu.com"))
    );
  } catch {
    return false;
  }
}

function executionContents(): WebContents {
  if (!platform || platform.isDestroyed()) throw new Error("请先打开验证页或小红书窗口");
  const contents = platform.webContents;
  const url = contents.getURL();
  if (url !== fixtureURL && !url.startsWith("https://creator.xiaohongshu.com/")) {
    throw new Error("当前不是支持的创作者编辑页，请先完成登录并进入图文编辑器");
  }
  return contents;
}

async function tool(action: PageAction, args = {}): Promise<unknown> {
  const contents = executionContents();
  return browserTool(contents, action, args);
}

async function openPlatform(target: "fixture" | "rednote"): Promise<void> {
  if (operation || confirming) throw new Error("请先停止当前任务或关闭确认窗口");
  observation = undefined;
  uploadedAssets = [];
  submitAttempted = false;
  platformTarget = target;
  if (platform && !platform.isDestroyed()) platform.close();
  platform = new BrowserWindow({
    title: target === "fixture" ? "pupu 本地验证页面" : "小红书 · Agent 执行窗口",
    width: 1100,
    height: 850,
    webPreferences: {
      partition: target === "fixture" ? "pupu-fixture" : "persist:pupu-rednote",
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });
  const current = platform;
  current.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  current.webContents.session.setPermissionCheckHandler(() => false);
  const navigationGuard = (event: Electron.Event, url: string) => {
    if (!platformAllowed(url)) {
      event.preventDefault();
      progress("已阻止不支持的页面跳转，请在平台窗口手动处理");
    }
  };
  current.webContents.on("will-navigate", navigationGuard);
  current.webContents.on("will-redirect", navigationGuard);
  let lastURL = target === "fixture" ? fixtureURL : platformURL;
  current.webContents.on("did-start-navigation", (_event, url, _inPlace, mainFrame) => {
    if (mainFrame) {
      observation = undefined;
      const expected = isEditorPreparationNavigation(lastURL, url, preparingEditor);
      lastURL = url;
      if (!submitAttempted && !expected)
        operation?.abort(new Error("页面离开当前编辑流程，已停止任务；请检查平台窗口中的实际页面后重新开始"));
    }
  });
  current.webContents.setWindowOpenHandler(({ url }) => {
    if (platformAllowed(url)) void current.loadURL(url).catch((error) => progress(errorText(error)));
    return { action: "deny" };
  });
  current.on("closed", () => {
    if (platform === current) {
      platform = undefined;
      observation = undefined;
      operation?.abort(new Error("平台窗口已关闭"));
    }
  });
  await current.loadURL(target === "fixture" ? fixtureURL : platformURL);
}

async function observe(): Promise<PageObservation> {
  const value = (await tool("observe")) as PageObservation;
  observation = value;
  return value;
}

async function uploadSelectedAssets(signal: AbortSignal): Promise<void> {
  if (!assets.length) return;
  signal.throwIfAborted();
  const contents = executionContents();
  const debuggerAPI = contents.debugger;
  if (debuggerAPI.isAttached()) throw new Error("页面调试工具已占用，无法安全上传，请手动上传素材");
  debuggerAPI.attach("1.3");
  try {
    type Node = {
      backendNodeId: number;
      nodeName: string;
      attributes?: string[];
      children?: Node[];
      shadowRoots?: Node[];
    };
    const inputs: Node[] = [];
    const visit = (node: Node) => {
      const attrs = node.attributes || [];
      const typeIndex = attrs.indexOf("type");
      const acceptIndex = attrs.indexOf("accept");
      if (
        node.nodeName === "INPUT" &&
        typeIndex >= 0 &&
        attrs[typeIndex + 1] === "file" &&
        acceptIndex >= 0 &&
        /image|\.png|\.jpg|\.jpeg/i.test(attrs[acceptIndex + 1])
      )
        inputs.push(node);
      for (const child of [...(node.children || []), ...(node.shadowRoots || [])]) visit(child);
    };
    for (let attempt = 0; attempt < 60; attempt++) {
      signal.throwIfAborted();
      inputs.length = 0;
      const { root } = await debuggerAPI.sendCommand("DOM.getDocument", { depth: -1, pierce: true });
      visit(root);
      if (inputs.length) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (inputs.length !== 1) throw new Error("图片上传入口不唯一或不支持识别，请在平台手动上传");
    signal.throwIfAborted();
    progress("正在向当前页面上传选定图片；上传结果需要在平台核对");
    try {
      await debuggerAPI.sendCommand("DOM.setFileInputFiles", { backendNodeId: inputs[0].backendNodeId, files: assets });
    } catch (error) {
      if (error instanceof Error && /No node with given id found|Could not find node with given id/.test(error.message))
        throw new Error("上传入口已被平台替换，上传未确认；请检查平台素材后再继续，不会自动重复上传");
      throw error;
    }
  } finally {
    debuggerAPI.detach();
  }
}

async function fill(value: unknown) {
  if (operation || downloading || publishing) throw new Error("当前已有任务，请等待或停止");
  const request = parseFillRequest(value);
  if (!observation) throw new Error("请先观察当前页面");
  const controller = new AbortController();
  operation = controller;
  const deadline = setTimeout(() => controller.abort(new Error("任务超过 120 秒，已停止；请检查已有填写")), 120_000);
  try {
    return await fillObserved(request, controller.signal);
  } finally {
    clearTimeout(deadline);
    operation = undefined;
  }
}

async function fillObserved(request: ReturnType<typeof parseFillRequest>, signal: AbortSignal) {
  const model = request.model;
  if (!observation) throw new Error("编辑器尚未就绪");
  const snapshot = observation;
  progress("正在启动/连接本地模型（不发送正文与素材）");
  await runtime.ensure();
  signal.throwIfAborted();
  const exact = snapshot.candidates.filter(
    (item) =>
      /标题|\btitle\b/i.test(item.label + item.placeholder) &&
      !/副标题|subtitle|正文|搜索/i.test(item.label + item.placeholder),
  );
  progress(exact.length === 1 ? "明确标题字段已找到，正在安全填写" : "正在由本地模型选择标题候选");
  const choice =
    exact.length === 1 ? exact[0].id : await selectTitle(model, snapshot.candidates, { signal, timeoutMs: 90_000 });
  signal.throwIfAborted();
  if (!choice) throw new Error("模型返回 none：无法确认标题字段，请手动处理");
  if (choice === snapshot.bodyId) throw new Error("标题与正文目标重叠，已停止填写");
  const target = { observationId: snapshot.observationId, id: choice };
  const existing = (await tool("read", target)) as { value: string };
  if (existing.value.trim() && existing.value !== request.title) throw new Error("标题已有不同内容，拒绝覆盖");
  if (request.content && !snapshot.bodyId) throw new Error("正文入口不唯一；不会部分自动填写，请手动处理");
  if (request.content) {
    const body = (await tool("read", { observationId: snapshot.observationId, id: snapshot.bodyId })) as {
      value: string;
    };
    if (body.value.trim() && body.value !== request.content) throw new Error("正文已有不同内容，拒绝覆盖");
  }
  signal.throwIfAborted();
  await tool("fill", { ...target, text: request.title });
  signal.throwIfAborted();
  if (request.content)
    await tool("fill", { observationId: snapshot.observationId, id: snapshot.bodyId, text: request.content });
  await new Promise((resolve) => setTimeout(resolve, 800));
  signal.throwIfAborted();
  const checked = (await tool("read", target)) as { value: string };
  if (checked.value !== request.title) throw new Error("标题回读核验失败，请手动检查");
  if (request.content) {
    const checkedBody = (await tool("read", { observationId: snapshot.observationId, id: snapshot.bodyId })) as {
      value: string;
    };
    if (checkedBody.value !== request.content) throw new Error("正文回读核验失败，请手动检查");
  }
  if (request.upload) await uploadSelectedAssets(signal);
  signal.throwIfAborted();
  if (request.upload) {
    const afterUpload = (await tool("read", target)) as { value: string };
    if (afterUpload.value !== request.title) throw new Error("上传后标题发生变化，请手动检查");
    if (request.content) {
      const bodyAfterUpload = (await tool("read", {
        observationId: snapshot.observationId,
        id: snapshot.bodyId,
      })) as {
        value: string;
      };
      if (bodyAfterUpload.value !== request.content) throw new Error("上传后正文发生变化，请手动检查");
    }
  }
  progress("文字已填写并回读核验");
  return { choice, titleVerified: true, contentVerified: Boolean(request.content), submitted: false };
}

async function publish(value: unknown) {
  if (publishing) throw new Error("已有发布任务，请等待或停止");
  publishing = true;
  try {
    return await publishTask(value);
  } finally {
    publishing = false;
  }
}

async function publishTask(value: unknown) {
  if (operation || downloading || confirming) throw new Error("已有任务正在执行");
  if (
    !value ||
    typeof value !== "object" ||
    !("target" in value) ||
    (value.target !== "fixture" && value.target !== "rednote")
  )
    throw new Error("请选择支持的平台");
  const request = parseFillRequest(value);
  if (!request.content.trim()) throw new Error("请输入正文");
  const target = value.target;
  if (target === "rednote" && !assets.length) throw new Error("小红书图文需要图片，请先添加图片");
  if (platformTarget !== target || !platform || platform.isDestroyed()) await openPlatform(target);
  if (submitAttempted) throw new Error("该页面已有提交尝试，请先在平台核对结果；需要新任务时重新打开平台");
  confirming = true;
  try {
    const confirmation =
      verifyMode && target === "fixture"
        ? { response: 1 }
        : await dialog.showMessageBox(workbench, {
            type: "question",
            title: target === "fixture" ? "运行模拟发布" : "确认自动发布任务",
            message:
              target === "fixture"
                ? "仅在本地验证页模拟，不会发布到互联网"
                : "Agent 将使用平台窗口中的当前登录账号自动发布",
            detail: `标题：${request.title}\n图片：${assets.length} 张\n\n请先在平台窗口确认账号。确认后将自动上传、填写并点击发布；停止不能撤销已经提交的内容。`,
            buttons: ["取消", "确认任务并自动发布"],
            defaultId: 0,
            cancelId: 0,
          });
    if (confirmation.response !== 1) throw new Error("已取消发布任务，未提交");
  } finally {
    confirming = false;
  }
  if (submitAttempted || !platform || platform.isDestroyed()) throw new Error("平台已关闭或任务状态发生变化，请核对");
  return executePublish(request, target);
}

async function executePublish(request: ReturnType<typeof parseFillRequest>, target: "fixture" | "rednote") {
  const controller = new AbortController();
  operation = controller;
  preparingEditor = true;
  const deadline = setTimeout(
    () =>
      controller.abort(
        new Error(
          submitAttempted ? "提交后等待超时，请到平台检查结果，不要重发" : "准备任务超时，未提交；请检查平台窗口",
        ),
      ),
    300_000,
  );
  let choice: string | undefined;
  const pause = async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    controller.signal.throwIfAborted();
  };
  try {
    return await runPublisher({
      signal: controller.signal,
      progress,
      state: async () => (await tool("publishState")) as PublishState,
      upload: async () => {
        if (JSON.stringify(uploadedAssets) === JSON.stringify(assets) && uploadedAssets.length) return;
        await tool("prepareImages");
        const contents = executionContents();
        for (let attempt = 0; contents.isLoadingMainFrame(); attempt++) {
          if (attempt >= 60) throw new Error("图文页面加载超时，未上传，请检查平台窗口");
          await pause();
        }
        controller.signal.throwIfAborted();
        if (assets.length) {
          await uploadSelectedAssets(controller.signal);
          uploadedAssets = [...assets];
        } else if (target === "rednote") throw new Error("请先添加图片");
      },
      observeAndFill: async () => {
        let ready = false;
        for (let attempt = 0; attempt < 120; attempt++) {
          const state = (await tool("publishState")) as PublishState;
          if (state.blocked) throw new Error("请先完成登录或安全验证，再重新开始");
          const observed = await observe();
          if (observed.bodyId && observed.candidates.length >= 2) {
            ready = true;
            break;
          }
          await pause();
        }
        if (!ready) throw new Error("无法识别图文编辑器，请检查上传是否完成；未提交");
        preparingEditor = false;
        choice = (await fillObserved({ ...request, upload: false }, controller.signal)).choice;
      },
      submit: async () => {
        if (!observation || !choice) throw new Error("提交目标失效");
        controller.signal.throwIfAborted();
        await tool("submit", {
          observationId: observation.observationId,
          id: choice,
          expectedTitle: request.title,
          bodyId: observation.bodyId,
          expectedContent: request.content,
        });
      },
      submitted: () => {
        submitAttempted = true;
      },
      wait: pause,
    });
  } catch (error) {
    if (submitAttempted) throw new Error(`提交状态需要核对，不会自动重发。${errorText(error)}`);
    throw error;
  } finally {
    clearTimeout(deadline);
    operation = undefined;
    preparingEditor = false;
  }
}

async function modelStatus() {
  await runtime.ensure();
  const response = await fetch("http://127.0.0.1:11434/api/tags", {
    signal: AbortSignal.timeout(5000),
    redirect: "error",
  });
  if (!response.ok) throw new Error(`本地模型列表读取失败：HTTP ${response.status}`);
  const value = await response.json();
  return {
    models: value.models.map((model: { name: string; size: number }) => ({ name: model.name, size: model.size })),
  };
}

async function downloadModel(model: string) {
  if (downloading || operation || publishing) throw new Error("已有下载或执行任务");
  if (model !== "qwen3:4b") throw new Error("安装入口仅下载已选定的 qwen3:4b；其他模型请通过 Ollama 自行安装");
  downloading = true;
  const controller = new AbortController();
  downloadController = controller;
  const deadline = setTimeout(() => controller.abort(new Error("模型下载超过 30 分钟，请稍后重试")), 30 * 60_000);
  try {
    await runtime.ensure();
    progress("正在下载 qwen3:4b（约 2.5 GB），请等待");
    const response = await fetch("http://127.0.0.1:11434/api/pull", {
      method: "POST",
      redirect: "error",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, stream: true }),
      signal: controller.signal,
    });
    if (!response.ok || !response.body) throw new Error(`模型下载失败：HTTP ${response.status}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let success = false;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (line.trim()) {
          const event = JSON.parse(line);
          if (event.error) throw new Error(event.error);
          success ||= event.status === "success";
          progress(
            `${event.status}${event.total ? ` ${Math.round(((event.completed || 0) / event.total) * 100)}%` : ""}`,
          );
        }
        newline = buffer.indexOf("\n");
      }
    }
    if (!success) throw new Error("下载未返回成功状态，请检查本地服务日志");
    return await modelStatus();
  } finally {
    clearTimeout(deadline);
    downloadController = undefined;
    downloading = false;
  }
}

const draftPath = () => path.join(app.getPath("userData"), "draft.json");
const handlers: Record<string, (data: unknown) => Promise<unknown> | unknown> = {
  status: modelStatus,
  configure: async () => {
    if (operation || downloading || publishing) throw new Error("任务执行中不能更换运行时");
    const result = await dialog.showOpenDialog(workbench, {
      title: "选择 Ollama 可执行文件",
      properties: ["openFile"],
    });
    if (result.canceled) throw new Error("已取消选择");
    await runtime.configure(result.filePaths[0], path.join(app.getPath("userData"), "models"));
    return modelStatus();
  },
  download: () => downloadModel("qwen3:4b"),
  draft: async () => {
    try {
      return JSON.parse(await readFile(draftPath(), "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { title: "", content: "", model: "qwen3:4b" };
      throw error;
    }
  },
  saveDraft: async (data) => {
    if (
      !data ||
      typeof data !== "object" ||
      !("title" in data) ||
      typeof data.title !== "string" ||
      !("content" in data) ||
      typeof data.content !== "string" ||
      !("model" in data) ||
      typeof data.model !== "string" ||
      data.title.length > 200 ||
      data.content.length > 100_000
    )
      throw new Error("草稿无效或过大");
    const model = parseSettings({ enabled: true, model: data.model }).model;
    await mkdir(app.getPath("userData"), { recursive: true });
    await writeFile(draftPath(), JSON.stringify({ title: data.title, content: data.content, model }), { mode: 0o600 });
    return { saved: true };
  },
  assets: async () => {
    if (operation || confirming || publishing) throw new Error("任务执行中不能更换素材");
    const result = await dialog.showOpenDialog(workbench, {
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "图片", extensions: ["png", "jpg", "jpeg", "webp"] }],
    });
    if (result.canceled) return assets.map((file) => path.basename(file));
    if (result.filePaths.length > 9) throw new Error("试点最多选择 9 张图片");
    for (const file of result.filePaths) {
      if (!/\.(png|jpe?g|webp)$/i.test(file) || (await stat(file)).size > 20 * 1024 * 1024)
        throw new Error("图片格式不支持或超过 20 MB");
    }
    assets = result.filePaths;
    return assets.map((file) => path.basename(file));
  },
  assetState: () => assets.map((file) => path.basename(file)),
  publish,
  showPlatform: () => {
    if (!platform || platform.isDestroyed()) throw new Error("请先打开平台并登录账号");
    platform.show();
    platform.focus();
  },
  open: (data) => {
    if (publishing) throw new Error("发布任务执行中不能重新打开平台，请先停止");
    if (data !== "fixture" && data !== "rednote") throw new Error("不支持的目标平台");
    return openPlatform(data);
  },
  observe: async () => {
    if (operation || publishing) throw new Error("当前任务正在执行");
    return observe();
  },
  fill,
  cancel: () => {
    operation?.abort(
      new Error(submitAttempted ? "已请求停止，但提交不能撤销，请到平台检查" : "用户已停止任务，已有填写不会撤销"),
    );
    downloadController?.abort(new Error("用户已停止模型下载，可稍后重试"));
    return { cancelled: true };
  },
};

async function checkRealNavigation() {
  await openPlatform("rednote");
  if (!platform) throw new Error("平台未打开");
  await platform.loadURL(platformURL.replace("target=image", "target=video"));
  await new Promise((resolve) => setTimeout(resolve, 4000));
  await platform.webContents.executeJavaScript(`(() => {
    const tabs = Array.from(document.querySelectorAll('span.title')).filter(element => {
      const rect = element.getBoundingClientRect();
      return element.textContent.trim() === '上传视频' && rect.right > 0 && rect.bottom > 0 &&
        rect.left < innerWidth && rect.top < innerHeight &&
        Number(getComputedStyle(element.parentElement).opacity) >= 0.01;
    });
    if (tabs.length !== 1) throw new Error('实测无法唯一定位视频 tab');
    tabs[0].click();
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const beforeURL = platform.webContents.getURL();
  const controller = new AbortController();
  operation = controller;
  preparingEditor = true;
  try {
    await tool("prepareImages");
    await new Promise((resolve) => setTimeout(resolve, 4000));
    controller.signal.throwIfAborted();
    const afterURL = platform.webContents.getURL();
    if (!afterURL.includes("target=image")) throw new Error(`真实平台未切换至图文：${beforeURL} -> ${afterURL}`);
    if (beforeURL === afterURL) throw new Error("未发生真实导航，不能证明导航修复");
    console.log(
      "REAL_NAVIGATION_VERIFIED",
      JSON.stringify({ beforeURL, afterURL, aborted: false, uploaded: false, submitted: false }),
    );
  } finally {
    operation = undefined;
    preparingEditor = false;
  }
}

async function verify() {
  const uiBound = await workbench.webContents.executeJavaScript(
    "typeof document.getElementById('fixture').onclick === 'function'",
  );
  if (!uiBound) throw new Error("工作台脚本未初始化，界面无法执行发布任务");
  const invoke = async (action: string, data?: unknown) => {
    const reply = await workbench.webContents.executeJavaScript(
      `window.pupuDesktop.invoke(${JSON.stringify(action)}, ${JSON.stringify(data) ?? "undefined"})`,
    );
    if (!reply?.ok) throw new Error(`桌面 IPC 验证失败：${reply?.error || action}`);
    return reply.data;
  };
  const bridge = await workbench.webContents.executeJavaScript("window.pupuDesktop.invoke('draft')");
  if (!bridge?.ok) throw new Error("桌面 preload/IPC 桥接验证失败");
  const status = await invoke("status");
  const draft = {
    title: "pupu 本地验证",
    content: "真实模型决定字段，桌面工具执行并核验。",
    model: "qwen3:4b",
  };
  await invoke("saveDraft", draft);
  const saved = await invoke("draft");
  if (JSON.stringify(saved) !== JSON.stringify(draft)) throw new Error("草稿持久化验证失败");
  await invoke("open", "fixture");
  const observed = (await invoke("observe")) as PageObservation;
  if (observed.candidates.some((item) => /标题|title/i.test(item.label + item.placeholder)))
    throw new Error("验证页面不能走固定标题规则");
  const started = Date.now();
  const result = await invoke("fill", draft);
  if (result.choice !== "e1" || !result.titleVerified || !result.contentVerified || result.submitted)
    throw new Error("桌面真实模型闭环未通过");
  const submitted = await platform?.webContents.executeJavaScript("document.body.dataset.submitted || 'false'");
  if (submitted !== "false") throw new Error("验证页发生了禁止的自动提交");
  const isolated = await platform?.webContents.executeJavaScript(
    "typeof window.pupuDesktop === 'undefined' && typeof require === 'undefined'",
  );
  if (!isolated) throw new Error("平台页面未隔离桌面权限");
  const refused = await workbench.webContents.executeJavaScript(
    `window.pupuDesktop.invoke('fill', ${JSON.stringify({ ...draft, title: "不应覆盖的标题" })})`,
  );
  if (refused.ok || !refused.error.includes("拒绝覆盖")) throw new Error("桌面覆盖保护验证失败");
  const preserved = (await tool("read", { observationId: observed.observationId, id: result.choice })) as {
    value: string;
  };
  if (preserved.value !== draft.title) throw new Error("覆盖拒绝后原内容发生变化");
  await invoke("open", "fixture");
  await mkdir(app.getPath("userData"), { recursive: true });
  const imagePath = path.join(app.getPath("userData"), "verification-image.png");
  await writeFile(imagePath, (await workbench.webContents.capturePage()).toPNG());
  assets = [imagePath];
  const resultAuto = await invoke("publish", { ...draft, target: "fixture" });
  if (!resultAuto.submitted || !resultAuto.verified) throw new Error("自动发布闭环未通过");
  const clickCount = await platform?.webContents.executeJavaScript("document.body.dataset.submitCount");
  if (clickCount !== "1") throw new Error("自动发布重复提交");
  const imageState = (await tool("publishState")) as PublishState;
  if (imageState.selectedImages !== 1) throw new Error("自动上传图片验证失败");
  const repeated = await workbench.webContents.executeJavaScript(
    `window.pupuDesktop.invoke('publish', ${JSON.stringify({ ...draft, target: "fixture" })})`,
  );
  if (repeated.ok) throw new Error("重复发布未被阻止");
  await workbench.webContents.executeJavaScript(
    `for (const [key, value] of Object.entries(${JSON.stringify(draft)})) {
       document.getElementById(key).value = value;
       if (key !== 'model') document.getElementById(key).dispatchEvent(new Event('input'));
     }
     document.getElementById('fixture').click();`,
  );
  let uiVerified = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    const text = await workbench.webContents.executeJavaScript("document.getElementById('progress').textContent");
    if (text === "本地模拟发布成功，没有向互联网发布。") {
      uiVerified = true;
      break;
    }
    if (text.startsWith("任务暂停")) throw new Error(`界面自动发布失败：${text}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!uiVerified) throw new Error("界面自动发布没有完成");
  await new Promise((resolve) => setTimeout(resolve, 150));
  const screen = await workbench.webContents.capturePage();
  const reportDirectory = app.isPackaged
    ? path.join(app.getPath("appData"), "pupu-desktop", "verification")
    : __dirname;
  await mkdir(reportDirectory, { recursive: true });
  const screenshot = path.join(reportDirectory, "verification.png");
  await writeFile(screenshot, screen.toPNG());
  const platformScreenshot = path.join(reportDirectory, "verification-platform.png");
  if (platform) await writeFile(platformScreenshot, (await platform.webContents.capturePage()).toPNG());
  const report = {
    ok: true,
    model: "qwen3:4b",
    runtime: process.versions.electron,
    models: status.models,
    candidates: observed.candidates,
    result,
    automaticPublish: resultAuto,
    submitCount: clickCount,
    duplicateBlocked: true,
    closedShadowVerified: true,
    imageUploadVerified: true,
    uiPublishVerified: true,
    elapsedMs: Date.now() - started,
    screenshot,
    platformScreenshot,
    isolated,
    draftPersisted: true,
    overwriteRefused: true,
  };
  await writeFile(path.join(reportDirectory, "verification.json"), JSON.stringify(report, null, 2));
  console.log("DESKTOP_VERIFIED", JSON.stringify(report));
}

app.on("before-quit", () => {
  operation?.abort(new Error("应用退出"));
  downloadController?.abort(new Error("应用退出"));
  runtime.stop();
});
app.on("window-all-closed", () => app.quit());
app
  .whenReady()
  .then(async () => {
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    workbench = new BrowserWindow({
      width: 1120,
      height: 850,
      minWidth: 880,
      minHeight: 680,
      title: "pupu · 本地内容分发工作台",
      icon: path.join(__dirname, "icon.png"),
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    const uiURL = pathToFileURL(path.join(__dirname, "index.html")).href;
    workbench.webContents.on("will-navigate", (event) => event.preventDefault());
    workbench.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    for (const [name, handler] of Object.entries(handlers)) {
      ipcMain.handle(`pupu:${name}`, async (event, data) => {
        if (
          event.sender !== workbench.webContents ||
          event.senderFrame !== workbench.webContents.mainFrame ||
          event.senderFrame.url !== uiURL
        )
          return { ok: false, error: "不可信的桌面调用来源" };
        try {
          return { ok: true, data: await handler(data) };
        } catch (error) {
          const message = errorText(error);
          progress(`操作停止：${message}`);
          return { ok: false, error: message };
        }
      });
    }
    await workbench.loadURL(uiURL);
    if (smokeMode) {
      try {
        const ready = await workbench.webContents.executeJavaScript(
          "typeof document.getElementById('publish').onclick === 'function' && window.pupuDesktop.invoke('draft')",
        );
        if (!ready?.ok) throw new Error("工作台脚本或 IPC 未就绪");
        await openPlatform("fixture");
        const observed = await observe();
        if (observed.candidates.length !== 3 || !observed.bodyId) throw new Error("closed shadow 编辑器观察失败");
        const isolated = await platform?.webContents.executeJavaScript(
          "typeof require === 'undefined' && typeof window.pupuDesktop === 'undefined'",
        );
        if (!isolated) throw new Error("平台权限隔离失败");
        console.log("DESKTOP_SMOKE_OK");
        runtime.stop();
        app.exit(0);
      } catch (error) {
        console.error("DESKTOP_SMOKE_FAILED", error);
        runtime.stop();
        app.exit(1);
      }
      return;
    }
    if (process.argv.includes("--check-navigation")) {
      try {
        await checkRealNavigation();
        runtime.stop();
        app.exit(0);
      } catch (error) {
        console.error("REAL_NAVIGATION_FAILED", error);
        runtime.stop();
        app.exit(1);
      }
      return;
    }
    if (verifyMode) {
      try {
        await verify();
        runtime.stop();
        app.exit(0);
      } catch (error) {
        console.error("DESKTOP_VERIFICATION_FAILED", error);
        runtime.stop();
        app.exit(1);
      }
    }
  })
  .catch((error) => {
    console.error(error);
    runtime.stop();
    app.exit(1);
  });
