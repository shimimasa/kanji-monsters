import test from 'node:test';
import assert from 'node:assert/strict';
import { installStorage, quota } from './storage-helper.mjs';
import { getDefaultSave, loadSave } from '../../src/core/saveData.js';
import { loadGameData, gameState } from '../../src/core/gameState.js';
import queue from '../../src/models/reviewQueue.js';
import { addKanji } from '../../src/models/kanjiDex.js';
import { addMonster } from '../../src/models/monsterDex.js';
test('queue and dex writes commit the current learning snapshot, not orphan mirror data', async () => {
  installStorage({krb_save:JSON.stringify(getDefaultSave())});await loadGameData();
  gameState.kanjiAnswerStats={'g1-001':{correct:0,incorrect:1}};
  queue.add('g1-001');addKanji('g1-002');addMonster('HKD-E01');
  const save=loadSave();assert.equal(save.player.study.answers['g1-001'].incorrect,1);
  assert.equal(save.player.study.reviewQueueDetail[0]?.id,'g1-001');
  assert.deepEqual(save.player.collection.kanjiIds,['g1-002']);
  assert.deepEqual(save.player.collection.gotomonIds,['HKD-E01']);
});
test('failed queue/dex write leaves both canonical and mirror unchanged', async () => {
  const storage=installStorage({krb_save:JSON.stringify(getDefaultSave())});await loadGameData();
  const raw=storage.getItem('krb_save');
  storage.fail=(op,key)=>{if(op==='set'&&key==='krb_save')throw quota();};
  queue.add('g1-001');addKanji('g1-002');addMonster('HKD-E01');
  assert.equal(storage.getItem('krb_save'),raw);
  assert.deepEqual(queue.getAll(),[]);
  assert.deepEqual(JSON.parse(storage.getItem('krb_kanji_dex')),[]);
  assert.deepEqual(JSON.parse(storage.getItem('krb_monster_dex')),[]);
});
