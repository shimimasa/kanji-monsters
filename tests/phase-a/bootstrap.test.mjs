import test from 'node:test';
import assert from 'node:assert/strict';
import { installStorage } from './storage-helper.mjs';
import { getDefaultSave, saveNow } from '../../src/core/saveData.js';
import { initializeSaveSession } from '../../src/core/saveBootstrap.js';
import { saveGameData, gameState } from '../../src/core/gameState.js';
test('startup waits for cloud recovery without generating a default save', async () => {
  installStorage(); let release; const wait = new Promise(r=>release=r);
  const boot = initializeSaveSession(async()=>{await wait;const remote=getDefaultSave();remote.player.name='recovered';saveNow(remote);});
  assert.equal(saveGameData().ok,false);
  assert.equal(localStorage.getItem('krb_save'),null);
  release();assert.equal((await boot).ok,true);assert.equal(gameState.playerName,'recovered');
});
test('failed remote lookup preserves missing state, existing local data remains playable', async () => {
  installStorage(); const offline=async()=>{throw new Error('offline');};
  assert.equal((await initializeSaveSession(offline)).ok,false);
  assert.equal(localStorage.getItem('krb_save'),null);
  installStorage({krb_save:JSON.stringify(getDefaultSave())});
  assert.equal((await initializeSaveSession(offline)).ok,true);
});
test('legacy local learning mirrors are migrated before any cloud replacement', async () => {
  installStorage({krb_review_queue:'[{"id":"g1-001","nextReviewAt":999,"interval":6,"repetition":2,"eFactor":2.4}]'});
  const boot=await initializeSaveSession(async()=>{
    assert.notEqual(localStorage.getItem('krb_save'),null);
  });
  assert.equal(boot.ok,true);
  assert.equal(JSON.parse(localStorage.getItem('krb_save')).player.study.reviewQueueDetail[0].nextReviewAt,999);
});
