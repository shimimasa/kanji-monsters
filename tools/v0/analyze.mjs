import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve('artifacts/v0/run-01');
const percentile=(a,p)=>a.length?a[Math.ceil(a.length*p)-1]:null;
const frames=(all,start,end)=>{const a=[];for(let i=1;i<all.length;i++)if(all[i-1][0]>=start&&all[i][0]<=end)a.push(all[i][0]-all[i-1][0]);a.sort((a,b)=>a-b);return {n:a.length,median:percentile(a,.5),p95:percentile(a,.95),max:a.at(-1),over20:a.filter(x=>x>20).length,over33:a.filter(x=>x>33).length,over50:a.filter(x=>x>50).length};};
const metric=(data,name)=>data.metrics.find(x=>x.name===name).value;
const summaries=[];
for(const file of fs.readdirSync(root).filter(f=>/-(cold-[BV]\d+|diagnostic-\d+)-evidence\.json$/.test(f))) {
 const d=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
 const s={file,pass:d.pass===true,error:d.error,role:d.role,mode:d.mode,browser:d.browser?.product,layout:d.layoutInitial};
 if(d.pass&&d.mode==='full') {
   const events=d.performance.b05,obs=d.performance.observation;
   const t1=events.find(e=>['T1','T1-observed'].includes(e.kind)),e0=obs.events.find(e=>e.kind==='E0'),e1=obs.events.find(e=>e.kind==='E1');
   const a0=events.find(e=>e.kind==='AS'&&e.serial===1);
   assert.ok(t1&&e0&&e1&&a0,'Missing boundary '+file);
   s.T1=t1.t;s.E0A0S=a0.t-e0.t;s.E1A0S=a0.t-e1.t;s.boundaries={T1:t1,E0:e0,E1:e1,A0S:a0};
   s.intervals=d.steps.filter(e=>e.name==='interval').map(e=>({...e,frames:frames(obs.frames,e.start,e.end),longTasks:obs.longTasks.filter(t=>t.start>=e.start&&t.start<e.end)}));
   const idle=s.intervals.find(e=>e.label==='idle');s.idle=idle.frames;
   s.idleSeconds=(metric(d.idleAfter,'Timestamp')-metric(d.idleBefore,'Timestamp'));
   s.idleTaskSeconds=metric(d.idleAfter,'TaskDuration')-metric(d.idleBefore,'TaskDuration');s.idleCPU=100*s.idleTaskSeconds/s.idleSeconds;
   s.actions={};for(const action of ['correct','wrong','heal']) {
     const u=obs.events.find(e=>e.kind==='U0'&&e.action===action),a=events.find(e=>e.kind==='AS'&&e.action===action&&e.t>u?.t);
     assert.ok(u&&a,'Missing action boundary');s.actions[action]={U0:u.t,A1S:a.t,duration:a.t-u.t};
   }
   const timeToN0=(t)=>1000*(t-d.requests.find(e=>e.type==='Document'&&e.url===d.origin+'/').t);
   s.transfer=[];
   for(const finished of d.finished) {
     const r=d.responses.find(r=>r.id===finished.id);
     if(!r||!r.url.startsWith(d.origin+'/')||r.url.includes('/__experiment/'))continue;
     s.transfer.push({url:r.url,status:r.status,bytes:finished.bytes,complete:timeToN0(finished.t),babylon:/babylonPrimitive|default\.(vertex|fragment)|logDepthDeclaration|helperFunctions/.test(r.url)});
   }
   s.critical=s.transfer.filter(r=>r.complete>=0&&r.complete<=a0.t).reduce((n,r)=>n+r.bytes,0);
   s.babylonTransfer=s.transfer.filter(r=>r.babylon).reduce((n,r)=>n+r.bytes,0);
   s.babylonBeforeT1=s.transfer.filter(r=>r.babylon&&r.complete<=t1.t);
   s.foregroundHidden=d.foregroundRecords.filter(r=>r.active&&(r.visibility==='hidden'||r.state?.visibility==='hidden')).length;
   s.externalResponses=d.responses.filter(r=>/^https?:/.test(r.url)&&!r.url.startsWith(d.origin+'/')).length;
   assert.equal(s.foregroundHidden,0);assert.equal(s.externalResponses,0);assert.equal(d.receiver.received,0);assert.equal(d.finalFirebase,'undefined');
 }
 summaries.push(s);
}
const pairs=[];for(let i=1;i<=3;i++) {
 const b=summaries.find(s=>s.file===`baseline-cold-B${i}-evidence.json`&&s.pass),v=summaries.find(s=>s.file===`experiment-cold-V${i}-evidence.json`&&s.pass);
 if(b&&v)pairs.push({pair:i,T1:v.T1-b.T1,E0A0S:v.E0A0S-b.E0A0S,idleCPUPoints:v.idleCPU-b.idleCPU,idleP95:v.idle.p95-b.idle.p95,criticalBytes:v.critical-b.critical,actionDelta:Object.fromEntries(Object.keys(b.actions).map(k=>[k,v.actions[k].duration-b.actions[k].duration]))});
}
fs.writeFileSync(root+'/analysis.json',JSON.stringify({summaries,pairs},null,2));
console.log(JSON.stringify({runs:summaries.map(({file,pass,error,T1,E0A0S,idle,idleCPU,critical,babylonTransfer})=>({file,pass,error,T1,E0A0S,idle,idleCPU,critical,babylonTransfer})),pairs},null,2));
