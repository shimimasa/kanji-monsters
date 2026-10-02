import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMergeGame, mergeQuestion, slideTiles, MERGE_RULES as R } from '../../src/minigames/gotomonMerge/mergeGame.js';
import { gameExperiences } from '../../src/minigames/gameExperiences.js';

const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const valueOf = label => label.includes('×') ? label.split('×').reduce((a, b) => a * b, 1)
  : label.includes('+') ? label.split('+').reduce((a, b) => a + Number(b), 0) : label.split('−').map(Number).reduce((a, b) => a - b);

function newMerge({ seed = 3, level = 'addsub' } = {}) {
  const events = [], sessionId = `mrg${seed}`;
  const game = createMergeGame({ sessionId, random: seeded(seed), onEvent: event => events.push(event), content: { level } });
  assert.equal(game.enter(), true);
  const answer = (right = true) => { const s = game.snapshot(); const id = right ? s.problem.correctChoiceId : s.problem.choices.find(c => c.choiceId !== s.problem.correctChoiceId).choiceId; return game.dispatch({ type: 'answer', payload: { sessionId, attemptId: s.attemptId, choiceId: id } }); };
  const slide = direction => game.dispatch({ type: 'slide', payload: { sessionId, attemptId: game.snapshot().attemptId, direction } });
  const anySlide = () => ['left', 'down', 'right', 'up'].some(slide);
  return { game, events, answer, slide, anySlide, sessionId };
}

test('question tiles are calculations of their value with four distinct choices', () => {
  for (const level of ['addsub', 'times']) {
    const random = seeded(7);
    for (const [value] of R.spawn[level]) {
      for (let i = 0; i < 20; i++) {
        const q = mergeQuestion(value, level, random);
        assert.equal(valueOf(q.label), value, q.label);
        assert.notEqual(q.label, String(value));
        assert.equal(q.numbers.length, R.choices, q.label);
        assert.equal(new Set(q.numbers).size, R.choices);
        assert.ok(q.numbers.includes(value) && q.numbers.every(n => n > 0));
      }
    }
  }
});

test('a question tile becomes its number when answered; a slip still gives the right number', () => {
  const { game, events, answer } = newMerge();
  let s = game.snapshot();
  assert.equal(s.phase, 'answering');
  const tile = s.tiles.find(t => t.question);
  assert.ok(tile && s.tiles.length === 2);
  assert.equal(answer(false), true);
  s = game.snapshot();
  assert.equal(s.phase, 'sliding');
  assert.equal(s.tiles.find(t => t.tileId === tile.tileId).question, null);
  assert.equal(s.tiles.find(t => t.tileId === tile.tileId).value, tile.value);
  assert.equal(s.lastAnswer.correct, false); assert.equal(s.incorrect, 1); assert.equal(s.missed.length, 1);
  assert.equal(s.missed[0].build.answer, `${s.lastAnswer.label}=${s.lastAnswer.value}`);
  assert.deepEqual(events.filter(e => e.type !== 'problemPresented').map(e => e.type), ['incorrect']);
});

test('a slide moves the tiles and a new question tile arrives; a slide into the wall does nothing', () => {
  const { game, answer, anySlide } = newMerge({ seed: 11 });
  answer();
  const before = game.snapshot().tiles.reduce((a, t) => a + t.value, 0);
  assert.ok(anySlide());
  const moved = game.snapshot();
  assert.equal(moved.tiles.filter(t => !t.question).reduce((a, t) => a + t.value, 0), before, 'numbers are kept (merged tiles add up)');
  assert.equal(moved.phase, 'answering');
  assert.equal(moved.tiles.filter(t => t.question).length, 1);
  // With random 0 both tiles sit in the top row, so sliding up moves nothing.
  const g = createMergeGame({ sessionId: 'w', random: () => 0, content: { level: 'addsub' } }); g.enter();
  const w = g.snapshot(); g.answer({ sessionId: 'w', attemptId: w.attemptId, choiceId: w.problem.correctChoiceId });
  assert.ok(g.snapshot().tiles.every(t => t.row === 0));
  assert.equal(g.slide({ sessionId: 'w', attemptId: g.snapshot().attemptId, direction: 'up' }), false);
  assert.equal(g.snapshot().phase, 'sliding');
});

test('whole plays keep the rules of 2048: numbers add up, one tile per square, all powers of two', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const { game, answer, anySlide } = newMerge({ seed });
    while (game.snapshot().phase !== 'completed') {
      answer();
      if (game.snapshot().phase === 'completed') break;
      const before = game.snapshot().tiles, total = before.reduce((a, t) => a + t.value, 0);
      assert.ok(anySlide());
      const after = game.snapshot();
      const kept = after.tiles.filter(t => !t.question).reduce((a, t) => a + t.value, 0);
      assert.equal(kept, total, `seed ${seed}: the numbers add up after a slide`);
      const cells = new Set(after.tiles.map(t => `${t.row},${t.column}`));
      assert.equal(cells.size, after.tiles.length, 'one tile per square');
      after.tiles.forEach(t => assert.ok(Math.log2(t.value) % 1 === 0, 'every number is 2, 4, 8, …'));
    }
  }
});

test('sixteen question tiles, then the play ends with the biggest tile; a full board ends early', () => {
  for (const level of ['addsub', 'times']) {
    for (let seed = 1; seed <= 30; seed++) {
      const { game, events, answer, anySlide } = newMerge({ seed, level });
      let guard = 0;
      while (game.snapshot().phase !== 'completed' && guard++ < 100) { if (game.snapshot().phase === 'answering') answer(); else assert.ok(anySlide()); }
      const end = game.snapshot();
      assert.equal(end.phase, 'completed');
      assert.ok(end.result.full || end.result.answered === R.questions);
      assert.equal(end.result.best, Math.max(...end.tiles.map(t => t.value)));
      assert.equal(events.at(-1).type, 'sessionComplete');
      assert.equal(events.filter(e => e.type === 'correct').length, end.result.answered);
      const ids = events.filter(e => ['correct', 'incorrect'].includes(e.type)).map(e => e.problemId);
      assert.equal(new Set(ids).size, ids.length);
    }
  }
});

test('commands are refused out of turn, while paused, with a stale attempt, or from another session', () => {
  const { game, sessionId, slide } = newMerge();
  const s = game.snapshot();
  assert.equal(slide('left'), false, 'no sliding before the question is answered');
  assert.equal(game.dispatch({ type: 'answer', payload: { sessionId: 'x', attemptId: s.attemptId, choiceId: s.problem.correctChoiceId } }), false);
  assert.equal(game.dispatch({ type: 'answer', payload: { sessionId, attemptId: 'stale', choiceId: s.problem.correctChoiceId } }), false);
  assert.equal(game.dispatch({ type: 'answer', payload: { sessionId, attemptId: s.attemptId, choiceId: '999' } }), false);
  game.setPaused(true);
  assert.equal(game.dispatch({ type: 'answer', payload: { sessionId, attemptId: s.attemptId, choiceId: s.problem.correctChoiceId } }), false);
  game.setPaused(false);
  assert.equal(game.dispatch({ type: 'answer', payload: { sessionId, attemptId: s.attemptId, choiceId: s.problem.correctChoiceId } }), true);
  game.exit();
  assert.equal(game.snapshot().aborted, true);
});

test('every mini-game has its own card scene (two games sharing one overwrite each other\'s card art)', () => {
  const scenes = Object.values(gameExperiences).map(item => item.scene);
  assert.equal(new Set(scenes).size, scenes.length, scenes.filter((s, i) => scenes.indexOf(s) !== i).join(','));
  const css = readFileSync(new URL('../../public/adventure.css', import.meta.url), 'utf8');
  const arts = [...css.matchAll(/^\.yt-card-art\[data-scene=([a-z]+)\]\{/gm)].map(m => m[1]);
  assert.equal(new Set(arts).size, arts.length, 'one card art per scene');
});

test('one row slides like 2048', () => {
  const row = (values, direction = 'left') => {
    const tiles = values.map((value, column) => value && { tileId: `t${column}`, value, row: 0, column }).filter(Boolean);
    const out = slideTiles(tiles, direction);
    if (!out) return null;
    const line = [0, 0, 0, 0]; out.tiles.forEach(t => { line[t.column] = t.value; });
    return { line, joined: out.joined };
  };
  assert.deepEqual(row([2, 2, 2, 2]), { line: [4, 4, 0, 0], joined: 2 });
  assert.deepEqual(row([4, 4, 8, 0]), { line: [8, 8, 0, 0], joined: 1 }, 'a merged tile does not merge again in the same move');
  assert.deepEqual(row([0, 2, 0, 2]), { line: [4, 0, 0, 0], joined: 1 });
  assert.deepEqual(row([2, 4, 8, 16]), null, 'nothing moves');
  assert.deepEqual(row([2, 2, 4, 0], 'right'), { line: [0, 0, 4, 4], joined: 1 });
  assert.deepEqual(row([8, 8, 8, 0], 'right'), { line: [0, 0, 8, 16], joined: 1 }, 'the tiles nearest the wall merge first');
});
