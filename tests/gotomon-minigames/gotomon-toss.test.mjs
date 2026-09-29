import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTossProblems, nearbyNumbers, TOSS_PROBLEMS, TOSS_BASKETS } from '../../src/minigames/gotomonToss/tossContent.js';
import { createTossGame, TOSS_RULES } from '../../src/minigames/gotomonToss/tossGame.js';
import { createQuizWorld } from '../../src/minigames/gameplay/quizWorlds.js';
import { growthStatus } from '../../src/minigames/companionGrowth.js';

const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const carriers = [{ name: 'ジャガイモスライム', imageUrl: 'a.png' }, { name: 'ミルクフェアリー', imageUrl: 'b.png' }];

function newToss({ seed = 3, level = 'addsub', pace = 'normal' } = {}) {
  const events = [], sessionId = `toss${seed}`;
  const game = createTossGame({ sessionId, random: seeded(seed), pace, onEvent: event => events.push(event),
    content: { carriers, problems: buildTossProblems({ sessionId, random: seeded(seed + 1), level }) } });
  assert.equal(game.enter(), true);
  const toss = basketId => game.dispatch({ type: 'throw', payload: { sessionId, attemptId: game.snapshot().attemptId, basketId } });
  const next = () => game.dispatch({ type: 'next', payload: { sessionId } });
  const score = () => { toss(game.snapshot().problem.correctChoiceId); next(); };
  return { game, events, sessionId, toss, next, score };
}

test('both levels make twelve problems with four distinct baskets, one holding the answer', () => {
  for (const level of ['addsub', 'times']) {
    for (let seed = 1; seed <= 40; seed++) {
      const problems = buildTossProblems({ sessionId: 's', random: seeded(seed), level });
      assert.equal(problems.length, TOSS_PROBLEMS);
      assert.equal(new Set(problems.map(item => item.question)).size, TOSS_PROBLEMS);
      for (const item of problems) {
        assert.equal(item.numbers.length, TOSS_BASKETS, item.question);
        assert.equal(new Set(item.numbers).size, TOSS_BASKETS, item.question);
        assert.equal(item.numbers.filter(value => value === item.answer).length, 1);
        assert.ok(item.numbers.every(value => Number.isInteger(value) && value >= 0));
        const [a, op, b] = item.question.split(' ');
        assert.equal(item.answer, op === '+' ? +a + +b : op === '−' ? a - b : a * b);
        if (level === 'times') { assert.equal(op, '×'); assert.ok(+a >= 2 && +b >= 2 && +a <= 9 && +b <= 9); }
        else { assert.ok(['+', '−'].includes(op)); assert.ok(item.answer <= 20); }
      }
      if (level === 'addsub') assert.equal(problems.filter(item => item.operation === 'addition').length, TOSS_PROBLEMS / 2);
    }
  }
  // Likely slips: one off, the other operation, a neighbour in the times table.
  assert.ok(nearbyNumbers({ operation: 'multiplication', a: 6, b: 7, answer: 42 }).includes(36));
  assert.ok(nearbyNumbers({ operation: 'subtraction', a: 9, b: 3, answer: 6 }).includes(12));
  assert.ok(!nearbyNumbers({ operation: 'subtraction', a: 2, b: 1, answer: 1 }).some(value => value < 0));
});

test('baskets keep walking inside the field, faster on later problems, slower on ゆっくり, never while paused', () => {
  const { game } = newToss();
  const before = game.snapshot().baskets.map(basket => basket.x);
  game.update(500);
  const moved = game.snapshot().baskets.map(basket => basket.x);
  assert.ok(moved.every((x, i) => x !== before[i]));
  for (let i = 0; i < 200; i++) game.update(100);
  assert.ok(game.snapshot().baskets.every(basket => basket.x >= TOSS_RULES.minX && basket.x <= TOSS_RULES.maxX));
  game.setPaused(true); const still = game.snapshot().baskets.map(basket => basket.x); game.update(1000);
  assert.deepEqual(game.snapshot().baskets.map(basket => basket.x), still); game.setPaused(false);
  const distance = (options, prepare = () => {}) => { const run = newToss(options); prepare(run); const a = run.game.snapshot().baskets[0].x; run.game.update(50); return Math.abs(run.game.snapshot().baskets[0].x - a); };
  assert.ok(distance({ pace: 'slow' }) < distance({}));
  assert.ok(distance({}, run => { for (let i = 0; i < 6; i++) run.score(); }) > distance({}));
  // Baskets still walk during feedback.
  const run = newToss({ seed: 8 });
  run.toss(run.game.snapshot().problem.correctChoiceId);
  assert.equal(run.game.snapshot().phase, 'feedback');
  const during = run.game.snapshot().baskets[0].x; run.game.update(200);
  assert.notEqual(run.game.snapshot().baskets[0].x, during);
});

test('twelve balls in end the run with one result; the carriers are the given Gotomon', () => {
  const { game, events, score } = newToss({ level: 'times' });
  assert.deepEqual([...new Set(game.snapshot().baskets.map(basket => basket.name))].sort(), carriers.map(item => item.name).sort());
  while (game.snapshot().phase !== 'completed') score();
  const { result } = game.snapshot();
  assert.equal(result.scored, TOSS_PROBLEMS); assert.equal(result.correct, TOSS_PROBLEMS); assert.equal(result.finished, true);
  assert.equal(events.filter(event => event.type === 'correct').length, TOSS_PROBLEMS);
  assert.equal(events.filter(event => event.type === 'sessionComplete').length, 1);
  assert.equal(game.snapshot().baskets.reduce((sum, basket) => sum + basket.balls, 0), TOSS_PROBLEMS);
});

test('a miss is one learning result; the answer basket glows and the same problem stays until the ball goes in', () => {
  const { game, events, toss, next } = newToss({ seed: 5 });
  const state = game.snapshot(), want = state.problem.correctChoiceId;
  const wrong = state.baskets.find(basket => basket.basketId !== want);
  assert.equal(toss(wrong.basketId), true);
  assert.equal(game.snapshot().lastAnswer.correct, false); assert.equal(game.snapshot().lastAnswer.value, wrong.number);
  assert.equal(events.at(-1).type, 'incorrect');
  assert.equal(game.snapshot().missed.at(-1).question, state.problem.question);
  assert.equal(toss(want), false); // no throw during feedback
  next();
  assert.equal(game.snapshot().hintBasketId, want);
  assert.equal(game.snapshot().problem.question, state.problem.question);
  assert.notEqual(game.snapshot().problem.problemId, state.problem.problemId); // each throw is its own problem for the Host's timing
  toss(wrong.basketId); assert.equal(events.at(-1).type, 'retry'); next();
  assert.equal(toss(want), true); assert.equal(events.at(-1).type, 'scored'); next();
  assert.equal(events.filter(event => ['correct', 'incorrect'].includes(event.type)).length, 1);
  assert.equal(game.snapshot().hintBasketId, null);
  assert.equal(game.snapshot().problemIndex, 1);
});

test('old attempts, paused throws and missing content are refused', () => {
  const { game, sessionId, toss, score } = newToss({ seed: 7 });
  const { attemptId, problem } = game.snapshot();
  score();
  assert.equal(game.dispatch({ type: 'throw', payload: { sessionId, attemptId, basketId: problem.correctChoiceId } }), false);
  game.setPaused(true); assert.equal(toss(game.snapshot().problem.correctChoiceId), false); game.setPaused(false);
  assert.equal(toss('nope'), false);
  assert.equal(createTossGame({ sessionId: 'x', content: { problems: null } }).enter(), false);
  // Without Gotomon the baskets are still carried.
  const bare = createTossGame({ sessionId: 'y', content: { problems: buildTossProblems({ sessionId: 'y', random: seeded(2) }) } });
  assert.equal(bare.enter(), true); assert.equal(bare.snapshot().baskets.length, TOSS_BASKETS);
});

test('the toss world summarises balls without leading with a zero', () => {
  const world = createQuizWorld('toss', growthStatus().effects);
  world.context({ mode: 'toss', phase: 'answering', problem: { problemId: 'p' } });
  world.answer(true, {}, 1); world.answer(false, {}, 0);
  assert.match(world.snapshot().summary, /玉を2球入れた · 1回で入った 1球/);
});
