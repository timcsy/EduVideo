import {BrowserWindow,ipcMain,screen,globalShortcut} from 'electron';
import {join} from 'node:path';
import {desktopVisibility,protectCaptureWindow} from './desktop-policy.mjs';

// Only our studio and the dedicated tools pages may send these messages.
export function installDesktopTools({root,getMain,isDev}){
  let windows={},enabled=false,shown=false,draw=false,notesVisible=false,cameraVisible=true,align=false,state={},shortcuts=[];
  const liveMain=()=>{const w=getMain();return w&&!w.isDestroyed()?w:null;};
  const main=()=>liveMain()?.webContents;
  const send=(channel,value)=>{const contents=main();if(contents&&!contents.isDestroyed())contents.send(channel,value);};
  const valid=event=>!event.sender.isDestroyed()&&event.senderFrame===event.sender.mainFrame&&
    (event.sender===main()||Object.values(windows).some(w=>!w.isDestroyed()&&w.webContents===event.sender));
  function publish(){for(const w of Object.values(windows))if(!w.isDestroyed())w.webContents.send('tools:state',{...state,enabled,shown,draw,align,notesVisible,cameraVisible,shortcuts});send('studio:tools-command',{type:'visibility',shown,cameraVisible});}
  function protect(){for(const w of BrowserWindow.getAllWindows()){const role=Object.keys(windows).find(role=>windows[role]===w)||'main';w.setContentProtection(protectCaptureWindow({kind:state.source?.kind,includeChrome:state.includeChrome},role));}}
  function create(role,bounds){
    const w=new BrowserWindow({...bounds,show:false,frame:false,transparent:role==='overlay',resizable:role!=='toolbar',skipTaskbar:true,
      backgroundColor:role==='overlay'?'#00000000':'#191b24',title:'EduVideo '+role,
      webPreferences:{preload:join(root,'electron','tools-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
    w.setAlwaysOnTop(true,'screen-saver');w.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
    w.setContentProtection(protectCaptureWindow({kind:state.source?.kind,includeChrome:state.includeChrome},role));
    w.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    w.webContents.on('did-finish-load',publish);
    w.on('closed',()=>{if(windows[role]===w){delete windows[role];if(role==='camera'){cameraVisible=false;publish();}}});
    w.loadFile(join(root,isDev?'':'dist','desktop-tools.html'),{query:{role}});
    windows[role]=w;return w;
  }
  function ensure(){
    const bounds=screen.getPrimaryDisplay().bounds,work=screen.getPrimaryDisplay().workArea;
    if(!windows.overlay)create('overlay',bounds);
    if(!windows.toolbar)create('toolbar',{x:work.x+work.width-358,y:work.y+24,width:338,height:126});
    if(!windows.notes)create('notes',{x:work.x+work.width-410,y:work.y+170,width:390,height:390});
    if(!windows.camera)create('camera',{x:work.x+work.width-300,y:work.y+work.height-260,width:280,height:240});
  }
  function placeOverlay(){
    const w=windows.overlay;if(!w)return;
    if(state.source?.kind==='screen'){
      const display=screen.getAllDisplays().find(d=>String(d.id)===state.source.displayId)||screen.getPrimaryDisplay();
      w.setBounds(display.bounds);align=false;
    }
  }
  function visibility(){
    if(!enabled)return;
    ensure();
    const visible=desktopVisibility({enabled,shown,cameraVisible,cameraReady:state.cameraReady,notesVisible,kind:state.source?.kind});
    if(!visible.main)liveMain()?.hide();
    for(const [role,w] of Object.entries(windows)){if(visible[role])w.showInactive();else w.hide();}
    if(visible.overlay)windows.overlay.setIgnoreMouseEvents(!draw&&!align,{forward:true});
    if(visible.toolbar)windows.toolbar.moveTop();
    if(visible.main&&liveMain()&&!liveMain().isVisible()){liveMain().show();liveMain().focus();}
    publish();
  }
  function command(value){
    if(value.type==='draw'){shown=true;draw=!draw;align=false;visibility();}
    else if(value.type==='notes'){shown=true;notesVisible=!notesVisible;visibility();}
    else if(value.type==='camera'){if(!state.cameraReady){cameraVisible=true;send('studio:tools-command',{type:'preview-camera'});}else cameraVisible=!cameraVisible;visibility();}
    else if(value.type==='align'){align=!align;draw=false;visibility();}
    else if(value.type==='close'){shown=!shown;draw=false;align=false;visibility();send('studio:tools-command',{type:'visibility',shown});}
    else if(value.type==='return'){shown=false;draw=false;align=false;visibility();}
    else if(['pen','highlight','arrow','rectangle','ellipse','line','eraser','undo','clear','color','width'].includes(value.type)){windows.overlay?.webContents.send('tools:command',value);}
    else if(['source','pause-record','record','prev-slide','next-slide'].includes(value.type))send('studio:tools-command',value);
    publish();
  }
  function toggle(value,notify=true){
    enabled=Boolean(value);
    if(enabled){
      shown=true;ensure();placeOverlay();
      for(const key of shortcuts)globalShortcut.unregister(key);shortcuts=[];
      const bindings=[['CommandOrControl+Shift+D',{type:'draw'}],['CommandOrControl+Shift+N',{type:'notes'}],['CommandOrControl+Shift+H',{type:'close'}],
        ...[1,2,3,4,5].map((n)=>['CommandOrControl+Shift+'+n,{type:'source',index:n-1}])];
      for(const [key,action] of bindings){if(globalShortcut.register(key,()=>command(action)))shortcuts.push(key);}
      visibility();
    }else{
      for(const key of shortcuts)globalShortcut.unregister(key);shortcuts=[];
      for(const w of Object.values(windows))if(!w.isDestroyed())w.hide();
      shown=false;draw=false;align=false;if(notify)send('studio:tools-command',{type:'closed'});
      if(notify&&liveMain()&&!liveMain().isVisible()){liveMain().show();liveMain().focus();}
    }
    return {enabled,shown,shortcuts};
  }
  ipcMain.handle('studio:tools-toggle',(e,value)=>{if(e.sender!==main()||!valid(e))throw new Error('不允許的請求');return toggle(value);});
  ipcMain.on('studio:tools-state',(e,value)=>{
    if(e.sender!==main()||!valid(e))return;
    const changed=state.source?.id!==value.source?.id,protectionChanged=state.includeChrome!==value.includeChrome||state.source?.kind!==value.source?.kind,readyChanged=state.cameraReady!==value.cameraReady;state=value;
    if(protectionChanged)protect();
    if(changed&&enabled)placeOverlay();
    if(enabled&&(changed||readyChanged))visibility();
    publish();
  });
  ipcMain.on('tools:command',(e,value)=>{if(valid(e)&&value&&typeof value.type==='string')command(value);});
  ipcMain.on('tools:annotations',(e,value)=>{if(valid(e)&&e.sender===windows.overlay?.webContents&&Array.isArray(value.annotations)&&value.annotations.length<=5000)send('studio:tools-annotations',value);});
  ipcMain.on('tools:notes',(e,value)=>{if(valid(e)&&e.sender===windows.notes?.webContents&&typeof value==='string')send('studio:tools-notes',value.slice(0,100000));});
  ipcMain.on('tools:camera-signal',(e,value)=>{
    if(!valid(e)||!value||!['offer','answer','candidate','ready','close'].includes(value.type))return;
    if(e.sender===main()){const camera=windows.camera;if(camera&&!camera.isDestroyed())camera.webContents.send('tools:camera-signal',value);}
    else if(e.sender===windows.camera?.webContents)send('tools:camera-signal',value);
  });
  return {protect,mainShown(){if(enabled&&shown&&liveMain()?.isVisible()){shown=false;draw=false;align=false;for(const w of Object.values(windows))if(!w.isDestroyed())w.hide();publish();}},dispose(){toggle(false,false);const closing=Object.values(windows);windows={};state={};notesVisible=false;for(const w of closing)if(!w.isDestroyed())w.destroy();}};
}
