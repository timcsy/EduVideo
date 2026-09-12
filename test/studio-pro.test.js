import test from 'node:test';
import assert from 'node:assert/strict';
import { duplicateSegment, updateSegment, segmentDuration } from '../src/clip-tools.js';
import { trimSegment, resolveFrame, projectDuration } from '../src/edit-project.js';
import { makeAnnotation, hitAnnotation, moveAnnotation } from '../src/annotation-tools.js';
import {compositionProject} from '../src/clip-tools.js';
import {refineAlpha,refineMask} from '../src/mask-refinement.js';
import {cameraRect,updateLayout} from '../src/layout.js';
const project = { takes: [{id:'a',duration:10}], segments:[{takeId:'a',in:2,out:8}] };
test('non-destructive trim can restore source edges', () => {
  assert.equal(trimSegment(project,0,0,10).segments[0].out,10);
  assert.throws(()=>trimSegment(project,0,0,11));
});
test('duplicate and clip speed preserve originals and synchronize output time', () => {
  const p = updateSegment(duplicateSegment(project,0),0,{speed:2,volume:.5,title:'Hello'});
  assert.equal(p.segments.length,2); assert.equal(project.segments.length,1);
  assert.equal(segmentDuration(p.segments[0]),3); assert.equal(projectDuration(p),9);
  assert.deepEqual(resolveFrame(p,1),{takeId:'a',sourceTime:4});
  assert.throws(()=>updateSegment(p,0,{speed:0}));
});
test('annotations normalize reverse drags, hit-test and move without mutating', () => {
  const a = makeAnnotation('rectangle',[100,100],[20,40],{color:'#ff0000',width:4});
  assert.equal(hitAnnotation(a,[20,60]),true);
  assert.equal(hitAnnotation(a,[300,300]),false);
  const b = moveAnnotation(a,10,20); assert.deepEqual(b.start,[110,120]); assert.deepEqual(a.start,[100,100]);
  assert.equal(makeAnnotation('text',[10,20],[10,20],{text:'test'}).text,'test');
});
test('person settings switch independently at clip boundaries',()=>{
  const a={...project.segments[0],layout:{visible:false}},b={...a,layout:{visible:true,shape:'circle',x:.1,backdrop:'solid'}};
  const p={...project,layout:{mirror:true},segments:[a,b]};
  assert.equal(compositionProject(p,a).layout.visible,false);assert.equal(compositionProject(p,b).layout.shape,'circle');assert.equal(compositionProject(p,b).layout.mirror,true);
  const rect=cameraRect(updateLayout({}, {shape:'circle',width:.3,y:.9}),1280,720);assert.equal(rect.height,rect.width);assert.ok(rect.y+rect.height<=720.001);
});
test('mask refinement uses alpha, softens boundaries, and stabilizes previous mask',()=>{
  assert.equal(refineAlpha(0),0);assert.equal(refineAlpha(1),1);assert.ok(Math.abs(refineAlpha(.45)-.5)<1e-9);
  const data=new Uint8ClampedArray([255,0,0,0,0,0,0,255]);refineMask(data,null,{smoothing:0});assert.equal(data[3],0);assert.equal(data[7],255);
  refineMask(data,new Uint8ClampedArray([0,0,0,255,0,0,0,0]),{smoothing:.5});assert.equal(data[3],128);assert.equal(data[7],128);
});
