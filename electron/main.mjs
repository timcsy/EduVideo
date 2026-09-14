import { app, BrowserWindow, desktopCapturer, ipcMain, session, dialog } from 'electron';
import {lstat,readFile} from 'node:fs/promises';
import {savePackage,readPackage} from './project-package.mjs';
import {transcribeMedia} from './transcribe.mjs';
import {listSpeechModels,downloadSpeechModel,removeSpeechModel,resolveSpeechModel} from './speech-model-manager.mjs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeMp4 } from './encode.mjs';
import {installDesktopTools} from './desktop-tools.mjs';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const isDev = process.env.ELECTRON_DEV === '1';
const devUrl = process.env.EDUVIDEO_DEV_URL || 'http://127.0.0.1:4173/studio.html';
let mainWindow = null;
let desktopTools=null,captureInfo=null;
let sourcePicker = null;
let resolveSource = null;
let encodingController = null;
let speechController=null;
let modelController=null;
let projectPath=null,pendingOpen=null;
app.on('open-file',(event,path)=>{event.preventDefault();pendingOpen=path;mainWindow?.webContents.send('studio:project-available');});
const checkSender=event=>{if(event.sender!==mainWindow?.webContents||event.senderFrame!==event.sender.mainFrame)throw new Error('不允許的專案請求');};
async function readSelectedProject(path){const stat=await lstat(path);if(stat.isDirectory()){const files=await readPackage(path);projectPath=path;return {files,path};}const bytes=new Uint8Array(await readFile(path));projectPath=null;return {bytes,path:null};}

function closeSourcePicker(sourceId = null) {
  const resolve = resolveSource;
  resolveSource = null;
  if (sourcePicker && !sourcePicker.isDestroyed()) sourcePicker.close();
  sourcePicker = null;
  resolve?.(sourceId);
}

function chooseDesktopSource(sources) {
  return new Promise(resolve => {
    resolveSource = resolve;
    sourcePicker = new BrowserWindow({
      parent: mainWindow,
      modal: true,
      width: 560,
      height: 430,
      resizable: false,
      title: '選擇要錄製的畫面',
      backgroundColor: '#0f151d',
      webPreferences: {
        preload: join(root, 'electron', 'picker-preload.mjs'),
        contextIsolation: true,
        nodeIntegration: false,
        // The picker uses a tiny local preload bridge. Keep context isolation
        // and Node integration disabled, but avoid sandboxing here because
        // Electron's ESM preload bridge is not exposed reliably in sandboxed
        // modal windows on macOS.
        sandbox: false
      }
    });
    sourcePicker.on('closed', () => closeSourcePicker());
    desktopTools?.protect();
    sourcePicker.webContents.on('did-finish-load', () => {
      sourcePicker?.webContents.send('edu:sources', sources.map(source => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL()
      })));
    });
    sourcePicker.loadFile(join(root, 'electron', 'picker.html'));
  });
}

function installMediaHandlers() {
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => permission === 'media' || permission === 'display-capture');
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => callback(permission === 'media' || permission === 'display-capture'));
  // Provide a deterministic source picker for platforms where Electron's
  // experimental system picker is unavailable.
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    let responded = false;
    const respond = details => {
      // Electron's one-time display callback must never be called twice. This
      // matters when a picker is closed while the request is also rejecting.
      if (responded) return;
      responded = true;
      callback(details);
    };
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 180 },
        fetchWindowIcons: true
      });
      const selectedId = await chooseDesktopSource(sources);
      const source = sources.find(item => item.id === selectedId);
      captureInfo=source?{id:source.id,name:source.name,kind:source.id.startsWith('screen:')?'screen':'window',displayId:source.display_id}:null;
      // Keep the first capture path focused on the selected video source.
      // The presenter microphone is captured by the separate camera stream;
      // system-audio loopback can be added after the platform path is stable.
      respond(source ? { video: source } : {});
    } catch {
      respond({});
    }
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 700,
    backgroundColor: '#0f151d',
    webPreferences: { preload: join(root, 'electron', 'studio-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.endsWith('/presentation.html')) return { action: 'deny' };
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 1280,
        height: 720,
        minWidth: 640,
        minHeight: 360,
        frame: false,
        title: 'EduVideo 簡報輸出',
        backgroundColor: '#05080d',
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
      }
    };
  });
  if (isDev) await mainWindow.loadURL(devUrl);
  else await mainWindow.loadFile(join(root, 'dist', 'studio.html'));
  mainWindow.on('closed',()=>{mainWindow=null;desktopTools?.dispose();});
  mainWindow.on('show',()=>desktopTools?.mainShown());
}

app.whenReady().then(async () => {
  desktopTools=installDesktopTools({root,getMain:()=>mainWindow,isDev});
  ipcMain.handle('studio:capture-info',event=>{checkSender(event);return captureInfo;});
  const speechDirectory=app.isPackaged?join(process.resourcesPath,'speech'):join(root,'native','speech'),modelDirectory=join(app.getPath('userData'),'speech-models');
  ipcMain.handle('studio:speech-models',event=>{checkSender(event);return listSpeechModels(modelDirectory);});
  ipcMain.handle('studio:download-speech-model',async(event,id)=>{checkSender(event);if(modelController)throw new Error('已有模型正在下載');modelController=new AbortController();try{await downloadSpeechModel(modelDirectory,id,{signal:modelController.signal,progress:value=>{if(!event.sender.isDestroyed())event.sender.send('studio:model-progress',value);}});return listSpeechModels(modelDirectory);}finally{modelController=null;}});
  ipcMain.handle('studio:cancel-model-download',event=>{checkSender(event);modelController?.abort();});
  ipcMain.handle('studio:remove-speech-model',async(event,id)=>{checkSender(event);await removeSpeechModel(modelDirectory,id);return listSpeechModels(modelDirectory);});
  ipcMain.handle('studio:transcribe',async(event,bytes,options={})=>{checkSender(event);if(speechController)throw new Error('正在辨識字幕');const language=typeof options==='string'?options:options.language||'zh',modelId=typeof options==='string'?'base':options.modelId||'base';speechController=new AbortController();try{return await transcribeMedia(bytes,{language,directory:speechDirectory,modelPath:await resolveSpeechModel(modelDirectory,modelId),signal:speechController.signal,progress:value=>{if(!event.sender.isDestroyed())event.sender.send('studio:speech-progress',value);}});}finally{speechController=null;}});
  ipcMain.handle('studio:cancel-speech',event=>{checkSender(event);speechController?.abort();});
  ipcMain.handle('studio:save-project',async(event,files,saveAs)=>{checkSender(event);let path=saveAs?null:projectPath;if(!path){const result=await dialog.showSaveDialog(mainWindow,{title:'儲存 EduVideo 專案',defaultPath:'未命名.eduv',buttonLabel:'儲存專案',filters:[{name:'EduVideo 專案',extensions:['eduv']}]});if(result.canceled)return null;path=result.filePath;if(!path.toLowerCase().endsWith('.eduv'))path+='.eduv';}await savePackage(path,files);projectPath=path;return {path};});
  ipcMain.handle('studio:open-project',async event=>{checkSender(event);const result=await dialog.showOpenDialog(mainWindow,{title:'開啟 .eduv 專案',properties:['openFile','openDirectory','treatPackageAsDirectory'],filters:[{name:'EduVideo 專案',extensions:['eduv','eduvideo','zip']}]});if(result.canceled)return null;return readSelectedProject(result.filePaths[0]);});
  ipcMain.handle('studio:pending-project',async event=>{checkSender(event);if(!pendingOpen)return null;const path=pendingOpen;pendingOpen=null;return readSelectedProject(path);});
  ipcMain.handle('studio:forget-project',event=>{checkSender(event);projectPath=null;});
  ipcMain.handle('studio:encode', async (event, bytes) => {
    if (event.sender !== mainWindow?.webContents || event.senderFrame !== event.sender.mainFrame) throw new Error('不允許的編碼請求');
    if (encodingController) throw new Error('正在匯出影片');
    encodingController = new AbortController();
    try { return await encodeMp4(bytes, { signal: encodingController.signal }); }
    finally { encodingController = null; }
  });
  ipcMain.handle('studio:cancel-encode', event => {
    if (event.sender !== mainWindow?.webContents) throw new Error('不允許的取消請求');
    encodingController?.abort();
  });
  ipcMain.on('edu:source-selected', (_event, sourceId) => {
    if (typeof sourceId === 'string') closeSourcePicker(sourceId);
  });
  ipcMain.on('edu:source-cancelled', () => closeSourcePicker());
  installMediaHandlers();
  await createWindow();
  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
    else if(mainWindow&&!mainWindow.isDestroyed()){mainWindow.show();mainWindow.focus();}
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
