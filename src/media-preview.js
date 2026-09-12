const cache=new WeakMap();
import {detectAudioEdges} from './timeline-snap.js';
export function mediaPreview(media){
  if(cache.has(media.screen))return cache.get(media.screen);
  const promise=(async()=>{const url=URL.createObjectURL(media.screen),video=document.createElement('video');video.muted=true;video.preload='auto';let audio;
    try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('preview timeout')),12000);video.onloadeddata=()=>{clearTimeout(timer);resolve();};video.onerror=()=>{clearTimeout(timer);reject(new Error('preview unavailable'));};video.src=url;});
      const c=document.createElement('canvas');c.width=160;c.height=90;c.getContext('2d').drawImage(video,0,0,160,90);let peaks=[],landmarks=[];
      try{audio=new AudioContext();const decoded=await audio.decodeAudioData(await media.camera.arrayBuffer());const data=decoded.getChannelData(0),step=Math.max(1,Math.floor(data.length/512));landmarks=detectAudioEdges(data,decoded.sampleRate);peaks=Array.from({length:512},(_,i)=>{let max=0;for(let j=i*step;j<Math.min(data.length,(i+1)*step);j+=16)max=Math.max(max,Math.abs(data[j]));return max;});}catch{}
      return {poster:c.toDataURL('image/jpeg',.65),peaks,landmarks};
    }finally{video.removeAttribute('src');video.load();URL.revokeObjectURL(url);await audio?.close();}})();cache.set(media.screen,promise);return promise;
}
export function waveform(peaks,start,end,duration){const c=document.createElement('canvas');c.width=512;c.height=24;const ctx=c.getContext('2d');ctx.strokeStyle='#99c8c0';ctx.lineWidth=1;ctx.beginPath();for(let x=0;x<512;x++){const index=Math.min(511,Math.floor((start+(end-start)*x/512)/duration*512)),height=Math.max(1,peaks[index]*22);ctx.moveTo(x,12-height/2);ctx.lineTo(x,12+height/2);}ctx.stroke();return c.toDataURL();}
