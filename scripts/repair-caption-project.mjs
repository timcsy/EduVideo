import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {readPackage,savePackage} from '../electron/project-package.mjs';
import {parseWhisperJson,whisperCues} from '../electron/whisper-result.mjs';
import {splitReadableCues} from '../src/captions.js';

const [input,recognition,output,backup]=process.argv.slice(2);
if(!input||!recognition||!output||!backup)throw new Error('Usage: node scripts/repair-caption-project.mjs input.eduv recognition.json output.eduv backup.eduv');
assert.notEqual(input,output);assert.notEqual(output,backup);
const files=await readPackage(input),manifest=JSON.parse(new TextDecoder().decode(files['project.json']));
assert.equal(manifest.project.takes.length,1,'This diagnostic repair expects one source take');
await mkdir(dirname(output),{recursive:true});await mkdir(dirname(backup),{recursive:true});await savePackage(backup,files);
const cues=whisperCues(parseWhisperJson(await readFile(recognition))),captions=splitReadableCues(cues);
assert.equal(captions.map(c=>c.text).join(''),cues.map(c=>c.text).join(''));
for(let i=0;i<captions.length;i++){assert.ok(captions[i].end>captions[i].start);assert.ok(captions[i].timing==='aligned');if(i)assert.ok(captions[i].start>=captions[i-1].end,'captions must not overlap');}
const again=splitReadableCues(captions);assert.deepEqual(again.map(c=>[c.text,c.start,c.end]),captions.map(c=>[c.text,c.start,c.end]),'resegmentation must preserve source clocks');
manifest.project.takes[0].captionSource={version:1,provider:'local',model:'large-v3-turbo-q5_0',language:'zh',cues};
manifest.project.segments=manifest.project.segments.map(s=>({...s,captions:structuredClone(captions)}));
files['project.json']=new TextEncoder().encode(JSON.stringify(manifest));await savePackage(output,files);
console.log(JSON.stringify({output,backup,count:captions.length,overlaps:0,allUseAudioTiming:true},null,2));
