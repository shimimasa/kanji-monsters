import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameplayRun } from '../../src/minigames/gameplay/gameplayRun.js';
import { growthStatus } from '../../src/minigames/companionGrowth.js';

const effects = growthStatus().effects;
const start = gameId => { const run = createGameplayRun(gameId, effects); run.context({ phase: 'answering', paused: false }); return run; };
const answer = (run, correct = true, combo = 1) => run.answer(correct, {}, combo);

test('race goal rewards a deliberate charge and jump at two obstacles', () => {
  const run = start('mathSprint');
  assert.equal(run.act('run-goal-jump'), true);
  answer(run, true, 1); answer(run, true, 2);
  assert.equal(run.snapshot().danger, true);
  run.act('push'); answer(run, true, 3);
  assert.equal(run.snapshot().challenge.progress, '1/2');
  run.act('charge'); answer(run, true, 4); answer(run, true, 5);
  run.act('push'); answer(run, true, 6);
  assert.equal(run.snapshot().challenge.status, 'achieved');
  assert.equal(run.snapshot().challenge.achievedAt, 6);
});

test('shooting goal counts correctly aimed priority enemies', () => {
  const run = start('mathInvader'); run.act('run-goal-priority');
  for (let i = 1; i <= 3; i++) {
    run.context({ phase: 'answering', paused: false, life: 3,
      enemies: [{ enemyId: `enemy-${i}`, y: .8, lane: 1 }], selectedEnemy: { enemyId: `enemy-${i}`, y: .8, lane: 1 } });
    answer(run, true, i);
  }
  assert.equal(run.snapshot().challenge.status, 'achieved');
});

test('treasure goal follows rare room choice and cannot be changed after answering', () => {
  const run = start('englishChoice');
  assert.equal(run.act('run-goal-rare'), true);
  run.act('rare'); answer(run, true, 1);
  assert.equal(run.act('run-goal-chests'), false);
  answer(run, true, 2); answer(run, true, 3);
  assert.equal(run.snapshot().challenge.status, 'achieved');
  assert.equal(run.snapshot().findings[0].kind, 'rare');
});

test('bridge, lantern, exploration and defense goals use their own play rules', () => {
  const bridge = start('sentenceOrder'); bridge.act('run-goal-chain');
  for (let i = 1; i <= 3; i++) answer(bridge, true, i);
  assert.equal(bridge.snapshot().challenge.status, 'achieved');

  const lantern = start('timedChoice'); lantern.act('run-goal-towers');
  assert.equal(lantern.act('light-tower'), true);
  answer(lantern); assert.equal(lantern.act('light-tower'), true);
  answer(lantern); assert.equal(lantern.act('light-tower'), true);
  assert.equal(lantern.snapshot().challenge.status, 'achieved');

  const explore = start('asyncChoice'); explore.act('run-goal-rare');
  for (const place of [0, 1, 2]) {
    assert.equal(explore.act(`route-${place}`), true);
    answer(explore); answer(explore);
  }
  assert.equal(explore.snapshot().challenge.status, 'achieved');

  const defense = start('kanjiDefense'); defense.act('run-goal-chain');
  for (let i = 1; i <= 4; i++) answer(defense, true, i);
  assert.equal(defense.snapshot().challenge.status, 'achieved');
});

test('missed challenge stays missed; goal choice never changes game score', () => {
  const missed = start('sentenceOrder'); missed.act('run-goal-chain');
  for (let i = 0; i < 6; i++) answer(missed, false, 0);
  for (let i = 1; i <= 3; i++) answer(missed, true, i);
  assert.equal(missed.snapshot().challenge.status, 'missed');

  const first = start('englishChoice'), second = start('englishChoice');
  first.act('run-goal-rare'); second.act('run-goal-chests');
  for (const run of [first, second]) { run.act('rare'); answer(run); answer(run); answer(run); }
  assert.equal(first.snapshot().bonus, second.snapshot().bonus);
  assert.equal(first.snapshot().chests, second.snapshot().chests);
});

test('challenge choice follows pause and completion boundaries', () => {
  const run = createGameplayRun('kanjiDefense', effects);
  run.context({ phase: 'answering', paused: true });
  assert.equal(run.act('run-goal-clear'), false);
  run.context({ phase: 'answering', paused: false });
  assert.equal(run.act('run-goal-clear'), true);
  run.complete();
  assert.equal(run.act('run-goal-chain'), false);
});
