import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSlashProblems } from '../../src/minigames/gotomonSlash/slashContent.js';
import { createTraceGame, toTraceItems, buildBoard, touching, TRACE_RULES as R } from '../../src/minigames/gotomonTrace/traceGame.js';

const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const grade1 = JSON.parse(readFileSync(new URL('../../public/data/kanji_g1_proto.json', import.meta.url), 'utf8'));

// The first path on the board that spells `word` (searched from scratch), or null.
function findPath(tiles, word) {
  const target = [...word];
  const go = list => {
    if (list.length === target.length) return list;
    for (let c = 0; c < tiles.length; c++) if (!list.includes(c) && touching(list.at(-1), c) && tiles[c] === target[list.length]) { const p = go([...list, c]); if (p) return p; }
    return null;
  };
  for (let c = 0; c < tiles.length; c++) if (tiles[c] === target[0]) { const p = go([c]); if (p) return p; }
  return null;
}
// Any path of the right length that does not spell the word.
function wrongPath(tiles, word) {
  const len = [...word].length;
  const go = list => {
    if (list.length === len) return list.map(c => tiles[c]).join('') !== word ? list : null;
    for (let c = 0; c < tiles.length; c++) if (!list.includes(c) && touching(list.at(-1), c)) { const p = go([...list, c]); if (p) return p; }
    return null;
  };
  for (let c = 0; c < tiles.length; c++) { const p = go([c]); if (p) return p; }
  return null;
}

function newTrace({ seed = 3, mode = 'kanji', pace = 'normal' } = {}) {
  const events = [], sessionId = `trace${seed}`;
  const problems = buildSlashProblems({ sessionId, random: seeded(seed), mode, gradeKanji: grade1 });
  const game = createTraceGame({ sessionId, random: seeded(seed + 1), pace, onEvent: event => events.push(event), content: { problems } });
  assert.equal(game.enter(), true);
  const items = toTraceItems(problems);
  const answerOf = s => items.find(it => it.contentId === s.problem.contentId).target.join('');
  const trace = cells => game.dispatch({ type: 'trace', payload: { sessionId, attemptId: game.snapshot().attemptId, cells } });
  const solve = () => { const s = game.snapshot(); assert.equal(trace(findPath(s.tiles, answerOf(s))), true); };
  const slip = () => { const s = game.snapshot(); assert.equal(trace(wrongPath(s.tiles, answerOf(s))), true); };
  const finishSolved = () => { for (let t = 0; t < 3000 && game.snapshot().phase === 'solved'; t += 16) game.update(16); };
  return { game, events, sessionId, items, answerOf, trace, solve, slip, finishSolved };
}

test('questions become words to trace: kanji readings in kana, English words from their meaning, math answers in digits', () => {
  for (const [mode, re] of [['kanji', /^[ぁ-ゖ]+$/], ['english', /^[a-z]+$/], ['math', /^[0-9]+$/]]) {
    for (let seed = 1; seed <= 40; seed++) {
      const items = toTraceItems(buildSlashProblems({ sessionId: `m${seed}`, random: seeded(seed), mode, gradeKanji: grade1 }));
      for (const it of items) {
        assert.match(it.target.join(''), re, `${mode} ${it.prompt}`);
        assert.ok(it.target.length >= 1 && it.target.length <= R.size * R.size);
        if (mode === 'english') { assert.equal(it.kind, 'ja2en'); assert.equal(it.skillId, 'english.basicVocabulary.word'); assert.match(it.prompt, /^「.+」は英語で？$/); }
      }
    }
  }
});

test('every board holds its word along neighbouring tiles, among look-alike decoys', () => {
  for (const mode of ['kanji', 'english', 'math']) {
    for (let seed = 1; seed <= 30; seed++) {
      const items = toTraceItems(buildSlashProblems({ sessionId: `b${seed}`, random: seeded(seed), mode, gradeKanji: grade1 }));
      items.forEach((it, k) => {
        const b = buildBoard(it, seeded(seed * 50 + k));
        assert.equal(b.tiles.length, R.size * R.size);
        assert.equal(b.path.map(c => b.tiles[c]).join(''), it.target.join(''));
        b.path.forEach((c, i) => { if (i) assert.ok(touching(b.path[i - 1], c)); });
        assert.ok(findPath(b.tiles, it.target.join('')), `${mode} ${it.target.join('')}`);
      });
    }
  }
  // Look-alikes show up: a word with が gets か on the board often.
  let seen = 0;
  for (let k = 0; k < 50; k++) if (buildBoard({ script: 'kana', target: ['が', 'っ'], decoys: [] }, seeded(k + 1)).tiles.some(t => t === 'か' || t === 'つ')) seen++;
  assert.ok(seen > 40, `look-alikes on ${seen}/50 boards`);
});

test('the right word: ⭐3 in time, the tiles pop, then the next board', () => {
  const { game, events, solve, finishSolved } = newTrace();
  const first = game.snapshot();
  assert.equal(first.phase, 'answering'); assert.equal(first.tiles.length, 25); assert.deepEqual(first.problem.choices, []);
  solve();
  let s = game.snapshot();
  assert.equal(s.lastTrace.correct, true); assert.equal(s.lastSolved.stars, 3);
  assert.equal(s.phase, 'solved'); assert.equal(s.solvedCells.length, first.length);
  finishSolved();
  s = game.snapshot();
  assert.equal(s.problemIndex, 1); assert.equal(s.correct, 1); assert.equal(s.stars, 3);
  assert.deepEqual(events.filter(e => e.type !== 'problemPresented').map(e => e.type), ['correct']);
});

test('a shorter trace is not judged; a broken or repeated path is refused', () => {
  const { game, trace, answerOf } = newTrace({ mode: 'english' });
  const s = game.snapshot(), path = findPath(s.tiles, answerOf(s));
  assert.equal(trace(path.slice(0, -1)), false);
  assert.equal(game.snapshot().lastTrace.short, true);
  assert.equal(game.snapshot().answered, 0);
  // As long as the word, but jumping over tiles: refused, not judged.
  const far = [0, 2, 4, 10, 12, 14, 20, 22, 24].slice(0, path.length);
  assert.equal(far.length, path.length, 'a word of at most 9 letters on this seed');
  const before = game.snapshot().lastTrace;
  assert.equal(trace(far), false, 'tiles must touch');
  assert.equal(game.snapshot().lastTrace, before);
  assert.equal(trace([0, 1, 0]), false, 'a tile only once');
  assert.equal(trace([-1]), false);
  assert.equal(game.snapshot().answered, 0);
});

test('a wrong word shows where it differs; the first tile glows, after a second wrong the whole word; the retry is no second result', () => {
  const { game, events, slip, solve, answerOf } = newTrace({ seed: 5, mode: 'english' });
  const first = game.snapshot();
  slip();
  let s = game.snapshot();
  assert.equal(s.lastTrace.correct, false);
  assert.ok(s.lastTrace.wrongAt >= 1);
  assert.equal(s.lastTrace.expected, answerOf(first)[s.lastTrace.wrongAt - 1]);
  assert.equal(s.hint, 1); assert.equal(s.hintCells.length, 1);
  assert.equal(s.tiles[s.hintCells[0]], answerOf(first)[0]);
  assert.notEqual(s.problem.problemId, first.problem.problemId);
  assert.equal(s.missed.length, 1);
  slip();
  s = game.snapshot();
  assert.equal(s.hint, 2);
  assert.equal(s.hintCells.map(c => s.tiles[c]).join(''), answerOf(first));
  solve();
  s = game.snapshot();
  assert.equal(s.answered, 1); assert.equal(s.incorrect, 1); assert.equal(s.lastSolved.stars, 1);
  assert.deepEqual(events.filter(e => e.type !== 'problemPresented').map(e => e.type), ['incorrect', 'retry', 'passed']);
});

test('when the gauge fills the first tile glows (⭐2), never a game over', () => {
  const { game, solve, answerOf } = newTrace({ pace: 'slow' });
  for (let t = 0; t < R.hintMs.slow - 100; t += 50) game.update(50);
  assert.equal(game.snapshot().hint, 0);
  for (let t = 0; t < 200; t += 50) game.update(50);
  const s = game.snapshot();
  assert.equal(s.hint, 1); assert.equal(s.gauge, 1); assert.equal(s.tiles[s.hintCells[0]], answerOf(s)[0]);
  for (let t = 0; t < 60000; t += 100) game.update(100);
  assert.equal(game.snapshot().phase, 'answering');
  solve();
  assert.equal(game.snapshot().lastSolved.stars, 2);
  assert.equal(game.snapshot().correct, 1, 'help before the first try still counts as the answer');
});

test('words missed the first time come back at the end (at most four), not as new results', () => {
  const { game, events, solve, slip, finishSolved, answerOf } = newTrace({ seed: 7 });
  const missedWords = [];
  for (let i = 0; i < 12; i++) {
    const s = game.snapshot();
    if (i % 2 === 0) { missedWords.push(answerOf(s)); slip(); }
    solve(); finishSolved();
  }
  let s = game.snapshot();
  assert.equal(s.answered, 12); assert.equal(s.incorrect, 6);
  assert.equal(s.total, 12 + R.reviewMax);
  assert.equal(s.review, true);
  for (let k = 0; k < R.reviewMax; k++) {
    s = game.snapshot();
    assert.equal(s.review, true);
    assert.equal(answerOf(s), missedWords[k]);
    assert.match(s.problem.problemId, /:review:/);
    solve(); finishSolved();
  }
  s = game.snapshot();
  assert.equal(s.phase, 'completed');
  assert.equal(s.result.answered, 12); assert.equal(s.result.reviewed, R.reviewMax); assert.equal(s.result.reviewCorrect, R.reviewMax);
  const ids = events.filter(e => ['correct', 'incorrect', 'passed', 'retry'].includes(e.type)).map(e => e.problemId);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(events.filter(e => e.type === 'correct' || e.type === 'incorrect').length, 12, 'only the first round records results');
  assert.equal(events.at(-1).type, 'sessionComplete');
});

test('every mode and pace to the end, with a review round when something was missed', () => {
  for (const mode of ['kanji', 'english', 'math']) {
    for (const pace of ['normal', 'slow']) {
      const { game, events, solve, slip, finishSolved } = newTrace({ mode, pace, seed: mode.length + (pace === 'slow' ? 7 : 0) });
      let guard = 0, slips = 0;
      while (game.snapshot().phase !== 'completed' && guard++ < 60) {
        const s = game.snapshot();
        if (!s.review && s.tries === 0 && s.problemIndex % 4 === 1) { slip(); slips++; }
        solve(); finishSolved();
      }
      const end = game.snapshot();
      assert.equal(end.phase, 'completed', `${mode} ${pace}`);
      assert.equal(end.result.answered, 12); assert.equal(end.result.correct, 12 - slips); assert.equal(end.result.reviewed, slips);
      assert.ok(['correct', 'passed'].includes(events.at(-2).type));
    }
  }
});

test('commands are refused while paused, with a stale attempt, or from another session', () => {
  const { game, sessionId, answerOf } = newTrace();
  const s = game.snapshot(), path = findPath(s.tiles, answerOf(s));
  const send = payload => game.dispatch({ type: 'trace', payload: { sessionId, attemptId: s.attemptId, cells: path, ...payload } });
  assert.equal(send({ sessionId: 'x' }), false);
  assert.equal(send({ attemptId: 'stale' }), false);
  assert.equal(send({ cells: 'abc' }), false);
  game.setPaused(true);
  assert.equal(send({}), false);
  game.setPaused(false);
  assert.equal(send({}), true);
  game.exit();
  assert.equal(game.snapshot().aborted, true);
  assert.equal(createTraceGame({ sessionId: 's', content: null }).enter(), false);
});
