import test from 'node:test';
import assert from 'node:assert/strict';
import { miniGameRegistry } from '../../src/minigames/registry.js';
import { createEnglishChoiceGame } from '../../src/minigames/englishChoice/englishChoiceGame.js';
import { ENGLISH_CHOICE_FIXTURE, generateEnglishChoiceQuestions } from '../../src/minigames/englishChoice/englishChoiceQuestions.js';

const seeded = (seed = 1) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const create = (sessionId = 'english-session', onEvent = () => {}, random = seeded(42)) =>
  createEnglishChoiceGame({ sessionId, onEvent, random });
const answerPayload = (state, choiceId = state.problem.correctChoiceId) => ({
  sessionId: state.sessionId, problemId: state.problem.problemId, attemptId: state.attemptId, choiceId,
});

test('probe fixture is explicit and deterministic: ten questions with four identity-based choices', () => {
  assert.equal(ENGLISH_CHOICE_FIXTURE.length, 20);
  const first = generateEnglishChoiceQuestions({ sessionId: 'seed', random: seeded(7) });
  const second = generateEnglishChoiceQuestions({ sessionId: 'seed', random: seeded(7) });
  assert.deepEqual(first, second); assert.equal(first.length, 10);
  assert.equal(new Set(first.map(problem => problem.problemId)).size, 10);
  for (const problem of first) {
    assert.equal(problem.choices.length, 4);
    assert.equal(new Set(problem.choices.map(choice => choice.choiceId)).size, 4);
    assert.equal(problem.choices.filter(choice => choice.choiceId === problem.correctChoiceId).length, 1);
    assert.ok(problem.choices.every(choice => choice.choiceId !== choice.text));
  }
});

test('generator validates injected random without retrying', () => {
  let calls = 0;
  assert.throws(() => generateEnglishChoiceQuestions({ sessionId: 'bad', random: () => { calls++; return 1; } }), TypeError);
  assert.equal(calls, 1);
  assert.throws(() => generateEnglishChoiceQuestions({ sessionId: '', random: () => 0 }), TypeError);
  assert.throws(() => generateEnglishChoiceQuestions({ sessionId: 'bad', random: null }), TypeError);
});

test('registry retains the English definition when later entries are added', () => {
  assert.deepEqual(Object.keys(miniGameRegistry), ['mathSprint', 'mathInvader', 'englishChoice', 'sentenceOrder', 'timedChoice', 'multiSelect', 'asyncChoice', 'kanjiDefense']);
  const definition = miniGameRegistry.englishChoice;
  assert.deepEqual(Object.keys(definition), ['id', 'title', 'create', 'createView']);
  const game = create();
  for (const method of ['enter', 'update', 'setPaused', 'snapshot', 'dispatch', 'exit']) {
    assert.equal(typeof game[method], 'function');
  }
  assert.equal(game.dispatch({ type: 'unknown', payload: null }), false);
  game.exit();
});

test('correct choice commits before LearningEvent and duplicate attempt is rejected', () => {
  let game; const observations = [];
  game = create('correct', event => {
    if (event.type === 'correct') observations.push({ event, state: game.snapshot() });
  });
  game.enter(); const before = game.snapshot(), payload = answerPayload(before);
  assert.equal(game.dispatch({ type: 'answer', payload }), true);
  assert.equal(game.dispatch({ type: 'answer', payload }), false);
  const after = game.snapshot();
  assert.equal(after.answered, 1); assert.equal(after.correct, 1); assert.equal(after.incorrect, 0);
  assert.equal(after.phase, 'feedback'); assert.equal(after.attemptId, null);
  assert.equal(observations.length, 1); assert.equal(observations[0].state.correct, 1);
  assert.equal(observations[0].event.payload.choiceId, before.problem.correctChoiceId);
});

test('incorrect choice is final for the attempt and Next creates a fresh identity', () => {
  const game = create('incorrect'); game.enter(); const before = game.snapshot();
  const wrong = before.problem.choices.find(choice => choice.choiceId !== before.problem.correctChoiceId);
  const payload = answerPayload(before, wrong.choiceId);
  assert.equal(game.dispatch({ type: 'answer', payload }), true);
  assert.equal(game.dispatch({ type: 'answer', payload: answerPayload(before) }), false);
  assert.equal(game.snapshot().incorrect, 1); assert.equal(game.snapshot().phase, 'feedback');
  assert.equal(game.dispatch({ type: 'next', payload: { sessionId: 'old', problemId: before.problem.problemId } }), false);
  assert.equal(game.dispatch({ type: 'next', payload: { sessionId: before.sessionId, problemId: before.problem.problemId } }), true);
  const after = game.snapshot();
  assert.notEqual(after.problem.problemId, before.problem.problemId); assert.notEqual(after.attemptId, before.attemptId);
});

test('pause rejects choices and freezes active elapsed time', () => {
  const game = create('pause'); game.enter(); game.update(120); const state = game.snapshot();
  game.setPaused(true); game.update(500);
  assert.equal(game.dispatch({ type: 'answer', payload: answerPayload(state) }), false);
  assert.equal(game.snapshot().activeElapsedMs, 120);
  game.setPaused(false); assert.equal(game.dispatch({ type: 'answer', payload: answerPayload(state) }), true);
});

test('old problem, attempt, session, and unknown choice identities are rejected', () => {
  const game = create('identity'); game.enter(); const state = game.snapshot();
  for (const payload of [
    { ...answerPayload(state), sessionId: 'old' },
    { ...answerPayload(state), problemId: 'old' },
    { ...answerPayload(state), attemptId: 'old' },
    { ...answerPayload(state), choiceId: 'missing' },
  ]) assert.equal(game.dispatch({ type: 'answer', payload }), false);
  assert.equal(game.snapshot().answered, 0); assert.ok(game.snapshot().attemptId);
});

test('ten answers produce one immutable result and one sessionComplete event', () => {
  const events = [], game = create('complete', event => events.push(event)); game.enter();
  for (let index = 0; index < 10; index++) {
    const state = game.snapshot();
    const choice = index === 3 || index === 8
      ? state.problem.choices.find(item => item.choiceId !== state.problem.correctChoiceId).choiceId
      : state.problem.correctChoiceId;
    assert.equal(game.dispatch({ type: 'answer', payload: answerPayload(state, choice) }), true);
    if (index < 9) assert.equal(game.dispatch({ type: 'next', payload: {
      sessionId: state.sessionId, problemId: state.problem.problemId,
    } }), true);
  }
  const result = game.snapshot().result;
  assert.deepEqual(result, { answered: 10, correct: 8, incorrect: 2, accuracy: 0.8 });
  assert.ok(Object.isFrozen(result)); assert.equal(game.snapshot().answered, game.snapshot().correct + game.snapshot().incorrect);
  assert.equal(events.filter(event => event.type === 'sessionComplete').length, 1);
  assert.equal(events.filter(event => event.type === 'problemPresented').length, 10);
  assert.equal(game.dispatch({ type: 'answer', payload: answerPayload(game.snapshot()) }), false);
  assert.equal(events.filter(event => event.type === 'sessionComplete').length, 1);
});

test('LearningEvent v1 envelope and four existing types remain unchanged', () => {
  const events = [], game = create('events', event => events.push(event)); game.enter();
  for (let index = 0; index < 10; index++) {
    const state = game.snapshot();
    const choice = index === 0
      ? state.problem.choices.find(item => item.choiceId !== state.problem.correctChoiceId).choiceId
      : state.problem.correctChoiceId;
    game.dispatch({ type: 'answer', payload: answerPayload(state, choice) });
    if (index < 9) game.dispatch({ type: 'next', payload: { sessionId: state.sessionId, problemId: state.problem.problemId } });
  }
  const fields = ['activeElapsedMs', 'gameId', 'payload', 'problemId', 'seq', 'sessionId', 'type', 'version'];
  for (const event of events) {
    assert.deepEqual(Object.keys(event).sort(), fields); assert.equal(event.version, 1);
    assert.equal(event.gameId, 'englishChoice'); assert.equal(event.sessionId, 'events'); assert.ok(Object.isFrozen(event.payload));
  }
  assert.deepEqual(events.map(event => event.seq), Array.from({ length: 21 }, (_, index) => index + 1));
  assert.deepEqual([...new Set(events.map(event => event.type))].sort(), ['correct', 'incorrect', 'problemPresented', 'sessionComplete']);
});

test('observer return, Promise, exception, and reentrancy never gate learning progress', async () => {
  for (const mode of ['return', 'promise', 'throw', 'reenter']) {
    let game;
    game = create(`observer-${mode}`, event => {
      if (event.type !== 'correct') return undefined;
      if (mode === 'return') return false;
      if (mode === 'promise') return Promise.reject(new Error('display failure'));
      if (mode === 'throw') throw new Error('display failure');
      if (mode === 'reenter') return game.dispatch({ type: 'answer', payload: answerPayload(game.snapshot()) });
      return undefined;
    });
    game.enter(); const state = game.snapshot();
    assert.equal(game.dispatch({ type: 'answer', payload: answerPayload(state) }), true);
    assert.equal(game.snapshot().answered, 1); assert.equal(game.snapshot().correct, 1);
  }
  await new Promise(resolve => setImmediate(resolve));
});

test('idempotent exit aborts without completion and permanently rejects old callbacks', () => {
  const events = [], game = create('exit', event => events.push(event)); game.enter(); const state = game.snapshot();
  game.exit(); game.exit(); game.update(500);
  assert.equal(game.snapshot().active, false); assert.equal(game.snapshot().aborted, true);
  assert.equal(game.dispatch({ type: 'answer', payload: answerPayload(state) }), false);
  assert.equal(events.filter(event => event.type === 'sessionComplete').length, 0);
});
