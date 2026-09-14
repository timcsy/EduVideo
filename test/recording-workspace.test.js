import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject} from '../src/edit-project.js';
import {DEFAULT_LAYOUT, updateLayout} from '../src/layout.js';
import {SourceDeck, containRect} from '../src/source-deck.js';

test('new presenter is mirrored, explicit non-mirrored projects stay unchanged', () => {
  assert.equal(DEFAULT_LAYOUT.mirror, true);
  assert.equal(updateLayout(newProject(), {}).layout.mirror, true);
  assert.equal(updateLayout({layout:{mirror:false}}, {}).layout.mirror, false);
});
test('prepared sources switch without stopping streams; removing active source falls back', () => {
  let stops=0;
  const stream={getTracks:()=>[{stop:()=>stops++}]};
  const deck=new SourceDeck();
  deck.add({id:'one',stream});deck.add({id:'two',stream});
  deck.select('one');deck.select('two');
  assert.equal(stops,0);assert.equal(deck.current.id,'two');
  deck.remove('two');assert.equal(stops,1);assert.equal(deck.current.id,'slides');
  assert.throws(()=>deck.select('missing'));
  deck.dispose();assert.equal(stops,2);
});
test('source preparation keeps independent annotation documents',()=>{
  const deck=new SourceDeck();deck.add({id:'one'});
  deck.current.annotations.push({text:'簡報'});deck.select('one');
  assert.deepEqual(deck.current.annotations,[]);
  deck.current.annotations.push({text:'視窗'});deck.select('slides');
  assert.equal(deck.current.annotations[0].text,'簡報');
});
test('source coordinates use the exact letterboxed capture rectangle',()=>{
  assert.deepEqual(containRect(1000,1000,1280,720),{x:280,y:0,width:720,height:720});
  assert.deepEqual(containRect(1920,1080,1280,720),{x:0,y:0,width:1280,height:720});
});
