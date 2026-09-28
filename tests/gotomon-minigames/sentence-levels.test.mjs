import test from 'node:test';
import assert from 'node:assert/strict';
import { SENTENCE_ORDER_FIXTURE, SENTENCE_CHALLENGE_FIXTURE, generateSentenceOrderQuestions } from '../../src/minigames/sentenceOrder/sentenceOrderQuestions.js';
import { createSentenceOrderGame } from '../../src/minigames/sentenceOrder/sentenceOrderGame.js';
const identity = state => ({ sessionId: state.sessionId, problemId: state.problem.problemId, attemptId: state.attemptId });
test('standard keeps all 120 three-piece items; explicit standard equals legacy defaults', () => {
  assert.equal(SENTENCE_ORDER_FIXTURE.length, 120); assert.ok(SENTENCE_ORDER_FIXTURE.every(q => q.chunks.length === 3));
  assert.deepEqual(generateSentenceOrderQuestions({ sessionId: 'same', random: () => .3 }), generateSentenceOrderQuestions({ sessionId: 'same', random: () => .3, sentenceLevel: 'standard' }));
});
test('challenge has ten new unique sentences and stable piece identities with explanations', () => {
  assert.equal(SENTENCE_CHALLENGE_FIXTURE.length, 10);
  assert.equal(new Set(SENTENCE_CHALLENGE_FIXTURE.map(q => q.chunks.map(c => c.text).join(''))).size, 10);
  for (const q of SENTENCE_CHALLENGE_FIXTURE) {
    assert.equal(q.chunks.length, 4); assert.equal(new Set(q.correctOrder).size, 4);
    assert.ok(q.explanation); assert.ok(!SENTENCE_ORDER_FIXTURE.some(old => old.fixtureId === q.fixtureId));
  }
});
test('every challenge item is reached once per run and never starts solved, including extreme RNG', () => {
  for (const random of [() => 0, () => .999999]) {
    const questions = generateSentenceOrderQuestions({ sessionId: 'challenge', random, sentenceLevel: 'challenge' });
    assert.equal(new Set(questions.map(q => q.fixtureId)).size, 10);
    for (const q of questions) { assert.notDeepEqual(q.initialOrder, q.correctOrder); assert.deepEqual([...q.initialOrder].sort(), [...q.correctOrder].sort()); }
  }
  assert.throws(() => generateSentenceOrderQuestions({ sessionId: 'bad', sentenceLevel: 'unknown' }), /level/);
});
test('challenge preserves pause, one-answer identity, feedback and ten-question completion', () => {
  const events = [], game = createSentenceOrderGame({ sessionId: 'test', sentenceLevel: 'challenge', onEvent: e => events.push(e) }); game.enter();
  for (let i = 0; i < 10; i++) {
    let s = game.snapshot(), id = identity(s);
    game.setPaused(true); assert.equal(game.submit(id), false); game.setPaused(false);
    for (let to = 0; to < s.problem.correctOrder.length; to++) {
      s = game.snapshot(); const chunkId = s.problem.correctOrder[to];
      if (s.currentOrder[to] !== chunkId) assert.equal(game.place({ ...id, chunkId, to }), true);
    }
    assert.equal(game.submit(id), true); assert.equal(game.submit(id), false);
    game.next(id);
  }
  assert.deepEqual(game.snapshot().result, { answered: 10, correct: 10, incorrect: 0, accuracy: 1 });
  assert.equal(events.filter(e => e.type === 'sessionComplete').length, 1);
});
