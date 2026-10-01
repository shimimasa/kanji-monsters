import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSlashProblems } from '../../src/minigames/gotomonSlash/slashContent.js';
import { createTagGame, TAG_RULES as R, TAG_POCKETS } from '../../src/minigames/gotomonTag/tagGame.js';

const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const grade1 = JSON.parse(readFileSync(new URL('../../public/data/kanji_g1_proto.json', import.meta.url), 'utf8'));
const D = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
const isOpen = (r, c) => ['.', 'P'].includes(R.board[r]?.[c]);

// The first step from (r, c) on a shortest way to (gr, gc); avoid: cells to keep off when another way exists.
function firstStep(r, c, gr, gc, avoid = new Set()) {
  for (const careful of [true, false]) {
    const from = new Map([[`${r},${c}`, null]]), queue = [[r, c]];
    while (queue.length) {
      const [y, x] = queue.shift();
      if (y === gr && x === gc && (y !== r || x !== c)) {
        let k = `${y},${x}`, dir = null;
        while (from.get(k)) { dir = from.get(k).dir; k = from.get(k).prev; }
        return dir;
      }
      for (const [d, [dy, dx]] of Object.entries(D)) {
        const k = `${y + dy},${x + dx}`;
        if (!isOpen(y + dy, x + dx) || from.has(k) || (careful && avoid.has(k))) continue;
        from.set(k, { prev: `${y},${x}`, dir: d }); queue.push([y + dy, x + dx]);
      }
    }
  }
  return null;
}

function newTag({ seed = 3, mode = 'math', pace = 'normal' } = {}) {
  const events = [], sessionId = `tag${seed}`;
  const problems = buildSlashProblems({ sessionId, random: seeded(seed), mode, gradeKanji: grade1 });
  const game = createTagGame({ sessionId, random: seeded(seed + 1), pace, onEvent: event => events.push(event), content: { problems } });
  assert.equal(game.enter(), true);
  // Runs to the chosen plate (default: the answer's), keeping off the chasers when it can.
  const tick = (pick = s => s.problem.answerId) => {
    const s = game.snapshot(), p = s.player;
    let goal = [R.start[0], R.start[1]];
    if (s.problem) { const plate = s.plates.find(pl => pl.plateId === pick(s) && !pl.gone); goal = [plate.r, plate.c]; }
    const avoid = new Set();
    for (const ch of s.chasers) if (!ch.running && !ch.waiting) for (const [dy, dx] of [[0, 0], ...Object.values(D)]) avoid.add(`${Math.round(ch.y) + dy},${Math.round(ch.x) + dx}`);
    const here = p.dir ? [p.r + D[p.dir][0], p.c + D[p.dir][1]] : [p.r, p.c];
    const dir = firstStep(here[0], here[1], goal[0], goal[1], avoid) ?? (p.dir ? null : firstStep(p.r, p.c, goal[0], goal[1], avoid));
    if (dir && dir !== p.wanted) game.dispatch({ type: 'move', payload: { sessionId, attemptId: s.attemptId, direction: dir } });
    game.update(16);
  };
  const untilTake = (pick, limit = 60000) => {
    const n = game.snapshot().lastTake?.take ?? 0;
    for (let t = 0; t < limit && (game.snapshot().lastTake?.take ?? 0) === n && game.snapshot().phase === 'answering'; t += 16) tick(pick);
    return game.snapshot().lastTake;
  };
  const untilPlates = () => { for (let t = 0; t < 20000 && !game.snapshot().problem && game.snapshot().phase === 'answering'; t += 16) tick(); };
  return { game, events, sessionId, untilTake, untilPlates };
}

test('the maze has loops and no dead ends, every path cell is reachable, and four pockets at the edges', () => {
  const cells = [];
  R.board.forEach((line, r) => [...line].forEach((ch, c) => { if (ch === '.') cells.push([r, c]); }));
  for (const [r, c] of cells) assert.ok(Object.values(D).filter(([dy, dx]) => isOpen(r + dy, c + dx)).length >= 2, `dead end at ${r},${c}`);
  for (const [r, c] of [...cells, ...TAG_POCKETS]) assert.ok(firstStep(R.start[0], R.start[1], r, c) || (r === R.start[0] && c === R.start[1]), `${r},${c} unreachable`);
  assert.equal(TAG_POCKETS.length, 4);
  for (const [r, c] of TAG_POCKETS) assert.ok(r === 0 || c === 0 || r === R.board.length - 1 || c === R.board[0].length - 1);
});

test('the four plates wait in the pockets, one of them the answer', () => {
  const { game } = newTag();
  const s = game.snapshot();
  assert.equal(s.plates.length, 4);
  assert.deepEqual(s.plates.map(p => [p.r, p.c]), TAG_POCKETS.map(p => [...p]));
  assert.equal(s.plates.filter(p => p.plateId === s.problem.answerId).length, 1);
  assert.equal(s.chasers.length, 3);
  assert.ok(s.sparkles.length > 50);
});

test('the answer plate powers up: the chasers run away, then the next plates come', () => {
  const { game, events, untilTake, untilPlates } = newTag();
  const take = untilTake();
  assert.equal(take.correct, true);
  let s = game.snapshot();
  assert.equal(s.correct, 1);
  assert.ok(s.powerMs > 0);
  assert.equal(s.problem, null); assert.equal(s.plates.length, 0);
  assert.ok(s.chasers.some(ch => ch.running));
  untilPlates();
  s = game.snapshot();
  assert.equal(s.powerMs, 0);
  assert.equal(s.problemIndex, 1); assert.equal(s.plates.length, 4);
  assert.deepEqual(events.filter(e => e.type !== 'problemPresented').map(e => e.type), ['correct']);
  assert.equal(events.filter(e => e.type === 'problemPresented').length, 2);
});

test('another plate is gone, says what it was, and the answer glows; the retry is no second result', () => {
  const { game, events, untilTake } = newTag();
  const first = game.snapshot().problem;
  const wrong = untilTake(s => s.plates.find(p => p.plateId !== s.problem.answerId && !p.gone).plateId);
  assert.equal(wrong.correct, false);
  let s = game.snapshot();
  assert.equal(s.incorrect, 1); assert.equal(s.hintPlateId, first.answerId);
  assert.equal(s.plates.filter(p => p.gone).length, 1);
  assert.notEqual(s.problem.problemId, first.problemId);
  assert.equal(s.missed.length, 1); assert.ok(wrong.text && wrong.answer);
  untilTake();
  s = game.snapshot();
  assert.equal(s.answered, 1, 'the retry is not a second result');
  assert.deepEqual(events.filter(e => e.type !== 'problemPresented').map(e => e.type), ['incorrect', 'passed']);
});

test('being touched sends the companion back to the start, safe for a moment; there is no game over', () => {
  const { game, sessionId } = newTag();
  // Standing still in a corridor until a chaser comes.
  for (let t = 0; t < 60000 && game.snapshot().tagged === 0; t += 16) game.update(16);
  const s = game.snapshot();
  assert.equal(s.tagged, 1);
  assert.equal(s.lastTouch.kind, 'tagged');
  assert.deepEqual([s.player.r, s.player.c], [...R.start]);
  assert.equal(s.player.safe, true);
  assert.equal(s.phase, 'answering');
  assert.equal(game.dispatch({ type: 'move', payload: { sessionId, attemptId: s.attemptId, direction: 'up' } }), true);
});

test('twelve questions to the end in every mode and pace, with slips; every take its own problem id', () => {
  for (const mode of ['kanji', 'english', 'math']) {
    for (const pace of ['normal', 'slow']) {
      const { game, events, untilTake, untilPlates } = newTag({ mode, pace, seed: mode.length + (pace === 'slow' ? 9 : 0) });
      let guard = 0, slips = 0;
      while (game.snapshot().phase === 'answering' && guard++ < 60) {
        if (!game.snapshot().problem) { untilPlates(); continue; }
        const slip = slips < 3 && !game.snapshot().hintPlateId && game.snapshot().problemIndex % 4 === 1;
        if (slip) slips++;
        untilTake(slip ? s => s.plates.find(p => p.plateId !== s.problem.answerId && !p.gone).plateId : undefined);
        if (game.snapshot().ending) for (let t = 0; t < 10000 && game.snapshot().phase === 'answering'; t += 16) game.update(16);
      }
      const end = game.snapshot();
      assert.equal(end.phase, 'completed', `${mode} ${pace}`);
      assert.equal(end.result.answered, 12); assert.equal(end.result.correct, 12 - slips);
      assert.ok(end.activeElapsedMs < 4 * 60000, `${mode} ${pace} ${end.activeElapsedMs}`);
      assert.equal(events.at(-1).type, 'sessionComplete');
      const ids = events.filter(e => ['correct', 'incorrect', 'passed', 'retry'].includes(e.type)).map(e => e.problemId);
      assert.equal(new Set(ids).size, ids.length);
    }
  }
});

test('commands are refused while paused, with a stale attempt, or from another session', () => {
  const { game, sessionId } = newTag();
  const s = game.snapshot();
  const move = payload => game.dispatch({ type: 'move', payload: { sessionId, attemptId: s.attemptId, direction: 'up', ...payload } });
  assert.equal(move({ sessionId: 'x' }), false);
  assert.equal(move({ attemptId: 'stale' }), false);
  assert.equal(move({ direction: 'north' }), false);
  game.setPaused(true);
  assert.equal(move({}), false);
  game.setPaused(false);
  assert.equal(move({}), true);
  game.update(100);
  assert.ok(game.snapshot().player.y < R.start[0]);
  game.exit();
  assert.equal(game.snapshot().aborted, true);
  assert.equal(createTagGame({ sessionId: 's', content: null }).enter(), false);
});
