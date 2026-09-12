import test from 'node:test';
import assert from 'node:assert/strict';
import { miniGameRegistry } from '../../src/minigames/registry.js';
import { createTimedChoiceGame, TIMED_CHOICE_DEFAULT_DEADLINE_MS } from '../../src/minigames/timedChoice/timedChoiceGame.js';
import { TIMED_CHOICE_FIXTURE, generateTimedChoiceQuestions } from '../../src/minigames/timedChoice/timedChoiceQuestions.js';

const seeded = (seed = 1) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const create = (sessionId = 'timed-session', onEvent = () => {}, random = seeded(42), deadlineMs = 5000) =>
  createTimedChoiceGame({ sessionId, onEvent, random, deadlineMs });
const answerPayload = (state, choiceId = state.problem.correctChoiceId) => ({
  sessionId: state.sessionId, problemId: state.problem.problemId, attemptId: state.attemptId, choiceId,
});
const nextPayload = state => ({ sessionId: state.sessionId, problemId: state.problem.problemId });

test('self-authored fixture contains 20 unique identity-based vocabulary entries', () => {
  assert.equal(TIMED_CHOICE_FIXTURE.length, 20); assert.ok(Object.isFrozen(TIMED_CHOICE_FIXTURE));
  assert.equal(new Set(TIMED_CHOICE_FIXTURE.map(entry => entry.fixtureId)).size, 20);
  assert.equal(new Set(TIMED_CHOICE_FIXTURE.map(entry => entry.reading)).size, 20);
  for (const entry of TIMED_CHOICE_FIXTURE) {
    assert.match(entry.fixtureId, /^[a-z0-9]+$/); assert.ok(entry.word); assert.ok(entry.reading);
    assert.ok(Object.isFrozen(entry));
  }
});

test('question generation is deterministic and keeps display text separate from identity', () => {
  const first = generateTimedChoiceQuestions({ sessionId: 'seeded', random: seeded(7) });
  const second = generateTimedChoiceQuestions({ sessionId: 'seeded', random: seeded(7) });
  assert.deepEqual(first, second); assert.equal(first.length, 10); assert.ok(Object.isFrozen(first));
  assert.notDeepEqual(first.map(problem => problem.fixtureId),
    generateTimedChoiceQuestions({ sessionId: 'seeded', random: seeded(8) }).map(problem => problem.fixtureId));
  for (const problem of first) {
    assert.equal(problem.choices.length, 4); assert.ok(Object.isFrozen(problem.choices));
    assert.equal(new Set(problem.choices.map(choice => choice.choiceId)).size, 4);
    assert.equal(problem.choices.filter(choice => choice.choiceId === problem.correctChoiceId).length, 1);
    assert.ok(problem.choices.every(choice => choice.choiceId !== choice.text));
  }
});

test('generator and deadline validate injected inputs without retries', () => {
  let calls = 0;
  assert.throws(() => generateTimedChoiceQuestions({ sessionId: 'bad', random: () => { calls++; return 1; } }), TypeError);
  assert.equal(calls, 1);
  assert.throws(() => generateTimedChoiceQuestions({ sessionId: '', random: () => 0 }), TypeError);
  assert.throws(() => generateTimedChoiceQuestions({ sessionId: 'bad', random: null }), TypeError);
  for (const deadlineMs of [0, -1, NaN, Infinity]) {
    assert.throws(() => createTimedChoiceGame({ sessionId: 'bad-deadline', random: () => 0, deadlineMs }), TypeError);
  }
});

test('registry has eight exact v1 definitions and Timed Choice keeps the instance shape', () => {
  assert.deepEqual(Object.keys(miniGameRegistry),
    ['mathSprint', 'mathInvader', 'englishChoice', 'sentenceOrder', 'timedChoice', 'multiSelect', 'asyncChoice', 'kanjiDefense']);
  assert.deepEqual(Object.keys(miniGameRegistry.timedChoice), ['id', 'title', 'create', 'createView']);
  const game = create();
  for (const method of ['enter', 'update', 'setPaused', 'snapshot', 'dispatch', 'exit']) {
    assert.equal(typeof game[method], 'function');
  }
  assert.equal(game.dispatch({ type: 'timeout' }), false); game.exit();
});

test('enter initializes the default and injected game-local deadline state', () => {
  const defaultGame = createTimedChoiceGame({ sessionId: 'default', random: seeded(1) }); defaultGame.enter();
  assert.equal(defaultGame.snapshot().deadlineMs, TIMED_CHOICE_DEFAULT_DEADLINE_MS);
  assert.equal(defaultGame.snapshot().remainingMs, TIMED_CHOICE_DEFAULT_DEADLINE_MS);
  const game = create('injected', () => {}, seeded(1), 1200); game.enter();
  assert.equal(game.snapshot().problemElapsedMs, 0); assert.equal(game.snapshot().remainingMs, 1200);
});

test('finite positive update deltas advance active and problem time deterministically', () => {
  const game = create(); game.enter(); game.update(1000); game.update(1250);
  assert.equal(game.snapshot().activeElapsedMs, 2250);
  assert.equal(game.snapshot().problemElapsedMs, 2250); assert.equal(game.snapshot().remainingMs, 2750);
});

test('negative and non-finite deltas match existing clamp-or-ignore semantics', () => {
  const game = create(); game.enter();
  for (const delta of [-100, NaN, Infinity, -Infinity]) game.update(delta);
  assert.equal(game.snapshot().activeElapsedMs, 0); assert.equal(game.snapshot().remainingMs, 5000);
  game.update(1); assert.equal(game.snapshot().remainingMs, 4999);
});

test('pause rejects answers and freezes both active and deadline elapsed time', () => {
  const game = create('pause'); game.enter(); game.update(3000); const before = game.snapshot();
  game.setPaused(true); game.update(10000);
  assert.equal(game.dispatch({ type: 'answer', payload: answerPayload(before) }), false);
  assert.equal(game.snapshot().activeElapsedMs, 3000); assert.equal(game.snapshot().remainingMs, 2000);
  game.setPaused(false); game.update(1999); assert.equal(game.snapshot().remainingMs, 1);
});

test('correct answer consumes once and commits before its event', () => {
  let game; const observed = [];
  game = create('correct', event => {
    if (event.type === 'correct') observed.push({ event, state: game.snapshot() });
  });
  game.enter(); game.update(700); const before = game.snapshot(), payload = answerPayload(before);
  assert.equal(game.dispatch({ type: 'answer', payload }), true);
  assert.equal(game.dispatch({ type: 'answer', payload }), false);
  assert.equal(game.snapshot().correct, 1); assert.equal(game.snapshot().attemptId, null);
  assert.equal(observed.length, 1); assert.equal(observed[0].state.correct, 1);
  assert.equal(observed[0].event.payload.reason, 'answer'); assert.equal(observed[0].event.activeElapsedMs, 700);
});

test('wrong answer is an incorrect answer, not a timeout', () => {
  const events = [], game = create('wrong', event => events.push(event)); game.enter(); const before = game.snapshot();
  const wrong = before.problem.choices.find(choice => choice.choiceId !== before.problem.correctChoiceId);
  assert.equal(game.dispatch({ type: 'answer', payload: answerPayload(before, wrong.choiceId) }), true);
  const after = game.snapshot(); assert.equal(after.incorrect, 1); assert.equal(after.timedOut, 0);
  assert.equal(after.lastAnswer.reason, 'answer'); assert.equal(events.at(-1).type, 'incorrect');
  assert.equal(events.at(-1).payload.reason, 'answer');
});

test('deadline completion commits timeout as one incorrect event', () => {
  let game; const observed = [];
  game = create('timeout', event => {
    if (event.type === 'incorrect') observed.push({ event, state: game.snapshot() });
  });
  game.enter(); const attemptId = game.snapshot().attemptId; game.update(5000);
  const after = game.snapshot(); assert.equal(after.phase, 'feedback'); assert.equal(after.attemptId, null);
  assert.equal(after.answered, 1); assert.equal(after.incorrect, 1); assert.equal(after.timedOut, 1);
  assert.equal(after.lastAnswer.reason, 'timeout'); assert.equal(after.lastAnswer.choiceId, null);
  assert.equal(observed.length, 1); assert.equal(observed[0].state.timedOut, 1);
  assert.equal(observed[0].event.payload.attemptId, attemptId);
  assert.equal(observed[0].event.payload.reason, 'timeout'); assert.equal(observed[0].event.payload.choiceId, null);
});

test('answer processed first prevents a following deadline update from completing again', () => {
  const events = [], game = create('answer-first', event => events.push(event)); game.enter(); game.update(4999);
  const state = game.snapshot(); assert.equal(game.dispatch({ type: 'answer', payload: answerPayload(state) }), true);
  game.update(10000);
  assert.equal(game.snapshot().answered, 1); assert.equal(game.snapshot().correct, 1); assert.equal(game.snapshot().timedOut, 0);
  assert.deepEqual(events.map(event => event.type), ['problemPresented', 'correct']);
});

test('deadline update processed first rejects a following late answer', () => {
  const events = [], game = create('timeout-first', event => events.push(event)); game.enter(); const state = game.snapshot();
  game.update(5000);
  assert.equal(game.dispatch({ type: 'answer', payload: answerPayload(state) }), false);
  assert.equal(game.snapshot().answered, 1); assert.equal(game.snapshot().timedOut, 1);
  assert.deepEqual(events.map(event => event.type), ['problemPresented', 'incorrect']);
});

test('exact-boundary precedence is explicit JavaScript processing order', () => {
  const answerFirst = create('boundary-answer'); answerFirst.enter(); answerFirst.update(4999);
  const answerState = answerFirst.snapshot();
  assert.equal(answerFirst.dispatch({ type: 'answer', payload: answerPayload(answerState) }), true);
  answerFirst.update(1); assert.equal(answerFirst.snapshot().timedOut, 0);

  const updateFirst = create('boundary-update'); updateFirst.enter(); updateFirst.update(4999);
  const timeoutState = updateFirst.snapshot(); updateFirst.update(1);
  assert.equal(updateFirst.dispatch({ type: 'answer', payload: answerPayload(timeoutState) }), false);
  assert.equal(updateFirst.snapshot().timedOut, 1);
});

test('double answer and stale session/problem/attempt/choice commands are rejected', () => {
  const game = create('identity'); game.enter(); const state = game.snapshot();
  for (const payload of [
    { ...answerPayload(state), sessionId: 'old' },
    { ...answerPayload(state), problemId: 'old' },
    { ...answerPayload(state), attemptId: 'old' },
    { ...answerPayload(state), choiceId: 'missing' },
  ]) assert.equal(game.dispatch({ type: 'answer', payload }), false);
  const payload = answerPayload(state); assert.equal(game.dispatch({ type: 'answer', payload }), true);
  assert.equal(game.dispatch({ type: 'answer', payload }), false); assert.equal(game.snapshot().answered, 1);
});

test('one huge delta produces one timeout and never replays elapsed deadlines', () => {
  const events = [], game = create('huge', event => events.push(event)); game.enter(); game.update(100000);
  game.update(100000);
  assert.equal(game.snapshot().answered, 1); assert.equal(game.snapshot().timedOut, 1);
  assert.equal(events.filter(event => event.type === 'incorrect').length, 1);
  assert.equal(events.filter(event => event.payload.reason === 'timeout').length, 1);
});

test('feedback freezes problem deadline while session active elapsed continues', () => {
  const game = create('feedback'); game.enter(); game.update(1000); const state = game.snapshot();
  game.dispatch({ type: 'answer', payload: answerPayload(state) }); const elapsed = game.snapshot().problemElapsedMs;
  game.update(9000);
  assert.equal(game.snapshot().problemElapsedMs, elapsed); assert.equal(game.snapshot().remainingMs, 4000);
  assert.equal(game.snapshot().activeElapsedMs, 10000); assert.equal(game.snapshot().answered, 1);
});

test('Next creates fresh problem/attempt/deadline identity and rejects stale Next', () => {
  const game = create('next'); game.enter(); game.update(5000); const feedback = game.snapshot();
  assert.equal(game.dispatch({ type: 'next', payload: { ...nextPayload(feedback), sessionId: 'old' } }), false);
  assert.equal(game.dispatch({ type: 'next', payload: nextPayload(feedback) }), true);
  const next = game.snapshot(); assert.notEqual(next.problem.problemId, feedback.problem.problemId);
  assert.notEqual(next.attemptId, feedback.lastAnswer.attemptId); assert.equal(next.problemElapsedMs, 0);
  assert.equal(next.remainingMs, 5000);
});

test('ten mixed completions emit one event per problem and one immutable result', () => {
  const events = [], game = create('complete', event => events.push(event)); game.enter();
  for (let index = 0; index < 10; index++) {
    const state = game.snapshot();
    if (index === 2 || index === 7) game.update(5000);
    else {
      const choiceId = index === 4
        ? state.problem.choices.find(choice => choice.choiceId !== state.problem.correctChoiceId).choiceId
        : state.problem.correctChoiceId;
      assert.equal(game.dispatch({ type: 'answer', payload: answerPayload(state, choiceId) }), true);
    }
    if (index < 9) assert.equal(game.dispatch({ type: 'next', payload: nextPayload(game.snapshot()) }), true);
  }
  const result = game.snapshot().result;
  assert.deepEqual(result, { answered: 10, correct: 7, incorrect: 3, accuracy: 0.7, timedOut: 2 });
  assert.ok(Object.isFrozen(result)); assert.strictEqual(game.snapshot().result, result);
  assert.equal(events.filter(event => event.type === 'problemPresented').length, 10);
  assert.equal(events.filter(event => event.type === 'correct' || event.type === 'incorrect').length, 10);
  assert.equal(events.filter(event => event.type === 'sessionComplete').length, 1);
  assert.equal(events.length, 21);
  const before = game.snapshot(); game.update(5000);
  assert.equal(game.snapshot().activeElapsedMs, before.activeElapsedMs);
  assert.equal(events.length, 21);
});

test('LearningEvent v1 envelope, order, and four types remain unchanged', () => {
  const events = [], game = create('events', event => events.push(event)); game.enter();
  for (let index = 0; index < 10; index++) {
    const state = game.snapshot();
    if (index === 0) game.update(5000);
    else game.dispatch({ type: 'answer', payload: answerPayload(state) });
    if (index < 9) game.dispatch({ type: 'next', payload: nextPayload(game.snapshot()) });
  }
  const fields = ['activeElapsedMs', 'gameId', 'payload', 'problemId', 'seq', 'sessionId', 'type', 'version'];
  for (const event of events) {
    assert.deepEqual(Object.keys(event).sort(), fields); assert.equal(event.version, 1);
    assert.equal(event.gameId, 'timedChoice'); assert.equal(event.sessionId, 'events'); assert.ok(Object.isFrozen(event.payload));
  }
  assert.deepEqual(events.map(event => event.seq), Array.from({ length: 21 }, (_, index) => index + 1));
  assert.deepEqual([...new Set(events.map(event => event.type))].sort(),
    ['correct', 'incorrect', 'problemPresented', 'sessionComplete']);
});

test('observer return, rejected Promise, exception, snapshot read, and reentrant dispatch cannot duplicate completion', async () => {
  for (const mode of ['return', 'promise', 'throw', 'snapshot', 'reenter']) {
    let game; const events = [];
    game = create(`observer-${mode}`, event => {
      events.push(event);
      if (event.type !== 'incorrect') return undefined;
      if (mode === 'return') return false;
      if (mode === 'promise') return Promise.reject(new Error('display failure'));
      if (mode === 'throw') throw new Error('display failure');
      if (mode === 'snapshot') return game.snapshot();
      if (mode === 'reenter') return game.dispatch({ type: 'answer', payload: answerPayload(game.snapshot()) });
      return undefined;
    });
    game.enter(); game.update(5000); game.update(5000);
    assert.equal(game.snapshot().answered, 1); assert.equal(game.snapshot().timedOut, 1);
    assert.equal(events.filter(event => event.type === 'incorrect').length, 1);
  }
  await new Promise(resolve => setImmediate(resolve));
});

test('idempotent exit invalidates time and old answer callbacks without sessionComplete', () => {
  const events = [], game = create('exit', event => events.push(event)); game.enter(); const state = game.snapshot();
  game.exit(); game.exit(); game.update(100000);
  assert.equal(game.dispatch({ type: 'answer', payload: answerPayload(state) }), false);
  assert.equal(game.snapshot().active, false); assert.equal(game.snapshot().aborted, true);
  assert.equal(game.snapshot().answered, 0); assert.equal(events.filter(event => event.type === 'sessionComplete').length, 0);
});
