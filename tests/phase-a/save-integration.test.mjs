import test from 'node:test';
import assert from 'node:assert/strict';
import { installStorage, quota } from './storage-helper.mjs';
import { getDefaultSave, loadSave, saveNow } from '../../src/core/saveData.js';
import { STORAGE_JOURNAL_KEY, recoverStorageTransaction, writeStorageTransaction } from '../../src/core/storageTransaction.js';

test('saveGameData returns the actual failure, not an early success', async () => {
  const storage = installStorage({ krb_save: JSON.stringify(getDefaultSave()) });
  const { loadGameData, saveGameData, gameState } = await import('../../src/core/gameState.js');
  await loadGameData();
  const original = storage.getItem('krb_save');
  gameState.playerStats.level = 15;
  storage.fail = (op, key) => { if (op === 'set' && key === 'krb_save') throw quota(); };
  const result = await saveGameData();
  assert.equal(result?.ok, false);
  assert.equal(storage.getItem('krb_save'), original);
});

test('load recovers an interrupted transaction before reading', () => {
  const original = JSON.stringify(getDefaultSave());
  const other = getDefaultSave(); other.player.name = 'different child';
  const storage = installStorage({ krb_save: JSON.stringify(other),
    [STORAGE_JOURNAL_KEY]: JSON.stringify({ version: 1, before: { krb_save: original } }) });
  assert.equal(loadSave().player.name, '');
  assert.equal(storage.getItem(STORAGE_JOURNAL_KEY), null);
});

test('persistent rollback failure preserves the recovery journal until a later retry', () => {
  const storage = installStorage({ a: 'before', b: 'before' });
  let broken = false;
  storage.fail = (op, key, value) => {
    if (op === 'set' && key === 'b' && value === 'after') { broken = true; throw quota(); }
    if (broken && op === 'set' && key === 'a') throw quota();
  };
  const result = writeStorageTransaction({ a: 'after', b: 'after' });
  assert.equal(result.ok, false);
  assert.equal(result.recoveryRequired, true);
  assert.notEqual(storage.getItem(STORAGE_JOURNAL_KEY), null);
  storage.fail = null;
  assert.equal(recoverStorageTransaction().ok, true);
  assert.equal(storage.getItem('a'), 'before');
});

test('explicit import preserves the original and rejects malformed/unknown versions', () => {
  const original = JSON.stringify(getDefaultSave());
  const storage = installStorage({ krb_save: original });
  assert.equal(saveNow({}, { replace: true }).ok, false);
  const future = getDefaultSave(); future.meta.version = 999;
  assert.equal(saveNow(future, { replace: true }).ok, false);
  const target = getDefaultSave(); target.player.name = 'imported';
  assert.equal(saveNow(target, { replace: true }).ok, true);
  assert.ok([...storage.data.entries()].some(([key, value]) => key.startsWith('yomitabi_preserved_') && value === original));
});
test('corrupt or unknown recovery journals block reads and writes without guessing a rollback', () => {
  for (const journal of ['{broken',JSON.stringify({version:99,before:{krb_save:null}})]) {
    const raw=JSON.stringify(getDefaultSave());installStorage({krb_save:raw,[STORAGE_JOURNAL_KEY]:journal});
    assert.equal(loadSave(),null);assert.equal(saveNow(getDefaultSave()).ok,false);
    assert.equal(localStorage.getItem('krb_save'),raw);assert.equal(localStorage.getItem(STORAGE_JOURNAL_KEY),journal);
  }
});
