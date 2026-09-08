const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("setupAPI", {
  salvar: (config) => ipcRenderer.invoke("salvar-modo", config),
});
