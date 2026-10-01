import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSlashProblems } from '../../src/minigames/gotomonSlash/slashContent.js';
import { createHopGame, HOP_RULES as R } from '../../src/minigames/gotomonHop/hopGame.js';

const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const grade1 = JSON.parse(readFileSync(new URL('../../public/data/kanji_g1_proto.json', import.meta.url), 'utf8'));

// Is (X, r) safe for the next `look` seconds, by the lanes in the snapshot?
function safe(s, X, r, look = 0.4) {
  const lane = s.lanes.find(l => l.row === r);
  if (!lane) return true;
  for (let t = 0; t <= look + 1e-9; t += 0.02) {
    const items = lane.items.map(it => ({ x: it.x + lane.dir * lane.speed * t, len: it.len }));
    if (lane.kind === 'road') { if (items.some(it => X + R.halfW + 0.05 > it.x && X - R.halfW - 0.05 < it.x + it.len)) return false; }
    else {
      const rx = X + lane.dir * lane.speed * t;
      if (!items.some(it => rx >= it.x + 0.25 && rx <= it.x + it.len - 0.25)) return false;
    }
  }
  return true;
}

function newHop({ seed = 3, mode = 'math', pace = 'normal' } = {}) {
  const events = [], sessionId = `hop${seed}`;
  const problems = buildSlashProblems({ sessionId, random: seeded(seed), mode, gradeKanji: grade1 });
  const game = createHopGame({ sessionId, random: seeded(seed + 1), pace, onEvent: event => events.push(event), content: { problems } });
  assert.equal(game.enter(), true);
  const hop = dir => game.dispatch({ type: 'hop', payload: { sessionId, attemptId: game.snapshot().attemptId, dir } });
  const wait = ms => { for (let t = 0; t < ms; t += 16) game.update(16); };
  // A careful player: hops up when it is safe, walks the bank to the home picked (default: the answer) and hops in.
  const crossTo = (pick = s => s.problem.answerId, limit = 120000) => {
    const n = game.snapshot().lastHome?.home ?? 0;
    for (let t = 0; t < limit && (game.snapshot().lastHome?.home ?? 0) === n; t += 16) {
      const s = game.snapshot();
      if (s.phase === 'answering' && !s.hopping) {
        if (s.row === R.bank) {
          const col = s.homes.find(h => h.plateId === pick(s)).col, dx = col - Math.round(s.x);
          hop(dx === 0 ? 'up' : dx > 0 ? 'right' : 'left');
        } else {
          const up = s.lanes.find(l => l.row === s.row + 1)?.kind === 'river' ? s.x : Math.round(s.x);
          if (safe(s, up, s.row + 1)) hop('up');
          else if (!safe(s, s.x, s.row, 0.2) && s.row !== R.start && s.row !== R.middle) hop('down');
        }
      }
      game.update(16);
    }
    return game.snapshot().lastHome;
  };
  const finishHome = () => { for (let t = 0; t < 5000 && game.snapshot().phase === 'home'; t += 16) game.update(16); };
  return { game, events, sessionId, hop, wait, crossTo, finishHome };
}

test('the course: two roads, a middle bank, two river lanes, the far bank and four homes, one the answer', () => {
  const { game } = newHop();
  const s = game.snapshot();
  assert.equal(s.phase, 'answering');
  assert.deepEqual(s.lanes.map(l => [l.row, l.kind]), [[1, 'road'], [2, 'road'], [4, 'river'], [5, 'river']]);
  assert.deepEqual(s.homes.map(h => h.col), [...R.homeCols]);
  assert.equal(s.homes.filter(h => h.plateId === s.problem.answerId).length, 1);
  assert.deepEqual([s.x, s.row], [4, R.start]);
  // Every lane holds things that come in from off the course.
  for (const lane of s.lanes) assert.ok(lane.items.length >= 3);
});

test('a cart sends the companion back to the start, the water back to the middle bank; no game over', () => {
  const { game, hop, wait } = newHop();
  // Hop into the first road just as a cart is there.
  for (let t = 0; t < 20000 && game.snapshot().lastOops === null; t += 16) {
    const s = game.snapshot();
    if (s.phase === 'answering' && !s.hopping && s.row === R.start && !safe(s, 4, 1, 0)) hop('up');
    game.update(16);
  }
  let s = game.snapshot();
  assert.equal(s.lastOops.kind, 'cart');
  assert.equal(s.row, R.start); assert.equal(s.phase, 'oops');
  assert.equal(hop('up'), false, 'no hop while the bump shows');
  wait(R.oopsMs + 50);
  assert.equal(game.snapshot().phase, 'answering');
  // To the middle bank, then into the water where no log is.
  for (let t = 0; t < 60000 && game.snapshot().row < R.middle; t += 16) {
    s = game.snapshot();
    if (s.phase === 'answering' && !s.hopping && safe(s, Math.round(s.x), s.row + 1)) hop('up');
    game.update(16);
  }
  const before = game.snapshot().totalMishaps;
  for (let t = 0; t < 20000 && game.snapshot().totalMishaps === before; t += 16) {
    s = game.snapshot();
    if (s.phase === 'answering' && !s.hopping && s.row === R.middle && !safe(s, s.x, R.middle + 1, 0)) hop('up');
    game.update(16);
  }
  s = game.snapshot();
  assert.equal(s.lastOops.kind, 'water');
  assert.equal(s.row, R.middle);
  assert.equal(s.answered, 0, 'a bump is not an answer');
});

test('a log carries the companion, and at the side of the course it holds on instead of falling', () => {
  const { game, hop } = newHop();
  for (let t = 0; t < 60000 && game.snapshot().row < R.middle + 1; t += 16) {
    const s = game.snapshot();
    const up = s.lanes.find(l => l.row === s.row + 1)?.kind === 'river' ? s.x : Math.round(s.x);
    if (s.phase === 'answering' && !s.hopping && safe(s, up, s.row + 1, 0.6)) hop('up');
    game.update(16);
  }
  let s = game.snapshot();
  assert.equal(s.row, R.middle + 1);
  const lane = s.lanes.find(l => l.row === s.row), x0 = s.x;
  game.update(100);
  s = game.snapshot();
  if (s.row === R.middle + 1) assert.ok(Math.abs(s.x - (x0 + lane.dir * lane.speed * 0.1)) < 1e-6 || s.x === 0 || s.x === R.cols - 1);
  // Riding on: the companion never goes past the side, it holds at 0 or the last column until its log is gone.
  for (let t = 0; t < 15000 && game.snapshot().row === R.middle + 1; t += 16) {
    game.update(16);
    const now = game.snapshot();
    assert.ok(now.x >= 0 && now.x <= R.cols - 1, `x ${now.x}`);
  }
});

test('a home is entered only from the bank, and only where a home is', () => {
  const { game, hop, crossTo } = newHop();
  // Cross to the bank (stop before the homes).
  for (let t = 0; t < 120000 && game.snapshot().row !== R.bank; t += 16) {
    const s = game.snapshot();
    const up = s.lanes.find(l => l.row === s.row + 1)?.kind === 'river' ? s.x : Math.round(s.x);
    if (s.phase === 'answering' && !s.hopping && safe(s, up, s.row + 1)) hop('up');
    game.update(16);
  }
  let s = game.snapshot();
  assert.equal(s.row, R.bank);
  assert.equal(Number.isInteger(s.x), true, 'the bank is solid ground');
  // Between the homes: a hedge.
  const hedge = [0, 2, 4, 6, 8].includes(s.x) ? s.x : s.x + 1;
  while (game.snapshot().x !== hedge) { hop(game.snapshot().x < hedge ? 'right' : 'left'); for (let t = 0; t < 200; t += 16) game.update(16); }
  for (let t = 0; t < 200; t += 16) game.update(16);
  assert.equal(hop('up'), false);
  s = game.snapshot();
  assert.equal(s.row, R.bank); assert.ok(s.lastBlock);
  assert.equal(s.answered, 0);
  assert.equal(crossTo().correct, true);
});

test('the answer home brings the companion back to the start for the next question', () => {
  const { game, events, crossTo, finishHome } = newHop();
  const home = crossTo();
  assert.equal(home.correct, true);
  assert.equal(game.snapshot().phase, 'home');
  finishHome();
  const s = game.snapshot();
  assert.equal(s.problemIndex, 1); assert.equal(s.correct, 1);
  assert.deepEqual([s.x, s.row], [4, R.start]);
  assert.ok(s.homes.every(h => !h.gone));
  assert.deepEqual(events.filter(e => e.type !== 'problemPresented').map(e => e.type), ['correct']);
});

test('another home tells its plate, stays shut, the answer home glows; the retry is no second result', () => {
  const { game, events, crossTo, hop } = newHop();
  const first = game.snapshot().problem;
  const wrong = crossTo(s => s.homes.find(h => h.plateId !== s.problem.answerId).plateId);
  assert.equal(wrong.correct, false);
  assert.ok(wrong.text && wrong.answer);
  let s = game.snapshot();
  assert.equal(s.row, R.bank, 'the companion stays on the bank in front of it');
  assert.equal(s.incorrect, 1); assert.equal(s.missed.length, 1);
  assert.equal(s.hintPlateId, first.answerId);
  assert.equal(s.homes.find(h => h.homeId === wrong.homeId).gone, true);
  for (let t = 0; t < 300; t += 16) game.update(16);
  assert.equal(hop('up'), false, 'a shut home cannot be entered');
  assert.notEqual(s.problem.problemId, first.problemId);
  crossTo();
  s = game.snapshot();
  assert.equal(s.answered, 1, 'the retry is not a second result');
  assert.deepEqual(events.filter(e => e.type !== 'problemPresented').map(e => e.type), ['incorrect', 'passed']);
});

test('after three bumps the lanes slow to half; after five a bubble keeps the companion safe', () => {
  const { game, hop, wait } = newHop();
  const speeds = () => game.snapshot().lanes.map(l => l.speed);
  const full = speeds();
  // Hop blindly up and up: bumps come.
  for (let t = 0; t < 120000 && game.snapshot().helpLevel < 2; t += 16) {
    const s = game.snapshot();
    if (s.phase === 'answering' && !s.hopping && !(s.row === R.start ? safe(s, 4, 1, 0) : false)) hop('up');
    game.update(16);
    if (game.snapshot().helpLevel === 1 && game.snapshot().mishaps < R.bubbleAfter) {
      game.snapshot().lanes.forEach((l, i) => assert.ok(Math.abs(l.speed - full[i] * 0.5) < 1e-9));
    }
  }
  let s = game.snapshot();
  assert.equal(s.helpLevel, 2); assert.equal(s.bubble, true); assert.equal(s.mishaps, R.bubbleAfter);
  assert.equal(s.lastHelp.level, 2);
  wait(R.oopsMs + 50);
  // Straight up through carts and water, no more bumps.
  const before = game.snapshot().totalMishaps;
  for (let t = 0; t < 30000 && game.snapshot().row < R.bank; t += 16) {
    s = game.snapshot();
    if (s.phase === 'answering' && !s.hopping) hop('up');
    game.update(16);
  }
  assert.equal(game.snapshot().row, R.bank);
  assert.equal(game.snapshot().totalMishaps, before);
});

test('stars and the waiting friend are picked up by hopping onto them', () => {
  const { game, hop } = newHop({ seed: 8 });
  const s = game.snapshot();
  const friend = s.friend;
  assert.equal(friend.row, R.middle);
  // Walk the start row to the friend's column, then cross to the middle bank when safe.
  while (game.snapshot().x !== friend.x) { hop(game.snapshot().x < friend.x ? 'right' : 'left'); for (let t = 0; t < 200; t += 16) game.update(16); }
  for (let t = 0; t < 60000 && game.snapshot().row < R.middle; t += 16) {
    const now = game.snapshot();
    if (now.phase === 'answering' && !now.hopping && safe(now, now.x, now.row + 1)) hop('up');
    game.update(16);
  }
  const after = game.snapshot();
  assert.equal(after.friends, 1); assert.equal(after.friend, null);
  assert.equal(after.lastPickup.kind === 'friend' || after.starsTaken > 0, true);
  assert.ok(s.stars.length === R.stars);
});

test('twelve questions in every mode and pace, with slips on the way; every home its own problem id', () => {
  for (const mode of ['kanji', 'english', 'math']) {
    for (const pace of ['normal', 'slow']) {
      const { game, events, crossTo, finishHome } = newHop({ mode, pace, seed: mode.length + (pace === 'slow' ? 7 : 0) });
      let guard = 0, slips = 0;
      while (game.snapshot().phase !== 'completed' && guard++ < 40) {
        const s = game.snapshot();
        const slip = slips < 4 && s.hintPlateId === null && s.problemIndex % 3 === 0;
        if (slip) slips++;
        crossTo(slip ? q => q.homes.find(h => h.plateId !== q.problem.answerId && !h.gone).plateId : undefined);
        finishHome();
      }
      const end = game.snapshot();
      assert.equal(end.phase, 'completed', `${mode} ${pace}`);
      assert.equal(end.result.answered, 12); assert.equal(end.result.correct, 12 - slips); assert.equal(end.result.incorrect, slips);
      assert.equal(events.at(-1).type, 'sessionComplete');
      const ids = events.filter(e => ['correct', 'incorrect', 'passed', 'retry'].includes(e.type)).map(e => e.problemId);
      assert.equal(new Set(ids).size, ids.length);
      assert.ok(['correct', 'passed'].includes(events.at(-2).type));
    }
  }
});

test('a child who only ever hops up still gets every question home (help, then the bubble)', () => {
  for (const seed of [1, 2, 3]) {
    const { game, hop } = newHop({ seed });
    for (let t = 0; t < 30 * 60000 && game.snapshot().phase !== 'completed'; t += 16) {
      const s = game.snapshot();
      if (s.phase === 'answering' && !s.hopping) {
        if (s.row === R.bank) { const col = s.homes.find(h => h.plateId === s.problem.answerId).col; hop(col === s.x ? 'up' : col > s.x ? 'right' : 'left'); }
        else hop('up');
      }
      game.update(16);
    }
    const end = game.snapshot();
    assert.equal(end.phase, 'completed', `seed ${seed}`);
    assert.equal(end.result.correct, 12);
    assert.ok(end.activeElapsedMs < 5 * 60000, `seed ${seed} took ${end.activeElapsedMs}`);
  }
});

test('commands are refused while paused, too soon after a hop, with a stale attempt, or from another session', () => {
  const { game, sessionId } = newHop();
  const s = game.snapshot();
  const send = payload => game.dispatch({ type: 'hop', payload: { sessionId, attemptId: s.attemptId, dir: 'left', ...payload } });
  assert.equal(send({ sessionId: 'x' }), false);
  assert.equal(send({ attemptId: 'stale' }), false);
  assert.equal(send({ dir: 'jump' }), false);
  assert.equal(send({ dir: 'down' }), false, 'nothing below the start');
  game.setPaused(true);
  assert.equal(send({}), false);
  game.setPaused(false);
  assert.equal(send({}), true);
  assert.equal(send({}), false, 'too soon after a hop');
  for (let t = 0; t < R.hopMs + 20; t += 16) game.update(16);
  assert.equal(send({}), true);
  assert.equal(game.snapshot().x, 2);
  game.exit();
  assert.equal(game.snapshot().aborted, true);
  assert.equal(createHopGame({ sessionId: 's', content: null }).enter(), false);
});
