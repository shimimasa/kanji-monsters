// Read-only curriculum baseline audit. Never modifies banks, saves or release refs.
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { loadBaseline } from './content-120-baseline.mjs';
// This command continues to audit the OLD inventory after the development bank grows.
const {generateSessionProblems}=await loadBaseline('src/minigames/mathSprint/mathSprintGenerator.js');
const {ENGLISH_CHOICE_FIXTURE:english,generateEnglishChoiceQuestions}=await loadBaseline('src/minigames/englishChoice/englishChoiceQuestions.js');
const {SENTENCE_ORDER_FIXTURE:sentence}=await loadBaseline('src/minigames/sentenceOrder/sentenceOrderQuestions.js');
const {createSentenceOrderGame}=await loadBaseline('src/minigames/sentenceOrder/sentenceOrderGame.js');
const {TIMED_CHOICE_FIXTURE:timed,generateTimedChoiceQuestions}=await loadBaseline('src/minigames/timedChoice/timedChoiceQuestions.js');
const {MULTI_SELECT_FIXTURE:multi,generateMultiSelectQuestions}=await loadBaseline('src/minigames/multiSelect/multiSelectQuestions.js');
const {scoreMultiSelect}=await loadBaseline('src/minigames/multiSelect/multiSelectGame.js');
const {ASYNC_CHOICE_FIXTURE:asyncBank,loadAsyncChoiceFixture,prepareAsyncChoiceQuestions}=await loadBaseline('src/minigames/asyncChoice/asyncChoiceQuestions.js');
const {KANJI_DEFENSE_GOLDEN_CONTENT:golden,KANJI_DEFENSE_LIMITED_UX_CONTENT:defense,validateKanjiDefenseContent,buildKanjiDefenseSession}=await loadBaseline('src/minigames/kanjiDefense/kanjiDefenseContent.js');

const baseline='a9cb2b294e68229b31805a46666d2249ff273ac3';
const git=(...args)=>execFileSync('git',args).toString().trim();
assert.equal(git('rev-parse','child-playtest-candidate-1^{commit}'),baseline);
assert.equal(git('rev-parse','release/child-playtest-candidate-1'),baseline);
const rng=(seed=1)=>()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const count=items=>Object.fromEntries([...new Set(items)].map(value=>[value,items.filter(item=>item===value).length]));
const lengths=items=>{const sorted=items.map(item=>[...item].length).sort((a,b)=>a-b);return {min:sorted[0],median:(sorted[Math.floor((sorted.length-1)/2)]+sorted[Math.floor(sorted.length/2)])/2,max:sorted.at(-1),distribution:count(sorted)};};
const ordered=new Set(),commutative=new Set();
const random=rng(20260913);
for(let run=0;run<600;run++)for(const item of generateSessionProblems({sessionId:`inventory-${run}`,random})) {
  assert.equal(item.answer,item.operation==='addition'?item.a+item.b:item.a-item.b);
  assert.ok(item.answer>=0&&item.answer<=9);
  ordered.add(`${item.a}:${item.operation}:${item.b}`);
  commutative.add(item.operation==='addition'?`${Math.min(item.a,item.b)}:+:${Math.max(item.a,item.b)}`:`${item.a}:-:${item.b}`);
}
assert.equal(ordered.size,81);assert.equal(commutative.size,65);
function alternateRejected(fixtureId,indices) {
  for(let seed=1;seed<=1000;seed++) {
    const game=createSentenceOrderGame({sessionId:'ambiguity',random:rng(seed)});game.enter();
    const state=game.snapshot();
    if(state.problem.fixtureId!==fixtureId){game.exit();continue;}
    const identity={sessionId:state.sessionId,problemId:state.problem.problemId,attemptId:state.attemptId};
    const order=indices.map(index=>state.problem.correctOrder[index]);
    for(let to=0;to<order.length;to++)if(game.snapshot().currentOrder[to]!==order[to])assert.equal(game.place({...identity,chunkId:order[to],to}),true);
    assert.equal(game.submit(identity),true);assert.equal(game.snapshot().lastAnswer.correct,false);
    const text=ids=>ids.map(id=>state.problem.chunks.find(chunk=>chunk.chunkId===id).text).join('');
    const finding={fixtureId,seed,expected:text(state.problem.correctOrder),naturalAlternative:text(order),coreAccepted:false};
    game.exit();return finding;
  }
  throw new Error(`Could not reproduce ${fixtureId}`);
}
for(const item of multi) {
  const choiceIds=item.choices.map(choice=>choice.choiceId);
  assert.equal(new Set(choiceIds).size,choiceIds.length);
  assert.equal(new Set(item.choices.map(choice=>choice.text)).size,choiceIds.length);
  assert.equal(scoreMultiSelect({selectedChoiceIds:item.correctChoiceIds,correctChoiceIds:item.correctChoiceIds,choiceIds}).score,1);
  assert.equal(scoreMultiSelect({selectedChoiceIds:choiceIds,correctChoiceIds:item.correctChoiceIds,choiceIds}).score,0);
}
assert.equal(validateKanjiDefenseContent(defense),true);
assert.equal((await loadAsyncChoiceFixture()).length,20);
for(const generate of [generateEnglishChoiceQuestions,generateTimedChoiceQuestions,generateMultiSelectQuestions])assert.equal(generate({sessionId:'audit',random:rng()}).length,10);
assert.equal(prepareAsyncChoiceQuestions({fixture:asyncBank,sessionId:'audit',random:rng()}).length,10);
assert.equal(buildKanjiDefenseSession({random:rng()}).length,12);
const report={baseline,branch:git('branch','--show-current'),math:{ordered:ordered.size,commutative:commutative.size,addition:36,subtraction:45},
 counts:{english:english.length,sentence:sentence.length,timed:timed.length,multi:multi.length,async:asyncBank.length,defense: defense.length,golden:golden.length},
 lengths:{englishWords:lengths(english.map(item=>item.prompt)),englishMeanings:lengths(english.map(item=>item.meaning)),
  sentences:lengths(sentence.map(item=>item.chunks.map(chunk=>chunk.text).join(''))),timedWords:lengths(timed.map(item=>item.word)),timedReadings:lengths(timed.map(item=>item.reading)),
  multiPrompts:lengths(multi.map(item=>item.prompt)),multiChoices:lengths(multi.flatMap(item=>item.choices.map(choice=>choice.text))),
  asyncPrompts:lengths(asyncBank.map(item=>item.prompt)),asyncChoices:lengths(asyncBank.flatMap(item=>item.choices.map(choice=>choice.text))),
  defensePrompts:lengths(defense.map(item=>item.prompt))},
 skills:{multi:count(multi.map(item=>item.skillId)),async:count(asyncBank.map(item=>item.skillId))},
 ambiguity:[alternateRejected('library-book',[1,0,2,3,4]),alternateRejected('morning-bird',[1,0,2,3])],
 status:'BASELINE AUDIT ONLY — CONTENT 120 NOT READY'};
await mkdir(new URL('../artifacts/content-120/',import.meta.url),{recursive:true});
await writeFile(new URL('../artifacts/content-120/inventory.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
