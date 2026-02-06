const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("papa", {
  readConfig: () => ipcRenderer.invoke("config:read"),
  writeConfig: (text) => ipcRenderer.invoke("config:write", text),
  restart: () => ipcRenderer.invoke("app:restart"),
});
