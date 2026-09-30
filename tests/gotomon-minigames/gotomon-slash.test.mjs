import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSlashProblems, SLASH_PLATES } from '../../src/minigames/gotomonSlash/slashContent.js';
import { createSlashGame, SLASH_RULES as R } from '../../src/minigames/gotomonSlash/slashGame.js';
import { createQuizWorld } from '../../src/minigames/gameplay/quizWorlds.js';
import { growthStatus } from '../../src/minigames/companionGrowth.js';

const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const grade1 = JSON.parse(readFileSync(new URL('../../public/data/kanji_g1_proto.json', import.meta.url), 'utf8'));

function newSlash({ seed = 3, mode = 'kanji', pace = 'normal' } = {}) {
  const events = [], sessionId = `sla${seed}`;
  const problems = buildSlashProblems({ sessionId, random: seeded(seed), mode, gradeKanji: grade1 });
  const game = createSlashGame({ sessionId, random: seeded(seed + 1), pace, onEvent: event => events.push(event), content: { problems } });
  assert.equal(game.enter(), true);
  const cutAt = (ball, dx = 0.12) => game.dispatch({ type: 'slash', payload: { sessionId, attemptId: game.snapshot().attemptId, x1: ball.x - dx, y1: ball.y, x2: ball.x + dx, y2: ball.y } });
  const next = () => game.dispatch({ type: 'next', payload: { sessionId } });
  const run = ms => { for (let t = 0; t < ms; t += 16) game.update(16); };
  const flying = pick => { for (let t = 0; t < 6000; t += 16) { const b = game.snapshot().balls.find(ball => ball.state === 'flying' && pick(ball, game.snapshot())); if (b) return b; game.update(16); } return null; };
  return { game, events, sessionId, cutAt, next, run, flying };
}

test('all three modes make twelve problems of four distinct plates with one answer', () => {
  for (const mode of ['kanji', 'english', 'math']) {
    for (let seed = 1; seed <= 6; seed++) {
      const problems = buildSlashProblems({ sessionId: 's', random: seeded(seed), mode, gradeKanji: grade1 });
      assert.equal(problems.length, 12, mode);
      for (const item of problems) {
        assert.equal(item.plates.length, SLASH_PLATES);
        assert.equal(new Set(item.plates.map(p => p.text)).size, SLASH_PLATES);
        assert.equal(item.plates.filter(p => p.plateId === item.answerId).length, 1);
        assert.ok(item.prompt && item.explain);
      }
    }
  }
});

test('balls fly up in arcs, fall, and the same four come again; slower on ゆっくり', () => {
  const { game, run } = newSlash();
  run(R.staggerMs * 4 + 200);
  const s = game.snapshot();
  assert.equal(s.balls.length, SLASH_PLATES);
  assert.ok(s.balls.every(ball => ball.y < R.launchY));
  run(R.flightMs.normal * 3);
  assert.ok(game.snapshot().balls.length >= 1, 'thrown again');
  assert.ok(game.snapshot().balls.every(ball => ball.y > R.apexY - 0.05), 'never above the apex');
  const slow = newSlash({ pace: 'slow' }), fast = newSlash();
  slow.run(1000); fast.run(1000);
  assert.ok(slow.game.snapshot().balls[0].y > fast.game.snapshot().balls[0].y);
});

test('a swipe through the answer opens it; twelve end the run', () => {
  const { game, events, cutAt, next, flying } = newSlash({ seed: 5, mode: 'english' });
  let guard = 0;
  while (game.snapshot().phase !== 'completed' && guard++ < 40) {
    if (game.snapshot().phase === 'feedback') { next(); continue; }
    const ball = flying((b, s) => b.plateId === s.problem.answerId && b.y < 0.85);
    assert.ok(ball, 'the answer comes up');
    assert.equal(cutAt(ball), true);
    assert.equal(game.snapshot().lastAnswer.correct, true);
  }
  assert.equal(game.snapshot().result.opened, 12);
  assert.equal(events.filter(event => event.type === 'correct').length, 12);
  assert.equal(events.filter(event => event.type === 'sessionComplete').length, 1);
});

test('a wrong ball is knocked away: one learning result, the answer glows, play goes on', () => {
  const { game, events, cutAt, flying } = newSlash({ seed: 6, mode: 'math' });
  const wrong = flying((b, s) => b.plateId !== s.problem.answerId && b.y < 0.85);
  const before = game.snapshot().problem.problemId;
  assert.equal(cutAt(wrong, 0), true);
  const s = game.snapshot();
  assert.equal(s.lastAnswer.correct, false); assert.equal(events.at(-1).type, 'incorrect');
  assert.equal(s.phase, 'answering'); assert.equal(s.hintPlateId, s.problem.answerId);
  assert.notEqual(s.problem.problemId, before);
  assert.equal(s.balls.find(b => b.ballId === wrong.ballId).state, 'knocked');
  const again = flying((b, st) => b.plateId !== st.problem.answerId && b.ballId !== wrong.ballId && b.y < 0.85);
  if (again) { cutAt(again, 0); assert.equal(events.at(-1).type, 'retry'); }
  const answer = flying((b, st) => b.plateId === st.problem.answerId && b.y < 0.85);
  cutAt(answer); assert.equal(events.at(-1).type, 'opened');
  assert.equal(events.filter(event => ['correct', 'incorrect'].includes(event.type)).length, 1);
});

test('a swipe crossing the answer and another ball counts the answer; misses and old attempts are refused', () => {
  const { game, sessionId, cutAt, flying } = newSlash({ seed: 7, mode: 'math' });
  assert.equal(game.dispatch({ type: 'slash', payload: { sessionId, attemptId: game.snapshot().attemptId, x1: 0, y1: 0, x2: 0.01, y2: 0 } }), false);
  const answer = flying((b, s) => b.plateId === s.problem.answerId && b.y < 0.8);
  const { attemptId } = game.snapshot();
  // A long swipe across the whole field at the answer's height.
  assert.equal(game.dispatch({ type: 'slash', payload: { sessionId, attemptId, x1: 0, y1: answer.y, x2: 1, y2: answer.y } }), true);
  assert.equal(game.snapshot().lastAnswer.correct, true);
  assert.equal(game.dispatch({ type: 'slash', payload: { sessionId, attemptId, x1: 0, y1: 0.5, x2: 1, y2: 0.5 } }), false);
  game.setPaused(true); assert.equal(cutAt(answer), false);
  assert.equal(createSlashGame({ sessionId: 'x', content: { problems: null } }).enter(), false);
});

test('the slash world counts opened balls', () => {
  const world = createQuizWorld('slash', growthStatus().effects);
  world.context({ mode: 'slash', phase: 'answering', problem: { problemId: 'p' } });
  world.answer(true, {}, 1); world.answer(false, {}, 0);
  assert.match(world.snapshot().summary, /くす玉を2こ パカッ · 1回で答え 1こ/);
});
