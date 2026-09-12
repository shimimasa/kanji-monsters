import test from 'node:test';
import assert from 'node:assert/strict';
import { miniGameRegistry } from '../../src/minigames/registry.js';
import { createAsyncChoiceGame } from '../../src/minigames/asyncChoice/asyncChoiceGame.js';
import { ASYNC_CHOICE_FIXTURE, loadAsyncChoiceFixture, prepareAsyncChoiceQuestions } from '../../src/minigames/asyncChoice/asyncChoiceQuestions.js';
import { createDeferred, flushAsync } from './deferred.mjs';

const seeded = (seed = 1) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const make = ({ sessionId = 'async-session', onEvent = () => {}, deferred = createDeferred(),
  loadQuestions = () => deferred.promise, makeAbortController } = {}) => ({
  deferred,
  game: createAsyncChoiceGame({ sessionId, onEvent, random: seeded(42), loadQuestions, ...(makeAbortController ? { makeAbortController } : {}) }),
});
const identity = state => ({ sessionId: state.sessionId, problemId: state.problem?.problemId, attemptId: state.attemptId });
const answer = (game, state, choiceId = state.problem.correctChoiceId) =>
  game.dispatch({ type: 'answer', payload: { ...identity(state), choiceId } });
const next = (game, state) => game.dispatch({ type: 'next', payload: { sessionId: state.sessionId, problemId: state.problem.problemId } });

test('fixture and prepared questions are immutable, deterministic and identity-based', () => {
  assert.equal(ASYNC_CHOICE_FIXTURE.length, 20); assert.ok(Object.isFrozen(ASYNC_CHOICE_FIXTURE));
  assert.equal(new Set(ASYNC_CHOICE_FIXTURE.map(item => item.fixtureId)).size, 20);
  for (const item of ASYNC_CHOICE_FIXTURE) { assert.ok(Object.isFrozen(item)); assert.ok(Object.isFrozen(item.choices));
    assert.ok(item.choices.length >= 3 && item.choices.length <= 4); assert.equal(new Set(item.choices.map(choice => choice.choiceId)).size, item.choices.length);
    assert.ok(item.choices.some(choice => choice.choiceId === item.correctChoiceId)); assert.ok(item.choices.every(choice => choice.choiceId !== choice.text)); }
  const first = prepareAsyncChoiceQuestions({ fixture: ASYNC_CHOICE_FIXTURE, sessionId: 'seeded', random: seeded(7) });
  assert.deepEqual(first, prepareAsyncChoiceQuestions({ fixture: ASYNC_CHOICE_FIXTURE, sessionId: 'seeded', random: seeded(7) }));
  assert.equal(first.length, 10); assert.ok(Object.isFrozen(first)); assert.ok(first.every(problem => problem.problemId.startsWith('seeded:async-choice:')));
});

test('question preparation rejects invalid fixture, identity, and random input', () => {
  assert.throws(() => prepareAsyncChoiceQuestions({ fixture: [], sessionId: 'x', random: () => 0 }), TypeError);
  assert.throws(() => prepareAsyncChoiceQuestions({ fixture: ASYNC_CHOICE_FIXTURE, sessionId: '', random: () => 0 }), TypeError);
  assert.throws(() => prepareAsyncChoiceQuestions({ fixture: ASYNC_CHOICE_FIXTURE, sessionId: 'x', random: null }), TypeError);
  assert.throws(() => prepareAsyncChoiceQuestions({ fixture: ASYNC_CHOICE_FIXTURE, sessionId: 'x', random: () => 1 }), TypeError);
});

test('enter synchronously commits loading and invokes loader exactly once', () => {
  let calls = 0; const deferred = createDeferred(); const game = createAsyncChoiceGame({ sessionId: 'loading', random: seeded(1),
    loadQuestions: context => { calls++; assert.equal(context.sessionId, 'loading'); assert.equal(context.generation, 1); return deferred.promise; } });
  assert.equal(game.enter(), true); assert.equal(game.snapshot().phase, 'loading'); assert.equal(calls, 1);
  assert.equal(game.enter(), false); assert.equal(calls, 1); assert.equal(game.snapshot().seq, 0);
});

test('loading rejects answer/next and does not accrue active elapsed time', () => {
  const { game } = make({ sessionId: 'loading-gates' }); game.enter(); game.update(1000);
  assert.equal(game.dispatch({ type: 'answer', payload: { sessionId: 'loading-gates' } }), false);
  assert.equal(game.dispatch({ type: 'next', payload: { sessionId: 'loading-gates' } }), false);
  assert.equal(game.snapshot().activeElapsedMs, 0); assert.equal(game.snapshot().answered, 0);
});

test('resolve before exit commits questions then emits first problemPresented', async () => {
  const events = [], { game, deferred } = make({ sessionId: 'resolve', onEvent: event => events.push(event) });
  game.enter(); deferred.resolve(ASYNC_CHOICE_FIXTURE); await flushAsync(); const state = game.snapshot();
  assert.equal(state.phase, 'answering'); assert.ok(state.problem); assert.ok(state.attemptId);
  assert.deepEqual(events.map(event => event.type), ['problemPresented']); assert.equal(events[0].problemId, state.problem.problemId);
});

test('current load rejection commits failure without LearningEvent', async () => {
  const events = [], { game, deferred } = make({ sessionId: 'reject', onEvent: event => events.push(event) });
  game.enter(); deferred.reject(new Error('offline')); await flushAsync();
  assert.equal(game.snapshot().phase, 'failed'); assert.equal(game.snapshot().loadError, 'questionsUnavailable');
  assert.equal(game.snapshot().problem, null); assert.deepEqual(events, []); assert.equal(game.snapshot().result, null);
});

test('synchronous loader throw and malformed success become event-free failure', async () => {
  for (const loadQuestions of [() => { throw new Error('sync'); }, () => Promise.resolve([])]) {
    const events = [], game = createAsyncChoiceGame({ sessionId: 'bad-load', random: seeded(1), loadQuestions, onEvent: event => events.push(event) });
    game.enter(); await flushAsync(); assert.equal(game.snapshot().phase, 'failed'); assert.deepEqual(events, []); game.exit();
  }
});

test('exit before resolve invalidates generation and ignores the late value', async () => {
  const events = [], { game, deferred } = make({ sessionId: 'late-resolve', onEvent: event => events.push(event) });
  game.enter(); const generation = game.snapshot().loadGeneration; game.exit(); deferred.resolve(ASYNC_CHOICE_FIXTURE); await flushAsync();
  assert.equal(game.snapshot().active, false); assert.equal(game.snapshot().loadGeneration, generation + 1);
  assert.equal(game.snapshot().problem, null); assert.equal(game.snapshot().phase, 'loading'); assert.deepEqual(events, []);
});

test('exit before reject consumes the late rejection without state, event, or unhandled rejection', async () => {
  const unhandled = []; const listener = reason => unhandled.push(reason); process.on('unhandledRejection', listener);
  try {
    const events = [], { game, deferred } = make({ sessionId: 'late-reject', onEvent: event => events.push(event) });
    game.enter(); game.exit(); deferred.reject(new Error('late')); await flushAsync(); await flushAsync();
    assert.equal(game.snapshot().active, false); assert.equal(game.snapshot().loadError, null); assert.deepEqual(events, []); assert.deepEqual(unhandled, []);
  } finally { process.removeListener('unhandledRejection', listener); }
});

test('new session B is isolated when old A resolves before B', async () => {
  const a = make({ sessionId: 'A' }), b = make({ sessionId: 'B' }); a.game.enter(); a.game.exit(); b.game.enter();
  a.deferred.resolve(ASYNC_CHOICE_FIXTURE); await flushAsync(); assert.equal(a.game.snapshot().problem, null); assert.equal(b.game.snapshot().phase, 'loading');
  b.deferred.resolve(ASYNC_CHOICE_FIXTURE); await flushAsync(); assert.equal(b.game.snapshot().phase, 'answering'); assert.equal(b.game.snapshot().sessionId, 'B');
  assert.match(b.game.snapshot().problem.problemId, /^B:/);
});

test('A/B reverse resolve order applies each value only to its active session', async () => {
  const a = make({ sessionId: 'reverse-A' }), b = make({ sessionId: 'reverse-B' }); a.game.enter(); a.game.exit(); b.game.enter();
  b.deferred.resolve(ASYNC_CHOICE_FIXTURE); await flushAsync(); const problemB = b.game.snapshot().problem.problemId;
  a.deferred.resolve(ASYNC_CHOICE_FIXTURE); await flushAsync(); assert.equal(a.game.snapshot().problem, null);
  assert.equal(b.game.snapshot().problem.problemId, problemB); assert.match(problemB, /^reverse-B:/);
});

test('old A rejection after B starts cannot alter B', async () => {
  const a = make({ sessionId: 'reject-A' }), b = make({ sessionId: 'reject-B' }); a.game.enter(); a.game.exit(); b.game.enter();
  a.deferred.reject(new Error('old')); await flushAsync(); assert.equal(a.game.snapshot().loadError, null); assert.equal(b.game.snapshot().phase, 'loading');
  b.deferred.resolve(ASYNC_CHOICE_FIXTURE); await flushAsync(); assert.equal(b.game.snapshot().phase, 'answering'); assert.equal(b.game.snapshot().loadError, null);
});

test('pause-time resolve commits ready data but defers presentation and input until resume', async () => {
  const events = [], { game, deferred } = make({ sessionId: 'paused-resolve', onEvent: event => events.push(event) });
  game.enter(); game.setPaused(true); deferred.resolve(ASYNC_CHOICE_FIXTURE); await flushAsync();
  assert.equal(game.snapshot().phase, 'ready'); assert.equal(game.snapshot().paused, true); assert.equal(game.snapshot().problem, null); assert.deepEqual(events, []);
  assert.equal(game.dispatch({ type: 'answer', payload: { sessionId: 'paused-resolve' } }), false);
  game.setPaused(false); assert.equal(game.snapshot().phase, 'answering'); assert.ok(game.snapshot().problem);
  assert.deepEqual(events.map(event => event.type), ['problemPresented']);
});

test('pause-time rejection commits current failure without a learning event', async () => {
  const events = [], { game, deferred } = make({ sessionId: 'paused-reject', onEvent: event => events.push(event) });
  game.enter(); game.setPaused(true); deferred.reject(new Error('offline')); await flushAsync();
  assert.equal(game.snapshot().phase, 'failed'); assert.equal(game.snapshot().paused, true); assert.deepEqual(events, []);
  game.setPaused(false); assert.equal(game.snapshot().phase, 'failed');
});

test('resume after pause accepts input and active elapsed only after problem presentation', async () => {
  const { game, deferred } = make({ sessionId: 'resume' }); game.enter(); game.setPaused(true); deferred.resolve(ASYNC_CHOICE_FIXTURE); await flushAsync();
  game.update(500); assert.equal(game.snapshot().activeElapsedMs, 0); game.setPaused(false); const state = game.snapshot();
  game.update(250); assert.equal(game.snapshot().activeElapsedMs, 250); assert.equal(answer(game, state), true);
});

test('stale session, problem, attempt and unknown choice are rejected after readiness', async () => {
  const { game, deferred } = make({ sessionId: 'identity' }); game.enter(); deferred.resolve(ASYNC_CHOICE_FIXTURE); await flushAsync(); const state = game.snapshot();
  for (const payload of [
    { ...identity(state), sessionId: 'old', choiceId: state.problem.correctChoiceId },
    { ...identity(state), problemId: 'old', choiceId: state.problem.correctChoiceId },
    { ...identity(state), attemptId: 'old', choiceId: state.problem.correctChoiceId },
    { ...identity(state), choiceId: 'missing' },
  ]) assert.equal(game.dispatch({ type: 'answer', payload }), false);
  assert.equal(game.snapshot().answered, 0);
});

test('correct and incorrect answers consume once and Next creates fresh identity', async () => {
  const events = [], { game, deferred } = make({ sessionId: 'answers', onEvent: event => events.push(event) }); game.enter();
  deferred.resolve(ASYNC_CHOICE_FIXTURE); await flushAsync(); let state = game.snapshot(); const firstAttempt = state.attemptId;
  assert.equal(answer(game, state), true); assert.equal(answer(game, state), false); assert.equal(game.snapshot().correct, 1);
  assert.equal(next(game, game.snapshot()), true); state = game.snapshot(); assert.notEqual(state.attemptId, firstAttempt);
  const wrong = state.problem.choices.find(choice => choice.choiceId !== state.problem.correctChoiceId);
  assert.equal(answer(game, state, wrong.choiceId), true); assert.equal(game.snapshot().incorrect, 1);
  assert.deepEqual(events.map(event => event.type), ['problemPresented', 'correct', 'problemPresented', 'incorrect']);
});

test('answer state is committed before event and observer isolation prevents reentry', async () => {
  for (const mode of ['throw', 'promise', 'snapshot', 'reenter']) {
    let game; const events = [], deferred = createDeferred();
    game = createAsyncChoiceGame({ sessionId: `observer-${mode}`, random: seeded(1), loadQuestions: () => deferred.promise, onEvent: event => {
      events.push(event); if (event.type !== 'correct') return undefined; assert.equal(game.snapshot().correct, 1); assert.equal(game.snapshot().attemptId, null);
      if (mode === 'throw') throw new Error('observer'); if (mode === 'promise') return Promise.reject(new Error('observer'));
      if (mode === 'snapshot') return game.snapshot(); if (mode === 'reenter') return answer(game, game.snapshot()); return undefined;
    } });
    game.enter(); deferred.resolve(ASYNC_CHOICE_FIXTURE); await flushAsync(); const state = game.snapshot(); assert.equal(answer(game, state), true);
    assert.equal(game.snapshot().correct, 1); assert.equal(events.filter(event => event.type === 'correct').length, 1);
  }
  await flushAsync();
});

test('ten answers complete once with immutable result and exact LearningEvent envelope', async () => {
  const events = [], { game, deferred } = make({ sessionId: 'complete', onEvent: event => events.push(event) }); game.enter();
  deferred.resolve(ASYNC_CHOICE_FIXTURE); await flushAsync();
  for (let index = 0; index < 10; index++) { const state = game.snapshot();
    const choiceId = index < 7 ? state.problem.correctChoiceId : state.problem.choices.find(choice => choice.choiceId !== state.problem.correctChoiceId).choiceId;
    answer(game, state, choiceId); if (index < 9) next(game, game.snapshot()); }
  assert.deepEqual(game.snapshot().result, { answered: 10, correct: 7, incorrect: 3, accuracy: 0.7 }); assert.ok(Object.isFrozen(game.snapshot().result));
  assert.equal(events.length, 21); assert.equal(events.filter(event => event.type === 'sessionComplete').length, 1);
  const fields = ['activeElapsedMs', 'gameId', 'payload', 'problemId', 'seq', 'sessionId', 'type', 'version'];
  for (const event of events) { assert.deepEqual(Object.keys(event).sort(), fields); assert.equal(event.version, 1); assert.ok(Object.isFrozen(event.payload)); }
  assert.deepEqual([...new Set(events.map(event => event.type))].sort(), ['correct', 'incorrect', 'problemPresented', 'sessionComplete']);
});

test('exit after loaded state is idempotent and rejects old callbacks without completion', async () => {
  const events = [], { game, deferred } = make({ sessionId: 'loaded-exit', onEvent: event => events.push(event) }); game.enter();
  deferred.resolve(ASYNC_CHOICE_FIXTURE); await flushAsync(); const state = game.snapshot(); game.exit(); game.exit(); game.update(500);
  assert.equal(answer(game, state), false); assert.equal(game.snapshot().active, false); assert.equal(game.snapshot().aborted, true);
  assert.equal(events.filter(event => event.type === 'sessionComplete').length, 0);
});

test('game-local abort is resource cleanup, while late completion remains identity-gated', async () => {
  const deferred = createDeferred(); let aborts = 0; const signal = { aborted: false };
  const controller = { signal, abort() { aborts++; signal.aborted = true; } };
  const game = createAsyncChoiceGame({ sessionId: 'abort', random: seeded(1), loadQuestions: () => deferred.promise,
    makeAbortController: () => controller });
  game.enter(); game.exit(); game.exit(); assert.equal(aborts, 1); deferred.resolve(ASYNC_CHOICE_FIXTURE); await flushAsync();
  assert.equal(game.snapshot().problem, null); assert.equal(game.snapshot().active, false);
});

test('production local loader resolves without network and observes an already-aborted signal', async () => {
  assert.equal(await loadAsyncChoiceFixture(), ASYNC_CHOICE_FIXTURE);
  await assert.rejects(loadAsyncChoiceFixture({ signal: { aborted: true } }), error => error.name === 'AbortError');
});

test('registry has seven exact v1 definitions and Async Choice keeps synchronous instance methods', () => {
  assert.deepEqual(Object.keys(miniGameRegistry), ['mathSprint', 'mathInvader', 'englishChoice', 'sentenceOrder', 'timedChoice', 'multiSelect', 'asyncChoice']);
  assert.deepEqual(Object.keys(miniGameRegistry.asyncChoice), ['id', 'title', 'create', 'createView']);
  const game = miniGameRegistry.asyncChoice.create({ sessionId: 'shape', random: seeded(1) });
  for (const method of ['enter', 'update', 'setPaused', 'snapshot', 'dispatch', 'exit']) assert.equal(typeof game[method], 'function');
  assert.equal(game.enter() instanceof Promise, false); game.exit();
});
