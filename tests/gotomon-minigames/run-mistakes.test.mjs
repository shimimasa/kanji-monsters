import test from 'node:test';
import assert from 'node:assert/strict';
import { createRunMistakes } from '../../src/minigames/runMistakes.js';
const event=(type,id,attempt,extra={})=>({sessionId:'run',gameId:'timedChoice',type,payload:{contentId:id,attemptId:attempt},...extra});
test('current run excludes correct answers, deduplicates content and includes timeouts',()=>{
  const run=createRunMistakes({sessionId:'run',gameId:'timedChoice'});
  run.observe(event('incorrect','anzen','a'));run.observe(event('incorrect','anzen','b'));run.observe(event('correct','mirai','c'));
  run.observe({...event('incorrect','kibou','d'),payload:{contentId:'kibou',attemptId:'d',reason:'timeout'}});
  assert.deepEqual(run.ids(),['anzen','kibou']);const ids=run.ids();ids.push('injected');assert.deepEqual(run.ids(),['anzen','kibou']);
});
test('later correction removes a mistake and stale duplicate cannot restore it',()=>{
  const run=createRunMistakes({sessionId:'run',gameId:'timedChoice'}),wrong=event('incorrect','anzen','wrong');
  run.observe(wrong);run.observe(event('correct','anzen','fix'));run.observe(wrong);assert.deepEqual(run.ids(),[]);
});
test('foreign sessions, games, malformed observations and non-answer events do not enter retry selection',()=>{
  const run=createRunMistakes({sessionId:'run',gameId:'timedChoice'});
  for(const e of [null,event('incorrect','anzen','x',{sessionId:'old'}),event('incorrect','anzen','x',{gameId:'englishChoice'}),event('problemPresented','anzen','a'),event('incorrect','','b'),event('incorrect','anzen',null)])run.observe(e);
  assert.deepEqual(run.ids(),[]);run.observe(event('incorrect','anzen','x'));assert.deepEqual(run.ids(),['anzen']);
  assert.deepEqual(createRunMistakes({sessionId:'new',gameId:'timedChoice'}).ids(),[]);
});
