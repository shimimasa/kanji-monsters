import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createGLBPreparation } from '../../src/visuals/glbPreparation.js';
import { potatoVisual } from '../../src/visuals/monsterVisualManifest.js';
const bytes=new Uint8Array(fs.readFileSync(new URL('../../public'+potatoVisual.url,import.meta.url)));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const tick=()=>new Promise(setImmediate);
function setup(t,options={}) {
  let id=0;const timers=new Map(),events=[];
  const container={disposeCount:0,dispose(){this.disposeCount++;events.push('container.dispose');}};
  const operation={promise:Promise.resolve(container),disposeCount:0,dispose(){this.disposeCount++;events.push('parser.dispose');},resources:()=>({observers:3})};
  let signal;
  const p=createGLBPreparation({scene:{},fetchBytes:async(url,s)=>{assert.equal(url,potatoVisual.url);signal=s;return bytes;},
    verifyHash:async()=>{},loadParser:async()=>({parseGLBAsset:()=>operation}),validate:c=>{assert.equal(c,container);events.push('validate');return{mesh:'mesh'};},
    materialReady:()=>{events.push('material');return true;},activate:()=>events.push('activate'),onFailure:e=>events.push('failure:'+e.message),
    timers:{setTimeout(fn,ms){timers.set(++id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);}},...options});
  t.after(()=>{p.dispose();assert.equal(timers.size,0);});
  return {p,container,operation,events,timers,get signal(){return signal;}};
}
test('R-03/R-06 early handle: fetch never settles, deadline aborts and promise settles false',async t=>{
  const pending=deferred();let signal;
  const f=setup(t,{fetchBytes:(_u,s)=>{signal=s;return pending.promise;}});
  assert.equal(f.p.ready,false);await tick();assert.equal(f.p.resources().requests,1);
  [...f.timers.values()].find(x=>x.ms===10000).fn();
  assert.equal(await f.p.promise,false);assert.equal(signal.aborted,true);assert.equal(f.events.filter(x=>x.startsWith('failure')).length,1);
  f.p.dispose();f.p.dispose();pending.reject(Error('late network reject'));await tick();
});
for(const stage of ['fetch','loader','parse','validation','material'])test(`R-03/R-12 ${stage} failure releases resources and does not retry curriculum`,async t=>{
  const options={};
  if(stage==='fetch')options.fetchBytes=async()=>{throw Error('404');};
  if(stage==='loader')options.loadParser=async()=>{throw Error('loader import');};
  if(stage==='parse')options.loadParser=async()=>({parseGLBAsset:()=>({promise:Promise.reject(Error('parse reject')),dispose(){},resources:()=>({observers:0})})});
  if(stage==='validation')options.validate=()=>{throw Error('bounds / clip');};
  if(stage==='material')options.materialReady=()=>{throw Error('shader');};
  const f=setup(t,options);assert.equal(await f.p.promise,false);assert.equal(f.p.ready,false);
  assert.equal(f.events.includes('activate'),false);assert.equal(f.events.filter(x=>x.startsWith('failure')).length,1);
  if(['validation','material'].includes(stage))assert.equal(f.container.disposeCount,1);
  f.p.dispose();assert.equal(f.p.resources().requests,0);assert.equal(f.p.resources().containers,0);
});
test('shader/material never ready hits visual deadline; never adds to scene',async t=>{
  const f=setup(t,{materialReady:()=>false});await tick();
  assert.equal(f.p.resources().phase,'material');assert.equal(f.p.resources().polls,1);
  [...f.timers.values()].find(x=>x.ms===10000).fn();assert.equal(await f.p.promise,false);
  assert.equal(f.container.disposeCount,1);assert.equal(f.events.includes('activate'),false);
});
test('R-04 exit while parse pending: late container disposed exactly once',async t=>{
  const d=deferred(),f=setup(t);f.operation.promise=d.promise;await tick();
  assert.equal(f.p.resources().phase,'parse');f.p.dispose();f.p.dispose();
  assert.equal(await f.p.promise,false);assert.equal(f.operation.disposeCount,1);
  d.resolve(f.container);await tick();assert.equal(f.container.disposeCount,1);assert.equal(f.events.includes('activate'),false);
});
for(const order of ['old-new','new-old'])test(`R-05 ${order}: only current session activates`,async t=>{
  let current=1;const a=deferred(),b=deferred();
  const old=setup(t,{isCurrent:()=>current===1});old.operation.promise=a.promise;await tick();
  current=2;old.p.dispose();const next=setup(t,{isCurrent:()=>current===2});next.operation.promise=b.promise;await tick();
  if(order==='old-new'){a.resolve(old.container);await tick();b.resolve(next.container);}else{b.resolve(next.container);await next.p.promise;a.resolve(old.container);}
  assert.equal(await old.p.promise,false);assert.equal(await next.p.promise,true);await tick();
  assert.equal(old.container.disposeCount,1);assert.equal(old.events.includes('activate'),false);assert.equal(next.p.ready,true);
});
test('generation invalidated without dispose rejects activation and disposes late container',async t=>{
  let current=true;const d=deferred(),f=setup(t,{isCurrent:()=>current});f.operation.promise=d.promise;await tick();current=false;
  d.resolve(f.container);assert.equal(await f.p.promise,false);assert.equal(f.container.disposeCount,1);assert.equal(f.events.includes('activate'),false);
});
test('R-06/R-13 ready disposal and subsequent reentry are independent',async t=>{
  const a=setup(t);assert.equal(await a.p.promise,true);assert.deepEqual(a.events,['validate','material','activate']);
  assert.equal(a.timers.size,0);a.p.dispose();a.p.dispose();assert.equal(a.container.disposeCount,1);assert.equal(a.signal.aborted,true);
  const b=setup(t);assert.equal(await b.p.promise,true);assert.equal(b.container.disposeCount,0);
});
