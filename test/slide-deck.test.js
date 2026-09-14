import test from 'node:test';
import assert from 'node:assert/strict';
import {changeSlides} from '../src/slide-deck.js';
const deck=()=>({slides:[{title:'A',annotations:[{text:'記號'}]},{title:'B'},{title:'C'}],page:1});
test('reorder follows the selected slide and does not mutate its source',()=>{
  const before=deck(),after=changeSlides(before,{type:'move',from:0,to:2});
  assert.deepEqual(after.slides.map(s=>s.title),['B','C','A']);assert.equal(after.page,0);
  assert.deepEqual(before.slides.map(s=>s.title),['A','B','C']);
});
test('duplicate keeps annotations independent and selects the copy',()=>{
  const before={...deck(),page:0},after=changeSlides(before,{type:'duplicate'});
  assert.equal(after.page,1);assert.equal(after.slides.length,4);
  after.slides[1].annotations[0].text='新';assert.equal(before.slides[0].annotations[0].text,'記號');
});
test('inserts all imported pages after selection and handles empty decks',()=>{
  const after=changeSlides(deck(),{type:'insert',slides:[{title:'X'},{title:'Y'}]});
  assert.deepEqual(after.slides.map(s=>s.title),['A','B','X','Y','C']);assert.equal(after.page,2);
  assert.equal(changeSlides({slides:[],page:0},{type:'insert',slides:[{title:'X'}]}).page,0);
});
test('deleting last page selects previous and deleting final page leaves valid empty state',()=>{
  assert.equal(changeSlides({...deck(),page:2},{type:'delete'}).page,1);
  assert.deepEqual(changeSlides({slides:[{title:'A'}],page:0},{type:'delete'}),{slides:[],page:0});
  assert.throws(()=>changeSlides(deck(),{type:'move',from:0,to:9}));
});
