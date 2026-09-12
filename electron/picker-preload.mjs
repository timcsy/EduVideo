import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('sourcePicker', {
  onSources(callback) {
    ipcRenderer.on('edu:sources', (_event, sources) => callback(sources));
  },
  select(sourceId) {
    ipcRenderer.send('edu:source-selected', sourceId);
  },
  cancel() {
    ipcRenderer.send('edu:source-cancelled');
  }
});
