import test from 'node:test';
import assert from 'node:assert/strict';
import { createSentenceOrderGame } from '../../src/minigames/sentenceOrder/sentenceOrderGame.js';
import { SENTENCE_ORDER_FIXTURE, SENTENCE_CHALLENGE_FIXTURE } from '../../src/minigames/sentenceOrder/sentenceOrderQuestions.js';
import { createSentenceLearningService } from '../../src/minigames/sentenceOrder/sentenceLearningService.js';
import { hubRecommendations } from '../../src/minigames/hubRecommendations.js';
import { installStorage, quota } from '../phase-a/storage-helper.mjs';
import { getDefaultSave, loadSave } from '../../src/core/saveData.js';
import { loadGameData } from '../../src/core/gameState.js';
import { switchToSlot } from '../../src/core/saveSlots.js';
import { validateSave } from '../../src/core/saveValidation.js';
const ids = [SENTENCE_ORDER_FIXTURE[0].fixtureId, SENTENCE_CHALLENGE_FIXTURE[0].fixtureId];
const identity = s => ({ sessionId: s.sessionId, problemId: s.problem.problemId, attemptId: s.attemptId });
function solve(game) {
  const s=game.snapshot(), p=identity(s);
  s.problem.correctOrder.forEach((chunkId,to)=>game.place({...p,chunkId,to}));
  return game.submit(p);
}
test('mixed review uses only distinct requested sentences and ends at its actual length', () => {
  const events=[], game=createSentenceOrderGame({sessionId:'mixed',reviewContentIds:[...ids,ids[0],'unknown'],onEvent:e=>events.push(e)});
  game.enter(); assert.equal(game.snapshot().mode,'review'); assert.equal(game.snapshot().totalQuestions,2);
  for(const count of [3,4]) {
    const s=game.snapshot(); assert.equal(s.problem.chunks.length,count); assert.ok(s.problem.explanation);
    assert.notDeepEqual(s.currentOrder,s.problem.correctOrder);
    game.setPaused(true); assert.equal(game.submit(identity(s)),false); game.setPaused(false);
    assert.equal(solve(game),true); assert.equal(game.submit(identity(s)),false); game.next(identity(s));
  }
  assert.deepEqual(game.snapshot().result,{answered:2,correct:2,incorrect:0,accuracy:1});
  assert.deepEqual(events.filter(e=>e.type==='correct').map(e=>e.payload.contentId),ids);
  assert.equal(events.filter(e=>e.type==='sessionComplete').length,1);
});
test('invalid review IDs fall back to normal ten questions',()=>{
  const game=createSentenceOrderGame({sessionId:'fallback',reviewContentIds:['unknown']}); game.enter();
  assert.equal(game.snapshot().mode,'tenQuestions'); assert.equal(game.snapshot().totalQuestions,10);
});
test('sentence mistakes survive reload, retry once after quota and disappear after correction',async()=>{
  const storage=installStorage({krb_save:JSON.stringify(getDefaultSave())}); await loadGameData();
  const service=createSentenceLearningService({now:()=>1000}), run=service.beginRun('wrong');
  const game=createSentenceOrderGame({sessionId:'wrong',reviewContentIds:ids,onEvent:e=>{run.observe(e);run.observe(e);}});
  game.enter(); game.submit(identity(game.snapshot()));
  storage.fail=(op,key)=>{if(op==='set'&&key==='krb_save')throw quota();}; assert.equal(run.flush().ok,false);
  storage.fail=null; assert.equal(run.flush().ok,true); await loadGameData();
  assert.equal(service.getHistory()[ids[0]].incorrect,1); assert.deepEqual(service.getReviewIds(),[ids[0]]);
  const fix=service.beginRun('fix'), review=createSentenceOrderGame({sessionId:'fix',reviewContentIds:service.getReviewIds(),onEvent:fix.observe});
  review.enter(); solve(review); assert.equal(fix.flush().ok,true); assert.deepEqual(service.getReviewIds(),[]);
  assert.equal(service.getHistory()[ids[0]].correct,1);
  const old=service.beginRun('old'); switchToSlot(2); await loadGameData(); assert.equal(old.flush().ok,false);
  assert.deepEqual(service.getHistory(),{}); switchToSlot(1); await loadGameData();
  assert.equal(service.getHistory()[ids[0]].correct,1);
});
test('three review banks produce three distinct recommendations',()=>{
  const result=hubRecommendations({gameIds:['englishChoice','timedChoice','sentenceOrder'],reviewCount:1,timedReviewCount:2,sentenceReviewCount:3});
  assert.equal(result.length,3); assert.equal(result[2].gameId,'sentenceOrder'); assert.equal(result[2].review,true);
});
test('sentence save allows the full 130-item bank and rejects malformed observations',async()=>{
  installStorage({krb_save:JSON.stringify(getDefaultSave())}); await loadGameData(); const save=loadSave();
  const item={correct:0,incorrect:1,lastAnsweredAt:0,lastCorrect:false};
  save.player.miniGames={sentenceLearning:{version:1,recentAttempts:[],items:Object.fromEntries([...SENTENCE_ORDER_FIXTURE,...SENTENCE_CHALLENGE_FIXTURE].map(e=>[e.fixtureId,{...item}]))}};
  validateSave(save,2); save.player.miniGames.sentenceLearning.items.extra=item;
  assert.throws(()=>validateSave(save,2),/Sentence/); delete save.player.miniGames.sentenceLearning.items.extra;
  save.player.miniGames.sentenceLearning.items[ids[0]].correct=-1; assert.throws(()=>validateSave(save,2),/Sentence/);
});
