import test from 'node:test';
import assert from 'node:assert/strict';
import { COLORING_PICTURES } from '../../src/minigames/gotomonColoring/pictures.js';
import { createColoringGame, COLORING_RULES as R } from '../../src/minigames/gotomonColoring/coloringGame.js';

const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const answerOf = label => label.includes('×') ? label.split('×').reduce((a, b) => a * b, 1)
  : label.includes('+') ? label.split('+').reduce((a, b) => a + Number(b), 0)
  : label.includes('−') ? label.split('−').map(Number).reduce((a, b) => a - b) : Number(label);

function newColoring({ seed = 3, level = 'addsub', id = 'HKD-E01' } = {}) {
  const events = [], sessionId = `col${seed}`;
  const [grid, ...palette] = COLORING_PICTURES[id];
  const game = createColoringGame({ sessionId, random: seeded(seed), onEvent: event => events.push(event),
    content: { level, picture: { id, name: 'テスト', grid, palette, imageUrl: '/x.png' } } });
  assert.equal(game.enter(), true);
  const paint = cell => game.dispatch({ type: 'paint', payload: { sessionId, attemptId: game.snapshot().attemptId, cellId: cell.cellId } });
  const choose = color => game.dispatch({ type: 'choose', payload: { sessionId, color } });
  return { game, events, sessionId, paint, choose };
}

test('every picture is a 10x10 grid of up to three colours with 28–80 squares to paint', () => {
  const ids = Object.keys(COLORING_PICTURES);
  assert.ok(ids.length >= 400, `${ids.length} pictures`);
  for (const id of ids) {
    const [grid, ...palette] = COLORING_PICTURES[id];
    assert.equal(grid.length, R.size * R.size, id);
    assert.match(grid, /^[.012]+$/, id);
    assert.ok(palette.length >= 1 && palette.length <= 3, id);
    palette.forEach(color => assert.match(color, /^#[0-9a-f]{6}$/, id));
    const solid = [...grid].filter(mark => mark !== '.');
    assert.ok(solid.length >= 28 && solid.length <= 80, id);
    for (let color = 0; color < palette.length; color++) assert.ok(solid.includes(String(color)), `${id} colour ${color} unused`);
    assert.ok(solid.every(mark => Number(mark) < palette.length), id);
  }
});

test('each colour has its own answer and every square is a calculation for its colour', () => {
  for (const level of ['addsub', 'times']) {
    for (let seed = 1; seed <= 8; seed++) {
      const { game } = newColoring({ seed, level });
      const state = game.snapshot();
      assert.equal(new Set(state.values).size, state.values.length);
      for (const cell of state.cells) {
        assert.equal(cell.value, state.values[cell.color]);
        assert.notEqual(cell.label, String(cell.value));
        assert.equal(answerOf(cell.label), cell.value, cell.label);
      }
      assert.equal(state.total, [...COLORING_PICTURES['HKD-E01'][0]].filter(m => m !== '.').length);
    }
  }
});

test('a wrong colour leaves the square blank and says its answer; the first tap is the learning result', () => {
  const { game, events, paint } = newColoring();
  const state = game.snapshot();
  const other = state.cells.find(cell => cell.color !== state.selected);
  assert.equal(paint(other), true);
  let after = game.snapshot();
  assert.equal(after.cells.find(c => c.cellId === other.cellId).painted, false);
  assert.equal(after.lastTap.correct, false);
  assert.equal(after.lastTap.value, other.value);
  assert.equal(after.lastTap.chosenValue, state.values[state.selected]);
  assert.equal(after.incorrect, 1);
  assert.equal(after.missed.length, 1);
  // The same square with its own colour paints it, but is not a second learning result.
  game.dispatch({ type: 'choose', payload: { sessionId: after.sessionId, color: other.color } });
  assert.equal(paint(other), true);
  after = game.snapshot();
  assert.equal(after.cells.find(c => c.cellId === other.cellId).painted, true);
  assert.equal(after.answered, 1);
  assert.deepEqual(events.filter(e => ['correct', 'incorrect', 'painted', 'retry'].includes(e.type)).map(e => e.type), ['incorrect', 'painted']);
  // Every tap is its own problem id.
  const ids = events.filter(e => e.type !== 'problemPresented').map(e => e.problemId);
  assert.equal(new Set(ids).size, ids.length);
  // A painted square cannot be painted again.
  assert.equal(paint(other), false);
});

test('painting every square completes the picture; a finished colour hands over to the next', () => {
  for (const [id, level] of [['HKD-E01', 'addsub'], [Object.keys(COLORING_PICTURES).at(-1), 'times']]) {
    const { game, events, paint } = newColoring({ id, level, seed: 9 });
    let guard = 0;
    while (game.snapshot().phase === 'answering' && guard++ < 200) {
      const state = game.snapshot();
      if (state.left[state.selected] === 0) assert.fail('selected colour has nothing left');
      assert.equal(paint(state.cells.find(cell => !cell.painted && cell.color === state.selected)), true);
    }
    const end = game.snapshot();
    assert.equal(end.phase, 'completed');
    assert.equal(end.painted, end.total);
    assert.equal(end.correct, end.total);
    assert.equal(end.result.accuracy, 1);
    assert.equal(end.picture.imageUrl, '/x.png');
    assert.equal(events.at(-1).type, 'sessionComplete');
    assert.equal(events.filter(e => e.type === 'correct').length, end.total);
  }
});

test('commands are refused while paused, with a stale attempt, or from another session', () => {
  const { game, sessionId, paint } = newColoring();
  const state = game.snapshot(), cell = state.cells.find(c => c.color === state.selected);
  assert.equal(game.dispatch({ type: 'paint', payload: { sessionId: 'other', attemptId: state.attemptId, cellId: cell.cellId } }), false);
  assert.equal(game.dispatch({ type: 'paint', payload: { sessionId, attemptId: 'stale', cellId: cell.cellId } }), false);
  game.setPaused(true);
  assert.equal(paint(cell), false);
  assert.equal(game.dispatch({ type: 'choose', payload: { sessionId, color: 1 } }), false);
  game.setPaused(false);
  assert.equal(paint(cell), true);
  game.exit();
  assert.equal(game.snapshot().aborted, true);
});

test('a missing or broken picture does not start', () => {
  assert.equal(createColoringGame({ sessionId: 's', content: null }).enter(), false);
  assert.equal(createColoringGame({ sessionId: 's', content: { picture: { id: 'x', name: 'x', grid: 'abc', palette: ['#000000'] } } }).enter(), false);
  assert.equal(createColoringGame({ sessionId: 's', content: { picture: { id: 'x', name: 'x', grid: '1'.padEnd(100, '.'), palette: ['#000000'] } } }).enter(), false);
});


test('the finished picture stays on screen for a moment before the results', async () => {
  const { createQuizWorld } = await import('../../src/minigames/gameplay/quizWorlds.js');
  const world = createQuizWorld('coloring', { potency: 1 });
  assert.equal(world.snapshot().holdResult, false);
  world.complete();
  assert.equal(world.snapshot().holdResult, true);
  world.update(2000);
  assert.equal(world.snapshot().holdResult, true);
  world.update(1000);
  assert.equal(world.snapshot().holdResult, false);
  assert.equal(createQuizWorld('slash', { potency: 1 }).snapshot().holdResult, undefined);
});
