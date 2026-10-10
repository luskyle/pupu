let adapterNames = new Map();
const executionResults = new Map();

export function getWorkspaceExecution(id) {
  return executionResults.get(id);
}

export function registerWorkspaceAdapters(platforms) {
  adapterNames = new Map(Object.values(platforms).map((info) => [info.injectFunction, info.name]));
}

export function eventChannel() {
  const listeners = new Set();
  return {
    addListener: (listener) => listeners.add(listener),
    removeListener: (listener) => listeners.delete(listener),
    hasListener: (listener) => listeners.has(listener),
    emit: (...args) => {
      for (const listener of listeners) listener(...args);
    },
  };
}

export async function installWorkspaceChrome(bridge) {
  const invoke = async (action, data) => {
    const response = await bridge.invoke(action, data);
    if (!response?.ok) throw new Error(response?.error || `桌面操作失败：${action}`);
    return response.data;
  };
  const config = await invoke("config");
  const mediaCache = new Map();
  const execute = async (id, platform, data) => {
    const result = await invoke("execute", {
      id,
      platform,
      data: await transferWorkspaceData(data, invoke, globalThis.fetch, mediaCache),
    });
    executionResults.set(id, result);
    return result;
  };
  const onUpdated = eventChannel();
  const onRemoved = eventChannel();
  const onChanged = eventChannel();
  const messages = new Set();
  const chromeAPI = {
    desktop: true,
    runtime: {
      id: "pupu-desktop",
      getURL: (file) => new URL(file, location.href).href,
      getManifest: () => ({ version: config.version, manifest_version: 3 }),
      onMessage: {
        addListener: (listener) => messages.add(listener),
        removeListener: (listener) => messages.delete(listener),
      },
      sendMessage: async (request) => {
        if (request.type === "PUPU_DESKTOP_BATCH") return invoke("batch", request.running);
        return new Promise((resolve, reject) => {
          let handled = false;
          for (const listener of messages) {
            try {
              if (listener(request, { id: "pupu-desktop" }, resolve) === true) {
                handled = true;
                break;
              }
            } catch (error) {
              reject(error);
              return;
            }
          }
          if (!handled) reject(new Error(`桌面尚不支持该操作：${request.type || request.action}`));
        });
      },
      openOptionsPage: () => invoke("select", 0),
    },
    i18n: {
      getMessage: (key, values = []) => {
        let text = config.messages[key]?.message || "";
        const replacements = Array.isArray(values) ? values : [values];
        for (let i = 0; i < replacements.length; i++) text = text.replaceAll(`$${i + 1}`, replacements[i]);
        const placeholders = config.messages[key]?.placeholders || {};
        for (const [name, value] of Object.entries(placeholders)) {
          const index = Number(value.content.replace("$", "")) - 1;
          text = text.replace(new RegExp(`\\$${name}\\$`, "gi"), replacements[index] || "");
        }
        return text;
      },
    },
    tabs: {
      create: (properties) => invoke("create", properties),
      get: (id) => invoke("get", id),
      query: (properties) => invoke("query", properties),
      update: (id, properties) => invoke("update", { id, properties }),
      reload: (id) => invoke("reload", id),
      group: (properties) => invoke("group", properties),
      remove: (id, callback) => {
        const result = invoke("remove", id);
        if (callback) void result.then(callback, (error) => console.error("关闭平台失败", error));
        return result;
      },
      sendMessage: (id, request) => {
        if (request.type !== "PUPU_REDNOTE_FILL") throw new Error("不支持的平台消息");
        if (request.agentEnabled) throw new Error("多平台工作台尚未接入标题 Agent，请关闭该试点设置");
        return execute(id, "DYNAMIC_REDNOTE", request.data).then(() => ({ ok: true }));
      },
      onUpdated,
      onRemoved,
    },
    scripting: {
      executeScript: async ({ target, func, args }) => {
        const platform = adapterNames.get(func);
        if (!platform) throw new Error("没有登记该平台适配器，拒绝执行任意脚本");
        return [{ result: await execute(target.tabId, platform, args[0]) }];
      },
    },
    tabGroups: { update: (_id, _properties) => Promise.resolve() },
    windows: {
      getCurrent: () => Promise.resolve({ id: 1 }),
      update: () => Promise.resolve(),
    },
    sidePanel: {
      open: async () => window.dispatchEvent(new Event("pupu:open-panel")),
      setPanelBehavior: () => Promise.resolve(),
    },
    action: {
      setBadgeText: (data) => invoke("badge", data.text),
      setBadgeBackgroundColor: () => Promise.resolve(),
    },
    cookies: {
      getAll: (filter) => invoke("cookies", filter),
      remove: (details) => invoke("removeCookie", details),
    },
    storage: { onChanged },
  };
  for (const area of ["local", "sync", "session"]) {
    chromeAPI.storage[area] = {
      get: (keys, callback) => {
        const result = invoke("storageGet", { area, keys });
        if (callback) void result.then(callback, (error) => console.error("读取存储失败", error));
        return result;
      },
      set: (values) => invoke("storageSet", { area, values }),
      remove: (keys) => invoke("storageRemove", { area, keys }),
      clear: () => invoke("storageClear", { area }),
    };
  }
  globalThis.chrome = chromeAPI;
  // 插件侧边栏会自行关闭；桌面侧栏是布局的一部分，不允许关闭整个应用。
  window.close = () => window.dispatchEvent(new Event("pupu:close-panel"));
  bridge.onEvent((event) => {
    if (event.type === "updated") onUpdated.emit(event.id, event.change, event.tab);
    if (event.type === "removed") {
      executionResults.delete(event.id);
      onRemoved.emit(event.id);
    }
    if (event.type === "storage") onChanged.emit(event.changes, event.area);
  });
  const nativeFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input, options) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith("https://")) return nativeFetch(input, options);
    const request = new Request(input, options);
    const response = await invoke("fetch", {
      url: request.url,
      method: request.method,
      headers: Array.from(request.headers.entries()),
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
    });
    return new Response(response.body, { status: response.status, headers: response.headers });
  };
  return chromeAPI;
}
import { transferWorkspaceData } from "./workspace-data.js";
