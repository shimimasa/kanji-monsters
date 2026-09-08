const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=require('node:path').resolve('artifacts/v0/run-01'),read=n=>JSON.parse(fs.readFileSync(root+'/'+n));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const [file,value]of Object.entries(read('foreground-product-freeze.json').hashes))assert.equal(hash(file),value,file);
const builds=[];
for(const role of ['baseline','experiment']){
 const manifest=read('build-'+role+'-manifest.json'),dir=role==='baseline'?path.resolve('../baseline-2d/dist'):path.resolve('dist');
 let count=0;const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else{const key=path.relative(dir,p).replaceAll('\\','/');assert.equal(hash(p),manifest.entries[key],role+':'+key);count++;}}};walk(dir);
 assert.equal(count,manifest.files);builds.push({role,files:count,sha256:manifest.sha256,unchanged:true});
}
const report=fs.readFileSync('YOMITABI_3D_V0_TECHNICAL_SLICE_REPORT.md','utf8');
assert.deepEqual([...report.matchAll(/^## (\d+)\./gm)].map(m=>+m[1]),Array.from({length:23},(_,i)=>i+1));
assert.equal(report.trim().split('\n').at(-1),'**V0 GO  READY FOR BLENDER V1a**');
assert.ok(!report.includes('実測待ち')&&!report.includes('比較はユーザーのforeground準備完了待ち'));
const old=fs.readFileSync(root+'/report-before-foreground.md','utf8');
assert.equal(old.slice(old.indexOf('## 2.'),old.indexOf('## 15.')),report.slice(report.indexOf('## 2.'),report.indexOf('## 15.')));
const result={createdAt:new Date().toISOString(),productFreeze:'PASS',builds,sections2through14Unchanged:true,reportSections:23,
 reportSha256:hash('YOMITABI_3D_V0_TECHNICAL_SLICE_REPORT.md'),headedRuns:read('foreground-details.json').runs.map(r=>({name:r.name,hash:r.rawHash,ready:r.ready,foreground:r.foreground})),snapshotCount:read('audit.json').snapshots.length};
fs.writeFileSync(root+'/foreground-final-verification.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,headedRuns:result.headedRuns.map(r=>({name:r.name,hidden:r.foreground.hidden,focusFalse:r.foreground.focusFalse}))},null,2));
