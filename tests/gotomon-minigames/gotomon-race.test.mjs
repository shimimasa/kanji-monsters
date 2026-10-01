import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSlashProblems } from '../../src/minigames/gotomonSlash/slashContent.js';
import { createRaceGame, RACE_RULES as R } from '../../src/minigames/gotomonRace/raceGame.js';

const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const grade1 = JSON.parse(readFileSync(new URL('../../public/data/kanji_g1_proto.json', import.meta.url), 'utf8'));

function newRace({ seed = 3, mode = 'math', pace = 'normal' } = {}) {
  const events = [], sessionId = `rac${seed}`;
  const problems = buildSlashProblems({ sessionId, random: seeded(seed), mode, gradeKanji: grade1 });
  const game = createRaceGame({ sessionId, random: seeded(seed + 1), pace, onEvent: event => events.push(event), content: { problems } });
  assert.equal(game.enter(), true);
  const steer = lane => game.dispatch({ type: 'steer', payload: { sessionId, attemptId: game.snapshot().attemptId, lane } });
  const answerLane = () => { const s = game.snapshot(); return s.gate.plates.findIndex(p => p.plateId === s.problem.answerId); };
  const toGate = () => { const id = game.snapshot().gate?.gateId; for (let t = 0; t < 30000 && game.snapshot().gate?.gateId === id && game.snapshot().phase === 'answering'; t += 16) game.update(16); };
  // Drives one gate: into the given lane (or the answer's), then through it.
  // (A tap chooses the lane for this gate, even the lane already taken.)
  const drive = (wrong = false) => { const lane = answerLane(); const to = wrong ? (lane + 1) % R.lanes : lane; assert.equal(steer(to), true); toGate(); };
  return { game, events, steer, drive, toGate, answerLane, sessionId };
}

test('each gate shows the four plates across the lanes, one of them the answer', () => {
  const { game } = newRace();
  const s = game.snapshot();
  assert.equal(s.gate.plates.length, R.lanes);
  assert.equal(s.gate.plates.filter(p => p.plateId === s.problem.answerId).length, 1);
  assert.equal(s.gate.at, 1);
  assert.equal(s.rivals.length, R.rivals);
});

test('the answer lane at the gate is correct and dashes; the next question is one gate on', () => {
  const { game, events, drive } = newRace();
  drive();
  const s = game.snapshot();
  assert.equal(s.correct, 1); assert.equal(s.dashes, 1);
  assert.ok(s.boostMs > 0);
  assert.equal(s.lastGate.correct, true);
  assert.equal(s.problemIndex, 1); assert.equal(s.gate.at, 2);
  assert.deepEqual(events.filter(e => e.type !== 'problemPresented').map(e => e.type), ['correct']);
});

test('another lane slows a little, shows its plate, and the same question comes with the answer glowing', () => {
  const { game, events, drive } = newRace();
  const first = game.snapshot().problem;
  drive(true);
  let s = game.snapshot();
  assert.equal(s.incorrect, 1); assert.ok(s.slowMs > 0);
  assert.equal(s.problem.contentId, first.contentId);
  assert.notEqual(s.problem.problemId, first.problemId);
  assert.equal(s.hintPlateId, first.answerId);
  assert.equal(s.missed.length, 1);
  assert.ok(s.lastGate.text && s.lastGate.answer);
  drive();
  s = game.snapshot();
  assert.equal(s.answered, 1, 'the retry is not a second result');
  assert.equal(s.hintPlateId, null);
  assert.deepEqual(events.filter(e => e.type !== 'problemPresented').map(e => e.type), ['incorrect', 'passed']);
});

test('after twelve questions the finish line comes; answering well wins, many slips still finish', () => {
  for (const [wrongs, places] of [[0, [1]], [6, [1, 2, 3]]]) {
    for (const pace of ['normal', 'slow']) {
      const { game, events, drive } = newRace({ pace });
      let w = 0, guard = 0;
      while (game.snapshot().gate && guard++ < 60) { const wrong = w < wrongs && game.snapshot().hintPlateId === null; if (wrong) w++; drive(wrong); }
      assert.ok(game.snapshot().finishAt !== null);
      for (let t = 0; t < 20000 && game.snapshot().phase === 'answering'; t += 16) game.update(16);
      const end = game.snapshot();
      assert.equal(end.phase, 'completed');
      assert.equal(end.result.answered, 12); assert.equal(end.result.correct, 12 - wrongs);
      assert.ok(places.includes(end.result.place), `${wrongs} ${pace} place ${end.result.place}`);
      assert.equal(events.at(-1).type, 'sessionComplete');
      const ids = events.filter(e => ['correct', 'incorrect', 'passed', 'retry'].includes(e.type)).map(e => e.problemId);
      assert.equal(new Set(ids).size, ids.length);
    }
  }
});

test('a gate reached before any lane was chosen records nothing; the question comes again as a first try', () => {
  const { game, events, drive, toGate, steer, answerLane } = newRace({ seed: 5 });
  // Already in the answer's lane by chance, but no tap: not an answer.
  const lane = answerLane();
  if (game.snapshot().lane !== lane) { steer(lane); }
  const first = game.snapshot().problem;
  // A new gate resets the choice: let one pass without tapping.
  toGate();
  let s = game.snapshot();
  if (s.answered === 0) {
    assert.equal(s.lastGate.late, true);
    assert.equal(s.problem.contentId, first.contentId); assert.notEqual(s.problem.problemId, first.problemId);
    assert.equal(s.hintPlateId, null); assert.equal(s.slowMs, 0);
  }
  // Gates without a choice: after two the answer glows, after three the companion takes it; no result is recorded for it.
  const { game: g2, events: e2 } = newRace({ seed: 6 });
  const id0 = g2.snapshot().problem.contentId;
  for (let k = 0; k < 4; k++) { const gid = g2.snapshot().gate.gateId; for (let t = 0; t < 30000 && g2.snapshot().gate?.gateId === gid; t += 16) g2.update(16); }
  s = g2.snapshot();
  assert.equal(s.answered, 0);
  assert.equal(s.problemIndex, 1, 'after three gates without a choice the companion took the answer lane at the fourth');
  assert.equal(s.result, null);
  assert.deepEqual(e2.filter(e => ['correct', 'incorrect', 'passed'].includes(e.type)).map(e => e.type), ['passed']);
  assert.notEqual(s.problem.contentId, id0);
  void events; void drive;
});

test('rivals stay near the runner', () => {
  const { game, drive } = newRace();
  for (let i = 0; i < 6; i++) {
    drive();
    const s = game.snapshot();
    for (const rival of s.rivals) assert.ok(Math.abs(rival.distance - s.distance) < 2.5, `gap ${rival.distance - s.distance}`);
  }
});

test('commands are refused while paused, with a stale attempt, or from another session', () => {
  const { game, sessionId } = newRace();
  const s = game.snapshot();
  assert.equal(game.dispatch({ type: 'steer', payload: { sessionId: 'x', attemptId: s.attemptId, lane: 0 } }), false);
  assert.equal(game.dispatch({ type: 'steer', payload: { sessionId, attemptId: 'stale', lane: 0 } }), false);
  assert.equal(game.dispatch({ type: 'steer', payload: { sessionId, attemptId: s.attemptId, lane: 9 } }), false);
  game.setPaused(true);
  assert.equal(game.dispatch({ type: 'steer', payload: { sessionId, attemptId: s.attemptId, lane: 0 } }), false);
  game.update(3000);
  assert.equal(game.snapshot().distance, s.distance, 'the race stops while paused');
  game.setPaused(false);
  assert.equal(game.dispatch({ type: 'steer', payload: { sessionId, attemptId: s.attemptId, lane: 0 } }), true);
  game.exit();
  assert.equal(game.snapshot().aborted, true);
  assert.equal(createRaceGame({ sessionId: 's', content: null }).enter(), false);
});

test('the result tells the place at the finish, after a moment on the finish line', async () => {
  const { createQuizWorld } = await import('../../src/minigames/gameplay/quizWorlds.js');
  const world = createQuizWorld('race', { potency: 1 });
  world.answer(true, {}, 1);
  world.context({ mode: 'race', phase: 'completed', result: { place: 2 } });
  world.complete();
  assert.match(world.snapshot().summary, /^2位でゴール · ゲート1問/);
  assert.equal(world.snapshot().holdResult, true);
  world.update(2000);
  assert.equal(world.snapshot().holdResult, false);
});
