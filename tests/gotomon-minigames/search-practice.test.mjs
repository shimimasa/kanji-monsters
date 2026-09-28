import test from 'node:test';
import assert from 'node:assert/strict';
import { learningBanks, summarizeLearning, searchPracticeIds } from '../../src/minigames/learningNotebook.js';
const bank={entries:Array.from({length:15},(_,i)=>({id:`item-${i}`,text:`word ${i}`,answer:'ことば'}))};
test('batch uses only matches, prioritizes mistakes, caps at ten and keeps summary intact',()=>{
  const history=Object.fromEntries(bank.entries.map((e,i)=>[e.id,{lastCorrect:i!==12&&i!==13,lastAnsweredAt:i}]));
  const summary=summarizeLearning(bank,history), before=JSON.stringify(summary);
  const ids=searchPracticeIds(summary,'WORD');
  assert.deepEqual(ids,['item-13','item-12',...Array.from({length:8},(_,i)=>`item-${i}`)]);
  assert.equal(new Set(ids).size,10);assert.equal(JSON.stringify(summary),before);
  assert.deepEqual(searchPracticeIds(summary,'word 14'),['item-14']);
  assert.deepEqual(searchPracticeIds(summary,'absent'),[]);assert.deepEqual(searchPracticeIds(summary,'　'),[]);
});
test('after successful practice, older untouched correct answers reach the next batch',()=>{
  const history=Object.fromEntries(bank.entries.map((e,i)=>[e.id,{lastCorrect:true,lastAnsweredAt:i}]));
  const first=searchPracticeIds(summarizeLearning(bank,history),'word');
  first.forEach(id=>{history[id].lastAnsweredAt=100;});
  const next=searchPracticeIds(summarizeLearning(bank,history),'word');
  assert.deepEqual(next.slice(0,5),['item-10','item-11','item-12','item-13','item-14']);
});
test('recorded content only: matching unplayed sentences never enter a batch',()=>{
  const sentence=learningBanks.find(b=>b.gameId==='sentenceOrder');
  const history={'challenge-roof-snow':{lastCorrect:true,lastAnsweredAt:1},'library-book':{lastCorrect:false,lastAnsweredAt:2}};
  assert.deepEqual(searchPracticeIds(summarizeLearning(sentence,history),'４ピース'),['challenge-roof-snow']);
});
