import test from 'node:test';
import assert from 'node:assert/strict';
import { installStorage, quota } from '../phase-a/storage-helper.mjs';
import { getDefaultSave, loadSave, migrateSave } from '../../src/core/saveData.js';
import { loadGameData, saveGameData } from '../../src/core/gameState.js';
import { switchToSlot } from '../../src/core/saveSlots.js';
import { createGotomonService } from '../../src/minigames/gotomonService.js';
import { growthStatus, XP_THRESHOLDS, calculateXP, supportStyle, supportPoints, friendshipTitle } from '../../src/minigames/companionGrowth.js';
import { scoreRank } from '../../src/minigames/scoreRank.js';
import { createCompanionPlay } from '../../src/minigames/companionPlay.js';
import { createExplorationWorld, createTreasureWorld } from '../../src/minigames/gameplay/trailWorlds.js';
import { createLanternWorld, createConstellationWorld } from '../../src/minigames/gameplay/puzzleWorlds.js';
import { createDashWorld, createInvaderWorld, DASH_FINISH } from '../../src/minigames/gameplay/arcadeWorlds.js';
import { createSentenceOrderGame } from '../../src/minigames/sentenceOrder/sentenceOrderGame.js';

const effects=growthStatus().effects;
async function fixture(record={}) {
  const snapshot=getDefaultSave();snapshot.player.name='育成QA';snapshot.player.coreStats.exp=42;
  snapshot.player.collection.gotomonIds=['HKD-E01','HKD-E02'];
  snapshot.player.miniGames={companions:{'HKD-E01':{plays:8,friendship:27,medals:['old-medal'],...record}},games:{}};
  const storage=installStorage({krb_save:JSON.stringify(snapshot)});await loadGameData();
  return {storage,service:createGotomonService({lookup:id=>({id,name:id,grade:1,category:'食文化'})})};
}
function run(service,sessionId='one',overrides={}) {
  const args={owner:service.getOwner(),sessionId,gameId:'mathSprint',gotomonId:'HKD-E01',score:1700,correct:10,maxCombo:10,completed:true,finished:true,activeElapsedMs:45000,...overrides};
  args.ticket=service.beginPlay(args);return args;
}
test('old companion records derive Lv1, preserving friendship; stored enemy-like level is not trusted',async()=>{
  const {service}=await fixture({level:99});assert.equal(service.getGrowth('HKD-E01').level,1);
  assert.equal(service.getProgress().companions['HKD-E01'].friendship,27);assert.equal(loadSave().player.coreStats.exp,42);
});
test('all ten XP thresholds, boundaries, max and invalid values',()=>{
  XP_THRESHOLDS.forEach((xp,index)=>{assert.equal(growthStatus({xp}).level,index+1);if(xp)assert.equal(growthStatus({xp:xp-1}).level,index);});
  assert.equal(growthStatus({xp:999999}).xp,1520);assert.equal(growthStatus({xp:1520}).fraction,1);
  for(const xp of [NaN,Infinity,-1,3.5,'140',null])assert.equal(growthStatus({xp}).level,1);
});
test('normal 45-second perfect first run earns30; early levels take a few runs',()=>{
  assert.equal(calculateXP({completed:true,finished:true,correct:10,rank:'S',newBest:true,activeElapsedMs:45000}),30);
  assert.equal(calculateXP({completed:true,finished:true,correct:8,rank:'A',activeElapsedMs:90000}),23);
  assert.equal(growthStatus({xp:30+25+25}).level,2);
});
test('abandonment and sub10second spam earn noXP; active-time cap bounds farming',()=>{
  const args={completed:true,finished:true,correct:12,rank:'S',newBest:true};
  assert.equal(calculateXP({...args,completed:false,activeElapsedMs:90000}),0);
  assert.equal(calculateXP({...args,activeElapsedMs:9999}),0);
  for(const activeElapsedMs of [10000,15000,30000,45000])assert.ok(calculateXP({...args,activeElapsedMs})<=activeElapsedMs/1500);
  assert.equal(calculateXP({...args,finished:false,correct:0,rank:'C',newBest:false,activeElapsedMs:90000}),0);
});
test('XP transaction crosses level and preserves capture/main stats/medals',async()=>{
  const {service}=await fixture({xp:50});const receipt=service.awardGotomonPlayResult(run(service));
  assert.equal(receipt.reward.earnedXP,30);assert.equal(receipt.reward.levelUp,true);assert.equal(receipt.reward.after.level,2);
  assert.equal(service.getProgress().companions['HKD-E01'].friendship,31);
  assert.deepEqual(service.getProgress().companions['HKD-E01'].medals,['old-medal','five-plays']);
  assert.equal(loadSave().player.coreStats.exp,42);assert.deepEqual(loadSave().player.collection.gotomonIds,['HKD-E01','HKD-E02']);
});
test('maxXP awards only remainingXP and never Lv11',async()=>{
  const {service}=await fixture({xp:1518});const result=service.awardGotomonPlayResult(run(service));
  assert.equal(result.reward.earnedXP,2);assert.equal(result.reward.after.level,10);
  assert.equal(service.awardGotomonPlayResult(run(service,'two')).reward.earnedXP,0);
});
test('same ticket, repeated result, reload and oldA afterB never duplicateXP',async()=>{
  const {service}=await fixture();const first=run(service);service.awardGotomonPlayResult(first);
  assert.equal(service.awardGotomonPlayResult(first).reward.duplicate,true);
  const second=run(service,'two');service.awardGotomonPlayResult(second);
  assert.equal(service.awardGotomonPlayResult(first).ok,false);assert.equal(service.getGrowth('HKD-E01').xp,55);
  saveGameData();await loadGameData();const reloaded=createGotomonService();
  assert.equal(reloaded.awardGotomonPlayResult({...first,owner:reloaded.getOwner()}).ok,false);
  const replayed=run(reloaded,'one');assert.equal(reloaded.awardGotomonPlayResult(replayed).reward.duplicate,true);
  assert.equal(reloaded.getGrowth('HKD-E01').xp,55);assert.equal(migrateSave(loadSave()).player.miniGames.companions['HKD-E01'].xp,55);
});
test('aborted ticket, fake ticket and uncaptured companion are rejected',async()=>{
  const {service}=await fixture();const args=run(service);
  assert.equal(service.awardGotomonPlayResult({...args,completed:false}).ok,false);
  assert.equal(service.awardGotomonPlayResult({...args,ticket:{sessionId:'one'}}).ok,false);
  assert.equal(service.beginPlay({...args,gotomonId:'HKD-E03'}),null);
  assert.equal(service.getGrowth('HKD-E01').xp,0);
});
test('different companions own independentXP, selected pal changes cannot redirect a result',async()=>{
  const {service}=await fixture();const first=run(service);service.setSelectedGotomon('HKD-E02');
  assert.equal(service.awardGotomonPlayResult({...first,gotomonId:'HKD-E02'}).ok,false);
  service.awardGotomonPlayResult(first);assert.equal(service.getGrowth('HKD-E01').xp,30);assert.equal(service.getGrowth('HKD-E02').xp,0);
  service.awardGotomonPlayResult(run(service,'two',{gotomonId:'HKD-E02'}));assert.equal(service.getGrowth('HKD-E02').xp,25);
});
test('slot epoch rejects old result even after switching back',async()=>{
  const {service}=await fixture();const first=run(service);
  assert.equal(switchToSlot(2),true);await loadGameData();assert.equal(service.awardGotomonPlayResult(first).ok,false);
  assert.equal(switchToSlot(1),true);await loadGameData();assert.equal(service.awardGotomonPlayResult(first).ok,false);
  assert.equal(service.getGrowth('HKD-E01').xp,0);
});
test('quota failure preservesXP and ticket retry commits exactly once',async()=>{
  const {service,storage}=await fixture({xp:50});const args=run(service),before=storage.getItem('krb_save');
  storage.fail=(op,key)=>{if(op==='set'&&key==='krb_save')throw quota();};
  assert.equal(service.awardGotomonPlayResult(args).ok,false);assert.equal(storage.getItem('krb_save'),before);
  storage.fail=null;assert.equal(service.awardGotomonPlayResult(args).reward.after.xp,80);
  assert.equal(service.awardGotomonPlayResult(args).reward.duplicate,true);assert.equal(service.getGrowth('HKD-E01').xp,80);
});
test('Lv milestones change only skillpoints, potency, charge and initial gauge',()=>{
  assert.deepEqual(growthStatus({xp:240}).effects,{skillPoints:165,potency:1.1,charge:1,startGauge:0});
  assert.equal(growthStatus({xp:730}).effects.charge,1.15);assert.equal(growthStatus({xp:1520}).effects.startGauge,1);
  const play=createCompanionPlay('x',{growth:growthStatus({xp:1520})});
  for(let seq=1;seq<=2;seq++)play.observe({sessionId:'x',seq,type:'correct'});
  assert.ok(play.snapshot().gauge>=3);assert.equal(play.boost(true),false);assert.equal(play.boost(),true);assert.equal(play.snapshot().score,365);
});
test('existing descriptive categories create small situational, not rarity, differences',()=>{
  assert.equal(supportStyle('食文化').id,'warm');assert.equal(supportStyle('自然').id,'flow');assert.equal(supportStyle('歴史').id,'finish');assert.equal(supportStyle('産業').id,'spark');assert.equal(supportStyle().id,'steady');
  for(const id of ['warm','flow','finish','spark','steady'])for(const combo of [0,3,10])assert.ok(Math.abs(supportPoints(id,{combo}))<=12);
  assert.equal(friendshipTitle(100).title,'ずっといっしょ');assert.equal(friendshipTitle(0).next,12);
});
test('rank requires learning accuracy even when bonuses are large',()=>{
  assert.equal(scoreRank('mathSprint',99999,0).rank,'B');assert.equal(scoreRank('mathSprint',99999,6).rank,'A');
  assert.equal(scoreRank('mathSprint',1600,8).rank,'S');assert.equal(scoreRank('kanjiDefense',2700,10).rank,'S');
  assert.match(scoreRank('multiSelect',1500,7).goal,/あと1問正解と100pt/);
});
test('exploration route order affects discovery; visited nodes are not farmable',()=>{
  const explore=order=>{const world=createExplorationWorld(effects);for(const id of order){assert.equal(world.act(`route-${id}`),true);assert.equal(world.act(`route-${id}`),false);world.answer(true);world.answer(true);}return world;};
  const prepared=explore([0,1,2,3,4]),early=explore([0,2,1,3,4]);
  assert.equal(prepared.snapshot().rare,1);assert.equal(early.snapshot().rare,0);assert.ok(prepared.snapshot().bonus>early.snapshot().bonus);
  assert.equal(prepared.act('route-0'),false);assert.equal(prepared.snapshot().progress,1);
});
test('exploration blocks keyboard answer until a route is chosen; pause blocks action',()=>{
  const play=createCompanionPlay('x',{gameId:'asyncChoice'});play.context({phase:'answering',paused:false});
  assert.equal(play.allowCommand({type:'answer'}),false);assert.equal(play.act('route-0'),true);assert.equal(play.allowCommand({type:'answer'}),true);
  play.context({phase:'answering',paused:true});assert.equal(play.act('route-1'),false);
});
test('answering before the hurdle beats waiting at it; a slip only slows the runner',()=>{
  const early=createDashWorld(effects),late=createDashWorld(effects);
  for(let i=0;i<10;i++)early.answer(true,{},i+1);
  for(let i=0;i<120&&!early.snapshot().finished;i++)early.update(500);
  for(let i=0;i<10;i++){late.update(9000);late.answer(true,{},i+1);}
  for(let i=0;i<120&&!late.snapshot().finished;i++)late.update(500);
  assert.equal(early.snapshot().position,DASH_FINISH);assert.ok(early.snapshot().timeMs<late.snapshot().timeMs);
  assert.ok(early.snapshot().bonus>late.snapshot().bonus);assert.ok(late.snapshot().cleanJumps<early.snapshot().cleanJumps);
  const slip=createDashWorld(effects);slip.answer(false,{},0);slip.update(8000);
  assert.equal(slip.snapshot().trips,1);assert.equal(slip.snapshot().cleared,1);
});
test('the runner waits at an unanswered hurdle and holds the result until the goal',()=>{
  const world=createDashWorld(effects);world.update(20000);
  assert.equal(world.snapshot().waiting,true);assert.equal(world.snapshot().cleared,0);
  for(let i=0;i<10;i++)world.answer(true,{},i+1);world.complete();
  assert.equal(world.snapshot().holdResult,true);
  for(let i=0;i<200&&world.snapshot().holdResult;i++)world.update(250);
  assert.equal(world.snapshot().finished,true);assert.equal(world.snapshot().holdResult,false);
});
test('treasure safe vs rare has a real risk/reward tradeoff without changing grading',()=>{
  const run=correct=>{const safe=createTreasureWorld(effects),rare=createTreasureWorld(effects);rare.act('rare');for(const value of correct){safe.answer(value);rare.answer(value);}return[safe.snapshot().bonus,rare.snapshot().bonus];};
  assert.deepEqual(run([true,true,true]),[90,105]);assert.deepEqual(run([true,false,true]),[65,50]);
});
test('lantern light can be spent, replenished, and conserved by fever, never autoanswers',()=>{
  const world=createLanternWorld(effects);assert.equal(world.act('light-tower'),true);assert.equal(world.act('light-tower'),false);
  world.update(5000,{phase:'answering'});world.answer(true,{},3);const before=world.snapshot().light;
  world.update(1000,{phase:'answering'});assert.equal(world.snapshot().light,before-1);assert.equal(world.snapshot().towers,1);
});
test('constellation partial points add real stars and a skill amplifies only earned stars',()=>{
  const world=createConstellationWorld(effects);world.answer(false,{score:.5});assert.equal(world.snapshot().stars,1);
  world.boost();world.answer(false,{score:.5});assert.equal(world.snapshot().stars,2.5);
  world.boost();world.answer(false,{score:0});assert.equal(world.snapshot().stars,2.5);
});
test('fever shots and the boss add bonus without changing hits',()=>{
  const world=createInvaderWorld(effects);
  world.answer(true,{},1);const plain=world.snapshot().bonus;
  world.boost();world.answer(true,{},1);assert.equal(world.snapshot().bonus-plain,plain+25);
  world.answer(true,{boss:true,wrongAttempts:1},2);assert.equal(world.snapshot().bossDown,true);assert.equal(world.snapshot().bossFirstTry,false);
  world.answer(false,{reason:'escaped'},0);assert.equal(world.snapshot().escapes,1);assert.equal(world.snapshot().kills,3);
});
test('world time freezes when paused and ends at completion',()=>{
  const play=createCompanionPlay('x',{gameId:'timedChoice'});play.context({phase:'answering',paused:false});play.update(1000);const light=play.snapshot().world.light;
  play.context({phase:'answering',paused:true});play.update(90000);assert.equal(play.snapshot().world.light,light);
  play.observe({sessionId:'x',seq:1,type:'sessionComplete'});play.context({phase:'completed',paused:false});play.update(90000);assert.equal(play.snapshot().world.light,light);
});
test('sentence place moves one plank atomically, rejects stale/paused/outofrange',()=>{
  const game=createSentenceOrderGame({sessionId:'x',random:()=>.3});game.enter();const s=game.snapshot(),payload={sessionId:'x',problemId:s.problem.problemId,attemptId:s.attemptId,chunkId:s.currentOrder[0],to:2};
  assert.equal(game.dispatch({type:'place',payload}),true);assert.equal(game.snapshot().currentOrder[2],payload.chunkId);
  assert.equal(game.dispatch({type:'place',payload:{...payload,to:99}}),false);game.setPaused(true);assert.equal(game.dispatch({type:'place',payload:{...payload,to:1}}),false);
  game.setPaused(false);assert.equal(game.dispatch({type:'place',payload:{...payload,attemptId:'stale',to:1}}),false);
  assert.equal(game.snapshot().answered,0);
});
test('all seven non-defense games can reach S at Lv1 using their world goals',()=>{
  const ids=['mathSprint','mathInvader','englishChoice','sentenceOrder','timedChoice','multiSelect','asyncChoice'];
  for(const gameId of ids){
    const play=createCompanionPlay('x',{gameId});let seq=0;
    for(let i=0;i<10;i++){
      play.context({phase:gameId==='mathInvader'?'playing':'answering',paused:false,enemies:[{enemyId:'target',y:.3,lane:1}],selectedEnemy:{enemyId:'target',lane:1},life:3});
      if(gameId==='asyncChoice'&&i%2===0)assert.equal(play.act(`route-${i/2}`),true);
      if(gameId==='englishChoice'&&i%3===0)play.act('rare');
      if(gameId==='timedChoice')play.act('light-tower');
      play.update(3000);play.observe({sessionId:'x',seq:++seq,type:'correct'});
      if(i<9&&play.snapshot().gauge>=3)play.boost();
    }
    play.observe({sessionId:'x',seq:++seq,type:'sessionComplete'});
    // Worlds that hold the result (the runner reaching the goal) finish before scoring.
    for(let k=0;k<400&&play.snapshot().world?.holdResult;k++){play.context({phase:'completed',paused:false});play.update(250);}
    assert.equal(scoreRank(gameId,play.snapshot().score,10).rank,'S',`${gameId}: ${play.snapshot().score}`);
  }
});
test('Lv7 charge makes the third skill arrive one answer earlier, not just a fractional display',()=>{
  const timings=xp=>{const play=createCompanionPlay('x',{growth:growthStatus({xp})}),result=[];
    for(let seq=1;seq<=10;seq++){play.observe({sessionId:'x',seq,type:'correct'});if(play.boost())result.push(seq);}return result;};
  assert.deepEqual(timings(0),[3,6,9]);assert.deepEqual(timings(730),[3,6,8]);
  assert.deepEqual(timings(1520),[2,5,7,10]);
});
