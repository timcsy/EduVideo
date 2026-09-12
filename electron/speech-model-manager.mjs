import {mkdir,stat,rename,unlink,open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {SPEECH_MODELS,modelById} from '../src/speech-models.js';

export const modelPath=(directory,id)=>join(directory,`ggml-${modelById(id).id}.bin`);

export async function listSpeechModels(directory){
  return Promise.all(SPEECH_MODELS.map(async model=>{try{const info=await stat(modelPath(directory,model.id));return {...model,installed:info.isFile()&&info.size>model.bytes*.9,downloadedBytes:info.size};}catch{return {...model,installed:false,downloadedBytes:0};}}));
}

export async function downloadSpeechModel(directory,id,{signal,progress=()=>{},fetcher=fetch}={}){
  const model=modelById(id);await mkdir(directory,{recursive:true});signal?.throwIfAborted();
  const response=await fetcher(model.url,{signal,redirect:'follow'});if(!response.ok||!response.body)throw new Error(`模型下載失敗（HTTP ${response.status}）`);
  const temporary=`${modelPath(directory,id)}.part`,file=await open(temporary,'w'),hash=createHash('sha1');let received=0;
  try{for await(const chunk of response.body){signal?.throwIfAborted();await file.write(chunk);hash.update(chunk);received+=chunk.length;progress({id,received,total:Number(response.headers.get('content-length'))||model.bytes,percent:Math.min(99,Math.round(received/model.bytes*100))});}await file.close();if(hash.digest('hex')!==model.sha1)throw new Error('模型校驗失敗，檔案可能未完整下載');await rename(temporary,modelPath(directory,id));progress({id,received,total:received,percent:100});return modelPath(directory,id);}
  catch(error){await file.close().catch(()=>{});await unlink(temporary).catch(()=>{});throw error;}
}

export async function removeSpeechModel(directory,id){await unlink(modelPath(directory,id)).catch(error=>{if(error.code!=='ENOENT')throw error;});}
export async function resolveSpeechModel(directory,id){const path=modelPath(directory,id);const info=await stat(path).catch(()=>null);if(!info?.isFile())throw new Error('請先下載所選的離線模型');return path;}
