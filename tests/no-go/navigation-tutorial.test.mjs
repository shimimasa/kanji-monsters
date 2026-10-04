import test from 'node:test';
import assert from 'node:assert/strict';
import { navigationFixture, tutorial, gameState, battleState, storage, drain } from './helpers/navigation-tutorial-fixture.mjs';
const { default: course } = await import('../../src/screens/courseSelectScreen.js');
const { default: region } = await import('../../src/screens/regionSelectScreen.js');
const { default: stage } = await import('../../src/screens/stageSelectScreen.js');
const { default: title } = await import('../../src/screens/titleScreen.js');
const { default: name } = await import('../../src/screens/playerNameInputScreen.js');
const { default: continent } = await import('../../src/screens/continentSelectScreen.js');
const { default: world } = await import('../../src/screens/worldStageSelectScreen.js');
const { FSM } = await import('../../src/core/fsm.js');
const snapshot = () => JSON.stringify({ stage: gameState.currentStageId, question: gameState.currentKanji,
  player: gameState.playerStats, turn: battleState.turn, input: battleState.inputEnabled, save: storage.getItem('krb_save') });

test('FINAL-QA-01 CASE A: real Japan click leaves no old tutorial, overlay, guide destruction or state change', async t => {
  const f = await navigationFixture(t); f.enter(course);
  assert.equal(f.imports.length,1); assert.equal(f.starts.length,0);
  let target, destroyed = 0; const guide = { destroy() { destroyed++; } };
  f.onTransition(next => { target=next; f.exit(); gameState.currentStageId='region-screen'; tutorial.guide=guide; });
  f.advance(400); f.click(course.japanButton);
  // 2026-10-04: 日本編は地方の地図を飛ばしてステージ選択へ直接行く（core/japanStart.js）
  assert.equal(target,'stageSelect'); assert.equal(course.canvas,null);
  const before = snapshot(); await f.release('old');
  assert.deepEqual({ starts:f.starts.length, overlays:f.overlaysAdded(), destroyed, stateChanges:Number(snapshot()!==before) },
    { starts:0, overlays:0, destroyed:0, stateChanges:0 });
  assert.equal(tutorial.guide,guide);
});

// 2026-10-04: 世界編は 大陸の地図を 飛ばして 世界編の ステージ選択へ 直接 行く（core/japanStart.js）
test('FINAL-QA-01 CASE B: real name -> FSM -> course -> world stage select stays unobstructed', async t => {
  const f = await navigationFixture(t);
  const fsm = new FSM('name', { name, courseSelect:course, worldStageSelect:world }); f.track(name);
  let lastTarget;
  f.onTransition(next => { lastTarget = next; const id = typeof next === 'object' ? next.name : next; fsm.change(id,f.canvas); f.track(fsm.currentState); });
  name.nameInputElement.value='あお'; name._answerSubmission.submit('あお'); await drain();
  assert.equal(fsm.currentState,course); assert.equal(gameState.playerName,'あお');
  assert.equal(f.imports.length,1); f.advance(400); f.click(course.worldButton);
  assert.equal(fsm.currentState,world); assert.equal(course.canvas,null); fsm.update(16);
  assert.deepEqual(lastTarget.props, { kanken_level:'4' }, 'nothing played yet: 4級');
  const before = snapshot();
  await f.release('old'); fsm.update(16);
  assert.equal(fsm.currentState,world);
  assert.deepEqual({ starts:f.starts.length, overlays:f.overlaysAdded() }, { starts:0, overlays:0 });
  assert.equal(snapshot(),before);
  // With no covering DOM, the real stage list's registered handler still operates.
  const first = world.stageButtons[0];
  assert.ok(first, 'the 4級 stages are listed');
  // 入った直後 0.7秒の タップは 残り物として 無視する作りなので、それを すぎてから
  f.advance(800);
  f.click(first);
  assert.equal(world.selectedStage?.stageId, first.stage.stageId);
});


for (const [id,screen] of [['courseSelect',course],['regionSelect',region],['stageSelect',stage],['title',title]]) {
  if (screen !== course) test(`FINAL-QA-01 adjacent ${id}: actual exit rejects late tutorial`, async t => {
    const f=await navigationFixture(t); f.enter(screen); assert.equal(f.imports.length,1); f.exit();
    let destroyed=0; const guide={destroy(){destroyed++;}}; tutorial.guide=guide;
    const before=snapshot(); await f.release('old');
    assert.deepEqual({starts:f.starts.length,overlays:f.overlaysAdded(),destroyed,stateChanges:Number(snapshot()!==before)},
      {starts:0,overlays:0,destroyed:0,stateChanges:0}); assert.equal(tutorial.guide,guide);
  });
  for (const order of [['old','new'],['new','old']]) test(`FINAL-QA-01 CASE C ${id}: reentry ${order.join(' -> ')}`, async t => {
    const f=await navigationFixture(t); f.enter(screen); f.exit(); f.enter(screen,'new');
    assert.equal(f.imports.length,2); const before=snapshot();
    await f.release(order[0]); const guide=tutorial.guide;
    await f.release(order[1]);
    assert.deepEqual(f.starts,[{label:'new',id}]);
    assert.equal(f.overlaysAdded(),1); assert.equal(f.overlays().length,1); assert.equal(snapshot(),before);
    if(order[0]==='new') assert.equal(tutorial.guide,guide,'old callback must not replace the current guide');
  });
  test(`FINAL-QA-01 positive control ${id}: current unseen tutorial starts exactly once`, async t => {
    const f=await navigationFixture(t); f.enter(screen,'new'); assert.equal(f.imports.length,1);
    await f.release('new'); await f.release('new');
    assert.deepEqual(f.starts,[{label:'new',id}]); assert.equal(f.overlaysAdded(),1); assert.equal(f.overlays().length,1);
  });
}
for (const flag of ['tutorial_seen_courseSelect','tutorialEnabled']) test(`FINAL-QA-01 course preserves ${flag}`, async t => {
  const f=await navigationFixture(t); storage.setItem(flag,flag==='tutorialEnabled'?'0':'1');
  f.enter(course); await f.release('old'); assert.equal(f.starts.length,0); assert.equal(f.overlaysAdded(),0);
});
