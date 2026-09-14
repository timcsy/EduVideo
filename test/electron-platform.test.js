import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {whisperExecutable,unpackedPath,whisperResponseFile,openProjectDialogProperties,projectPathFromArgv} from '../electron/platform.mjs';
import {shortcutLabel,isMacPlatform} from '../src/shortcut-label.js';

test('native speech executable is named per platform',()=>{
  assert.equal(whisperExecutable('win32'),'whisper-cli.exe');
  assert.equal(whisperExecutable('darwin'),'whisper-cli');
  assert.equal(whisperExecutable('linux'),'whisper-cli');
});
test('asar binaries resolve to the unpacked copy with either path separator',()=>{
  assert.equal(unpackedPath('/Applications/E.app/Contents/Resources/app.asar/node_modules/ffmpeg-static/ffmpeg'),'/Applications/E.app/Contents/Resources/app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg');
  assert.equal(unpackedPath('C:\\Program Files\\EduVideo\\resources\\app.asar\\node_modules\\ffmpeg-static\\ffmpeg.exe'),'C:\\Program Files\\EduVideo\\resources\\app.asar.unpacked\\node_modules\\ffmpeg-static\\ffmpeg.exe');
  assert.equal(unpackedPath('/dev/node_modules/ffmpeg-static/ffmpeg'),'/dev/node_modules/ffmpeg-static/ffmpeg');
});
test('whisper arguments travel as UTF-8 lines with relative audio and output names',()=>{
  const text=whisperResponseFile({model:'C:\\Users\\陳老師\\AppData\\Roaming\\EduVideo Studio\\speech-models\\ggml-base.bin',audio:'speech.wav',output:'result',language:'zh',prompt:'以下是繁體中文教學逐字稿。'});
  const lines=text.trimEnd().split('\n');
  assert.deepEqual(lines.slice(0,4),['-m','C:\\Users\\陳老師\\AppData\\Roaming\\EduVideo Studio\\speech-models\\ggml-base.bin','-f','speech.wav']);
  assert.deepEqual(lines.slice(-2),['--prompt','以下是繁體中文教學逐字稿。']);
  assert.equal(whisperResponseFile({model:'m',audio:'a',output:'o',language:'en'}).includes('--prompt'),false);
  assert.throws(()=>whisperResponseFile({model:'bad\nname',audio:'a',output:'o',language:'en'}));
});
test('only macOS can pick a project package and an archive in one dialog',()=>{
  assert.deepEqual(openProjectDialogProperties('darwin'),['openFile','openDirectory','treatPackageAsDirectory']);
  assert.deepEqual(openProjectDialogProperties('win32'),['openDirectory']);
  assert.deepEqual(openProjectDialogProperties('linux'),['openDirectory']);
});
test('a project opened from the command line is found after Chromium switches',()=>{
  assert.equal(projectPathFromArgv(['EduVideo Studio.exe','--allow-file-access-from-files','D:\\課程\\第一課.eduv\\']),'D:\\課程\\第一課.eduv');
  assert.equal(projectPathFromArgv(['EduVideo Studio.exe','C:\\backup\\old.EDUVIDEO']),'C:\\backup\\old.EDUVIDEO');
  assert.equal(projectPathFromArgv(['electron','.','--user-data-dir=/tmp/x.eduv']),null);
  assert.equal(projectPathFromArgv(['EduVideo Studio.exe']),null);
});
test('shortcut hints use Ctrl outside macOS without touching explicit ⌘/Ctrl hints',()=>{
  assert.equal(shortcutLabel('⌘Z / ⇧⌘Z：復原／重做',false),'Ctrl+Z / Ctrl+Shift+Z：復原／重做');
  assert.equal(shortcutLabel('⌘Z / ⇧⌘Z：復原／重做',true),'⌘Z / ⇧⌘Z：復原／重做');
  assert.equal(shortcutLabel('複製頁面 · ⌘/Ctrl+D',false),'複製頁面 · ⌘/Ctrl+D');
  assert.equal(isMacPlatform({platform:'MacIntel'}),true);
  assert.equal(isMacPlatform({platform:'Win32'}),false);
  assert.equal(isMacPlatform({userAgentData:{platform:'Windows'},platform:'Win32'}),false);
});
test('Windows installer ships only its own speech executable',()=>{
  const {build}=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url)));
  assert.equal(build.extraResources,undefined,'speech resources are declared per platform');
  assert.ok(build.mac.extraResources[0].filter.includes('whisper-cli'));
  assert.equal(build.mac.extraResources[0].filter.includes('whisper-cli.exe'),false);
  assert.ok(build.win.extraResources[0].filter.includes('whisper-cli.exe'));
  assert.equal(build.win.extraResources[0].filter.includes('whisper-cli'),false);
  assert.ok(build.win.target.some(t=>t.target==='nsis'&&t.arch.includes('x64')));
});
