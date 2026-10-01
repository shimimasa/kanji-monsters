import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSlashProblems } from '../../src/minigames/gotomonSlash/slashContent.js';
import { createLandGame, buildStage, LAND_RULES as R } from '../../src/minigames/gotomonLand/landGame.js';

const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const grade1 = JSON.parse(readFileSync(new URL('../../public/data/kanji_g1_proto.json', import.meta.url), 'utf8'));

function newLand({ seed = 3, mode = 'math', pace = 'normal' } = {}) {
  const events = [], sessionId = `land${seed}`;
  const problems = buildSlashProblems({ sessionId, random: seeded(seed), mode, gradeKanji: grade1 });
  const game = createLandGame({ sessionId, random: seeded(seed + 1), pace, onEvent: event => events.push(event), content: { problems } });
  assert.equal(game.enter(), true);
  const cmd = (type, payload = {}) => game.dispatch({ type, payload: { sessionId, attemptId: game.snapshot().attemptId, ...payload } });
  const tick = (ms = 16) => { for (let t = 0; t < ms; t += 16) game.update(16); };
  // A careful runner: holds right, jumps just before holes, steps and acorns, rides platforms.
  const runToHall = (limit = 60000) => {
    for (let t = 0; t < limit && game.snapshot().phase !== 'completed'; t += 16) {
      const s = game.snapshot();
      if (s.phase === 'running' && s.player.x >= s.stage.hall + 1) { cmd('move', { dir: 0 }); return; }
      const p = s.player, st = s.stage, front = p.x + R.halfW;
      let dir = 1;
      const on = s.platforms.find(q => p.grounded && Math.abs(p.y - q.y) < 1e-6 && st.h[Math.floor(p.x)] === 0 && !st.bridges);
      const next = s.platforms.find(q => Math.floor(front + 0.3) === q.from && !st.bridges);
      if (on) dir = on.x >= on.to - 0.15 ? 1 : p.x < on.x + 0.9 ? 1 : 0;
      else if (next && p.grounded) dir = next.x <= next.from + 0.15 ? 1 : 0;
      cmd('move', { dir });
      if (dir && p.grounded) {
        const c = Math.floor(front + 0.35), here = st.h[Math.floor(p.x)];
        const platformHole = s.platforms.some(q => c >= q.from && c < q.to + q.w);
        if (!platformHole && ((st.h[c] === 0 && !st.bridges) || st.h[c] > here)) cmd('jump');
        if (s.acorns.some(a => a.x > p.x && a.x - p.x < 1.4)) cmd('jump');
      }
      game.update(16);
    }
  };
  // Walks the hall to the door picked (default: the answer) and presses はいる.
  const enterDoor = (pick = s => s.problem.answerId) => {
    for (let t = 0; t < 20000; t += 16) {
      const s = game.snapshot();
      const door = s.doors.find(d => d.plateId === pick(s));
      const dx = door.col + 0.5 - s.player.x;
      if (Math.abs(dx) < 0.2 && s.player.grounded) { cmd('move', { dir: 0 }); tick(32); assert.equal(cmd('enter'), true); return game.snapshot().lastDoor; }
      cmd('move', { dir: dx > 0 ? 1 : -1 }); game.update(16);
    }
    throw new Error('could not reach the door');
  };
  const finishWarp = () => { for (let t = 0; t < 3000 && game.snapshot().phase === 'warp'; t += 16) game.update(16); };
  return { game, events, sessionId, cmd, tick, runToHall, enterDoor, finishWarp };
}

test('every stage can be crossed: holes 1-2 wide, steps 1-2 high, four flat tiles after every piece, four doors at the end', () => {
  for (let i = 0; i < 12; i++) {
    for (let seed = 1; seed <= 30; seed++) {
      const st = buildStage(i, seeded(seed * 31 + i));
      let c = 4;
      while (c < st.hall) {
        if (st.h[c] === 0) {
          let w = 0; while (st.h[c + w] === 0) w++;
          const platform = st.platforms.find(p => p.from === c);
          if (platform) assert.equal(w, 4); else assert.ok(w <= 2, `hole ${w} at ${c}`);
          c += w; continue;
        }
        assert.ok(st.h[c] - (st.h[c - 1] || R.base) <= 2, `step at ${c}`);
        c++;
      }
      assert.deepEqual(st.doors, [st.hall + 2, st.hall + 4, st.hall + 6, st.hall + 8]);
      assert.ok(st.h.slice(st.hall).every(v => v === R.base));
      if (i < 2) assert.ok(!st.h.slice(0, st.hall).some((v, k) => v === 0 && st.h[k + 1] === 0 && !st.platforms.length), 'only 1-wide holes at first');
    }
  }
});

test('a jump rises about 2.4 tiles and carries about 3.5 tiles across', () => {
  const { game, cmd } = newLand();
  cmd('move', { dir: 1 }); cmd('jump');
  const y0 = game.snapshot().player.y, x0 = game.snapshot().player.x;
  let top = 0, landed = null;
  for (let t = 0; t < 2000 && landed === null; t += 8) {
    game.update(8);
    const p = game.snapshot().player;
    top = Math.max(top, p.y - y0);
    if (t > 50 && p.grounded) landed = p.x - x0;
  }
  assert.ok(top > 2.3 && top < 2.5, `top ${top}`);
  // (The first tiles are flat and long enough to land on.)
  assert.ok(landed > 3.2 && landed < 3.8, `across ${landed}`);
});

test('the answer door leads to the next stage; nothing happens by running past the doors', () => {
  const { game, events, cmd, runToHall, enterDoor, finishWarp } = newLand();
  runToHall();
  // Run through the whole hall and back: no door is entered without はいる.
  for (let t = 0; t < 3000; t += 16) { cmd('move', { dir: 1 }); game.update(16); }
  for (let t = 0; t < 3000; t += 16) { cmd('move', { dir: -1 }); game.update(16); }
  assert.equal(game.snapshot().answered, 0);
  const door = enterDoor();
  assert.equal(door.correct, true);
  assert.equal(game.snapshot().phase, 'warp');
  finishWarp();
  const s = game.snapshot();
  assert.equal(s.problemIndex, 1); assert.equal(s.correct, 1);
  assert.ok(s.player.x < 2);
  assert.deepEqual(events.filter(e => e.type !== 'problemPresented').map(e => e.type), ['correct']);
});

test('はいる away from a door does nothing', () => {
  const { game, cmd } = newLand();
  assert.equal(cmd('enter'), false);
  assert.equal(game.snapshot().answered, 0);
  assert.ok(game.snapshot().lastBlocked);
});

test('another door tells its plate, stays shut, the answer door glows; the retry is no second result', () => {
  const { game, events, cmd, runToHall, enterDoor } = newLand();
  const first = game.snapshot().problem;
  runToHall();
  const wrong = enterDoor(s => s.doors.find(d => d.plateId !== s.problem.answerId).plateId);
  assert.equal(wrong.correct, false);
  assert.ok(wrong.text && wrong.answer);
  let s = game.snapshot();
  assert.equal(s.phase, 'running');
  assert.equal(s.incorrect, 1); assert.equal(s.missed.length, 1);
  assert.equal(s.hintPlateId, first.answerId);
  assert.equal(s.doors.find(d => d.doorId === wrong.doorId).gone, true);
  assert.equal(cmd('enter'), false, 'a shut door cannot be entered');
  assert.notEqual(s.problem.problemId, first.problemId);
  enterDoor();
  s = game.snapshot();
  assert.equal(s.answered, 1, 'the retry is not a second result');
  assert.deepEqual(events.filter(e => e.type !== 'problemPresented').map(e => e.type), ['incorrect', 'passed']);
});

test('a hole sends the companion back to the start (or the flag); after three falls the Gotomon build bridges', () => {
  const { game, cmd, tick } = newLand({ seed: 5 });
  // Walk right without ever jumping: into the first hole.
  for (let t = 0; t < 30000 && game.snapshot().falls < R.bridgeAfter; t += 16) { cmd('move', { dir: 1 }); game.update(16); }
  let s = game.snapshot();
  assert.equal(s.falls, R.bridgeAfter);
  assert.equal(s.stage.bridges, true); assert.equal(s.lastHelp.kind, 'bridges');
  assert.ok(s.stage.tiles.some(t => t.kind === 'bridge'));
  tick(R.fallMs + 50);
  s = game.snapshot();
  assert.equal(s.phase, 'running');
  assert.equal(s.answered, 0, 'a fall is not an answer');
  // With the bridges, walking never falls again (steps still need a jump).
  const before = s.totalFalls;
  for (let t = 0; t < 30000 && game.snapshot().player.x < s.stage.hall; t += 16) {
    const p = game.snapshot().player, st = game.snapshot().stage;
    cmd('move', { dir: 1 });
    if (p.grounded && st.h[Math.floor(p.x + R.halfW + 0.35)] > st.h[Math.floor(p.x)]) cmd('jump');
    game.update(16);
  }
  assert.equal(game.snapshot().totalFalls, before);
});

test('the checkpoint flag: a fall after it comes back at the flag', () => {
  const { game, cmd, runToHall } = newLand({ seed: 4 });
  const st = game.snapshot().stage;
  // Run past the flag with the careful runner, then walk back into a hole... simply: past the flag, fall by walking left into the nearest hole.
  for (let t = 0; t < 40000 && !game.snapshot().stage.reachedCheckpoint; t += 16) {
    const s = game.snapshot(), p = s.player, front = p.x + R.halfW;
    const c = Math.floor(front + 0.35);
    const platformHole = s.platforms.some(q => c >= q.from && c < q.to + q.w);
    const on = s.platforms.find(q => p.grounded && Math.abs(p.y - q.y) < 1e-6 && s.stage.h[Math.floor(p.x)] === 0);
    const next = s.platforms.find(q => Math.floor(front + 0.3) === q.from);
    let dir = 1;
    if (on) dir = on.x >= on.to - 0.15 ? 1 : p.x < on.x + 0.9 ? 1 : 0;
    else if (next && p.grounded) dir = next.x <= next.from + 0.15 ? 1 : 0;
    cmd('move', { dir });
    if (dir && p.grounded && !platformHole && (s.stage.h[c] === 0 || s.stage.h[c] > s.stage.h[Math.floor(p.x)])) cmd('jump');
    game.update(16);
  }
  assert.equal(game.snapshot().stage.reachedCheckpoint, true);
  // Fall straight down by stepping off into the next hole ahead without jumping.
  for (let t = 0; t < 20000 && !game.snapshot().lastFall; t += 16) { cmd('move', { dir: 1 }); game.update(16); }
  if (game.snapshot().lastFall) {
    cmd('move', { dir: 0 });
    for (let t = 0; t < R.fallMs + 100; t += 16) game.update(16);
    assert.ok(Math.abs(game.snapshot().player.x - (st.checkpoint + 0.5)) < 1e-6);
  } else assert.ok(game.snapshot().player.x >= st.hall, 'no hole after the flag on this stage');
  void runToHall;
});

test('acorns: landing on one turns it into a star; running into one knocks the companion back', () => {
  // A stage with an acorn lane.
  let found = null;
  for (let seed = 1; seed < 40 && !found; seed++) {
    const g = newLand({ seed });
    for (let k = 0; k < 3 && !g.game.snapshot().stage.spawners.length; k++) { g.runToHall(); g.enterDoor(); g.finishWarp(); }
    if (g.game.snapshot().stage.spawners.length) found = g;
  }
  assert.ok(found);
  const { game, cmd } = found;
  const lane = game.snapshot().stage.spawners[0];
  // Stand in the lane and wait: an acorn bumps the companion.
  for (let t = 0; t < 30000 && game.snapshot().player.x < lane.to + 2.5; t += 16) {
    const s = game.snapshot(), p = s.player, c = Math.floor(p.x + R.halfW + 0.35);
    cmd('move', { dir: 1 });
    if (p.grounded && (s.stage.h[c] === 0 || s.stage.h[c] > s.stage.h[Math.floor(p.x)]) && !s.platforms.some(q => c >= q.from && c < q.to + q.w)) cmd('jump');
    const on = s.platforms.find(q => p.grounded && Math.abs(p.y - q.y) < 1e-6 && s.stage.h[Math.floor(p.x)] === 0);
    if (on && !(on.x >= on.to - 0.15) && p.x >= on.x + 0.9) cmd('move', { dir: 0 });
    const next = s.platforms.find(q => Math.floor(p.x + R.halfW + 0.3) === q.from);
    if (!on && next && p.grounded && next.x > next.from + 0.15) cmd('move', { dir: 0 });
    game.update(16);
  }
  cmd('move', { dir: 0 });
  const bumps = game.snapshot().bumps, answeredBefore = game.snapshot().answered;
  for (let t = 0; t < 12000 && game.snapshot().bumps === bumps; t += 16) game.update(16);
  let s = game.snapshot();
  assert.equal(s.bumps, bumps + 1);
  assert.equal(s.player.safe, true);
  assert.equal(s.answered, answeredBefore, 'a bump is not an answer');
  // Jump onto the next one when it is close.
  const stomps = s.stomps;
  for (let t = 0; t < 15000 && game.snapshot().stomps === stomps; t += 16) {
    s = game.snapshot();
    const a = s.acorns.find(o => o.x > s.player.x);
    if (a && s.player.grounded && !s.player.safe && a.x - s.player.x < 1.3 && a.x - s.player.x > 0.9) cmd('jump');
    game.update(16);
  }
  assert.equal(game.snapshot().stomps, stomps + 1);
  assert.equal(game.snapshot().lastPickup.kind, 'stomp');
});

test('a jump pressed just after running off an edge still works (kind to small hands)', () => {
  const { game, cmd } = newLand();
  // Run right without jumping until the companion leaves the ground over the first hole.
  for (let t = 0; t < 10000 && game.snapshot().player.grounded; t += 8) { cmd('move', { dir: 1 }); game.update(8); }
  const p = game.snapshot().player;
  assert.equal(p.grounded, false); assert.ok(p.vy <= 0);
  game.update(8);
  assert.equal(cmd('jump'), true);
  game.update(8);
  assert.ok(game.snapshot().player.vy > 5, `vy ${game.snapshot().player.vy}`);
});

test('ゆっくり plays the same jump slower', () => {
  const air = pace => {
    const { game, cmd } = newLand({ pace });
    cmd('jump');
    let t = 0; game.update(16); t += 16;
    while (!game.snapshot().player.grounded && t < 3000) { game.update(16); t += 16; }
    return t;
  };
  const normal = air('normal'), slow = air('slow');
  assert.ok(Math.abs(slow * R.slowTime - normal) < 40, `${normal} ${slow}`);
});

test('twelve stages in every mode and pace, with slips on the way; every door its own problem id', () => {
  for (const mode of ['kanji', 'english', 'math']) {
    for (const pace of ['normal', 'slow']) {
      const { game, events, runToHall, enterDoor, finishWarp } = newLand({ mode, pace, seed: mode.length + (pace === 'slow' ? 7 : 0) });
      let guard = 0, slips = 0;
      while (game.snapshot().phase !== 'completed' && guard++ < 40) {
        runToHall();
        const s = game.snapshot();
        const slip = slips < 4 && s.hintPlateId === null && s.problemIndex % 3 === 0;
        if (slip) { slips++; enterDoor(q => q.doors.find(d => d.plateId !== q.problem.answerId && !d.gone).plateId); }
        enterDoor();
        finishWarp();
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

test('commands are refused while paused, with a stale attempt, from another session, or out of range', () => {
  const { game, sessionId } = newLand();
  const s = game.snapshot();
  const send = (type, payload = {}) => game.dispatch({ type, payload: { sessionId, attemptId: s.attemptId, ...payload } });
  assert.equal(send('move', { sessionId: 'x', dir: 1 }), false);
  assert.equal(send('move', { attemptId: 'stale', dir: 1 }), false);
  assert.equal(send('move', { dir: 2 }), false);
  game.setPaused(true);
  assert.equal(send('move', { dir: 1 }), false);
  assert.equal(send('jump'), false);
  game.setPaused(false);
  assert.equal(send('move', { dir: 1 }), true);
  const x = game.snapshot().player.x; game.update(50);
  assert.ok(game.snapshot().player.x > x);
  assert.equal(send('jump'), true);
  game.exit();
  assert.equal(game.snapshot().aborted, true);
  assert.equal(createLandGame({ sessionId: 's', content: null }).enter(), false);
});
