import test from 'node:test';
import assert from 'node:assert/strict';
import { miniGameRegistry } from '../../src/minigames/registry.js';
import { generateSessionProblems } from '../../src/minigames/mathSprint/mathSprintGenerator.js';
import { createMathInvaderGame, MATH_INVADER_RULES } from '../../src/minigames/mathInvader/mathInvaderGame.js';

const seeded = (seed = 1) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const make = (onEvent = () => {}, sessionId = 'invader-1', seed = 1, options = {}) =>
  createMathInvaderGame({ sessionId, random: seeded(seed), onEvent, ...options });
const select = (game, enemy = game.snapshot().enemies[0]) =>
  game.select({ sessionId: game.snapshot().sessionId, enemyId: enemy.enemyId, problemId: enemy.problemId });
const submit = (game, value = game.snapshot().targetEnemy.answer, token = game.snapshot().inputToken) =>
  game.submit({ sessionId: game.snapshot().sessionId, token, value });
const spawnReady = game => game.update(MATH_INVADER_RULES.spawnIntervalMs);
const clearAll = game => {
  while (!game.snapshot().result) {
    if (!game.snapshot().enemies.length) game.update(MATH_INVADER_RULES.emptySpawnMs);
    assert.equal(submit(game), true);
  }
};

test('registry retains Sprint and Invader definitions when later entries are added', () => {
  assert.deepEqual(Object.keys(miniGameRegistry), ['mathSprint', 'mathInvader', 'englishChoice', 'sentenceOrder', 'timedChoice', 'multiSelect', 'asyncChoice', 'kanjiDefense', 'photoRally', 'proverbDetective', 'tripSugoroku', 'kanjiBingo', 'kanjiMemory']);
  for (const id of ['mathSprint', 'mathInvader']) {
    assert.equal(miniGameRegistry[id].id, id);
    assert.equal(typeof miniGameRegistry[id].create, 'function');
    assert.equal(typeof miniGameRegistry[id].createView, 'function');
  }
});

test('Invader reuses deterministic Sprint ten-problem generator rules', () => {
  const expected = generateSessionProblems({ sessionId: 'same', random: seeded(42) });
  const events = [], game = createMathInvaderGame({ sessionId: 'same', random: seeded(42), onEvent: event => events.push(event) });
  game.enter(); clearAll(game);
  const presented = events.filter(event => event.type === 'problemPresented');
  assert.equal(presented.length, 10);
  assert.deepEqual(presented.map(event => event.problemId), expected.map(problem => problem.problemId));
});

test('spawn is finite, capped per wave, uses update dt and does not burst after a large frame', () => {
  const game = make(); game.enter(); assert.equal(game.snapshot().enemies.length, 1);
  game.update(90000); assert.equal(game.snapshot().enemies.length <= 2, true);
  assert.ok(game.snapshot().spawned <= 2);
  for (let i = 0; i < 20; i++) spawnReady(game);
  assert.ok(game.snapshot().enemies.length <= MATH_INVADER_RULES.maxEnemies);
  assert.ok(game.snapshot().enemies.every(enemy => enemy.y >= MATH_INVADER_RULES.spawnY && enemy.y < MATH_INVADER_RULES.barrierY));
});

test('enemies keep falling while one is aimed; the aimed one falls slower', () => {
  const game = make(); game.enter(); spawnReady(game);
  const [first, second] = game.snapshot().enemies; assert.ok(second);
  assert.equal(select(game, second), true); assert.equal(select(game, second), false);
  const before = game.snapshot().enemies.map(enemy => enemy.y);
  game.update(50);
  const after = game.snapshot().enemies.map(enemy => enemy.y);
  assert.ok(after[0] > before[0]); assert.ok(after[1] > before[1]);
  assert.ok(after[1] - before[1] < after[0] - before[0]);
  assert.equal(game.snapshot().targetId, second.enemyId); assert.notEqual(first.enemyId, second.enemyId);
});

test('an answer hits the matching enemy even when another enemy is aimed', () => {
  const game = make(); game.enter(); spawnReady(game);
  const [first, second] = game.snapshot().enemies;
  if (first.answer === second.answer) return;
  assert.equal(select(game, first), true); assert.equal(submit(game, second.answer), true);
  assert.deepEqual(game.snapshot().enemies.map(enemy => enemy.enemyId), [first.enemyId]);
  assert.equal(game.snapshot().lastAttempt.enemyId, second.enemyId);
});

test('correct commits before event and projectile is display-only', () => {
  const events = []; let game;
  game = make(event => {
    if (event.type === 'correct') {
      const state = game.snapshot();
      assert.equal(state.correct, 1); assert.equal(state.resolved, 1); assert.equal(state.projectiles.length, 0);
    }
    events.push(event);
  });
  game.enter(); assert.equal(submit(game), true);
  assert.equal(game.snapshot().correct, 1); assert.equal(game.snapshot().projectiles.length, 1);
  game.update(400); assert.equal(game.snapshot().projectiles.length, 0); assert.equal(game.snapshot().resolved, 1);
  assert.deepEqual(events.map(event => event.type), ['problemPresented', 'correct']);
});

test('a wrong answer keeps the aimed enemy, costs no shield and consumes the token', () => {
  const events = [], game = make(event => events.push(event)); game.enter();
  const before = game.snapshot(), stale = before.inputToken;
  assert.equal(submit(game, before.targetEnemy.answer + 1), true);
  const after = game.snapshot(); assert.equal(after.life, 3); assert.equal(after.incorrect, 1); assert.equal(after.resolved, 0);
  assert.equal(after.enemies[0].wrongAttempts, 1); assert.equal(events.at(-1).payload.reason, 'wrong');
  assert.equal(submit(game, before.targetEnemy.answer, stale), false); assert.equal(game.snapshot().correct, 0);
});

test('an enemy reaching the barrier reveals its answer, dims one shield and never ends the run', () => {
  const events = [], game = make(event => events.push(event)); game.enter();
  for (let i = 0; i < 2000 && !game.snapshot().result; i++) game.update(100);
  const state = game.snapshot();
  assert.equal(state.result.outcome, 'clear'); assert.equal(state.result.resolved, 10); assert.equal(state.result.escaped, 10);
  assert.equal(state.life, 0); assert.ok(state.lastEscape.answer >= 0);
  assert.equal(events.filter(event => event.type === 'incorrect' && event.payload.reason === 'escaped').length, 10);
  assert.equal(events.filter(event => event.type === 'sessionComplete').length, 1);
});

test('the tenth problem is a boss that appears alone', () => {
  const game = make(); game.enter();
  for (let solved = 0; solved < 9; solved++) {
    if (!game.snapshot().enemies.length) game.update(MATH_INVADER_RULES.emptySpawnMs);
    assert.equal(game.snapshot().enemies.some(enemy => enemy.boss), false);
    submit(game);
  }
  game.update(MATH_INVADER_RULES.emptySpawnMs);
  const [boss] = game.snapshot().enemies; assert.equal(boss.boss, true); assert.equal(game.snapshot().enemies.length, 1);
});

test('ten resolved clears immediately with one immutable result and complete event', () => {
  const events = [], game = make(event => events.push(event)); game.enter(); clearAll(game);
  const result = game.snapshot().result;
  assert.deepEqual(result, { outcome: 'clear', correct: 10, incorrect: 0, escaped: 0, resolved: 10,
    life: 3, accuracy: 1, maxStreak: 10 });
  assert.ok(Object.isFrozen(result)); assert.equal(events.filter(event => event.type === 'sessionComplete').length, 1);
  assert.equal(events.filter(event => event.type === 'problemPresented').length, 10);
  assert.equal(events.filter(event => event.type === 'correct').length, 10);
  assert.deepEqual(events.map(event => event.seq), Array.from({ length: 21 }, (_, index) => index + 1));
  assert.equal(submit(game, 1, 'any'), false);
});

test('slow pace falls slower', () => {
  const normal = make(), slow = make(() => {}, 'invader-1', 1, { pace: 'slow' }); normal.enter(); slow.enter();
  normal.update(100); slow.update(100);
  assert.ok(slow.snapshot().enemies[0].y < normal.snapshot().enemies[0].y); assert.equal(slow.snapshot().pace, 'slow');
});

for (const observer of [() => { throw Error('visual'); }, () => false,
  () => new Promise(() => {}), () => Promise.reject(Error('visual'))]) {
  test('observer failure, return and Promise do not gate Invader progress', async () => {
    const game = make(observer); game.enter(); assert.equal(submit(game), true);
    assert.equal(game.snapshot().resolved, 1); await new Promise(resolve => setImmediate(resolve));
  });
}

test('observer reentrancy and render-like snapshots do not duplicate events', () => {
  let game; const events = [];
  game = make(event => {
    events.push(event);
    if (event.type === 'problemPresented') assert.equal(select(game), false);
    if (event.type === 'correct') assert.equal(game.submit({ sessionId: event.sessionId, token: game.snapshot().inputToken, value: 1 }), false);
  });
  game.enter(); for (let i = 0; i < 20; i++) game.snapshot();
  submit(game); for (let i = 0; i < 20; i++) game.snapshot();
  assert.deepEqual(events.map(event => event.type), ['problemPresented', 'correct']);
});

test('external pause rejects selection/input and freezes the fall', () => {
  const game = make(); game.enter(); const y = game.snapshot().enemies[0].y;
  game.setPaused(true); game.update(5000); assert.equal(select(game), false); assert.equal(game.snapshot().activeElapsedMs, 0);
  assert.equal(game.snapshot().enemies[0].y, y); assert.equal(submit(game), false);
  game.setPaused(false); game.update(100); assert.ok(game.snapshot().enemies[0].y > y); assert.equal(submit(game), true);
});

test('exit is idempotent, abort is not complete, and old session callbacks are rejected', () => {
  const events = [], game = make(event => events.push(event)); game.enter(); const token = game.snapshot().inputToken;
  game.exit(); game.exit(); const state = game.snapshot(); assert.equal(state.aborted, true); assert.equal(state.result, null);
  assert.equal(state.enemies.length, 0); assert.equal(state.projectiles.length, 0);
  assert.equal(game.submit({ sessionId: 'invader-1', token, value: 0 }), false); game.update(1000);
  assert.equal(events.filter(event => event.type === 'sessionComplete').length, 0);
});
