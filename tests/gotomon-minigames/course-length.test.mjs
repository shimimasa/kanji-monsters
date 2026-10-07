import test from 'node:test';
import assert from 'node:assert/strict';
import { miniGameRegistry } from '../../src/minigames/registry.js';
import { SHORT_COURSE_COUNTS, courseCountLabel, supportsShortCourse } from '../../src/minigames/courseLength.js';

const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const slashGames = ['gotomonSlash', 'gotomonRace', 'gotomonSeek', 'gotomonJump', 'gotomonTag', 'gotomonGolf', 'gotomonHop', 'gotomonLand', 'gotomonTrace'];

test('every supported short question game starts with six valid problems, and full play keeps twelve', () => {
  assert.equal(Object.keys(SHORT_COURSE_COUNTS).length, 17);
  for (const gameId of slashGames) {
    assert.equal(supportsShortCourse(gameId), true);
    for (const [courseLength, expected] of [['short', 6], ['full', 12]]) {
      const game = miniGameRegistry[gameId].create({ sessionId: `${gameId}:${courseLength}`, random: seeded(7), mode: 'math', courseLength });
      assert.equal(game.enter(), true, `${gameId} ${courseLength}`);
      const state = game.snapshot();
      assert.equal(gameId === 'gotomonTrace' ? state.firstRound : state.total, expected, `${gameId} ${courseLength}`);
      game.exit();
    }
  }
  assert.equal(courseCountLabel('gotomonGolf', true), '6ホール');
  assert.equal(courseCountLabel('gotomonLand', true), '6ステージ');
  assert.equal(courseCountLabel('gotomonPush', true), '5へや');
});

test('short independent rounds use six of twelve in toss, fishing, drum and shooter', () => {
  for (const gameId of ['gotomonToss', 'gotomonFishing', 'gotomonDrum', 'gotomonShooter']) {
    for (const [courseLength, expected] of [['short', 6], ['full', 12]]) {
      const game = miniGameRegistry[gameId].create({ sessionId: `${gameId}:${courseLength}`, random: seeded(8), mode: 'math',
        mathLevel: 'addsub', courseLength });
      assert.equal(game.enter(), true, `${gameId} ${courseLength}`);
      const state = game.snapshot();
      assert.equal(gameId === 'gotomonShooter' ? state.waves : state.total, expected, `${gameId} ${courseLength}`);
      game.exit();
    }
  }
  assert.equal(courseCountLabel('gotomonToss', true), '6球');
  assert.equal(courseCountLabel('gotomonDelivery', true), '5こ');
});

test('2048 has a short eight-question finish and keeps the full sixteen-question course', () => {
  for (const [courseLength, expected] of [['short', 8], ['full', 16]]) {
    const game = miniGameRegistry.gotomonMerge.create({ sessionId: `merge:${courseLength}`, random: seeded(9), courseLength });
    assert.equal(game.enter(), true);
    assert.equal(game.snapshot().questions, expected);
    game.exit();
  }
  assert.equal(courseCountLabel('gotomonMerge', true), '8問');
  assert.equal(courseCountLabel('gotomonMerge'), '16問');
  const events = [], sessionId = 'merge:short:finish';
  const game = miniGameRegistry.gotomonMerge.create({ sessionId, random: seeded(9), courseLength: 'short',
    onEvent: event => events.push(event) });
  game.enter();
  let turns = 0;
  while (game.snapshot().phase !== 'completed' && turns++ < 30) {
    const state = game.snapshot();
    if (state.phase === 'answering') {
      assert.equal(game.dispatch({ type: 'answer', payload: { sessionId, attemptId: state.attemptId,
        choiceId: state.problem.correctChoiceId } }), true);
    } else {
      assert.equal(['left', 'down', 'right', 'up'].some(direction => game.dispatch({ type: 'slide',
        payload: { sessionId, attemptId: state.attemptId, direction } })), true);
    }
  }
  assert.equal(game.snapshot().phase, 'completed');
  assert.equal(game.snapshot().result.answered, 8);
  assert.equal(events.filter(event => event.type === 'sessionComplete').length, 1);
});
