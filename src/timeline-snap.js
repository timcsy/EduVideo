import {segmentDuration} from './clip-tools.js';
export function snapPoints(project,audio={}) {
  const points=[{time:0,kind:'cut'}];let offset=0;
  for(const s of project.segments){const speed=s.speed||1;
    for(const t of audio[s.takeId]||[])if(t>s.in&&t<s.out)points.push({time:offset+(t-s.in)/speed,kind:'audio'});
    for(const c of s.captions||[])for(const t of [c.start,c.end])if(t>s.in&&t<s.out)points.push({time:offset+(t-s.in)/speed,kind:'caption'});
    offset+=segmentDuration(s);points.push({time:offset,kind:'cut'});
  }return points;
}
export function snapTime(time,points,tolerance){let best=null,distance=tolerance;for(const p of points){const d=Math.abs(time-p.time);if(d<=distance){best=p;distance=d;}}return best?{...best,snapped:true}:{time,snapped:false};}
export function audioLandmarks(peaks,duration){const result=[];const max=Math.max(...peaks,0);if(max<.005)return result;const threshold=Math.max(.008,max*.07);for(let i=1;i<peaks.length;i++)if((peaks[i-1]<threshold)!==(peaks[i]<threshold))result.push(i/peaks.length*duration);return result;}
export function detectAudioEdges(samples,sampleRate){const step=Math.max(1,Math.round(sampleRate*.02)),levels=[];for(let i=0;i<samples.length;i+=step){let sum=0,count=0;for(let j=i;j<Math.min(samples.length,i+step);j+=4){sum+=samples[j]*samples[j];count++;}levels.push(Math.sqrt(sum/Math.max(1,count)));}let max=0;for(const value of levels)max=Math.max(max,value);if(max<.005)return[];const threshold=Math.max(.006,max*.08),edges=[];let state=false,candidate=false,run=0;for(let i=0;i<levels.length;i++){const active=levels[i]>threshold;if(active!==candidate){candidate=active;run=1;}else run++;if(candidate!==state&&run>=(candidate?2:6)){edges.push(Math.max(0,(i-run+1)*step/sampleRate));state=candidate;}}return edges;}
