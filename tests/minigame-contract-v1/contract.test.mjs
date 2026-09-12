import test from 'node:test';
import assert from 'node:assert/strict';
import { miniGameRegistry } from '../../src/minigames/registry.js';

const seeded = (seed = 1) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const create = (gameId, sessionId, onEvent = () => {}) => miniGameRegistry[gameId].create({
  sessionId, random: seeded(42), onEvent,
});

test('the six definitions expose only the required v1 creation boundary', () => {
  assert.deepEqual(Object.keys(miniGameRegistry), ['mathSprint', 'mathInvader', 'englishChoice', 'sentenceOrder', 'timedChoice', 'multiSelect']);
  for (const [id, definition] of Object.entries(miniGameRegistry)) {
    assert.deepEqual(Object.keys(definition).sort(), ['create', 'createView', 'id', 'title']);
    assert.equal(definition.id, id);
    assert.equal(typeof definition.title, 'string'); assert.ok(definition.title.length > 0);
    assert.equal(typeof definition.create, 'function');
    assert.equal(typeof definition.createView, 'function');
  }
});

test('all six mechanics implement the v1 lifecycle and command port', () => {
  const methods = ['enter', 'update', 'setPaused', 'snapshot', 'dispatch', 'exit'];
  for (const id of Object.keys(miniGameRegistry)) {
    const game = create(id, `${id}-shape`);
    for (const method of methods) assert.equal(typeof game[method], 'function', `${id}.${method}`);
    assert.equal(game.dispatch({ type: 'unknown', payload: null }), false);
    assert.equal(game.dispatch(null), false);
    game.exit(); game.exit();
  }
});

test('Sprint dispatch delegates submit and next without changing Core identity gates', () => {
  const game = create('mathSprint', 'sprint-dispatch'); game.enter();
  const first = game.snapshot();
  assert.equal(game.dispatch({ type: 'submit', payload: {
    sessionId: first.sessionId, token: first.token, value: first.problem.answer,
  } }), true);
  assert.equal(game.dispatch({ type: 'submit', payload: {
    sessionId: first.sessionId, token: first.token, value: first.problem.answer,
  } }), false);
  assert.equal(game.dispatch({ type: 'next', payload: {
    sessionId: 'old-session', problemId: first.problem.problemId,
  } }), false);
  assert.equal(game.dispatch({ type: 'next', payload: {
    sessionId: first.sessionId, problemId: first.problem.problemId,
  } }), true);
  assert.notEqual(game.snapshot().problem.problemId, first.problem.problemId);
});

test('Invader dispatch delegates select and submit without changing attempt gates', () => {
  const game = create('mathInvader', 'invader-dispatch'); game.enter();
  const enemy = game.snapshot().enemies[0];
  const selection = { sessionId: 'invader-dispatch', enemyId: enemy.enemyId, problemId: enemy.problemId };
  assert.equal(game.dispatch({ type: 'select', payload: { ...selection, sessionId: 'old-session' } }), false);
  assert.equal(game.dispatch({ type: 'select', payload: selection }), true);
  const selected = game.snapshot().selectedEnemy;
  const attempt = { ...selection, attemptId: selected.attemptId, token: selected.token, value: selected.answer };
  assert.equal(game.dispatch({ type: 'submit', payload: { ...attempt, sessionId: 'old-session' } }), false);
  assert.equal(game.dispatch({ type: 'submit', payload: attempt }), true);
  assert.equal(game.dispatch({ type: 'submit', payload: attempt }), false);
  assert.equal(game.snapshot().resolved, 1);
});

test('LearningEvent v1 keeps its exact envelope, ordering and four event types', () => {
  const events = [], game = create('mathSprint', 'events-v1', event => events.push(event));
  game.enter();
  let attempt = 0;
  while (!game.snapshot().result) {
    const state = game.snapshot();
    assert.equal(game.dispatch({ type: 'submit', payload: {
      sessionId: state.sessionId, token: state.token,
      value: attempt++ === 0 ? state.problem.answer + 1 : state.problem.answer,
    } }), true);
    const after = game.snapshot();
    if (!after.result) assert.equal(game.dispatch({ type: 'next', payload: {
      sessionId: after.sessionId, problemId: after.problem.problemId,
    } }), true);
  }
  const fields = ['activeElapsedMs', 'gameId', 'payload', 'problemId', 'seq', 'sessionId', 'type', 'version'];
  for (const event of events) {
    assert.deepEqual(Object.keys(event).sort(), fields);
    assert.equal(event.version, 1); assert.equal(event.gameId, 'mathSprint');
    assert.equal(event.sessionId, 'events-v1'); assert.ok(Object.isFrozen(event.payload));
  }
  assert.deepEqual(events.map(event => event.seq), Array.from({ length: 21 }, (_, index) => index + 1));
  assert.deepEqual([...new Set(events.map(event => event.type))].sort(),
    ['correct', 'incorrect', 'problemPresented', 'sessionComplete']);
  assert.equal(events.at(-1).type, 'sessionComplete');
  assert.equal(game.snapshot().correct, 9);
});

test('all six games commit learning state before notifying observers', () => {
  let sprint;
  sprint = create('mathSprint', 'sprint-order', event => {
    if (event.type === 'correct') assert.equal(sprint.snapshot().answered, 1);
  });
  sprint.enter(); const sprintState = sprint.snapshot();
  assert.equal(sprint.dispatch({ type: 'submit', payload: { sessionId: sprintState.sessionId,
    token: sprintState.token, value: sprintState.problem.answer } }), true);

  let invader;
  invader = create('mathInvader', 'invader-order', event => {
    if (event.type === 'correct') {
      assert.equal(invader.snapshot().correct, 1); assert.equal(invader.snapshot().resolved, 1);
    }
  });
  invader.enter(); const enemy = invader.snapshot().enemies[0];
  const target = { sessionId: 'invader-order', enemyId: enemy.enemyId, problemId: enemy.problemId };
  assert.equal(invader.dispatch({ type: 'select', payload: target }), true);
  const selected = invader.snapshot().selectedEnemy;
  assert.equal(invader.dispatch({ type: 'submit', payload: { ...target,
    attemptId: selected.attemptId, token: selected.token, value: selected.answer } }), true);

  let english;
  english = create('englishChoice', 'english-order', event => {
    if (event.type === 'correct') assert.equal(english.snapshot().correct, 1);
  });
  english.enter(); const englishState = english.snapshot();
  assert.equal(english.dispatch({ type: 'answer', payload: {
    sessionId: englishState.sessionId, problemId: englishState.problem.problemId,
    attemptId: englishState.attemptId, choiceId: englishState.problem.correctChoiceId,
  } }), true);

  let sentence;
  sentence = create('sentenceOrder', 'sentence-order', event => {
    if (event.type === 'incorrect') assert.equal(sentence.snapshot().incorrect, 1);
  });
  sentence.enter(); const sentenceState = sentence.snapshot();
  assert.equal(sentence.dispatch({ type: 'submit', payload: {
    sessionId: sentenceState.sessionId, problemId: sentenceState.problem.problemId,
    attemptId: sentenceState.attemptId,
  } }), true);

  let timed;
  timed = create('timedChoice', 'timed-order', event => {
    if (event.type === 'correct') assert.equal(timed.snapshot().correct, 1);
  });
  timed.enter(); const timedState = timed.snapshot();
  assert.equal(timed.dispatch({ type: 'answer', payload: {
    sessionId: timedState.sessionId, problemId: timedState.problem.problemId,
    attemptId: timedState.attemptId, choiceId: timedState.problem.correctChoiceId,
  } }), true);

  let multi;
  multi = create('multiSelect', 'multi-order', event => {
    if (event.type === 'incorrect') assert.equal(multi.snapshot().partial, 1);
  });
  multi.enter(); const multiState = multi.snapshot();
  for (const choiceId of multiState.problem.correctChoiceIds.slice(0, 2)) {
    const current = multi.snapshot();
    assert.equal(multi.dispatch({ type: 'toggle', payload: { sessionId: current.sessionId,
      problemId: current.problem.problemId, attemptId: current.attemptId, choiceId } }), true);
  }
  const ready = multi.snapshot();
  assert.equal(multi.dispatch({ type: 'submit', payload: { sessionId: ready.sessionId,
    problemId: ready.problem.problemId, attemptId: ready.attemptId } }), true);
});

test('instance exit is idempotent and permanently rejects old commands', () => {
  for (const id of Object.keys(miniGameRegistry)) {
    const game = create(id, `${id}-exit`); game.enter();
    const before = game.snapshot(); game.exit(); game.exit();
    assert.equal(game.snapshot().active, false); assert.equal(game.snapshot().aborted, true);
    const old = id === 'mathSprint'
      ? { type: 'submit', payload: { sessionId: before.sessionId, token: before.token, value: before.problem.answer } }
      : id === 'mathInvader'
        ? { type: 'select', payload: { sessionId: before.sessionId,
          enemyId: before.enemies[0].enemyId, problemId: before.enemies[0].problemId } }
        : id === 'englishChoice' || id === 'timedChoice'
          ? { type: 'answer', payload: { sessionId: before.sessionId, problemId: before.problem.problemId,
            attemptId: before.attemptId, choiceId: before.problem.correctChoiceId } }
          : { type: 'submit', payload: { sessionId: before.sessionId, problemId: before.problem.problemId,
            attemptId: before.attemptId } };
    assert.equal(game.dispatch(old), false);
  }
});
