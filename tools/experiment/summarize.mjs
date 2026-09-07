import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { args, hash, BASELINE, canonical } from './common.mjs';
const o=args(),run=path.resolve(o.run);
const load=async name=>JSON.parse(await readFile(path.join(run,name),'utf8'));
const manifest=await load('manifest.json'),server=await load('server-manifest.json');
assert.equal(manifest.baselineSHA,BASELINE);
const summary={generatedAt:new Date().toISOString(),baseline:BASELINE,fixtureHash:manifest.fixtureHash,keyCount:manifest.keyCount,roles:[],evidenceHashes:{}};
for(const [role,attempt] of [['baseline',o.baselineAttempt],['experiment',o.experimentAttempt]]) {
  const name=`${role}-${attempt}-evidence.json`,e=await load(name);assert.equal(e.pass,true);assert.equal(e.valid,'valid');assert.equal(e.finalFirebase,'undefined');assert.equal(e.receiver.received,0);
  assert.deepEqual(e.initialStorage,{localKeys:[],sessionKeys:[],databases:[],caches:[],controller:null,registrations:0,firebase:'undefined'});
  for(const step of ['fixture-valid','title','fictional-name-course','hokkaido-selected','first-question','correct','incorrect','exit','reenter','reload','ISO-browser-PASS']) assert.ok(e.steps.some(s=>s.name===step));
  const last=e.steps.find(s=>s.name==='reload'), before=e.steps.find(s=>s.name==='first-question');
  assert.equal(before.stats.totalCorrect,0);assert.equal(before.stats.totalIncorrect,0);
  assert.equal(last.stats.totalCorrect,1);assert.equal(last.stats.totalIncorrect,1);
  assert.equal(canonical(last.answers),canonical(e.steps.find(s=>s.name==='incorrect').answers));
  assert.equal(last.reviewQueue.length,1);assert.equal(last.stats.stagesCleared,0);
  const sdk=e.requests.filter(r=>r.url.startsWith('https://www.gstatic.com/firebasejs/'));
  assert.ok(sdk.length);assert.ok(sdk.every(r=>e.failures.some(f=>f.id===r.id&&f.blockedReason==='csp')));
  const external=e.responses.filter(r=>/^https?:/.test(r.url)&&!r.url.startsWith(e.origin+'/'));assert.equal(external.length,0);
  const authFirestore=e.requests.filter(r=>/identitytoolkit|securetoken|firestore\.googleapis/.test(r.url));assert.equal(authFirestore.length,0);
  const detail=server.roles.find(s=>s.role===role);assert.equal(detail.baseline,BASELINE);
  if(role==='baseline')assert.equal(detail.sha,BASELINE);
  else assert.match(detail.sha,/^[a-f0-9]{40}$/); // server checked ancestry and unchanged E0 product tree.
  const storage=await load(`${role}-${attempt}-reload-synthetic-storage.json`),save=JSON.parse(storage.krb_save);
  assert.equal(storage.krb_save,storage.yomitabi_confirmed_1);
  summary.roles.push({role,origin:e.origin,profile:path.basename(e.profile),browser:e.browser.product,sourceSHA:detail.sha,
    buildHash:detail.buildHash,requests:e.requests.length,responses:e.responses.length,SDKBlocked:sdk.length,
    externalResponses:0,authFirestoreRequests:0,receiver:0,valid:e.valid,correct:last.stats.totalCorrect,incorrect:last.stats.totalIncorrect,
    reviewQueueCount:last.reviewQueue.length,stageClears:last.stats.stagesCleared,inputMethod:storage.inputMethod,
    reviewDetail:save.player.study.reviewQueueDetail,initialStorage:e.initialStorage});
  summary.evidenceHashes[name]=hash(await readFile(path.join(run,name)));
}
assert.equal(summary.roles[0].buildHash,summary.roles[1].buildHash);
assert.notEqual(summary.roles[0].origin,summary.roles[1].origin);assert.notEqual(summary.roles[0].profile,summary.roles[1].profile);
assert.equal((await load('unknown-storage-evidence.json')).pass,true);
assert.equal((await load('http-safety-evidence.json')).filter(t=>t.pass).length,20);
for(const name of ['server-manifest.json','manifest.json','validator-manifest.json','unknown-storage-evidence.json','http-safety-evidence.json']) summary.evidenceHashes[name]=hash(await readFile(path.join(run,name)));
const toolRoot=path.dirname(fileURLToPath(import.meta.url));
summary.toolHashes={};for(const name of await readdir(toolRoot)) if(/\.(mjs|js|html|md)$/.test(name)) summary.toolHashes[name]=hash(await readFile(path.join(toolRoot,name)));
summary.browserIsolation='PASS';
await writeFile(path.join(run,'verified-summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
