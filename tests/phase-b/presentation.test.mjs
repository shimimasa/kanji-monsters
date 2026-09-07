import test from 'node:test';
import assert from 'node:assert/strict';
import { installStorage } from '../phase-a/storage-helper.mjs';
import { getDefaultSave } from '../../src/core/saveData.js';
import { loadGameData, gameState } from '../../src/core/gameState.js';
import { getQuizResultSummary } from '../../src/core/learningPresentation.js';
import { buildKanjiCsv } from '../../src/core/reviewExport.js';

test('10問中8問でも学年全体ではなく今回確認した自力正解だけを返す', () => {
  const answers = [
    ...Array.from({length:5}, (_,i) => ({id:`k${i}`, ok:true, support:'independent'})),
    ...Array.from({length:2}, (_,i) => ({id:`h${i}`, ok:true, support:'hint2'})),
    {id:'r1', ok:true, support:'revealed'},
    {id:'w1', ok:false}, {id:'w2', ok:false},
  ];
  assert.deepEqual(getQuizResultSummary(answers, 10), {
    total:10, correctInputs:8, independentCorrect:5, independentKanjiIds:['k0','k1','k2']
  });
});

test('CSVは旧正解を自力へ付け替えず、ヒントと答え表示を分ける', async () => {
  const save = getDefaultSave();
  save.player.study.answers = {
    'g1-001': { correct:10, incorrect:2, observed:{version:1, correct:{independent:1,hint2:2,revealed:1}, incorrect:2} }
  };
  installStorage({krb_save:JSON.stringify(save)});
  await loadGameData();
  const csv = buildKanjiCsv();
  assert.match(csv, /ヒントなし正解入力回数/);
  assert.match(csv, /答え表示後正解入力回数/);
  const row = csv.trim().split(/\r?\n/)[1].split(',');
  assert.deepEqual(row.slice(5, 12).map(Number), [10,1,2,1,6,2,12]);
  assert.equal(gameState.kanjiAnswerStats['g1-001'].correct, 10);
});
