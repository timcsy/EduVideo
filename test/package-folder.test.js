import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,mkdir,symlink,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {savePackage,readPackage} from '../electron/project-package.mjs';
test('eduv folder retains uncompressed deduplicated media and atomic revisions',async()=>{
  const temp=await mkdtemp(join(tmpdir(),'eduv-package-test-'));try{const path=join(temp,'lesson.eduv');const files={'project.json':new TextEncoder().encode('{"project":{"version":2}}'),'media/0-camera.webm':new Uint8Array([1,2,3])};
    await savePackage(path,files);await savePackage(path,files);const result=await readPackage(path);assert.deepEqual([...result['media/0-camera.webm']],[1,2,3]);assert.equal((await readdir(join(path,'media'))).length,1);assert.equal((await readdir(join(path,'revisions'))).length,2);
    const pointer=JSON.parse(await readFile(join(path,'project.json'),'utf8'));pointer.revision='../../escape';await writeFile(join(path,'project.json'),JSON.stringify(pointer));await assert.rejects(()=>readPackage(path));
  }finally{await rm(temp,{recursive:true,force:true});}
});
test('package writes refuse unrelated directories, symlinks and traversal names',async()=>{
  const temp=await mkdtemp(join(tmpdir(),'eduv-package-test-'));try{const path=join(temp,'existing.eduv');await mkdir(path);await writeFile(join(path,'mine.txt'),'keep');await assert.rejects(()=>savePackage(path,{}));assert.equal(await readFile(join(path,'mine.txt'),'utf8'),'keep');await symlink(path,join(temp,'link.eduv'));await assert.rejects(()=>savePackage(join(temp,'link.eduv'),{}));await assert.rejects(()=>savePackage(join(temp,'bad.eduv'),{'../oops':new Uint8Array([1])}));}finally{await rm(temp,{recursive:true,force:true});}
});
