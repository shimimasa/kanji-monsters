import test from 'node:test';
import assert from 'node:assert/strict';
import { miniGameRegistry } from '../../src/minigames/registry.js';
import { createMultiSelectGame, scoreMultiSelect } from '../../src/minigames/multiSelect/multiSelectGame.js';
import { MULTI_SELECT_FIXTURE, generateMultiSelectQuestions } from '../../src/minigames/multiSelect/multiSelectQuestions.js';

const seeded = (seed = 1) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const create = (sessionId = 'multi-session', onEvent = () => {}, random = seeded(42)) =>
  createMultiSelectGame({ sessionId, onEvent, random });
const identity = state => ({ sessionId: state.sessionId, problemId: state.problem.problemId, attemptId: state.attemptId });
const toggle = (game, state, choiceId) => game.dispatch({ type: 'toggle', payload: { ...identity(state), choiceId } });
const submit = (game, state) => game.dispatch({ type: 'submit', payload: identity(state) });
const next = (game, state) => game.dispatch({ type: 'next', payload: { sessionId: state.sessionId, problemId: state.problem.problemId } });
const choose = (game, state, ids) => ids.forEach(id => assert.equal(toggle(game, game.snapshot(), id), true));

test('self-authored fixture has 20 immutable, unique, identity-based questions', () => {
  assert.equal(MULTI_SELECT_FIXTURE.length, 20); assert.ok(Object.isFrozen(MULTI_SELECT_FIXTURE));
  assert.equal(new Set(MULTI_SELECT_FIXTURE.map(item => item.fixtureId)).size, 20);
  for (const item of MULTI_SELECT_FIXTURE) {
    assert.ok(Object.isFrozen(item)); assert.ok(Object.isFrozen(item.choices)); assert.ok(Object.isFrozen(item.correctChoiceIds));
    assert.ok(item.prompt); assert.ok(item.skillId); assert.ok(item.choices.length >= 4 && item.choices.length <= 6);
    assert.ok(item.correctChoiceIds.length > 1); assert.ok(item.correctChoiceIds.length < item.choices.length);
    assert.equal(new Set(item.choices.map(choice => choice.choiceId)).size, item.choices.length);
    assert.ok(item.choices.every(choice => choice.choiceId !== choice.text && Object.isFrozen(choice)));
    assert.ok(item.correctChoiceIds.every(id => item.choices.some(choice => choice.choiceId === id)));
  }
});

test('question generation is deterministic and separates session/problem/choice identity', () => {
  const first = generateMultiSelectQuestions({ sessionId: 'seeded', random: seeded(7) });
  assert.deepEqual(first, generateMultiSelectQuestions({ sessionId: 'seeded', random: seeded(7) }));
  assert.equal(first.length, 10); assert.ok(Object.isFrozen(first));
  assert.notDeepEqual(first.map(problem => problem.fixtureId),
    generateMultiSelectQuestions({ sessionId: 'seeded', random: seeded(8) }).map(problem => problem.fixtureId));
  for (const problem of first) {
    assert.match(problem.problemId, /^seeded:multi-select:/); assert.ok(Object.isFrozen(problem.choices));
    assert.ok(problem.choices.every(choice => choice.choiceId !== choice.text));
  }
});

test('generator rejects invalid session and random sources deterministically', () => {
  let calls = 0;
  assert.throws(() => generateMultiSelectQuestions({ sessionId: 'bad', random: () => { calls++; return 1; } }), TypeError);
  assert.equal(calls, 1); assert.throws(() => generateMultiSelectQuestions({ sessionId: '', random: () => 0 }), TypeError);
  assert.throws(() => generateMultiSelectQuestions({ sessionId: 'bad', random: null }), TypeError);
});

test('precision-aware scoring gives full, partial, zero and false-positive penalty within bounds', () => {
  const base = { correctChoiceIds: ['a', 'b', 'c'], choiceIds: ['a', 'b', 'c', 'x', 'y'] };
  assert.deepEqual(scoreMultiSelect({ ...base, selectedChoiceIds: ['a', 'b', 'c'] }), {
    truePositive: 3, falsePositive: 0, totalCorrect: 3, totalWrong: 2,
    earnedPoints: 6, maxPoints: 6, score: 1, classification: 'fullCorrect',
  });
  const partial = scoreMultiSelect({ ...base, selectedChoiceIds: ['a', 'b'] });
  assert.equal(partial.score, 4 / 6); assert.equal(partial.classification, 'partial');
  const penalized = scoreMultiSelect({ ...base, selectedChoiceIds: ['a', 'b', 'x'] });
  assert.equal(penalized.score, 1 / 6); assert.ok(penalized.score < partial.score);
  for (const selectedChoiceIds of [[], ['x'], ['a', 'b', 'c', 'x', 'y']]) {
    const grade = scoreMultiSelect({ ...base, selectedChoiceIds });
    assert.equal(grade.score, 0); assert.equal(grade.classification, 'incorrect');
    assert.ok(grade.score >= 0 && grade.score <= 1); assert.ok(Object.isFrozen(grade));
  }
});

test('scorer rejects unknown identities and malformed answer universes', () => {
  assert.throws(() => scoreMultiSelect({ selectedChoiceIds: ['z'], correctChoiceIds: ['a'], choiceIds: ['a', 'b'] }), TypeError);
  assert.throws(() => scoreMultiSelect({ selectedChoiceIds: [], correctChoiceIds: [], choiceIds: ['a'] }), TypeError);
  assert.throws(() => scoreMultiSelect({ selectedChoiceIds: [], correctChoiceIds: ['a'], choiceIds: ['a'] }), TypeError);
});

test('registry has seven exact definitions and Multi Select keeps the v1 instance shape', () => {
  assert.deepEqual(Object.keys(miniGameRegistry),
    ['mathSprint', 'mathInvader', 'englishChoice', 'sentenceOrder', 'timedChoice', 'multiSelect', 'asyncChoice']);
  assert.deepEqual(Object.keys(miniGameRegistry.multiSelect), ['id', 'title', 'create', 'createView']);
  const game = create();
  for (const method of ['enter', 'update', 'setPaused', 'snapshot', 'dispatch', 'exit']) assert.equal(typeof game[method], 'function');
  assert.equal(game.dispatch({ type: 'partial' }), false); game.exit();
});

test('toggle selects and unselects without consuming attempt or emitting an event', () => {
  const events = [], game = create('toggle', event => events.push(event)); game.enter(); const before = game.snapshot();
  const choiceId = before.problem.choices[0].choiceId;
  assert.equal(toggle(game, before, choiceId), true); assert.deepEqual(game.snapshot().selectedChoiceIds, [choiceId]);
  assert.equal(game.snapshot().attemptId, before.attemptId); assert.equal(events.length, 1);
  assert.equal(toggle(game, game.snapshot(), choiceId), true); assert.deepEqual(game.snapshot().selectedChoiceIds, []);
  assert.equal(game.snapshot().answered, 0); assert.deepEqual(events.map(event => event.type), ['problemPresented']);
});

test('full correct submit commits score 1 then emits correct once', () => {
  let game; const observations = [];
  game = create('full', event => { if (event.type === 'correct') observations.push({ event, state: game.snapshot() }); });
  game.enter(); let state = game.snapshot(); choose(game, state, state.problem.correctChoiceIds); state = game.snapshot();
  assert.equal(submit(game, state), true); assert.equal(submit(game, state), false);
  const after = game.snapshot(); assert.equal(after.fullCorrect, 1); assert.equal(after.partial, 0); assert.equal(after.incorrect, 0);
  assert.equal(after.lastAnswer.score, 1); assert.equal(after.lastAnswer.classification, 'fullCorrect');
  assert.equal(observations.length, 1); assert.equal(observations[0].state.fullCorrect, 1);
  assert.equal(observations[0].event.payload.score, 1); assert.equal(observations[0].event.payload.classification, 'fullCorrect');
});

test('partial submit emits existing incorrect with game-local score payload', () => {
  const events = [], game = create('partial', event => events.push(event)); game.enter(); let state = game.snapshot();
  choose(game, state, state.problem.correctChoiceIds.slice(0, 2)); state = game.snapshot(); assert.equal(submit(game, state), true);
  const completion = events.at(-1), after = game.snapshot(); assert.equal(completion.type, 'incorrect');
  assert.equal(completion.payload.classification, 'partial'); assert.ok(completion.payload.score > 0 && completion.payload.score < 1);
  assert.equal(after.partial, 1); assert.equal(after.incorrect, 0); assert.equal(after.lastAnswer.classification, 'partial');
  assert.ok(Object.isFrozen(completion.payload.selectedChoiceIds)); assert.ok(Object.isFrozen(completion.payload.correctChoiceIds));
});

test('empty submit is a consumed zero-score incorrect completion', () => {
  const events = [], game = create('empty', event => events.push(event)); game.enter(); const state = game.snapshot();
  assert.equal(submit(game, state), true); const after = game.snapshot(); assert.equal(after.answered, 1); assert.equal(after.incorrect, 1);
  assert.equal(after.lastAnswer.score, 0); assert.deepEqual(after.lastAnswer.selectedChoiceIds, []);
  assert.equal(events.at(-1).type, 'incorrect'); assert.equal(events.at(-1).payload.classification, 'incorrect');
});

test('all-selected answer cannot earn full or partial credit', () => {
  const game = create('all'); game.enter(); let state = game.snapshot(); choose(game, state, state.problem.choices.map(choice => choice.choiceId));
  assert.equal(submit(game, game.snapshot()), true); assert.equal(game.snapshot().lastAnswer.score, 0);
  assert.equal(game.snapshot().incorrect, 1); assert.equal(game.snapshot().fullCorrect, 0);
});

test('submit consumes exactly once and rejects toggle after completion', () => {
  const events = [], game = create('consume', event => events.push(event)); game.enter(); const state = game.snapshot();
  assert.equal(submit(game, state), true); assert.equal(submit(game, state), false);
  assert.equal(toggle(game, state, state.problem.choices[0].choiceId), false);
  assert.equal(events.filter(event => event.type === 'incorrect').length, 1); assert.equal(game.snapshot().answered, 1);
});

test('stale session, problem, attempt and unknown choice commands are rejected', () => {
  const game = create('identity'); game.enter(); const state = game.snapshot(), choiceId = state.problem.choices[0].choiceId;
  for (const payload of [
    { ...identity(state), sessionId: 'old', choiceId }, { ...identity(state), problemId: 'old', choiceId },
    { ...identity(state), attemptId: 'old', choiceId }, { ...identity(state), choiceId: 'missing' },
  ]) assert.equal(game.dispatch({ type: 'toggle', payload }), false);
  for (const payload of [{ ...identity(state), sessionId: 'old' }, { ...identity(state), problemId: 'old' }, { ...identity(state), attemptId: 'old' }])
    assert.equal(game.dispatch({ type: 'submit', payload }), false);
  assert.equal(game.snapshot().answered, 0); assert.deepEqual(game.snapshot().selectedChoiceIds, []);
});

test('pause rejects every command, freezes elapsed time, and preserves selection for resume', () => {
  const game = create('pause'); game.enter(); const state = game.snapshot(), choiceId = state.problem.choices[0].choiceId;
  toggle(game, state, choiceId); game.update(100); game.setPaused(true); const paused = game.snapshot(); game.update(900);
  assert.equal(toggle(game, paused, state.problem.choices[1].choiceId), false); assert.equal(submit(game, paused), false);
  assert.equal(next(game, paused), false); assert.equal(game.snapshot().activeElapsedMs, 100);
  assert.deepEqual(game.snapshot().selectedChoiceIds, [choiceId]); game.setPaused(false);
  assert.equal(toggle(game, game.snapshot(), state.problem.choices[1].choiceId), true);
});

test('Next changes problem/attempt identity and rejects old callbacks', () => {
  const game = create('next'); game.enter(); const first = game.snapshot(); submit(game, first); const feedback = game.snapshot();
  assert.equal(next(game, { ...feedback, sessionId: 'old' }), false); assert.equal(next(game, feedback), true);
  const second = game.snapshot(); assert.notEqual(second.problem.problemId, first.problem.problemId);
  assert.notEqual(second.attemptId, first.attemptId); assert.deepEqual(second.selectedChoiceIds, []);
  assert.equal(toggle(game, first, first.problem.choices[0].choiceId), false);
});

test('ten questions produce immutable local result, one completion each, and one sessionComplete', () => {
  const events = [], game = create('result', event => events.push(event)); game.enter();
  for (let index = 0; index < 10; index++) {
    let state = game.snapshot();
    if (index < 3) choose(game, state, state.problem.correctChoiceIds);
    else if (index < 7) choose(game, state, state.problem.correctChoiceIds.slice(0, 2));
    submit(game, game.snapshot()); if (index < 9) next(game, game.snapshot());
  }
  const state = game.snapshot(); assert.equal(state.phase, 'completed'); assert.ok(Object.isFrozen(state.result));
  assert.deepEqual({ answered: state.result.answered, fullCorrect: state.result.fullCorrect,
    partial: state.result.partial, incorrect: state.result.incorrect }, { answered: 10, fullCorrect: 3, partial: 4, incorrect: 3 });
  assert.ok(state.result.scoreRate > 0 && state.result.scoreRate < 1); assert.equal(state.result.fullCorrectRate, 0.3);
  assert.equal(events.filter(event => event.type === 'correct' || event.type === 'incorrect').length, 10);
  assert.equal(events.filter(event => event.type === 'sessionComplete').length, 1); assert.equal(events.length, 21);
});

test('LearningEvent envelope, seq, ordering and four types stay unchanged', () => {
  const events = [], game = create('events', event => events.push(event)); game.enter();
  for (let index = 0; index < 10; index++) { submit(game, game.snapshot()); if (index < 9) next(game, game.snapshot()); }
  const fields = ['activeElapsedMs', 'gameId', 'payload', 'problemId', 'seq', 'sessionId', 'type', 'version'];
  for (const event of events) { assert.deepEqual(Object.keys(event).sort(), fields); assert.equal(event.version, 1);
    assert.equal(event.gameId, 'multiSelect'); assert.ok(Object.isFrozen(event.payload)); }
  assert.deepEqual(events.map(event => event.seq), Array.from({ length: 21 }, (_, index) => index + 1));
  assert.deepEqual([...new Set(events.map(event => event.type))].sort(), ['incorrect', 'problemPresented', 'sessionComplete']);
  assert.equal(events.at(-1).type, 'sessionComplete');
});

test('observer return, rejection, throw, snapshot and reentrant dispatch cannot undo or duplicate scoring', async () => {
  for (const mode of ['return', 'promise', 'throw', 'snapshot', 'reenter']) {
    let game; const events = [];
    game = create(`observer-${mode}`, event => {
      events.push(event); if (event.type !== 'incorrect') return undefined;
      if (mode === 'return') return false; if (mode === 'promise') return Promise.reject(new Error('display failure'));
      if (mode === 'throw') throw new Error('display failure'); if (mode === 'snapshot') return game.snapshot();
      if (mode === 'reenter') return game.dispatch({ type: 'submit', payload: identity(game.snapshot()) });
      return undefined;
    });
    game.enter(); submit(game, game.snapshot()); assert.equal(game.snapshot().answered, 1);
    assert.equal(events.filter(event => event.type === 'incorrect').length, 1); assert.equal(submit(game, game.snapshot()), false);
  }
  await new Promise(resolve => setImmediate(resolve));
});

test('idempotent exit invalidates update, toggle, submit and old session without completion', () => {
  const events = [], game = create('exit', event => events.push(event)); game.enter(); const state = game.snapshot();
  game.exit(); game.exit(); game.update(1000); assert.equal(toggle(game, state, state.problem.choices[0].choiceId), false);
  assert.equal(submit(game, state), false); assert.equal(game.snapshot().activeElapsedMs, 0);
  assert.equal(game.snapshot().active, false); assert.equal(game.snapshot().aborted, true);
  assert.equal(events.filter(event => event.type === 'sessionComplete').length, 0);
});
