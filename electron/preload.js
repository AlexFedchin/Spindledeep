const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('host', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (s) => ipcRenderer.invoke('settings:set', s),
  quit: () => ipcRenderer.invoke('app:quit'),
  setFullscreen: (v) => ipcRenderer.invoke('app:fullscreen', v),
  onFullscreen: (cb) => ipcRenderer.on('fullscreen', (_e, v) => cb(v)),
});
