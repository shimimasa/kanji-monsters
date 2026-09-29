import test from 'node:test';
import assert from 'node:assert/strict';
import { createDashWorld, DASH_FINISH } from '../../src/minigames/gameplay/arcadeWorlds.js';
import { growthStatus } from '../../src/minigames/companionGrowth.js';
import { createGotomonService } from '../../src/minigames/gotomonService.js';
import { getDefaultSave, loadSave } from '../../src/core/saveData.js';
import { loadGameData } from '../../src/core/gameState.js';
import { installStorage, quota } from '../phase-a/storage-helper.mjs';

const effects=growthStatus().effects;
test('race ghost uses own best pace; missing legacy time or slow pace creates no ghost',()=>{
  assert.equal(createDashWorld(effects).snapshot().bestTimeMs,null);
  const race=createDashWorld(effects,{bestTimeMs:60000});race.update(6000);
  const s=race.snapshot();assert.equal(s.ghost,DASH_FINISH*6000/60000);assert.equal(s.paceDeltaMs,s.timeMs-60000*s.position/DASH_FINISH);
  assert.match(s.summary,/ベスト比/);
  assert.equal(createDashWorld(effects,{bestTimeMs:NaN}).snapshot().bestTimeMs,null);
  assert.equal(createDashWorld(effects,{bestTimeMs:60000,pace:'slow'}).snapshot().ghost,null);
});
async function fixture(){
  const value=getDefaultSave();value.player.collection.gotomonIds=['HKD-E01'];value.player.coreStats.exp=42;
  const storage=installStorage({krb_save:JSON.stringify(value)});await loadGameData();
  const service=createGotomonService({lookup:id=>({id,name:id})});
  function run(sessionId,timeMs,extra={}){
    const args={owner:service.getOwner(),sessionId,gameId:'mathSprint',gotomonId:'HKD-E01',correct:9,maxCombo:9,score:1600,completed:true,finished:true,activeElapsedMs:45000,timeMs,...extra};
    args.ticket=service.beginPlay(args);return args;
  }
  return {service,storage,run};
}
test('best race time persists separately from points, improving only on qualifying finishes',async()=>{
  const {service,run}=await fixture();
  assert.equal(service.awardGotomonPlayResult(run('first',60000)).reward.newTimeBest,true);
  assert.equal(service.awardGotomonPlayResult(run('slower',65000)).reward.newTimeBest,false);
  const better=service.awardGotomonPlayResult(run('faster',58800));assert.equal(better.reward.previousTimeMs,60000);
  assert.equal(better.reward.bestTimeMs,58800);assert.equal(loadSave().player.coreStats.exp,42);
  await loadGameData();assert.equal(createGotomonService().getProgress().games.mathSprint.bestTimeMs,58800);
});
test('invalid, failed, aborted, low-accuracy and other-game results cannot set a race best',async()=>{
  const {service,run}=await fixture();let id=0;
  for(const time of [NaN,Infinity,-1,0,null,.1,'500',Number.MAX_SAFE_INTEGER*2])service.awardGotomonPlayResult(run(String(id++),time));
  service.awardGotomonPlayResult(run('low',1000,{correct:7}));
  service.awardGotomonPlayResult(run('notfinished',1000,{finished:false}));
  assert.equal(service.awardGotomonPlayResult(run('abort',1000,{completed:false})).ok,false);
  service.awardGotomonPlayResult(run('other',1000,{gameId:'englishChoice'}));
  assert.equal(service.getProgress().games.mathSprint.bestTimeMs,undefined);
  assert.equal(service.getProgress().games.englishChoice.bestTimeMs,undefined);
});
test('best-time save failure and duplicate result are atomic with XP and main progress',async()=>{
  const {service,storage,run}=await fixture(),args=run('race',60100),before=storage.getItem('krb_save');
  storage.fail=(op,key)=>{if(op==='set'&&key==='krb_save')throw quota();};
  assert.equal(service.awardGotomonPlayResult(args).ok,false);assert.equal(storage.getItem('krb_save'),before);
  storage.fail=null;assert.equal(service.awardGotomonPlayResult(args).reward.bestTimeMs,60100);
  assert.equal(service.awardGotomonPlayResult({...args,timeMs:1}).reward.duplicate,true);
  assert.equal(service.getProgress().games.mathSprint.bestTimeMs,60100);
});
