import test from 'node:test';
import assert from 'node:assert/strict';
import { installStorage, quota } from '../phase-a/storage-helper.mjs';
import { getDefaultSave, loadSave, migrateSave } from '../../src/core/saveData.js';
import { loadGameData, saveGameData } from '../../src/core/gameState.js';
import { addMonster } from '../../src/models/monsterDex.js';
import { switchToSlot } from '../../src/core/saveSlots.js';
import { createGotomonService } from '../../src/minigames/gotomonService.js';
import { createCompanionPlay } from '../../src/minigames/companionPlay.js';

async function fixture() {
  const initial = getDefaultSave(); initial.player.name = '旧セーブ'; initial.player.coreStats.exp = 42;
  initial.player.collection.gotomonIds = ['HKD-E01', 'HKD-E02'];
  const storage = installStorage({ krb_save: JSON.stringify(initial) });
  await loadGameData();
  return { storage, service: createGotomonService({ lookup: id => ({ id, name: id, grade: 1 }) }) };
}
test('legacy snapshot stays compatible; captures and selection share the canonical inventory', async () => {
  const { service } = await fixture();
  assert.deepEqual(service.getOwnedGotomon().map(x => x.id), ['HKD-E01', 'HKD-E02']);
  assert.equal(service.setSelectedGotomon('HKD-E03').ok, false);
  addMonster('HKD-E03');
  assert.equal(service.setSelectedGotomon('HKD-E03').ok, true);
  assert.equal(service.getSelectedGotomon().id, 'HKD-E03');
  assert.equal(loadSave().player.coreStats.exp, 42);
  await loadGameData(); assert.equal(service.getSelectedGotomon().id, 'HKD-E03');
  assert.equal(migrateSave(loadSave()).player.miniGames.selectedGotomonId, 'HKD-E03');
});
test('pre-v1 local save hydrates existing captured IDs without creating another collection', async () => {
  installStorage({ kanjiGameSave: JSON.stringify({ playerName: '昔の旅人', playerStats: { level: 2, exp: 25 } }),
    krb_monster_dex: JSON.stringify(['HKD-E02']) });
  assert.equal(await loadGameData(), true);
  const service = createGotomonService({ lookup: id => ({ id, name: id, grade: 1 }) });
  assert.deepEqual(service.getOwnedGotomon().map(item => item.id), ['HKD-E02']);
  assert.equal(service.setSelectedGotomon('HKD-E02').ok, true);
  assert.equal(loadSave().player.name, '昔の旅人'); assert.equal(loadSave().player.coreStats.exp, 25);
});
test('one completed session awards once; autosave and export retain friendship and best', async () => {
  const { service } = await fixture();
  const result = { owner: service.getOwner(), sessionId: 'one', gameId: 'mathSprint', gotomonId: 'HKD-E02', score: 1300, correct: 10, maxCombo: 10 };
  assert.equal(service.awardGotomonPlayResult(result).reward.earned, 4);
  assert.equal(service.awardGotomonPlayResult(result).reward.duplicate, true);
  assert.equal(service.getProgress().games.mathSprint.plays, 1);
  saveGameData(); await loadGameData();
  assert.equal(service.getProgress().games.mathSprint.bestScore, 1300);
  assert.equal(service.getProgress().companions['HKD-E02'].friendship, 4);
  assert.deepEqual(loadSave().player.collection.gotomonIds, ['HKD-E01', 'HKD-E02']);
});
test('quota failure leaves inventory and progress unchanged; a retry awards once', async () => {
  const { service, storage } = await fixture(); const before = storage.getItem('krb_save');
  const result = { owner: service.getOwner(), sessionId: 'quota', gameId: 'englishChoice', gotomonId: 'HKD-E01', score: 500, correct: 5, maxCombo: 3 };
  storage.fail = (op, key) => { if (op === 'set' && key === 'krb_save') throw quota(); };
  assert.equal(service.awardGotomonPlayResult(result).ok, false);
  assert.equal(storage.getItem('krb_save'), before);
  storage.fail = null; assert.equal(service.awardGotomonPlayResult(result).ok, true);
  assert.equal(service.getProgress().games.englishChoice.plays, 1);
});
test('slot change rejects a stale result and never leaks the former child inventory', async () => {
  const { service } = await fixture(), owner = service.getOwner();
  assert.equal(switchToSlot(2), true); await loadGameData();
  assert.deepEqual(service.getOwnedGotomon(), []);
  assert.equal(service.awardGotomonPlayResult({ owner, sessionId: 'old', gameId: 'mathSprint', gotomonId: 'HKD-E01', score: 100 }).ok, false);
  assert.equal(switchToSlot(1), true); await loadGameData();
  assert.equal(service.getOwnedGotomon().length, 2);
});
test('gauge follows committed answers; stale events, pause and duplicate boost cannot inflate score', () => {
  const play = createCompanionPlay('play');
  for (let seq = 1; seq <= 3; seq++) play.observe({ sessionId: 'play', seq, type: 'correct' });
  play.observe({ sessionId: 'other', seq: 20, type: 'correct' });
  play.observe({ sessionId: 'play', seq: 3, type: 'correct' });
  assert.equal(play.snapshot().score, 300); assert.equal(play.boost(true), false);
  assert.equal(play.boost(), true); assert.equal(play.boost(), false);
  assert.equal(play.snapshot().score, 450);
  play.observe({ sessionId: 'play', seq: 4, type: 'incorrect', payload: {} });
  assert.equal(play.snapshot().combo, 0); assert.equal(play.snapshot().score, 450);
  play.observe({ sessionId: 'play', seq: 5, type: 'sessionComplete' });
  play.observe({ sessionId: 'play', seq: 6, type: 'correct' });
  assert.equal(play.snapshot().score, 450);
});
