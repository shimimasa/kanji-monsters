import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistoryGame } from '../../src/minigames/historyBuild/historyGame.js';
import { HISTORY_CARDS, HISTORY_PAIRS, HISTORY_BUILDINGS } from '../../src/minigames/historyBuild/historyContent.js';

test('history cards offer two distinct choices and each reading has one answer', () => {
  assert.equal(HISTORY_PAIRS.length, 6);
  assert.equal(HISTORY_CARDS.length, 12);
  for (const pair of HISTORY_PAIRS) {
    assert.equal(pair.length, 2);
    assert.notEqual(pair[0], pair[1]);
  }
  for (const card of HISTORY_CARDS) {
    assert.equal(card.choices.length, 4);
    assert.equal(new Set(card.choices).size, 4);
    assert.equal(card.choices.filter(reading => reading === card.reading).length, 1);
  }
});

test('only an explicit reading answer grades learning; every chosen card helps build the town', () => {
  const events = [];
  const sessionId = 'history-fair';
  const game = createHistoryGame({ sessionId, onEvent: event => events.push(event) });
  assert.equal(game.enter(), true);
  const s = () => game.snapshot();
  const send = (type, payload = {}) => game.dispatch({ type, payload: { sessionId, ...payload } });
  assert.equal(send('build', { buildingId: 'village' }), false);
  for (let round = 0; round < HISTORY_PAIRS.length; round++) {
    const card = s().offers[0];
    assert.equal(send('choose', { cardId: card.id }), true);
    assert.equal(s().answered, round);
    assert.equal(events.at(-1).type, 'problemPresented');
    const { attemptId, problem } = s();
    const choiceId = round === 0 ? problem.choices.find(c => c.choiceId !== card.reading).choiceId : card.reading;
    assert.equal(send('answer', { attemptId, choiceId }), true);
    assert.equal(s().answered, round + 1);
    assert.equal(send('answer', { attemptId, choiceId }), false, 'a second tap cannot be graded');
    if (round === 0) {
      assert.equal(s().incorrect, 1);
      assert.equal(s().rice, 1 + card.rice, 'a different reading still grants the card');
      assert.equal(s().missed.length, 1);
    }
    const buildable = HISTORY_BUILDINGS.find(item => s().rice >= item.rice && s().knowledge >= item.knowledge);
    if (buildable) {
      assert.equal(send('build', { buildingId: buildable.id }), true);
      assert.equal(send('build', { buildingId: buildable.id }), false, 'one building per card');
      assert.equal(s().answered, round + 1, 'building does not grade learning');
    }
    assert.equal(send('next', { problemId: problem.problemId }), true);
    assert.equal(s().answered, round + 1, 'moving on does not grade learning');
  }
  assert.equal(s().phase, 'completed');
  assert.equal(s().result.finished, true);
  assert.equal(s().deck.length, 6);
  assert.equal(s().correct, 5);
  assert.equal(s().incorrect, 1);
  assert.equal(events.filter(event => event.type === 'problemPresented').length, 6);
  assert.equal(events.filter(event => ['correct', 'incorrect'].includes(event.type)).length, 6);
  assert.equal(events.filter(event => event.type === 'sessionComplete').length, 1);
  assert.equal(send('next', { problemId: null }), false);
});

test('a pause, stale session and observer callback cannot inject an answer', () => {
  let game;
  const sessionId = 'history-guard';
  const attempted = [];
  game = createHistoryGame({ sessionId, onEvent: event => {
    if (event.type === 'problemPresented') attempted.push(game.dispatch({ type: 'answer', payload: {
      sessionId, attemptId: game.snapshot().attemptId,
      choiceId: game.snapshot().problem.correctChoiceId,
    } }));
  } });
  game.enter();
  const cardId = game.snapshot().offers[0].id;
  assert.equal(game.dispatch({ type: 'choose', payload: { sessionId: 'stale', cardId } }), false);
  assert.equal(game.dispatch({ type: 'choose', payload: { sessionId, cardId } }), true);
  assert.deepEqual(attempted, [false]);
  const state = game.snapshot();
  game.setPaused(true);
  assert.equal(game.dispatch({ type: 'answer', payload: { sessionId, attemptId: state.attemptId,
    choiceId: state.problem.correctChoiceId } }), false);
  assert.equal(game.snapshot().answered, 0);
  game.exit(); game.exit();
  assert.equal(game.snapshot().aborted, true);
  assert.equal(game.dispatch({ type: 'answer', payload: { sessionId, attemptId: state.attemptId,
    choiceId: state.problem.correctChoiceId } }), false);
});
