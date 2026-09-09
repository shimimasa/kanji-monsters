import test from 'node:test';
import assert from 'node:assert/strict';
import { createMonsterMotionHost } from '../../src/visuals/motion/monsterMotionHost.js';
import { drawMonsterImage } from '../../src/visuals/motion/monsterRenderer.js';
import { sampleMonsterPose, NEUTRAL_POSE } from '../../src/visuals/motion/motionProfile.js';
import { HKD_E01_MOTION } from '../../src/visuals/motion/monsterMotionManifest.js';
const image=Object.freeze({complete:true,naturalWidth:512,naturalHeight:512});
const layout=Object.freeze({imageRect:Object.freeze({x:10,y:10,width:240,height:120}),
  clipRect:Object.freeze({x:14,y:14,width:232,height:112})});
const view=(extra={})=>Object.freeze({session:1,monsterId:'HKD-E01',action:'attack',
  remainingMs:375,durationMs:750,...extra});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
globalThis.Path2D=class { rect(...args){this.rectArgs=args;} };
function context(fail=false){
  const calls=[], stack=[];let state={alpha:.7,composite:'xor',matrix:'caller',clip:'caller'};
  return {calls,get state(){return structuredClone(state);},
    get globalAlpha(){return state.alpha;},set globalAlpha(v){state.alpha=v;},
    get globalCompositeOperation(){return state.composite;},set globalCompositeOperation(v){state.composite=v;},
    save(){stack.push({...state});calls.push('save');},
    restore(){state=stack.pop();calls.push('restore');},
    clip(path){state.clip=path.rectArgs;},translate(...a){state.matrix=a;},rotate(){},scale(){},
    drawImage(...args){calls.push(args);if(fail)throw Error('draw failed');},
    beginPath(){throw Error('must not clear caller path');}
  };
}
test('Canvas transform, alpha, composite and clip restored after 100 renders',()=>{
  const ctx=context(),before=ctx.state;
  for(let i=0;i<100;i++)assert.equal(drawMonsterImage(ctx,image,layout,sampleMonsterPose({
    action:'hit',progress:.2,layout:layout.imageRect})),true);
  assert.deepEqual(ctx.state,before);
  const draw=ctx.calls.find(Array.isArray);
  assert.deepEqual(draw.slice(1),[-120,-60,240,120]); // no fit/crop change
});
test('Canvas restored even when drawImage throws',()=>{
  const ctx=context(true),before=ctx.state;
  assert.throws(()=>drawMonsterImage(ctx,image,layout),/draw failed/);
  assert.deepEqual(ctx.state,before);assert.equal(ctx.calls.at(-1),'restore');
});
test('renderer rejects pending/failed images and invalid rect or pose before save',()=>{
  const ctx=context();
  for(const img of [null,{...image,complete:false},{...image,naturalWidth:0}])
    assert.equal(drawMonsterImage(ctx,img,layout),false);
  assert.equal(drawMonsterImage(ctx,image,{...layout,imageRect:{...layout.imageRect,width:0}}),false);
  assert.equal(drawMonsterImage(ctx,image,layout,{...NEUTRAL_POSE,opacity:NaN}),false);
  assert.equal(ctx.calls.length,0);
});
test('pending image does not block update and late image uses current action progress',async()=>{
  const d=deferred(),poses=[],h=createMonsterMotionHost({session:1,imagePromise:d.promise,draw:(_c,_i,_l,p)=>{poses.push(p);return true;}});
  assert.equal(h.update(view()),true);assert.equal(h.present({},layout),false);
  h.update(view({remainingMs:150}));d.resolve(image);assert.equal(await h.settled,true);
  assert.equal(h.present({},layout),true);
  assert.deepEqual(poses[0],sampleMonsterPose({action:'attack',progress:.8,layout:layout.imageRect}));
});
test('image rejection is handled; host remains updateable and asks for existing fallback',async()=>{
  const h=createMonsterMotionHost({session:1,imagePromise:Promise.reject(Error('offline'))});
  assert.equal(await h.settled,false);assert.equal(h.state().imageState,'failed');
  assert.equal(h.update(view()),true);assert.equal(h.present(context(),layout),false);h.dispose();
});
test('resolved broken image is treated as failure',async()=>{
  const h=createMonsterMotionHost({session:1,imagePromise:Promise.resolve({...image,naturalHeight:0})});
  assert.equal(await h.settled,false);assert.equal(h.state().imageState,'failed');
});
for(const outcome of ['resolve','reject'])test('exit during image pending; late '+outcome+' cannot resurrect host',async()=>{
  const d=deferred(),h=createMonsterMotionHost({session:1,imagePromise:d.promise});
  h.update(view());h.dispose();h.dispose();
  outcome==='resolve'?d.resolve(image):d.reject(Error('late'));
  assert.equal(await h.settled,false);assert.equal(h.update(view()),false);
  assert.equal(h.present(context(),layout),false);
  assert.deepEqual(h.state(),{disposed:true,imageState:'disposed',timeline:null});
});
for(const order of ['old-new','new-old'])test('old/new image completion order '+order,async()=>{
  const old=deferred(),fresh=deferred();let draws=0;
  const a=createMonsterMotionHost({session:1,imagePromise:old.promise,draw:()=>{throw Error('old draw');}});
  a.dispose();
  const b=createMonsterMotionHost({session:2,imagePromise:fresh.promise,draw:()=>{draws++;return true;}});
  b.update(view({session:2}));
  const list=order==='old-new'?[old,fresh]:[fresh,old];list.forEach(d=>d.resolve(image));
  await Promise.all([a.settled,b.settled]);
  assert.equal(a.present({},layout),false);assert.equal(b.present({},layout),true);assert.equal(draws,1);b.dispose();
});
test('old session and wrong monster snapshots are rejected',async()=>{
  const h=createMonsterMotionHost({session:1,imagePromise:image});await h.settled;
  assert.equal(h.update(view({session:0})),false);assert.equal(h.update(view({monsterId:'HKD-E02'})),false);
  assert.equal(h.state().timeline,null);h.dispose();
});
test('unknown profile uses the same static image; invalid layout uses caller fallback',async()=>{
  const poses=[],h=createMonsterMotionHost({session:1,imagePromise:image,
    visual:{...HKD_E01_MOTION,motionProfile:'unknown'},draw:(_c,_i,_l,p)=>{poses.push(p);return true;}});
  await h.settled;h.update(view());h.present({},layout);assert.deepEqual(poses,[NEUTRAL_POSE]);
  assert.equal(h.present({},null),false);h.dispose();
});
test('renderer exception tries neutral same-image fallback and handles a second failure',async()=>{
  let calls=0;const h=createMonsterMotionHost({session:1,imagePromise:image,draw:(_c,_i,_l,p)=>{
    calls++;if(calls===1)throw Error('motion');assert.deepEqual(p,NEUTRAL_POSE);return true;}});
  await h.settled;h.update(view());assert.equal(h.present({},layout),true);assert.equal(calls,2);
  const bad=createMonsterMotionHost({session:1,imagePromise:image,draw:()=>{throw Error('context');}});
  await bad.settled;bad.update(view());assert.equal(bad.present({},layout),false);
});
test('0/1/100 renders do not touch Core state, Storage, random, timers or networking',async()=>{
  const core=Object.freeze({HP:31,EXP:10,save:'original',learning:'original',SRS:'original',
    questionToken:'q1',timer:375,stageRun:'run1',enemyProgression:0});
  const h=createMonsterMotionHost({session:1,imagePromise:image});await h.settled;
  h.update(view());const before=JSON.stringify({core,display:h.state()});let writes=0;
  const originals=new Map();
  for(const key of ['localStorage','sessionStorage','fetch','setTimeout','setInterval','requestAnimationFrame']){
    originals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
    Object.defineProperty(globalThis,key,{configurable:true,get(){writes++;throw Error('Forbidden '+key);}});
  }
  const random=Math.random;Math.random=()=>{throw Error('Forbidden random');};
  try{
    for(const n of [0,1,100]){for(let i=0;i<n;i++)h.present(context(),layout);
      assert.equal(JSON.stringify({core,display:h.state()}),before);}
    assert.equal(writes,0);
  }finally{
    Math.random=random;for(const[k,v]of originals)v?Object.defineProperty(globalThis,k,v):delete globalThis[k];
  }
});
test('repeated ready host exit releases references and is idempotent',async()=>{
  for(let i=0;i<10;i++){
    const h=createMonsterMotionHost({session:i,imagePromise:image});await h.settled;h.update(view({session:i}));
    assert.equal(h.present(context(),layout),true);h.dispose();h.dispose();
    assert.deepEqual(h.state(),{disposed:true,imageState:'disposed',timeline:null});
  }
});
