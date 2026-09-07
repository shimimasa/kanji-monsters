import test from 'node:test';
import assert from 'node:assert/strict';
import { installStorage, quota } from './storage-helper.mjs';
import { getDefaultSave, saveNow, loadSave } from '../../src/core/saveData.js';
installStorage();
const { gameState, loadGameData, saveGameData } = await import('../../src/core/gameState.js');
const { default: queue } = await import('../../src/models/reviewQueue.js');

test('E05: restoring empty data replaces queue, answers, dex, stages and checkpoint in memory and Storage', async () => {
  const old = getDefaultSave(); old.player.study.reviewQueueDetail = [{id:'g1-001',nextReviewAt:0}];
  old.player.study.answers = {'g1-001':{correct:3,incorrect:1}};
  old.player.collection.kanjiIds = ['g1-001']; old.player.progress.clearedStages = ['stage1'];
  old.player.progress.checkpoints = { stage2: 5 };
  installStorage({krb_save:JSON.stringify(old)}); await loadGameData();
  assert.equal(queue.size(), 1);
  const empty = getDefaultSave();
  assert.equal(saveNow(empty, {replace:true}).ok, true);
  assert.equal(await loadGameData(), true);
  assert.deepEqual(queue.getAll(), []);
  assert.deepEqual(gameState.stageProgress, {});
  assert.deepEqual(gameState.kanjiAnswerStats, {});
  assert.deepEqual(JSON.parse(localStorage.getItem('krb_kanji_dex')), []);
  assert.equal(gameState.currentStageId, null);
  assert.equal(saveGameData().ok, true);
  assert.deepEqual(loadSave().player.study.reviewQueueDetail, []);
});
test('G03: fifth enemy checkpoint survives save/reload and clears on victory', async () => {
  installStorage({krb_save:JSON.stringify(getDefaultSave())}); await loadGameData();
  gameState.stageProgress = { stage1: {checkpoint:5} }; gameState.currentStageId = 'stage1';
  assert.equal(saveGameData().ok, true);
  gameState.stageProgress = {}; await loadGameData();
  assert.equal(gameState.stageProgress.stage1.checkpoint, 5);
  gameState.stageProgress.stage1 = {cleared:true}; saveGameData(); await loadGameData();
  assert.deepEqual(gameState.stageProgress.stage1, {cleared:true});
});
test('E05: mirror write failure rejects import and rolls back canonical and memory', async () => {
  const old = getDefaultSave(); old.player.name = 'original';
  const storage = installStorage({krb_save:JSON.stringify(old)}); await loadGameData();
  const raw = storage.getItem('krb_save');
  const target = getDefaultSave(); target.player.study.reviewQueueDetail=[{id:'g1-002',nextReviewAt:0}];
  storage.fail = (op,key,value) => { if(op==='set' && key==='krb_review_queue' && value.includes('g1-002')) throw quota(); };
  assert.equal(saveNow(target,{replace:true}).ok,false);
  assert.equal(storage.getItem('krb_save'),raw);
  assert.equal(gameState.playerName,'original');
});
test('old raw legacy review details remain available and invalid legacy data is not replaced', async () => {
  const detail = [{id:'g1-003',nextReviewAt:999,interval:6,repetition:2,eFactor:2.4}];
  installStorage({kanjiGameSave:JSON.stringify({playerName:'old',playerStats:{level:8}}),krb_review_queue:JSON.stringify(detail)});
  assert.equal(await loadGameData(),true);
  assert.deepEqual(queue.getAll(),detail);
  installStorage({kanjiGameSave:'{broken'});
  assert.equal(await loadGameData(),false);
  assert.equal(saveGameData().ok,false);
  assert.equal(localStorage.getItem('krb_save'),null);
});
test('existing unmerged clear keys migrate once, then an empty backup clears legacy mirrors too', async () => {
  const old=getDefaultSave();old.meta.version=1;delete old.meta.catalogVersion;
  installStorage({krb_save:JSON.stringify(old),clear_stage1:'1',stage_clear_stage1:'7',stage_first_clear_at_stage1:'123',tutorial_seen_battle:'1'});
  await loadGameData();assert.equal(gameState.stageProgress.stage1?.cleared,true);
  saveGameData();const backup=loadSave();
  assert.equal(backup.meta.compatibilityEntries.stage_clear_stage1,'7');
  saveNow(getDefaultSave(),{replace:true});await loadGameData();
  assert.equal(localStorage.getItem('stage_clear_stage1'),null);
  assert.equal(localStorage.getItem('clear_stage1'),null);
  saveNow(backup,{replace:true});await loadGameData();
  assert.equal(localStorage.getItem('stage_clear_stage1'),'7');
  assert.equal(localStorage.getItem('tutorial_seen_battle'),'1');
});
