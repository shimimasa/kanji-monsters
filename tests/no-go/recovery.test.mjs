import test from 'node:test';
import assert from 'node:assert/strict';
import {installStorage,quota} from '../phase-a/storage-helper.mjs';
import {getDefaultSave,loadSave} from '../../src/core/saveData.js';
import {recoverCloudSave} from '../../src/services/firebase/cloudSave.js';
import {initializeSaveSession} from '../../src/core/saveBootstrap.js';
const envelope=()=>({schema:2,revision:'confirmed',save:getDefaultSave()});
function context(data,delay=Promise.resolve()) {
  const ref={collection(){return this},doc(){return this},async get(){await delay;return {exists:!!data,data:()=>data,forEach(){}}}};
  return {db:ref,uid:'child',slot:1,isCurrent:()=>true};
}
test('E04: explicit corrupt recovery retains original and restores a validated full cloud snapshot',async()=>{
 const storage=installStorage({krb_save:'{broken'});const remote=envelope();remote.save.player.study.answers={'g1-001':{correct:5,incorrect:2}};
 const result=await initializeSaveSession(()=>recoverCloudSave(context(remote),{replaceCorrupt:true}),{recoverCorrupt:true});
 assert.equal(result.ok,true);assert.equal(loadSave().player.study.answers['g1-001'].correct,5);
 assert.ok([...storage.data].some(([key,value])=>key.startsWith('yomitabi_preserved_')&&value.includes('{broken')));
});
for(const mode of ['empty','future','quota'])test(`E04: ${mode} cannot replace corrupt original with defaults`,async()=>{
 const storage=installStorage({krb_save:'{broken'});let data=mode==='empty'?null:envelope();if(mode==='future')data.schema=999;
 if(mode==='quota')storage.fail=(op,key)=>{if(op==='set'&&key.startsWith('yomitabi_preserved_'))throw quota();};
 let result;try{result=await recoverCloudSave(context(data),{replaceCorrupt:true})}catch{}
 assert.ok(!result?.recovered);assert.equal(storage.getItem('krb_save'),'{broken');
});
test('E04: default bootstrap still protects corruption and unknown versions without implicit restore',async()=>{
 for(const raw of ['{broken',JSON.stringify({meta:{version:999}})]) {
  installStorage({krb_save:raw});let calls=0;const result=await initializeSaveSession(()=>calls++);
  assert.equal(result.ok,false);assert.equal(calls,0);assert.equal(localStorage.getItem('krb_save'),raw);
 }
});

test('E04/E08: leaving recovery while remote is pending cannot replace local or in-memory data',async()=>{
 const storage=installStorage({krb_save:'{broken'});let finish,current=true;
 const ctx=context(envelope(),new Promise(r=>finish=r));ctx.isCurrent=()=>current;
 const pending=initializeSaveSession(()=>recoverCloudSave(ctx,{replaceCorrupt:true}),{recoverCorrupt:true,isCurrent:()=>current});
 current=false;finish();const result=await pending;
 assert.equal(result.ok,false);assert.equal(storage.getItem('krb_save'),'{broken');
});

test('E04/E06: remote timeout and late success preserve the original',async t=>{
 const storage=installStorage({krb_save:'{broken'});let finish;
 t.mock.timers.enable({apis:['setTimeout']});
 const pending=recoverCloudSave(context(envelope(),new Promise(r=>finish=r)),{replaceCorrupt:true});
 const rejected=assert.rejects(pending);
 t.mock.timers.tick(11000);await rejected;
 finish();for(let i=0;i<10;i++)await Promise.resolve();
 assert.equal(storage.getItem('krb_save'),'{broken');
});
