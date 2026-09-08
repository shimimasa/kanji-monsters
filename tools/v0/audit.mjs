import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
// Use the parser already pinned through Vite; do not depend on an untracked local acorn install.
const require=createRequire(import.meta.url);
const viteRequire=createRequire(require.resolve('vite/package.json'));
const {parseAst}=viteRequire('rollup/parseAst');
import {MemoryStorage} from '../experiment/common.mjs';
const root=path.resolve('artifacts/v0/run-01'),base=path.resolve('../baseline-2d');
const hash=b=>createHash('sha256').update(b).digest('hex');
const result={createdAt:new Date().toISOString(),runs:[],snapshots:[],protectedFiles:0,protectedBattleFunctions:[]};
globalThis.fetch=()=>{throw Error('Offline audit: no network');};
const saveApi=await import(pathToFileURL(path.join(base,'src/core/saveData.js')));
for(const file of fs.readdirSync(root).filter(f=>/^(baseline|experiment)-.*-evidence.json$/.test(f))) {
  const d=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
  if(d.initial)assert.deepEqual(d.initial,{local:[],session:[],db:[],caches:[],sw:0,controller:false,firebase:'undefined'});
  assert.equal(d.responses.filter(r=>/^https?:/.test(r.url)&&!r.url.startsWith(d.origin+'/')).length,0);
  const sdk=d.requests.filter(r=>r.url.includes('gstatic.com/firebasejs'));
  assert.ok(sdk.every(r=>d.failed.some(f=>f.requestId===r.id&&f.blockedReason==='csp')));
  for(const s of d.steps.filter(s=>s.storage)) {
    globalThis.localStorage=new MemoryStorage(s.storage);
    localStorage.setItem=localStorage.removeItem=()=>{throw Error('Save audit attempted a write');};
    assert.equal(saveApi.readSaveState().status,'valid');result.snapshots.push({file,step:s.name,status:'valid'});
    if(s.name.endsWith('-commit')&&s.beforeQuestion) {
      const saved=JSON.parse(s.storage.krb_save),q=s.beforeQuestion;
      const observation=saved.player.study.answers[q.id].lastObservation;
      assert.equal(observation.questionId,q._recordQuestion.id);
      assert.equal(observation.source,s.name.startsWith('heal')?'heal':'attack');
      assert.equal(observation.correct,!s.name.startsWith('wrong'));
      assert.equal(observation.support,'independent');
    }
  }
  if(d.pass) {
    assert.equal(d.valid,'valid');assert.equal(d.finalFirebase,'undefined');assert.equal(d.receiver.received,0);
    const first=d.steps.find(s=>s.name==='E01'),end=d.steps.find(s=>s.name==='E02');
    assert.equal(first.runtime.enemy.id,'HKD-E01');assert.equal(end.runtime.enemy.id,'HKD-E02');
    for(const s of [first,end,d.steps.find(s=>s.name==='reenter')]) {assert.equal(s.runtime.enemyCount,10);assert.equal(s.runtime.pool.length,40);}
    const saved=s=>JSON.parse(s.storage.krb_save).player;
    for(const name of ['exit','reenter'])assert.deepEqual(saved(d.steps.find(s=>s.name===name)).study,saved(end).study);
    assert.deepEqual(saved(end).progress.clearedStages,[]);assert.deepEqual(saved(end).progress.checkpoints,{});
    if(d.mode==='full') {
      assert.equal(d.humanReady.userMessage,'準備完了');assert.equal(d.foregroundFailure,undefined);
      assert.equal(d.layoutInitial.dpr,1.5);assert.equal(d.layoutInitial.width,1086);assert.equal(d.layoutInitial.height,723);
      assert.deepEqual(d.layoutInitial.screen,{width:1280,height:800});
      assert.ok(d.foregroundRecords.some(r=>r.kind==='measurement-start'));
      assert.ok(d.foregroundRecords.filter(r=>r.active).every(r=>r.visibility!=='hidden'&&r.state?.visibility!=='hidden'));
    }
  }
  result.runs.push({file,pass:!!d.pass,error:d.error?.split('\n')[0],sdkCsp:sdk.length,hash:hash(fs.readFileSync(path.join(root,file)))});
}
for(const folder of ['src','public','tests']) {
  const walk=dir=>{for(const entry of fs.readdirSync(path.join(base,dir),{withFileTypes:true})) {
    const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(file.replaceAll('\\','/')!=='src/screens/battleScreen.js') {
      assert.equal(hash(fs.readFileSync(file)),hash(fs.readFileSync(path.join(base,file))),file);result.protectedFiles++;
    }
  }};walk(folder);
}
const old=fs.readFileSync(path.join(base,'src/screens/battleScreen.js'),'utf8').replaceAll('\r\n','\n');
const current=fs.readFileSync('src/screens/battleScreen.js','utf8').replaceAll('\r\n','\n');
const functions=source=>{const found=new Map();const walk=node=>{
  if(node?.type==='FunctionDeclaration'&&node.id)found.set(node.id.name,source.slice(node.start,node.end));
  if(node?.type==='VariableDeclarator'&&node.id.name==='battleScreenState')for(const prop of node.init.properties)if(prop.value?.type==='FunctionExpression')found.set('battle.'+prop.key.name,source.slice(prop.start,prop.end));
  if(node&&typeof node==='object')for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value?.type)walk(value);
};walk(parseAst(source));return found;};
const actual=functions(current);for(const [name,body]of functions(old))if(!['battle.enter','battle.exit','battle.update','drawMonsterFrame'].includes(name)) {
  assert.equal(actual.get(name),body,name+' changed');result.protectedBattleFunctions.push(name);
}
const previousLock=JSON.parse(fs.readFileSync(path.join(base,'package-lock.json'))),lock=JSON.parse(fs.readFileSync('package-lock.json'));
for(const [name,pkg]of Object.entries(previousLock.packages))if(name)assert.deepEqual(lock.packages[name],pkg,'Dependency changed: '+name);
assert.equal(lock.packages['node_modules/@babylonjs/core'].version,'9.25.0');
result.dependencyDelta=Object.keys(lock.packages).filter(name=>!previousLock.packages[name]);
const regression=JSON.parse(fs.readFileSync('artifacts/v0/regression.json'));
assert.equal(regression.slice(0,4).reduce((n,r)=>n+r.pass,0),268);assert.ok(regression.every(r=>r.exit===0&&!r.fail&&!r.cancelled&&!r.skipped&&!r.todo));result.regression=regression;
fs.writeFileSync(root+'/audit.json',JSON.stringify(result,null,2));
console.log({runs:result.runs,snapshotCount:result.snapshots.length,protectedFiles:result.protectedFiles,protectedBattleFunctions:result.protectedBattleFunctions.length,dependencyDelta:result.dependencyDelta});
