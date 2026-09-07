import test from 'node:test';
import assert from 'node:assert/strict';
import { installStorage } from './storage-helper.mjs';
import { getDefaultSave, saveNow, loadSave, hardResetAllLocalData } from '../../src/core/saveData.js';
import { loadGameData, saveGameData } from '../../src/core/gameState.js';
for (const [label, corrupt] of [
  ['version tag with empty core data', s=>s.player.coreStats={}],
  ['empty answer counters', s=>s.player.study.answers={'g1-001':{}}],
  ['invalid readings', s=>s.player.study.kanjiReadProgress={'g1-001':{onyomi:{},kunyomi:[],mastered:true}}],
  ['negative checkpoint', s=>s.player.progress.checkpoints={stage1:-5}],
  ['invalid daily', s=>s.player.study.dailyAnswerStats={today:{correct:'9',total:3}}],
  ['object ID', s=>s.player.collection.kanjiIds=[{}]],
  ['unknown recording version', s=>s.meta.recordingVersion=999],
  ['prototype pollution', s=>s.player.study.answers=JSON.parse('{"__proto__":{"correct":1,"incorrect":0}}')]
]) test(`E02: ${label} is rejected before any import write`, () => {
  const raw=JSON.stringify(getDefaultSave());installStorage({krb_save:raw});const data=getDefaultSave();corrupt(data);
  assert.equal(saveNow(data,{replace:true}).ok,false);assert.equal(localStorage.getItem('krb_save'),raw);
});
test('E02: invalid live mirror data cannot be silently saved as an empty queue', async () => {
  const storage=installStorage({krb_save:JSON.stringify(getDefaultSave())});await loadGameData();const original=storage.getItem('krb_save');
  storage.setItem('krb_review_queue','{broken');
  assert.equal(saveGameData().ok,false);assert.equal(storage.getItem('krb_save'),original);assert.equal(storage.getItem('krb_review_queue'),'{broken');
});
test('explicit reset also retires its confirmed copy, without affecting another slot', async () => {
  installStorage({krb_save:JSON.stringify(getDefaultSave()),yomitabi_confirmed_2:'another child'});await loadGameData();saveGameData();
  assert.equal(hardResetAllLocalData().ok,true);
  assert.equal(localStorage.getItem('yomitabi_confirmed_1'),null);assert.equal(localStorage.getItem('yomitabi_confirmed_2'),'another child');
  assert.ok(loadSave());
});
