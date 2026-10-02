import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildDrumQuestions } from '../../src/minigames/gotomonDrum/drumContent.js';
import { createDrumGame, DRUM_RULES as R } from '../../src/minigames/gotomonDrum/drumGame.js';

const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const grade1 = JSON.parse(readFileSync(new URL('../../public/data/kanji_g1_proto.json', import.meta.url), 'utf8'));

function newDrum({ seed = 3, mode = 'math', pace = 'normal' } = {}) {
  const events = [], sessionId = `drm${seed}`;
  const questions = buildDrumQuestions({ sessionId, random: seeded(seed), mode, gradeKanji: grade1 });
  const game = createDrumGame({ sessionId, random: seeded(seed + 1), pace, onEvent: event => events.push(event), content: { questions } });
  assert.equal(game.enter(), true);
  const hit = drum => game.dispatch({ type: 'hit', payload: { sessionId, attemptId: game.snapshot().attemptId, drum } });
  // Runs the song until a coming note of the given kind sits on its beat.
  const until = pick => { for (let t = 0; t < 30000; t += 10) { const s = game.snapshot(); const n = s.notes.find(item => item.state === 'coming' && pick(item) && Math.abs(item.at - s.songMs) <= 10); if (n) return n; game.update(10); } return null; };
  return { game, events, questions, hit, until, sessionId };
}
const rightDrum = (questions, note) => note.kind === 'quiz' ? (questions[note.index].truth ? 'don' : 'ka') : note.kind;

test('each mode makes twelve そう？ちがう？ questions, half of them true', () => {
  for (const mode of ['kanji', 'english', 'math']) {
    for (let seed = 1; seed <= 6; seed++) {
      const questions = buildDrumQuestions({ sessionId: 's', random: seeded(seed), mode, gradeKanji: grade1 });
      assert.equal(questions.length, 12, mode);
      assert.equal(questions.filter(item => item.truth).length, 6, mode);
      for (const item of questions) {
        assert.match(item.statement, /？$/);
        assert.ok(item.statement.includes(item.shown), item.statement);
        assert.equal(item.truth, item.shown === item.answer, item.statement);
        assert.ok(item.explain);
        if (mode === 'math') assert.equal(eval(item.statement.replace('？', '').replace('−', '-').replace('=', '===').replace('×', '*')), item.truth, item.statement);
      }
    }
  }
});

test('notes arrive on the beat: a question note, then two plain ones, every 8 beats', () => {
  const { game } = newDrum();
  const beat = R.beatMs.normal, notes = game.snapshot().notes.filter(n => n.kind === 'quiz');
  assert.equal(notes.length, 12);
  notes.forEach(n => assert.equal(n.at % beat, 0));
  for (let i = 1; i < notes.length; i++) assert.equal(notes[i].at - notes[i - 1].at, R.blockBeats * beat);
  assert.ok(notes[0].at >= R.travelBeats * beat, 'the first note starts off screen');
  const slow = newDrum({ pace: 'slow' }).game.snapshot();
  assert.equal(slow.beatMs, R.beatMs.slow);
});

test('the right drum on a question note is correct; a hit off the beat does nothing', () => {
  const { game, events, questions, hit, until } = newDrum();
  assert.equal(hit('don'), false, 'nothing near the drum yet');
  const note = until(n => n.kind === 'quiz');
  const problemId = game.snapshot().problem.problemId;
  assert.equal(hit(rightDrum(questions, note)), true);
  const s = game.snapshot();
  assert.equal(s.correct, 1); assert.equal(s.joined, 1);
  assert.equal(s.lastHit.right, true); assert.equal(s.lastHit.grade, 'great');
  assert.equal(events.find(e => e.type === 'correct').problemId, problemId);
  assert.notEqual(s.problem.problemId, problemId, 'the next question is on screen');
});

test('a wrong answer comes round once more; the retry is not a second learning result', () => {
  const { game, events, questions, hit, until } = newDrum();
  const note = until(n => n.kind === 'quiz');
  assert.equal(hit(rightDrum(questions, note) === 'don' ? 'ka' : 'don'), true);
  let s = game.snapshot();
  assert.equal(s.incorrect, 1); assert.equal(s.missed.length, 1);
  // The question comes back to build (here 算数: the whole number sentence).
  assert.equal(s.missed[0].build, questions[note.index].build); assert.ok(s.missed[0].build.answer.endsWith(`=${questions[note.index].answer}`));
  assert.equal(s.lastHit.explain, questions[note.index].explain);
  const again = s.notes.filter(n => n.kind === 'quiz' && n.index === note.index && n.state === 'coming');
  assert.equal(again.length, 1, 'it is queued again');
  // Play until the same question comes round, and answer it right.
  for (;;) {
    const n = until(item => item.kind === 'quiz'); assert.ok(n);
    hit(rightDrum(questions, n));
    if (n.index === note.index) break;
  }
  s = game.snapshot();
  assert.equal(s.answered, 12 - s.notes.filter(n => n.kind === 'quiz' && n.state === 'coming').length);
  assert.ok(events.some(e => e.type === 'fixed'));
  assert.equal(events.filter(e => ['correct', 'incorrect'].includes(e.type)).length, s.answered);
  // Every question note is its own problem id.
  const ids = events.filter(e => ['correct', 'incorrect', 'fixed', 'retry'].includes(e.type)).map(e => e.problemId);
  assert.equal(new Set(ids).size, ids.length);
});

test('a question note that slips by comes round again, and the song ends after every question is met', () => {
  const { game, events, questions, hit, until } = newDrum({ mode: 'kanji' });
  for (let t = 0; t < 12000; t += 16) game.update(16);
  const passed = game.snapshot();
  assert.equal(passed.answered, 0);
  assert.equal(passed.resolved, 0);
  let guard = 0;
  while (game.snapshot().phase === 'answering' && guard++ < 200) {
    const n = until(() => true);
    if (!n) { game.update(100); continue; }
    hit(rightDrum(questions, n)); game.update(10);
  }
  const end = game.snapshot();
  assert.equal(end.phase, 'completed');
  assert.equal(end.result.answered, 12); assert.equal(end.result.correct, 12);
  assert.equal(events.at(-1).type, 'sessionComplete');
  assert.equal(events.filter(e => e.type === 'correct').length, 12);
  assert.equal(events.filter(e => e.type === 'problemPresented').length, 12);
});

test('commands are refused while paused, with a stale attempt, or from another session', () => {
  const { game, sessionId, until } = newDrum();
  until(n => n.kind === 'quiz');
  const s = game.snapshot();
  assert.equal(game.dispatch({ type: 'hit', payload: { sessionId: 'x', attemptId: s.attemptId, drum: 'don' } }), false);
  assert.equal(game.dispatch({ type: 'hit', payload: { sessionId, attemptId: 'stale', drum: 'don' } }), false);
  assert.equal(game.dispatch({ type: 'hit', payload: { sessionId, attemptId: s.attemptId, drum: 'bell' } }), false);
  game.setPaused(true);
  assert.equal(game.dispatch({ type: 'hit', payload: { sessionId, attemptId: s.attemptId, drum: 'don' } }), false);
  game.update(5000);
  assert.equal(game.snapshot().songMs, s.songMs, 'the song stops while paused');
  game.setPaused(false);
  assert.equal(game.dispatch({ type: 'hit', payload: { sessionId, attemptId: s.attemptId, drum: 'don' } }), true);
  game.exit();
  assert.equal(game.snapshot().aborted, true);
  assert.equal(createDrumGame({ sessionId: 's', content: null }).enter(), false);
});

test('the last dance stays on screen for a moment before the results', async () => {
  const { createQuizWorld } = await import('../../src/minigames/gameplay/quizWorlds.js');
  const world = createQuizWorld('drum', { potency: 1 });
  world.complete();
  assert.equal(world.snapshot().holdResult, true);
  world.update(2000);
  assert.equal(world.snapshot().holdResult, false);
});
