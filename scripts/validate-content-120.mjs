import assert from 'node:assert/strict';
import { mkdir, appendFile,readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { MATH_CONTENT } from '../src/minigames/mathSprint/mathContent.js';
import { generateSessionProblems } from '../src/minigames/mathSprint/mathSprintGenerator.js';
import { ENGLISH_CHOICE_FIXTURE, generateEnglishChoiceQuestions } from '../src/minigames/englishChoice/englishChoiceQuestions.js';
import { englishCategory } from '../src/minigames/englishChoice/englishContent.js';
import { SENTENCE_ORDER_FIXTURE,generateSentenceOrderQuestions } from '../src/minigames/sentenceOrder/sentenceOrderQuestions.js';
import { TIMED_CHOICE_FIXTURE,generateTimedChoiceQuestions } from '../src/minigames/timedChoice/timedChoiceQuestions.js';
import { MULTI_SELECT_FIXTURE,generateMultiSelectQuestions } from '../src/minigames/multiSelect/multiSelectQuestions.js';
import { scoreMultiSelect } from '../src/minigames/multiSelect/multiSelectGame.js';
import { ASYNC_CHOICE_FIXTURE,prepareAsyncChoiceQuestions,loadAsyncChoiceFixture } from '../src/minigames/asyncChoice/asyncChoiceQuestions.js';
import { KANJI_DEFENSE_LIMITED_UX_CONTENT as defense,validateKanjiDefenseContent,normalizeKanjiDefenseReading,buildKanjiDefenseSession } from '../src/minigames/kanjiDefense/kanjiDefenseContent.js';

export const seeded = (seed=1) => () => ((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
export const normalize = text => text.normalize('NFKC').replace(/[\s。、？！?！!「」『』]/gu,'').toLowerCase();
// Symbols can themselves be the learning target (句点/読点). Do not erase them
// when comparing answer options; erase only spacing and width differences.
export const normalizeOption = text => text.normalize('NFKC').replace(/\s/gu,'').toLowerCase();
export function unique(values,label) { assert.equal(new Set(values).size,values.length,label); }
export function present(value,path='item') {
  assert.notEqual(value,undefined,path); assert.notEqual(value,null,path);
  if(typeof value==='string') assert.ok(value.trim(),path);
  if(Array.isArray(value)) value.forEach((entry,index)=>present(entry,`${path}[${index}]`));
  else if(typeof value==='object') Object.entries(value).forEach(([key,entry])=>present(entry,`${path}.${key}`));
}
export function validateMath(expected=MATH_CONTENT.length) {
  assert.equal(MATH_CONTENT.length,expected); unique(MATH_CONTENT.map(q=>q.fixtureId),'math IDs');
  unique(MATH_CONTENT.map(q=>q.operation==='addition'?`+${Math.min(q.a,q.b)},${Math.max(q.a,q.b)}`:`-${q.a},${q.b}`),'math canonical');
  const variants=new Set();
  for(const q of MATH_CONTENT) {
    present(q); assert.ok(['addition','subtraction'].includes(q.operation));
    assert.ok(Number.isInteger(q.a)&&Number.isInteger(q.b)&&q.a>=1&&q.b>=1&&q.a<=20&&q.b<=20);
    assert.equal(q.answer,q.operation==='addition'?q.a+q.b:q.a-q.b);
    assert.ok(q.answer>=0&&q.answer<=20);
    for(const v of q.variants) {
      assert.equal(q.answer,q.operation==='addition'?v.a+v.b:v.a-v.b);
      variants.add(`${q.operation}:${v.a}:${v.b}`);
    }
  }
  for(let a=1;a<=8;a++)for(let b=1;b<=9-a;b++)assert.ok(variants.has(`addition:${a}:${b}`));
  for(let a=1;a<=9;a++)for(let b=1;b<=a;b++)assert.ok(variants.has(`subtraction:${a}:${b}`));
  const encountered=new Set(), seenVariants=new Set(), random=seeded(901);
  for(let i=0;i<1200;i++) {
    const run=generateSessionProblems({sessionId:`gate-${i}`,random}); assert.equal(run.length,10);
    assert.equal(run.filter(q=>q.operation==='addition').length,5);
    unique(run.map(q=>q.fixtureId),'within-session canonical');
    for(const q of run){encountered.add(q.fixtureId);seenVariants.add(`${q.operation}:${q.a}:${q.b}`);}
  }
  assert.equal(encountered.size,expected); assert.equal(seenVariants.size,variants.size);
  return {bank:'math',count:expected,playableExpressions:variants.size,oldExpressionsRetained:81,sampling:'all items and variants reachable'};
}
export function assertCandidate() {
  for(const ref of ['child-playtest-candidate-1^{commit}','release/child-playtest-candidate-1'])
    assert.equal(execFileSync('git',['rev-parse',ref]).toString().trim(),'a9cb2b294e68229b31805a46666d2249ff273ac3');
  assert.equal(execFileSync('git',['branch','--show-current']).toString().trim(),'feature/content-bank-120');
}
export function validateEnglish(expected=ENGLISH_CHOICE_FIXTURE.length) {
  const bank=ENGLISH_CHOICE_FIXTURE;
  assert.equal(bank.length,expected);bank.forEach(q=>present(q));
  unique(bank.map(q=>q.id),'english IDs');unique(bank.map(q=>normalize(q.prompt)),'english words');
  unique(bank.map(q=>normalize(q.meaning)),'english meanings');
  for(const q of bank){assert.match(q.prompt,/^[a-z]+$/);assert.ok(q.prompt.length<=12);assert.ok(q.meaning.length<=8);}
  const seen=new Set(),random=seeded(771);
  for(let i=0;i<600;i++) {
    const run=generateEnglishChoiceQuestions({sessionId:'english-gate',random});assert.equal(run.length,10);
    unique(run.map(q=>q.prompt),'english session');
    for(const q of run) {
      seen.add(q.prompt);assert.equal(q.choices.length,4);unique(q.choices.map(c=>normalize(c.text)),'distractor duplicate');
      assert.equal(q.choices.find(c=>c.choiceId===q.correctChoiceId).text,bank.find(e=>e.prompt===q.prompt).meaning);
      assert.equal(q.choices.filter(c=>englishCategory(c.choiceId.slice('meaning:'.length))===englishCategory(q.prompt)).length,3,'correct + two same-topic distractors');
    }
  }
  assert.equal(seen.size,expected);
  return {bank:'english',count:expected,sampling:'all words reachable',answer:'unique selected meanings'};
}
export function validateSentence(expected=SENTENCE_ORDER_FIXTURE.length) {
  const bank=SENTENCE_ORDER_FIXTURE;assert.equal(bank.length,expected);
  unique(bank.map(q=>q.fixtureId),'sentence IDs');
  unique(bank.map(q=>normalize(q.chunks.map(c=>c.text).join(''))),'sentence normalized text');
  for(const q of bank) {
    present(q);assert.ok(q.chunks.length>=3&&q.chunks.length<=6);
    unique(q.chunks.map(c=>c.chunkId),'chunk IDs'); unique(q.chunks.map(c=>normalize(c.text)),'chunks');
    assert.deepEqual(q.correctOrder,q.chunks.map(c=>c.chunkId));
    assert.ok(q.chunks.map(c=>c.text).join('').length<=34);
  }
  const seen=new Set(),random=seeded(111);
  for(let i=0;i<600;i++) {
    const run=generateSentenceOrderQuestions({sessionId:'sentence-gate',random});assert.equal(run.length,10);
    unique(run.map(q=>q.fixtureId),'sentence session');
    for(const q of run){seen.add(q.fixtureId);assert.notDeepEqual(q.initialOrder,q.correctOrder);assert.deepEqual([...q.initialOrder].sort(),[...q.correctOrder].sort());}
  }
  assert.equal(seen.size,expected);
  return {bank:'sentence',count:expected,sampling:'all items reachable',semantic:'separate editorial dependency review required; not inferred from permutation equality'};
}
export function validateTimed(expected=TIMED_CHOICE_FIXTURE.length) {
  const bank=TIMED_CHOICE_FIXTURE; assert.equal(bank.length,expected);
  unique(bank.map(q=>q.fixtureId),'timed IDs');unique(bank.map(q=>normalize(q.word)),'timed words');
  unique(bank.map(q=>normalize(q.reading)),'timed readings');
  for(const q of bank) {present(q);assert.equal(q.word.length,2);assert.match(q.reading,/^[ぁ-ゖ]{3,5}$/);}
  const seen=new Set(),random=seeded(451);
  for(let i=0;i<600;i++) {
    const run=generateTimedChoiceQuestions({sessionId:'timed-gate',random});assert.equal(run.length,10);
    unique(run.map(q=>q.fixtureId),'timed session');
    for(const q of run){seen.add(q.fixtureId);unique(q.choices.map(c=>normalize(c.text)),'timed distractors');assert.equal(q.choices.find(c=>c.choiceId===q.correctChoiceId).text,bank.find(e=>e.fixtureId===q.fixtureId).reading);}
  }
  assert.equal(seen.size,expected);return {bank:'timed',count:expected,sampling:'all words reachable',length:'two kanji / 3–5 kana'};
}
export function validateMulti(expected=MULTI_SELECT_FIXTURE.length) {
  const bank=MULTI_SELECT_FIXTURE;assert.equal(bank.length,expected);
  unique(bank.map(q=>q.fixtureId),'multi IDs');unique(bank.map(q=>normalize(q.prompt)),'multi prompts');
  for(const q of bank) {
    present(q);assert.equal(q.choices.length,5);assert.equal(q.correctChoiceIds.length,3);
    const choiceIds=q.choices.map(c=>c.choiceId);unique(choiceIds,'material IDs');unique(q.choices.map(c=>normalize(c.text)),'multi options');
    assert.ok(q.correctChoiceIds.every(id=>choiceIds.includes(id)));unique(q.correctChoiceIds,'correct set');
    assert.ok(q.prompt.length<=32);assert.ok(q.choices.every(c=>c.text.length<=12));
    for(let mask=0;mask<32;mask++) {
      const selectedChoiceIds=choiceIds.filter((_,i)=>mask&(1<<i));
      const score=scoreMultiSelect({selectedChoiceIds,correctChoiceIds:q.correctChoiceIds,choiceIds}).score;
      const tp=selectedChoiceIds.filter(id=>q.correctChoiceIds.includes(id)).length,fp=selectedChoiceIds.length-tp;
      assert.equal(score,Math.max(0,tp*2-fp*3)/6);
    }
  }
  const seen=new Set(),random=seeded(681);
  for(let i=0;i<600;i++)for(const q of generateMultiSelectQuestions({sessionId:'multi-gate',random}))seen.add(q.fixtureId);
  assert.equal(seen.size,expected);return {bank:'multi',count:expected,partialScore:'all 32 subsets checked per item',sampling:'all items reachable'};
}
export async function validateAsync(expected=ASYNC_CHOICE_FIXTURE.length) {
  const bank=await loadAsyncChoiceFixture();assert.equal(bank.length,expected);
  unique(bank.map(q=>q.fixtureId),'async IDs');unique(bank.map(q=>normalize(q.prompt)),'async prompts');
  for(const q of bank) {
    present(q);assert.equal(q.choices.length,4);unique(q.choices.map(c=>c.choiceId),'async option IDs');unique(q.choices.map(c=>normalizeOption(c.text)),'async options');
    assert.equal(q.choices.filter(c=>c.choiceId===q.correctChoiceId).length,1);
    assert.ok(q.prompt.length<=32);assert.ok(q.choices.every(c=>c.text.length<=14));
  }
  const seen=new Set(),random=seeded(751);
  for(let i=0;i<600;i++) {
    const run=prepareAsyncChoiceQuestions({fixture:bank,sessionId:'async-gate',random});assert.equal(run.length,10);
    unique(run.map(q=>q.fixtureId),'async session');run.forEach(q=>seen.add(q.fixtureId));
  }
  assert.equal(seen.size,expected);return {bank:'async',count:expected,loader:'PASS',sampling:'all items reachable'};
}
export async function validateDefense(expected=defense.length) {
  assert.equal(defense.length,expected);assert.equal(validateKanjiDefenseContent(defense),true);
  unique(defense.map(q=>normalize(q.prompt)),'defense words');
  const source=JSON.parse(await readFile('public/data/kanji_g4_proto.json','utf8'));
  const chars=new Map(source.map(q=>[q.id,q.kanji]));
  for(const q of defense) {
    present(q);unique(q.focusKanjiIds,'focus IDs');
    for(const id of q.focusKanjiIds){assert.ok(chars.has(id),id);assert.ok(q.prompt.includes(chars.get(id)),`${q.prompt}: ${id}`);}
    assert.ok(!['kd-g4-003','kd-g4-004','kd-g4-011'].includes(q.fixtureId));
    for(const reading of q.acceptedReadings) {
      const katakana=[...reading].map(c=>String.fromCodePoint(c.codePointAt(0)+0x60)).join('');
      assert.equal(normalizeKanjiDefenseReading(katakana),reading);
      assert.equal(normalizeKanjiDefenseReading(`　${[...katakana].join(' ')}　`),reading);
    }
  }
  const seen=new Set(),random=seeded(951);
  for(let i=0;i<600;i++) {
    const run=buildKanjiDefenseSession({random});assert.equal(run.length,12);
    unique(run.map(q=>q.content.fixtureId),'defense session');run.forEach(q=>seen.add(q.content.fixtureId));
  }
  assert.equal(seen.size,expected);return {bank:'defense',count:expected,focusReferences:'all exist and occur in word',normalization:'kana and whitespace PASS',sampling:'all items reachable'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  assertCandidate();
  const validators={english:validateEnglish,sentence:validateSentence,timed:validateTimed,multi:validateMulti,async:validateAsync,defense:validateDefense};
  const result=process.argv[2]==='all'?await Promise.all([validateMath(120),...Object.values(validators).map(validate=>validate(120))]):
    validators[process.argv[2]]?await validators[process.argv[2]](Number(process.argv[3])):validateMath(Number(process.argv[2]||MATH_CONTENT.length));
  await mkdir('artifacts/content-120',{recursive:true});
  await appendFile('artifacts/content-120/gates.jsonl',JSON.stringify({result,static:'PASS',review:'semantic judgments recorded separately in review packets'})+'\n');
  console.log(result);
}
