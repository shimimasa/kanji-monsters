import fs from 'node:fs';
import assert from 'node:assert/strict';
const root='artifacts/v0/run-01';
const results=[];
for(const name of ['import','webgl','render','attack','defeat']) {
  const file=`experiment-fault-${name}-evidence.json`;
  const d=JSON.parse(fs.readFileSync(`${root}/${file}`,'utf8'));
  assert.equal(d.pass,true,file);
  if(d.fault.before) {
    const {t:beforeTime,...before}=d.fault.before,{t:afterTime,...after}=d.fault.after;
    assert.deepEqual(after,before,'Fault itself changed HP or question');
    assert.ok(afterTime>=beforeTime);
  }
  assert.equal(d.finalFirebase,'undefined');assert.equal(d.receiver.received,0);
  const first=d.steps.find(s=>s.name==='E01'),reenter=d.steps.find(s=>s.name==='reenter');
  const blockedImports=d.requests.filter(r=>/babylonPrimitiveRenderer-/.test(r.url)&&d.failed.some(f=>f.requestId===r.id));
  if(name==='import') { assert.ok(blockedImports.length);assert.equal(first.resources.canvas,1); }
  // Requests are timestamped in CDP monotonic time; performance timestamps are relative to navigation.
  const nav=d.requests.find(r=>r.type==='Document'&&r.url===d.origin+'/').t;
  const requestsDuringBattle=d.requests.filter(r=>r.t>=nav+first.t/1000&&r.t<nav+reenter.t/1000);
  const dataRequests=requestsDuringBattle.filter(r=>/\/(data|data-catalog|textbooks)\//.test(r.url));
  assert.equal(dataRequests.length,0,'Curriculum fetched after initial ready');
  results.push({file,pass:true,fault:d.fault,blockedImports:blockedImports.map(r=>r.url),
    faultMechanism:name==='import'?'CDP Network.setBlockedURLs (page fault probe intentionally inactive)':d.fault.kind,
    curriculumRequestsDuringBattle:dataRequests.length});
}
fs.writeFileSync(`${root}/fault-audit.json`,JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
