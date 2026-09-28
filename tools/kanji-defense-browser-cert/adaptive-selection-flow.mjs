import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import { getDefaultSave } from '../../src/core/saveData.js';
import { TIMED_CHOICE_FIXTURE } from '../../src/minigames/timedChoice/timedChoiceQuestions.js';
import { SENTENCE_ORDER_FIXTURE, SENTENCE_CHALLENGE_FIXTURE } from '../../src/minigames/sentenceOrder/sentenceOrderQuestions.js';
import { launchPreferredBrowser } from './helpers.mjs';
const out=new URL('../../artifacts/adaptive-selection/browser/',import.meta.url);await fs.mkdir(out,{recursive:true});
const server=await createServer({configFile:false,server:{host:'127.0.0.1',port:0,watch:null}});await server.listen();const base=server.resolvedUrls.local[0],evidence={checks:[],errors:[]};let browser;
try{
  const launched=await launchPreferredBrowser(chromium);browser=launched.browser;evidence.browser=launched.name;
  const context=await browser.newContext({viewport:{width:390,height:844}});await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  const save=getDefaultSave();save.player.name='出題調整QA';save.player.collection.gotomonIds=['HKD-E01'];save.meta.compatibilityEntries={tutorial_seen_title:'1'};save.player.miniGames={version:1,games:{},companions:{}};
  const cases=[['timedChoice','timedLearning',TIMED_CHOICE_FIXTURE],['sentenceOrder','sentenceLearning',SENTENCE_ORDER_FIXTURE]];
  for(const [gameId,key,bank] of cases)save.player.miniGames[key]={version:1,recentAttempts:[],items:Object.fromEntries(bank.slice(0,16).map((e,i)=>[e.fixtureId,{correct:i<6?0:1,incorrect:i<6?1:0,lastCorrect:i>=6,lastAnsweredAt:i<6?100+i:i,...(gameId==='timedChoice'?{timedOut:0,lastReason:'answer'}:{})}]))};
  for(const e of SENTENCE_CHALLENGE_FIXTURE)save.player.miniGames.sentenceLearning.items[e.fixtureId]={correct:0,incorrect:1,lastCorrect:false,lastAnsweredAt:1000};
  await context.addInitScript(value=>{if(sessionStorage.getItem('adaptive-qa'))return;localStorage.setItem('krb_save',JSON.stringify(value));localStorage.setItem('bgmVolume','0');localStorage.setItem('seVolume','0');sessionStorage.setItem('adaptive-qa','1');},save);
  const page=await context.newPage();page.on('pageerror',e=>evidence.errors.push(e.message));const state=()=>page.evaluate(()=>window.fsm.currentState.inspect().session);
  await page.goto(base);await page.locator('#titleMiniGameButton').click();
  for(const [gameId,key,bank] of cases){
    const history=save.player.miniGames[key].items;
    await page.locator(`.yt-game-card[data-game-id=${gameId}]`).click();await expect(page.getByRole('dialog')).toContainText('記録に合わせて');await page.locator('[data-action=start-game]').click();
    const seen=[];
    for(let i=0;i<10;i++){
      let s=await state();seen.push(s.problem.fixtureId);expect(s.mode).not.toBe('review');
      if(gameId==='timedChoice'){expect(s.deadlineMs).toBe(5000);await page.locator(`[data-choice-id="${s.problem.correctChoiceId}"]`).click();}
      else{expect(s.problem.chunks.length).toBe(3);for(let to=0;to<s.problem.correctOrder.length;to++){const chunk=s.problem.correctOrder[to];while(s.currentOrder.indexOf(chunk)>to){await page.locator(`[data-chunk-id="${chunk}"]`).click();await page.locator('[data-action=move-left]').click();s=await state();}}await page.locator('[data-action=submit]').click();}
      if((await state()).phase==='feedback')await page.locator('[data-action=next]').click();
    }
    expect(new Set(seen).size).toBe(10);expect(seen.filter(id=>history[id]?.lastCorrect===false).sort()).toEqual(bank.slice(3,6).map(e=>e.fixtureId).sort());expect(seen.filter(id=>!history[id])).toHaveLength(5);expect(seen.filter(id=>history[id]?.lastCorrect===true)).toEqual(bank.slice(6,8).map(e=>e.fixtureId));expect((await state()).result.correct).toBe(10);
    await page.locator('.gt-result-actions [data-action=replay]').click();expect(bank.slice(0,3).map(e=>e.fixtureId)).toContain((await state()).problem.fixtureId);
    await page.locator('[data-action=back]').click();evidence.checks.push(`${gameId}: saved profile yields 3 recent errors + 5 unseen + 2 oldest correct, then replay uses updated history`);
  }
  expect(evidence.errors).toEqual([]);evidence.pass=true;
}finally{await fs.writeFile(new URL('results.json',out),JSON.stringify(evidence,null,2));await browser?.close();await server.close();}
console.log(JSON.stringify(evidence,null,2));
