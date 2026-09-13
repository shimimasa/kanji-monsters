import test from 'node:test';
import assert from 'node:assert/strict';
import { createConstellationWorld } from '../../src/minigames/gameplay/constellationWorld.js';
import { createTreasureWorld, createExplorationWorld, createRaceWorld } from '../../src/minigames/gameplay/trailWorlds.js';
import { growthStatus } from '../../src/minigames/companionGrowth.js';
import { createGotomonService } from '../../src/minigames/gotomonService.js';
import { getDefaultSave, loadSave } from '../../src/core/saveData.js';
import { loadGameData } from '../../src/core/gameState.js';
import { installStorage, quota } from '../phase-a/storage-helper.mjs';

const effects=growthStatus().effects;
test('star routes change partial recovery and full-answer progress, not grading',()=>{
  const values=[0,1,2].map(route=>{const world=createConstellationWorld(effects);world.act(`star-route-${route}`);world.answer(false,{score:.5});return world.snapshot();});
  assert.deepEqual(values.map(value=>value.routes.reduce((a,b)=>a+b,0)),[1.2,1,.8]);
  assert.deepEqual(values.map(value=>value.stars),[1,1,1]);
  const crown=createConstellationWorld(effects);crown.act('star-route-2');crown.answer(true);
  assert.equal(crown.snapshot().routes[2],2.4);
});
test('a companion skill lights two actual routes only after earned progress',()=>{
  const world=createConstellationWorld(effects);world.boost();world.answer(false,{score:0});
  assert.deepEqual(world.snapshot().routes,[0,0,0]);
  world.boost();world.answer(true);assert.deepEqual(world.snapshot().routes,[0,2,1]);
  assert.equal(world.snapshot().rainbow,false);
});
test('star lines, whole routes and whole sky have distinct bounded milestones',()=>{
  const world=createConstellationWorld(effects);world.answer(true);world.answer(true);
  assert.deepEqual(world.snapshot().lines,[0,1,0]);assert.equal(world.snapshot().completed,0);
  world.answer(true);assert.equal(world.snapshot().completed,1);assert.equal(world.act('star-route-1'),false);
  assert.equal(world.act('star-route--1'),false);assert.equal(world.act('star-route-1.5'),false);
  for(let i=0;i<7;i++)world.answer(true);
  const full=world.snapshot();assert.deepEqual(full.routes,[6,6,6]);assert.equal(full.completed,3);assert.equal(full.climax,true);
  world.answer(false,{score:0});assert.equal(world.snapshot().bonus,full.bonus);
  world.answer(true);assert.equal(world.snapshot().bonus,full.bonus+24); // no duplicate line/finish bonus
  assert.deepEqual(world.snapshot().routes,[6,6,6]);
});
test('star skill overflow reaches unfinished route instead of losing light',()=>{
  const world=createConstellationWorld(effects);world.answer(true);world.answer(true);world.boost();world.answer(true);
  assert.equal(world.snapshot().routes[1],6);assert.equal(world.snapshot().routes[2],1);
  assert.equal(world.snapshot().route,0);
});
test('ten dungeon doors form four remembered rooms with a normal fallback for rare failure',()=>{
  const world=createTreasureWorld(effects);world.act('rare');
  for(let i=0;i<10;i++)world.answer(i!==1);
  const value=world.snapshot();assert.equal(value.steps.length,10);assert.equal(value.findings.length,4);
  assert.equal(value.findings[0].points,50);assert.equal(value.findings[0].kind,'normal');
  assert.equal(value.findings[1].kind,'rare');assert.equal(value.progress,1);
  assert.deepEqual(value.steps.map(step=>step.room),[0,0,0,1,1,1,2,2,2,3]);
});
test('a dungeon branch is locked while traversing its room',()=>{
  const world=createTreasureWorld(effects);world.answer(true);assert.equal(world.act('rare'),false);
  world.answer(true);world.answer(true);assert.equal(world.act('rare'),true);
});
function explore(variation,order=[0,1,2,3,4]) {
  const world=createExplorationWorld(effects,{variation});
  for(const id of order){assert.equal(world.act(`route-${id}`),true);world.answer(true);world.answer(true);}
  return world.snapshot();
}
test('three small discovery variations preserve the same five-site content and path',()=>{
  const runs=[0,1,2].map(variation=>explore(variation));
  assert.deepEqual(runs.map(run=>run.featured),[4,3,2]);
  assert.equal(new Set(runs.map(run=>run.findings[0].label)).size,3);
  for(const run of runs){assert.deepEqual(run.path,[0,1,2,3,4]);assert.equal(run.findings.length,5);assert.equal(run.rare,1);}
});
test('found objects stay in chosen order; rumours reward a different early detour',()=>{
  const ordered=explore(0,[0,1,4,3,2]),alternative=explore(0,[1,0,2,4,3]);
  assert.deepEqual(ordered.findings.map(item=>item.place),['林道','海辺','湖','高原','遺跡']);
  assert.notEqual(ordered.findings[0].label,alternative.findings[0].label);
  assert.ok(ordered.findings.find(item=>item.place==='湖').points>alternative.findings.find(item=>item.place==='湖').points);
});
test('race marker uses own best average pace; missing legacy time creates no fake opponent',()=>{
  assert.equal(createRaceWorld(effects).snapshot().bestTimeMs,null);
  const race=createRaceWorld(effects,{bestTimeMs:60000});race.update(7000);race.answer(true,{},1);
  const s=race.snapshot();assert.equal(s.paceDeltaMs,s.timeMs-6000);assert.match(s.summary,/ベスト比/);
  assert.equal(createRaceWorld(effects,{bestTimeMs:NaN}).snapshot().bestTimeMs,null);
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
