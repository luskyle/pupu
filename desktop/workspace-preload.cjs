const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pupuWorkspace", {
  invoke: (action, data) => ipcRenderer.invoke("pupu:workspace", action, data),
  onEvent: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("pupu:workspace-event", listener);
    return () => ipcRenderer.removeListener("pupu:workspace-event", listener);
  },
});
