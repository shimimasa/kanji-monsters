import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KANJI_PARTS, kanjiOf } from '../../src/minigames/gotomonParts/partsData.js';
import { createPartsGame, pickPartsTargets, PARTS_RULES as R } from '../../src/minigames/gotomonParts/partsGame.js';
import { createQuizWorld } from '../../src/minigames/gameplay/quizWorlds.js';
import { growthStatus } from '../../src/minigames/companionGrowth.js';

const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const kanji = {};
for (let grade = 1; grade <= 6; grade++) for (const item of JSON.parse(readFileSync(new URL(`../../public/data/kanji_g${grade}_proto.json`, import.meta.url), 'utf8'))) kanji[item.kanji] = item;
const toHira = text => String(text).replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));

function newParts({ seed = 3, mode = 'easy', pace = 'normal' } = {}) {
  const events = [], sessionId = `prt${seed}`;
  const game = createPartsGame({ sessionId, random: seeded(seed), pace, onEvent: event => events.push(event), content: { mode } });
  assert.equal(game.enter(), true);
  const act = (type, extra = {}) => game.dispatch({ type, payload: { sessionId, attemptId: game.snapshot().attemptId, ...extra } });
  const next = () => game.dispatch({ type: 'next', payload: { sessionId } });
  const partnerColumn = () => { const s = game.snapshot(); return s.bases.find(b => kanjiOf(s.falling.part, b.part)?.kanji === s.target.kanji).column; };
  return { game, events, sessionId, act, next, partnerColumn };
}

test('the part list matches the kanji data: grade, a real reading, one kanji per pair', () => {
  assert.ok(KANJI_PARTS.length >= 45);
  const pairs = new Set();
  for (const item of KANJI_PARTS) {
    const data = kanji[item.kanji];
    assert.ok(data, item.kanji);
    assert.equal(data.grade, item.grade, item.kanji);
    const readings = [...(data.onyomi || []), ...(data.kunyomi || [])].map(r => toHira(r).split(/[.・-]/)[0]);
    assert.ok(readings.some(r => item.reading === r || item.reading.startsWith(r)), `${item.kanji} ${item.reading}`);
    assert.ok(['lr', 'tb', 'out'].includes(item.layout));
    const key = [...item.parts].sort().join('+');
    assert.ok(!pairs.has(key), `${item.kanji}: ${key} twice`); pairs.add(key);
    assert.equal(kanjiOf(item.parts[1], item.parts[0]).kanji, item.kanji, 'order does not matter');
  }
  assert.equal(pickPartsTargets({ random: seeded(1) }).every(item => item.grade <= 2), true);
  assert.equal(pickPartsTargets({ random: seeded(1), mode: 'all' }).length, R.targets);
});

test('only the partner base makes a kanji with the falling part, and bases never repeat', () => {
  for (const mode of ['easy', 'all']) {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { game, act, next, partnerColumn } = newParts({ seed, mode });
      while (game.snapshot().phase !== 'completed') {
        const s = game.snapshot();
        if (s.phase === 'feedback') { next(); continue; }
        const makes = s.bases.filter(b => kanjiOf(s.falling.part, b.part));
        assert.equal(makes.length, 1, `${s.target.kanji}: ${s.bases.map(b => b.part)}`);
        assert.equal(kanjiOf(s.falling.part, makes[0].part).kanji, s.target.kanji);
        assert.equal(new Set(s.bases.map(b => b.part)).size, R.columns);
        act('move', { column: partnerColumn() }); act('drop');
      }
      assert.equal(game.snapshot().result.made, R.targets);
    }
  }
});

test('landing on the partner joins them into the kanji; ten kanji end the run', () => {
  const { game, events, act, next, partnerColumn } = newParts({ seed: 6 });
  const target = game.snapshot().target.kanji;
  act('move', { column: partnerColumn() });
  assert.equal(act('drop'), true);
  const answer = game.snapshot().lastAnswer;
  assert.equal(answer.correct, true); assert.equal(answer.kanji, target);
  assert.equal(events.at(-1).type, 'correct');
  while (game.snapshot().phase !== 'completed') { if (game.snapshot().phase === 'feedback') next(); else { act('move', { column: partnerColumn() }); act('drop'); } }
  assert.equal(events.filter(event => ['correct', 'incorrect'].includes(event.type)).length, R.targets);
  assert.equal(events.filter(event => event.type === 'sessionComplete').length, 1);
});

test('a wrong base is one learning result; the part comes back and the partner glows', () => {
  const { game, events, act, next, partnerColumn } = newParts({ seed: 7 });
  const want = partnerColumn(), wrong = (want + 1) % R.columns;
  act('move', { column: wrong }); act('drop');
  assert.equal(game.snapshot().lastAnswer.correct, false); assert.equal(events.at(-1).type, 'incorrect');
  const slip = game.snapshot().missed.at(-1), made = game.snapshot().lastAnswer;
  assert.equal(slip.build.answer, made.parts.join('')); assert.equal(slip.build.script, 'parts');
  assert.ok(slip.build.decoys.includes(slip.chosen), 'the part dropped on comes back as a card');
  next();
  const s = game.snapshot();
  assert.equal(s.phase, 'answering'); assert.equal(s.hintColumn, want); assert.equal(s.falling.y, R.startY);
  act('move', { column: (want + 2) % R.columns }); act('drop'); assert.equal(events.at(-1).type, 'retry'); next();
  act('move', { column: want }); act('drop'); assert.equal(events.at(-1).type, 'joined');
  assert.equal(events.filter(event => ['correct', 'incorrect'].includes(event.type)).length, 1);
});

test('the part falls by itself (slower on ゆっくり) and lands where it is; pause holds it', () => {
  const fast = newParts({ seed: 8 }), slow = newParts({ seed: 8, pace: 'slow' });
  for (let t = 0; t < 3000; t += 16) { fast.game.update(16); slow.game.update(16); }
  assert.ok(slow.game.snapshot().falling.y < fast.game.snapshot().falling.y);
  fast.game.setPaused(true); const y = fast.game.snapshot().falling.y; fast.game.update(5000);
  assert.equal(fast.game.snapshot().falling.y, y); fast.game.setPaused(false);
  for (let t = 0; t < R.fallMs.normal; t += 16) fast.game.update(16);
  assert.equal(fast.game.snapshot().phase, 'feedback');
});

test('old attempts, bad columns and paused moves are refused', () => {
  const { game, sessionId, act } = newParts({ seed: 9 });
  assert.equal(act('move', { column: 9 }), false); assert.equal(act('move', { column: 1.5 }), false);
  game.setPaused(true); assert.equal(act('drop'), false); game.setPaused(false);
  assert.equal(game.dispatch({ type: 'drop', payload: { sessionId, attemptId: 'old' } }), false);
});

test('the parts world counts built kanji', () => {
  const world = createQuizWorld('parts', growthStatus().effects);
  world.context({ mode: 'parts', phase: 'answering', problem: { problemId: 'p' } });
  world.answer(true, {}, 1); world.answer(false, {}, 0);
  assert.match(world.snapshot().summary, /漢字を2字くみたてた · 1回で合体 1字/);
});
