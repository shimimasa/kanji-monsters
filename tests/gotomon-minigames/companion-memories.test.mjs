import test from 'node:test';
import assert from 'node:assert/strict';
import { installStorage, quota } from '../phase-a/storage-helper.mjs';
import { getDefaultSave, loadSave } from '../../src/core/saveData.js';
import { loadGameData, saveGameData } from '../../src/core/gameState.js';
import { switchToSlot } from '../../src/core/saveSlots.js';
import { createGotomonService } from '../../src/minigames/gotomonService.js';
import { validateSave } from '../../src/core/saveValidation.js';

async function fixture() {
  const initial = getDefaultSave(); initial.player.collection.gotomonIds = ['HKD-E01', 'HKD-E02'];
  initial.player.miniGames = { games: { englishChoice: { plays: 4, bestScore: 9999 } },
    companions: { 'HKD-E01': { plays: 4, friendship: 10, xp: 40, medals: [] } } };
  const storage = installStorage({ krb_save: JSON.stringify(initial) }); await loadGameData();
  let time = 1000;
  const service = createGotomonService({ now: () => time, lookup: id => ({ id, name: id, grade: 1 }) });
  return { service, storage, setTime: value => { time = value; } };
}
function args(service, sessionId, options = {}) {
  const value = { owner: service.getOwner(), sessionId, gameId: 'englishChoice', gotomonId: 'HKD-E01',
    score: 500, correct: 5, maxCombo: 3, completed: true, finished: true, activeElapsedMs: 45000, ...options };
  value.ticket = service.beginPlay(value); return value;
}
const memory = (service, id = 'HKD-E01') => service.getProgress().companions?.[id]?.memories?.games.englishChoice;
test('old progress is not backfilled; first completion stores a separate companion best', async () => {
  const { service } = await fixture(); assert.equal(memory(service), undefined);
  const result = service.awardGotomonPlayResult(args(service, 'first'));
  assert.equal(result.ok, true); assert.equal(result.reward.newBest, false);
  assert.equal(result.reward.memory.firstFinish, true);
  assert.deepEqual(memory(service), { plays: 1, firstPlayedAt: 1000, lastPlayedAt: 1000, bestScore: 500, bestAt: 1000, firstFinishedAt: 1000 });
  assert.equal(service.getProgress().games.englishChoice.bestScore, 9999);
  saveGameData(); await loadGameData(); assert.equal(memory(service).plays, 1);
});
test('duplicate awards do not create duplicate memories or growth', async () => {
  const { service } = await fixture(), run = args(service, 'same');
  service.awardGotomonPlayResult(run); const before = JSON.stringify(loadSave().player.miniGames);
  assert.equal(service.awardGotomonPlayResult(run).reward.duplicate, true);
  assert.equal(JSON.stringify(loadSave().player.miniGames), before);
});
test('best is per companion; ties preserve best date and first-finish date', async () => {
  const { service, setTime } = await fixture(); service.awardGotomonPlayResult(args(service, 'one'));
  setTime(2000); const better = service.awardGotomonPlayResult(args(service, 'two', { score: 800 }));
  assert.equal(better.reward.memory.newBest, true); assert.equal(memory(service).bestAt, 2000);
  setTime(3000); service.awardGotomonPlayResult(args(service, 'three', { score: 800 }));
  assert.equal(memory(service).bestAt, 2000); assert.equal(memory(service).firstFinishedAt, 1000);
  service.awardGotomonPlayResult(args(service, 'other', { gotomonId: 'HKD-E02', score: 200 }));
  assert.equal(memory(service, 'HKD-E02').bestScore, 200); assert.equal(memory(service).bestScore, 800);
});
test('failed game is a played memory but not a finish; later completion records first finish', async () => {
  const { service, setTime } = await fixture();
  service.awardGotomonPlayResult(args(service, 'failed', { finished: false, memoryFinished: false }));
  assert.equal(memory(service).firstFinishedAt, null);
  setTime(2000); service.awardGotomonPlayResult(args(service, 'clear'));
  assert.equal(memory(service).firstFinishedAt, 2000); assert.equal(memory(service).plays, 2);
});
test('abandoned or stale tickets cannot create memories', async () => {
  const { service } = await fixture(); const old = args(service, 'old', { completed: false });
  assert.equal(service.awardGotomonPlayResult(old).ok, false);
  args(service, 'new'); assert.equal(service.awardGotomonPlayResult({ ...old, completed: true }).ok, false);
  assert.equal(memory(service), undefined);
});
test('quota failure rolls back memories and growth together; retry adds both exactly once', async () => {
  const { service, storage } = await fixture(), run = args(service, 'quota'), before = storage.getItem('krb_save');
  storage.fail = (op, key) => { if (op === 'set' && key === 'krb_save') throw quota(); };
  assert.equal(service.awardGotomonPlayResult(run).ok, false); assert.equal(storage.getItem('krb_save'), before);
  storage.fail = null; assert.equal(service.awardGotomonPlayResult(run).ok, true);
  service.awardGotomonPlayResult(run); assert.equal(memory(service).plays, 1);
  assert.equal(service.getProgress().companions['HKD-E01'].plays, 5);
});
test('slot change cannot mix companion memories', async () => {
  const { service } = await fixture(), run = args(service, 'slot');
  switchToSlot(2); await loadGameData(); assert.equal(service.awardGotomonPlayResult(run).ok, false);
  assert.equal(memory(service), undefined);
  switchToSlot(1); await loadGameData(); assert.equal(memory(service), undefined);
});
test('invalid memory counts and unknown games are rejected by save validation', async () => {
  const { service } = await fixture(); service.awardGotomonPlayResult(args(service, 'validate'));
  const save = loadSave(); validateSave(save, 2);
  save.player.miniGames.companions['HKD-E01'].memories.games.englishChoice.plays = -1;
  assert.throws(() => validateSave(save, 2), /companion memory/);
});
