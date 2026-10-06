import test from 'node:test';
import assert from 'node:assert/strict';
import { installStorage, quota } from '../phase-a/storage-helper.mjs';
import { getDefaultSave, loadSave } from '../../src/core/saveData.js';
import { loadGameData } from '../../src/core/gameState.js';
import { createGotomonService } from '../../src/minigames/gotomonService.js';
import { loadDex } from '../../src/models/monsterDex.js';
import { getMonsterById, getAllMonsterIds } from '../../src/loaders/dataLoader.js';

async function fixture() {
  const initial = getDefaultSave();
  initial.player.collection.gotomonIds = ['HKD-E01'];
  const storage = installStorage({ krb_save: JSON.stringify(initial) });
  await loadGameData();
  const service = createGotomonService({ lookup: id => getMonsterById(id) ?? { id, name: id, grade: 1 }, now: () => 1000 });
  return { storage, service };
}

function play(service, sessionId, gameId = 'mathSprint', options = {}) {
  const run = { owner: service.getOwner(), sessionId, gameId, gotomonId: 'HKD-E01',
    score: 500, correct: 4, maxCombo: 2, completed: true, finished: true,
    memoryFinished: true, activeElapsedMs: 30000, ...options };
  run.ticket = service.beginPlay(run);
  return run;
}

test('正式な完走で対応する1体を捕獲し、同じ図鑑と相棒一覧に残る', async () => {
  const { service } = await fixture();
  const first = play(service, 'first');
  const receipt = service.awardGotomonPlayResult(first);
  assert.equal(receipt.ok, true);
  assert.equal(receipt.reward.newGotomon?.id, 'MG-001');
  assert.deepEqual(loadSave().player.collection.gotomonIds, ['HKD-E01', 'MG-001']);
  assert.equal(loadDex().has('MG-001'), true);
  assert.equal(service.getOwnedGotomon().find(friend => friend.id === 'MG-001')?.imageUrl, '/assets/images/monsters/full/mini-game/MG-001.webp');
  assert.equal(service.awardGotomonPlayResult(first).reward.duplicate, true);
  assert.equal(service.awardGotomonPlayResult(play(service, 'again')).reward.newGotomon, null);
  assert.deepEqual(loadSave().player.collection.gotomonIds, ['HKD-E01', 'MG-001']);
  assert.equal(service.awardGotomonPlayResult(play(service, 'other', 'historyBuild')).reward.newGotomon?.id, 'MG-050');
  assert.deepEqual(loadSave().player.collection.gotomonIds, ['HKD-E01', 'MG-001', 'MG-050']);
  await loadGameData();
  assert.equal(loadDex().has('MG-050'), true);
});

test('未完走と守れなかった結果は捕獲せず、保存失敗後の再試行で一度だけ捕獲', async () => {
  const { service, storage } = await fixture();
  const unfinished = play(service, 'unfinished', 'mathSprint', { finished: false, memoryFinished: false });
  assert.equal(service.awardGotomonPlayResult(unfinished).reward.newGotomon, null);
  assert.equal(loadDex().has('MG-001'), false);
  const failed = play(service, 'failed', 'mathInvader', { memoryFinished: false });
  assert.equal(service.awardGotomonPlayResult(failed).reward.newGotomon, null);
  assert.equal(loadDex().has('MG-002'), false);
  const next = play(service, 'retry');
  storage.fail = (operation, key) => { if (operation === 'set' && key === 'krb_save') throw quota(); };
  assert.equal(service.awardGotomonPlayResult(next).ok, false);
  assert.equal(loadDex().has('MG-001'), false);
  storage.fail = null;
  assert.equal(service.awardGotomonPlayResult(next).reward.newGotomon?.id, 'MG-001');
  assert.equal(loadSave().player.collection.gotomonIds.filter(id => id === 'MG-001').length, 1);
});

test('広場の50体は図鑑のデータと画像に対応する', () => {
  const ids = getAllMonsterIds({ includeMiniGames: true }).filter(id => id.startsWith('MG-'));
  assert.equal(ids.length, 50);
  for (const id of ids) {
    const monster = getMonsterById(id);
    assert.equal(monster.grade, 0);
    assert.equal(monster.prefecture, 'ミニゲーム広場');
    assert.equal(monster.imageUrl, `/assets/images/monsters/full/mini-game/${id}.webp`);
  }
});
