import test from 'node:test';
import assert from 'node:assert/strict';
import { miniGameRegistry } from '../../src/minigames/registry.js';
import { SHORT_COURSE_COUNTS, courseCountLabel, supportsShortCourse } from '../../src/minigames/courseLength.js';

const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const slashGames = ['gotomonSlash', 'gotomonRace', 'gotomonSeek', 'gotomonJump', 'gotomonTag', 'gotomonGolf', 'gotomonHop', 'gotomonLand', 'gotomonTrace'];

test('every supported short question game starts with six valid problems, and full play keeps twelve', () => {
  assert.equal(Object.keys(SHORT_COURSE_COUNTS).length, 16);
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
