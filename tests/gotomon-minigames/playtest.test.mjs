import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlaytestRecorder } from '../../src/playtest/recorder.js';
import { summarizePlaytest } from '../../src/playtest/summary.js';
import { PLAYTEST_ENABLED, trackPlaytest } from '../../src/playtest/developmentLogger.js';

function fixture(options={}) {
  let clock=1000;
  const recorder=createPlaytestRecorder({now:()=>clock,uuid:()=> '00000000-0000-4000-8000-000000000001',...options});
  const tick=ms=>{clock+=ms;};
  const start=(sessionId,gameId='mathSprint',gotomonId='HKD-E01')=>recorder.record('runStarted',{sessionId,gameId,gotomonId,level:1,availableCompanions:2});
  const complete=sessionId=>recorder.record('completed',{sessionId,score:1600,resultRank:'S',correct:10,activeElapsedMs:45000});
  return {recorder,tick,start,complete};
}
test('playtest is disabled by default and requires explicit consent without accepting participant names',()=>{
  assert.equal(PLAYTEST_ENABLED,false);assert.doesNotThrow(()=>trackPlaytest('runStarted',{name:'not captured'}));
  const {recorder,start}=fixture();start('a');assert.equal(recorder.snapshot(),null);
  assert.equal(recorder.start(),false);assert.equal(recorder.start({consentConfirmed:true,name:'not captured'}),true);
  assert.equal(recorder.start({consentConfirmed:true}),false);assert.equal(JSON.stringify(recorder.snapshot()).includes('not captured'),false);
});
test('only anonymous generated IDs, game IDs, pal IDs and allowlisted values are exported',()=>{
  const {recorder,start}=fixture();recorder.start({consentConfirmed:true});start('secret source ID');
  recorder.record('action',{sessionId:'secret source ID',action:'secret school',address:'secret address'});
  recorder.record('command',{sessionId:'secret source ID',command:'submit',answer:'secret answer',name:'secret child'});
  recorder.record('gameChosen',{gameId:'secret game'});recorder.record('companionChosen',{gameId:'mathSprint',gotomonId:'secret name'});
  const encoded=JSON.stringify(recorder.snapshot());assert.equal(encoded.includes('secret'),false);
  assert.deepEqual(recorder.snapshot().runs[0].commandCounts,{submit:1});
});
test('first game choice includes cancelled pickers; start delay is selection latency, not inferred confusion',()=>{
  const {recorder,start,tick}=fixture();recorder.start({consentConfirmed:true});recorder.record('hubShown');tick(500);
  recorder.record('gameChosen',{gameId:'englishChoice'});tick(1000);recorder.record('gameChosen',{gameId:'mathSprint'});tick(1500);start('a');
  assert.equal(recorder.snapshot().firstGameId,'englishChoice');assert.equal(recorder.snapshot().runs[0].selectionToStartMs,1500);
});
test('completion, reward, replay and exit are idempotent and link two runs without ending early',()=>{
  const {recorder,start,tick,complete}=fixture();recorder.start({consentConfirmed:true});start('a');start('a');tick(45000);
  recorder.record('reward',{sessionId:'a',ok:true,level:2,earnedXP:30});complete('a');complete('a');tick(3000);
  recorder.record('replayPressed',{sessionId:'a'});recorder.record('runLeft',{sessionId:'a',reason:'interrupted'});start('b');
  const data=recorder.snapshot(),first=data.runs[0];assert.equal(data.runs.length,2);assert.equal(first.quitMidGame,false);
  assert.equal(first.resultDwellMs,3000);assert.equal(first.earnedXP,30);assert.equal(first.levelAfter,2);assert.equal(first.decision,'replay');
  const summary=summarizePlaytest(data);assert.deepEqual(summary.voluntaryReplay,{numerator:1,denominator:1,rate:1});
});
test('result dwell excludes hidden time in visible duration, preserving wall duration',()=>{
  const {recorder,start,tick,complete}=fixture();recorder.start({consentConfirmed:true});start('a');complete('a');tick(2000);
  recorder.record('visibility',{hidden:true});tick(10000);recorder.record('visibility',{hidden:false});tick(1000);
  recorder.record('runLeft',{sessionId:'a',reason:'back'});
  const run=recorder.snapshot().runs[0];assert.equal(run.resultVisibleMs,3000);assert.equal(run.resultDwellMs,13000);
});
test('game switch is next card choice, not a hub visit; same game via hub is separate from replay button',()=>{
  const {recorder,start,complete}=fixture();recorder.start({consentConfirmed:true});start('a');complete('a');
  recorder.record('runLeft',{sessionId:'a',reason:'back'});recorder.record('hubShown');assert.equal(summarizePlaytest(recorder.snapshot()).gameSwitch.denominator,0);
  recorder.record('gameChosen',{gameId:'englishChoice'});start('b','englishChoice');complete('b');recorder.record('runLeft',{sessionId:'b',reason:'back'});
  recorder.record('gameChosen',{gameId:'englishChoice'});const report=summarizePlaytest(recorder.snapshot());
  assert.equal(report.gameSwitch.numerator,1);assert.equal(report.sameGameViaHub.numerator,1);assert.equal(report.voluntaryReplay.numerator,0);assert.equal(report.gameSwitch.denominator,2);
});
test('unfinished back/child stop counts as exit; reload/time limit is censored, not an exit',()=>{
  const {recorder,start}=fixture();recorder.start({consentConfirmed:true});start('a');recorder.record('runLeft',{sessionId:'a',reason:'back'});
  start('b');recorder.record('runLeft',{sessionId:'b',reason:'interrupted'});start('c');recorder.end('time-limit');
  const summary=summarizePlaytest(recorder.snapshot());assert.equal(summary.starts,3);assert.deepEqual(summary.earlyExit,{numerator:1,denominator:1,rate:1});
});
test('observed stopping after result counts as decision; time-limit after result does not',()=>{
  const child=fixture();child.recorder.start({consentConfirmed:true});child.start('a');child.complete('a');child.recorder.end('child-stop');
  assert.equal(summarizePlaytest(child.recorder.snapshot()).voluntaryReplay.denominator,1);
  const limit=fixture();limit.recorder.start({consentConfirmed:true});limit.start('a');limit.complete('a');limit.recorder.end('time-limit');
  assert.equal(summarizePlaytest(limit.recorder.snapshot()).voluntaryReplay.denominator,0);
});
test('assistance, explicit replay prompts, technical issues and observer interruptions exclude voluntary KPI',()=>{
  for(const mark of ['help','replay-prompt','technical','observer-interruption']){
    const {recorder,start,complete}=fixture();recorder.start({consentConfirmed:true});start('a');complete('a');recorder.mark(mark);
    recorder.record('replayPressed',{sessionId:'a'});const report=summarizePlaytest(recorder.snapshot());assert.equal(report.voluntaryReplay.denominator,0,mark);assert.equal(report.excludedDecisions,1);
  }
});
test('companion switching uses actual consecutive starts, not exploratory selection clicks',()=>{
  const {recorder,start}=fixture();recorder.start({consentConfirmed:true});start('a');recorder.record('runLeft',{sessionId:'a',reason:'back'});
  recorder.record('companionChosen',{gameId:'mathSprint',gotomonId:'HKD-E02'});start('b','mathSprint','HKD-E01');recorder.record('runLeft',{sessionId:'b',reason:'back'});
  start('c','englishChoice','HKD-E02');const summary=summarizePlaytest(recorder.snapshot());assert.deepEqual(summary.companionSwitch,{numerator:1,denominator:2,rate:.5});
});
test('second run strategy stays unclassified even when accepted action counts differ',()=>{
  const {recorder,start,complete}=fixture();recorder.start({consentConfirmed:true});start('a');recorder.record('action',{sessionId:'a',action:'charge'});complete('a');
  recorder.record('replayPressed',{sessionId:'a'});start('b');recorder.record('action',{sessionId:'b',action:'push'});complete('b');
  const candidate=summarizePlaytest(recorder.snapshot()).secondRunCandidates[0];assert.equal(candidate.eligibleForObservation,true);assert.equal(candidate.strategyChanged,null);
});
test('failed save logs no invented level or XP; stale receipts cannot change another run',()=>{
  const {recorder,start,complete}=fixture();recorder.start({consentConfirmed:true});start('a');recorder.record('reward',{sessionId:'a',ok:false});complete('a');start('b');
  recorder.record('reward',{sessionId:'a',ok:true,level:10,earnedXP:999});const runs=recorder.snapshot().runs;
  assert.equal(runs[0].levelAfter,null);assert.equal(runs[0].saveSucceeded,false);assert.equal(runs[1].earnedXP,null);
});
test('ended logs cannot mix the next participant; clear requires stopped observation; snapshots cannot mutate records',()=>{
  const {recorder,start}=fixture();recorder.start({consentConfirmed:true});start('a');assert.equal(recorder.clear(),false);
  const copy=recorder.snapshot();copy.runs[0].score=999;assert.equal(recorder.snapshot().runs[0].score,null);
  recorder.end('child-stop');start('b');assert.equal(recorder.snapshot().runs.length,1);assert.equal(recorder.clear(),true);assert.equal(recorder.snapshot(),null);
});
test('bounded capture explicitly invalidates incomplete logs rather than silently biasing rates',()=>{
  const {recorder,start}=fixture({maxEvents:2});recorder.start({consentConfirmed:true});start('a');recorder.record('action',{sessionId:'a',action:'charge'});
  assert.equal(recorder.snapshot().events.length,2);assert.equal(recorder.snapshot().truncated,true);assert.equal(summarizePlaytest(recorder.snapshot()).usable,false);
});
