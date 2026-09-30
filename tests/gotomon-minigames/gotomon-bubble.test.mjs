import test from 'node:test';
import assert from 'node:assert/strict';
import { labelsFor, labelFor, pickValues } from '../../src/minigames/gotomonBubble/bubbleContent.js';
import { createBubbleGame, createGeometry, tracePath, predictShot, SCAN_ANGLES, BUBBLE_RULES as R } from '../../src/minigames/gotomonBubble/bubbleGame.js';
import { createQuizWorld } from '../../src/minigames/gameplay/quizWorlds.js';
import { growthStatus } from '../../src/minigames/companionGrowth.js';

const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const carriers = ['ジャガイモスライム', 'ミルクフェアリー', 'カニクラブ', 'サケウォリアー', 'アイヌフクロウ'].map((name, i) => ({ id: `g${i}`, name, imageUrl: `${i}.png` }));
const evaluate = label => {
  const m = label.match(/^(\d+)([+−×])(\d+)$/);
  return m ? (m[2] === '+' ? +m[1] + +m[3] : m[2] === '−' ? m[1] - m[3] : m[1] * m[3]) : Number(label);
};

function newBubble({ seed = 3, level = 'addsub' } = {}) {
  const events = [], sessionId = `bubble${seed}`;
  const game = createBubbleGame({ sessionId, random: seeded(seed), onEvent: event => events.push(event), content: { level, carriers } });
  assert.equal(game.enter(), true);
  const shoot = angle => game.dispatch({ type: 'shoot', payload: { sessionId, attemptId: game.snapshot().attemptId, angle } });
  const next = () => game.dispatch({ type: 'next', payload: { sessionId } });
  const angleFor = want => SCAN_ANGLES.find(angle => { const s = game.snapshot(); return want(predictShot(s.bubbles, s.shift, angle).touching, s); });
  const good = () => angleFor((touching, s) => touching.some(bubble => bubble.value === s.loaded.value));
  const bad = () => angleFor((touching, s) => touching.length && !touching.some(bubble => bubble.value === s.loaded.value));
  return { game, events, sessionId, shoot, next, good, bad };
}

test('every label on a bubble works out to its value', () => {
  for (const level of ['addsub', 'times']) {
    for (let seed = 1; seed <= 20; seed++) {
      const values = pickValues(level, seeded(seed));
      assert.equal(new Set(values).size, 5);
      for (const value of values) {
        const labels = labelsFor(value, level);
        assert.ok(labels.length >= 2, `${level} ${value}`);
        for (const label of labels) assert.equal(evaluate(label), value, label);
        if (level === 'addsub') for (const label of labels) assert.ok(label.split(/[+−]/).every(n => +n >= 1 && +n <= 20), label);
        else for (const label of labels.slice(1)) assert.ok(label.split('×').every(n => +n >= 2 && +n <= 9), label);
        assert.ok(labels.includes(labelFor(value, level, seeded(seed))));
      }
    }
  }
});

test('the honeycomb geometry: neighbours are one bubble apart and the ball bounces off the walls', () => {
  for (const shift of [0, 1]) {
    const geo = createGeometry(shift);
    for (let row = 0; row < R.maxRows; row++) for (let column = 0; column < geo.width(row); column++) {
      const a = geo.center(row, column);
      assert.ok(a.x >= 0.5 && a.x <= R.columns - 0.5);
      for (const [r, c] of geo.neighbours(row, column)) {
        const b = geo.center(r, c);
        assert.ok(Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - 1) < 1e-9, `${row},${column} → ${r},${c}`);
      }
    }
  }
  // Straight up reaches the ceiling above the shooter; a low angle bounces.
  const up = tracePath([], Math.PI / 2);
  assert.ok(Math.abs(up.end.x - R.shooter.x) < 1e-6 && up.end.y <= 0.5 + 1e-9);
  const side = tracePath([], R.minAngle);
  assert.ok(side.points.length > 2, 'bounced');
  assert.ok(side.points.every(point => point.x >= 0.5 - 1e-9 && point.x <= R.columns - 0.5 + 1e-9));
});

test('a shot touching the same answer sticks; three or more pop, and cut-off bubbles fall', () => {
  const { game, events, shoot, next, good } = newBubble();
  let popped = false;
  for (let i = 0; i < 15 && game.snapshot().phase !== 'completed'; i++) {
    const before = game.snapshot();
    assert.equal(shoot(good()), true);
    const after = game.snapshot(), answer = after.lastAnswer;
    assert.equal(answer.correct, true);
    assert.ok(answer.touched.some(bubble => bubble.value === before.loaded.value));
    if (answer.popped.length) {
      popped = true;
      assert.ok(answer.popped.length >= 3);
      assert.equal(after.bubbles.length, before.bubbles.length + 1 - answer.popped.length - answer.dropped.length);
    } else assert.equal(after.bubbles.length, before.bubbles.length + 1);
    // Everything left still hangs from the ceiling.
    const geo = createGeometry(after.shift), at = new Map(after.bubbles.map(b => [`${b.row},${b.column}`, b]));
    const seen = new Set(), stack = after.bubbles.filter(b => b.row === 0);
    while (stack.length) { const b = stack.pop(); if (seen.has(b)) continue; seen.add(b); for (const [r, c] of geo.neighbours(b.row, b.column)) { const o = at.get(`${r},${c}`); if (o) stack.push(o); } }
    assert.equal(seen.size, after.bubbles.length);
    next();
  }
  assert.ok(popped);
  assert.ok(events.filter(event => event.type === 'correct').length >= 1);
});

test('a miss bounces back: one learning result, reachable matches glow, the same bubble stays loaded', () => {
  const { game, events, shoot, next, bad, good } = newBubble({ seed: 5 });
  const before = game.snapshot(), angle = bad();
  assert.ok(angle, 'an angle that touches only other answers');
  assert.equal(shoot(angle), true);
  const after = game.snapshot();
  assert.equal(after.lastAnswer.correct, false);
  assert.equal(after.bubbles.length, before.bubbles.length); // nothing sticks
  assert.equal(events.at(-1).type, 'incorrect');
  assert.equal(after.missed.at(-1).label, before.loaded.label);
  next();
  const retry = game.snapshot();
  assert.equal(retry.loaded.loadId, before.loaded.loadId);
  assert.notEqual(retry.problem.problemId, before.problem.problemId);
  assert.ok(retry.hintIds.length >= 1);
  for (const id of retry.hintIds) assert.equal(retry.bubbles.find(b => b.bubbleId === id).value, before.loaded.value);
  assert.equal(shoot(good()), true); assert.equal(events.at(-1).type, 'stuck');
  assert.equal(events.filter(event => ['correct', 'incorrect'].includes(event.type)).length, 1);
});

test('every loaded bubble can reach its answer; a run ends after 15 or when the board is clear, freeing Gotomon', () => {
  for (const level of ['addsub', 'times']) {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const { game, events, shoot, next, good } = newBubble({ seed, level });
      let guard = 0;
      while (game.snapshot().phase !== 'completed' && guard++ < 40) {
        const angle = good();
        assert.ok(angle !== undefined, `${level} ${seed}: loaded ${game.snapshot().loaded.label} has somewhere to go`);
        shoot(angle); next();
      }
      const { result, freed } = game.snapshot();
      assert.ok(result, `${level} ${seed} finished`);
      assert.ok(result.answered === R.shots || result.cleared);
      assert.equal(result.freed, freed.length);
      assert.ok(freed.every(g => carriers.some(c => c.name === g.name)));
      assert.equal(events.filter(event => event.type === 'sessionComplete').length, 1);
    }
  }
});

test('Gotomon start trapped in the upper rows; old attempts, paused shots and bad angles are refused', () => {
  const { game, sessionId, shoot, good, next } = newBubble({ seed: 7 });
  const trapped = game.snapshot().bubbles.filter(bubble => bubble.gotomon);
  assert.equal(trapped.length, R.trapped);
  assert.ok(trapped.every(bubble => bubble.row <= 2));
  const { attemptId } = game.snapshot();
  shoot(good()); next();
  assert.equal(game.dispatch({ type: 'shoot', payload: { sessionId, attemptId, angle: Math.PI / 2 } }), false);
  assert.equal(shoot(Number.NaN), false);
  game.setPaused(true); assert.equal(shoot(good()), false); game.setPaused(false);
  // Without Gotomon the board still plays.
  const bare = createBubbleGame({ sessionId: 'x', random: seeded(2), content: {} });
  assert.equal(bare.enter(), true); assert.equal(bare.snapshot().bubbles.filter(b => b.gotomon).length, 0);
});

test('the bubble world counts broken bubbles and freed Gotomon', () => {
  const world = createQuizWorld('bubble', growthStatus().effects);
  world.context({ mode: 'bubble', phase: 'answering', problem: { problemId: 'p' }, popped: 0, dropped: 0, freed: [] });
  world.context({ mode: 'bubble', phase: 'feedback', problem: { problemId: 'p' }, popped: 7, dropped: 2, freed: [{ name: 'a' }, { name: 'b' }] });
  assert.equal(world.snapshot().bubbleFreed, 2);
  assert.match(world.snapshot().summary, /泡を9こ わった · ゴトモンを2ひき たすけた/);
});
