import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSlashProblems } from '../../src/minigames/gotomonSlash/slashContent.js';
import { createPushGame, buildRoom, solvePush, stepFrom, PUSH_RULES as R } from '../../src/minigames/gotomonPush/pushGame.js';

const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const grade1 = JSON.parse(readFileSync(new URL('../../public/data/kanji_g1_proto.json', import.meta.url), 'utf8'));
const N = R.size;
const border = at => at < N || at >= N * N - N || at % N === 0 || at % N === N - 1;

function newPush({ seed = 3, mode = 'math', pace = 'normal', courseLength = 'full' } = {}) {
  const events = [], sessionId = `push${seed}`;
  const problems = buildSlashProblems({ sessionId, random: seeded(seed + 1), mode, gradeKanji: grade1 });
  const game = createPushGame({ sessionId, random: seeded(seed), pace, courseLength, onEvent: event => events.push(event), content: { problems } });
  assert.equal(game.enter(), true);
  const s = () => game.snapshot();
  const choose = boxId => game.dispatch({ type: 'choose', payload: { sessionId, attemptId: s().attemptId, boxId } });
  const move = direction => game.dispatch({ type: 'move', payload: { sessionId, attemptId: s().attemptId, direction } });
  const tool = type => game.dispatch({ type, payload: { sessionId, attemptId: s().attemptId } });
  // Walks to where a push starts (around rocks, boxes) and pushes; follows the solver's plan.
  const walkTo = target => {
    const state = s(), blocked = new Set([...state.rocks, ...state.boxes.map(b => b.cell)]);
    const before = new Map([[state.player, null]]), queue = [state.player];
    while (queue.length) {
      const at = queue.shift(); if (at === target) break;
      for (const dir of ['up', 'down', 'left', 'right']) {
        const to = stepFrom(at, dir);
        if (to >= 0 && !blocked.has(to) && !before.has(to)) { before.set(to, [at, dir]); queue.push(to); }
      }
    }
    assert.ok(before.has(target), 'the push spot can be reached');
    const dirs = [];
    for (let at = target; before.get(at); at = before.get(at)[0]) dirs.unshift(before.get(at)[1]);
    for (const dir of dirs) assert.equal(move(dir), true);
  };
  const solve = () => {
    const state = s(), chosen = state.boxes.find(b => b.state === 'chosen');
    const blocked = new Set([...state.rocks, ...state.boxes.filter(b => b !== chosen).map(b => b.cell)]);
    const { plan } = solvePush({ blocked, box: chosen.cell, player: state.player, goal: state.goal });
    for (const step of plan) { walkTo(step.from); assert.equal(move(step.direction), true); }
  };
  const next = () => { for (let i = 0; i < 30 && s().phase === 'cleared'; i++) game.update(100); };
  return { game, events, sessionId, s, choose, move, tool, solve, next };
}

test('every room can be solved: the answer box reaches the nest in 2 to 5 pushes with the other boxes still', () => {
  const count = {};
  for (let seed = 1; seed <= 600; seed++) {
    const room = buildRoom(seed % 4, seeded(seed));
    assert.ok(room, `room ${seed}`);
    assert.ok(room.boxes.every(at => !border(at)), 'no box against the wall');
    assert.ok(room.boxes.every(at => !['up', 'down', 'left', 'right'].some(d => stepFrom(room.goal, d) === at)), 'no box next to the nest');
    assert.equal(new Set([room.goal, room.player, ...room.rocks, ...room.boxes]).size, 2 + room.rocks.length + 4, 'nothing overlaps');
    const blocked = new Set([...room.rocks, ...room.boxes.filter((_, i) => i !== seed % 4)]);
    const solved = solvePush({ blocked, box: room.boxes[seed % 4], player: room.player, goal: room.goal });
    assert.equal(solved.pushes, room.fewest);
    assert.ok(room.fewest >= R.pushes[0] && room.fewest <= R.pushes[1]);
    count[room.fewest] = (count[room.fewest] || 0) + 1;
  }
  console.log(`push rooms: fewest pushes ${JSON.stringify(count)} in 600 rooms`);
});

test('the tap on a box is the learning result: a wrong box cracks, the answer glows, and the retry is not recorded', () => {
  const { s, choose, move, events } = newPush({ seed: 5 });
  const problem = s().problem;
  assert.equal(s().phase, 'choosing');
  assert.equal(move('up'), false, 'no walking before a box is chosen');
  const wrong = problem.choices.find(c => c.choiceId !== problem.correctChoiceId);
  assert.equal(choose(wrong.choiceId), true);
  let state = s();
  assert.equal(state.incorrect, 1); assert.equal(state.answered, 1); assert.equal(state.hintChoiceId, problem.correctChoiceId);
  assert.equal(state.boxes.find(b => b.boxId === wrong.choiceId).state, 'wrong');
  assert.equal(choose(wrong.choiceId), false, 'a cracked box cannot be chosen again');
  assert.equal(state.missed.length, 1); assert.ok(state.missed[0].build?.answer, 'the slip comes back to build at the end');
  assert.equal(choose(problem.correctChoiceId), true);
  state = s();
  assert.equal(state.phase, 'pushing'); assert.equal(state.answered, 1); assert.equal(state.correct, 0);
  assert.deepEqual(events.filter(e => ['correct', 'incorrect', 'retry', 'chosen'].includes(e.type)).map(e => e.type), ['incorrect', 'chosen']);
  assert.ok(state.boxes.every(b => b.boxId === problem.correctChoiceId ? b.state === 'chosen' : b.state !== 'idle'));
});

test('pushing the answer box onto the nest clears the room; the fewest pushes on the first try give ⭐3', () => {
  const { s, choose, solve, next, events } = newPush({ seed: 7 });
  choose(s().problem.correctChoiceId);
  const fewest = s().fewest;
  solve();
  let state = s();
  assert.equal(state.phase, 'cleared'); assert.equal(state.pushes, fewest);
  assert.equal(state.lastClear.stars, 3); assert.equal(state.stars, 3); assert.equal(state.friends, 1);
  assert.equal(events.filter(e => e.type === 'roomCleared').length, 1);
  next();
  state = s();
  assert.equal(state.room, 1); assert.equal(state.phase, 'choosing');
});

test('only the answer box moves; one step back and starting over restore the room', () => {
  const { s, choose, move, tool } = newPush({ seed: 9 });
  choose(s().problem.correctChoiceId);
  const start = s();
  // Two steps that the room allows (rocks and the other boxes always stop the companion).
  for (let made = 0, guard = 0; made < 2 && guard < 40; guard++) if (move(['up', 'left', 'down', 'right'][guard % 4])) made++;
  const moved = s();
  assert.equal(moved.moves, 2);
  assert.deepEqual(moved.boxes.filter(b => b.state === 'rock').map(b => b.cell), start.boxes.filter(b => b.state === 'rock').map(b => b.cell), 'the other boxes never move');
  assert.equal(moved.canUndo, true);
  assert.equal(tool('undo'), true);
  assert.equal(s().canUndo, true, 'one step is still there');
  assert.equal(tool('reset'), true);
  const back = s();
  assert.equal(back.player, start.player); assert.equal(back.pushes, 0); assert.equal(back.canUndo, false);
  assert.equal(back.boxes.find(b => b.state === 'chosen').cell, start.boxes.find(b => b.state === 'chosen').cell);
  assert.equal(tool('reset'), false, 'nothing to start over');
});

test('after a while the companion carries the box: the room clears with ⭐1, never a slip', () => {
  const { game, s, choose, tool, events } = newPush({ seed: 11, pace: 'slow' });
  choose(s().problem.correctChoiceId);
  assert.equal(tool('help'), false, 'not offered at once');
  for (let t = 0; t < R.helpAfterMs.slow; t += 100) game.update(100);
  assert.equal(s().canHelp, true);
  assert.equal(tool('help'), true);
  const state = s();
  assert.equal(state.phase, 'cleared'); assert.equal(state.lastClear.stars, 1); assert.equal(state.helped, 1);
  assert.equal(events.filter(e => e.type === 'incorrect').length, 0);
});

test('after choosing an answer, the child can hand over the pushing without another learning result', () => {
  const { game, s, choose, tool, events, next } = newPush({ seed: 15 });
  assert.equal(tool('carry'), false, 'answer choice comes first');
  choose(s().problem.correctChoiceId);
  const answers = events.filter(event => ['correct', 'incorrect'].includes(event.type)).length;
  game.setPaused(true); assert.equal(tool('carry'), false); game.setPaused(false);
  assert.equal(tool('carry'), true);
  assert.equal(s().phase, 'cleared'); assert.equal(s().helped, 1);
  assert.equal(events.filter(event => ['correct', 'incorrect'].includes(event.type)).length, answers);
  assert.equal(tool('carry'), false, 'cannot repeat the handover');
  next(); assert.equal(s().room, 1);
});

test('every room can be completed with the companion carrying after the answer', () => {
  const { s, choose, tool, next, events } = newPush({ seed: 17 });
  for (let room = 0; room < R.rooms; room++) {
    choose(s().problem.correctChoiceId);
    assert.equal(tool('carry'), true);
    next();
  }
  assert.equal(s().phase, 'completed');
  assert.equal(s().result.rooms, R.rooms);
  assert.equal(events.filter(event => ['correct', 'incorrect'].includes(event.type)).length, R.rooms);
  assert.equal(events.filter(event => event.type === 'sessionComplete').length, 1);
});

test('short course completes after five rooms with one chosen answer per room', () => {
  const { s, choose, tool, next, events } = newPush({ seed: 21, courseLength: 'short' });
  assert.equal(s().rooms, 5); assert.equal(s().total, 5);
  for (let room = 0; room < 5; room++) {
    assert.equal(choose(s().problem.correctChoiceId), true);
    assert.equal(tool('carry'), true); next();
  }
  assert.equal(s().phase, 'completed'); assert.equal(s().result.rooms, 5);
  assert.equal(events.filter(event => ['correct', 'incorrect'].includes(event.type)).length, 5);
  assert.equal(events.filter(event => event.type === 'sessionComplete').length, 1);
});

test('a whole run: ten rooms, one learning result each, a result and one sessionComplete', () => {
  for (const mode of ['kanji', 'english', 'math']) {
    const { game, s, choose, solve, next, events } = newPush({ seed: 13, mode });
    for (let room = 0; room < R.rooms; room++) {
      const problem = s().problem;
      if (room % 3 === 1) choose(problem.choices.find(c => c.choiceId !== problem.correctChoiceId).choiceId);
      choose(problem.correctChoiceId);
      solve();
      next();
    }
    const state = s();
    assert.equal(state.phase, 'completed', mode);
    assert.equal(state.result.answered, 10); assert.equal(state.result.correct, 7); assert.equal(state.result.incorrect, 3);
    assert.equal(state.result.stars, 7 * 3 + 3 * 1); assert.equal(state.result.friends, 10);
    assert.equal(events.filter(e => e.type === 'problemPresented').length, 10);
    assert.equal(events.filter(e => ['correct', 'incorrect'].includes(e.type)).length, 10);
    assert.equal(events.filter(e => e.type === 'sessionComplete').length, 1);
    game.exit(); game.exit();
    assert.equal(s().aborted, false);
  }
});

test('pause stops every command; content that cannot make ten rooms is refused', () => {
  const { game, s, choose, sessionId } = newPush({ seed: 15 });
  game.setPaused(true);
  assert.equal(choose(s().problem.correctChoiceId), false);
  game.setPaused(false);
  assert.equal(choose(s().problem.correctChoiceId), true);
  assert.equal(createPushGame({ sessionId, content: { problems: null } }).enter(), false);
  assert.equal(createPushGame({ sessionId, content: { problems: buildSlashProblems({ sessionId, random: seeded(1), mode: 'math' }).slice(0, 9) } }).enter(), false);
});
