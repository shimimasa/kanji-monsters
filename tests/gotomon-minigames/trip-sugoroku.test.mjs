import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installStorage } from '../phase-a/storage-helper.mjs';
import { getDefaultSave, loadSave } from '../../src/core/saveData.js';
import { loadGameData } from '../../src/core/gameState.js';
import { validateSave } from '../../src/core/saveValidation.js';
import { createGotomonService } from '../../src/minigames/gotomonService.js';
import { readingPool } from '../../src/minigames/photoRally/photoRallyContent.js';
import { createTripGame, buildTripMap, TRIP_COLUMNS, BOSS_HP, BOSS_QUESTIONS, NODE_TYPES } from '../../src/minigames/tripSugoroku/tripGame.js';
import { createQuizWorld } from '../../src/minigames/gameplay/quizWorlds.js';
import { growthStatus } from '../../src/minigames/companionGrowth.js';

const json = path => JSON.parse(readFileSync(new URL(`../../public/data/${path}`, import.meta.url), 'utf8'));
const kanjiByGrade = {}, kanji = {};
for (let grade = 1; grade <= 6; grade++) { kanjiByGrade[grade] = json(`kanji_g${grade}_proto.json`); for (const item of kanjiByGrade[grade]) kanji[item.id] = item; }
const stage = json('stages_proto.json').find(item => item.stageId === 'hokkaido_area1');
const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const contentFor = ({ random = seeded(7), focusKanjiIds = [] } = {}) => ({
  stage: { stageId: stage.stageId, name: stage.name, grade: stage.grade }, focusKanjiIds,
  boss: { monsterId: 'boss', name: 'ボス', imageUrl: '' }, monsters: [{ id: 'm1', name: 'モン', imageUrl: '' }],
  readings: readingPool({ random, focusKanjiIds, stageKanji: stage.kanjiPoolIdList.map(id => kanji[id]).filter(Boolean), gradeKanji: kanjiByGrade[stage.grade] }),
});
const QUESTION_STOPS = ['reading', 'training', 'proverb'];

test('every map has four forks of two different stops, a question stop at each fork, and at most two free stops', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const map = buildTripMap(seeded(seed));
    assert.equal(map.length, TRIP_COLUMNS);
    assert.ok(map[0].some(stop => stop.type === 'reading'));
    for (const fork of map) {
      assert.equal(fork.length, 2); assert.notEqual(fork[0].type, fork[1].type);
      assert.ok(fork.some(stop => QUESTION_STOPS.includes(stop.type)));
      assert.ok(fork.every(stop => NODE_TYPES[stop.type]));
    }
    assert.ok(map.flat().filter(stop => ['chest', 'rest'].includes(stop.type)).length <= 2);
    assert.equal(new Set(map.flat().map(stop => stop.nodeId)).size, TRIP_COLUMNS * 2);
  }
});

// Plays one trip: the chooser picks a stop per fork, the answerer says whether to answer right.
function play({ choose, right, usePower = true, sessionId = 't', content = contentFor() }) {
  const events = [];
  const game = createTripGame({ sessionId, random: seeded(11), content, onEvent: event => events.push(event) });
  assert.equal(game.enter(), true); assert.equal(game.snapshot().phase, 'map');
  for (let guard = 0; guard < 80 && game.snapshot().phase !== 'completed'; guard++) {
    const state = game.snapshot();
    if (state.phase === 'map') { assert.equal(game.dispatch({ type: 'move', payload: { sessionId, nodeId: choose(state.map[state.column]).nodeId } }), true); continue; }
    if (state.phase === 'answering') {
      const problem = state.problem, boss = state.column >= TRIP_COLUMNS;
      if (boss && usePower && state.items.power && !state.powerArmed) assert.equal(game.dispatch({ type: 'useItem', payload: { sessionId, item: 'power' } }), true);
      const wrong = problem.choices.find(choice => choice.choiceId !== problem.correctChoiceId);
      const choiceId = right(state) ? problem.correctChoiceId : wrong.choiceId;
      assert.equal(game.dispatch({ type: 'answer', payload: { sessionId, problemId: problem.problemId, attemptId: state.attemptId, choiceId } }), true);
      continue;
    }
    assert.equal(game.dispatch({ type: 'next', payload: { sessionId, problemId: state.problem?.problemId } }), true);
  }
  return { game, events, state: game.snapshot() };
}

test('a trip with right answers collects items, hits the boss with きらきら, and ends with 3 stars', () => {
  const { state, events } = play({ choose: fork => fork.find(stop => stop.type === 'training') ?? fork[0], right: () => true });
  assert.equal(state.phase, 'completed');
  assert.equal(state.result.bossDefeated, true); assert.equal(state.result.stars, 3); assert.equal(state.result.finished, true);
  assert.deepEqual({ ...state.result.journey }, { stageId: 'hokkaido_area1', stars: 3 });
  assert.equal(state.result.bossDamage, BOSS_HP);
  // Damage on the answer events adds up to what the boss took, and the item doubled at least one hit.
  const hits = events.filter(event => event.type === 'correct' && event.payload.stop === 'boss').map(event => event.payload.damage);
  assert.equal(hits.reduce((sum, value) => sum + value, 0), BOSS_HP); assert.ok(hits.includes(2));
  assert.equal(events.filter(event => event.type === 'sessionComplete').length, 1);
  assert.equal(state.missed.length, 0);
});

test('a hard boss battle still ends kindly after six questions, keeping the missed words for review', () => {
  const { state } = play({ choose: fork => fork[0], right: s => s.column < TRIP_COLUMNS, usePower: false });
  assert.equal(state.result.bossDefeated, false); assert.equal(state.result.stars, 1); assert.equal(state.result.bossDamage, 0);
  assert.equal(state.boss.asked, BOSS_QUESTIONS);
  assert.equal(state.missed.length, BOSS_QUESTIONS); assert.ok(state.missed.every(item => item.text && item.answer));
});

test('items: the hint hides two wrong choices once, and きらきら waits for the boss', () => {
  const sessionId = 'i';
  const game = createTripGame({ sessionId, random: seeded(3), content: contentFor() });
  game.enter();
  const reading = game.snapshot().map[0].find(stop => stop.type === 'reading');
  game.dispatch({ type: 'move', payload: { sessionId, nodeId: reading.nodeId } });
  const { problem } = game.snapshot();
  assert.equal(game.dispatch({ type: 'useItem', payload: { sessionId, item: 'power' } }), false);
  game.setPaused(true); assert.equal(game.dispatch({ type: 'useItem', payload: { sessionId, item: 'hint' } }), false); game.setPaused(false);
  assert.equal(game.dispatch({ type: 'useItem', payload: { sessionId, item: 'hint' } }), true);
  const hidden = game.snapshot().hiddenChoiceIds;
  assert.equal(hidden.length, 2); assert.equal(hidden.includes(problem.correctChoiceId), false);
  assert.equal(game.snapshot().items.hint, 0);
  assert.equal(game.dispatch({ type: 'useItem', payload: { sessionId, item: 'hint' } }), false);
  // A hidden choice cannot be answered; a stale attempt cannot either.
  const state = game.snapshot();
  assert.equal(game.dispatch({ type: 'answer', payload: { sessionId, problemId: problem.problemId, attemptId: state.attemptId, choiceId: hidden[0] } }), false);
  assert.equal(game.dispatch({ type: 'answer', payload: { sessionId, problemId: problem.problemId, attemptId: 'old', choiceId: problem.correctChoiceId } }), false);
  // Only the current fork can be entered.
  assert.equal(game.dispatch({ type: 'move', payload: { sessionId, nodeId: 'c1-0' } }), false);
});

test('修行の道 asks the child\'s focus kanji first', () => {
  const usable = readingPool({ stageKanji: stage.kanjiPoolIdList.map(id => kanji[id]).filter(Boolean) }).ordered.map(item => item.kanji.id);
  const focus = usable.slice(-2);
  let checked = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const sessionId = `f${seed}`, game = createTripGame({ sessionId, random: seeded(seed), content: contentFor({ focusKanjiIds: focus }) });
    game.enter();
    const training = game.snapshot().map[0].find(stop => stop.type === 'training');
    if (!training) continue;
    game.dispatch({ type: 'move', payload: { sessionId, nodeId: training.nodeId } });
    const first = game.snapshot().problem;
    assert.ok(focus.includes(first.contentId), first.contentId);
    game.dispatch({ type: 'answer', payload: { sessionId, problemId: first.problemId, attemptId: game.snapshot().attemptId, choiceId: first.correctChoiceId } });
    game.dispatch({ type: 'next', payload: { sessionId } });
    assert.ok(focus.includes(game.snapshot().problem.contentId));
    assert.notEqual(game.snapshot().problem.contentId, first.contentId);
    checked++;
  }
  assert.ok(checked > 0);
});

test('the trip needs a boss and readings to start', () => {
  assert.equal(createTripGame({ sessionId: 'x', content: { ...contentFor(), boss: null } }).enter(), false);
  assert.equal(createTripGame({ sessionId: 'x', content: { ...contentFor(), readings: { ordered: [], all: [] } } }).enter(), false);
});

test('the trip world adds up boss damage and speaks kindly when the boss survives', () => {
  const effects = growthStatus().effects;
  const world = createQuizWorld('trip', effects);
  world.context({ phase: 'answering', problem: { problemId: 'p1' } }); world.answer(true, { damage: 2 }, 1);
  world.context({ phase: 'answering', problem: { problemId: 'p2' } }); world.answer(true, { damage: 1 }, 1);
  const snap = world.snapshot();
  assert.equal(snap.bossDamage, 3); assert.equal(snap.bossDefeated, false);
  assert.match(snap.summary, /ボスに3ダメージ · あと2でボス撃破/);
  world.context({ phase: 'answering', problem: { problemId: 'p3' } }); world.answer(true, { damage: 2 }, 1);
  assert.equal(world.snapshot().bossDefeated, true); assert.match(world.snapshot().summary, /ボス撃破！/);
});

test('journeys keep the best boss stars per stage and validate', async () => {
  const snapshot = getDefaultSave(); snapshot.player.name = '旅QA'; snapshot.player.collection.gotomonIds = ['HKD-E01'];
  installStorage({ krb_save: JSON.stringify(snapshot) }); await loadGameData();
  const service = createGotomonService({ lookup: id => ({ id, name: id, grade: 1, category: '食文化' }) });
  const award = (sessionId, journey, gameId = 'tripSugoroku') => {
    const args = { owner: service.getOwner(), sessionId, gameId, gotomonId: 'HKD-E01', score: 1500, correct: 8, maxCombo: 4,
      completed: true, finished: true, activeElapsedMs: 90000, journey };
    args.ticket = service.beginPlay(args); return service.awardGotomonPlayResult(args);
  };
  assert.equal(award('one', { stageId: 'hokkaido_area1', stars: 2 }).reward.journeyBest, 2);
  assert.equal(award('two', { stageId: 'hokkaido_area1', stars: 1 }).reward.journeyBest, null);
  assert.equal(award('three', { stageId: 'hokkaido_area1', stars: 3 }).reward.journeyBest, 3);
  award('four', { stageId: 'tohoku_area1', stars: 3 }, 'photoRally');
  const journeys = service.getJourneys();
  assert.deepEqual(Object.keys(journeys), ['hokkaido_area1']);
  assert.equal(journeys.hokkaido_area1.stars, 3); assert.equal(journeys.hokkaido_area1.trips, 3);
  assert.doesNotThrow(() => validateSave(loadSave(), loadSave().meta.version));
  const broken = loadSave(); broken.player.miniGames.journeys = { hokkaido_area1: { stars: 4, trips: 1, firstAt: 1 } };
  assert.throws(() => validateSave(broken, broken.meta.version), /journey/i);
});
