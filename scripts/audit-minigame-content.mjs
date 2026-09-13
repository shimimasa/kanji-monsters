import { mkdir, writeFile } from 'node:fs/promises';
import { generateSessionProblems } from '../src/minigames/mathSprint/mathSprintGenerator.js';
import { ENGLISH_CHOICE_FIXTURE, generateEnglishChoiceQuestions } from '../src/minigames/englishChoice/englishChoiceQuestions.js';
import { SENTENCE_ORDER_FIXTURE, generateSentenceOrderQuestions } from '../src/minigames/sentenceOrder/sentenceOrderQuestions.js';
import { TIMED_CHOICE_FIXTURE, generateTimedChoiceQuestions } from '../src/minigames/timedChoice/timedChoiceQuestions.js';
import { MULTI_SELECT_FIXTURE, generateMultiSelectQuestions } from '../src/minigames/multiSelect/multiSelectQuestions.js';
import { ASYNC_CHOICE_FIXTURE, prepareAsyncChoiceQuestions } from '../src/minigames/asyncChoice/asyncChoiceQuestions.js';
import { KANJI_DEFENSE_LIMITED_UX_CONTENT, buildKanjiDefenseSession } from '../src/minigames/kanjiDefense/kanjiDefenseContent.js';
const rng=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const specs=[['mathSprint',81,10,generateSessionProblems],['mathInvader',81,10,generateSessionProblems],
 ['englishChoice',ENGLISH_CHOICE_FIXTURE.length,10,generateEnglishChoiceQuestions],['sentenceOrder',SENTENCE_ORDER_FIXTURE.length,10,generateSentenceOrderQuestions],
 ['timedChoice',TIMED_CHOICE_FIXTURE.length,10,generateTimedChoiceQuestions],['multiSelect',MULTI_SELECT_FIXTURE.length,10,generateMultiSelectQuestions],
 ['asyncChoice',ASYNC_CHOICE_FIXTURE.length,10,options=>prepareAsyncChoiceQuestions({...options,fixture:ASYNC_CHOICE_FIXTURE})],
 ['kanjiDefense',KANJI_DEFENSE_LIMITED_UX_CONTENT.length,12,options=>buildKanjiDefenseSession(options).map(x=>x.content)]];
const result=[];
for(const [gameId,bankSize,perRun,generate] of specs){
 const random=rng(20260913),seen=new Map(),overlap=[],uniqueAt=[];let previous=new Set();
 for(let run=0;run<60;run++){
  const items=generate({sessionId:`content-${run}`,random});
  const keys=items.map(item=>item.fixtureId??item.sourceId??(item.operation?`${item.a}:${item.operation}:${item.b}`:item.prompt));
  overlap.push(keys.filter(key=>previous.has(key)).length);
  for(const key of keys)seen.set(key,(seen.get(key)||0)+1);
  previous=new Set(keys);uniqueAt.push(seen.size);
 }
 const exposures=perRun*60;
 result.push({gameId,bankSize,perRun,runs:60,uniqueAt1:uniqueAt[0],uniqueAt5:uniqueAt[4],uniqueAt10:uniqueAt[9],uniqueAt60:seen.size,
  repeatedExposures:exposures-seen.size,repeatRate:(exposures-seen.size)/exposures,meanAdjacentOverlap:overlap.slice(1).reduce((a,b)=>a+b,0)/59,
  meanExposuresPerItem:exposures/bankSize,maxObservedExposures:Math.max(...seen.values()),
  bankForAtMostFiveAverageExposures:Math.ceil(exposures/5),bankForAtMostThreeAverageExposures:Math.ceil(exposures/3)});
}
await mkdir(new URL('../artifacts/minigame-80plus/',import.meta.url),{recursive:true});
await writeFile(new URL('../artifacts/minigame-80plus/content-balance.json',import.meta.url),JSON.stringify({method:'60 seeded actual-generator runs; prompt identity, not option order; full clears; repeated means previously seen in the sequence',games:result},null,2));
console.table(result);
