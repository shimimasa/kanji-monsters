import test from 'node:test';
import assert from 'node:assert/strict';
import { generateTimedChoiceQuestions, TIMED_CHOICE_FIXTURE } from '../../src/minigames/timedChoice/timedChoiceQuestions.js';
import { generateSentenceOrderQuestions, SENTENCE_ORDER_FIXTURE, SENTENCE_CHALLENGE_FIXTURE } from '../../src/minigames/sentenceOrder/sentenceOrderQuestions.js';
import { createTimedChoiceGame } from '../../src/minigames/timedChoice/timedChoiceGame.js';
import { createSentenceOrderGame } from '../../src/minigames/sentenceOrder/sentenceOrderGame.js';
const profile=bank=>Object.fromEntries(bank.slice(0,16).map((e,i)=>[e.fixtureId,{lastCorrect:i>=6,lastAnsweredAt:i<6?100+i:i}]));
for(const [name,generate,create,bank] of [['timed',generateTimedChoiceQuestions,createTimedChoiceGame,TIMED_CHOICE_FIXTURE],['sentence',generateSentenceOrderQuestions,createSentenceOrderGame,SENTENCE_ORDER_FIXTURE]]){
  test(`${name}: normal round balances three recent errors, five unseen and two oldest correct items`,()=>{
    const history=profile(bank),before=JSON.stringify(history),questions=generate({sessionId:'balanced',random:()=>.4,history});
    const ids=questions.map(q=>q.fixtureId);assert.equal(ids.length,10);assert.equal(new Set(ids).size,10);
    assert.equal(ids.filter(id=>history[id]?.lastCorrect===false).length,3);assert.equal(ids.filter(id=>!history[id]).length,5);
    assert.deepEqual(ids.filter(id=>history[id]?.lastCorrect===false).sort(),bank.slice(3,6).map(e=>e.fixtureId).sort());
    assert.deepEqual(ids.filter(id=>history[id]?.lastCorrect===true),bank.slice(6,8).map(e=>e.fixtureId));
    assert.equal(JSON.stringify(history),before);
  });
  test(`${name}: no history preserves seeded output and edge histories still give ten unique questions`,()=>{
    const args={sessionId:'default',random:()=>.3};assert.deepEqual(generate(args),generate({...args,history:{}}));
    for(const correct of [true,false]){
      const history=Object.fromEntries(bank.map((e,i)=>[e.fixtureId,{lastCorrect:correct,lastAnsweredAt:i}]));
      const ids=generate({...args,history}).map(q=>q.fixtureId);assert.equal(ids.length,10);assert.equal(new Set(ids).size,10);
      if(correct)assert.deepEqual(ids,bank.slice(0,10).map(e=>e.fixtureId));
    }
  });
  test(`${name}: explicit practice stays exact and history reaches the game core`,()=>{
    const history=profile(bank),requested=[bank[110].fixtureId,bank[0].fixtureId];
    const selected=generate({sessionId:'explicit',history,reviewContentIds:requested});assert.deepEqual(selected.map(q=>q.fixtureId).sort(),requested.sort());
    const game=create({sessionId:'core',history});game.enter();assert.ok(bank.slice(3,6).some(e=>e.fixtureId===game.snapshot().problem.fixtureId));assert.equal(game.snapshot().totalQuestions,10);
    if(name==='timed')assert.equal(game.snapshot().deadlineMs,5000);
  });
}
test('other sentence course and obsolete IDs cannot consume review slots; challenge stays ten four-piece sentences',()=>{
  const history=profile(SENTENCE_ORDER_FIXTURE);
  for(const e of SENTENCE_CHALLENGE_FIXTURE)history[e.fixtureId]={lastCorrect:false,lastAnsweredAt:1000};
  history.retired={lastCorrect:false,lastAnsweredAt:2000};
  const standard=generateSentenceOrderQuestions({sessionId:'standard',history});
  assert.equal(standard.filter(q=>history[q.fixtureId]?.lastCorrect===false).length,3);assert.ok(standard.every(q=>q.chunks.length===3));
  const challenge=generateSentenceOrderQuestions({sessionId:'challenge',history,sentenceLevel:'challenge'});
  assert.deepEqual(challenge.map(q=>q.fixtureId).sort(),SENTENCE_CHALLENGE_FIXTURE.map(e=>e.fixtureId).sort());assert.ok(challenge.every(q=>q.chunks.length===4&&q.explanation));
});
