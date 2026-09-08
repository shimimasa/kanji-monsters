const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto');
const root=require('node:path').resolve('artifacts/v0/run-01'),read=n=>JSON.parse(fs.readFileSync(root+'/'+n));
const a=read('analysis.json'),runs=[],raws=[];
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const [file,expected]of Object.entries(read('foreground-product-freeze.json').hashes))assert.equal(hash(file),expected,file);
assert.equal(fs.existsSync(root+'/batch-human-ready.json'),false);
for(let i=1;i<=3;i++)for(const [role,letter]of [['baseline','B'],['experiment','V']]) {
 const file=`${role}-cold-${letter}${i}-evidence.json`,d=read(file),s=a.summaries.find(x=>x.file===file),name=letter+i;
 assert.equal(d.pass,true);assert.match(d.browser.product,/^Chrome\/152\./);assert.equal(d.mode,'full');
 assert.equal(d.layoutInitial.dpr,1.5);assert.equal(d.layoutInitial.width,1086);assert.equal(d.layoutInitial.height,723);
 assert.deepEqual(d.layoutInitial.screen,{width:1280,height:800});assert.match(d.humanReady.scope,new RegExp('^'+name+' only'));
 const armed=d.foregroundRecords.find(r=>r.kind==='measurement-start');
 assert.ok(armed.epoch>Date.parse(d.humanReady.receivedAt.replace(' UTC','Z').replace(' ','T')));
 const active=d.foregroundRecords.filter(r=>r.active),polls=active.filter(r=>r.kind==='poll');
 assert.ok(polls.every(r=>r.state.visibility==='visible'&&r.window.bounds.windowState!=='minimized'));
 const longTasks=d.performance.observation.longTasks;
 const obs=d.performance.observation.events,b05=d.performance.b05;
 const defeatU=obs.filter(e=>e.kind==='U0'&&e.action==='defeat').at(-1);
 const defeatAS=b05.find(e=>e.kind==='AS'&&e.action==='defeat'&&e.t>defeatU.t);
 const hp0=b05.find(e=>e.kind==='state'&&e.t>=defeatU.t&&e.state.enemy==='HKD-E01'&&e.state.hp===0);
 const e02=b05.find(e=>e.kind==='state'&&e.t>=defeatU.t&&e.state.enemy==='HKD-E02');
 assert.ok(defeatAS&&hp0&&e02);
 const reenter=b05.find(e=>e.kind==='AS'&&e.serial===2),enter=b05.find(e=>e.kind==='E1B'&&e.serial===2);
 const intervals=s.intervals.map(({label,start,end,frames,longTasks})=>({label,start,end,ms:end-start,frames,longTasks}));
 const normal=intervals.filter(x=>x.label!=='E02-idle');
 const normalLong=normal.flatMap(x=>x.longTasks.map(t=>({...t,label:x.label})));
 const pollFocusFalse=polls.filter(r=>r.state.focus!==true);
 const babylon=s.transfer.filter(r=>r.babylon);
 const scriptResources=d.performance.resources.filter(r=>r.initiatorType==='script');
 const result={name,file,rawHash:hash(root+'/'+file),browser:d.browser.product,profile:d.profile,toolHashes:d.toolHashes,
  ready:d.humanReady,armedEpoch:armed.epoch,foreground:{polls:polls.length,hidden:active.filter(r=>r.visibility==='hidden'||r.state?.visibility==='hidden').length,focusFalse:pollFocusFalse.length,focusFalseRecords:pollFocusFalse},
  T1:s.T1,T1Boundary:s.boundaries.T1,E0A0S:s.E0A0S,E1A0S:s.E1A0S,
  idle:{...s.idle,seconds:s.idleSeconds,taskSeconds:s.idleTaskSeconds,cpu:s.idleCPU},actions:s.actions,
  defeat:{U0:defeatU.t,HP0:hp0.t,E02:e02.t,AS:defeatAS.t,U0AS:defeatAS.t-defeatU.t,HP0E02:e02.t-hp0.t,commandCount:obs.filter(e=>e.kind==='U0'&&e.action==='defeat').length},
  reenter:{E1:enter.t,AS:reenter.t,ms:reenter.t-enter.t},intervals,normalLong,
  allLongTasks:longTasks,preA0SLongTasks:longTasks.filter(t=>t.start<s.boundaries.A0S.t),
  critical:s.critical,babylonTransfer:s.babylonTransfer,babylon,babylonBeforeT1:s.babylonBeforeT1,
  scriptResources:scriptResources.map(r=>({name:r.name,start:r.startTime,end:r.responseEnd,transferSize:r.transferSize,encodedBodySize:r.encodedBodySize})),
  exits:d.steps.filter(x=>['E01','E02','exit','reenter'].includes(x.name)).map(x=>({name:x.name,t:x.t,stage:x.runtime.stage,enemy:x.runtime.enemy?.id,generation:x.runtime.generation,battle:x.runtime.battle})),
  canvasOr3DObservations:d.b05.filter(e=>/3d|resource/i.test(e.kind)),
 };
 runs.push(result);raws.push(d);
}
for(const d of raws.slice(1))assert.deepEqual(d.toolHashes,raws[0].toolHashes,'Measurement tool changed');
const criticalDiffs=[];
for(let i=1;i<=3;i++){
 const b=a.summaries.find(s=>s.file===`baseline-cold-B${i}-evidence.json`),v=a.summaries.find(s=>s.file===`experiment-cold-V${i}-evidence.json`);
 const map=s=>{const m=new Map();for(const r of s.transfer.filter(r=>r.complete>=0&&r.complete<=s.boundaries.A0S.t)){const k=new URL(r.url).pathname;m.set(k,(m.get(k)||0)+r.bytes);}return m;};
 const bm=map(b),vm=map(v);
 criticalDiffs.push({pair:i,files:[...new Set([...bm.keys(),...vm.keys()])].filter(k=>bm.get(k)!==vm.get(k)).map(k=>({path:k,baseline:bm.get(k)||0,v0:vm.get(k)||0,delta:(vm.get(k)||0)-(bm.get(k)||0)}))});
}
fs.writeFileSync(root+'/foreground-details.json',JSON.stringify({productHashCheck:'PASS',toolHashCheck:'PASS',runs,criticalDiffs,pairs:a.pairs},null,2));
console.log(JSON.stringify({runs:runs.map(r=>({name:r.name,T1exact:r.T1Boundary.exactBoundary,T1kind:r.T1Boundary.kind,
 idleSeconds:r.idle.seconds,taskSeconds:r.idle.taskSeconds,actions:Object.fromEntries(Object.entries(r.actions).map(([k,v])=>[k,v.duration])),defeat:r.defeat,reenter:r.reenter.ms,
 phases:r.intervals.map(x=>({label:x.label,n:x.frames.n,p95:x.frames.p95,max:x.frames.max,over33:x.frames.over33,over50:x.frames.over50,longTasks:x.longTasks.length})),
 preASStalls:r.preA0SLongTasks.map(t=>[t.start,t.duration]),allStalls:r.allLongTasks.map(t=>[t.start,t.duration]),foreground:r.foreground})),
 criticalDiffs:criticalDiffs.map(p=>({pair:p.pair,large:p.files.filter(f=>Math.abs(f.delta)>190000)}))},null,2));
