import {spawn} from 'node:child_process';import {mkdtemp,writeFile,readFile,rm,access,open} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import ffmpegPath from 'ffmpeg-static';
import {parseWhisperJson,whisperCues} from './whisper-result.mjs';
import {whisperExecutable,unpackedPath,whisperResponseFile} from './platform.mjs';
export {whisperCues} from './whisper-result.mjs';
async function wavDuration(path){const file=await open(path,'r');try{const header=Buffer.alloc(4096);const {bytesRead}=await file.read(header,0,header.length,0);for(let offset=12;offset+8<=bytesRead;){const length=header.readUInt32LE(offset+4);if(header.toString('ascii',offset,offset+4)==='data')return Math.min(length,(await file.stat()).size-offset-8)/32000;offset+=8+length+(length%2);}throw new Error('音訊長度無法讀取');}finally{await file.close();}}
function run(binary,args,signal,progress,cwd){return new Promise((resolve,reject)=>{const child=spawn(binary,args,{signal,cwd});let error='';child.stdout.resume();child.stderr.on('data',data=>{const text=data.toString();error=(error+text).slice(-3000);for(const m of text.matchAll(/progress\s*=\s*(\d+)%/g))progress(Number(m[1]));});child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error(`語音處理失敗：${error}`)));});}
export async function transcribeMedia(bytes,{directory,modelPath,language='zh',signal,progress=()=>{}}={}){
  if(!(bytes instanceof Uint8Array)||!bytes.length)throw new Error('沒有可辨識的聲音');if(!['zh','en','ja','auto'].includes(language))throw new Error('不支援的辨識語言');signal?.throwIfAborted();
  const binary=resolve(directory,whisperExecutable()),model=resolve(modelPath||join(directory,'ggml-base.bin'));await Promise.all([access(binary),access(model)]);
  const temp=await mkdtemp(join(tmpdir(),'eduv-speech-'));
  try{const input=join(temp,'source.media'),wav=join(temp,'speech.wav'),out=join(temp,'result');await writeFile(input,bytes);progress({stage:'extract',percent:0});
    await run(unpackedPath(ffmpegPath),['-v','error','-y','-i',input,'-vn','-ac','1','-ar','16000','-c:a','pcm_s16le',wav],signal,()=>{});
    progress({stage:'recognize',percent:0});
    await writeFile(join(temp,'args.txt'),whisperResponseFile({model,audio:'speech.wav',output:'result',language,prompt:language==='zh'?'以下是繁體中文教學逐字稿。':''}));
    await run(binary,['@args.txt'],signal,percent=>progress({stage:'recognize',percent}),temp);signal?.throwIfAborted();const duration=await wavDuration(wav);return whisperCues(parseWhisperJson(await readFile(`${out}.json`))).map(c=>({...c,end:Math.min(c.end,duration)})).filter(c=>c.end>c.start);
  }finally{await rm(temp,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
}
