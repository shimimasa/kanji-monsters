import test from 'node:test';
import assert from 'node:assert/strict';
import { getDefaultSave, migrateSave, saveNow } from '../../src/core/saveData.js';
import { installStorage, quota } from './storage-helper.mjs';
const pairs = { 'g5-041': '許均', 'g5-043': '禁句', 'g6-134': '潮賃', 'g7-062': '凶叫', 'g8-046': '犠菊', 'g9-053': '拒享', 'g9-302': '愉諭', 'g10-121': '爪鶴', 'g10-165': '弥喩' };
for (const [id, chars] of Object.entries(pairs)) {
  test(`E07: ${id} ambiguous records are preserved, never distributed`, () => {
    installStorage(); const old = getDefaultSave(); old.meta.version = 1; delete old.meta.catalogVersion;
    old.player.coreStats.totalCorrect = 70;
    old.player.study.answers[id] = { correct: 7, incorrect: 3 };
    old.player.study.kanjiReadProgress[id] = { onyomi: ['test'], kunyomi: [], mastered: true };
    old.player.study.reviewQueue = [id];
    old.player.study.reviewQueueDetail = [{ id, repetition: 2, interval: 6, eFactor: 2.5, nextReviewAt: 123 }];
    old.player.collection.kanjiIds = [id];
    const result = migrateSave(old);
    assert.equal(result.player.study.answers[id], undefined);
    assert.deepEqual(result.player.study.answers, {});
    assert.deepEqual(result.player.study.reviewQueueDetail, []);
    assert.deepEqual(result.player.collection.kanjiIds, []);
    assert.equal(result.player.coreStats.totalCorrect, 70);
    assert.ok(JSON.stringify(result.player.study.legacyAmbiguousKanji).includes('"correct":7'));
    assert.deepEqual(migrateSave(result), result);
    assert.equal(old.player.study.answers[id].correct, 7);
  });
  test(`E07: ${id} explicit character evidence maps only that record`, () => {
    installStorage(); const old = getDefaultSave();
    const char = chars[1], next = `${id}-${char.codePointAt(0).toString(16)}`;
    old.player.study.answers[id] = { correct: 4, incorrect: 1, kanji: char };
    old.player.study.reviewQueueDetail = [{ id, text: char, repetition: 2, interval: 6, eFactor: 2.5, nextReviewAt: 123 }];
    const result = migrateSave(old);
    assert.equal(result.player.study.answers[next]?.correct, 4);
    assert.equal(result.player.study.reviewQueueDetail[0]?.id, next);
    assert.equal(Object.keys(result.player.study.answers).length, 1);
    assert.equal(result.player.study.reviewQueueDetail[0].nextReviewAt, 123);
  });
}
test('migration refuses to replace the original if preserving it fails', () => {
  const old = getDefaultSave(); old.meta.version = 1; delete old.meta.catalogVersion;
  old.player.study.answers['g5-041'] = { correct: 7, incorrect: 2 };
  const raw = JSON.stringify(old); const storage = installStorage({ krb_save: raw });
  storage.fail = (op, key) => { if (op === 'set' && key.startsWith('yomitabi_preserved_')) throw quota(); };
  assert.equal(saveNow(migrateSave(old)).ok, false);
  assert.equal(storage.getItem('krb_save'), raw);
});
test('contradictory character evidence and an occupied destination are archived', () => {
  installStorage(); const old=getDefaultSave();
  old.player.study.answers['g5-041']={correct:3,incorrect:1,kanji:'許',text:'均'};
  const result=migrateSave(old);
  assert.deepEqual(result.player.study.answers,{});
  assert.ok(result.player.study.legacyAmbiguousKanji);
  old.player.study.answers['g5-041']={correct:3,incorrect:1,kanji:'許'};
  old.player.study.answers['g5-041-8a31']={correct:8,incorrect:2};
  const collision=migrateSave(old);
  assert.equal(collision.player.study.answers['g5-041-8a31'].correct,8);
  assert.ok(collision.player.study.legacyAmbiguousKanji);
});
