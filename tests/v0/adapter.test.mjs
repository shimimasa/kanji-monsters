import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createBattleVisualAdapter, readVisualLayout, visualResourceCounts } from '../../src/visuals/battleVisualAdapter.js';
import { createPrimitivePose } from '../../src/visuals/primitivePose.js';

const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };
function element() {
  const classes = new Set();
  return { style:{}, dataset:{}, children:[], classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)},
    setAttribute(){},appendChild(e){this.children.push(e);e.parentNode=this;},
    insertBefore(e){this.appendChild(e);},remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(x=>x!==this);},
    getBoundingClientRect:()=>({left:10,top:20,width:1000,height:600}),width:800,height:600 };
}
function fixture(t, load) {
  t.mock.method(console,'warn',()=>{});
  const previous=globalThis.document;
  globalThis.document={createElement:element};
  const canvas=element(),parent=element();parent.appendChild(canvas);
  const adapter=createBattleVisualAdapter({canvas,generation:1,load});
  t.after(()=>{adapter.dispose();globalThis.document=previous;assert.equal(visualResourceCounts().sessions,0);});
  const layout=readVisualLayout(canvas);
  const snapshot=(extra={})=>Object.freeze({stageId:'hokkaido_area1',enemyId:'HKD-E01',enemyIndex:0,
    enemyAction:'damage',enemyActionTimer:300,enemyHp:20,enemyMaxHp:30,shield:0,reducedMotion:false,
    generation:1,session:adapter.session,monsterRect:Object.freeze({x:524,y:124,width:232,height:112}),...extra});
  return {adapter,canvas,parent,layout,snapshot};
}
function handle() { return { renders:0,disposals:0,resizeCalls:[],present(s){this.renders++;assert.ok(Object.isFrozen(s));},
  resize(l){this.resizeCalls.push(l);},dispose(){this.disposals++;},resources:()=>({engines:1,scenes:1,listeners:1,animations:1}) }; }

test('R-01: zero / one / many presentations preserve all snapshot bytes',async t=>{
  const resource=handle(),f=fixture(t,async()=>({preparePrimitive:()=>resource}));
  await f.adapter.prepare(); const s=f.snapshot(),before=JSON.stringify(s);
  for(const count of [0,1,20]) { for(let i=0;i<count;i++)assert.equal(f.adapter.present(s,16,f.layout),true);assert.equal(JSON.stringify(s),before); }
  assert.equal(resource.renders,21);
});
test('R-02: repeated snapshots do not restart; action, timer reset, enemy and session do',()=>{
  const pose=createPrimitivePose();const s={generation:1,session:1,enemyIndex:0,enemyId:'HKD-E01',enemyAction:'damage',enemyActionTimer:300};
  assert.equal(pose.sample(s,16).starts,1);
  for(let i=0;i<20;i++)assert.equal(pose.sample(s,16).starts,1);
  assert.equal(pose.sample({...s,enemyActionTimer:150},16).starts,1);
  assert.equal(pose.sample(s,16).starts,2);
  assert.equal(pose.sample({...s,enemyAction:'attack'},16).starts,3);
  assert.equal(pose.sample({...s,enemyId:'HKD-E02'},16).starts,4);
  assert.equal(pose.sample({...s,session:2},16).starts,5);
});
for(const kind of ['import','prepare'])test(`R-03: ${kind} rejection returns immediate 2D`,async t=>{
  const f=fixture(t,async()=>{if(kind==='import')throw Error(kind);return {preparePrimitive:()=>{throw Error(kind);}};});
  assert.equal(f.adapter.present(f.snapshot(),16,f.layout),false);
  assert.equal(await f.adapter.prepare(),false);
  assert.equal(f.adapter.present(f.snapshot(),16,f.layout),false);
  assert.equal(f.parent.children.length,1);
});
test('R-03/R-06: indefinite prepare does not gate present; dispose before import settles creates nothing',async t=>{
  const d=deferred(),f=fixture(t,()=>d.promise);let creates=0;
  const pending=f.adapter.prepare();assert.equal(f.adapter.present(f.snapshot(),16,f.layout),false);
  f.adapter.dispose();d.resolve({preparePrimitive(){creates++;return handle();}});
  assert.equal(await pending,false);assert.equal(creates,0);
});
test('R-04: resource arriving after exit is explicitly disposed',async t=>{
  const d=deferred(),resource=handle(),f=fixture(t,async()=>({preparePrimitive:()=>d.promise}));
  const pending=f.adapter.prepare();await new Promise(setImmediate);f.adapter.dispose();d.resolve(resource);
  assert.equal(await pending,false);assert.equal(resource.disposals,1);assert.equal(f.parent.children.length,1);
});
for(const order of ['old-new','new-old'])for(const oldFailure of [false,true])test(`R-05: ${order}, old failure=${oldFailure}`,async t=>{
  const old=deferred(),next=deferred(),a=handle(),b=handle();
  const f=fixture(t,async()=>({preparePrimitive:()=>old.promise}));const p=f.adapter.prepare();await new Promise(setImmediate);
  const newer=createBattleVisualAdapter({canvas:f.canvas,generation:2,load:async()=>({preparePrimitive:()=>next.promise})});
  t.after(()=>newer.dispose());const q=newer.prepare();await new Promise(setImmediate);
  const finishOld=async()=>{oldFailure?old.reject(Error('late')):old.resolve(a);await p;};
  if(order==='old-new') {await finishOld();next.resolve(b);await q;}else {next.resolve(b);await q;await finishOld();}
  assert.equal(newer.present(f.snapshot({generation:2,session:newer.session}),16,f.layout),true);
  assert.equal(a.disposals,oldFailure?0:1);assert.equal(b.disposals,0);assert.equal(f.parent.children.length,2);
  newer.dispose();
});
test('R-06: double dispose before/after ready and late rejection are safe',async t=>{
  const resource=handle(),f=fixture(t,async()=>({preparePrimitive:()=>resource}));
  await f.adapter.prepare();f.adapter.dispose();f.adapter.dispose();assert.equal(resource.disposals,1);
  assert.equal(f.adapter.present(f.snapshot(),16,f.layout),false);
  const d=deferred(),a=createBattleVisualAdapter({canvas:f.canvas,generation:3,load:()=>d.promise});
  const p=a.prepare();a.dispose();a.dispose();d.reject(Error('late reject'));assert.equal(await p,false);
});
test('R-07: contain and pending/ready/disposed resize preserve canvas coordinates',async t=>{
  const resource=handle(),f=fixture(t,async()=>({preparePrimitive:()=>resource}));
  assert.deepEqual(f.layout.content,{left:110,top:20,width:800,height:600,scale:1});
  f.adapter.resize(f.layout);await f.adapter.prepare();
  const next=Object.freeze({...f.layout,content:Object.freeze({left:0,top:100,width:390,height:292.5,scale:.4875})});
  f.adapter.resize(next);assert.equal(resource.resizeCalls.at(-1),next);
  assert.equal(f.canvas.width,800);assert.equal(f.canvas.height,600);
  f.adapter.dispose();const n=resource.resizeCalls.length;f.adapter.resize(next);assert.equal(resource.resizeCalls.length,n);
});
test('R-08/R-13: context failure hides 3D, releases resources, and reentry can render',async t=>{
  let lose;const resource=handle(),f=fixture(t,async()=>({preparePrimitive:({onFailure})=>{lose=onFailure;return resource;}}));
  await f.adapter.prepare();assert.equal(f.adapter.present(f.snapshot(),16,f.layout),true);
  lose(Error('context lost'));assert.equal(f.adapter.present(f.snapshot(),16,f.layout),false);
  assert.equal(f.canvas.classList.contains('yomitabi-3d-active'),false);assert.equal(resource.disposals,1);
  const newer=createBattleVisualAdapter({canvas:f.canvas,generation:2,load:async()=>({preparePrimitive:()=>handle()})});
  await newer.prepare();assert.equal(newer.present(f.snapshot({generation:2,session:newer.session}),16,f.layout),true);newer.dispose();
});
test('R-09: reduced motion suppresses movement, rotation and flash for every action',()=>{
  const pose=createPrimitivePose();for(const enemyAction of [null,'attack','damage','defeat']) {
    const s={enemyAction,enemyActionTimer:100,generation:1,session:1,enemyIndex:0,enemyId:'HKD-E01',reducedMotion:true};
    const a=pose.sample(s,16),b=pose.sample({...s,enemyActionTimer:50},16);
    for(const key of ['x','y','rotation','glow'])assert.equal(a[key],0);
    assert.deepEqual(a,b);
  }
});
test('R-10/R-11: canvas is a decoration, is inserted behind gameCanvas, never binds camera controls',async t=>{
  const f=fixture(t,async()=>({preparePrimitive:()=>handle()}));await f.adapter.prepare();
  const surface=f.parent.children[1].children[0];assert.equal(surface.tabIndex,-1);
  const source=fs.readFileSync(new URL('../../src/visuals/babylonPrimitiveRenderer.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/attachControl\(/);assert.match(source,/scene.detachControl\(\)/);
  const css=fs.readFileSync(new URL('../../style.css',import.meta.url),'utf8');assert.match(css,/\.yomitabi-3d-canvas[^}]+pointer-events: none/);
});
test('R-12/R-16: renderer module boundary cannot access curriculum/save/learning/Firebase',()=>{
  for(const name of ['battleVisualAdapter','babylonPrimitiveRenderer','primitivePose']) {
    const source=fs.readFileSync(new URL(`../../src/visuals/${name}.js`,import.meta.url),'utf8');
    const imports=[...source.matchAll(/(?:from\s*|import\()['"]([^'"]+)/g)].map(m=>m[1]);
    for(const path of imports)assert.doesNotMatch(path,/core\/gameState|save|learning|SRS|loaders|firebase/i);
    assert.doesNotMatch(source,/localStorage|fetch\(|commitLearningOutcome|runRenderLoop\(/);
  }
});
test('R-13: other enemies restore 2D immediately without restarting preparation',async t=>{
  let loads=0;const f=fixture(t,async()=>{loads++;return {preparePrimitive:()=>handle()};});
  assert.equal(f.adapter.present(f.snapshot({enemyId:'HKD-E02'}),16,f.layout),false);assert.equal(loads,0);
  await f.adapter.prepare();assert.equal(f.adapter.present(f.snapshot(),16,f.layout),true);
  assert.equal(f.adapter.present(f.snapshot({enemyId:'HKD-E02'}),16,f.layout),false);
  assert.equal(f.canvas.classList.contains('yomitabi-3d-active'),false);assert.equal(loads,1);
});
test('R-14: a render exception selects 2D in the same call and disposes the failing renderer',async t=>{
  const resource=handle();resource.present=()=>{throw Error('animation fault');};
  const f=fixture(t,async()=>({preparePrimitive:()=>resource}));await f.adapter.prepare();
  assert.equal(f.adapter.present(f.snapshot(),16,f.layout),false);assert.equal(resource.disposals,1);
});
