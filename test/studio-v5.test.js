import test from 'node:test';
import assert from 'node:assert/strict';
import {splitReadableCues,normalizeCaptionStyle,drawCaptions} from '../src/captions.js';
import {SPEECH_MODELS,modelById,browserModelSupported} from '../src/speech-models.js';
import {transcriptionCues} from '../src/speech-api.js';

test('recognized paragraphs become short readable cues without losing text',()=>{
  const input=[{id:'one',start:0,end:8,text:'今天我們先認識錄影工具，接著一起完成字幕編輯。最後匯出影片！'}];
  const cues=splitReadableCues(input,{maxChars:12,maxSeconds:3});
  assert.ok(cues.length>=3);
  assert.ok(cues.every(c=>c.end>c.start));
  assert.equal(cues.map(c=>c.text).join(''),input[0].text);
  assert.equal(cues[0].start,0);
  assert.equal(cues.at(-1).end,8);
});

test('caption style presets include outline-only and normalize unsafe values',()=>{
  const style=normalizeCaptionStyle({preset:'outline',size:999,color:'bad',outlineWidth:9,backgroundOpacity:-1});
  assert.equal(style.preset,'outline');
  assert.equal(style.size,72);
  assert.equal(style.color,'#ffffff');
  assert.equal(style.backgroundOpacity,0);
  assert.equal(style.outlineWidth,8);
});

test('outline caption draws stroke text without a background plate',()=>{
  let fills=0,strokes=0,plates=0;
  const ctx={canvas:{width:1280,height:720},save(){},restore(){},measureText:s=>({width:s.length*18}),fillRect(){plates++;},fillText(){fills++;},strokeText(){strokes++;}};
  drawCaptions(ctx,{captions:[{start:0,end:2,text:'外框字幕'}]},1,{preset:'outline'});
  assert.ok(fills>0);
  assert.ok(strokes>0);
  assert.equal(plates,0);
});

test('speech model catalog distinguishes browser-sized and desktop quality models',()=>{
  assert.ok(SPEECH_MODELS.every(m=>m.id&&m.url&&m.bytes>0&&m.sha1));
  assert.equal(browserModelSupported('small'),true);
  assert.equal(browserModelSupported('large-v3-turbo-q5_0'),false);
  assert.equal(modelById('large-v3').label,'Whisper large-v3');
  assert.throws(()=>modelById('../escape'));
});

test('API transcript parser accepts timed and untimed high-quality results',()=>{
  assert.deepEqual(transcriptionCues({segments:[{start:1,end:2,text:' hello '}]},10).map(c=>[c.start,c.end,c.text]),[[1,2,'hello']]);
  assert.deepEqual(transcriptionCues({text:'完整逐字稿'},7).map(c=>[c.start,c.end,c.text]),[[0,7,'完整逐字稿']]);
});
