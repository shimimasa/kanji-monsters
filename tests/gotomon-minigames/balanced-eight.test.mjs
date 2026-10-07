import test from 'node:test';
import assert from 'node:assert/strict';
import { NEW_GAME_CONTENT, NEW_GAME_IDS } from '../../src/minigames/balancedEight/content.js';
import { createBalancedGame } from '../../src/minigames/balancedEight/game.js';
import { miniGameRegistry } from '../../src/minigames/registry.js';
import { gameExperiences } from '../../src/minigames/gameExperiences.js';
import { hubSections, subjectOf } from '../../src/minigames/hubCatalog.js';
import { gameRank } from '../../src/minigames/gameRank.js';

test('6問の全問正解はSランクになり、到達不能な次の目標を出さない', () => {
  for (const id of NEW_GAME_IDS) {
    assert.equal(gameRank(id, 600, 6).rank, 'S', id);
    assert.equal(gameRank(id, 600, 6).next, null, id);
    assert.equal(gameRank(id, 400, 4).rank, 'A', id);
  }
  assert.equal(gameRank('mathSprint', 1600, 8).rank, 'S');
});

test('8種類48問のデータは重複のない選択肢と一意の正答を持ち、全て登録される', () => {
  assert.equal(NEW_GAME_IDS.length, 8);
  assert.equal(Object.keys(miniGameRegistry).length, 50);
  const listed = hubSections('all').flatMap(section => section.games);
  assert.equal(new Set(listed).size, 50);
  for (const id of NEW_GAME_IDS) {
    const content = NEW_GAME_CONTENT[id];
    assert.equal(content.rounds.length, 6, id);
    assert.ok(miniGameRegistry[id] && gameExperiences[id], id);
    assert.equal(subjectOf(id), content.subject);
    for (const [index, round] of content.rounds.entries()) {
      assert.ok(round.prompt && round.explain && round.visual, `${id}:${index}`);
      assert.equal(round.choices.length, 3, `${id}:${index}`);
      assert.equal(new Set(round.choices).size, 3, `${id}:${index}`);
      assert.equal(round.choices.filter(value => value === round.correct).length, 1, `${id}:${index}`);
    }
  }
});

test('おへやの6問は絵の上・中・下にそれぞれ一つずつ置ける', () => {
  for (const [index, round] of NEW_GAME_CONTENT.englishRoom.rounds.entries()) {
    for (const position of ['上', '中', '下']) {
      assert.equal(round.choices.filter(choice => choice.endsWith(` ${position}`)).length, 1,
        `englishRoom:${index}:${position}`);
    }
  }
});

test('8種類とも6回の明示的な回答だけを記録し、どの答えでも最後まで進める', () => {
  for (const id of NEW_GAME_IDS) {
    const events = [];
    const game = createBalancedGame(id, { sessionId: `test:${id}`, onEvent: event => events.push(event) });
    assert.equal(game.enter(), true);
    for (let round = 0; round < 6; round++) {
      const state = game.snapshot();
      assert.equal(state.phase, 'answering', id);
      const choiceId = round % 2 ? state.problem.choices.find(choice => choice.choiceId !== state.problem.correctChoiceId).choiceId
        : state.problem.correctChoiceId;
      game.update(5000);
      assert.equal(game.snapshot().answered, round, 'time does not answer');
      assert.equal(game.dispatch({ type: 'answer', payload: {
        sessionId: state.sessionId, attemptId: state.attemptId, choiceId } }), true, id);
      assert.equal(game.dispatch({ type: 'answer', payload: {
        sessionId: state.sessionId, attemptId: state.attemptId, choiceId } }), false, 'same answer is not counted twice');
      assert.equal(game.snapshot().artifacts.length, round + 1, 'participation always adds an artifact');
      assert.equal(game.dispatch({ type: 'next', payload: {
        sessionId: state.sessionId, problemId: state.problem.problemId } }), true);
    }
    const final = game.snapshot();
    assert.equal(final.phase, 'completed', id);
    assert.deepEqual([final.answered, final.correct, final.incorrect], [6, 3, 3], id);
    assert.equal(events.filter(event => ['correct', 'incorrect'].includes(event.type)).length, 6);
    assert.equal(events.filter(event => event.type === 'sessionComplete').length, 1);
    assert.equal(game.dispatch({ type: 'next', payload: { sessionId: final.sessionId, problemId: 'old' } }), false);
    game.exit();
  }
});

test('停止中・別セッション・古い問題の操作は回答にならない', () => {
  const events = [];
  const game = createBalancedGame('wonderLab', { sessionId: 'lab', onEvent: event => events.push(event) });
  game.enter();
  const state = game.snapshot();
  const payload = { sessionId: 'lab', attemptId: state.attemptId, choiceId: state.problem.correctChoiceId };
  game.setPaused(true);
  assert.equal(game.dispatch({ type: 'answer', payload }), false);
  game.setPaused(false);
  assert.equal(game.dispatch({ type: 'answer', payload: { ...payload, sessionId: 'other' } }), false);
  assert.equal(game.dispatch({ type: 'answer', payload: { ...payload, attemptId: 'old' } }), false);
  assert.equal(game.snapshot().answered, 0);
  assert.equal(game.dispatch({ type: 'answer', payload }), true);
  assert.equal(events.filter(event => event.type === 'correct').length, 1);
});
