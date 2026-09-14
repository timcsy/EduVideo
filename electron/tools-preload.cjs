const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('desktopTools',{
  cameraSignal:value=>ipcRenderer.send('tools:camera-signal',value),
  onCameraSignal:callback=>ipcRenderer.on('tools:camera-signal',(_e,value)=>callback(value)),
  command:value=>ipcRenderer.send('tools:command',value),
  annotations:value=>ipcRenderer.send('tools:annotations',value),
  notes:value=>ipcRenderer.send('tools:notes',value),
  onState:callback=>ipcRenderer.on('tools:state',(_e,value)=>callback(value)),
  onCommand:callback=>ipcRenderer.on('tools:command',(_e,value)=>callback(value))
});
