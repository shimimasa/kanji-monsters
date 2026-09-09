import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,gameState,battleState,battle,practice,quick,images,storage,waitForMotionReady as ready} from './battle-fixture.mjs';
const image={complete:true,naturalWidth:512,naturalHeight:512};
const layout={imageRect:{x:10,y:10,width:240,height:120},clipRect:{x:14,y:14,width:232,height:112}};
const legacy={x:130,y:70,rotation:0};
globalThis.Path2D=class{rect(){}};
test('real battle enter/update/exit ten loops releases hosts and all existing scheduled work',async t=>{
 const f=await fixture(t,battle);images['HKD-E01']=image;gameState.gameMode='jikkuri';
 for(let i=0;i<10;i++){
  f.enter('loop'+i);battle.update(16);await ready();const b=battle._pixelMotion;
  assert.equal(b.inspect().hostCount,1);assert.equal(b.inspect().timeline.progress,.008);
  battle.exit();assert.equal(battle._pixelMotion,null);assert.equal(b.inspect().hostCount,0);
  assert.equal(b.inspect().timeline,null);assert.equal(b.inspect().imageReference,false);
  assert.equal(f.timers.size,0);assert.equal(f.frames.size,0);assert.equal(f.intervals.size,0);
 }
});
for(const screen of [practice,quick])test('real derived battle excludes '+(screen===practice?'practice':'quick'),async t=>{
 const f=await fixture(t,screen);images['HKD-E01']=image;gameState.gameMode='jikkuri';f.enter();assert.equal(screen._pixelMotion,null);screen.exit();
});
test('real battle current image, controller timer and E02 transition own display state',async t=>{
 const f=await fixture(t,battle);images['HKD-E01']=image;gameState.gameMode='challenge';f.enter();
 battleState.enemyAction='attack';battleState.enemyActionTimer=750;battle._pixelMotion.actionStarted();battle.update(16);await ready();
 assert.equal(battleState.enemyActionTimer,734);assert.equal(battle._pixelMotion.inspect().timeline.progress,1-734/750);
 battleState.enemyAction='damage';battleState.enemyActionTimer=500;battle._pixelMotion.actionStarted();battle.update(16);
 assert.equal(battle._pixelMotion.inspect().timeline.action,'hit');
 battleState.enemyAction='defeat';battleState.enemyActionTimer=1000;battle._pixelMotion.actionStarted();battle.update(16);
 assert.equal(battle._pixelMotion.inspect().timeline.action,'defeat');
 gameState.currentEnemyIndex=1;gameState.currentEnemy=gameState.enemies[1];battle.update(16);
 assert.equal(gameState.currentEnemy.id,'HKD-E02');assert.equal(battle._pixelMotion.inspect().hostCount,0);assert.equal(battle._pixelMotion.inspect().timeline,null);
});
test('real Core and Storage unchanged by 0/1/100 samples; input action still belongs to controller',async t=>{
 const f=await fixture(t,battle);images['HKD-E01']=image;gameState.gameMode='jikkuri';f.enter();battle.update(16);await ready();
 const snapshot=()=>JSON.stringify({gameState,battleState,storage:[...Array(storage.length)].map((_,i)=>[storage.key(i),storage.getItem(storage.key(i))])});
 const before=snapshot();let writes=0;t.mock.method(storage,'setItem',()=>{writes++;throw Error('display storage write');});
 for(const n of [0,1,100]){for(let i=0;i<n;i++)assert.equal(battle._pixelMotion.present(f.canvas.getContext('2d'),layout,legacy),true);assert.equal(snapshot(),before);assert.equal(writes,0);}
});
