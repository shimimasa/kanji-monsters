import test from 'node:test';
import assert from 'node:assert/strict';
import { filterLearningEntries, learningBanks } from '../../src/minigames/learningNotebook.js';
const entries = [{ id:'apple',text:'apple',answer:'りんご' }, { id:'safe',text:'安全',answer:'あんぜん' }];
test('search accepts case, width and kana variations',()=>{
  for(const query of ['APPLE','ＡＰＰＬＥ','りんご','リンゴ','ﾘﾝｺﾞ']) assert.deepEqual(filterLearningEntries(entries,query).map(e=>e.id),['apple']);
  assert.deepEqual(filterLearningEntries(entries,'ｱﾝｾﾞﾝ').map(e=>e.id),['safe']);
});
test('space separated terms match both problem and answer without changing source order',()=>{
  const before=JSON.stringify(entries);
  assert.deepEqual(filterLearningEntries(entries,' apple　りんご ').map(e=>e.id),['apple']);
  assert.deepEqual(filterLearningEntries(entries,'apple 安全'),[]);
  assert.deepEqual(filterLearningEntries(entries,'　 '),entries); assert.equal(JSON.stringify(entries),before);
});
test('search is literal and can match sentence fragments and piece count',()=>{
  assert.deepEqual(filterLearningEntries(entries,'.*'),[]); assert.deepEqual(filterLearningEntries(entries,'<script>'),[]);
  const sentence=learningBanks.find(b=>b.gameId==='sentenceOrder').entries;
  const found=filterLearningEntries(sentence,'屋根 ４ピース');
  assert.ok(found.some(e=>e.id==='challenge-roof-snow')); assert.ok(found.every(e=>e.answer==='4ピース'));
});
