import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFishProblems, FISH_PROBLEMS, FISH_SWIMMERS } from '../../src/minigames/gotomonFishing/fishContent.js';
import { createFishGame, FISH_RULES } from '../../src/minigames/gotomonFishing/fishGame.js';
import { ENGLISH_CHOICE_FIXTURE } from '../../src/minigames/englishChoice/englishChoiceQuestions.js';
import { englishCategory } from '../../src/minigames/englishChoice/englishContent.js';
import { createQuizWorld } from '../../src/minigames/gameplay/quizWorlds.js';
import { growthStatus } from '../../src/minigames/companionGrowth.js';

const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const carriers = [{ name: 'カニクラブ', imageUrl: 'a.png' }, { name: 'サケウォリアー', imageUrl: 'b.png' }];

function newFishing({ seed = 3, pace = 'normal' } = {}) {
  const events = [], sessionId = `fish${seed}`;
  const game = createFishGame({ sessionId, random: seeded(seed), pace, onEvent: event => events.push(event),
    content: { carriers, problems: buildFishProblems({ sessionId, random: seeded(seed + 1) }) } });
  assert.equal(game.enter(), true);
  const cast = swimmerId => game.dispatch({ type: 'cast', payload: { sessionId, attemptId: game.snapshot().attemptId, swimmerId } });
  const next = () => game.dispatch({ type: 'next', payload: { sessionId } });
  const fish = () => { cast(game.snapshot().problem.correctChoiceId); next(); };
  return { game, events, sessionId, cast, next, fish };
}

test('twelve different words take turns 英語→日本語 and 日本語→英語, with four plates each', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const problems = buildFishProblems({ sessionId: 's', random: seeded(seed) });
    assert.equal(problems.length, FISH_PROBLEMS);
    assert.equal(new Set(problems.map(item => item.contentId)).size, FISH_PROBLEMS);
    problems.forEach((item, index) => {
      assert.equal(item.kind, index % 2 ? 'ja2en' : 'en2ja');
      assert.equal(item.prompt, item.kind === 'en2ja' ? item.word : item.meaning);
      assert.equal(item.plates.length, FISH_SWIMMERS);
      assert.equal(new Set(item.plates.map(plate => plate.text)).size, FISH_SWIMMERS, item.word);
      assert.equal(new Set(item.plates.map(plate => plate.meaning)).size, FISH_SWIMMERS, `${item.word}: meanings stay distinct`);
      assert.equal(item.plates.filter(plate => plate.contentId === item.contentId).length, 1);
      for (const plate of item.plates) assert.equal(plate.text, item.kind === 'en2ja' ? plate.meaning : plate.word);
      // Two plates from the same topic, like 宝箱キャッチ.
      const topic = englishCategory(item.word);
      assert.ok(item.plates.filter(plate => plate.contentId !== item.contentId && englishCategory(plate.word) === topic).length >= 1, item.word);
    });
  }
  assert.equal(buildFishProblems({ sessionId: 's', words: ENGLISH_CHOICE_FIXTURE.slice(0, 5) }), null);
});

test('swimmers keep swimming and turn around inside the pond; ゆっくり is slower; pause stops them', () => {
  const { game } = newFishing();
  const turned = new Set();
  let last = game.snapshot().swimmers.map(item => item.dir);
  for (let i = 0; i < 600; i++) {
    game.update(50);
    const swimmers = game.snapshot().swimmers;
    for (const swimmer of swimmers) {
      assert.ok(swimmer.x >= FISH_RULES.minX && swimmer.x <= FISH_RULES.maxX);
      if (swimmer.dir !== last[swimmer.row]) turned.add(swimmer.row);
    }
    last = swimmers.map(item => item.dir);
  }
  assert.equal(turned.size, FISH_SWIMMERS);
  const speed = pace => { const run = newFishing({ pace }); const a = run.game.snapshot().swimmers[0].x; run.game.update(50); return Math.abs(run.game.snapshot().swimmers[0].x - a); };
  assert.ok(speed('slow') < speed('normal'));
  game.setPaused(true); const still = game.snapshot().swimmers.map(item => item.x); game.update(1000);
  assert.deepEqual(game.snapshot().swimmers.map(item => item.x), still);
});

test('twelve catches end the run with one result; the carriers are the given Gotomon', () => {
  const { game, events, fish } = newFishing();
  assert.deepEqual([...new Set(game.snapshot().swimmers.map(item => item.name))].sort(), carriers.map(item => item.name).sort());
  while (game.snapshot().phase !== 'completed') fish();
  const { result } = game.snapshot();
  assert.equal(result.caught, FISH_PROBLEMS); assert.equal(result.correct, FISH_PROBLEMS); assert.equal(result.finished, true);
  assert.equal(events.filter(event => event.type === 'correct').length, FISH_PROBLEMS);
  assert.equal(events.filter(event => event.type === 'sessionComplete').length, 1);
});

test('a wrong catch is one learning result and shows its plate; the answer glows until caught', () => {
  const { game, events, cast, next } = newFishing({ seed: 5 });
  const state = game.snapshot(), want = state.problem.correctChoiceId;
  const wrong = state.swimmers.find(item => item.swimmerId !== want);
  assert.equal(cast(wrong.swimmerId), true);
  const answer = game.snapshot().lastAnswer;
  assert.equal(answer.correct, false); assert.equal(answer.plate.contentId, wrong.plate.contentId);
  assert.ok(answer.plate.word && answer.plate.meaning);
  assert.equal(events.at(-1).type, 'incorrect');
  assert.equal(game.snapshot().missed.at(-1).word, state.problem.word);
  assert.equal(game.snapshot().missed.at(-1).build.answer, state.problem.word.toLowerCase());
  assert.equal(game.snapshot().missed.at(-1).build.script, 'letters');
  next();
  assert.equal(game.snapshot().hintSwimmerId, want);
  assert.equal(game.snapshot().problem.contentId, state.problem.contentId);
  assert.notEqual(game.snapshot().problem.problemId, state.problem.problemId);
  cast(wrong.swimmerId); assert.equal(events.at(-1).type, 'retry'); next();
  assert.equal(cast(want), true); assert.equal(events.at(-1).type, 'caught'); next();
  assert.equal(events.filter(event => ['correct', 'incorrect'].includes(event.type)).length, 1);
  assert.equal(game.snapshot().problemIndex, 1); assert.equal(game.snapshot().problem.kind, 'ja2en');
});

test('old attempts, paused casts and missing content are refused', () => {
  const { game, sessionId, cast, fish } = newFishing({ seed: 7 });
  const { attemptId, problem } = game.snapshot();
  fish();
  assert.equal(game.dispatch({ type: 'cast', payload: { sessionId, attemptId, swimmerId: problem.correctChoiceId } }), false);
  const id = game.snapshot().problem.correctChoiceId;
  game.setPaused(true); assert.equal(cast(id), false); game.setPaused(false);
  assert.equal(cast('nope'), false);
  assert.equal(createFishGame({ sessionId: 'x', content: { problems: null } }).enter(), false);
  const bare = createFishGame({ sessionId: 'y', content: { problems: buildFishProblems({ sessionId: 'y', random: seeded(2) }) } });
  assert.equal(bare.enter(), true); assert.equal(bare.snapshot().swimmers.length, FISH_SWIMMERS);
});

test('the fishing world summarises catches without leading with a zero', () => {
  const world = createQuizWorld('fish', growthStatus().effects);
  world.context({ mode: 'fishing', phase: 'answering', problem: { problemId: 'p' } });
  world.answer(true, {}, 1); world.answer(false, {}, 0);
  assert.match(world.snapshot().summary, /ゴトモンを2匹つった · 1回でつれた 1匹/);
});
