import test from 'node:test';
import assert from 'node:assert/strict';
import { installStorage } from '../phase-a/storage-helper.mjs';
installStorage();
const { gameState } = await import('../../src/core/gameState.js');
const { default: practice } = await import('../../src/screens/practiceBattleScreen.js');

// マスター画面の ヒントは 押すたびに 帯に出る（以前は 回数を 数えるだけで 何も 出なかった）。2026-10-04
test('the master-mode hint shows four steps on the notice band, aiming at a reading not yet learned', t => {
  for (const key of ['log', 'warn', 'error']) t.mock.method(console, key, () => {});
  gameState.currentKanji = { id: 'g1-007', kanji: '七', strokes: 2, meaning: 'ななつ', onyomi: ['しち'], kunyomi: ['なな', 'なの'] };
  gameState.kanjiReadProgress = { 'g1-007': { onyomi: ['しち'], kunyomi: [] } };
  gameState.hintLevel = 0;
  practice.reviewMode = false;
  const seen = [];
  for (let i = 0; i < 5; i++) { practice.handlePracticeHint(); seen.push(practice.nearMissNotice?.lines?.[0]); }
  assert.deepEqual(seen, [
    'ヒント: 画数は 2画',
    'ヒント: 訓読みは「な○○」から はじまる',
    'ヒント: いみは「ななつ」',
    'ヒント: 訓読みは「なな」',
    'ヒントは ここまで！ まちがえても だいじょうぶ',
  ]);
  assert.equal(gameState.hintLevel, 4, 'the learning record still gets the hint level');
});
