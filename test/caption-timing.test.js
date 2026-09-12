import test from 'node:test';
import assert from 'node:assert/strict';
import {parseWhisperJson,whisperCues} from '../electron/whisper-result.mjs';
import {splitReadableCues} from '../src/captions.js';

test('native JSON reassembles Chinese UTF-8 split across tokenizer pieces',()=>{
  const bytes=Buffer.from('腦'),pieces=[bytes.subarray(0,2),bytes.subarray(2)];
  const raw=Buffer.concat([Buffer.from('{"transcription":[{"text":"電腦","offsets":{"from":0,"to":1000},"tokens":[{"text":"電","offsets":{"from":0,"to":400}},{"text":"'),pieces[0],Buffer.from('","offsets":{"from":400,"to":700}},{"text":"'),pieces[1],Buffer.from('","offsets":{"from":700,"to":1000}}]}]}')]);
  const cues=whisperCues(parseWhisperJson(raw));
  assert.deepEqual(cues[0].words.map(w=>[w.text,w.start,w.end]),[['電',0,.4],['腦',.4,1]]);
  assert.equal(cues[0].text,'電腦');
});

test('partial token matches use neighboring audio anchors instead of overlapping proportional clocks',()=>{
  const text='文字資料在幹嘛呢我們要在電腦裡面表示文字呢';
  const cues=splitReadableCues([{id:'a',start:0,end:20,text,words:[{text:'文字資料在幹嘛呢',start:6.92,end:11.11},{text:'我們要在電',start:11.17,end:12.7},{text:'裡面表示文字呢',start:13.05,end:15.28}]}]);
  assert.equal(cues.length,2);assert.equal(cues[0].start,6.92);assert.equal(cues[0].end,11.11);assert.equal(cues[1].start,11.17);assert.equal(cues[1].end,15.28);assert.ok(cues[0].end<=cues[1].start);
  assert.ok(cues[1].words.length,'partial timing evidence survives');
});

test('a pause before a sentence-final particle does not create a one-character subtitle',()=>{
  const result=splitReadableCues([{id:'a',start:31,end:39,text:'電腦是怎麼樣做比較的呢',words:[{text:'電腦是怎麼樣做比較的',start:31,end:37.8},{text:'呢',start:38.7,end:38.98}]}]);
  assert.equal(result.length,1);assert.equal(result[0].end,38.98);
});

test('normal pauses remain boundaries even when a paragraph ends with a particle',()=>{
  const result=splitReadableCues([{id:'a',start:0,end:8,text:'今天先看文字OK我們來試試看呢',words:[{text:'今天先看文字',start:0,end:2},{text:'OK',start:3,end:3.5},{text:'我們來試試看呢',start:3.5,end:8}]}]);
  assert.equal(result.length,2);assert.equal(result[0].end,2);assert.equal(result[1].start,3);
});

test('resegmenting retains clocks, including zero duration tokens and cross-segment trailing particles',()=>{
  const raw=[{id:'a',start:0,end:2,text:'我們比較一下',words:[{text:'我們',start:.2,end:.2},{text:'比較一下',start:.3,end:1.9}]},{id:'b',start:2,end:2.2,text:'呢',words:[{text:'呢',start:2,end:2.2}]}];
  const first=splitReadableCues(raw),second=splitReadableCues(first);
  assert.equal(first.length,1);assert.equal(first[0].text,'我們比較一下呢');assert.equal(first[0].start,.2);assert.equal(first[0].end,2.2);
  assert.deepEqual(second.map(c=>[c.start,c.end,c.text]),first.map(c=>[c.start,c.end,c.text]));
});
