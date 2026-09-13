// Clean, disposable archive build; never changes a worktree, dependency tree or ref.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { runLogged } from '../tools/kanji-defense-browser-cert/helpers.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const out=path.join(root,'artifacts','candidate-1'); await fs.mkdir(out,{recursive:true});
const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root}).toString().trim();
const clean=await fs.mkdtemp(path.join(out,'clean-'));
const archive=path.join(clean,'source.zip');
const source=path.join(clean,'source');
const buildInputs=['src','public','scripts','tests','tools/kanji-defense-browser-cert','index.html','style.css','manifest.json','package.json','package-lock.json','vite.config.js'];
const receipt={commit,node:process.version,startedAt:new Date().toISOString(),source,buildInputs,builds:{},status:'RUNNING'};
async function hashOutputs(directory) {
  async function walk(prefix='') {
    const items=await fs.readdir(path.join(directory,prefix),{withFileTypes:true});
    return (await Promise.all(items.map(item=>item.isDirectory()?walk(path.join(prefix,item.name)):[path.join(prefix,item.name)]))).flat();
  }
  const names=(await walk()).sort(), hashes=[];
  // Include all copied public images/audio/data, not just generated bundles.
  for(let i=0;i<names.length;i+=8)hashes.push(...await Promise.all(names.slice(i,i+8).map(async name=> {
    const hash=createHash('sha256');for await(const chunk of createReadStream(path.join(directory,name)))hash.update(chunk);
    return [name.replaceAll('\\','/'),hash.digest('hex')];
  })));
  return {files:hashes.length,treeSHA256:createHash('sha256').update(JSON.stringify(hashes)).digest('hex'),
    entryHashes:Object.fromEntries(hashes.filter(([name])=>name==='index.html'||/^assets\/[^/]+\.(js|css|json)$/.test(name)))};
}
try {
  // Explicit build closure excludes historical raw-art archives and hosting cache.
  // Windows tar on this device cannot extract Japanese filenames; .NET ZIP can.
  execFileSync('git',['archive','--format=zip',`--output=${archive}`,commit,'--',...buildInputs],{cwd:root});
  if(process.platform==='win32')execFileSync('powershell.exe',['-NoProfile','-Command',
    `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${archive.replaceAll("'","''")}','${source.replaceAll("'","''")}')`]);
  else {await fs.mkdir(source);execFileSync('unzip',['-q',archive,'-d',source]);}
  // Invoke the Windows npm CLI with Node directly; cmd/bat nested quoting is not portable.
  const npmCommand=process.platform==='win32'?process.execPath:'npm';
  const npmArgs=process.platform==='win32'
    ?[path.join(path.dirname(process.execPath),'node_modules','npm','bin','npm-cli.js'),'ci','--offline']
    :['ci','--offline'];
  await runLogged(npmCommand,npmArgs,{cwd:source,logPath:path.join(out,'clean-npm-ci.log')});
  for(const [label,mode,flag,reference] of [
    ['production','production','1','dist'],
    ['observation-on','child-playtest','1','artifacts/child-playtest-app-on'],
    ['observation-off','child-playtest','0','artifacts/child-playtest-app-off']]) {
    const env={...process.env,VITE_PLAYTEST_LOGGER:flag};
    await runLogged(process.execPath,['node_modules/vite/bin/vite.js','build','--mode',mode,'--outDir',`build-${label}`],{cwd:source,env,logPath:path.join(out,`clean-${label}.log`)});
    const hashes=await hashOutputs(path.join(source,`build-${label}`));
    const original=await hashOutputs(path.join(root,reference));
    const same=JSON.stringify(hashes)===JSON.stringify(original);
    receipt.builds[label]={same,hashes};
    if(!same)throw new Error(`Clean ${label} output differs from QA build`);
  }
  receipt.status='PASS';
} catch(error) {receipt.status='FAIL';receipt.error=error.message;process.exitCode=1;}
finally {receipt.finishedAt=new Date().toISOString();await fs.writeFile(path.join(out,'reproducibility.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));}
