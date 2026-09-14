import assert from 'node:assert/strict';import {readFile,mkdtemp,mkdir,copyFile,rm} from 'node:fs/promises';import {resolve,join,basename} from 'node:path';import {tmpdir} from 'node:os';
const bytes=new Uint8Array(await readFile(process.env.SPEECH_TEST_SAMPLE||'.build-whisper/samples/jfk.wav'));const directory=resolve(process.env.SPEECH_TEST_DIR||'native/speech');
let modelPath=process.env.SPEECH_TEST_MODEL?resolve(process.env.SPEECH_TEST_MODEL):undefined,cleanup=null;
// SPEECH_TEST_UNICODE=1 puts the model and temporary files under non-ASCII folders, as with a Chinese Windows user name.
if(process.env.SPEECH_TEST_UNICODE==='1'){
  const root=await mkdtemp(join(tmpdir(),'eduv-測試-'));cleanup=root;
  const models=join(root,'語音 模型');await mkdir(models);const source=modelPath||join(directory,'ggml-base.bin');modelPath=join(models,basename(source));await copyFile(source,modelPath);
  const temp=join(root,'暫存 資料夾');await mkdir(temp);for(const key of ['TMPDIR','TEMP','TMP'])process.env[key]=temp;
  assert.equal(tmpdir(),temp);
}
const {transcribeMedia}=await import('../electron/transcribe.mjs');
try{
  const cues=await transcribeMedia(bytes,{directory,modelPath,language:'en'});assert.ok(cues.length);assert.match(cues.map(c=>c.text).join(' '),/country/i);assert.ok(cues.every(c=>c.start>=0&&c.end>c.start));assert.ok(cues.some(c=>c.words?.length),'native recognizer retains token timestamps');
  const zh=await transcribeMedia(bytes,{directory,modelPath,language:'zh'});assert.ok(zh.length,'zh prompt passes through the response file');
  const controller=new AbortController();controller.abort();await assert.rejects(()=>transcribeMedia(bytes,{directory,modelPath,signal:controller.signal}),{name:'AbortError'});
  console.log('Offline speech recognition, timed captions and pre-cancellation passed:',cues.map(c=>c.text).join(' '));
}finally{if(cleanup)await rm(cleanup,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
