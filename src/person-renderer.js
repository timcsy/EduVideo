import { cameraRect, drawContained, DEFAULT_LAYOUT } from './layout.js';
import {refineMask} from './mask-refinement.js';
import {backdropUrl} from './background-presets.js';
// Masks are applied during composition; the camera's original audio and pixels stay intact.
export async function createPersonRenderer({preview=false}={}) {
  if (!globalThis.SelfieSegmentation) await new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = './vendor/segmentation/selfie_segmentation.js';
    script.onload = resolve; script.onerror = () => reject(new Error('去背模型無法載入')); document.head.append(script);
  });
  const segmenter = new globalThis.SelfieSegmentation({ locateFile: file => new URL(`../vendor/segmentation/${file}`, import.meta.url).href });
  segmenter.setOptions({ modelSelection: 0 });
  const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480;
  const ctx = canvas.getContext('2d');
  const mask=document.createElement('canvas');mask.width=640;mask.height=480;const maskCtx=mask.getContext('2d',{willReadFrequently:true});let options={},previous,pending=null,lastSent=0,ready=false;
  segmenter.onResults(results => {
    maskCtx.clearRect(0,0,640,480);maskCtx.drawImage(results.segmentationMask,0,0,640,480);
    const pixels=maskCtx.getImageData(0,0,640,480);refineMask(pixels.data,previous,options);previous=new Uint8ClampedArray(pixels.data);maskCtx.putImageData(pixels,0,0);
    ctx.clearRect(0, 0, 640, 480); ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(results.image, 0, 0, 640, 480); ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, 0, 0, 640, 480); ctx.globalCompositeOperation = 'source-over';
    ready=true;
  });
  return { process: async (video,settings={}) => { options=settings;if(!preview){await segmenter.send({image:video});return canvas;}const now=performance.now();if(!pending&&now-lastSent>=80){lastSent=now;pending=segmenter.send({image:video}).finally(()=>{pending=null;});}if(!ready&&pending)await pending;return canvas; }, reset:()=>{previous=null;}, close:async()=>{await pending?.catch(()=>{});return segmenter.close();} };
}
const backdrops=new Map();
export async function loadBackdrop(project) {
  const url=backdropUrl(project.layout);if(!url)return;
  if(!backdrops.has(url)){const image=new Image();const ready=new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('背景圖片載入失敗'));});image.src=url;backdrops.set(url,{image,ready});}
  await backdrops.get(url).ready;
}
function drawCover(ctx,source,rect,mirror,zoom=1) {
  const sw=source.videoWidth||source.naturalWidth||source.width,sh=source.videoHeight||source.naturalHeight||source.height;if(!sw||!sh)return;
  const ratio=Math.max(rect.width/sw,rect.height/sh)*zoom;ctx.save();ctx.translate(rect.x+rect.width/2,rect.y+rect.height/2);if(mirror)ctx.scale(-1,1);ctx.drawImage(source,-sw*ratio/2,-sh*ratio/2,sw*ratio,sh*ratio);ctx.restore();
}
export function drawComposition(ctx, screen, camera, project, originalCamera=camera) {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height); drawContained(ctx, screen, 0, 0, width, height);
  const layout = { ...DEFAULT_LAYOUT, ...project.layout };
  if (!layout.visible) return;
  const rect = cameraRect(project, width, height);
  ctx.save();ctx.beginPath();
  if(layout.shape==='circle')ctx.ellipse(rect.x+rect.width/2,rect.y+rect.height/2,rect.width/2,rect.height/2,0,0,Math.PI*2);
  else if(layout.shape==='rounded')ctx.roundRect(rect.x,rect.y,rect.width,rect.height,rect.width*.09);
  else ctx.rect(rect.x,rect.y,rect.width,rect.height);
  if(layout.shadow){ctx.save();ctx.shadowColor='#0009';ctx.shadowBlur=20;ctx.shadowOffsetY=5;ctx.fillStyle=layout.color;ctx.fill();ctx.restore();}
  ctx.save();ctx.clip();
  if(layout.backdrop==='solid'||layout.backdrop==='gradient'){ctx.fillStyle=layout.color;if(layout.backdrop==='gradient'){const g=ctx.createLinearGradient(rect.x,rect.y,rect.x+rect.width,rect.y+rect.height);g.addColorStop(0,layout.color);g.addColorStop(1,'#080b14');ctx.fillStyle=g;}ctx.fillRect(rect.x,rect.y,rect.width,rect.height);}
  if(layout.backdrop==='blur'){ctx.save();ctx.filter='blur(14px)';drawCover(ctx,originalCamera,rect,layout.mirror,1.15);ctx.restore();}
  if(layout.backdrop==='image'&&backdrops.get(backdropUrl(layout))?.image.complete)drawCover(ctx,backdrops.get(backdropUrl(layout)).image,rect,false);
  if(layout.fit==='cover'||layout.shape==='circle'||layout.zoom>1)drawCover(ctx,camera,rect,layout.mirror,layout.zoom);
  else drawContained(ctx, camera, rect.x, rect.y, rect.width, rect.height, layout.mirror);
  ctx.restore();if(layout.border){ctx.lineWidth=layout.border;ctx.strokeStyle=layout.borderColor;ctx.stroke();}ctx.restore();
}
