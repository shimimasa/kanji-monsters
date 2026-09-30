import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSlashProblems } from '../../src/minigames/gotomonSlash/slashContent.js';
import { createSeekGame, SEEK_RULES as R } from '../../src/minigames/gotomonSeek/seekGame.js';

const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const grade1 = JSON.parse(readFileSync(new URL('../../public/data/kanji_g1_proto.json', import.meta.url), 'utf8'));

function newSeek({ seed = 3, mode = 'kanji' } = {}) {
  const events = [], sessionId = `sek${seed}`;
  const problems = buildSlashProblems({ sessionId, random: seeded(seed), mode, gradeKanji: grade1 });
  const game = createSeekGame({ sessionId, random: seeded(seed + 1), onEvent: event => events.push(event), content: { problems } });
  assert.equal(game.enter(), true);
  const tap = hider => game.dispatch({ type: 'tap', payload: { sessionId, attemptId: game.snapshot().attemptId, hiderId: hider.hiderId } });
  const next = () => game.dispatch({ type: 'next', payload: { sessionId } });
  const answerOf = () => { const s = game.snapshot(); return s.hiders.find(h => h.plateId === s.problem.answerId); };
  const other = () => { const s = game.snapshot(); return s.hiders.find(h => h.plateId !== s.problem.answerId && h.state === 'hiding'); };
  return { game, events, problems, tap, next, answerOf, other, sessionId };
}

test('six Gotomon hide in different places; exactly one holds the answer and no plate repeats', () => {
  for (const mode of ['kanji', 'english', 'math']) {
    for (let seed = 1; seed <= 8; seed++) {
      const { game, problems, tap, next, answerOf } = newSeek({ seed, mode });
      for (let q = 0; q < problems.length; q++) {
        const s = game.snapshot();
        assert.equal(s.hiders.length, R.hiders, mode);
        assert.equal(new Set(s.hiders.map(h => h.spot)).size, R.hiders, 'one Gotomon per spot');
        assert.equal(new Set(s.hiders.map(h => h.text)).size, R.hiders, `${mode} plates are all different`);
        assert.equal(s.hiders.filter(h => h.plateId === s.problem.answerId).length, 1, mode);
        if (mode === 'kanji') {
          const kanji = s.problem.prompt.match(/「(.+?)」/)[1];
          const extra = s.hiders.filter(h => !problems[q].plates.some(p => p.plateId === h.plateId));
          extra.forEach(h => assert.ok(!(h.note ?? '').includes(kanji), `a decoy is not a reading of ${kanji}`));
        }
        tap(answerOf()); next();
      }
      assert.equal(game.snapshot().phase, 'completed');
    }
  }
});

test('the answer is found on the first tap; a wrong one says its plate and the answer sparkles', () => {
  const { game, events, tap, next, answerOf, other } = newSeek();
  const wrong = other();
  assert.equal(tap(wrong), true);
  let s = game.snapshot();
  assert.equal(s.incorrect, 1); assert.equal(s.hintHiderId, answerOf().hiderId);
  assert.equal(s.lastTap.text, wrong.text); assert.equal(s.hiders.find(h => h.hiderId === wrong.hiderId).state, 'wrong');
  assert.equal(tap(wrong), false, 'a wrong one cannot be tapped again');
  assert.equal(tap(answerOf()), true);
  s = game.snapshot();
  assert.equal(s.phase, 'feedback'); assert.equal(s.found, 1); assert.equal(s.answered, 1);
  const before = new Set(s.hiders.map(h => h.hiderId));
  next();
  s = game.snapshot();
  assert.equal(s.problemIndex, 1); assert.equal(s.hintHiderId, null);
  assert.ok(s.hiders.every(h => h.state === 'hiding' && !before.has(h.hiderId)), 'everyone hides again');
  assert.deepEqual(events.filter(e => !['problemPresented'].includes(e.type)).map(e => e.type), ['incorrect', 'found']);
  const ids = events.filter(e => ['incorrect', 'found'].includes(e.type)).map(e => e.problemId);
  assert.equal(new Set(ids).size, ids.length);
});

test('twelve questions, then the play ends', () => {
  const { game, events, tap, next, answerOf } = newSeek({ mode: 'math' });
  for (let q = 0; q < 12; q++) { tap(answerOf()); next(); }
  const end = game.snapshot();
  assert.equal(end.phase, 'completed');
  assert.equal(end.result.found, 12); assert.equal(end.result.correct, 12);
  assert.equal(events.at(-1).type, 'sessionComplete');
});

test('commands are refused while paused, with a stale attempt, or from another session', () => {
  const { game, sessionId, answerOf } = newSeek();
  const s = game.snapshot(), hiderId = answerOf().hiderId;
  const send = payload => game.dispatch({ type: 'tap', payload: { sessionId, attemptId: s.attemptId, hiderId, ...payload } });
  assert.equal(send({ sessionId: 'x' }), false);
  assert.equal(send({ attemptId: 'stale' }), false);
  assert.equal(send({ hiderId: 'nobody' }), false);
  game.setPaused(true);
  assert.equal(send({}), false);
  game.setPaused(false);
  assert.equal(send({}), true);
  game.exit();
  assert.equal(game.snapshot().aborted, true);
  assert.equal(createSeekGame({ sessionId: 's', content: null }).enter(), false);
});
