import test from 'node:test';
import assert from 'node:assert/strict';
import { createWordLearningService } from '../../src/minigames/wordLearningService.js';
import { learningBanks } from '../../src/minigames/learningNotebook.js';

for (const bank of learningBanks) test(`${bank.gameId}: practice can select recorded correct and incorrect items, including older mistakes`, () => {
  const items=Object.fromEntries(bank.entries.slice(0,14).map((e,i)=>[e.id,{lastCorrect:i===0,lastAnsweredAt:i}]));
  let owner=1, ready=true;
  const service=createWordLearningService({storageKey:'learning',gameId:bank.gameId,contentIds:bank.entries.map(e=>e.id),ready:()=>ready,
    capture:()=>JSON.stringify([owner,1,JSON.stringify({player:{miniGames:{learning:{items:owner===1?items:{}}}}})])});
  const first=bank.entries[0].id, old=bank.entries[1].id;
  assert.ok(!service.getReviewIds().includes(first)); assert.ok(!service.getReviewIds().includes(old));
  assert.deepEqual(service.getPracticeIds([first,old,first,'unknown',bank.entries[14].id]),[first,old]);
  assert.equal(service.getPracticeIds(bank.entries.map(e=>e.id)).length,10);
  assert.deepEqual(service.getPracticeIds(null),[]); assert.deepEqual(service.getPracticeIds('all'),[]);
  owner=2; assert.deepEqual(service.getPracticeIds([first]),[]);
  owner=1; ready=false; assert.deepEqual(service.getPracticeIds([first]),[]);
});
