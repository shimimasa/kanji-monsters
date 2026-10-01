import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSlashProblems } from '../../src/minigames/gotomonSlash/slashContent.js';
import { createGolfGame, buildGolfHoles, stepBall, launch, tracePath, GOLF_RULES as R } from '../../src/minigames/gotomonGolf/golfGame.js';

const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const grade1 = JSON.parse(readFileSync(new URL('../../public/data/kanji_g1_proto.json', import.meta.url), 'utf8'));

// Every shot from (x, y) on a coarse grid: the first one that drops into the open cup.
function findShot(hole, x, y, timeMs) {
  for (let a = 0; a < 180; a++) for (let p = 0.1; p <= 1; p += 0.05) {
    const angle = a / 180 * 2 * Math.PI, ball = { x, y, ...launch(angle, p) };
    let t = timeMs;
    for (let i = 0; i < 3000; i++) {
      if (stepBall(hole, ball, 0.008, t += 8)) return { angle, power: p };
      if (Math.hypot(ball.vx, ball.vy) <= R.stopSpeed) break;
    }
  }
  return null;
}

function newGolf({ seed = 3, mode = 'math', pace = 'normal' } = {}) {
  const events = [], sessionId = `golf${seed}`;
  const problems = buildSlashProblems({ sessionId, random: seeded(seed), mode, gradeKanji: grade1 });
  const game = createGolfGame({ sessionId, random: seeded(seed + 1), pace, onEvent: event => events.push(event), content: { problems } });
  assert.equal(game.enter(), true);
  // The same holes as the Core's, to plan shots with the same physics.
  const holes = buildGolfHoles(problems, seeded(seed + 1));
  const choose = plateId => game.dispatch({ type: 'choose', payload: { sessionId, attemptId: game.snapshot().attemptId, plateId } });
  const shoot = (angle, power) => game.dispatch({ type: 'shoot', payload: { sessionId, attemptId: game.snapshot().attemptId, angle, power } });
  const rollOut = () => { for (let t = 0; t < 20000 && game.snapshot().phase === 'rolling'; t += 16) game.update(16); };
  // Chooses a flag (default: the answer) and putts until the ball is in its cup.
  const playHole = (pick = s => s.problem.answerId) => {
    const s = game.snapshot();
    assert.equal(choose(pick(s)), true);
    const n = s.lastCup?.cup ?? 0;
    for (let k = 0; k < 20 && (game.snapshot().lastCup?.cup ?? 0) === n; k++) {
      const now = game.snapshot(), h = holes[now.problemIndex];
      h.cups.forEach(c => { c.open = now.hole.cups.find(q => q.cupId === c.cupId).open; });
      const shot = findShot(h, now.ball.x, now.ball.y, now.worldMs);
      assert.ok(shot, 'some shot reaches the chosen cup');
      assert.equal(shoot(shot.angle, shot.power), true);
      rollOut();
    }
    return game.snapshot().lastCup;
  };
  const finishSunk = () => { for (let t = 0; t < 5000 && game.snapshot().phase === 'sunk'; t += 16) game.update(16); };
  return { game, events, sessionId, holes, choose, shoot, rollOut, playHole, finishSunk };
}

test('a hole: four flags, one the answer; the ball waits on the tee until a flag is chosen', () => {
  const { game, shoot } = newGolf();
  const s = game.snapshot();
  assert.equal(s.phase, 'choosing');
  assert.equal(s.hole.cups.length, 4);
  assert.equal(s.hole.cups.filter(c => c.plateId === s.problem.answerId).length, 1);
  assert.deepEqual([s.ball.x, s.ball.y], [...R.tee]);
  assert.ok(s.hole.cups.every(c => !c.open));
  assert.equal(shoot(0, 0.5), false, 'no shot before a flag is chosen');
});

test('choosing a flag opens only its cup; the choice can change until the first shot', () => {
  const { game, choose, shoot, rollOut } = newGolf();
  const cups = game.snapshot().hole.cups;
  assert.equal(choose(cups[0].plateId), true);
  assert.deepEqual(game.snapshot().hole.cups.map(c => c.open), [true, false, false, false]);
  assert.equal(choose(cups[2].plateId), true);
  assert.deepEqual(game.snapshot().hole.cups.map(c => c.open), [false, false, true, false]);
  assert.equal(game.snapshot().chosenPlateId, cups[2].plateId);
  // A soft tap that stops on the course: now the choice stays.
  assert.equal(shoot(Math.PI, 0.1), true);
  rollOut();
  assert.equal(game.snapshot().phase, 'aiming');
  assert.equal(game.snapshot().canChoose, false);
  assert.equal(choose(cups[1].plateId), false);
});

test('a ball rolling over a shut cup is never an answer (only the chosen cup takes it)', () => {
  const { holes } = newGolf();
  for (const hole of holes) {
    for (const target of hole.cups) {
      hole.cups.forEach(c => { c.open = c === target; });
      // Slow balls set right on every other cup roll over its lid.
      for (const other of hole.cups.filter(c => c !== target)) {
        const ball = { x: other.x - 0.03, y: other.y, vx: 0.3, vy: 0 };
        for (let i = 0; i < 30; i++) assert.notEqual(stepBall(hole, ball, 0.008, 0), other);
      }
    }
    hole.cups.forEach(c => { c.open = false; });
  }
});

test('every cup of every hole can be reached from the tee, from the first help spot, and from the second', () => {
  const { holes } = newGolf();
  for (const [i, hole] of holes.entries()) {
    for (const cup of hole.cups) {
      hole.cups.forEach(c => { c.open = c === cup; });
      for (const [label, [x, y]] of [['tee', R.tee], ['approach', hole.approach], ['near', cup.near]]) {
        assert.ok(findShot(hole, x, y, 0), `hole ${i} ${hole.name} ${cup.cupId} from ${label}`);
      }
    }
    hole.cups.forEach(c => { c.open = false; });
  }
});

test('the help spots are on open ground (not in a wall or a bumper)', () => {
  const { holes } = newGolf();
  const clear = (hole, [x, y]) => hole.walls.every(([x1, y1, x2, y2]) => Math.hypot(x - Math.max(x1, Math.min(x2, x)), y - Math.max(y1, Math.min(y2, y))) > R.ballR)
    && hole.bumpers.every(([bx, by, r]) => Math.hypot(x - bx, y - by) > r + R.ballR);
  for (const hole of holes) {
    assert.ok(clear(hole, hole.approach), hole.name);
    for (const cup of hole.cups) assert.ok(clear(hole, cup.near), `${hole.name} ${cup.cupId}`);
  }
});

test('the answer cup ends the hole after a moment; the next hole starts on the tee', () => {
  const { game, events, playHole, finishSunk } = newGolf();
  const cup = playHole();
  assert.equal(cup.correct, true);
  assert.equal(game.snapshot().phase, 'sunk');
  assert.equal(game.snapshot().correct, 1);
  finishSunk();
  const s = game.snapshot();
  assert.equal(s.problemIndex, 1); assert.equal(s.phase, 'choosing');
  assert.deepEqual([s.ball.x, s.ball.y], [...R.tee]);
  assert.equal(s.shots, 0);
  assert.deepEqual(events.filter(e => e.type !== 'problemPresented').map(e => e.type), ['correct']);
});

test('another cup tells its plate, stays shut, the answer flag glows; the retry is no second result', () => {
  const { game, events, playHole, choose } = newGolf();
  const first = game.snapshot().problem;
  const wrong = playHole(s => s.hole.cups.find(c => c.plateId !== s.problem.answerId).plateId);
  assert.equal(wrong.correct, false);
  assert.ok(wrong.text && wrong.answer);
  let s = game.snapshot();
  assert.equal(s.phase, 'choosing');
  assert.equal(s.incorrect, 1); assert.equal(s.missed.length, 1);
  assert.equal(s.hintPlateId, first.answerId);
  assert.equal(s.hole.cups.find(c => c.cupId === wrong.cupId).gone, true);
  assert.equal(choose(s.hole.cups.find(c => c.cupId === wrong.cupId).plateId), false, 'a shut cup cannot be chosen again');
  assert.equal(s.problem.contentId, first.contentId);
  assert.notEqual(s.problem.problemId, first.problemId);
  playHole();
  s = game.snapshot();
  assert.equal(s.answered, 1, 'the retry is not a second result');
  assert.equal(s.hintPlateId, null);
  assert.deepEqual(events.filter(e => e.type !== 'problemPresented').map(e => e.type), ['incorrect', 'passed']);
});

test('after four shots without the cup a Gotomon carries the ball nearer: before the cups, then to the cup', () => {
  const { game, holes, choose, shoot, rollOut } = newGolf();
  const answer = game.snapshot().problem.answerId;
  choose(answer);
  const cup = holes[0].cups.find(c => c.plateId === answer);
  for (let k = 0; k < 4; k++) { shoot(Math.PI, 0.05); rollOut(); }
  let s = game.snapshot();
  assert.equal(s.helped, 1); assert.equal(s.lastHelp.level, 1);
  assert.deepEqual([s.ball.x, s.ball.y], holes[0].approach);
  for (let k = 0; k < 4; k++) { shoot(Math.PI, 0.05); rollOut(); }
  s = game.snapshot();
  assert.equal(s.helped, 2); assert.equal(s.lastHelp.level, 2);
  assert.deepEqual([s.ball.x, s.ball.y], cup.near);
  assert.ok(Math.hypot(s.ball.x - cup.x, s.ball.y - cup.y) < 0.2);
  assert.equal(s.shots, 8);
});

test('a walking Gotomon never stands on the waiting ball', () => {
  const { game, holes, choose, shoot, rollOut, playHole, finishSunk } = newGolf();
  for (let i = 0; i < 4; i++) { playHole(); finishSunk(); }
  assert.equal(game.snapshot().hole.name, 'うごくゴトモン');
  // First the ball is putted to a stop in the walking Gotomon's lane.
  choose(game.snapshot().problem.answerId);
  const h = holes[4], [mx, y1, y2, mr] = h.movers[0];
  h.cups.forEach(c => { c.open = game.snapshot().hole.cups.find(q => q.cupId === c.cupId).open; });
  let shot = null;
  for (let k = 0; k < 4000 && !shot; k++) {
    const angle = -0.6 + (k % 40) * 0.03, p = 0.25 + Math.floor(k / 40) * 0.005;
    const s = game.snapshot(), ball = { x: s.ball.x, y: s.ball.y, ...launch(angle, p) };
    let t = s.worldMs, sunk = false;
    while (Math.hypot(ball.vx, ball.vy) > R.stopSpeed) if ((sunk = !!stepBall(h, ball, 0.008, t += 8))) break;
    if (!sunk && Math.abs(ball.x - mx) < mr * 0.5 && ball.y > Math.min(y1, y2) && ball.y < Math.max(y1, y2)) shot = { angle, p };
  }
  assert.ok(shot, 'a putt that stops in the lane');
  shoot(shot.angle, shot.p); rollOut();
  assert.ok(Math.abs(game.snapshot().ball.x - mx) < mr + R.ballR);
  for (let t = 0; t < 8000; t += 16) {
    game.update(16);
    const s = game.snapshot();
    for (const b of s.hole.bumpers) assert.ok(Math.hypot(s.ball.x - b.x, s.ball.y - b.y) >= b.r + R.ballR - 1e-9);
  }
});

test('ゆっくり slows the world (the walking Gotomon too), not the clock', () => {
  const normal = newGolf({ pace: 'normal' }).game, slow = newGolf({ pace: 'slow' }).game;
  for (let t = 0; t < 1000; t += 16) { normal.update(16); slow.update(16); }
  assert.equal(normal.snapshot().activeElapsedMs, slow.snapshot().activeElapsedMs);
  assert.ok(Math.abs(slow.snapshot().worldMs - normal.snapshot().worldMs * 0.7) < 1);
});

test('the aiming guide follows the same rolling as the shot', () => {
  const { game, holes, choose, shoot } = newGolf();
  choose(game.snapshot().problem.answerId);
  const s = game.snapshot();
  const path = tracePath(holes[0], s.ball.x, s.ball.y, -0.3, 0.4, s.worldMs, 10);
  shoot(-0.3, 0.4);
  for (let t = 0; t < 20000 && game.snapshot().phase === 'rolling'; t += 8) game.update(8);
  const end = game.snapshot().ball, last = path.at(-1);
  assert.ok(Math.hypot(end.x - last[0], end.y - last[1]) < 1e-9, `${end.x},${end.y} vs ${last}`);
});

test('twelve holes in every mode and pace, with slips on the way; every cup reached its own problem id', () => {
  for (const mode of ['kanji', 'english', 'math']) {
    for (const pace of ['normal', 'slow']) {
      const { game, events, playHole, finishSunk } = newGolf({ mode, pace, seed: mode.length + (pace === 'slow' ? 7 : 0) });
      let guard = 0, slips = 0;
      while (game.snapshot().phase !== 'completed' && guard++ < 40) {
        const s = game.snapshot();
        const slip = slips < 4 && s.hintPlateId === null && s.problemIndex % 3 === 0;
        if (slip) slips++;
        playHole(slip ? q => q.hole.cups.find(c => c.plateId !== q.problem.answerId).plateId : undefined);
        finishSunk();
      }
      const end = game.snapshot();
      assert.equal(end.phase, 'completed', `${mode} ${pace}`);
      assert.equal(end.result.answered, 12); assert.equal(end.result.correct, 12 - slips); assert.equal(end.result.incorrect, slips);
      assert.ok(end.result.shots >= 12 + slips);
      assert.equal(events.at(-1).type, 'sessionComplete');
      const ids = events.filter(e => ['correct', 'incorrect', 'passed', 'retry'].includes(e.type)).map(e => e.problemId);
      assert.equal(new Set(ids).size, ids.length);
      assert.ok(['correct', 'passed'].includes(events.at(-2).type));
    }
  }
});

test('commands are refused while paused, with a stale attempt, from another session, or out of range', () => {
  const { game, sessionId } = newGolf();
  const s = game.snapshot();
  const send = (type, payload) => game.dispatch({ type, payload: { sessionId, attemptId: s.attemptId, ...payload } });
  const plateId = s.problem.answerId;
  assert.equal(send('choose', { sessionId: 'x', plateId }), false);
  assert.equal(send('choose', { attemptId: 'stale', plateId }), false);
  assert.equal(send('choose', { plateId: 'nope' }), false);
  game.setPaused(true);
  assert.equal(send('choose', { plateId }), false);
  game.setPaused(false);
  assert.equal(send('choose', { plateId }), true);
  assert.equal(send('shoot', { angle: 0, power: 0 }), false);
  assert.equal(send('shoot', { angle: 0, power: 1.5 }), false);
  assert.equal(send('shoot', { angle: NaN, power: 0.5 }), false);
  game.setPaused(true);
  assert.equal(send('shoot', { angle: 0, power: 0.5 }), false);
  game.setPaused(false);
  assert.equal(send('shoot', { angle: 0, power: 0.5 }), true);
  assert.equal(send('shoot', { angle: 0, power: 0.5 }), false, 'not while rolling');
  game.exit();
  assert.equal(game.snapshot().aborted, true);
  assert.equal(createGolfGame({ sessionId: 's', content: null }).enter(), false);
});
