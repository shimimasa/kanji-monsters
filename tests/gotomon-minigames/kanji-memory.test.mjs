import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contextReading } from '../../src/minigames/photoRally/photoRallyContent.js';
import { buildMemoryRounds, MEMORY_PAIRS, MEANING_MAX } from '../../src/minigames/kanjiMemory/memoryContent.js';
import { createMemoryGame, PEEK_MS, PEEK_STREAK } from '../../src/minigames/kanjiMemory/memoryGame.js';
import { createQuizWorld } from '../../src/minigames/gameplay/quizWorlds.js';
import { growthStatus } from '../../src/minigames/companionGrowth.js';

const json = path => JSON.parse(readFileSync(new URL(`../../public/data/${path}`, import.meta.url), 'utf8'));
const kanjiByGrade = {}, kanji = {};
for (let grade = 1; grade <= 6; grade++) { kanjiByGrade[grade] = json(`kanji_g${grade}_proto.json`); for (const item of kanjiByGrade[grade]) kanji[item.id] = item; }
const stages = json('stages_proto.json').filter(stage => stage.grade <= 6);
const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const toHira = text => text.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
const roundsFor = (stage, extra = {}) => buildMemoryRounds({ random: seeded(9), stageKanji: stage.kanjiPoolIdList.map(id => kanji[id]).filter(Boolean),
  gradeKanji: kanjiByGrade[stage.grade], ...extra });

test('every elementary stage makes a reading round and a meaning round whose cards each fit one kanji', () => {
  assert.equal(stages.length, 36);
  for (const stage of stages) {
    const rounds = roundsFor(stage);
    assert.deepEqual(rounds?.map(round => round.kind), ['reading', 'meaning'], stage.stageId);
    const all = rounds.flatMap(round => round.pairs.map(pair => pair.kanji));
    assert.equal(new Set(all).size, MEMORY_PAIRS * 2, stage.stageId);
    for (const round of rounds) {
      assert.equal(round.pairs.length, MEMORY_PAIRS); assert.equal(round.cards.length, MEMORY_PAIRS * 2);
      assert.equal(new Set(round.cards.map(card => card.cardId)).size, MEMORY_PAIRS * 2);
      for (const pair of round.pairs) {
        const cards = round.cards.filter(card => card.pairId === pair.pairId);
        assert.deepEqual(cards.map(card => card.face).sort(), [round.kind, 'kanji'].sort());
        if (round.kind === 'reading') {
          assert.equal(pair.text, contextReading(kanji[pair.kanjiId]).reading);
          // No other kanji on the board can be read like this card.
          const others = round.pairs.filter(other => other !== pair && [...kanji[other.kanjiId].onyomi, ...kanji[other.kanjiId].kunyomi].map(toHira).includes(toHira(pair.text)));
          assert.deepEqual(others.map(other => other.kanji), [], `${stage.stageId} ${pair.kanji} ${pair.text}`);
        } else {
          assert.ok(pair.text.length <= MEANING_MAX); assert.equal(pair.text.includes(pair.kanji), false);
          assert.equal(round.pairs.filter(other => other.text === pair.text).length, 1);
        }
      }
    }
  }
});

test('focus kanji come first', () => {
  const stage = stages.find(item => item.stageId === 'hokkaido_area1');
  const focus = roundsFor(stage)[0].pairs.slice(0, 2).map(pair => pair.kanjiId);
  const rounds = roundsFor(stage, { focusKanjiIds: focus });
  assert.ok(focus.every(id => rounds[0].pairs.some(pair => pair.kanjiId === id)));
});

function newGame() {
  const rounds = roundsFor(stages[4]), events = [], sessionId = 'm';
  const game = createMemoryGame({ sessionId, content: { stage: { stageId: 'x' }, rounds }, onEvent: event => events.push(event) });
  assert.equal(game.enter(), true);
  const flip = cardId => game.dispatch({ type: 'flip', payload: { sessionId, attemptId: game.snapshot().attemptId, cardId } });
  const next = () => game.dispatch({ type: 'next', payload: { sessionId } });
  const open = () => { const state = game.snapshot(); return state.cards.filter(card => !state.matched.includes(card.cardId)); };
  const pairUp = () => { const [a] = open(); const b = open().find(card => card !== a && card.pairId === a.pairId); flip(a.cardId); flip(b.cardId); next(); };
  return { game, events, sessionId, flip, next, open, pairUp };
}

test('a pair stays open; a wrong try turns back without a learning result', () => {
  const { game, events, flip, next, open } = newGame();
  const [a] = open(), wrong = open().find(card => card.pairId !== a.pairId);
  assert.equal(flip(a.cardId), true);
  assert.equal(flip(a.cardId), false); // the same card twice is not a try
  assert.equal(flip(wrong.cardId), true);
  let state = game.snapshot();
  assert.equal(state.phase, 'feedback'); assert.equal(state.lastAnswer.match, false); assert.equal(state.matched.length, 0);
  assert.equal(events.filter(event => ['correct', 'incorrect'].includes(event.type)).length, 0);
  assert.equal(events.at(-1).type, 'mismatch');
  next();
  state = game.snapshot();
  assert.deepEqual([...state.up], []);
  const partner = open().find(card => card !== a && card.pairId === a.pairId);
  flip(a.cardId); flip(partner.cardId);
  state = game.snapshot();
  assert.equal(state.lastAnswer.match, true); assert.deepEqual([...state.matched].sort(), [a.cardId, partner.cardId].sort());
  // a's partner had not been seen when a was paired wrongly, so the pair is still a clean find.
  assert.equal(events.at(-1).type, 'correct'); assert.equal(events.at(-1).payload.contentId, state.pairs.find(pair => pair.pairId === a.pairId).kanjiId);
});

test('pairing a card wrongly after its partner was seen sends that kanji to the review list', () => {
  const { game, events, flip, next, open } = newGame();
  const [a] = open(), partner = open().find(card => card !== a && card.pairId === a.pairId);
  const others = open().filter(card => card.pairId !== a.pairId);
  // See the partner first (with an unrelated card), then pair a with something else.
  flip(partner.cardId); flip(others[0].cardId); next();
  flip(a.cardId); flip(others[1].cardId); next();
  flip(a.cardId); flip(partner.cardId);
  assert.equal(events.at(-1).type, 'incorrect');
  assert.equal(game.snapshot().missed.at(-1).kanji, game.snapshot().pairs.find(pair => pair.pairId === a.pairId).kanji);
});

test('two rounds of six pairs end the game; clean streaks and new rounds add のぞき見', () => {
  const { game, events, pairUp } = newGame();
  assert.equal(game.snapshot().peeks, 1);
  for (let i = 0; i < PEEK_STREAK; i++) pairUp();
  assert.equal(game.snapshot().peeks, 2);
  while (game.snapshot().round === 0) pairUp();
  assert.equal(game.snapshot().roundKind, 'meaning');
  assert.equal(game.snapshot().peeks, 4); // 1 + two streaks of three + one for the new board
  while (game.snapshot().phase !== 'completed') pairUp();
  const { result } = game.snapshot();
  assert.equal(result.answered, 12); assert.equal(result.correct, 12); assert.equal(result.finished, true);
  assert.equal(events.filter(event => event.type === 'sessionComplete').length, 1);
});

test('のぞき見 shows every card for a moment and blocks flips meanwhile', () => {
  const { game, sessionId, flip, open } = newGame();
  assert.equal(game.dispatch({ type: 'peek', payload: { sessionId } }), true);
  assert.equal(game.snapshot().peeking, true); assert.equal(game.snapshot().peeks, 0);
  assert.equal(flip(open()[0].cardId), false);
  assert.equal(game.dispatch({ type: 'peek', payload: { sessionId } }), false);
  game.setPaused(true); game.update(PEEK_MS); assert.equal(game.snapshot().peeking, true); game.setPaused(false);
  game.update(PEEK_MS);
  assert.equal(game.snapshot().peeking, false);
  assert.equal(flip(open()[0].cardId), true);
});

test('the game needs rounds to start', () => {
  assert.equal(createMemoryGame({ sessionId: 'x', content: { rounds: null } }).enter(), false);
});

test('the memory world counts every pair and names the quick finds', () => {
  const world = createQuizWorld('memory', growthStatus().effects);
  world.context({ phase: 'answering', problem: { problemId: 'p1' } }); world.answer(true, {}, 1);
  world.context({ phase: 'answering', problem: { problemId: 'p2' } }); world.answer(false, {}, 0);
  assert.match(world.snapshot().summary, /ペアを2組そろえた · すぐに見つけた 1組/);
});
