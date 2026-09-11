import test from 'node:test';
import assert from 'node:assert/strict';
import { miniGameRegistry } from '../../src/minigames/registry.js';
import { generateSessionProblems } from '../../src/minigames/mathSprint/mathSprintGenerator.js';
import { bindMathSprintInput } from '../../src/minigames/mathSprint/mathSprintInput.js';
import { createMathInvaderGame, MATH_INVADER_RULES } from '../../src/minigames/mathInvader/mathInvaderGame.js';

const seeded = (seed = 1) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const make = (onEvent = () => {}, sessionId = 'invader-1', seed = 1) =>
  createMathInvaderGame({ sessionId, random: seeded(seed), onEvent });
const identity = state => ({ sessionId: state.sessionId, enemyId: state.selectedEnemy.enemyId,
  problemId: state.selectedEnemy.problemId, attemptId: state.selectedEnemy.attemptId,
  token: state.selectedEnemy.token });
const select = (game, enemy = game.snapshot().enemies[0]) =>
  game.select({ sessionId: game.snapshot().sessionId, enemyId: enemy.enemyId, problemId: enemy.problemId });
const submit = (game, value = game.snapshot().selectedEnemy.answer) => game.submit({ ...identity(game.snapshot()), value });
const spawnReady = game => game.update(MATH_INVADER_RULES.spawnIntervalMs);

test('registry retains Sprint and Invader definitions when later entries are added', () => {
  assert.deepEqual(Object.keys(miniGameRegistry), ['mathSprint', 'mathInvader', 'englishChoice', 'sentenceOrder']);
  for (const id of ['mathSprint', 'mathInvader']) {
    assert.equal(miniGameRegistry[id].id, id);
    assert.equal(typeof miniGameRegistry[id].create, 'function');
    assert.equal(typeof miniGameRegistry[id].createView, 'function');
  }
});

test('Invader reuses deterministic Sprint ten-problem generator rules', () => {
  const expected = generateSessionProblems({ sessionId: 'same', random: seeded(42) });
  const events = [], game = createMathInvaderGame({ sessionId: 'same', random: seeded(42), onEvent: event => events.push(event) });
  game.enter();
  while (!game.snapshot().result) {
    if (!game.snapshot().enemies.length) spawnReady(game);
    const enemy = game.snapshot().enemies[0]; select(game, enemy); submit(game, enemy.answer); spawnReady(game);
  }
  const presented = events.filter(event => event.type === 'problemPresented');
  assert.equal(presented.length, 10);
  assert.deepEqual(presented.map(event => event.problemId), expected.map(problem => problem.problemId));
  assert.equal(expected.filter(problem => problem.operation === 'addition').length, 5);
  assert.equal(expected.filter(problem => problem.operation === 'subtraction').length, 5);
});

test('spawn is finite, max three, uses update dt and does not burst after a large frame', () => {
  const game = make(); game.enter(); assert.equal(game.snapshot().enemies.length, 1);
  game.update(9000); assert.equal(game.snapshot().enemies.length, 2);
  game.update(0); assert.equal(game.snapshot().enemies.length, 2);
  spawnReady(game); assert.equal(game.snapshot().enemies.length, 3);
  for (let i = 0; i < 20; i++) spawnReady(game);
  assert.equal(game.snapshot().enemies.length, 3); assert.equal(game.snapshot().spawned, 3);
  assert.ok(game.snapshot().enemies.every(enemy => enemy.y > 0.08 && enemy.y <= 0.78));
});

test('enemy select pauses descent, switch invalidates old attempt and resolved enemy is rejected', () => {
  const game = make(); game.enter(); spawnReady(game); const [first, second] = game.snapshot().enemies;
  assert.equal(select(game, first), true); const old = identity(game.snapshot()), y = game.snapshot().enemies.map(enemy => enemy.y);
  game.update(500); assert.deepEqual(game.snapshot().enemies.map(enemy => enemy.y), y);
  assert.equal(select(game, second), true); assert.notEqual(game.snapshot().selectedEnemy.attemptId, old.attemptId);
  assert.equal(game.submit({ ...old, value: first.answer }), false);
  const solved = game.snapshot().selectedEnemy; assert.equal(submit(game), true);
  assert.equal(game.select({ sessionId: game.snapshot().sessionId, enemyId: solved.enemyId, problemId: solved.problemId }), false);
});

test('correct commits before event and projectile is display-only', () => {
  const events = []; let game;
  game = make(event => {
    if (event.type === 'correct') {
      const state = game.snapshot();
      assert.equal(state.correct, 1); assert.equal(state.resolved, 1); assert.equal(state.selectedEnemy, null);
      assert.equal(state.projectiles.length, 0);
    }
    events.push(event);
  });
  game.enter(); select(game); assert.equal(submit(game), true);
  assert.equal(game.snapshot().correct, 1); assert.equal(game.snapshot().projectiles.length, 1);
  game.update(400); assert.equal(game.snapshot().projectiles.length, 0); assert.equal(game.snapshot().resolved, 1);
  assert.deepEqual(events.map(event => event.type), ['problemPresented', 'correct']);
});

test('incorrect costs one local life, keeps enemy and issues a fresh attempt', () => {
  const game = make(); game.enter(); select(game); const before = game.snapshot(), old = identity(before);
  assert.equal(game.submit({ ...old, value: before.selectedEnemy.answer + 1 }), true);
  const after = game.snapshot(); assert.equal(after.life, 2); assert.equal(after.incorrect, 1); assert.equal(after.resolved, 0);
  assert.equal(after.selectedEnemy.enemyId, before.selectedEnemy.enemyId);
  assert.notEqual(after.selectedEnemy.attemptId, old.attemptId); assert.notEqual(after.selectedEnemy.token, old.token);
  assert.equal(game.submit({ ...old, value: before.selectedEnemy.answer }), false);
  assert.equal(game.snapshot().incorrect, 1);
});

test('game over fixes result and emits sessionComplete once', () => {
  const events = [], game = make(event => events.push(event)); game.enter(); select(game);
  for (let i = 0; i < 3; i++) {
    const state = game.snapshot(); assert.equal(submit(game, state.selectedEnemy.answer + 1), true);
  }
  assert.deepEqual(game.snapshot().result, { outcome: 'gameOver', correct: 0, incorrect: 3,
    resolved: 0, life: 0, accuracy: 0, maxStreak: 0 });
  const last = events.at(-1); assert.equal(last.type, 'sessionComplete'); assert.equal(last.seq, 5);
  assert.equal(events.filter(event => event.type === 'sessionComplete').length, 1);
  game.update(1000); game.enter(); assert.equal(game.submit({ sessionId: 'invader-1', enemyId: 'old',
    problemId: 'old', attemptId: 'old', token: 'old', value: 0 }), false);
  assert.equal(events.filter(event => event.type === 'sessionComplete').length, 1);
});

test('ten resolved clears immediately with one immutable result and complete event', () => {
  const events = [], game = make(event => events.push(event)); game.enter();
  while (!game.snapshot().result) {
    if (!game.snapshot().enemies.length) spawnReady(game);
    select(game); assert.equal(submit(game), true); spawnReady(game);
  }
  const result = game.snapshot().result;
  assert.deepEqual(result, { outcome: 'clear', correct: 10, incorrect: 0, resolved: 10,
    life: 3, accuracy: 1, maxStreak: 10 });
  assert.ok(Object.isFrozen(result)); assert.equal(events.filter(event => event.type === 'sessionComplete').length, 1);
  assert.equal(events.filter(event => event.type === 'problemPresented').length, 10);
  assert.equal(events.filter(event => event.type === 'correct').length, 10);
  assert.deepEqual(events.map(event => event.seq), Array.from({ length: 21 }, (_, index) => index + 1));
});

for (const observer of [() => { throw Error('visual'); }, () => false,
  () => new Promise(() => {}), () => Promise.reject(Error('visual'))]) {
  test('observer failure, return and Promise do not gate Invader progress', async () => {
    const game = make(observer); game.enter(); select(game); assert.equal(submit(game), true);
    assert.equal(game.snapshot().resolved, 1); await new Promise(resolve => setImmediate(resolve));
  });
}

test('observer reentrancy and render-like snapshots do not duplicate events', () => {
  let game; const events = [];
  game = make(event => {
    events.push(event);
    if (event.type === 'problemPresented') assert.equal(select(game), false);
    if (event.type === 'correct') assert.equal(game.select({ sessionId: event.sessionId,
      enemyId: event.payload.enemyId, problemId: event.problemId }), false);
  });
  game.enter(); for (let i = 0; i < 20; i++) game.snapshot();
  select(game); submit(game); for (let i = 0; i < 20; i++) game.snapshot();
  assert.deepEqual(events.map(event => event.type), ['problemPresented', 'correct']);
});

test('external pause rejects selection/input and answer pause cannot release it', () => {
  const game = make(); game.enter(); const y = game.snapshot().enemies[0].y;
  game.setPaused(true); game.update(5000); assert.equal(select(game), false); assert.equal(game.snapshot().activeElapsedMs, 0);
  assert.equal(game.snapshot().enemies[0].y, y); game.setPaused(false); assert.equal(select(game), true);
  game.update(500); assert.equal(game.snapshot().activeElapsedMs, 500); assert.equal(game.snapshot().enemies[0].y, y);
  game.setPaused(true); assert.equal(submit(game), false); game.setPaused(false); assert.equal(submit(game), true);
});

test('shared input helper enforces repeat, IME, Enter plus button and old attempt identity', () => {
  const game = make(); game.enter(); select(game); const state = game.snapshot();
  const input = Object.assign(new EventTarget(), { value: String(state.selectedEnemy.answer) }), button = new EventTarget();
  const binding = bindMathSprintInput(input, button, identity(state), answer => game.submit(answer), () => !game.snapshot().paused);
  const key = fields => { const event = new Event('keydown', { cancelable: true }); Object.assign(event, { key: 'Enter', ...fields }); input.dispatchEvent(event); };
  key({ repeat: true }); assert.equal(game.snapshot().correct, 0);
  input.dispatchEvent(new Event('compositionstart')); key({}); button.dispatchEvent(new Event('click')); assert.equal(game.snapshot().correct, 0);
  input.dispatchEvent(new Event('compositionend')); key({ isComposing: true }); key({ keyCode: 229 }); assert.equal(game.snapshot().correct, 0);
  key({}); button.dispatchEvent(new Event('click')); key({}); assert.equal(game.snapshot().correct, 1);
  binding.dispose(); button.dispatchEvent(new Event('click')); assert.equal(game.snapshot().correct, 1);
});

test('exit is idempotent, abort is not complete, and old session callbacks are rejected', () => {
  const events = [], game = make(event => events.push(event)); game.enter(); select(game); const old = identity(game.snapshot());
  game.exit(); game.exit(); const state = game.snapshot(); assert.equal(state.aborted, true); assert.equal(state.result, null);
  assert.equal(state.enemies.length, 0); assert.equal(state.projectiles.length, 0);
  assert.equal(game.submit({ ...old, value: 0 }), false); game.update(1000);
  assert.equal(events.filter(event => event.type === 'sessionComplete').length, 0);
});
