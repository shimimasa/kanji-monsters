import test from 'node:test';
import assert from 'node:assert/strict';
import { choiceHintIds } from '../../src/minigames/choiceHint.js';
test('two-choice hint retains exactly the correct answer and one actual distractor for every answer position',()=>{
  const choices=Array.from({length:4},(_,i)=>({choiceId:`choice-${i}`,text:`word ${i}`}));
  for(let correct=0;correct<4;correct++)for(let run=0;run<30;run++){
    const problem={problemId:`run-${run}`,choices,correctChoiceId:choices[correct].choiceId},before=JSON.stringify(problem);
    const ids=choiceHintIds(problem);assert.equal(new Set(ids).size,2);assert.ok(ids.includes(problem.correctChoiceId));
    assert.ok(ids.every(id=>choices.some(c=>c.choiceId===id)));assert.deepEqual(choiceHintIds(problem),ids);assert.equal(JSON.stringify(problem),before);
  }
});
test('malformed hint input never invents an answer or a distractor',()=>{
  assert.deepEqual(choiceHintIds(null),[]);assert.deepEqual(choiceHintIds({choices:[],correctChoiceId:'none'}),[]);
  assert.deepEqual(choiceHintIds({choices:[{choiceId:'one'}],correctChoiceId:'one'}),[]);
});
