import {SourceDeck,containRect} from './source-deck.js';
import {cameraPreviewSender} from './camera-preview.js';

export function mountRecordingWorkspace({canvas,ctx,getMode,getBusy,getRecording,getPreview,getPage,getSlideCount,getSlide,getNotes,setNotes,redraw,replaceAnnotations,status}){
  const deck=new SourceDeck(),native=window.studioNative,$=id=>document.getElementById(id);
  let preparing=false,enabled=false,shown=false,cameraVisible=true,audioContext,destination,silence,connections=[],notesTimer;
  const cameraSender=cameraPreviewSender(native,()=>shown&&cameraVisible?getPreview():null,e=>status('桌面人像預覽失敗：'+e.message));
  const panel=document.createElement('section');panel.className='prepared-sources';
  panel.innerHTML='<div class="source-heading"><strong>準備好的來源</strong><button id="prepare-source">＋ 準備視窗／螢幕</button><button id="desktop-tools">桌面小工具</button></div><div id="source-deck" role="group" aria-label="快速切換來源"></div><p class="hint" id="source-help">先準備好來源，再一鍵切換；錄製中也能切換，不會中斷人像與聲音。</p>';
  document.querySelector('.library').prepend(panel);
  const captureOptions=document.createElement('div');captureOptions.className='capture-options';
  captureOptions.innerHTML='<label class="capture-option"><input id="include-chrome" type="checkbox"> 包含 EduVideo 相關畫面</label><p class="hint">僅適用整個螢幕錄製。人像預覽由小工具的相機圖示開關，不影響獨立錄影。</p><p class="hint capture-warning">系統可能無法排除 EduVideo 視窗（包含 macOS），請先試錄確認；私人筆記請放在未錄製的螢幕。</p>';
  document.querySelector('.device-setup').append(captureOptions);
  $('desktop-tools').hidden=!native?.toggleDesktopTools;
  function documentForSource(){return deck.activeId==='slides'?getSlide():deck.current;}
  function syncTools(){
    $('include-chrome').disabled=deck.current.kind!=='screen';
    cameraSender.sync();
    if(!native)return;
    const s=deck.current,v=s.video;
    native.updateDesktopTools({includeChrome:$('include-chrome').checked,source:{id:s.id,kind:s.kind||'slides',displayId:s.displayId},sources:deck.items.map(s=>({id:s.id,name:s.name})),recording:Boolean(getRecording()),busy:getBusy(),cameraReady:Boolean(getPreview()),clock:$('clock').textContent,countdown:$('countdown').hidden?null:$('countdown').textContent,status:$('status').textContent,page:getPage(),slideCount:getSlideCount(),paused:Boolean(getRecording()?.pausedAt),notes:getNotes(),annotations:documentForSource()?.annotations||[],rect:containRect(v?.videoWidth||1280,v?.videoHeight||720)});
  }
  function render(){
    $('source-deck').replaceChildren(...deck.items.map((s,index)=>{
      const card=document.createElement('div');card.className='prepared-source';
      const button=document.createElement('button');button.textContent=(index+1)+' · '+s.name;button.setAttribute('aria-pressed',s.id===deck.activeId);button.onclick=()=>select(s.id);card.append(button);
      if(s.id!=='slides'){const close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label','移除來源 '+s.name);close.onclick=()=>{deck.remove(s.id);select(deck.activeId);};card.append(close);}
      return card;
    }));
    $('prepare-source').disabled=preparing||deck.items.length>=5;
    $('source').value=deck.activeId==='slides'?'slides':'screen';document.body.dataset.source=$('source').value;
    syncTools();
  }
  function routeAudio(){
    connections.forEach(n=>n.disconnect());connections=[];
    if(!audioContext||!deck.current.stream?.getAudioTracks().length)return;
    const node=audioContext.createMediaStreamSource(deck.current.stream);node.connect(destination);connections.push(node);
  }
  function select(id){
    if(getMode()!=='record'||getBusy())return;
    try{deck.select(id);routeAudio();render();redraw();status('目前來源：'+deck.current.name);}
    catch(e){status(e.message);}
  }
  async function prepare(){
    if(preparing||getBusy()||getMode()!=='record')return;
    if(deck.items.length>=5){status('最多準備 4 個外部來源；請先移除不需要的來源');return;}
    preparing=true;render();let stream,added=false,video;
    try{
      stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});
      const info=await native?.captureInfo?.(),track=stream.getVideoTracks()[0];
      video=document.createElement('video');video.muted=true;video.playsInline=true;video.srcObject=stream;video.className='source';document.body.append(video);await video.play();
      const id=crypto.randomUUID();deck.add({id,stream,video,name:info?.name||track.label||'外部來源',kind:info?.kind||'screen',displayId:info?.displayId});added=true;
      track.addEventListener('ended',()=>{deck.remove(id);routeAudio();render();redraw();status('來源已停止分享，已切回簡報；其他錄製仍繼續');},{once:true});
      select(id);
    }catch(e){if(!added){stream?.getTracks().forEach(t=>t.stop());video?.remove();}status(e.name==='NotAllowedError'?'已取消準備來源':e.message);}
    finally{preparing=false;render();}
  }
  $('prepare-source').onclick=prepare;
  $('include-chrome').onchange=syncTools;
  $('desktop-tools').onclick=async()=>{
    if(getMode()!=='record')return;
    try{const result=await native.toggleDesktopTools(true);enabled=result.enabled;shown=result.shown;$('desktop-tools').setAttribute('aria-pressed',shown);syncTools();
      status('已切換桌面小工具。⌘/Ctrl+Shift+H 返回工作室／切換小工具，D 畫記、N 筆記、1–5 切換來源。');
      if(enabled&&result.shortcuts.length<8)status('部分全域快捷鍵已被其他程式占用，請使用桌面小工具按鈕');
    }catch(e){status(e.message);}
  };
  native?.onToolsCommand(value=>{if(value.type==='source'){const id=value.id||deck.items[value.index]?.id;if(id)select(id);}if(value.type==='visibility'){shown=value.shown;if(value.cameraVisible!==undefined)cameraVisible=value.cameraVisible;$('desktop-tools').setAttribute('aria-pressed',shown);cameraSender.sync();}if(value.type==='closed'){enabled=false;shown=false;cameraSender.sync();$('desktop-tools').setAttribute('aria-pressed',false);}if(getRecording()&&value.type==='pause-record')$('pause-record').click();if(value.type==='record'&&getMode()==='record')$('record').click();if(value.type==='prev-slide')$('prev').click();if(value.type==='next-slide')$('next').click();});
  native?.onToolsAnnotations(value=>{if(value.sourceId!==deck.activeId||getMode()!=='record')return;replaceAnnotations(value.annotations,value.transient);});
  native?.onToolsCommand(value=>{if(value.type==='preview-camera'&&getMode()==='record'&&!getPreview()&&!getBusy())$('devices').click();});
  native?.onToolsNotes(value=>{setNotes(value);clearTimeout(notesTimer);notesTimer=setTimeout(()=>$('notes').dispatchEvent(new Event('change')),400);});
  $('notes').addEventListener('input',syncTools);
  window.addEventListener('beforeunload',()=>deck.dispose());
  render();
  return {
    get document(){return documentForSource();},
    get current(){return deck.current;},
    syncTools,prepare,select,
    draw(){if(deck.activeId==='slides')return false;const v=deck.current.video;if(v?.readyState>=2){const r=containRect(v.videoWidth,v.videoHeight);ctx.drawImage(v,r.x,r.y,r.width,r.height);}return true;},
    async capture(){
      if($('source').value==='screen'&&deck.activeId==='slides'){throw new Error('請先按「準備視窗／螢幕」選擇來源');}
      audioContext||=new AudioContext();
      if(!destination){
        destination=audioContext.createMediaStreamDestination();
        // Keep the audio clock moving even when the selected source has no audio.
        // Otherwise MediaRecorder may wait forever for this track and emit an empty video.
        silence=audioContext.createConstantSource();silence.offset.value=0;silence.connect(destination);silence.start();
      }
      await audioContext.resume();routeAudio();redraw();
      const stream=canvas.captureStream(30);stream.addTrack(destination.stream.getAudioTracks()[0].clone());return stream;
    },
    async hide(){if(enabled){await native.toggleDesktopTools(false);enabled=false;}},
    refresh:render
  };
}
