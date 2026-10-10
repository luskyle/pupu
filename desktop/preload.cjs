const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pupuDesktop", {
  invoke: (action, data) => {
    const allowed = ["status", "configure", "download", "draft", "saveDraft", "assets", "assetState", "open", "observe", "fill", "publish", "showPlatform", "cancel"];
    if (!allowed.includes(action)) return Promise.reject(new Error("Unsupported desktop action"));
    return ipcRenderer.invoke(`pupu:${action}`, data);
  },
  onProgress: (callback) => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on("pupu:progress", listener);
    return () => ipcRenderer.removeListener("pupu:progress", listener);
  },
});
