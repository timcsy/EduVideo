import {mkdir,lstat,readFile,writeFile,rename,readdir} from 'node:fs/promises';
import {join,extname} from 'node:path';import {createHash,randomUUID} from 'node:crypto';
const uuid=/^[a-f0-9-]{36}$/,hashPattern=/^[a-f0-9]{64}$/;
const namePattern=/^media\/\d+-(screen|camera)\.webm$/;
const digest=b=>createHash('sha256').update(b).digest('hex');
async function plain(path,type){const s=await lstat(path);if(s.isSymbolicLink()||(type==='directory'?!s.isDirectory():!s.isFile()))throw new Error('專案內含不安全的連結或檔案');}
async function pointer(path){await plain(join(path,'project.json'),'file');const p=JSON.parse(await readFile(join(path,'project.json'),'utf8'));if(p.format!=='eduv'||p.version!==1||!uuid.test(p.revision))throw new Error('不是有效的 .eduv 專案資料夾');return p;}
export async function savePackage(path,files){
  if(extname(path).toLowerCase()!=='.eduv'||!files['project.json']?.length)throw new Error('請使用 .eduv 專案副檔名');
  for(const [name,bytes]of Object.entries(files))if((name!=='project.json'&&!namePattern.test(name))||!(bytes instanceof Uint8Array))throw new Error('專案檔案資料無效');
  JSON.parse(new TextDecoder().decode(files['project.json']));
  try{await plain(path,'directory');if((await readdir(path)).length)await pointer(path);}catch(e){if(e.code==='ENOENT')await mkdir(path);else throw e;}
  for(const folder of ['media','revisions']){await mkdir(join(path,folder),{recursive:true});await plain(join(path,folder),'directory');}
  const media={};for(const [name,bytes]of Object.entries(files)){if(name==='project.json')continue;const hash=digest(bytes),target=join(path,'media',`${hash}.webm`);media[name]=hash;
    try{await writeFile(target,bytes,{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;await plain(target,'file');if(digest(await readFile(target))!==hash)throw new Error('原始素材已損毀，未覆寫');}
  }
  const revision=randomUUID(),revisionData={manifest:JSON.parse(new TextDecoder().decode(files['project.json'])),media};
  await writeFile(join(path,'revisions',`${revision}.json`),JSON.stringify(revisionData),{flag:'wx'});
  const temp=join(path,`.current-${revision}`);await writeFile(temp,JSON.stringify({format:'eduv',version:1,revision}),{flag:'wx'});await rename(temp,join(path,'project.json'));
  return path;
}
export async function readPackage(path){
  await plain(path,'directory');const p=await pointer(path);await plain(join(path,'revisions'),'directory');await plain(join(path,'media'),'directory');
  const revision=join(path,'revisions',`${p.revision}.json`);await plain(revision,'file');const value=JSON.parse(await readFile(revision,'utf8'));
  if(!value.manifest||!value.media||typeof value.media!=='object')throw new Error('專案內容不完整');
  const files={'project.json':new TextEncoder().encode(JSON.stringify(value.manifest))};
  for(const [name,hash]of Object.entries(value.media)){if(!namePattern.test(name)||!hashPattern.test(hash))throw new Error('專案素材路徑無效');const source=join(path,'media',`${hash}.webm`);await plain(source,'file');const bytes=await readFile(source);if(digest(bytes)!==hash)throw new Error('專案素材校驗失敗');files[name]=new Uint8Array(bytes);}
  return files;
}
