import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDefaultSave } from '../../src/core/saveData.js';
import { launchPreferredBrowser } from './helpers.mjs';
const out=new URL('../../artifacts/run-mistakes/browser/',import.meta.url);
await fs.mkdir(out,{recursive:true});
const server=await createServer({configFile:false,server:{host:'127.0.0.1',port:0,watch:null}});
await server.listen();const base=server.resolvedUrls.local[0],evidence={checks:[],errors:[]};let browser;
try{
  const launched=await launchPreferredBrowser(chromium);browser=launched.browser;evidence.browser=launched.name;
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  const save=getDefaultSave();save.player.name='今回の間違いQA';save.player.collection.gotomonIds=['HKD-E01'];save.meta.compatibilityEntries={tutorial_seen_title:'1'};
  const cases=[['englishChoice','englishLearning',['apple','book'],'cat'],['timedChoice','timedLearning',['anzen','kibou'],'mirai'],['sentenceOrder','sentenceLearning',['library-book','challenge-roof-snow'],'morning-bird']];
  save.player.miniGames={version:1,games:{},companions:{}};
  for(const [gameId,key,chosen,old] of cases)save.player.miniGames[key]={version:1,recentAttempts:[],items:Object.fromEntries([...chosen,old].map(id=>[id,{
    correct:id===old?0:1,incorrect:id===old?1:0,lastCorrect:id!==old,lastAnsweredAt:1,...(gameId==='timedChoice'?{timedOut:0,lastReason:'answer'}:{})
  }]))};
  await context.addInitScript(value=>{if(sessionStorage.getItem('mistakes-qa'))return;localStorage.setItem('krb_save',JSON.stringify(value));localStorage.setItem('bgmVolume','0');localStorage.setItem('seVolume','0');sessionStorage.setItem('mistakes-qa','1');},save);
  const page=await context.newPage();page.on('pageerror',e=>evidence.errors.push(e.message));
  const state=()=>page.evaluate(()=>window.fsm.currentState.inspect().session),progress=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('krb_save')).player.miniGames);
  const retry=page.locator('[data-action=retry-mistakes]');
  const shot=name=>page.screenshot({path:fileURLToPath(new URL(name,out)),fullPage:true});
  async function answer(correct){
    let s=await state();
    if(s.gameId==='sentenceOrder'){
      if(correct)for(let to=0;to<s.problem.correctOrder.length;to++){const chunk=s.problem.correctOrder[to];while(s.currentOrder.indexOf(chunk)>to){await page.locator(`[data-chunk-id="${chunk}"]`).click();await page.locator('[data-action=move-left]').click();s=await state();}}
      await page.locator('[data-action=submit]').click();
    }else{const choice=s.problem.choices.find(c=>(c.choiceId===s.problem.correctChoiceId)===correct);await page.locator(`[data-choice-id="${choice.choiceId}"]`).click();}
  }
  await page.goto(base);await page.locator('#titleMiniGameButton').click();
  for(const [gameId,key,chosen,old] of cases){
    const before=await progress();await page.locator('[data-action=learning-notebook]').click();await page.getByLabel('学習ノートのゲーム').selectOption(gameId);await page.locator('.yt-learning-notebook summary').click();
    for(const id of chosen)await page.locator(`[data-select-content="${id}"]`).check();
    await page.locator('[data-action=practice-selected]').click();await page.locator('[data-action=start-game]').click();
    const first=await state(),wrongId=first.problem.contentId??first.problem.fixtureId;
    await answer(false);await page.locator('[data-action=next]').click();await answer(true);
    await expect(retry).toHaveText('今回まちがえた1問を練習');await expect(page.locator('[data-action=review]')).toContainText('2');
    if(gameId==='englishChoice')for(const [width,height] of [[320,740],[390,844],[768,1024]]){await page.setViewportSize({width,height});expect(await page.locator('#englishChoiceScreen').evaluate(r=>r.scrollWidth<=r.clientWidth+2)).toBe(true);await shot(`result-${width}.png`);}
    await retry.click();let s=await state();expect(s.totalQuestions).toBe(1);expect(s.problem.contentId??s.problem.fixtureId).toBe(wrongId);
    if(gameId==='englishChoice')await page.evaluate(()=>{window.qaSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='krb_save')throw new DOMException('quota','QuotaExceededError');return window.qaSet.call(this,k,v);};});
    await answer(false);
    if(gameId==='englishChoice'){
      await expect(retry).toBeHidden();await page.evaluate(()=>{Storage.prototype.setItem=window.qaSet;delete window.qaSet;});await page.getByRole('button',{name:'記録の保存を再試行',exact:true}).click();
    }
    await expect(retry).toHaveText('今回まちがえた1問を練習');await retry.click();expect((await state()).totalQuestions).toBe(1);await answer(true);
    await expect(retry).toBeHidden();await expect(page.locator('[data-action=review]')).toContainText('1');
    const after=await progress();expect(after[key].items[old]).toEqual(before[key].items[old]);expect(after[key].items[wrongId].lastCorrect).toBe(true);expect(after.games).toEqual(before.games);expect(after.companions).toEqual(before.companions);
    await page.locator('[data-action=return-notebook]').click();await expect(page.getByLabel('学習ノートのゲーム')).toHaveValue(gameId);await page.keyboard.press('Escape');
    evidence.checks.push(`${gameId}: excludes old mistakes, retries only current wrong item, repeated mistake and correction, notebook return`);
  }
  evidence.checks.push('save failure hides retry until saved','correct run hides current-mistake action while older review stays available','no reward or unrelated-history changes','320/390/768px result layout');expect(evidence.errors).toEqual([]);evidence.pass=true;
}finally{await fs.writeFile(new URL('results.json',out),JSON.stringify(evidence,null,2));await browser?.close();await server.close();}
console.log(JSON.stringify(evidence,null,2));
