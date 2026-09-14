// Local WebRTC reuses the existing video track: no second camera, microphone or AI pass.
export function cameraPreviewSender(api,getStream,onError=()=>{}){
  if(!api?.onCameraSignal)return {sync(){}};
  let peer=null,track=null,requested=false,session=null,queue=Promise.resolve();
  function close(){peer?.close();peer=null;track=null;session=null;}
  async function sync(){
    const next=getStream()?.getVideoTracks().find(t=>t.readyState==='live');
    if(!requested||!next){if(peer){api.cameraSignal({type:'close',session});close();}return;}
    if(peer&&next===track)return;
    close();session=crypto.randomUUID();const id=session;track=next;
    peer=new RTCPeerConnection({iceServers:[]});const current=peer;
    current.onicecandidate=e=>{if(e.candidate&&session===id)api.cameraSignal({type:'candidate',session:id,candidate:e.candidate.toJSON()});};
    current.addTrack(next,new MediaStream([next]));
    await current.setLocalDescription(await current.createOffer());
    api.cameraSignal({type:'offer',session:id,description:current.localDescription.toJSON()});
  }
  function enqueue(action){queue=queue.then(action).catch(e=>{close();onError(e);});}
  api.onCameraSignal(value=>enqueue(async()=>{
    if(value.type==='ready'){requested=true;close();await sync();return;}
    if(value.session!==session||!peer)return;
    if(value.type==='answer')await peer.setRemoteDescription(value.description);
    if(value.type==='candidate')await peer.addIceCandidate(value.candidate);
  }));
  api.cameraSignal({type:'ready'});
  window.addEventListener('beforeunload',close);
  return {sync(){enqueue(sync);}};
}
export function cameraPreviewReceiver(api,video,onError=()=>{}){
  let peer,session,queue=Promise.resolve();
  api.onCameraSignal(value=>{queue=queue.then(async()=>{
    if(value.type==='ready'){api.cameraSignal({type:'ready'});return;}
    if(value.type==='offer'){
      peer?.close();session=value.session;const id=session;
      peer=new RTCPeerConnection({iceServers:[]});
      peer.ontrack=e=>{video.srcObject=e.streams[0];video.play().catch(onError);};
      peer.onicecandidate=e=>{if(e.candidate&&id===session)api.cameraSignal({type:'candidate',session:id,candidate:e.candidate.toJSON()});};
      await peer.setRemoteDescription(value.description);await peer.setLocalDescription(await peer.createAnswer());
      api.cameraSignal({type:'answer',session,description:peer.localDescription.toJSON()});
    }else if(value.session===session){
      if(value.type==='candidate')await peer?.addIceCandidate(value.candidate);
      if(value.type==='close'){peer?.close();peer=null;video.srcObject=null;}
    }
  }).catch(onError);});
  api.cameraSignal({type:'ready'});
  window.addEventListener('beforeunload',()=>peer?.close());
}
