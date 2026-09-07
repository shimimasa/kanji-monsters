import test from 'node:test';
import assert from 'node:assert/strict';
import { installStorage } from './storage-helper.mjs';
import { getDefaultSave, loadSave, saveNow } from '../../src/core/saveData.js';
import { switchToSlot } from '../../src/core/saveSlots.js';
installStorage();
const { loadGameData, saveGameData, gameState } = await import('../../src/core/gameState.js');
test('E04: saving before hydration cannot generate initial user data', () => {
  installStorage();
  assert.equal(saveGameData().ok, false);
  assert.equal(localStorage.getItem('krb_save'), null);
});
test('old tab write cannot replace the protected current save by another autosave', async () => {
  const original = getDefaultSave(); original.player.name = 'current';
  installStorage({krb_save:JSON.stringify(original)}); await loadGameData();
  assert.equal(saveGameData().ok,true);
  const committed = localStorage.getItem('krb_save');
  const stale = getDefaultSave(); stale.meta.version=1; stale.player.name='stale';
  localStorage.setItem('krb_save',JSON.stringify(stale));
  assert.equal(saveGameData().ok,false);
  assert.equal(loadSave(),null);
  assert.ok([...localStorage.data.values()].includes(committed));
});
test('a previous child in memory cannot save after slot switch', async () => {
  installStorage({krb_save:JSON.stringify(getDefaultSave())}); await loadGameData();
  gameState.playerName='first'; saveGameData();
  assert.equal(switchToSlot(2),true);
  assert.equal(saveGameData().ok,false);
  assert.equal(localStorage.getItem('krb_save'),null);
});
test('an inactive legacy slot migrates lazily and preserves its ambiguous original', async () => {
  const old=getDefaultSave();old.meta.version=1;delete old.meta.catalogVersion;
  old.player.name='second';old.player.study.answers={'g5-041':{correct:8,incorrect:2}};
  const raw=JSON.stringify(old);
  installStorage({krb_save:JSON.stringify(getDefaultSave()),yomitabi_slot_data_2:JSON.stringify({krb_save:raw})});
  await loadGameData();const first=localStorage.getItem('krb_save');
  assert.equal(JSON.parse(localStorage.getItem('yomitabi_slot_data_2')).krb_save,raw);
  assert.equal(switchToSlot(2),true);assert.equal(await loadGameData(),true);
  assert.equal(gameState.playerName,'second');assert.deepEqual(gameState.kanjiAnswerStats,{});
  assert.ok(loadSave().player.study.legacyAmbiguousKanji);
  assert.ok([...localStorage.data.values()].includes(raw));
  assert.equal(switchToSlot(1),true);assert.equal(localStorage.getItem('krb_save'),first);
  assert.equal(await loadGameData(),true);assert.equal(gameState.playerName,'');
});
