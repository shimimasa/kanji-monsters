import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lessonCatalog } from '../../src/lessons/lessonCatalog.js';
import { ENERGY_CAPACITY, ELECTION_ERAS, compareLamps, simulateLightPlan,
  TURNOUT_BALLOTS, countTurnoutBallots, turnoutTally, ballotTally } from '../../public/lessons/gotomon/lesson-model-v2.js';

test('授業2本は新しいゲームと記録シートを開き、既存の親画面への橋を残す', () => {
  for (const lesson of lessonCatalog) {
    const html = readFileSync(new URL(`../../public${lesson.url}`, import.meta.url), 'utf8');
    const sheet = readFileSync(new URL(`../../public${lesson.sheetUrl}`, import.meta.url), 'utf8');
    assert.match(html, new RegExp(`data-lesson="${lesson.slug}"`));
    assert.match(html, /lesson-bridge\.js/);
    assert.match(html, /lesson-game-v2\.js/);
    assert.match(sheet, /いんさつする/);
  }
});

test('同じ蓄電量で豆電球よりLEDが長く光り、センサーは夜の4目盛を照らす', () => {
  assert.equal(compareLamps(0).bulb, ENERGY_CAPACITY);
  assert.deepEqual(compareLamps(3), { tick: 3, bulb: 0, led: 6 });
  assert.equal(compareLamps(4).led, 4);
  const darkLed = simulateLightPlan({ lamp: 'led', rule: 'dark', store: true });
  const alwaysLed = simulateLightPlan({ lamp: 'led', rule: 'always', store: true });
  const darkBulb = simulateLightPlan({ lamp: 'bulb', rule: 'dark', store: true });
  const direct = simulateLightPlan({ lamp: 'led', rule: 'dark', store: false });
  assert.deepEqual([darkLed.nightLit, alwaysLed.nightLit, darkBulb.nightLit, direct.nightLit], [4, 3, 3, 0]);
  assert.equal(darkLed.remaining, 4);
  assert.ok(darkLed.ticks.every(tick => tick.energy >= 0));
});

test('選挙権の年と最初の選挙を分け、投票者が増えた例の票数を保つ', () => {
  assert.deepEqual(ELECTION_ERAS.map(era => [era.year, era.first]),
    [['1889', '1890'], ['1925', '1928'], ['1945', '1946'], ['2015', '2016']]);
  const half = turnoutTally(10), all = turnoutTally(20);
  assert.equal(Object.values(half).reduce((a, b) => a + b), 10);
  assert.equal(Object.values(all).reduce((a, b) => a + b), 20);
  assert.deepEqual(Object.fromEntries(Object.keys(all).map(key => [key, all[key] - half[key]])),
    { bridge: 6, market: 2, map: 2 });
  assert.ok(half.market > half.bridge);
  assert.ok(all.bridge > all.market);
  assert.equal(TURNOUT_BALLOTS.length, 20);
  assert.deepEqual(countTurnoutBallots(10), half);
  assert.deepEqual(countTurnoutBallots(20), all);
  assert.deepEqual(countTurnoutBallots(5), { bridge: 1, market: 2, map: 2 });
});

test('模擬投票先はどれを選んでも一票だけ加わる', () => {
  for (const choice of ['bridge', 'market', 'map']) {
    const result = ballotTally(choice);
    assert.equal(Object.values(result).reduce((a, b) => a + b), 6);
    assert.equal(result[choice], { bridge: 2, market: 2, map: 1 }[choice] + 1);
  }
  assert.equal(ballotTally('unknown'), null);
});
