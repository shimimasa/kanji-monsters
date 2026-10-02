import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildBingoCard } from '../../src/minigames/kanjiBingo/bingoContent.js';
import { createShopGame, SHOP_REQUESTS, SHOP_SLOTS, SHELF_SIZE, PATIENCE } from '../../src/minigames/gotomonShop/shopGame.js';
import { createQuizWorld } from '../../src/minigames/gameplay/quizWorlds.js';
import { growthStatus } from '../../src/minigames/companionGrowth.js';

const json = path => JSON.parse(readFileSync(new URL(`../../public/data/${path}`, import.meta.url), 'utf8'));
const kanjiByGrade = {}, kanji = {};
for (let grade = 1; grade <= 6; grade++) { kanjiByGrade[grade] = json(`kanji_g${grade}_proto.json`); for (const item of kanjiByGrade[grade]) kanji[item.id] = item; }
const stages = json('stages_proto.json').filter(stage => stage.grade <= 6);
const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const cardFor = (stage, extra = {}) => buildBingoCard({ random: seeded(9), stageKanji: stage.kanjiPoolIdList.map(id => kanji[id]).filter(Boolean),
  gradeKanji: kanjiByGrade[stage.grade], ...extra });

function newShop({ seed = 3, pace = 'normal', card = cardFor(stages[seed % stages.length]) } = {}) {
  const events = [], sessionId = `shop${seed}`;
  const game = createShopGame({ sessionId, random: seeded(seed), pace, onEvent: event => events.push(event),
    content: { stage: { stageId: 'x' }, card, customers: [{ name: 'カニクラブ', imageUrl: 'a.png' }, { name: 'ミルクフェアリー', imageUrl: 'b.png' }] } });
  assert.equal(game.enter(), true);
  const give = cellId => game.dispatch({ type: 'give', payload: { sessionId, attemptId: game.snapshot().attemptId, cellId } });
  const next = () => game.dispatch({ type: 'next', payload: { sessionId } });
  const serve = () => { give(game.snapshot().problem.correctChoiceId); next(); };
  return { game, events, sessionId, give, next, serve };
}

test('three customers wait; the shelf always holds each one\'s kanji among six distinct cards', () => {
  const { game, serve } = newShop();
  let state = game.snapshot();
  assert.equal(state.customers.length, SHOP_SLOTS);
  for (let i = 0; i < SHOP_REQUESTS && state.phase !== 'completed'; i++) {
    state = game.snapshot();
    assert.equal(state.shelf.length, SHELF_SIZE);
    assert.equal(new Set(state.shelf.map(cell => cell.cellId)).size, SHELF_SIZE);
    for (const customer of state.customers) assert.ok(state.shelf.some(cell => cell.cellId === customer.cellId), customer.kanji);
    // Cards the child has seen stay in place: only the served card's place changes.
    const before = state.shelf.map(cell => cell.cellId), served = state.problem.correctChoiceId;
    serve();
    state = game.snapshot();
    if (state.phase === 'completed') break;
    const moved = before.filter((cellId, index) => cellId !== served && state.shelf[index].cellId !== cellId && state.customers.some(customer => customer.cellId === cellId));
    assert.deepEqual(moved, []);
  }
});

test('twelve requests end the shop; customers come from the stage and clues alternate', () => {
  const { game, events, serve } = newShop();
  const kinds = [], names = new Set();
  while (game.snapshot().phase !== 'completed') {
    const state = game.snapshot();
    for (const customer of state.customers) names.add(customer.name);
    kinds.push(state.problem.kind); serve();
  }
  const { result } = game.snapshot();
  assert.equal(result.served, SHOP_REQUESTS); assert.equal(result.correct, SHOP_REQUESTS); assert.equal(result.finished, true);
  assert.deepEqual([...names].sort(), ['カニクラブ', 'ミルクフェアリー']);
  assert.ok(kinds.includes('reading') && kinds.includes('meaning'));
  assert.equal(events.filter(event => event.type === 'correct').length, SHOP_REQUESTS);
  assert.equal(events.filter(event => event.type === 'sessionComplete').length, 1);
});

test('a wrong kanji is one learning result; the right card then glows and the customer waits to be served', () => {
  const { game, events, give, next } = newShop({ seed: 5 });
  const state = game.snapshot(), customer = state.customers.find(item => item.slot === state.focus);
  const wrong = state.shelf.find(cell => cell.cellId !== customer.cellId);
  assert.equal(give(wrong.cellId), true);
  assert.equal(game.snapshot().lastAnswer.correct, false); assert.equal(events.at(-1).type, 'incorrect');
  assert.equal(game.snapshot().missed.at(-1).kanji, customer.kanji);
  if (customer.kind === 'reading') assert.equal(game.snapshot().missed.at(-1).build.answer, customer.clue.reading);
  else assert.equal(game.snapshot().missed.at(-1).build, null);
  assert.equal(give(customer.cellId), false); // no hand-over during feedback
  next();
  assert.equal(game.snapshot().hintCellId, customer.cellId);
  assert.equal(game.snapshot().customers.length, SHOP_SLOTS);
  const retryId = game.snapshot().problem.problemId;
  assert.notEqual(retryId, state.problem.problemId); // each hand-over is its own problem for the Host's timing
  assert.equal(give(customer.cellId), true);
  // Serving after a miss is service, not a second learning result.
  assert.equal(events.at(-1).type, 'served'); assert.equal(game.snapshot().lastAnswer.tip, 1);
  assert.equal(events.filter(event => ['correct', 'incorrect'].includes(event.type)).length, 1);
  next();
  assert.equal(game.snapshot().customers.some(item => item.customerId === customer.customerId), false);
  assert.equal(game.snapshot().hintCellId, null);
});

test('waiting lowers the mood and the tip, never sends a customer away; ゆっくり waits longer', () => {
  const quick = newShop({ seed: 7 });
  quick.game.update(PATIENCE.normal * .2);
  assert.ok(quick.game.snapshot().customers.every(customer => customer.mood > .7));
  quick.serve();
  assert.equal(quick.game.snapshot().tips, 3);
  const late = newShop({ seed: 7 });
  late.game.update(PATIENCE.normal * 2);
  assert.ok(late.game.snapshot().customers.every(customer => customer.mood === 0));
  assert.equal(late.game.snapshot().customers.length, SHOP_SLOTS);
  late.serve(); assert.equal(late.game.snapshot().tips, 1);
  const slow = newShop({ seed: 7, pace: 'slow' });
  slow.game.update(PATIENCE.normal);
  assert.ok(slow.game.snapshot().customers.every(customer => customer.mood > 0));
  // Paused time does not count.
  const paused = newShop({ seed: 7 });
  paused.game.setPaused(true); paused.game.update(PATIENCE.normal); paused.game.setPaused(false);
  assert.ok(paused.game.snapshot().customers.every(customer => customer.mood === 1));
});

test('the child chooses whom to serve; focus follows the longest-waiting customer after each sale', () => {
  const { game, sessionId, give } = newShop({ seed: 9 });
  const state = game.snapshot(), other = state.customers.find(customer => customer.slot !== state.focus);
  assert.equal(game.dispatch({ type: 'focus', payload: { sessionId, slot: other.slot } }), true);
  assert.equal(game.snapshot().problem.kanji, other.kanji);
  assert.equal(game.dispatch({ type: 'focus', payload: { sessionId, slot: 9 } }), false);
  game.setPaused(true); assert.equal(give(other.cellId), false); game.setPaused(false);
  assert.equal(give(other.cellId), true);
  game.dispatch({ type: 'next', payload: { sessionId } });
  const after = game.snapshot();
  const longest = [...after.customers].sort((a, b) => a.mood - b.mood)[0];
  assert.equal(after.focus, longest.slot);
});

test('focus kanji are asked first, and the shop needs a card to open', () => {
  const stage = stages.find(item => item.stageId === 'hokkaido_area1');
  const focus = cardFor(stage).slice(0, 2).map(cell => cell.kanjiId);
  const { game } = newShop({ card: cardFor(stage, { focusKanjiIds: focus }) });
  const first = game.snapshot().customers.slice(0, 2).map(customer => customer.kanjiId);
  assert.deepEqual(new Set(first), new Set(focus));
  assert.equal(createShopGame({ sessionId: 'x', content: { card: null } }).enter(), false);
});

test('the shop world reads served requests and tips from the Core', () => {
  const world = createQuizWorld('shop', growthStatus().effects);
  world.context({ mode: 'shop', phase: 'answering', problem: { problemId: 'p' }, served: 0, tips: 0 });
  world.context({ mode: 'shop', phase: 'feedback', problem: { problemId: 'p' }, served: 4, tips: 9 });
  assert.equal(world.snapshot().shopTips, 9);
  assert.match(world.snapshot().summary, /4人のおねがいをかなえた · チップ⭐9/);
});
