import test from 'node:test';
import assert from 'node:assert/strict';
import { createMeteorGame, METEOR_RULES as R } from '../../src/minigames/gotomonMeteor/meteorGame.js';
import { createQuizWorld } from '../../src/minigames/gameplay/quizWorlds.js';
import { growthStatus } from '../../src/minigames/companionGrowth.js';

const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

function newMeteor({ seed = 3, level = 'addsub', pace = 'normal' } = {}) {
  const events = [], sessionId = `met${seed}`;
  const game = createMeteorGame({ sessionId, random: seeded(seed), pace, onEvent: event => events.push(event), content: { level } });
  assert.equal(game.enter(), true);
  const fire = baseId => game.dispatch({ type: 'fire', payload: { sessionId, attemptId: game.snapshot().attemptId, baseId } });
  const answerBase = () => { const s = game.snapshot(); return s.bases.find(b => b.number === s.problem.answer).baseId; };
  const wrongBase = () => { const s = game.snapshot(); return s.bases.find(b => b.number !== s.problem.answer).baseId; };
  const run = ms => { for (let t = 0; t < ms && game.snapshot().phase === 'answering'; t += 16) game.update(16); };
  return { game, events, sessionId, fire, answerBase, wrongBase, run };
}

test('every falling meteor has its answer on a base, and the three bases always differ', () => {
  for (const level of ['addsub', 'times']) {
    for (const seed of [1, 2, 3, 4]) {
      const { game, events, fire, answerBase, run } = newMeteor({ level, seed });
      let t = 0;
      while (game.snapshot().phase !== 'completed' && t < 10 * 60 * 1000) {
        const s = game.snapshot();
        for (const m of s.meteors) assert.ok(s.bases.some(b => b.number === m.answer), `${m.question} has a base`);
        assert.equal(new Set(s.bases.map(b => b.number)).size, 3);
        assert.ok(s.meteors.length <= R.maxMeteors);
        if (t % 2400 === 0 && s.problem) fire(answerBase());
        run(16); t += 16;
      }
      assert.equal(game.snapshot().result.answered, 12);
      // Every meteor's result is reported before the run ends.
      const done = events.findIndex(event => event.type === 'sessionComplete');
      assert.equal(events.slice(0, done).filter(event => ['correct', 'incorrect'].includes(event.type)).length, 12);
    }
  }
});

test('the answer base shoots the targeted meteor down; tapping a meteor changes the target', () => {
  const { game, events, sessionId, fire, answerBase, run } = newMeteor({ seed: 5 });
  run(R.spawnEveryMs.normal + 100);
  const s = game.snapshot();
  assert.equal(s.meteors.length, 2);
  const low = s.meteors.reduce((a, b) => a.y > b.y ? a : b), high = s.meteors.find(m => m !== low);
  assert.equal(s.targetId, low.meteorId);
  assert.equal(game.dispatch({ type: 'select', payload: { sessionId, meteorId: high.meteorId } }), true);
  assert.equal(game.snapshot().targetId, high.meteorId);
  assert.equal(fire(answerBase()), true);
  assert.equal(events.at(-1).type, 'correct');
  assert.ok(!game.snapshot().meteors.some(m => m.meteorId === high.meteorId));
  assert.equal(game.snapshot().defended, 1);
});

test('a wrong base is one learning result and lights the right one; the meteor keeps falling', () => {
  const { game, events, fire, answerBase, wrongBase } = newMeteor({ seed: 6 });
  const before = game.snapshot();
  assert.equal(fire(wrongBase()), true);
  assert.equal(events.at(-1).type, 'incorrect');
  const after = game.snapshot();
  assert.equal(after.meteors.length, before.meteors.length);
  assert.equal(after.hintBaseId, answerBase());
  assert.notEqual(after.problem.problemId, before.problem.problemId);
  fire(wrongBase()); assert.equal(events.at(-1).type, 'retry');
  fire(answerBase()); assert.equal(events.at(-1).type, 'defended');
  assert.equal(events.filter(event => ['correct', 'incorrect'].includes(event.type)).length, 1);
});

test('a meteor that lands is caught by the shield; left alone, the run still ends', () => {
  const { game, events, run } = newMeteor({ seed: 7 });
  run(R.fallMs.normal + 200);
  assert.ok(game.snapshot().shielded >= 1);
  assert.ok(game.snapshot().lastLanding);
  assert.equal(events.find(event => event.type === 'incorrect')?.payload.reason, 'landed');
  run(10 * 60 * 1000);
  const { result } = game.snapshot();
  assert.equal(result.answered, 12); assert.equal(result.shielded, 12);
  // ゆっくり falls slower.
  const slow = newMeteor({ pace: 'slow' }), fast = newMeteor();
  slow.run(3000); fast.run(3000);
  assert.ok(slow.game.snapshot().meteors[0].y < fast.game.snapshot().meteors[0].y);
});

test('old attempts and paused shots are refused', () => {
  const { game, sessionId, fire, answerBase } = newMeteor({ seed: 8 });
  const { attemptId } = game.snapshot();
  game.setPaused(true); assert.equal(fire(answerBase()), false); game.setPaused(false);
  const baseId = answerBase();
  assert.equal(fire(baseId), true);
  // The old attempt is gone with its meteor; a base that does not exist is refused.
  assert.equal(game.dispatch({ type: 'fire', payload: { sessionId, attemptId, baseId } }), false);
  assert.equal(game.dispatch({ type: 'fire', payload: { sessionId, attemptId: game.snapshot().attemptId, baseId: 'nope' } }), false);
});

test('the meteor world counts meteors met', () => {
  const world = createQuizWorld('meteor', growthStatus().effects);
  world.context({ mode: 'meteor', phase: 'answering', problem: { problemId: 'p' } });
  world.answer(true, {}, 1); world.answer(false, {}, 0);
  assert.match(world.snapshot().summary, /いん石を2こ むかえた · 1回でげいげき 1こ/);
});
