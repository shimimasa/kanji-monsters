import test from 'node:test';
import assert from 'node:assert/strict';
import { installStorage } from '../phase-a/storage-helper.mjs';
import { getDefaultSave, loadSave } from '../../src/core/saveData.js';
import { loadGameData } from '../../src/core/gameState.js';
import { createGotomonService } from '../../src/minigames/gotomonService.js';
import { validateSave } from '../../src/core/saveValidation.js';
import { GOTOMON_TYPES } from '../../src/minigames/gotomonTypes.js';
import { MOVES, moveFor, movesOf, moveEffect, partyEffects, supporterXP, validateParty, SUPPORT_EFFECTS, MOVE_LEVEL } from '../../src/minigames/gotomonMoves.js';
import { createCompanionPlay } from '../../src/minigames/companionPlay.js';
import { growthStatus } from '../../src/minigames/companionGrowth.js';

// Ten answers (two misses), the skill used whenever the gauge is full, then the end.
function playRun(options = {}) {
  const play = createCompanionPlay('s', options);
  const answers = [true, true, true, true, false, true, true, true, true, false, true, true];
  answers.forEach((right, i) => {
    play.observe({ sessionId: 's', seq: i + 1, type: right ? 'correct' : 'incorrect', payload: { score: 0 } });
    play.boost();
  });
  play.observe({ sessionId: 's', seq: 99, type: 'sessionComplete', payload: {} });
  return play.snapshot();
}

test('14 moves: two for each of the seven types, the second learned at Lv7', () => {
  assert.deepEqual(Object.keys(MOVES).sort(), GOTOMON_TYPES.map(type => type.id).sort());
  const names = Object.values(MOVES).flat().map(move => move.name);
  assert.equal(names.length, 14); assert.equal(new Set(names).size, 14, 'every name is different');
  for (const type of Object.keys(MOVES)) {
    assert.equal(moveFor(type, 1).name, MOVES[type][0].name); assert.equal(moveFor(type, MOVE_LEVEL - 1).name, MOVES[type][0].name);
    assert.equal(moveFor(type, MOVE_LEVEL).name, MOVES[type][1].name); assert.equal(moveFor(type, 10).learned, 2);
    assert.deepEqual(movesOf(type, 3).map(move => move.learned), [true, false]);
    assert.deepEqual(movesOf(type, 7).map(move => move.learned), [true, true]);
    assert.ok(SUPPORT_EFFECTS[type].name && SUPPORT_EFFECTS[type].text);
  }
  assert.equal(moveFor('nope').type, 'odd', 'an unknown type uses ふしぎ');
});

test('each move adds a fixed amount (no luck)', () => {
  const state = { base: 150, combo: 4, correct: 9, boosts: 0 };
  assert.deepEqual(moveEffect(moveFor('food'), state), { points: 0, refill: 0, feast: 15 });
  assert.deepEqual(moveEffect(moveFor('nature', 7), state), { points: 0, refill: 1, feast: 0 });
  assert.equal(moveEffect(moveFor('legend'), state).points, 30); assert.equal(moveEffect(moveFor('legend', 7), state).points, 60);
  assert.equal(moveEffect(moveFor('fest'), state).points, 60); assert.equal(moveEffect(moveFor('fest'), { combo: 20 }).points, 75, 'capped');
  assert.equal(moveEffect(moveFor('history'), state).points, 45); assert.equal(moveEffect(moveFor('history', 7), { correct: 30 }).points, 96, 'capped');
  assert.equal(moveEffect(moveFor('craft'), state).points, 50); assert.equal(moveEffect(moveFor('craft'), { boosts: 1 }).points, 10);
  assert.equal(moveEffect(moveFor('odd'), state).points, 25); assert.equal(moveEffect(moveFor('odd', 7), state).points, 45);
  assert.deepEqual(moveEffect(null, state), { points: 0, refill: 0, feast: 0 });
  for (const type of Object.keys(MOVES)) assert.deepEqual(moveEffect(moveFor(type), state), moveEffect(moveFor(type), state));
});

test('moves and supporters change only points and gauge, never the answers or learning points', () => {
  const plain = playRun(), report = {};
  for (const type of Object.keys(MOVES)) for (const level of [1, 7]) {
    const run = playRun({ move: moveFor(type, level) });
    assert.equal(run.correct, plain.correct); assert.equal(run.answered, plain.answered); assert.equal(run.learningPoints, plain.learningPoints);
    assert.ok(run.bonus >= plain.bonus, `${type} Lv${level} never lowers the points`);
    report[`${type}${level}`] = run.bonus - plain.bonus;
  }
  for (const pair of [['food', 'food'], ['nature', 'craft'], ['legend', 'fest'], ['history', 'odd']]) {
    const run = playRun({ party: partyEffects(pair) });
    assert.equal(run.correct, plain.correct); assert.equal(run.learningPoints, plain.learningPoints);
    assert.ok(run.bonus >= plain.bonus, pair.join('+'));
    report[pair.join('+')] = run.bonus - plain.bonus;
  }
  // The stronger move always gives at least as much as the first one.
  for (const type of Object.keys(MOVES)) assert.ok(report[`${type}7`] >= report[`${type}1`], type);
  console.log(`extra points over a 10-answer run (plain bonus ${plain.bonus}): ${JSON.stringify(report)}`);
});

test('feast counts the next three right answers; refill gives the gauge back', () => {
  const play = createCompanionPlay('f', { move: moveFor('food') });
  for (let seq = 1; seq <= 3; seq++) play.observe({ sessionId: 'f', seq, type: 'correct', payload: {} });
  assert.equal(play.boost(), true);
  const after = play.snapshot().bonus;
  assert.equal(after, 150); assert.equal(play.snapshot().feastLeft, 3);
  for (let seq = 4; seq <= 7; seq++) play.observe({ sessionId: 'f', seq, type: 'correct', payload: {} });
  assert.equal(play.snapshot().bonus, 150 + 3 * 15, 'three answers, not four');
  const leaf = createCompanionPlay('n', { move: moveFor('nature') });
  for (let seq = 1; seq <= 3; seq++) leaf.observe({ sessionId: 'n', seq, type: 'correct', payload: {} });
  leaf.boost(); assert.equal(leaf.snapshot().gauge, 0.5);
});

test('supporters: craft starts the gauge (at most 2), food refills after a miss, history adds at the end', () => {
  assert.equal(createCompanionPlay('a', { party: partyEffects(['craft']) }).snapshot().gauge, 1);
  assert.equal(createCompanionPlay('a', { party: partyEffects(['craft', 'craft']), growth: growthStatus({ xp: 1520 }) }).snapshot().gauge, 2, 'never starts ready');
  assert.deepEqual({ ...partyEffects(['food', 'nature', 'legend']) }, { startGauge: 0, charge: 1.1, skillPlus: 0, comboPlus: 0, recoverGauge: 0.5, finishPerCorrect: 0 }, 'two supporters at most');
  const food = createCompanionPlay('b', { party: partyEffects(['food']) });
  food.observe({ sessionId: 'b', seq: 1, type: 'incorrect', payload: {} });
  food.observe({ sessionId: 'b', seq: 2, type: 'correct', payload: {} });
  food.observe({ sessionId: 'b', seq: 3, type: 'correct', payload: {} });
  assert.equal(food.snapshot().gauge, 2.5, 'only the first right answer after the miss');
  const history = createCompanionPlay('c', { party: partyEffects(['history']) });
  history.observe({ sessionId: 'c', seq: 1, type: 'correct', payload: {} });
  history.observe({ sessionId: 'c', seq: 2, type: 'correct', payload: {} });
  history.observe({ sessionId: 'c', seq: 3, type: 'sessionComplete', payload: {} });
  assert.equal(history.snapshot().partyPoints, 6);
  assert.equal(supporterXP(27), 13); assert.equal(supporterXP(-4), 0);
  validateParty([]); validateParty(['A', 'B']);
  for (const bad of [['A', 'A'], ['A', 'B', 'C'], [3], 'A', ['']]) assert.throws(() => validateParty(bad));
});

async function fixture() {
  const initial = getDefaultSave(); initial.player.collection.gotomonIds = ['HKD-E01', 'HKD-E02', 'HKD-E03'];
  initial.player.miniGames = { games: {}, companions: { 'HKD-E01': { plays: 4, friendship: 10, xp: 40, medals: [] }, 'HKD-E02': { plays: 0, friendship: 0, xp: 720, medals: [] } } };
  installStorage({ krb_save: JSON.stringify(initial) }); await loadGameData();
  return createGotomonService({ now: () => 1000, lookup: id => ({ id, name: id, grade: 1, category: '食文化' }) });
}

test('the party is saved, carried by the ticket, and each supporter gets half the XP', async () => {
  const service = await fixture();
  assert.equal(service.getGotomonById('HKD-E01').move.name, 'ほくほくパワー');
  assert.equal(service.setParty('HKD-E01', ['HKD-E02', 'HKD-E01', 'NOT-MINE', 'HKD-E03']).ok, true);
  assert.deepEqual(service.getParty('HKD-E01'), ['HKD-E02', 'HKD-E03'], 'not the companion, not unowned');
  assert.deepEqual(service.getParty('HKD-E02'), ['HKD-E03'], 'the companion is never its own supporter');
  assert.equal(service.getProgress().selectedGotomonId, 'HKD-E01');
  const value = { owner: service.getOwner(), sessionId: 'p1', gameId: 'gotomonPush', gotomonId: 'HKD-E01',
    score: 300, correct: 8, maxCombo: 4, completed: true, finished: true, activeElapsedMs: 60000, subject: 'kanji' };
  // Supporters the award is told about directly do not count: only the ticket's.
  value.ticket = service.beginPlay({ ...value, supporterIds: ['HKD-E02', 'HKD-E02', 'HKD-E01', 'HKD-E03', 'NOT-MINE'] });
  const { reward } = service.awardGotomonPlayResult({ ...value, supporters: ['HKD-E01'] });
  assert.ok(reward.earnedXP > 0);
  assert.deepEqual(reward.supporters.map(mate => mate.id), ['HKD-E02', 'HKD-E03']);
  for (const mate of reward.supporters) assert.equal(mate.earnedXP, Math.floor(reward.earnedXP / 2));
  const companions = service.getProgress().companions;
  assert.equal(companions['HKD-E02'].xp, 720 + Math.floor(reward.earnedXP / 2));
  assert.equal(reward.supporters[0].newMove, true, 'HKD-E02 passed Lv7 (730 XP): it learned its second move');
  assert.equal(companions['HKD-E03'].plays, 0, 'a supporter gets XP only, not plays or なかよし');
  assert.equal(companions['HKD-E01'].plays, 5);
  validateSave(loadSave());
  // An old save without a party, and a run without supporters, still work.
  const solo = { ...value, sessionId: 'p2' }; solo.ticket = service.beginPlay(solo);
  assert.deepEqual(service.awardGotomonPlayResult(solo).reward.supporters, []);
});
