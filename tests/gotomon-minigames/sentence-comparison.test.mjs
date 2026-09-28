import test from 'node:test';
import assert from 'node:assert/strict';
import { createSentenceOrderGame } from '../../src/minigames/sentenceOrder/sentenceOrderGame.js';
const identity=s=>({sessionId:s.sessionId,problemId:s.problem.problemId,attemptId:s.attemptId});
function solve(game){const s=game.snapshot();s.problem.correctOrder.forEach((chunkId,to)=>game.place({...identity(s),chunkId,to}));game.submit(identity(s));}
test('comparison retains exact submitted and correct words for every mistake across three/four-piece questions',()=>{
  const game=createSentenceOrderGame({sessionId:'compare',reviewContentIds:['library-book','challenge-roof-snow']});game.enter();
  const first=game.snapshot(),words=ids=>ids.map(id=>first.problem.chunks.find(c=>c.chunkId===id).text);
  game.submit(identity(first));assert.equal(game.submit(identity(first)),false);
  const previous=game.snapshot().missed;assert.equal(previous.length,1);
  assert.deepEqual(previous[0].submittedParts,words(first.currentOrder));assert.deepEqual(previous[0].correctParts,words(first.problem.correctOrder));
  assert.equal(previous[0].questionNumber,1);assert.ok(previous[0].explanation);
  game.next(identity(first));const second=game.snapshot();game.submit(identity(second));
  assert.equal(previous.length,1);assert.equal(game.snapshot().missed.length,2);assert.equal(game.snapshot().missed[1].correctParts.length,4);
  assert.equal(game.snapshot().missed[1].explanation,second.problem.explanation);
  assert.throws(()=>previous[0].submittedParts.push('changed'),TypeError);assert.throws(()=>previous.push({}),TypeError);
});
test('correct final answer does not erase previous mistakes; a new run starts empty',()=>{
  const game=createSentenceOrderGame({sessionId:'last-correct',reviewContentIds:['library-book','challenge-roof-snow']});game.enter();
  const first=game.snapshot();game.submit(identity(first));game.next(identity(first));solve(game);
  assert.equal(game.snapshot().result.correct,1);assert.equal(game.snapshot().lastAnswer.correct,true);assert.equal(game.snapshot().missed.length,1);
  const next=createSentenceOrderGame({sessionId:'fresh',reviewContentIds:['library-book']});next.enter();solve(next);assert.deepEqual(next.snapshot().missed,[]);
});
test('normal ten-question results preserve scoring and collect only wrong question numbers',()=>{
  const game=createSentenceOrderGame({sessionId:'normal'});game.enter();
  for(let i=0;i<10;i++){const s=game.snapshot();if(i%2)solve(game);else game.submit(identity(s));game.next(identity(s));}
  assert.deepEqual(game.snapshot().result,{answered:10,correct:5,incorrect:5,accuracy:.5});
  assert.deepEqual(game.snapshot().missed.map(item=>item.questionNumber),[1,3,5,7,9]);
});
