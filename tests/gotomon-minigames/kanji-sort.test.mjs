import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSortPuzzles, SORT_PLAN, SORT_SIZES, soundIndex, firstSound, readingWord } from '../../src/minigames/kanjiSort/sortContent.js';
import { createSortGame, starsFor } from '../../src/minigames/kanjiSort/sortGame.js';
import { contextReading } from '../../src/minigames/photoRally/photoRallyContent.js';
import { createQuizWorld } from '../../src/minigames/gameplay/quizWorlds.js';
import { growthStatus } from '../../src/minigames/companionGrowth.js';

const json = path => JSON.parse(readFileSync(new URL(`../../public/data/${path}`, import.meta.url), 'utf8'));
const kanjiByGrade = {}, kanji = {};
for (let grade = 1; grade <= 6; grade++) { kanjiByGrade[grade] = json(`kanji_g${grade}_proto.json`); for (const item of kanjiByGrade[grade]) kanji[item.id] = item; }
const stages = json('stages_proto.json').filter(stage => stage.grade <= 6);
const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const puzzlesFor = (stage, extra = {}) => buildSortPuzzles({ random: seeded(9), stageKanji: stage.kanjiPoolIdList.map(id => kanji[id]).filter(Boolean),
  gradeKanji: kanjiByGrade[stage.grade], ...extra });
const inOrder = puzzle => [...puzzle.cards].sort((a, b) => a.rank - b.rank);

function newSort({ seed = 3, puzzles = puzzlesFor(stages[seed % stages.length]) } = {}) {
  const events = [], sessionId = `sort${seed}`;
  const game = createSortGame({ sessionId, onEvent: event => events.push(event), content: { stage: { stageId: 'x' }, puzzles } });
  assert.equal(game.enter(), true);
  const place = cardId => game.dispatch({ type: 'place', payload: { sessionId, attemptId: game.snapshot().attemptId, cardId } });
  const next = () => game.dispatch({ type: 'next', payload: { sessionId } });
  const right = () => { place(game.snapshot().problem.correctChoiceId); next(); };
  return { game, events, sessionId, place, next, right };
}

test('every stage gets eight puzzles whose order is fixed: distinct stroke counts or distinct first sounds', () => {
  for (const stage of stages) {
    for (const seed of [1, 2, 3]) {
      const puzzles = buildSortPuzzles({ random: seeded(seed), stageKanji: stage.kanjiPoolIdList.map(id => kanji[id]).filter(Boolean), gradeKanji: kanjiByGrade[stage.grade] });
      assert.ok(puzzles, stage.stageId);
      assert.deepEqual(puzzles.map(puzzle => puzzle.kind), [...SORT_PLAN]);
      assert.deepEqual(puzzles.map(puzzle => puzzle.cards.length), [...SORT_SIZES]);
      const all = puzzles.flatMap(puzzle => puzzle.cards.map(card => card.kanji));
      assert.equal(new Set(all).size, all.length, `${stage.stageId}: a kanji is used once per run`);
      for (const puzzle of puzzles) {
        const row = inOrder(puzzle);
        assert.deepEqual(row.map(card => card.rank), row.map((_, index) => index));
        if (puzzle.kind === 'strokes') {
          for (let i = 1; i < row.length; i++) assert.ok(row[i].strokes > row[i - 1].strokes, `${stage.stageId} ${row.map(card => card.kanji).join('')}`);
        } else {
          const sounds = row.map(card => soundIndex(card.reading));
          for (let i = 1; i < sounds.length; i++) assert.ok(sounds[i] > sounds[i - 1], `${stage.stageId} ${row.map(card => card.reading).join(',')}`);
          // The reading on the card is the one its example sentence uses.
          for (const card of row) assert.equal(card.reading, contextReading(kanji[card.kanjiId]).reading.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)));
        }
      }
    }
  }
});

test('first sounds ignore dakuten, and the card word stays short', () => {
  assert.equal(firstSound('がっこう'), 'か'); assert.equal(firstSound('ぱん'), 'は'); assert.equal(firstSound('ヤマ'), 'や');
  assert.ok(soundIndex('あめ') < soundIndex('がく') && soundIndex('がく') < soundIndex('さかな'));
  assert.deepEqual({ ...readingWord({ before: 'へやに ', after: 'るときは ドアを しめる。' }) }, { before: '', after: 'るときは' });
  assert.deepEqual({ ...readingWord({ before: 'サッカーの試合で、相手チームに', after: 'れてしまったが、最後まで' }) }, { before: 'チームに', after: 'れてしま…' });
});

test('placing in order fills the row; the last card goes in by itself and the puzzle earns three stars', () => {
  const { game, events, right } = newSort();
  const first = game.snapshot();
  assert.equal(first.kind, 'strokes'); assert.equal(first.cards.length, 4);
  right(); right();
  let state = game.snapshot();
  assert.equal(state.placed.length, 2);
  right();
  // Three taps finish four cards: the fourth has one place left.
  assert.equal(events.filter(event => event.type === 'correct').length, 3);
  state = game.snapshot();
  assert.equal(state.solved, 1); assert.equal(state.stars, 3); assert.equal(state.puzzle, 1); assert.equal(state.kind, 'reading');
  assert.deepEqual(state.placed, []);
});

test('a wrong card is one learning result with a clue; the right card glows and each tap is its own problem', () => {
  const { game, events, place, next } = newSort({ seed: 5 });
  const state = game.snapshot(), want = state.problem.correctChoiceId;
  const wrong = state.cards.find(card => card.cardId !== want);
  assert.equal(place(wrong.cardId), true);
  const answer = game.snapshot().lastAnswer;
  assert.equal(answer.correct, false); assert.equal(answer.strokes, wrong.strokes); assert.equal(events.at(-1).type, 'incorrect');
  assert.equal(game.snapshot().missed.at(-1).kanji, state.cards.find(card => card.cardId === want).kanji);
  assert.equal(place(want), false); // no placing during feedback
  next();
  assert.equal(game.snapshot().hintCardId, want);
  assert.deepEqual(game.snapshot().placed, []);
  assert.notEqual(game.snapshot().problem.problemId, state.problem.problemId);
  // A second wrong tap is a retry, not another learning result.
  place(wrong.cardId); assert.equal(events.at(-1).type, 'retry'); next();
  assert.equal(place(want), true); assert.equal(events.at(-1).type, 'placed'); next();
  assert.equal(game.snapshot().hintCardId, null);
  assert.equal(events.filter(event => ['correct', 'incorrect'].includes(event.type)).length, 1);
  while (game.snapshot().puzzle === 0) { place(game.snapshot().problem.correctChoiceId); next(); }
  assert.equal(game.snapshot().stars, starsFor(1));
  assert.equal(starsFor(0), 3); assert.equal(starsFor(2), 1);
});

test('eight puzzles end the run with one result; placed cards and old attempts are refused', () => {
  const { game, events, sessionId, place, right } = newSort({ seed: 11 });
  const { cards, attemptId, problem } = game.snapshot();
  right();
  assert.equal(game.dispatch({ type: 'place', payload: { sessionId, attemptId, cardId: problem.correctChoiceId } }), false);
  assert.equal(place(cards.find(card => card.cardId === problem.correctChoiceId).cardId), false);
  while (game.snapshot().phase !== 'completed') right();
  const { result } = game.snapshot();
  assert.equal(result.solved, SORT_PLAN.length); assert.equal(result.stars, SORT_PLAN.length * 3);
  assert.equal(result.answered, SORT_SIZES.reduce((sum, size) => sum + size - 1, 0));
  assert.equal(result.correct, result.answered); assert.equal(result.finished, true);
  assert.equal(events.filter(event => event.type === 'sessionComplete').length, 1);
  assert.equal(events.filter(event => event.type === 'problemPresented').length, SORT_PLAN.length);
});

test('focus kanji come first; the puzzle needs content and ignores paused taps', () => {
  const stage = stages.find(item => item.stageId === 'hokkaido_area1');
  const focus = puzzlesFor(stage).slice(0, 2).flatMap(puzzle => puzzle.cards.slice(0, 1).map(card => card.kanjiId));
  const puzzles = puzzlesFor(stage, { focusKanjiIds: focus });
  const early = puzzles.slice(0, 2).flatMap(puzzle => puzzle.cards.map(card => card.kanjiId));
  for (const id of focus) assert.ok(early.includes(id), id);
  assert.ok(puzzles.flatMap(puzzle => puzzle.cards).filter(card => card.focus).length >= focus.length);
  assert.equal(createSortGame({ sessionId: 'x', content: { puzzles: null } }).enter(), false);
  const { game, place } = newSort({ seed: 4 });
  game.setPaused(true); assert.equal(place(game.snapshot().problem.correctChoiceId), false); game.setPaused(false);
  assert.equal(place(game.snapshot().problem.correctChoiceId), true);
});

test('the sort world reads finished puzzles and stars from the Core', () => {
  const world = createQuizWorld('sort', growthStatus().effects);
  world.context({ mode: 'sort', phase: 'answering', problem: { problemId: 'p' }, solved: 0, stars: 0 });
  world.context({ mode: 'sort', phase: 'feedback', problem: { problemId: 'p' }, solved: 3, stars: 8 });
  assert.equal(world.snapshot().sortStars, 8);
  assert.match(world.snapshot().summary, /パズルを3こ完成 · ⭐8/);
});
