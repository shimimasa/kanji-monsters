import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameplayRun } from '../../src/minigames/gameplay/gameplayRun.js';
import { growthStatus } from '../../src/minigames/companionGrowth.js';

const effects = growthStatus().effects;
const start = gameId => { const run = createGameplayRun(gameId, effects); run.context({ phase: 'answering', paused: false }); return run; };
const answer = (run, correct = true, combo = 1) => run.answer(correct, {}, combo);

test('race goal counts hurdles jumped without waiting', () => {
  const run = start('mathSprint');
  assert.equal(run.snapshot().challenge.id === 'clean' || run.snapshot().challenge.id === 'chain', true);
  assert.equal(run.act('run-goal-clean'), true);
  for (let i = 1; i <= 5; i++) answer(run, true, i);
  run.update(30000);
  assert.equal(run.snapshot().cleanJumps, 5);
  assert.equal(run.snapshot().challenge.status, 'achieved');
});
test('shooting boss goal needs the boss downed on the first try', () => {
  const run = start('mathInvader'); run.act('run-goal-boss');
  for (let i = 1; i <= 9; i++) answer(run, true, i);
  assert.equal(run.snapshot().challenge.status, 'active');
  run.answer(true, { boss: true, wrongAttempts: 0 }, 10);
  assert.equal(run.snapshot().bossDown, true);
  assert.equal(run.snapshot().challenge.status, 'achieved');
});
test('chest goal counts quick catches only and cannot be changed after answering', () => {
  const run = start('englishChoice');
  assert.equal(run.act('run-goal-quick'), true);
  // An answer after the chests have landed still counts as correct, but not as quick.
  run.update(20000); answer(run, true, 1);
  assert.equal(run.snapshot().quick, 0); assert.equal(run.snapshot().correct, 1);
  assert.equal(run.act('run-goal-chain'), false);
  run.context({ phase: 'answering', paused: false, problem: { problemId: 'next' } });
  for (let i = 2; i <= 6; i++) answer(run, true, i);
  assert.equal(run.snapshot().quick, 5);
  assert.equal(run.snapshot().challenge.status, 'achieved');
});

test('bridge, mole, star, cart and defense goals use their own play rules', () => {
  const bridge = start('sentenceOrder'); bridge.act('run-goal-chain');
  for (let i = 1; i <= 3; i++) answer(bridge, true, i);
  assert.equal(bridge.snapshot().challenge.status, 'achieved');

  const mole = start('timedChoice'); mole.act('run-goal-quick');
  for (let i = 1; i <= 5; i++) answer(mole, true, i);
  assert.equal(mole.snapshot().challenge.status, 'achieved');

  // A partly right constellation lights a little but is not a completed one.
  const stars = start('multiSelect'); stars.act('run-goal-perfect');
  stars.answer(false, { score: .67, classification: 'partial' }, 0);
  assert.ok(stars.snapshot().bonus > 0); assert.equal(stars.snapshot().challenge.progress, '0/3');
  for (let i = 1; i <= 3; i++) answer(stars, true, i);
  assert.equal(stars.snapshot().challenge.status, 'achieved');

  const cart = start('asyncChoice'); cart.act('run-goal-chain');
  for (let i = 1; i <= 4; i++) answer(cart, true, i);
  assert.equal(cart.snapshot().challenge.status, 'achieved');

  const defense = start('kanjiDefense'); defense.act('run-goal-chain');
  for (let i = 1; i <= 4; i++) answer(defense, true, i);
  assert.equal(defense.snapshot().challenge.status, 'achieved');
});

test('missed challenge stays missed; goal choice never changes game score', () => {
  // Arcade goals stay open for the whole run and only close when it ends.
  const missed = start('sentenceOrder'); missed.act('run-goal-chain');
  for (let i = 0; i < 6; i++) answer(missed, false, 0);
  for (let i = 1; i <= 2; i++) answer(missed, true, i);
  assert.equal(missed.snapshot().challenge.status, 'active');
  missed.complete();
  assert.equal(missed.snapshot().challenge.status, 'missed');

  const first = start('englishChoice'), second = start('englishChoice');
  first.act('run-goal-quick'); second.act('run-goal-chain');
  for (const run of [first, second]) { answer(run, true, 1); answer(run, true, 2); answer(run, false, 0); }
  assert.equal(first.snapshot().bonus, second.snapshot().bonus);
  assert.equal(first.snapshot().correct, second.snapshot().correct);
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
