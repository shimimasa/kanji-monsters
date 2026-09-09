import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattleMotionBridge } from '../../src/visuals/battleMotionBridge.js';
import { createMonsterMotionHost } from '../../src/visuals/motion/monsterMotionHost.js';
const durations={attack:750,damage:500,defeat:1000};
const image={complete:true,naturalWidth:512,naturalHeight:512};
const view=(extra={})=>({stageId:'hokkaido_area1',mode:'normal',monsterId:'HKD-E01',enemyKey:0,image,action:null,remainingMs:0,...extra});
const tick=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};};
const bridge=(extra={})=>createBattleMotionBridge({session:1,durations,loadHost:async()=>({createMonsterMotionHost}),...extra});
globalThis.Path2D=class {rect(){}};
function context(){
  const stack=[],draws=[];
  const ctx={x:40,y:20,rotation:.4,globalAlpha:.6,globalCompositeOperation:'source-over',
    save(){stack.push([this.x,this.y,this.rotation,this.globalAlpha,this.globalCompositeOperation]);},
    restore(){[this.x,this.y,this.rotation,this.globalAlpha,this.globalCompositeOperation]=stack.pop();},
    rotate(r){this.rotation+=r;},translate(x,y){this.x+=x;this.y+=y;},scale(){},clip(){},
    drawImage(...args){draws.push(args);}};
  return {ctx,draws,stack,snapshot:()=>[ctx.x,ctx.y,ctx.rotation,ctx.globalAlpha,ctx.globalCompositeOperation]};
}
const layout={imageRect:{x:10,y:20,width:240,height:120},clipRect:{x:14,y:24,width:232,height:112}};
const legacy={x:130,y:80,rotation:.4};
for(const excluded of [{stageId:'aomori_area1'},{mode:'practice'},{mode:'quick'},{monsterId:'HKD-E02'}])
  test('excluded target starts no host/module '+JSON.stringify(excluded),async()=>{
    let loads=0;const b=bridge({loadHost:()=>{loads++;return {createMonsterMotionHost};}});
    b.update(view(excluded),16);await tick();assert.equal(loads,0);assert.equal(b.inspect().hostCount,0);b.dispose();
  });
for(const [action,mapped,duration] of [['attack','attack',750],['damage','hit',500],['defeat','defeat',1000]])
  test(action+' observes controller duration and mapping',async()=>{
    const b=bridge();b.update(view({action,remainingMs:duration/2}),16);await tick();
    assert.equal(b.inspect().timeline.action,mapped);assert.equal(b.inspect().timeline.progress,.5);b.dispose();
  });
test('idle update advances once; 100 presents do not advance or modify inputs',async()=>{
  const b=bridge(),v=Object.freeze(view());b.update(v,16);await tick();const before=b.inspect();const c=context();
  for(let i=0;i<100;i++)assert.equal(b.present(c.ctx,layout,legacy),true);
  assert.deepEqual(b.inspect(),before);assert.equal(before.timeline.progress,.008);assert.equal(c.draws.length,100);
  b.update(v,16);assert.equal(b.inspect().timeline.progress,.016);b.dispose();
});
test('same exact remaining timer replay uses display revision',async()=>{
  const b=bridge();b.actionStarted();b.update(view({action:'damage',remainingMs:484}),16);await tick();
  const rev=b.inspect().timeline.revision;b.actionStarted();b.update(view({action:'damage',remainingMs:484}),16);
  assert.equal(b.inspect().timeline.revision,rev+1);assert.equal(b.inspect().timeline.progress,1-484/500);b.dispose();
});
test('hit defeat terminal hold then E02 discards all pose references',async()=>{
  const b=bridge();b.update(view({action:'damage',remainingMs:200}),16);await tick();
  b.actionStarted();b.update(view({action:'defeat',remainingMs:900}),16);assert.equal(b.inspect().timeline.action,'defeat');
  b.update(view(),16);assert.equal(b.inspect().timeline.progress,1);
  b.update(view({monsterId:'HKD-E02',enemyKey:1}),16);
  assert.equal(b.inspect().hostCount,0);assert.equal(b.inspect().timeline,null);assert.equal(b.inspect().imageReference,false);b.dispose();
});
test('pending existing image becomes ready without another loader or controller wait',async()=>{
  const pending={complete:false,naturalWidth:0,naturalHeight:0},b=bridge();
  b.update(view({image:pending,action:'attack',remainingMs:700}),16);await tick();assert.equal(b.inspect().hostCount,0);
  Object.assign(pending,image);b.update(view({image:pending,action:'attack',remainingMs:300}),16);await tick();
  assert.equal(b.inspect().imageState,'ready');assert.equal(b.inspect().timeline.progress,.6);b.dispose();
});
test('failed/missing image retains Legacy fallback',async()=>{
  for(const img of [null,{complete:true,naturalWidth:0,naturalHeight:0}]){
    const b=bridge();b.update(view({image:img}),16);await tick();assert.equal(b.present(context().ctx,layout,legacy),false);b.dispose();
  }
});
for(const reject of [false,true])test('module late '+(reject?'reject':'resolve')+' after dispose',async()=>{
  const d=deferred(),b=bridge({loadHost:()=>d.promise});b.update(view(),16);await tick();b.dispose();b.dispose();
  reject?d.reject(Error('fault')):d.resolve({createMonsterMotionHost});await tick();
  assert.equal(b.inspect().hostCount,0);assert.equal(b.inspect().imageReference,false);assert.equal(b.inspect().activeSession,null);
});
for(const order of [[0,1],[1,0]])test('old/new module order '+order.join('/'),async()=>{
  const pending=[deferred(),deferred()],b=pending.map((d,i)=>bridge({session:i,loadHost:()=>d.promise}));
  b[0].update(view(),16);await tick();b[0].dispose();b[1].update(view(),16);await tick();
  for(const i of order){pending[i].resolve({createMonsterMotionHost});await tick();}
  assert.equal(b[0].inspect().hostCount,0);assert.equal(b[1].inspect().hostCount,1);b[1].dispose();
});
for(const response of ['reject','wrong-export'])test('module failure '+response+' stays Legacy',async()=>{
  const b=bridge({loadHost:async()=>{if(response==='reject')throw Error('fault');return {};}});
  b.update(view(),16);await tick();assert.equal(b.inspect().failed,true);assert.equal(b.present(context().ctx,layout,legacy),false);b.dispose();
});
test('late module resolution after enemy switch never restores E01',async()=>{
  const d=deferred(),b=bridge({loadHost:()=>d.promise});b.update(view(),16);await tick();
  b.update(view({monsterId:'HKD-E02',enemyKey:1}),16);d.resolve({createMonsterMotionHost});await tick();
  assert.equal(b.inspect().hostCount,0);assert.equal(b.inspect().identity,null);b.dispose();
});
test('reduced motion and resize mid-action keep progress and restore canvas',async()=>{
  const b=bridge();b.update(view({action:'attack',remainingMs:375}),16);await tick();const c=context(),before=c.snapshot();
  assert.equal(b.present(c.ctx,layout,legacy),true);assert.deepEqual(c.snapshot(),before);
  b.update(view({action:'attack',remainingMs:375,reducedMotion:true}),0);
  const revision=b.inspect().timeline.revision;
  b.present(c.ctx,{...layout,imageRect:{...layout.imageRect,width:180,height:90}},legacy);
  assert.equal(b.inspect().timeline.progress,.5);assert.equal(b.inspect().timeline.revision,revision);assert.deepEqual(c.snapshot(),before);b.dispose();
});
test('invalid layout and render exception restore state and allow Legacy',async()=>{
  const b=bridge();b.update(view(),16);await tick();const c=context(),before=c.snapshot();
  assert.equal(b.present(c.ctx,{...layout,imageRect:{width:NaN}},legacy),false);assert.deepEqual(c.snapshot(),before);
  c.ctx.drawImage=()=>{throw Error('draw fault');};assert.equal(b.present(c.ctx,layout,legacy),false);
  assert.deepEqual(c.snapshot(),before);assert.equal(c.stack.length,0);b.dispose();
});

test('a transient first draw error selects Legacy instead of standalone neutral retry',async()=>{
  const b=bridge();b.update(view(),16);await tick();const c=context(),before=c.snapshot();let attempts=0;
  c.ctx.drawImage=()=>{attempts++;if(attempts===1)throw Error('transient draw fault');};
  assert.equal(b.present(c.ctx,layout,legacy),false);assert.equal(attempts,1);
  assert.equal(b.inspect().failed,true);assert.equal(b.inspect().hostCount,0);assert.deepEqual(c.snapshot(),before);b.dispose();
});
test('0/1/100 display samples leave Core sentinel and Storage writes unchanged',async()=>{
  const core=Object.freeze({hp:30,exp:7,save:'original',learning:'unchanged',SRS:4,questionToken:9,timer:375,stageRun:2,capture:0,enemyProgression:0,checkpoint:0,stageClear:false});
  const before=JSON.stringify(core),b=bridge();b.update(view({action:'attack',remainingMs:375}),16);await tick();const c=context();
  const original=globalThis.localStorage;let writes=0;globalThis.localStorage={setItem(){writes++;throw Error('forbidden');}};
  try{for(const n of [0,1,100]){for(let i=0;i<n;i++)b.present(c.ctx,layout,legacy);assert.equal(JSON.stringify(core),before);assert.equal(writes,0);}}
  finally{globalThis.localStorage=original;b.dispose();}
});
test('10 bridge lifecycles have no owned images, timeline, scheduler or listeners after exit',async()=>{
  for(let i=0;i<10;i++){const b=bridge({session:i});b.update(view(),16);await tick();assert.equal(b.inspect().hostCount,1);
    b.dispose();b.dispose();const s=b.inspect();assert.equal(s.hostCount,0);assert.equal(s.imageReference,false);assert.equal(s.timeline,null);
    assert.equal(s.activeSession,null);for(const key of ['scheduledCallback','raf','timer','listener'])assert.equal(s[key],0);}
});
