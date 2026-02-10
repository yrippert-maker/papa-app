const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("papa", {
  readConfig: () => ipcRenderer.invoke("config:read"),
  writeConfig: (text) => ipcRenderer.invoke("config:write", text),
  restart: () => ipcRenderer.invoke("app:restart"),
  onUpdateAvailable: (cb) => {
    ipcRenderer.on("update-available", (_e, info) => cb(info));
  },
  onUpdateDownloaded: (cb) => {
    ipcRenderer.on("update-downloaded", () => cb());
  },
  onUpdateError: (cb) => {
    ipcRenderer.on("update-error", (_e, msg) => cb(msg));
  },
  installUpdate: () => ipcRenderer.send("install-update"),
});
