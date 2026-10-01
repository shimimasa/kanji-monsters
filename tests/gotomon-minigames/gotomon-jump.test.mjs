import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSlashProblems } from '../../src/minigames/gotomonSlash/slashContent.js';
import { createJumpGame, JUMP_RULES as R } from '../../src/minigames/gotomonJump/jumpGame.js';

const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const grade1 = JSON.parse(readFileSync(new URL('../../public/data/kanji_g1_proto.json', import.meta.url), 'utf8'));

function newJump({ seed = 3, mode = 'math', pace = 'normal' } = {}) {
  const events = [], sessionId = `jmp${seed}`;
  const problems = buildSlashProblems({ sessionId, random: seeded(seed), mode, gradeKanji: grade1 });
  const game = createJumpGame({ sessionId, random: seeded(seed + 1), pace, onEvent: event => events.push(event), content: { problems } });
  assert.equal(game.enter(), true);
  const g = 2 * R.jump / R.apexSec[pace] ** 2;
  const steerTo = toX => game.dispatch({ type: 'move', payload: { sessionId, attemptId: game.snapshot().attemptId, dir: 0, toX } });
  const choose = plateId => game.dispatch({ type: 'choose', payload: { sessionId, attemptId: game.snapshot().attemptId, plateId } });
  // A climbing player: aims for the highest ledge in reach, and for a cloud once the row is in reach.
  // pick(state) names the cloud's plate (default: the answer).
  const tick = (pick = s => s.problem.answerId) => {
    const s = game.snapshot();
    const apex = s.vy > 0 ? s.y + s.vy * s.vy / (2 * g) : s.y;
    let toX = null;
    // The child taps the cloud (once the row is in sight) and the companion glides onto it.
    if (s.row && s.problem && s.chosenPlateId !== pick(s) && !s.row.plates.find(p => p.plateId === pick(s))?.gone && apex >= s.row.y - 0.4) choose(pick(s));
    if (s.row && s.problem && apex >= s.row.y + 0.02) toX = s.row.plates.find(p => p.plateId === pick(s))?.x ?? null;
    else {
      const ok = s.ledges.filter(l => !l.locked && l.y <= apex - 0.02 && l.y > s.camera + 0.01).sort((a, b) => b.y - a.y);
      if (ok[0]) toX = ok[0].x;
    }
    steerTo(toX); game.update(16);
  };
  const untilLanding = (pick, limit = 60000) => {
    const n = game.snapshot().lastLanding?.landing ?? 0;
    for (let t = 0; t < limit && (game.snapshot().lastLanding?.landing ?? 0) === n && game.snapshot().phase === 'answering'; t += 16) tick(pick);
    return game.snapshot().lastLanding;
  };
  return { game, events, sessionId, tick, untilLanding, steerTo, choose };
}

test('each row has four clouds, one of them the answer, high above the start', () => {
  const { game } = newJump();
  const s = game.snapshot();
  assert.equal(s.row.plates.length, R.clouds);
  assert.equal(s.row.plates.filter(p => p.plateId === s.problem.answerId).length, 1);
  assert.ok(s.row.y > 0.8);
  assert.ok(s.ledges.length > 3);
  assert.equal(s.phase, 'answering');
});

test('the answer cloud sends the companion high up to the next row; the next question comes', () => {
  const { game, events, untilLanding } = newJump();
  const first = game.snapshot().row;
  const landing = untilLanding();
  assert.equal(landing.correct, true);
  const s = game.snapshot();
  assert.equal(s.correct, 1); assert.equal(s.superJumps, 1);
  assert.equal(s.problemIndex, 1);
  assert.ok(s.row.y > first.y + 0.8);
  assert.ok(s.vy > 0);
  assert.deepEqual(events.filter(e => e.type !== 'problemPresented').map(e => e.type), ['correct']);
});

test('another cloud puffs away, shows its plate, and the answer cloud glows; the retry is no second result', () => {
  const { game, events, untilLanding } = newJump();
  const first = game.snapshot().problem;
  const wrong = untilLanding(s => s.row.plates.find(p => p.plateId !== s.problem.answerId && !p.gone).plateId);
  assert.equal(wrong.correct, false);
  let s = game.snapshot();
  assert.equal(s.incorrect, 1);
  assert.equal(s.hintPlateId, first.answerId);
  assert.equal(s.row.plates.filter(p => p.gone).length, 1);
  assert.equal(s.problem.contentId, first.contentId);
  assert.notEqual(s.problem.problemId, first.problemId);
  assert.equal(s.missed.length, 1);
  assert.ok(wrong.text && wrong.answer);
  untilLanding();
  s = game.snapshot();
  assert.equal(s.answered, 1, 'the retry is not a second result');
  assert.equal(s.hintPlateId, null);
  assert.deepEqual(events.filter(e => e.type !== 'problemPresented').map(e => e.type), ['incorrect', 'passed']);
});

test('nothing above an unanswered row can be reached', () => {
  const { game } = newJump();
  // Bouncing without steering for a while: the companion stays under the row's ceiling, the next part stays locked.
  for (let t = 0; t < 20000 && game.snapshot().answered === 0; t += 16) {
    game.update(16);
    const s = game.snapshot();
    if (s.answered === 0) assert.ok(s.y <= s.row.y + R.above, `y ${s.y} row ${s.row.y}`);
    for (const ledge of s.ledges) if (ledge.y > s.row.y) assert.equal(ledge.locked, true);
  }
});

test('twelve rows to the goal in every mode and pace, with slips on the way; every landing its own problem id', () => {
  for (const mode of ['kanji', 'english', 'math']) {
    for (const pace of ['normal', 'slow']) {
      const { game, events, untilLanding } = newJump({ mode, pace, seed: mode.length + (pace === 'slow' ? 7 : 0) });
      let guard = 0, slips = 0;
      while (game.snapshot().problem && guard++ < 60) {
        const slip = slips < 4 && game.snapshot().hintPlateId === null && game.snapshot().problemIndex % 3 === 0;
        if (slip) slips++;
        untilLanding(slip ? s => s.row.plates.find(p => p.plateId !== s.problem.answerId && !p.gone).plateId : undefined);
      }
      for (let t = 0; t < 10000 && game.snapshot().phase === 'answering'; t += 16) game.update(16);
      const end = game.snapshot();
      assert.equal(end.phase, 'completed', `${mode} ${pace}`);
      assert.equal(end.result.answered, 12); assert.equal(end.result.correct, 12 - slips); assert.equal(end.result.superJumps, 12);
      assert.equal(events.at(-1).type, 'sessionComplete');
      const ids = events.filter(e => ['correct', 'incorrect', 'passed', 'retry'].includes(e.type)).map(e => e.problemId);
      assert.equal(new Set(ids).size, ids.length);
      // The last right answer is told before the play ends.
      assert.ok(['correct', 'passed'].includes(events.at(-2).type));
    }
  }
});

test('a child who never steers nor taps still reaches the goal, but no landing of theirs is recorded as an answer', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const { game, events } = newJump({ seed });
    for (let t = 0; t < 15 * 60000 && game.snapshot().phase === 'answering'; t += 16) game.update(16);
    const end = game.snapshot();
    assert.equal(end.phase, 'completed', `seed ${seed}`);
    // Big bounces bring the companion to each row; with no choice the answer glows, then the companion chooses it.
    assert.equal(end.result.answered, 0); assert.equal(end.result.unanswered, 12);
    assert.equal(events.filter(e => e.type === 'correct' || e.type === 'incorrect').length, 0);
    assert.ok(end.activeElapsedMs < 9 * 60000, `seed ${seed} took ${end.activeElapsedMs}`);
  }
});

test('landing on a cloud that was not chosen is just a bounce; the choice may change until the landing', () => {
  const { game, events, choose } = newJump({ seed: 4 });
  // Steer under a wrong cloud without choosing anything: no landing is ever an answer.
  for (let t = 0; t < 20000; t += 16) {
    const s = game.snapshot();
    const wrong = s.row.plates.find(p => p.plateId !== s.problem.answerId);
    game.dispatch({ type: 'move', payload: { sessionId: s.sessionId, attemptId: s.attemptId, dir: 0, toX: wrong.x } });
    game.update(16);
    if (s.revealAfter) break;
  }
  assert.equal(events.filter(e => ['correct', 'incorrect'].includes(e.type)).length, 0);
  assert.equal(game.snapshot().lastLanding, null);
  const s = game.snapshot();
  const [a, b] = s.row.plates;
  assert.equal(choose(a.plateId), true); assert.equal(game.snapshot().chosenPlateId, a.plateId);
  assert.equal(choose(b.plateId), true); assert.equal(game.snapshot().chosenPlateId, b.plateId);
  assert.equal(choose('nope'), false);
});

test('commands are refused while paused, with a stale attempt, or from another session', () => {
  const { game, sessionId } = newJump();
  const s = game.snapshot();
  const move = payload => game.dispatch({ type: 'move', payload: { sessionId, attemptId: s.attemptId, dir: 0, toX: null, ...payload } });
  assert.equal(move({ sessionId: 'x', dir: 1 }), false);
  assert.equal(move({ attemptId: 'stale', dir: 1 }), false);
  assert.equal(move({ dir: 2 }), false);
  assert.equal(move({ toX: 1.5 }), false);
  game.setPaused(true);
  assert.equal(move({ dir: 1 }), false);
  game.setPaused(false);
  assert.equal(move({ dir: 1 }), true);
  const x = game.snapshot().x; game.update(50);
  assert.ok(game.snapshot().x !== x);
  game.exit();
  assert.equal(game.snapshot().aborted, true);
  assert.equal(createJumpGame({ sessionId: 's', content: null }).enter(), false);
});
