import test from 'node:test';
import assert from 'node:assert/strict';
import { hubRecommendations } from '../../src/minigames/hubRecommendations.js';
import { createHubActivityService } from '../../src/minigames/hubActivityService.js';
import { installStorage, quota } from '../phase-a/storage-helper.mjs';
import { getDefaultSave, loadSave, captureSaveContext } from '../../src/core/saveData.js';
import { loadGameData } from '../../src/core/gameState.js';
import { switchToSlot } from '../../src/core/saveSlots.js';
import { validateSave } from '../../src/core/saveValidation.js';
const gameIds = ['mathSprint', 'englishChoice', 'sentenceOrder'];
const owner = () => JSON.stringify(JSON.parse(captureSaveContext()).slice(0, 2));
async function fixture() {
  const storage = installStorage({ krb_save: JSON.stringify(getDefaultSave()) }); await loadGameData();
  return { storage, service: createHubActivityService() };
}
test('first visit offers one unplayed game; legacy completions count as played', () => {
  assert.deepEqual(hubRecommendations({ gameIds }).map(x => [x.kind, x.gameId]), [['new', 'mathSprint']]);
  assert.equal(hubRecommendations({ gameIds, progress: { games: { mathSprint: { plays: 1 } } } })[0].gameId, 'englishChoice');
});
test('review, recent and discovery are ordered and never duplicate a game', () => {
  const progress = { hubActivity: { lastGameId: 'mathSprint', startedGames: ['mathSprint'] } };
  const before = JSON.stringify(progress);
  const result = hubRecommendations({ gameIds, progress, reviewCount: 3 });
  assert.deepEqual(result.map(x => x.kind), ['review', 'recent', 'new']);
  assert.equal(new Set(result.map(x => x.gameId)).size, 3); assert.equal(JSON.stringify(progress), before);
  progress.hubActivity.lastGameId = 'englishChoice';
  assert.deepEqual(hubRecommendations({ gameIds, progress, reviewCount: 3 }).map(x => x.kind), ['review', 'new']);
});
test('all-played history offers recent only; removed IDs are never recommended', () => {
  const progress = { hubActivity: { lastGameId: 'sentenceOrder', startedGames: gameIds } };
  assert.deepEqual(hubRecommendations({ gameIds, progress }).map(x => x.kind), ['recent']);
  progress.hubActivity.lastGameId = 'removed';
  assert.deepEqual(hubRecommendations({ gameIds, progress }), []);
});
test('recorded start survives reload without awarding a play, score or companion XP', async () => {
  const { service } = await fixture();
  assert.equal(service.recordStart({ gameId: 'mathSprint', owner: owner(), gameIds }).ok, true);
  service.recordStart({ gameId: 'mathSprint', owner: owner(), gameIds });
  service.recordStart({ gameId: 'sentenceOrder', owner: owner(), gameIds });
  await loadGameData();
  const progress = loadSave().player.miniGames;
  assert.deepEqual(progress.hubActivity, { version: 1, lastGameId: 'sentenceOrder', startedGames: ['mathSprint', 'sentenceOrder'] });
  assert.deepEqual(progress.games, {}); assert.deepEqual(progress.companions, {});
});
test('quota failure and unknown game leave canonical save unchanged', async () => {
  const { service, storage } = await fixture(), before = storage.getItem('krb_save');
  assert.equal(service.recordStart({ gameId: 'unknown', owner: owner(), gameIds }).ok, false);
  storage.fail = (op, key) => { if (op === 'set' && key === 'krb_save') throw quota(); };
  assert.equal(service.recordStart({ gameId: 'mathSprint', owner: owner(), gameIds }).ok, false);
  assert.equal(storage.getItem('krb_save'), before);
});
test('slot switch rejects former owner and keeps recommendations separate', async () => {
  const { service } = await fixture(), previousOwner = owner();
  service.recordStart({ gameId: 'sentenceOrder', owner: previousOwner, gameIds });
  switchToSlot(2); await loadGameData();
  assert.equal(service.recordStart({ gameId: 'mathSprint', owner: previousOwner, gameIds }).ok, false);
  assert.equal(loadSave().player.miniGames, undefined);
  switchToSlot(1); await loadGameData();
  assert.equal(loadSave().player.miniGames.hubActivity.lastGameId, 'sentenceOrder');
});
test('activity validator rejects malformed metadata while old saves remain valid', () => {
  const save = getDefaultSave(); validateSave(save, 2);
  save.player.miniGames = { hubActivity: { version: 1, lastGameId: 'mathSprint', startedGames: ['mathSprint'] } };
  validateSave(save, 2);
  save.player.miniGames.hubActivity.startedGames.push('mathSprint');
  assert.throws(() => validateSave(save, 2), /hub activity/);
});
