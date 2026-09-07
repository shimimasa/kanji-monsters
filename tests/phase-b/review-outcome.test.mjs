import test from 'node:test';
import assert from 'node:assert/strict';
import { installStorage } from '../phase-a/storage-helper.mjs';
import { getDefaultSave, loadSave } from '../../src/core/saveData.js';
import { loadGameData, gameState, beginQuestion } from '../../src/core/gameState.js';
import ReviewQueue from '../../src/models/reviewQueue.js';
import { commitLearningOutcome, getReviewQuality, isIndependentOutcome } from '../../src/core/learningOutcome.js';

const DAY = 24 * 60 * 60 * 1000;

async function setup(entries = []) {
  const save = getDefaultSave();
  save.player.study.reviewQueueDetail = entries;
  save.player.study.reviewQueue = entries.map(e => e.id);
  installStorage({ krb_save: JSON.stringify(save) });
  await loadGameData();
}

test('既存復習項目を再誤答すると6日先から翌日へ戻り、記録も同じ保存に入る', async () => {
  const future = Date.now() + 6 * DAY;
  await setup([{ id:'g1-001', repetition:2, interval:6, eFactor:2.5, nextReviewAt:future }]);
  const result = commitLearningOutcome('g1-001', false, { question:beginQuestion('review'), reading:'に', hintLevel:0 });
  assert.equal(result.ok, true);
  const item = ReviewQueue.getAll()[0];
  assert.equal(item.repetition, 0);
  assert.equal(item.interval, 1);
  assert.ok(item.nextReviewAt < future);
  const saved = loadSave();
  assert.equal(saved.player.study.answers['g1-001'].incorrect, 1);
  assert.equal(saved.player.study.reviewQueueDetail[0].interval, 1);
});

test('期限到来した初期間隔の既存項目も、再誤答で翌日へ送る', async () => {
  const now = Date.now();
  await setup([{ id:'g1-001', repetition:0, interval:0, eFactor:2.5, nextReviewAt:now - 1000 }]);
  assert.equal(commitLearningOutcome('g1-001', false, { question:beginQuestion('review'), reading:'に' }).ok, true);
  const item = ReviewQueue.getAll()[0];
  assert.equal(item.interval, 1);
  assert.ok(item.nextReviewAt >= now + DAY - 1000);
});

test('ヒントなし・一部ヒント・答え表示を別の品質として扱う', () => {
  assert.equal(getReviewQuality({ isCorrect:true, hintLevel:0 }), 5);
  assert.equal(getReviewQuality({ isCorrect:true, hintLevel:1 }), 4);
  assert.equal(getReviewQuality({ isCorrect:true, hintLevel:2 }), 3);
  assert.equal(getReviewQuality({ isCorrect:true, hintLevel:3 }), 3);
  assert.equal(getReviewQuality({ isCorrect:true, hintLevel:4, answerRevealed:true }), 1);
  assert.equal(isIndependentOutcome({ isCorrect:true, hintLevel:0 }), true);
  assert.equal(isIndependentOutcome({ isCorrect:true, hintLevel:1 }), false);
  assert.equal(isIndependentOutcome({ isCorrect:true, hintLevel:0, answerRevealed:true }), false);
});

test('答え表示後の正解はゲーム上は正解のまま、復習間隔と自力読みを進めない', async () => {
  await setup([]);
  const result = commitLearningOutcome('g1-001', true, { question:beginQuestion('practice'), reading:'いち', hintLevel:4, answerRevealed:true });
  assert.equal(result.ok, true);
  assert.equal(gameState.kanjiAnswerStats['g1-001'].correct, 1);
  assert.equal(gameState.kanjiAnswerStats['g1-001'].observed.correct.revealed, 1);
  assert.deepEqual(gameState.kanjiReadProgress['g1-001'].observedReadings.revealed, ['いち']);
  assert.deepEqual(gameState.kanjiReadProgress['g1-001'].onyomi, new Set());
  assert.equal(ReviewQueue.getAll()[0].repetition, 0);
});

test('同じ問題の連続確定は一件、正式な再出題は別の一件', async () => {
  await setup([]);
  const q = beginQuestion('battle');
  assert.equal(commitLearningOutcome('g1-001', false, { question:q, reading:'に' }).ok, true);
  assert.equal(commitLearningOutcome('g1-001', false, { question:q, reading:'に' }).ok, false);
  assert.equal(commitLearningOutcome('g1-001', false, { question:beginQuestion('battle'), reading:'に' }).ok, true);
  assert.equal(gameState.kanjiAnswerStats['g1-001'].incorrect, 2);
});

test('保存失敗は記録とキューを片側だけ進めず、同じ問題で再試行できる', async () => {
  const storage = installStorage({ krb_save: JSON.stringify(getDefaultSave()) });
  await loadGameData();
  const q = beginQuestion('review');
  storage.fail = (op,key) => { if (op === 'set' && key === 'krb_save') throw new Error('quota'); };
  assert.equal(commitLearningOutcome('g1-001', false, { question:q, reading:'に' }).ok, false);
  assert.equal(gameState.kanjiAnswerStats['g1-001'], undefined);
  assert.deepEqual(ReviewQueue.getAll(), []);
  storage.fail = null;
  assert.equal(commitLearningOutcome('g1-001', false, { question:q, reading:'に' }).ok, true);
  assert.equal(gameState.kanjiAnswerStats['g1-001'].incorrect, 1);
});
