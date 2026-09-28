import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnglishChoiceGame } from '../../src/minigames/englishChoice/englishChoiceGame.js';
import { createTimedChoiceGame } from '../../src/minigames/timedChoice/timedChoiceGame.js';
const identity=s=>({sessionId:s.sessionId,problemId:s.problem.problemId,attemptId:s.attemptId});
for(const [name,create,ids] of [['english',createEnglishChoiceGame,['apple','book']],['timed',createTimedChoiceGame,['anzen','kibou']]]){
  test(`${name}: comparison captures exact chosen answer once and survives a correct final answer`,()=>{
    const game=create({sessionId:name,reviewContentIds:ids});game.enter();const first=game.snapshot();
    const wrong=first.problem.choices.find(c=>c.choiceId!==first.problem.correctChoiceId),payload={...identity(first),choiceId:wrong.choiceId};
    game.setPaused(true);assert.equal(game.answer(payload),false);game.setPaused(false);assert.equal(game.answer(payload),true);assert.equal(game.answer(payload),false);
    const missed=game.snapshot().missed;assert.equal(missed.length,1);assert.equal(missed[0].selectedAnswer,wrong.text);assert.equal(missed[0].questionNumber,1);
    assert.equal(missed[0].meaning??missed[0].reading,first.problem.choices.find(c=>c.choiceId===first.problem.correctChoiceId).text);
    game.next(identity(first));const next=game.snapshot();game.answer({...identity(next),choiceId:next.problem.correctChoiceId});
    assert.equal(game.snapshot().result.correct,1);assert.deepEqual(game.snapshot().missed,missed);
    assert.throws(()=>{missed[0].selectedAnswer='changed';},TypeError);assert.throws(()=>missed.push({}),TypeError);
    const fresh=create({sessionId:'fresh',reviewContentIds:[ids[0]]});fresh.enter();const s=fresh.snapshot();fresh.answer({...identity(s),choiceId:s.problem.correctChoiceId});assert.deepEqual(fresh.snapshot().missed,[]);
  });
}
test('timeout records no chosen answer and cannot be overwritten by a late click',()=>{
  const game=createTimedChoiceGame({sessionId:'timeout'});game.enter();const s=game.snapshot();game.update(5000);
  assert.equal(game.answer({...identity(s),choiceId:s.problem.correctChoiceId}),false);
  const item=game.snapshot().missed[0];assert.equal(item.reason,'timeout');assert.equal(item.selectedAnswer,null);assert.equal(item.contentId,s.problem.fixtureId);
  assert.equal(item.reading,s.problem.choices.find(c=>c.choiceId===s.problem.correctChoiceId).text);assert.equal(game.snapshot().timedOut,1);
});
