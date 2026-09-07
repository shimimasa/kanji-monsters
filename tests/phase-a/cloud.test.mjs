import test from 'node:test';
import assert from 'node:assert/strict';
import { installStorage, quota } from './storage-helper.mjs';
import { getDefaultSave, loadSave } from '../../src/core/saveData.js';
import * as controller from '../../src/services/firebase/firebaseController.js';

function mockCloud(docs = {}) {
  const records = new Map(Object.entries(docs)); const writes = [];
  let delay = null;
  let commitError = null;
  const ref = path => ({ path, collection: name => ref(`${path}/${name}`), doc: name => ref(`${path}/${name}`),
    async get() {
      if(delay) await delay;
      if (path.endsWith('/progress')) {
        const rows=[...records].filter(([key])=>key.startsWith(path+'/')&&!key.slice(path.length+1).includes('/'));
        return {empty:rows.length===0,forEach:fn=>rows.forEach(([key,value])=>fn({id:key.slice(path.length+1),data:()=>value,ref:ref(key)}))};
      }
      return {exists:records.has(path), data:()=>records.get(path)};
    },
    async set(value) { writes.push(path); records.set(path,value); },
    onSnapshot() { return () => {}; }
  });
  const db = {collection: name=>ref(name), enablePersistence:()=>Promise.resolve(),
    runTransaction: async fn => fn({get:r=>r.get(),set:(r,v)=>{writes.push(r.path);records.set(r.path,v);}}),
    batch:()=>{const removed=[];return{delete:r=>removed.push(r.path),commit:async()=>{if(commitError)throw commitError;for(const path of removed)records.delete(path);}}}
  };
  const auth = {currentUser:{uid:'child'}};
  globalThis.firebase = {apps:[{}],auth:()=>auth,firestore:Object.assign(()=>db,{FieldValue:{serverTimestamp:()=>123}})};
  controller.initializeFirebaseServices();
  return {records,writes,auth,pause(p){delay=p;},failCommit(error){commitError=error;}};
}
test('E04: absent local save recovers a full snapshot before defaults', async () => {
  installStorage(); const old=getDefaultSave(); old.player.name='remote'; old.player.study.answers={'g1-001':{correct:8,incorrect:1}};
  mockCloud({'users/child/progress/save_v2':{schema:2,revision:'r1',parentRevision:null,save:old}});
  await controller.signInAnonymouslyIfNeeded();
  assert.equal(await controller.recoverKrbSaveFromFirestoreIfMissing(),true);
  assert.equal(loadSave().player.study.answers['g1-001'].correct,8);
});
test('E04: an empty remote does not generate an initial local save', async () => {
  installStorage();mockCloud();await controller.signInAnonymouslyIfNeeded();
  assert.equal(await controller.recoverKrbSaveFromFirestoreIfMissing(),false);
  assert.equal(localStorage.getItem('krb_save'),null);
});
test('E05: delayed remote recovery cannot enter another slot', async () => {
  installStorage();const old=getDefaultSave(); old.player.name='remote';
  const cloud=mockCloud({'users/child/profile/playerStats':{name:'remote',level:7},'users/child/progress/save_v2':{schema:2,revision:'r1',save:old}});
  await controller.signInAnonymouslyIfNeeded();let release;cloud.pause(new Promise(r=>release=r));
  const pending=controller.recoverKrbSaveFromFirestoreIfMissing();
  localStorage.setItem('yomitabi_slot','2');release();await pending;
  assert.equal(localStorage.getItem('krb_save'),null);
});
test('E05: unknown remote versions and split revisions are never overwritten', async () => {
  const local=getDefaultSave();installStorage({krb_save:JSON.stringify(local)});
  const remote={schema:999,revision:'future',save:local};
  const cloud=mockCloud({'users/child/progress/save_v2':remote});await controller.signInAnonymouslyIfNeeded();
  await controller.syncAllCaches();
  assert.deepEqual(cloud.records.get('users/child/progress/save_v2'),remote);
  assert.deepEqual(cloud.writes,[]);
});
test('renaming a player does not reset existing level, experience or collected records', async () => {
  const old=getDefaultSave();old.player.coreStats.level=18;old.player.coreStats.exp=27;
  installStorage({krb_save:JSON.stringify(old)});mockCloud();await controller.signInAnonymouslyIfNeeded();
  const {gameState,loadGameData}=await import('../../src/core/gameState.js');await loadGameData();
  await controller.initializeNewPlayerData('child','new name');
  assert.equal(gameState.playerStats.level,18);
  assert.equal(gameState.playerStats.exp,27);
});
test('confirmed cloud revisions advance once and preserve full queue/checkpoint data', async () => {
  const old=getDefaultSave();old.player.progress.checkpoints={stage1:5};
  old.player.study.reviewQueueDetail=[{id:'g1-001',nextReviewAt:987,interval:6,repetition:2,eFactor:2.4}];
  installStorage({krb_save:JSON.stringify(old)});const cloud=mockCloud();await controller.signInAnonymouslyIfNeeded();
  assert.equal((await controller.syncAllCaches()).ok,true);
  const first=cloud.records.get('users/child/progress/save_v2');
  assert.equal((await controller.syncAllCaches()).ok,true);
  const second=cloud.records.get('users/child/progress/save_v2');
  assert.equal(second.parentRevision,first.revision);assert.notEqual(second.revision,first.revision);
  assert.equal(second.save.player.progress.checkpoints.stage1,5);
  assert.equal(second.save.player.study.reviewQueueDetail[0].nextReviewAt,987);
  assert.equal([...localStorage.data.keys()].filter(k=>k.startsWith('yomitabi_cloud_preserved')).length,0);
  cloud.records.set('users/child/progress/save_v2',{...second,revision:'other-device'});
  const split=await controller.syncAllCaches();assert.equal(split.ok,false);
  assert.equal(cloud.records.get('users/child/progress/save_v2').revision,'other-device');
});
test('cloud recovery quota failure leaves no partial local default and retains the remote', async () => {
  const storage=installStorage();const old=getDefaultSave();old.player.name='remote';
  const cloud=mockCloud({'users/child/progress/save_v2':{schema:2,revision:'r1',save:old}});await controller.signInAnonymouslyIfNeeded();
  storage.fail=(op,key)=>{if(op==='set'&&key==='krb_save')throw quota();};
  await assert.rejects(controller.recoverKrbSaveFromFirestoreIfMissing());
  assert.equal(storage.getItem('krb_save'),null);assert.equal(storage.getItem('krb_review_queue'),null);
  assert.equal(cloud.records.get('users/child/progress/save_v2').save.player.name,'remote');
});
test('legacy cloud stage documents are retained when the old summary lacks progress', async () => {
  installStorage();mockCloud({'users/child/profile/playerStats':{name:'old',level:7},'users/child/progress/hokkaido_area1':{cleared:true,clearedAt:123}});
  await controller.signInAnonymouslyIfNeeded();assert.equal(await controller.recoverKrbSaveFromFirestoreIfMissing(),true);
  assert.deepEqual(loadSave().player.progress.clearedStages,['hokkaido_area1']);
});
test('explicit cloud reset reports failure and does not partially remove a save', async () => {
  installStorage();const cloud=mockCloud({'users/child/profile/playerStats':{name:'old'},'users/child/progress/save_v2':{schema:2,revision:'r1',save:getDefaultSave()}});
  await controller.signInAnonymouslyIfNeeded();cloud.failCommit(new Error('offline'));
  assert.equal(await controller.deleteUserData('child'),false);
  assert.equal(cloud.records.has('users/child/profile/playerStats'),true);
  assert.equal(cloud.records.has('users/child/progress/save_v2'),true);
});
test('explicit cloud reset removes its complete snapshot and revision without touching another slot', async () => {
  installStorage({yomitabi_cloud_base_child_1:'{"revision":"r1"}'});
  const cloud=mockCloud({'users/child/profile/playerStats':{name:'old'},'users/child/progress/save_v2':{schema:2},'users/child/slots/2/progress/save_v2':{schema:2}});
  await controller.signInAnonymouslyIfNeeded();assert.equal(await controller.deleteUserData('child'),true);
  assert.equal(cloud.records.has('users/child/profile/playerStats'),false);
  assert.equal(cloud.records.has('users/child/progress/save_v2'),false);
  assert.equal(cloud.records.has('users/child/slots/2/progress/save_v2'),true);
  assert.equal(localStorage.getItem('yomitabi_cloud_base_child_1'),null);
});
