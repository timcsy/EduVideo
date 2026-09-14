import test from 'node:test';
import assert from 'node:assert/strict';
import {desktopVisibility,protectCaptureWindow} from '../electron/desktop-policy.mjs';
test('studio and desktop tools are mutually exclusive; preview is independently controlled',()=>{
  assert.deepEqual(desktopVisibility({enabled:true,shown:true,cameraVisible:true,cameraReady:true,notesVisible:true,kind:'screen'}),{main:false,toolbar:true,camera:true,notes:true,overlay:true});
  const hidden=desktopVisibility({enabled:true,shown:false,cameraVisible:true,cameraReady:true,notesVisible:true,kind:'screen'});
  assert.deepEqual(hidden,{main:true,toolbar:false,camera:false,notes:false,overlay:false});
  assert.equal(desktopVisibility({enabled:true,shown:true,cameraVisible:false,cameraReady:true}).camera,false);
});
test('capture inclusion applies only to full-screen capture and not to preview visibility',()=>{
  for(const role of ['main','toolbar','camera','notes','picker']){
    assert.equal(protectCaptureWindow({kind:'screen',includeChrome:false},role),true);
    assert.equal(protectCaptureWindow({kind:'screen',includeChrome:true},role),false);
    assert.equal(protectCaptureWindow({kind:'window',includeChrome:false},role),false);
  }
  assert.equal(protectCaptureWindow({kind:'screen',includeChrome:true},'overlay'),true,'annotation overlay is composited once');
});
