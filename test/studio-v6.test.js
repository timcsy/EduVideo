import test from 'node:test';
import assert from 'node:assert/strict';
import {splitReadableCues,captionEntries,mergeCaption} from '../src/captions.js';

test('unpunctuated classroom speech from the reported screenshot becomes complete spoken clauses',()=>{
  const text='OK那那到底文字資料在幹嘛呢我們要怎麼樣在電腦裡面表示一個文字呢不是表示一句話呢那電腦怎麼樣理解你的語意呢我們可以想一下這個問題喔那我們可以看一下這有一個例子就是說';
  const result=splitReadableCues([{id:'reported',start:0,end:27,text}]);
  assert.deepEqual(result.map(c=>c.text),['OK那那到底文字資料在幹嘛呢','我們要怎麼樣在電腦裡面表示一個文字呢','不是表示一句話呢','那電腦怎麼樣理解你的語意呢','我們可以想一下這個問題喔','那我們可以看一下這有一個例子就是說']);
  assert.equal(result.map(c=>c.text).join(''),text);
  assert.equal(result.at(-1).end,27);
});

test('oral segmentation preserves embedded questions, materials and linked grammatical phrases',()=>{
  for(const text of ['我想知道你會怎麼做這道題目','這個呢絨材料可以拿來做衣服','如果我們把文字轉成向量就可以計算相似度','我希望我們可以一起完成這個練習']){
    assert.deepEqual(splitReadableCues([{id:'a',start:0,end:8,text}]).map(c=>c.text),[text]);
  }
  const text='今天先介紹文字資料我們會先從單字開始你可以觀察兩個向量的差異';
  assert.deepEqual(splitReadableCues([{id:'a',start:0,end:12,text}]).map(c=>c.text),['今天先介紹文字資料','我們會先從單字開始','你可以觀察兩個向量的差異']);
});

test('semantic segmentation preserves complete clauses regardless of character and duration limits',()=>{
  const text='今天我們要一起認識如何使用這個錄影工具，然後再示範如何調整字幕。';
  const cues=splitReadableCues([{id:'a',start:0,end:20,text}],{maxChars:6,maxSeconds:1});
  assert.deepEqual(cues.map(c=>c.text),['今天我們要一起認識如何使用這個錄影工具，','然後再示範如何調整字幕。']);
  assert.equal(cues.map(c=>c.text).join(''),text);
});
test('unpunctuated compounds and decimal numbers are never arbitrarily sliced',()=>{
  for(const text of ['這是一段沒有可靠斷句線索的完整教學內容','Set the threshold to 3.14 before recording.']){
    const cues=splitReadableCues([{id:'a',start:0,end:30,text}]);
    assert.deepEqual(cues.map(c=>c.text),[text]);
  }
});
test('word timing preserves speech pauses and exact boundaries',()=>{
  const cues=splitReadableCues([{id:'a',start:0,end:6,text:'Hello world. Next topic.',words:[{text:'Hello',start:0,end:.5},{text:'world.',start:.6,end:1.2},{text:'Next',start:4,end:4.5},{text:'topic.',start:4.6,end:5}]}]);
  assert.deepEqual(cues.map(c=>[c.text,c.start,c.end]),[['Hello world.',0,1.2],['Next topic.',4,5]]);
});
test('project-wide subtitle entries honor cuts and speeds and identify duplicate sources',()=>{
  const s={takeId:'a',in:2,out:6,speed:2,captions:[{id:'same',start:1,end:4,text:'第一句'},{id:'next',start:4,end:7,text:'第二句'}]};
  const entries=captionEntries({segments:[s,s]});
  assert.deepEqual(entries.map(c=>[c.start,c.end,c.segmentIndex]),[[0,1,0],[1,2,0],[2,3,1],[3,4,1]]);
  assert.equal(new Set(entries.map(c=>c.key)).size,4);
});
test('joining adjacent captions is reversible without mutating original',()=>{
  const p={segments:[{captions:[{id:'a',start:0,end:1,text:'第一句，'},{id:'b',start:1,end:3,text:'第二句。'}]}]};
  const result=mergeCaption(p,0,'a');
  assert.equal(result.segments[0].captions.length,1);
  assert.equal(result.segments[0].captions[0].text,'第一句，第二句。');
  assert.equal(result.segments[0].captions[0].end,3);
  assert.equal(p.segments[0].captions.length,2);
});
