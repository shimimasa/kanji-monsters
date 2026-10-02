import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contextReading } from '../../src/minigames/photoRally/photoRallyContent.js';
import { buildBingoCard, meaningClue, completedLines, BINGO_LINES, BINGO_CELLS } from '../../src/minigames/kanjiBingo/bingoContent.js';
import { createBingoGame, BINGO_CALLS, STAMP_STREAK, RETRY_GAP } from '../../src/minigames/kanjiBingo/bingoGame.js';
import { createQuizWorld } from '../../src/minigames/gameplay/quizWorlds.js';
import { growthStatus } from '../../src/minigames/companionGrowth.js';

const json = path => JSON.parse(readFileSync(new URL(`../../public/data/${path}`, import.meta.url), 'utf8'));
const kanjiByGrade = {}, kanji = {};
for (let grade = 1; grade <= 6; grade++) { kanjiByGrade[grade] = json(`kanji_g${grade}_proto.json`); for (const item of kanjiByGrade[grade]) kanji[item.id] = item; }
const stages = json('stages_proto.json').filter(stage => stage.grade <= 6);
const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const toHira = text => text.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
const readingsOf = item => new Set([...item.onyomi, ...item.kunyomi].map(toHira));
const cardFor = (stage, extra = {}) => buildBingoCard({ random: seeded(9), stageKanji: stage.kanjiPoolIdList.map(id => kanji[id]).filter(Boolean),
  gradeKanji: kanjiByGrade[stage.grade], ...extra });

test('ten lines: four rows, four columns and two diagonals', () => {
  assert.equal(BINGO_LINES.length, 10);
  assert.ok(BINGO_LINES.every(line => line.length === 4));
  const marked = Array(BINGO_CELLS).fill(null); [0, 5, 10, 15].forEach(index => { marked[index] = 'call'; });
  assert.deepEqual(completedLines(marked), [8]);
});

test('every elementary stage makes a card whose clues each point to exactly one square', () => {
  assert.equal(stages.length, 36);
  for (const stage of stages) {
    const card = cardFor(stage);
    assert.equal(card?.length, BINGO_CELLS, stage.stageId);
    assert.equal(new Set(card.map(cell => cell.kanji)).size, BINGO_CELLS, stage.stageId);
    for (const cell of card) {
      assert.ok(cell.reading || cell.meaning, cell.kanji);
      if (cell.meaning) {
        assert.equal(cell.meaning.includes(cell.kanji), false);
        assert.equal(card.filter(other => other.meaning === cell.meaning).length, 1, cell.meaning);
      }
      if (cell.reading) {
        // The reading is the one annotated in the kanji's own example sentence…
        assert.equal(cell.reading.reading, contextReading(kanji[cell.kanjiId]).reading);
        // …and no other kanji on the card can be read that way.
        const others = card.filter(other => other !== cell && readingsOf(kanji[other.kanjiId]).has(toHira(cell.reading.reading)));
        assert.deepEqual(others.map(other => other.kanji), [], `${stage.stageId} ${cell.kanji} ${cell.reading.reading}`);
        assert.equal(`${cell.reading.before}${cell.reading.after}`.includes('（'), false);
      }
    }
  }
  // Meanings that give the kanji away are not used as clues.
  assert.equal(meaningClue({ kanji: '山', meaning: '山のこと' }), null);
  assert.equal(meaningClue({ kanji: '山', meaning: '' }), null);
});

test('the child\'s focus kanji are on the card and called first', () => {
  const stage = stages.find(item => item.stageId === 'hokkaido_area1');
  const focus = cardFor(stage).slice(0, 3).map(cell => cell.kanjiId);
  const card = cardFor(stage, { focusKanjiIds: focus });
  assert.ok(focus.every(id => card.some(cell => cell.kanjiId === id)));
  const sessionId = 'f', game = createBingoGame({ sessionId, random: seeded(4), content: { card } });
  game.enter();
  const called = [];
  for (let i = 0; i < 3; i++) {
    const state = game.snapshot(); called.push(state.problem.contentId);
    game.dispatch({ type: 'answer', payload: { sessionId, problemId: state.problem.problemId, attemptId: state.attemptId, choiceId: state.problem.correctChoiceId } });
    game.dispatch({ type: 'next', payload: { sessionId } });
  }
  assert.deepEqual(new Set(called), new Set(focus));
});

function newGame(seed = 3) {
  const card = cardFor(stages[seed % stages.length]);
  const events = [], sessionId = `s${seed}`;
  const game = createBingoGame({ sessionId, random: seeded(seed), content: { stage: { stageId: 'x' }, card }, onEvent: event => events.push(event) });
  assert.equal(game.enter(), true);
  const answer = (right = true) => {
    const state = game.snapshot(), problem = state.problem;
    const choiceId = right ? problem.correctChoiceId : state.card.find((cell, index) => !state.marked[index] && cell.cellId !== problem.cellId).cellId;
    return game.dispatch({ type: 'answer', payload: { sessionId, problemId: problem.problemId, attemptId: state.attemptId, choiceId } });
  };
  const next = () => game.dispatch({ type: 'next', payload: { sessionId } });
  return { game, events, sessionId, answer, next };
}

test('a first-try tap opens the square; ten calls end the card with lines counted', () => {
  const { game, events, answer, next } = newGame(3);
  let calls = 0;
  while (game.snapshot().phase !== 'completed') {
    assert.equal(answer(true), true); calls++;
    assert.equal(game.snapshot().marked.filter(Boolean).length >= calls, true);
    next();
  }
  const state = game.snapshot();
  assert.equal(calls, BINGO_CALLS);
  assert.equal(state.result.correct, BINGO_CALLS); assert.equal(state.result.finished, true);
  assert.equal(state.result.lines, completedLines(state.marked).length);
  assert.equal(events.filter(event => event.type === 'sessionComplete').length, 1);
  // Every answer event carries the running line count for the world.
  assert.ok(events.filter(event => event.type === 'correct').every(event => Number.isInteger(event.payload.lines)));
});

test('a miss shows the right square, keeps it closed, and calls that kanji again soon', () => {
  const { game, answer, next } = newGame(5);
  const first = game.snapshot().problem;
  assert.equal(answer(false), true);
  const state = game.snapshot();
  assert.equal(state.lastAnswer.correct, false); assert.equal(state.lastAnswer.correctChoiceId, first.cellId);
  assert.equal(state.marked.filter(Boolean).length, 0);
  assert.equal(state.missed.length, 1); assert.equal(state.missed[0].kanji, first.kanji);
  // A reading call comes back in the review as the reading to build, in its sentence.
  if (first.kind === 'reading') { assert.equal(state.missed[0].build.answer, first.clue.reading); assert.equal(state.missed[0].build.sentence.before, first.clue.before); }
  else assert.equal(state.missed[0].build, null);
  // No second answer to the same call.
  assert.equal(answer(true), false);
  const seen = [];
  for (let i = 0; i <= RETRY_GAP; i++) { next(); seen.push(game.snapshot().problem.cellId); answer(true); }
  assert.equal(seen.at(-1), first.cellId);
  assert.equal(game.snapshot().problem.kind, first.kind);
});

test('three first tries in a row earn a ⭐ stamp for any square but the one being called', () => {
  const { game, sessionId, answer, next } = newGame(7);
  assert.equal(game.dispatch({ type: 'armStamp', payload: { sessionId } }), false);
  for (let i = 0; i < STAMP_STREAK; i++) { answer(true); next(); }
  let state = game.snapshot();
  assert.equal(state.stamps, 1);
  assert.equal(game.dispatch({ type: 'armStamp', payload: { sessionId } }), true);
  // While armed, a tap is a stamp, not an answer.
  assert.equal(answer(true), false);
  assert.equal(game.dispatch({ type: 'stamp', payload: { sessionId, cellId: state.problem.cellId } }), false);
  const free = state.card.find((cell, index) => !state.marked[index] && cell.cellId !== state.problem.cellId);
  game.setPaused(true); assert.equal(game.dispatch({ type: 'stamp', payload: { sessionId, cellId: free.cellId } }), false); game.setPaused(false);
  assert.equal(game.dispatch({ type: 'stamp', payload: { sessionId, cellId: free.cellId } }), true);
  state = game.snapshot();
  assert.equal(state.marked[free.index], 'stamp'); assert.equal(state.stamps, 0); assert.equal(state.stampArmed, false);
  assert.equal(game.dispatch({ type: 'stamp', payload: { sessionId, cellId: free.cellId } }), false);
  // A stamped square is never called.
  while (game.snapshot().phase !== 'completed') { assert.notEqual(game.snapshot().problem.cellId, free.cellId); answer(true); next(); }
});

test('the bingo needs a full card to start', () => {
  assert.equal(createBingoGame({ sessionId: 'x', content: { card: null } }).enter(), false);
  assert.equal(createBingoGame({ sessionId: 'x', content: { card: cardFor(stages[0]).slice(0, 15) } }).enter(), false);
});

test('the bingo world reads lines from the Core and speaks kindly before the first line', () => {
  const world = createQuizWorld('bingo', growthStatus().effects);
  world.context({ phase: 'answering', problem: { problemId: 'p1' }, bingo: { lines: 0, marked: 3 } });
  assert.match(world.snapshot().summary, /3マスあけた · ビンゴまであと少し/);
  world.answer(true, { lines: 1 }, 1);
  world.context({ phase: 'answering', problem: { problemId: 'p2' }, bingo: { lines: 2, marked: 7 } });
  assert.equal(world.snapshot().bingoLines, 2);
  assert.match(world.snapshot().summary, /ビンゴ2列 · 7マスあけた/);
});
