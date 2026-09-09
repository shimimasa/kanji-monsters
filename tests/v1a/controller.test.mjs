import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { installStorage } from '../phase-a/storage-helper.mjs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { createGLBTimeline, createGLBPlayback } from '../../src/visuals/glbTimeline.js';
import { readGLB, validateContainer } from '../../src/visuals/glbValidation.js';
import { parseGLBAsset } from '../../src/visuals/glbParser.js';
import { createBattleVisualAdapter } from '../../src/visuals/battleVisualAdapter.js';
const storage=installStorage();
const {getDefaultSave,saveNow}=await import('../../src/core/saveData.js');
const {gameState,battleState,loadGameData,beginQuestion}=await import('../../src/core/gameState.js');
const {createScreenLifecycle}=await import('../../src/core/screenLifecycle.js');
const {bindInputSubmission}=await import('../../src/core/answerSubmission.js');
globalThis.fetch=async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(new URL('../../public'+url,import.meta.url),'utf8'))});
const loader=await import('../../src/loaders/dataLoader.js');await loader.loadAllGameData();
const {default:battle}=await import('../../src/screens/battleScreen.js');
const {default:practice}=await import('../../src/screens/practiceBattleScreen.js');
const {default:quick}=await import('../../src/screens/quickReviewPracticeScreen.js');
class Input extends EventTarget {value='';style={};focus(){}blur(){}setAttribute(){}removeAttribute(){}}
function state() {return JSON.stringify({player:gameState.playerStats,enemy:gameState.currentEnemy,
  token:gameState.currentKanji._recordQuestion,learning:gameState.kanjiAnswerStats,
  daily:gameState.dailyAnswerStats,stageRun:battleState.stageRun,battle:{turn:battleState.turn,inputEnabled:battleState.inputEnabled},
  storage:[...storage.data]});}
async function setup(t) {
  t.mock.method(console,'log',()=>{});t.mock.method(console,'warn',()=>{});
  saveNow(getDefaultSave(),{replace:true});await loadGameData();
  t.mock.method(Math,'random',()=>0.5);t.mock.method(Date,'now',()=>1788829200000);
  const timers=new Map();let id=0;
  t.mock.method(globalThis,'setTimeout',(fn,ms)=>{timers.set(++id,{fn,ms});return id;});
  t.mock.method(globalThis,'clearTimeout',id=>timers.delete(id));
  Object.assign(gameState,{currentStageId:'hokkaido_area1',kanjiPool:loader.getKanjiByStageId('hokkaido_area1'),
    currentKanji:{id:'g1-001',text:'一',onyomi:['いち'],kunyomi:['ひと'],_recordQuestion:beginQuestion('battle')},
    hintLevel:0,correctKanjiList:[],wrongKanjiList:[],newlyReadKanjiList:[],
    currentEnemy:{id:'HKD-E01',hp:100,maxHp:100,weakness:'kunyomi',atk:9,isBoss:false}});
  gameState.enemies=[gameState.currentEnemy];
  Object.assign(battleState,{turn:'player',inputEnabled:true,nearMissCount:0,log:[],recentKanjiIds:[],retryQueue:[]});
  battle.inputEl=new Input();battle._active=true;
  battle.canvas={width:800,height:600,style:{},getBoundingClientRect:()=>({left:0,top:0,width:800,height:600})};
  battle._lifecycle=createScreenLifecycle();battle._lifecycle.activate();
  for(const name of ['startKanjiBoxEffect','startStoneAttackEffect','showLogBlock','startComboAnimation'])t.mock.method(battle,name,()=>{});
  t.after(()=>{battle._answerSubmission?.dispose();battle._lifecycle.deactivate();battle._active=false;});
  return timers;
}
for(const command of ['handleAttack','handleHeal'])for(const correct of [true,false])test(`R-01/R-14: actual ${command}/${correct} commit and timers independent of 0/1/100 visual samples`,async t=>{
  const engine=new NullEngine(),scene=new Scene(engine);
  const operation=parseGLBAsset(scene,readGLB(new Uint8Array(fs.readFileSync(new URL('../../public/assets/3d/monsters/HKD-E01/HKD-E01.v1a.1.glb',import.meta.url)))));
  const container=await operation.promise,asset=validateContainer(container);
  container.addAllToScene();const playback=createGLBPlayback(asset.groups,asset.motion),clock=createGLBTimeline();
  t.after(()=>{playback.stop();operation.dispose();container.dispose();scene.dispose();engine.dispose();});
  const timers=await setup(t);
  battle._answerSubmission=bindInputSubmission(battle.inputEl,()=>{if(!battleState.inputEnabled)return false;battle[command]();return !battleState.inputEnabled;});
  battle.inputEl.value=correct?'いち':'ねこ';
  const result=battle._answerSubmission.handleKeydown({key:'Enter',preventDefault(){}},battle.inputEl.value);assert.equal(result.accepted,true);
  assert.equal(gameState.kanjiAnswerStats['g1-001'][correct?'correct':'incorrect'],1);
  assert.equal(JSON.parse(storage.getItem('krb_save')).player.study.answers['g1-001'][correct?'correct':'incorrect'],1);
  const before=state(),scheduled=[...timers].map(([id,{ms}])=>[id,ms]);let writes=0;
  t.mock.method(storage,'setItem',function(k,v){writes++;this.data.set(k,String(v));});
  const snapshot=Object.freeze({stageId:gameState.currentStageId,enemyId:gameState.currentEnemy.id,enemyIndex:0,
    enemyAction:battleState.enemyAction,enemyActionTimer:battleState.enemyActionTimer,enemyHp:gameState.currentEnemy.hp,
    enemyMaxHp:100,generation:1,session:1,reducedMotion:false});
  for(const count of [0,1,100]) {
    for(let i=0;i<count;i++)playback.sample(clock.observe(snapshot,16));
    assert.equal(state(),before);assert.deepEqual([...timers].map(([id,{ms}])=>[id,ms]),scheduled);assert.equal(writes,0);
  }
  // A failed display import has no reference to the real question or pending controller timers.
  const adapter=createBattleVisualAdapter({canvas:{classList:{remove(){}}},generation:1,load:async()=>{throw Error('injected renderer failure');}});
  await adapter.prepare();assert.equal(state(),before);assert.equal(writes,0);adapter.dispose();
  // A real AnimationGroup sampling exception also has no connection to progression.
  const selected=asset.groups[clock.current().clip];t.mock.method(selected,'goToFrame',()=>{throw Error('sample fault');});
  assert.throws(()=>playback.sample(clock.current()),/sample fault/);
  assert.equal(state(),before);assert.deepEqual([...timers].map(([id,{ms}])=>[id,ms]),scheduled);assert.equal(writes,0);
  assert.ok(scheduled.length>0,'existing controller scheduled its own continuation');
});
test('R-15: normal battle-only adapter creation leaves shared practice/quick entry contracts unchanged',()=>{
  const source=fs.readFileSync(new URL('../../src/screens/battleScreen.js',import.meta.url),'utf8');
  assert.match(source,/this === battleScreenState && !entryLifecycle/);
  assert.notEqual(practice,battle);assert.notEqual(quick,battle);
  for(const screen of [practice,quick])assert.equal(screen._battleVisual,undefined);
});
