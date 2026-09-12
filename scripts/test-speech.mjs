import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {resolve} from 'node:path';import {transcribeMedia} from '../electron/transcribe.mjs';
const bytes=new Uint8Array(await readFile('.build-whisper/samples/jfk.wav'));const directory=process.env.SPEECH_TEST_DIR||resolve('native/speech');
const cues=await transcribeMedia(bytes,{directory,language:'en'});assert.ok(cues.length);assert.match(cues.map(c=>c.text).join(' '),/country/i);assert.ok(cues.every(c=>c.start>=0&&c.end>c.start));assert.ok(cues.some(c=>c.words?.length),'native recognizer retains token timestamps');
const controller=new AbortController();controller.abort();await assert.rejects(()=>transcribeMedia(bytes,{directory,signal:controller.signal}),{name:'AbortError'});
console.log('Offline speech recognition, timed captions and pre-cancellation passed:',cues.map(c=>c.text).join(' '));
