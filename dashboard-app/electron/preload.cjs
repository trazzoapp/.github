const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("trazzo", {
  getConfig: () => ipcRenderer.invoke("config:get"),
  pickFolder: () => ipcRenderer.invoke("config:pick-folder"),
  clearFolder: () => ipcRenderer.invoke("config:clear-folder"),
  listApps: () => ipcRenderer.invoke("apps:list"),
  getStatus: () => ipcRenderer.invoke("apps:status"),
  startApp: (id) => ipcRenderer.invoke("apps:start", id),
  stopApp: (id) => ipcRenderer.invoke("apps:stop", id),
  startAll: () => ipcRenderer.invoke("apps:start-all"),
  stopAll: () => ipcRenderer.invoke("apps:stop-all"),
  getLogs: (id) => ipcRenderer.invoke("logs:get", id),
  listPorts: () => ipcRenderer.invoke("ports:list"),
  killPort: (port) => ipcRenderer.invoke("ports:kill", port),
  openExternal: (url) => ipcRenderer.invoke("shell:open", url),
  onLogAppend: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on("logs:append", handler);
    return () => ipcRenderer.removeListener("logs:append", handler);
  },
  onAppChanged: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on("apps:changed", handler);
    return () => ipcRenderer.removeListener("apps:changed", handler);
  },
});
