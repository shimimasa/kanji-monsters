import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildDeliveries, deliveryHint, maskPrefecture, DELIVERIES, CANDIDATES } from '../../src/minigames/gotomonDelivery/deliveryContent.js';
import { PREFECTURES, REGIONS, MAP_COLUMNS, MAP_ROWS, prefectureByName } from '../../src/minigames/gotomonDelivery/prefectures.js';
import { createDeliveryGame } from '../../src/minigames/gotomonDelivery/deliveryGame.js';
import { createQuizWorld } from '../../src/minigames/gameplay/quizWorlds.js';
import { growthStatus } from '../../src/minigames/companionGrowth.js';

const monsters = JSON.parse(readFileSync(new URL('../../public/data/enemies_proto.json', import.meta.url), 'utf8'));
const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

function newDelivery({ seed = 3, regionId = 'all' } = {}) {
  const events = [], sessionId = `delivery${seed}`;
  const game = createDeliveryGame({ sessionId, onEvent: event => events.push(event),
    content: { regionId, deliveries: buildDeliveries({ sessionId, random: seeded(seed), monsters, regionId }) } });
  assert.equal(game.enter(), true);
  const deliver = prefecture => game.dispatch({ type: 'deliver', payload: { sessionId, attemptId: game.snapshot().attemptId, prefecture } });
  const next = () => game.dispatch({ type: 'next', payload: { sessionId } });
  const bring = () => { deliver(game.snapshot().delivery.prefecture); next(); };
  return { game, events, sessionId, deliver, next, bring };
}

test('the tile map holds all 47 prefectures on separate tiles inside the grid', () => {
  assert.equal(PREFECTURES.length, 47);
  assert.equal(new Set(PREFECTURES.map(pref => pref.name)).size, 47);
  const cells = new Set();
  for (const pref of PREFECTURES) {
    assert.ok(REGIONS.some(region => region.regionId === pref.regionId), pref.name);
    for (let c = pref.column; c < pref.column + pref.width; c++) for (let r = pref.row; r < pref.row + pref.height; r++) {
      assert.ok(c >= 0 && c < MAP_COLUMNS && r >= 0 && r < MAP_ROWS, pref.name);
      assert.ok(!cells.has(`${c},${r}`), `${pref.name} overlaps`); cells.add(`${c},${r}`);
    }
  }
  assert.deepEqual(REGIONS.map(region => PREFECTURES.filter(pref => pref.regionId === region.regionId).length), [7, 7, 9, 7, 9, 8]);
});

test('hints hide the home prefecture, never name another one, and cover all 47', () => {
  assert.equal(maskPrefecture('東京都の市場。東京は大きい。', '東京'), '〇〇の市場。〇〇は大きい。');
  assert.equal(maskPrefecture('京都府の寺', '京都'), '〇〇の寺');
  const hints = monsters.map(deliveryHint).filter(Boolean);
  assert.ok(hints.length >= 150, `${hints.length} hints`);
  assert.equal(new Set(hints.map(hint => hint.prefecture)).size, 47);
  for (const hint of hints) {
    for (const pref of PREFECTURES) assert.ok(!hint.hint.includes(pref.name) && !hint.habitat.includes(pref.name), `${hint.prefecture}: ${hint.hint}`);
  }
  // A note that points nowhere (no prefecture, no landmark) is not a delivery.
  assert.equal(deliveryHint({ prefecture: '北海道', name: 'x', habitat: '川の上流', trivia: '鮭は秋の魚。' }), null);
  assert.equal(deliveryHint({ prefecture: 'メキシコ', name: 'x', habitat: '', trivia: 'メキシコの料理。' }), null);
  assert.ok(deliveryHint({ prefecture: '宮城', name: 'x', habitat: '仙台平野', trivia: 'ずんだ餅は仙台の名産。' }));
  // A name hidden only in the home says nothing about the place.
  assert.equal(deliveryHint({ prefecture: '秋田', name: 'x', habitat: '秋田の郷土料理の里', trivia: '餅は米を加工した食文化の象徴。' }), null);
  // Another prefecture's landmark would make two answers.
  assert.equal(deliveryHint({ prefecture: '大阪', name: 'x', habitat: '', trivia: '大阪と神戸を結ぶ電車。' }), null);
});

test('every region and all of Japan make ten deliveries with four candidates on the map', () => {
  for (const regionId of ['all', ...REGIONS.map(region => region.regionId)]) {
    for (let seed = 1; seed <= 15; seed++) {
      const deliveries = buildDeliveries({ sessionId: 's', random: seeded(seed), monsters, regionId });
      assert.ok(deliveries, `${regionId} ${seed}`);
      assert.equal(deliveries.length, DELIVERIES);
      assert.equal(new Set(deliveries.map(item => item.monsterId)).size, DELIVERIES);
      if (regionId === 'all') assert.equal(new Set(deliveries.map(item => item.prefecture)).size, DELIVERIES);
      deliveries.forEach((item, index) => {
        assert.equal(item.candidates.length, CANDIDATES); assert.equal(new Set(item.candidates).size, CANDIDATES);
        assert.equal(item.candidates.filter(name => name === item.prefecture).length, 1);
        const home = prefectureByName(item.prefecture);
        if (regionId !== 'all') assert.ok(item.candidates.every(name => prefectureByName(name).regionId === regionId));
        else assert.equal(item.candidates.filter(name => prefectureByName(name).regionId === home.regionId).length, 2);
        if (index) assert.notEqual(item.prefecture, deliveries[index - 1].prefecture, `${regionId} ${seed}`);
      });
    }
  }
});

test('ten deliveries end the run with one result and a stamp for each prefecture reached', () => {
  const { game, events, bring } = newDelivery();
  while (game.snapshot().phase !== 'completed') bring();
  const { result, stamps } = game.snapshot();
  assert.equal(result.delivered, DELIVERIES); assert.equal(result.correct, DELIVERIES); assert.equal(result.stamps, DELIVERIES);
  assert.equal(stamps.length, DELIVERIES);
  assert.equal(events.filter(event => event.type === 'correct').length, DELIVERIES);
  assert.equal(events.filter(event => event.type === 'sessionComplete').length, 1);
});

test('a wrong prefecture is one learning result; the home glows and the Gotomon waits', () => {
  const { game, events, deliver, next } = newDelivery({ seed: 5, regionId: 'kinki' });
  const state = game.snapshot(), home = state.delivery.prefecture;
  const wrong = state.delivery.candidates.find(name => name !== home);
  assert.equal(deliver(wrong), true);
  assert.equal(game.snapshot().lastAnswer.correct, false); assert.equal(game.snapshot().lastAnswer.chosen, wrong);
  assert.equal(events.at(-1).type, 'incorrect');
  assert.equal(game.snapshot().missed.at(-1).prefecture, home);
  const slip = game.snapshot().missed.at(-1);
  assert.ok(slip.build.answer.startsWith(home)); assert.match(slip.build.answer, /[都道府県]$/); assert.equal(slip.build.script, 'place');
  assert.equal(deliver(home), false); // no delivery during feedback
  next();
  assert.equal(game.snapshot().hintPrefecture, home);
  assert.notEqual(game.snapshot().problem.problemId, state.problem.problemId);
  deliver(wrong); assert.equal(events.at(-1).type, 'retry'); next();
  assert.equal(deliver(home), true); assert.equal(events.at(-1).type, 'delivered'); next();
  assert.equal(events.filter(event => ['correct', 'incorrect'].includes(event.type)).length, 1);
  assert.deepEqual(game.snapshot().stamps, [home]);
  assert.equal(game.snapshot().deliveryIndex, 1);
});

test('non-candidates, old attempts, paused tries and missing content are refused', () => {
  const { game, sessionId, deliver, bring } = newDelivery({ seed: 7 });
  const outside = PREFECTURES.find(pref => !game.snapshot().delivery.candidates.includes(pref.name)).name;
  assert.equal(deliver(outside), false);
  const { attemptId, delivery } = game.snapshot();
  bring();
  assert.equal(game.dispatch({ type: 'deliver', payload: { sessionId, attemptId, prefecture: delivery.prefecture } }), false);
  game.setPaused(true); assert.equal(deliver(game.snapshot().delivery.prefecture), false); game.setPaused(false);
  assert.equal(createDeliveryGame({ sessionId: 'x', content: { deliveries: null } }).enter(), false);
});

test('the delivery world summarises without leading with a zero', () => {
  const world = createQuizWorld('delivery', growthStatus().effects);
  world.context({ mode: 'delivery', phase: 'answering', problem: { problemId: 'p' } });
  world.answer(true, {}, 1); world.answer(false, {}, 0);
  assert.match(world.snapshot().summary, /ふるさとに2こ とどけた · 1回でとどいた 1こ/);
});
