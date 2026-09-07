import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as saves from '../../src/core/saveData.js';
import * as slots from '../../src/core/saveSlots.js';
import { installStorage, quota } from './storage-helper.mjs';

let storage;
beforeEach(() => { storage = installStorage(); });
function fixture(name = '一人目') {
  const save = saves.getDefaultSave();
  save.player.name = name;
  save.player.coreStats.level = 12;
  return save;
}
function seed() {
  const raw = JSON.stringify(fixture());
  storage.setItem('krb_save', raw);
  storage.setItem('krb_review_queue', JSON.stringify([{ id: 'g1-001', nextReviewAt: 99 }]));
  storage.setItem('yomitabi_slot_data_2', JSON.stringify({ krb_save: JSON.stringify(fixture('二人目')) }));
  return raw;
}

test('E04: a missing save is read without creating defaults in Storage', () => {
  saves.loadSave();
  assert.equal(storage.getItem('krb_save'), null);
});
test('E02: corrupt JSON remains byte-for-byte available', () => {
  const raw = '{"player":';
  storage.setItem('krb_save', raw);
  saves.loadSave();
  assert.equal(storage.getItem('krb_save'), raw);
});
test('E02: an unsupported save version is never downgraded', () => {
  const save = fixture(); save.meta.version = 999;
  const raw = JSON.stringify(save); storage.setItem('krb_save', raw);
  saves.loadSave();
  assert.equal(storage.getItem('krb_save'), raw);
  assert.equal(saves.saveNow(fixture()).ok, false);
  assert.equal(storage.getItem('krb_save'), raw);
});
test('E02: unrelated, empty and invalidly typed JSON cannot overwrite a save', () => {
  const raw = seed();
  for (const invalid of [{}, [], null, { ...fixture(), player: [] }]) {
    assert.equal(saves.saveNow(invalid).ok, false);
    assert.equal(storage.getItem('krb_save'), raw);
  }
});
test('E03: storage quota failure is returned, with the original save intact', () => {
  const raw = seed();
  storage.fail = (op, key) => { if (op === 'set' && key === 'krb_save') throw quota(); };
  assert.equal(saves.saveNow(fixture('変更')).ok, false);
  assert.equal(storage.getItem('krb_save'), raw);
});
test('E03: successful storage writes return a confirmed result', () => {
  assert.equal(saves.saveNow(fixture()).ok, true);
  assert.equal(JSON.parse(storage.getItem('krb_save')).player.coreStats.level, 12);
});
test('E01: source snapshot failure aborts slot switching before deletion', () => {
  const raw = seed();
  storage.fail = (op, key) => { if (op === 'set' && key === 'yomitabi_slot_data_1') throw quota(); };
  assert.equal(slots.switchToSlot(2), false);
  assert.equal(storage.getItem('krb_save'), raw);
  assert.equal(slots.getCurrentSlot(), 1);
});
test('E01: invalid target slot JSON is rejected without touching the current child', () => {
  const raw = seed(); storage.setItem('yomitabi_slot_data_2', '{');
  assert.equal(slots.switchToSlot(2), false);
  assert.equal(storage.getItem('krb_save'), raw);
  assert.equal(slots.getCurrentSlot(), 1);
});
test('E01: failure while restoring the target rolls back all owned keys', () => {
  const raw = seed(), queue = storage.getItem('krb_review_queue');
  let failed = false;
  storage.fail = (op, key) => {
    if (!failed && op === 'set' && key === 'krb_save') { failed = true; throw quota(); }
  };
  assert.equal(slots.switchToSlot(2), false);
  assert.equal(storage.getItem('krb_save'), raw);
  assert.equal(storage.getItem('krb_review_queue'), queue);
  assert.equal(slots.getCurrentSlot(), 1);
});
test('E01: slot-number write failure rolls back the restored child', () => {
  const raw = seed(); let failed = false;
  storage.fail = (op, key) => {
    if (!failed && op === 'set' && key === 'yomitabi_slot') { failed = true; throw quota(); }
  };
  assert.equal(slots.switchToSlot(2), false);
  assert.equal(storage.getItem('krb_save'), raw);
  assert.equal(slots.getCurrentSlot(), 1);
});
test('existing saves: 1 -> 2 -> 1 preserves progress and unrelated settings', () => {
  const raw = seed(), queue = storage.getItem('krb_review_queue');
  storage.setItem('bgmVolume', '0.4'); storage.setItem('unrelated-app', 'untouched');
  assert.equal(slots.switchToSlot(2), true);
  assert.equal(JSON.parse(storage.getItem('krb_save')).player.name, '二人目');
  assert.equal(slots.switchToSlot(1), true);
  assert.equal(storage.getItem('krb_save'), raw);
  assert.equal(storage.getItem('krb_review_queue'), queue);
  assert.equal(storage.getItem('bgmVolume'), '0.4');
  assert.equal(storage.getItem('unrelated-app'), 'untouched');
});
