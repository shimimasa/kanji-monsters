import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { validateMath,validateEnglish,assertCandidate } from '../../scripts/validate-content-120.mjs';
import { ENGLISH_CHOICE_FIXTURE } from '../../src/minigames/englishChoice/englishChoiceQuestions.js';
import { MATH_CONTENT } from '../../src/minigames/mathSprint/mathContent.js';

test('content development leaves Candidate tag and release branch frozen',()=>assertCandidate());
test('math has 120 canonical items and all 81 original expressions',()=>validateMath(120));
test('new math pairs are not reverse-operand padding',()=> {
  const added=MATH_CONTENT.filter(q=>(q.operation==='addition'?q.answer:q.a)>9);
  assert.equal(added.length,55);assert.ok(added.every(q=>q.variants.length===1));
});
test('English has 120 unique meanings, valid answers and reachable new words',()=>validateEnglish(120));
test('English original twenty records are unchanged',async()=> {
  const source=execFileSync('git',['show','child-playtest-candidate-1:src/minigames/englishChoice/englishChoiceQuestions.js']).toString();
  const old=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  assert.deepEqual(ENGLISH_CHOICE_FIXTURE.slice(0,20),old.ENGLISH_CHOICE_FIXTURE);
});
