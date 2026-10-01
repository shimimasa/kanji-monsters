import test from 'node:test';
import assert from 'node:assert/strict';
import { createBreakoutGame, BREAKOUT_RULES as R } from '../../src/minigames/gotomonBreakout/breakoutGame.js';
import { createQuizWorld } from '../../src/minigames/gameplay/quizWorlds.js';
import { growthStatus } from '../../src/minigames/companionGrowth.js';

const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

function newBreakout({ seed = 3, level = 'addsub', pace = 'normal' } = {}) {
  const events = [], sessionId = `brk${seed}`;
  const game = createBreakoutGame({ sessionId, random: seeded(seed), pace, onEvent: event => events.push(event), content: { level } });
  assert.equal(game.enter(), true);
  const act = (type, extra = {}) => game.dispatch({ type, payload: { sessionId, attemptId: game.snapshot().attemptId, ...extra } });
  const next = () => game.dispatch({ type: 'next', payload: { sessionId } });
  // Keeps the paddle under the ball, leaning so it heads for the answer block.
  const play = (ms, { aim = true } = {}) => {
    for (let t = 0; t < ms && game.snapshot().phase === 'answering'; t += 16) {
      const s = game.snapshot(), target = s.blocks.find(b => b.number === s.problem.answer);
      const lean = aim && target ? Math.max(-1, Math.min(1, (target.x + target.w / 2 - s.ball.x) / 6)) : 0;
      act('steer', { x: s.ball.x - lean * R.paddleWidth * 0.4 });
      game.update(16);
    }
  };
  // Taps the block with the answer (or another one), as the child does first.
  const choose = (pick = s => s.blocks.find(b => b.number === s.problem.answer)) => act('choose', { blockId: pick(game.snapshot()).blockId });
  return { game, events, sessionId, act, next, play, choose };
}

test('every question writes the answer on exactly one reachable block', () => {
  for (const level of ['addsub', 'times']) {
    const { game, next, play, choose } = newBreakout({ level, seed: 5 });
    while (game.snapshot().phase !== 'completed') {
      const s = game.snapshot();
      const answers = s.blocks.filter(b => b.number === s.problem.answer);
      assert.equal(answers.length, 1, s.problem.question);
      const [a] = answers;
      assert.ok(!s.blocks.some(b => b.column === a.column && b.row > a.row), 'nothing below the answer');
      assert.ok(s.blocks.every(b => Number.isInteger(b.number) && b.number >= 0));
      choose(); play(4 * 60 * 1000); next();
    }
  }
});

test('the ball never gets stuck: every run finishes, and only answers break', () => {
  for (const level of ['addsub', 'times']) {
    for (const seed of [1, 2, 3, 4]) {
      const { game, events, next, play, choose } = newBreakout({ level, seed });
      let guard = 0;
      while (game.snapshot().phase !== 'completed' && guard++ < 40) {
        const before = game.snapshot().blocks.length;
        assert.equal(choose(), true);
        play(4 * 60 * 1000);
        const s = game.snapshot();
        assert.equal(s.phase, 'feedback', `${level} ${seed}: question ${s.question + 1} was solved in time`);
        assert.equal(before - s.blocks.length, s.lastAnswer.broken.length);
        assert.ok(s.lastAnswer.broken.length >= 1 && s.lastAnswer.broken.length <= 5);
        next();
      }
      const { result } = game.snapshot();
      assert.equal(result.answered, 12); assert.equal(result.freed, 12);
      assert.equal(events.filter(event => ['correct', 'incorrect'].includes(event.type)).length, 12);
      assert.equal(events.filter(event => event.type === 'sessionComplete').length, 1);
    }
  }
});

test('the first tapped block is the answer: a wrong one names its number and the answer glows; bounces never count', () => {
  const { game, events, play, choose, act } = newBreakout({ seed: 6 });
  const s0 = game.snapshot();
  assert.equal(choose(s => s.blocks.find(b => b.number !== s.problem.answer)), true);
  let s = game.snapshot();
  assert.equal(s.lastChoice.correct, false);
  assert.equal(s.blocks.find(b => b.blockId === s.hintId)?.number, s0.problem.answer);
  assert.equal(s.ball.held, true); assert.equal(act('launch'), false, 'the ball waits for the answer');
  assert.equal(s.missed.length, 1);
  assert.equal(choose(), true);
  s = game.snapshot();
  assert.equal(s.chosenId, s.blocks.find(b => b.number === s.problem.answer).blockId);
  assert.equal(choose(), false, 'chosen: no more taps');
  // Play without aiming: many stray bounces, but no more results; after three the companion aims at the chosen block.
  play(3 * 60 * 1000, { aim: false });
  const judged = events.filter(event => ['correct', 'incorrect'].includes(event.type));
  assert.deepEqual(judged.map(e => e.type), ['incorrect']);
  assert.equal(game.snapshot().answered, 1);
  assert.equal(game.snapshot().phase, 'feedback');
  assert.equal(game.snapshot().lastAnswer.first, false);
  // Right the first time: correct, and the stray bounces before the break change nothing.
  const other = newBreakout({ seed: 8 });
  other.choose(); other.play(3 * 60 * 1000, { aim: false });
  assert.deepEqual(other.events.filter(event => ['correct', 'incorrect'].includes(event.type)).map(e => e.type), ['correct']);
  assert.equal(other.game.snapshot().lastAnswer.first, true);
});

test('once the answer glows, a paddle bounce heads straight for it, so nobody stays stuck', () => {
  for (const seed of [12, 13, 14]) {
    const { game, act, choose } = newBreakout({ seed });
    choose();
    // Follow the ball dead-centre without aiming: the help must bring the answer down.
    for (let t = 0; t < 5 * 60 * 1000 && game.snapshot().phase === 'answering'; t += 16) {
      act('steer', { x: game.snapshot().ball.x }); game.update(16);
    }
    assert.equal(game.snapshot().phase, 'feedback', `seed ${seed}`);
  }
});

test('the ball waits on the paddle until the answer is chosen, then launches by itself or on a tap, and comes back when dropped', () => {
  const { game, act, choose } = newBreakout({ seed: 9 });
  assert.equal(game.snapshot().ball.held, true);
  for (let t = 0; t < R.autoLaunchMs * 3; t += 16) game.update(16);
  assert.equal(game.snapshot().ball.held, true, 'no launch before a choice');
  act('steer', { x: 2 }); game.update(16);
  assert.equal(game.snapshot().ball.x, game.snapshot().paddle.x);
  choose();
  assert.equal(act('launch'), true); assert.equal(game.snapshot().ball.held, false);
  const other = newBreakout({ seed: 10 });
  other.choose();
  for (let t = 0; t < R.autoLaunchMs + 50; t += 16) other.game.update(16);
  assert.equal(other.game.snapshot().ball.held, false);
  // Paddle away from the ball: it drops and comes back held; no game over.
  for (let t = 0; t < 20000 && other.game.snapshot().drops === 0 && other.game.snapshot().phase === 'answering'; t += 16) {
    const s = other.game.snapshot(); other.act('steer', { x: s.ball.x < R.width / 2 ? R.width : 0 }); other.game.update(16);
  }
  if (other.game.snapshot().phase === 'answering') {
    assert.ok(other.game.snapshot().drops >= 1); assert.equal(other.game.snapshot().ball.held, true);
  }
  // Paddle stays inside; ゆっくり is slower.
  act('steer', { x: 99 }); assert.equal(game.snapshot().paddle.x, R.width - R.paddleWidth / 2);
  assert.ok(R.speedPerMs.slow < R.speedPerMs.normal);
});

test('old attempts and paused commands are refused', () => {
  const { game, sessionId, act } = newBreakout({ seed: 11 });
  game.setPaused(true); assert.equal(act('launch'), false); assert.equal(act('steer', { x: 3 }), false); assert.equal(act('choose', { blockId: game.snapshot().blocks[0].blockId }), false); game.setPaused(false);
  assert.equal(act('choose', { blockId: 'nope' }), false);
  assert.equal(game.dispatch({ type: 'launch', payload: { sessionId, attemptId: 'old' } }), false);
  assert.equal(act('steer', { x: Number.NaN }), false);
});

test('the breakout world summarises broken answer blocks', () => {
  const world = createQuizWorld('breakout', growthStatus().effects);
  world.context({ mode: 'breakout', phase: 'answering', problem: { problemId: 'p' } });
  world.answer(true, {}, 1); world.answer(false, {}, 0);
  assert.match(world.snapshot().summary, /答えのブロックを2こ パカーン · ゴトモンが2ひき出てきた · 1回で えらべた 1こ/);
});
