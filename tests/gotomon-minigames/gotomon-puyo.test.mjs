import test from 'node:test';
import assert from 'node:assert/strict';
import { createPuyoGame, PUYO_RULES as R } from '../../src/minigames/gotomonPuyo/puyoGame.js';
import { createQuizWorld } from '../../src/minigames/gameplay/quizWorlds.js';
import { growthStatus } from '../../src/minigames/companionGrowth.js';

const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const evaluate = label => {
  const m = label.match(/^(\d+)([+−×])(\d+)$/);
  return m ? (m[2] === '+' ? +m[1] + +m[3] : m[2] === '−' ? m[1] - m[3] : m[1] * m[3]) : Number(label);
};

function newPuyo({ seed = 3, level = 'addsub', pace = 'normal' } = {}) {
  const events = [], sessionId = `puyo${seed}`;
  const game = createPuyoGame({ sessionId, random: seeded(seed), pace, onEvent: event => events.push(event), content: { level } });
  assert.equal(game.enter(), true);
  const act = (type, extra = {}) => game.dispatch({ type, payload: { sessionId, attemptId: game.snapshot().attemptId, ...extra } });
  const next = () => game.dispatch({ type: 'next', payload: { sessionId } });
  const tick = ms => { for (let t = 0; t < ms; t += 16) game.update(16); };
  // Finds the column where the first egg lands next to an egg with its answer.
  const goodColumn = () => {
    const s = game.snapshot(), v = s.piece.eggs[0].value;
    for (let c = 0; c < R.columns; c++) {
      let top = R.rows; for (let r = 0; r < R.rows; r++) if (s.grid[r][c]) { top = r; break; }
      const land = top - 1; if (land < 1) continue;
      if ([[land + 1, c], [land, c - 1], [land, c + 1]].some(([r, cc]) => s.grid[r]?.[cc]?.value === v)) return c;
    }
    return null;
  };
  return { game, events, sessionId, act, next, tick, goodColumn };
}

test('every egg label works out to its value; a run uses four answers', () => {
  for (const level of ['addsub', 'times']) {
    const { game, act, next } = newPuyo({ level });
    const values = new Set();
    for (let i = 0; i < 6; i++) {
      for (const egg of game.snapshot().piece.eggs) { assert.equal(evaluate(egg.label), egg.value, egg.label); values.add(egg.value); }
      act('drop'); next();
    }
    assert.ok(values.size <= R.values);
  }
});

test('the pair falls by itself, faster than on ゆっくり, and stops while paused', () => {
  const fast = newPuyo(), slow = newPuyo({ pace: 'slow' });
  const row = fast.game.snapshot().piece.row;
  fast.tick(1000); slow.tick(1000);
  assert.ok(fast.game.snapshot().piece.row > row);
  assert.ok(fast.game.snapshot().piece.row > slow.game.snapshot().piece.row);
  fast.game.setPaused(true); const held = fast.game.snapshot().piece.row; fast.tick(3000);
  assert.equal(fast.game.snapshot().piece.row, held);
  fast.game.setPaused(false);
  // Left alone, it lands on the floor and waits for the next pair.
  fast.tick(15000);
  assert.equal(fast.game.snapshot().phase, 'feedback');
});

test('moving, turning and dropping stay inside the well', () => {
  const { game, act } = newPuyo();
  assert.equal(act('move', { column: 0 }), true); assert.equal(game.snapshot().piece.column, 0);
  assert.equal(act('shift', { direction: -1 }), false);
  for (let i = 0; i < 4; i++) {
    assert.equal(act('rotate'), true);
    assert.ok(game.snapshot().piece.cells.every(([, c]) => c >= 0 && c < R.columns));
  }
  assert.equal(act('move', { column: R.columns - 1 }), true);
  assert.ok(game.snapshot().piece.cells.every(([, c]) => c < R.columns));
  const landing = game.snapshot().piece.landing;
  assert.equal(act('drop'), true);
  const grid = game.snapshot().grid;
  assert.ok(grid[R.rows - 1].some(Boolean) && landing >= R.rows - 2);
});

test('three touching eggs with the same answer hatch, and eggs above fall; each pair is one result', () => {
  let hatchedSomewhere = false;
  for (const seed of [1, 2, 3, 4, 5]) {
    const { game, events, act, next, goodColumn } = newPuyo({ seed });
    while (game.snapshot().phase !== 'completed') {
      const column = goodColumn();
      if (column !== null) act('move', { column });
      act('drop');
      const answer = game.snapshot().lastAnswer;
      for (const wave of answer.waves) for (const group of wave) {
        assert.ok(group.length >= 3);
        assert.equal(new Set(group.map(item => item.value)).size, 1);
        hatchedSomewhere = true;
      }
      // Nothing floats after the pair settles.
      const grid = game.snapshot().grid;
      for (let r = 0; r < R.rows - 1; r++) for (let c = 0; c < R.columns; c++) if (grid[r][c]) assert.ok(grid[r + 1][c], `floating egg at ${r},${c}`);
      next();
    }
    const { result } = game.snapshot();
    assert.equal(result.answered, R.pieces);
    assert.equal(events.filter(event => ['correct', 'incorrect'].includes(event.type)).length, R.pieces);
    assert.equal(events.filter(event => event.type === 'sessionComplete').length, 1);
  }
  assert.ok(hatchedSomewhere);
});

test('a pair touching no egg with its answer is a gentle miss that names both answers', () => {
  const { game, events, act } = newPuyo({ seed: 6 });
  act('drop'); // the first pair lands on an empty floor: nothing to touch
  const answer = game.snapshot().lastAnswer;
  assert.equal(answer.correct, false); assert.equal(events.at(-1).type, 'incorrect');
  assert.deepEqual(game.snapshot().missed.at(-1).answers, answer.eggs.map(e => e.value));
  const sum = answer.eggs.find(e => /[+−×]/.test(e.label));
  assert.equal(game.snapshot().missed.at(-1).build?.answer ?? null, sum ? `${sum.label}=${sum.value}` : null);
});

test('a full well never ends the game: the bottom rows are tidied away', () => {
  const { game, act, next } = newPuyo({ seed: 8 });
  let tidied = 0;
  for (let i = 0; i < R.pieces && game.snapshot().phase !== 'completed'; i++) {
    act('move', { column: R.spawn.column }); act('drop'); next();
    tidied = game.snapshot().tidied ?? game.snapshot().result?.tidied ?? tidied;
  }
  assert.ok(tidied >= 1, 'stacking in one column filled the well');
  assert.equal(game.snapshot().phase, 'completed');
});

test('old attempts and paused moves are refused', () => {
  const { game, sessionId, act, next } = newPuyo({ seed: 9 });
  const { attemptId } = game.snapshot();
  act('drop'); next();
  assert.equal(game.dispatch({ type: 'drop', payload: { sessionId, attemptId } }), false);
  game.setPaused(true); assert.equal(act('rotate'), false); game.setPaused(false);
  assert.equal(act('move', { column: 1.5 }), false);
});

test('the puyo world counts hatched Gotomon and chains', () => {
  const world = createQuizWorld('puyo', growthStatus().effects);
  world.context({ mode: 'puyo', phase: 'feedback', problem: { problemId: 'p' }, hatched: 3, bestChain: 2 });
  world.answer(true, {}, 1);
  assert.match(world.snapshot().summary, /たまごを1組つんだ · ゴトモンが3ひき うまれた · 最大2れんさ/);
});
