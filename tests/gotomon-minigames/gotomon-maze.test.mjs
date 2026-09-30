import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSlashProblems } from '../../src/minigames/gotomonSlash/slashContent.js';
import { createMazeGame, carveMaze, wayBetween, MAZE_RULES as R } from '../../src/minigames/gotomonMaze/mazeGame.js';

const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const grade1 = JSON.parse(readFileSync(new URL('../../public/data/kanji_g1_proto.json', import.meta.url), 'utf8'));
const N = R.size;

function newMaze({ seed = 3, mode = 'math' } = {}) {
  const events = [], sessionId = `maz${seed}`;
  const problems = buildSlashProblems({ sessionId, random: seeded(seed), mode, gradeKanji: grade1 });
  const game = createMazeGame({ sessionId, random: seeded(seed + 1), onEvent: event => events.push(event), content: { problems } });
  assert.equal(game.enter(), true);
  const send = (type, extra = {}) => game.dispatch({ type, payload: { sessionId, attemptId: game.snapshot().attemptId, ...extra } });
  const walk = () => { for (let t = 0; t < 20000 && game.snapshot().walking && game.snapshot().phase === 'walking'; t += 50) game.update(50); };
  const answer = (right = true) => { const p = game.snapshot().problem; return send('answer', { choiceId: right ? p.correctChoiceId : p.choices.find(c => c.choiceId !== p.correctChoiceId).choiceId }); };
  return { game, events, send, walk, answer, sessionId };
}

test('every maze is perfect: all cells reachable, walls match on both sides, one way between any two cells', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const cells = carveMaze(N, seeded(seed));
    let openings = 0;
    for (let i = 0; i < N * N; i++) {
      const row = Math.floor(i / N), col = i % N;
      if (cells[i].e) { assert.ok(col < N - 1 && cells[i + 1].w); openings++; }
      if (cells[i].s) { assert.ok(row < N - 1 && cells[i + N].n); openings++; }
      if (col === 0) assert.equal(cells[i].w, false);
      if (row === 0) assert.equal(cells[i].n, false);
      assert.ok(wayBetween(cells, N, 0, i) || i === 0, `cell ${i} reachable`);
    }
    assert.equal(openings, N * N - 1, 'a tree: cells − 1 openings');
  }
});

test('four doors stand on the way to the stairs; friends wait off the way, never behind the stairs', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const { game } = newMaze({ seed });
    const s = game.snapshot(), way = new Set(wayBetween(s.cells, N, s.player, s.goal));
    assert.equal(s.doors.length, R.doorsPerFloor);
    assert.equal(new Set(s.doors.map(d => d.cell)).size, R.doorsPerFloor);
    s.doors.forEach(d => { assert.ok(way.has(d.cell) && d.cell !== s.goal); });
    assert.equal(s.friends.length, R.friendsPerFloor);
    s.friends.forEach(f => { assert.ok(!way.has(f.cell)); assert.ok(!wayBetween(s.cells, N, 0, f.cell).includes(s.goal), 'not behind the stairs'); });
  }
});

test('walking into a door asks its question; a slip asks again with the answer shown, a right answer opens it', () => {
  const { game, events, send, walk, answer } = newMaze();
  assert.equal(send('walkTo', { cell: game.snapshot().goal }), true);
  walk();
  let s = game.snapshot();
  assert.equal(s.phase, 'answering');
  const door = s.doors.find(d => d.doorId === s.atDoor);
  assert.ok(door && !door.open);
  assert.notEqual(s.player, door.cell, 'the companion waits in front of the door');
  assert.equal(answer(false), true);
  s = game.snapshot();
  assert.equal(s.phase, 'answering'); assert.equal(s.incorrect, 1); assert.equal(s.hintChoiceId, s.problem.correctChoiceId);
  assert.equal(send('leave'), false, 'after a slip the door asks until it is opened');
  assert.equal(answer(), true);
  s = game.snapshot();
  assert.equal(s.phase, 'walking'); assert.equal(s.player, door.cell); assert.equal(s.doors.find(d => d.doorId === door.doorId).open, true);
  assert.equal(s.answered, 1);
  assert.deepEqual(events.filter(e => ['correct', 'incorrect', 'opened', 'retry'].includes(e.type)).map(e => e.type), ['incorrect', 'opened']);
});

test('one can step back from a door before answering, and walls stop a step', () => {
  const { game, send, walk } = newMaze({ seed: 7 });
  const s0 = game.snapshot();
  assert.equal(send('move', { direction: 'up' }), false, 'the top left corner has walls up and left');
  assert.equal(send('move', { direction: 'left' }), false);
  send('walkTo', { cell: s0.goal }); walk();
  assert.equal(game.snapshot().phase, 'answering');
  assert.equal(send('leave'), true);
  assert.equal(game.snapshot().phase, 'walking');
  assert.equal(game.snapshot().answered, 0);
});

test('three floors of four doors: twelve questions, friends met on the way, then the play ends', () => {
  for (const mode of ['kanji', 'english', 'math']) {
    const { game, events, send, walk, answer } = newMaze({ mode, seed: 11 });
    let guard = 0;
    while (game.snapshot().phase !== 'completed' && guard++ < 500) {
      const s = game.snapshot();
      if (s.phase === 'answering') answer();
      else if (s.phase === 'walking') {
        // Visit a friend first, then head for the stairs.
        const friend = s.friends.find(f => !f.met);
        send('walkTo', { cell: friend ? friend.cell : s.goal }); walk();
      } else game.update(100);
    }
    const end = game.snapshot();
    assert.equal(end.phase, 'completed', mode);
    assert.equal(end.result.opened, 12); assert.equal(end.result.answered, 12); assert.equal(end.result.floors, 3);
    assert.equal(end.result.friends, R.floors * R.friendsPerFloor);
    assert.equal(events.at(-1).type, 'sessionComplete');
    const ids = events.filter(e => ['correct', 'incorrect'].includes(e.type)).map(e => e.problemId);
    assert.equal(new Set(ids).size, ids.length);
  }
});

test('commands are refused while paused, with a stale attempt, or from another session', () => {
  const { game, sessionId } = newMaze();
  const s = game.snapshot();
  const dir = s.cells[0].e ? 'right' : 'down';
  assert.equal(game.dispatch({ type: 'move', payload: { sessionId: 'x', attemptId: s.attemptId, direction: dir } }), false);
  assert.equal(game.dispatch({ type: 'move', payload: { sessionId, attemptId: 'stale', direction: dir } }), false);
  game.setPaused(true);
  assert.equal(game.dispatch({ type: 'move', payload: { sessionId, attemptId: s.attemptId, direction: dir } }), false);
  game.setPaused(false);
  assert.equal(game.dispatch({ type: 'move', payload: { sessionId, attemptId: s.attemptId, direction: dir } }), true);
  game.exit();
  assert.equal(game.snapshot().aborted, true);
  assert.equal(createMazeGame({ sessionId: 's', content: null }).enter(), false);
});
