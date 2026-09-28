import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDefaultSave } from '../../src/core/saveData.js';
import { learningBanks } from '../../src/minigames/learningNotebook.js';
import { launchPreferredBrowser } from './helpers.mjs';
const out=new URL('../../artifacts/notebook-practice/browser/',import.meta.url);
await fs.mkdir(out,{recursive:true});
const server=await createServer({configFile:false,server:{host:'127.0.0.1',port:0,watch:null}});
await server.listen();const base=server.resolvedUrls.local[0],evidence={checks:[],errors:[]};let browser;
try{
  const launched=await launchPreferredBrowser(chromium);browser=launched.browser;evidence.browser=launched.name;
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  const save=getDefaultSave();save.player.name='1問QA';save.player.collection.gotomonIds=['HKD-E01'];save.meta.compatibilityEntries={tutorial_seen_title:'1'};
  save.player.miniGames={version:1,games:{},companions:{}};
  for(const [i,key] of ['englishLearning','timedLearning','sentenceLearning'].entries()){
    save.player.miniGames[key]={version:1,recentAttempts:[],items:Object.fromEntries(learningBanks[i].entries.slice(0,14).map((e,j)=>[e.id,{
      correct:j===0?1:0,incorrect:j===0?0:1,lastCorrect:j===0,lastAnsweredAt:j,...(i===1?{timedOut:0,lastReason:'answer'}:{})
    }]))};
  }
  await context.addInitScript(value=>{if(sessionStorage.getItem('practice-qa'))return;localStorage.setItem('krb_save',JSON.stringify(value));localStorage.setItem('bgmVolume','0');localStorage.setItem('seVolume','0');sessionStorage.setItem('practice-qa','1');},save);
  const page=await context.newPage();page.on('pageerror',e=>evidence.errors.push(e.message));
  const state=()=>page.evaluate(()=>window.fsm.currentState.inspect().session);
  const progress=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('krb_save')).player.miniGames);
  const dialog=page.getByRole('dialog',{name:'学習ノート',exact:true});
  const shot=name=>page.screenshot({path:fileURLToPath(new URL(name,out)),fullPage:true});
  await page.goto(base);await page.locator('#titleMiniGameButton').click();
  const before=await progress();
  for(const bank of learningBanks){
    await page.locator('[data-action=learning-notebook]').click();await page.getByLabel('学習ノートのゲーム').selectOption(bank.gameId);
    await dialog.locator('summary').click();
    const wanted=bank.entries[0].id;
    const row=dialog.locator(`[data-content-id="${wanted}"]`);
    await row.locator('[data-action=practice-one]').click();
    await expect(page.getByRole('dialog',{name:'相棒ゴトモンを選ぶ'})).toContainText('学習ノートで選んだ問題');
    await page.locator('[data-action=start-game]').click();let s=await state();
    expect(s.mode).toBe('review');expect(s.totalQuestions).toBe(1);expect(s.problem.contentId??s.problem.fixtureId).toBe(wanted);
    if(bank.gameId==='sentenceOrder'){
      for(let to=0;to<s.problem.correctOrder.length;to++){
        const chunk=s.problem.correctOrder[to];
        while(s.currentOrder.indexOf(chunk)>to){await page.locator(`[data-chunk-id="${chunk}"]`).click();await page.locator('[data-action=move-left]').click();s=await state();}
      }
      await page.locator('[data-action=submit]').click();
    }else{
      if(bank.gameId==='timedChoice'){await page.waitForTimeout(5500);expect((await state()).phase).toBe('answering');}
      await page.locator(`[data-choice-id="${s.problem.correctChoiceId}"]`).click();
    }
    expect((await state()).result.correct).toBe(1);
    // The result's review action must discard the single-item selection.
    await page.locator('[data-action=review]').click();s=await state();expect(s.totalQuestions).toBe(10);expect(s.problem.contentId??s.problem.fixtureId).not.toBe(wanted);
    await page.locator('[data-action=back]').click();
    evidence.checks.push(`${bank.gameId}: latest-correct single practice and full review afterwards`);
  }
  const after=await progress();expect(after.games).toEqual(before.games);expect(after.companions).toEqual(before.companions);expect(after.hubActivity).toEqual(before.hubActivity);
  await page.locator('[data-action=learning-notebook]').click();
  // An old mistake outside the automatic ten-question batch can be selected directly.
  const old=learningBanks[0].entries[1].id;
  for(const [width,height] of [[320,740],[390,844],[768,1024]]){
    await page.setViewportSize({width,height});await dialog.locator(`[data-content-id="${old}"]`).scrollIntoViewIfNeeded();
    expect(await dialog.evaluate(r=>r.scrollWidth<=r.clientWidth+2)).toBe(true);await shot(`practice-${width}.png`);
  }
  await dialog.locator(`[data-content-id="${old}"] [data-action=practice-one]`).click();await page.locator('[data-action=start-game]').click();
  let s=await state();expect(s.problem.contentId).toBe(old);expect(s.totalQuestions).toBe(1);
  // Rechecking can still be wrong: it must retain the mistake in the notebook.
  const wrong=s.problem.choices.find(c=>c.choiceId!==s.problem.correctChoiceId).choiceId;
  await page.locator(`[data-choice-id="${wrong}"]`).click();expect((await progress()).englishLearning.items[old].incorrect).toBe(2);
  await page.getByRole('button',{name:'通常の10問であそぶ',exact:true}).click();s=await state();expect(s.mode).toBe('tenQuestions');expect(s.totalQuestions).toBe(10);
  evidence.checks.push('old mistake outside automatic batch','incorrect practice remains pending','normal replay returns to ten questions','no growth or record rewards','320/390/768px layout');
  expect(evidence.errors).toEqual([]);evidence.pass=true;
}finally{await fs.writeFile(new URL('results.json',out),JSON.stringify(evidence,null,2));await browser?.close();await server.close();}
console.log(JSON.stringify(evidence,null,2));
