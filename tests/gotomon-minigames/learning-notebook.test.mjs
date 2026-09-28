import test from 'node:test';
import assert from 'node:assert/strict';
import { learningBanks, summarizeLearning } from '../../src/minigames/learningNotebook.js';
import { createWordLearningService } from '../../src/minigames/wordLearningService.js';

test('notebook has 120/120/130 unique canonical items with readable answers', () => {
  assert.deepEqual(learningBanks.map(b=>b.entries.length),[120,120,130]);
  for(const bank of learningBanks){
    assert.equal(new Set(bank.entries.map(e=>e.id)).size,bank.entries.length);
    assert.ok(bank.entries.every(e=>e.text && e.answer));
  }
});
test('empty history distinguishes unseen content from incorrect answers',()=>{
  const result=summarizeLearning(learningBanks[0]);
  assert.equal(result.unseen,120); assert.equal(result.attempted,0); assert.deepEqual(result.pending,[]);
});
test('counts unique problems and includes all mistakes beyond the ten-question batch',()=>{
  const bank=learningBanks[0], history=Object.fromEntries(bank.entries.slice(0,13).map((e,i)=>[e.id,{lastCorrect:false,lastAnsweredAt:i,incorrect:20}]));
  history[bank.entries[13].id]={lastCorrect:true,lastAnsweredAt:20,incorrect:7,correct:1};
  history.retired={lastCorrect:false,lastAnsweredAt:100};
  const before=JSON.stringify(history), result=summarizeLearning(bank,history);
  assert.equal(result.pending.length,13); assert.equal(result.correct.length,1); assert.equal(result.attempted,14); assert.equal(result.unseen,106);
  assert.equal(result.pending[0].id,bank.entries[12].id); assert.equal(JSON.stringify(history),before);
});
test('timeout status describes the last answer rather than historic timeouts',()=>{
  const bank=learningBanks[1], [a,b]=bank.entries;
  const result=summarizeLearning(bank,{[a.id]:{lastCorrect:false,lastReason:'timeout'},[b.id]:{lastCorrect:true,lastReason:'answer',timedOut:5}});
  assert.equal(result.pending[0].timedOut,true); assert.equal(result.correct[0].timedOut,false);
});
test('obsolete content cannot displace current content from the review batch',()=>{
  const bank=learningBanks[0], items=Object.fromEntries(Array.from({length:12},(_,i)=>['retired-'+i,{lastCorrect:false,lastAnsweredAt:100}]));
  items.apple={lastCorrect:false,lastAnsweredAt:1};
  const capture=()=>JSON.stringify([1,1,JSON.stringify({player:{miniGames:{testLearning:{items}}}})]);
  const service=createWordLearningService({storageKey:'testLearning',gameId:bank.gameId,contentIds:bank.entries.map(e=>e.id),ready:()=>true,capture});
  assert.deepEqual(service.getReviewIds(),['apple']);
});
