const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('studioNative', {
  transcribe: (bytes,options) => ipcRenderer.invoke('studio:transcribe',bytes,options),
  speechModels: () => ipcRenderer.invoke('studio:speech-models'),
  downloadSpeechModel: id => ipcRenderer.invoke('studio:download-speech-model',id),
  cancelModelDownload: () => ipcRenderer.invoke('studio:cancel-model-download'),
  removeSpeechModel: id => ipcRenderer.invoke('studio:remove-speech-model',id),
  onModelProgress: callback => {const listener=(_event,value)=>callback(value);ipcRenderer.on('studio:model-progress',listener);return()=>ipcRenderer.removeListener('studio:model-progress',listener);},
  cancelSpeech: () => ipcRenderer.invoke('studio:cancel-speech'),
  onSpeechProgress: callback => {const listener=(_event,value)=>callback(value);ipcRenderer.on('studio:speech-progress',listener);return()=>ipcRenderer.removeListener('studio:speech-progress',listener);},
  saveProject: (files,saveAs=false) => ipcRenderer.invoke('studio:save-project', files,saveAs),
  openProject: () => ipcRenderer.invoke('studio:open-project'),
  pendingProject: () => ipcRenderer.invoke('studio:pending-project'),
  forgetProject: () => ipcRenderer.invoke('studio:forget-project'),
  onProjectAvailable: callback => ipcRenderer.on('studio:project-available',()=>callback()),
  encodeMp4: bytes => ipcRenderer.invoke('studio:encode', bytes),
  cancelEncode: () => ipcRenderer.invoke('studio:cancel-encode')
});
