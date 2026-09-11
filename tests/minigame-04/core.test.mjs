import test from 'node:test';
import assert from 'node:assert/strict';
import { miniGameRegistry } from '../../src/minigames/registry.js';
import { createSentenceOrderGame } from '../../src/minigames/sentenceOrder/sentenceOrderGame.js';
import { SENTENCE_ORDER_FIXTURE, generateSentenceOrderQuestions } from '../../src/minigames/sentenceOrder/sentenceOrderQuestions.js';

const seeded = (seed = 1) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const create = (sessionId = 'sentence-session', onEvent = () => {}, random = seeded(17)) =>
  createSentenceOrderGame({ sessionId, onEvent, random });
const identity = state => ({ sessionId: state.sessionId, problemId: state.problem.problemId, attemptId: state.attemptId });
const reorder = (game, chunkId, direction, state = game.snapshot()) => game.dispatch({
  type: 'reorder', payload: { ...identity(state), chunkId, direction },
});
function solve(game) {
  const correctOrder = game.snapshot().problem.correctOrder;
  for (let target = 0; target < correctOrder.length; target++) {
    while (game.snapshot().currentOrder.indexOf(correctOrder[target]) > target) {
      assert.equal(reorder(game, correctOrder[target], 'left'), true);
    }
  }
}

test('self-authored fixture has 20 valid identity-based problems with 3-6 chunks', () => {
  assert.equal(SENTENCE_ORDER_FIXTURE.length, 20); assert.ok(Object.isFrozen(SENTENCE_ORDER_FIXTURE));
  for (const entry of SENTENCE_ORDER_FIXTURE) {
    assert.match(entry.fixtureId, /^[a-z0-9-]+$/); assert.ok(entry.prompt); assert.ok(entry.skillId);
    assert.ok(entry.chunks.length >= 3 && entry.chunks.length <= 6); assert.ok(Object.isFrozen(entry.chunks));
    const ids = entry.chunks.map(chunk => chunk.chunkId);
    assert.equal(new Set(ids).size, ids.length); assert.deepEqual(entry.correctOrder, ids);
    for (const chunk of entry.chunks) {
      assert.notEqual(chunk.chunkId, chunk.text); assert.ok(chunk.text); assert.ok(Object.isFrozen(chunk));
    }
  }
});

test('question and initial order selection are deterministic for the injected random sequence', () => {
  const left = generateSentenceOrderQuestions({ sessionId: 'seeded', random: seeded(42) });
  const right = generateSentenceOrderQuestions({ sessionId: 'seeded', random: seeded(42) });
  assert.deepEqual(left, right); assert.equal(left.length, 10); assert.ok(Object.isFrozen(left));
  assert.notDeepEqual(left.map(item => item.fixtureId),
    generateSentenceOrderQuestions({ sessionId: 'seeded', random: seeded(43) }).map(item => item.fixtureId));
});

test('every initial order is a shuffled permutation and never starts solved', () => {
  for (const seed of [1, 2, 99]) {
    for (const question of generateSentenceOrderQuestions({ sessionId: `shuffle-${seed}`, random: seeded(seed) })) {
      assert.deepEqual([...question.initialOrder].sort(), [...question.correctOrder].sort());
      assert.notDeepEqual(question.initialOrder, question.correctOrder); assert.ok(Object.isFrozen(question.initialOrder));
    }
  }
});

test('generator validates random input without retries', () => {
  let calls = 0;
  assert.throws(() => generateSentenceOrderQuestions({ sessionId: 'bad', random: () => { calls++; return 1; } }), TypeError);
  assert.equal(calls, 1);
  assert.throws(() => generateSentenceOrderQuestions({ sessionId: '', random: () => 0 }), TypeError);
  assert.throws(() => generateSentenceOrderQuestions({ sessionId: 'bad', random: null }), TypeError);
});

test('registry has four v1 definitions and Sentence Order preserves the instance shape', () => {
  assert.deepEqual(Object.keys(miniGameRegistry), ['mathSprint', 'mathInvader', 'englishChoice', 'sentenceOrder']);
  assert.deepEqual(Object.keys(miniGameRegistry.sentenceOrder), ['id', 'title', 'create', 'createView']);
  const game = create();
  for (const method of ['enter', 'update', 'setPaused', 'snapshot', 'dispatch', 'exit']) {
    assert.equal(typeof game[method], 'function');
  }
  assert.equal(game.dispatch({ type: 'unknown' }), false); game.exit();
});

test('reorder commits Core-owned order but consumes no attempt, score, or LearningEvent', () => {
  const events = [], game = create('reorder', event => events.push(event)); game.enter(); const before = game.snapshot();
  const moved = before.currentOrder[1]; assert.equal(reorder(game, moved, 'left'), true);
  const after = game.snapshot(); assert.deepEqual(after.currentOrder.slice(0, 2), [moved, before.currentOrder[0]]);
  assert.notStrictEqual(after.currentOrder, before.currentOrder); assert.ok(Object.isFrozen(after.currentOrder));
  assert.equal(after.attemptId, before.attemptId); assert.equal(after.answered, 0);
  assert.deepEqual(events.map(event => event.type), ['problemPresented']);
});

test('reorder rejects boundaries, malformed direction, unknown chunks, and stale identities', () => {
  const game = create('reorder-gates'); game.enter(); const state = game.snapshot(), first = state.currentOrder[0];
  for (const payload of [
    { ...identity(state), chunkId: first, direction: 'left' },
    { ...identity(state), chunkId: first, direction: 'up' },
    { ...identity(state), chunkId: 'missing', direction: 'right' },
    { ...identity(state), sessionId: 'old', chunkId: first, direction: 'right' },
    { ...identity(state), problemId: 'old', chunkId: first, direction: 'right' },
    { ...identity(state), attemptId: 'old', chunkId: first, direction: 'right' },
  ]) assert.equal(game.dispatch({ type: 'reorder', payload }), false);
  assert.deepEqual(game.snapshot().currentOrder, state.currentOrder); assert.equal(game.snapshot().answered, 0);
});

test('correct Submit consumes once and commits before its LearningEvent', () => {
  let game; const observations = [];
  game = create('correct', event => {
    if (event.type === 'correct') observations.push({ event, state: game.snapshot() });
  });
  game.enter(); solve(game); const before = game.snapshot(), payload = identity(before);
  assert.equal(game.dispatch({ type: 'submit', payload }), true);
  assert.equal(game.dispatch({ type: 'submit', payload }), false);
  const after = game.snapshot(); assert.equal(after.answered, 1); assert.equal(after.correct, 1);
  assert.equal(after.phase, 'feedback'); assert.equal(after.attemptId, null);
  assert.equal(observations.length, 1); assert.equal(observations[0].state.correct, 1);
  assert.deepEqual(observations[0].event.payload.submittedOrder, before.problem.correctOrder);
});

test('incorrect Submit is final, exposes both orders, and Next creates fresh identities', () => {
  const game = create('incorrect'); game.enter(); const before = game.snapshot(), payload = identity(before);
  assert.equal(game.dispatch({ type: 'submit', payload }), true); const feedback = game.snapshot();
  assert.equal(feedback.incorrect, 1); assert.equal(feedback.lastAnswer.correct, false);
  assert.deepEqual(feedback.lastAnswer.submittedOrder, before.currentOrder);
  assert.deepEqual(feedback.lastAnswer.correctOrder, before.problem.correctOrder);
  assert.equal(game.dispatch({ type: 'reorder', payload: { ...payload, chunkId: before.currentOrder[0], direction: 'right' } }), false);
  assert.equal(game.dispatch({ type: 'next', payload: { sessionId: 'old', problemId: before.problem.problemId } }), false);
  assert.equal(game.dispatch({ type: 'next', payload: { sessionId: before.sessionId, problemId: before.problem.problemId } }), true);
  const after = game.snapshot(); assert.notEqual(after.problem.problemId, before.problem.problemId);
  assert.notEqual(after.attemptId, before.attemptId);
});

test('session/problem/attempt gates reject stale Submit without consuming the attempt', () => {
  const game = create('submit-gates'); game.enter(); const state = game.snapshot();
  for (const payload of [
    { ...identity(state), sessionId: 'old' }, { ...identity(state), problemId: 'old' }, { ...identity(state), attemptId: 'old' },
  ]) assert.equal(game.dispatch({ type: 'submit', payload }), false);
  assert.equal(game.dispatch({ type: 'submit', payload: null }), false);
  assert.equal(game.dispatch({ type: 'reorder', payload: null }), false);
  assert.equal(game.dispatch({ type: 'next', payload: null }), false);
  assert.equal(game.snapshot().attemptId, state.attemptId); assert.equal(game.snapshot().answered, 0);
});

test('pause rejects reorder, Submit, and Next while freezing active elapsed time', () => {
  const game = create('pause'); game.enter(); game.update(120); const state = game.snapshot();
  game.setPaused(true); game.update(500);
  assert.equal(reorder(game, state.currentOrder[1], 'left', state), false);
  assert.equal(game.dispatch({ type: 'submit', payload: identity(state) }), false);
  assert.equal(game.snapshot().activeElapsedMs, 120);
  game.setPaused(false); assert.equal(game.dispatch({ type: 'submit', payload: identity(state) }), true);
  const feedback = game.snapshot(); game.setPaused(true);
  assert.equal(game.dispatch({ type: 'next', payload: { sessionId: feedback.sessionId, problemId: feedback.problem.problemId } }), false);
});

test('ten submissions produce one immutable result and exactly one completion', () => {
  const events = [], game = create('complete', event => events.push(event)); game.enter();
  for (let index = 0; index < 10; index++) {
    const state = game.snapshot(); if (index !== 2 && index !== 7) solve(game);
    assert.equal(game.dispatch({ type: 'submit', payload: identity(game.snapshot()) }), true);
    if (index < 9) assert.equal(game.dispatch({ type: 'next', payload: {
      sessionId: state.sessionId, problemId: state.problem.problemId,
    } }), true);
  }
  const result = game.snapshot().result;
  assert.deepEqual(result, { answered: 10, correct: 8, incorrect: 2, accuracy: 0.8 });
  assert.ok(Object.isFrozen(result)); assert.strictEqual(game.snapshot().result, result);
  assert.equal(events.filter(event => event.type === 'problemPresented').length, 10);
  assert.equal(events.filter(event => event.type === 'sessionComplete').length, 1);
  assert.equal(game.dispatch({ type: 'submit', payload: identity(game.snapshot()) }), false);
});

test('LearningEvent v1 keeps its exact envelope, sequence, and four types without reorder events', () => {
  const events = [], game = create('events', event => events.push(event)); game.enter();
  for (let index = 0; index < 10; index++) {
    const state = game.snapshot(); if (index !== 0) solve(game);
    game.dispatch({ type: 'submit', payload: identity(game.snapshot()) });
    if (index < 9) game.dispatch({ type: 'next', payload: { sessionId: state.sessionId, problemId: state.problem.problemId } });
  }
  const fields = ['activeElapsedMs', 'gameId', 'payload', 'problemId', 'seq', 'sessionId', 'type', 'version'];
  for (const event of events) {
    assert.deepEqual(Object.keys(event).sort(), fields); assert.equal(event.version, 1);
    assert.equal(event.gameId, 'sentenceOrder'); assert.ok(Object.isFrozen(event.payload));
  }
  assert.deepEqual(events.map(event => event.seq), Array.from({ length: 21 }, (_, index) => index + 1));
  assert.deepEqual([...new Set(events.map(event => event.type))].sort(), ['correct', 'incorrect', 'problemPresented', 'sessionComplete']);
});

test('observer returns, rejected Promises, exceptions, and reentrant dispatch cannot gate progress', async () => {
  for (const mode of ['return', 'promise', 'throw', 'reenter']) {
    let game;
    game = create(`observer-${mode}`, event => {
      if (event.type !== 'incorrect') return undefined;
      if (mode === 'return') return false;
      if (mode === 'promise') return Promise.reject(new Error('display failure'));
      if (mode === 'throw') throw new Error('display failure');
      if (mode === 'reenter') return game.dispatch({ type: 'submit', payload: identity(game.snapshot()) });
      return undefined;
    });
    game.enter(); assert.equal(game.dispatch({ type: 'submit', payload: identity(game.snapshot()) }), true);
    assert.equal(game.snapshot().answered, 1); assert.equal(game.snapshot().incorrect, 1);
  }
  await new Promise(resolve => setImmediate(resolve));
});

test('idempotent exit aborts without completion and permanently rejects old callbacks', () => {
  const events = [], game = create('exit', event => events.push(event)); game.enter(); const state = game.snapshot();
  game.exit(); game.exit(); game.update(500);
  assert.equal(game.snapshot().active, false); assert.equal(game.snapshot().aborted, true);
  assert.equal(game.dispatch({ type: 'submit', payload: identity(state) }), false);
  assert.equal(reorder(game, state.currentOrder[1], 'left', state), false);
  assert.equal(events.filter(event => event.type === 'sessionComplete').length, 0);
});
