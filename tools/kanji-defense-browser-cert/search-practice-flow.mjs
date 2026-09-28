import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDefaultSave } from '../../src/core/saveData.js';
import { learningBanks, summarizeLearning, searchPracticeIds } from '../../src/minigames/learningNotebook.js';
import { launchPreferredBrowser } from './helpers.mjs';
const out=new URL('../../artifacts/search-practice/browser/',import.meta.url);
await fs.mkdir(out,{recursive:true});
const server=await createServer({configFile:false,server:{host:'127.0.0.1',port:0,watch:null}});
await server.listen();const base=server.resolvedUrls.local[0],evidence={checks:[],errors:[]};let browser;
try{
  const launched=await launchPreferredBrowser(chromium);browser=launched.browser;evidence.browser=launched.name;
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  const save=getDefaultSave();save.player.name='まとめ練習QA';save.player.collection.gotomonIds=['HKD-E01'];save.meta.compatibilityEntries={tutorial_seen_title:'1'};
  save.player.miniGames={version:1,games:{},companions:{}};
  const keys=['englishLearning','timedLearning','sentenceLearning'], queries=['e','う','ピース'];
  for(const [i,bank] of learningBanks.entries()){
    const entries=i===2?[...bank.entries.slice(0,3),...bank.entries.slice(120,122)]:bank.entries.slice(0,i===0?120:20);
    save.player.miniGames[keys[i]]={version:1,recentAttempts:[],items:Object.fromEntries(entries.map((e,j)=>[e.id,{
      correct:j%3?1:0,incorrect:j%3?0:1,lastCorrect:!!(j%3),lastAnsweredAt:j,...(i===1?{timedOut:0,lastReason:'answer'}:{})
    }]))};
  }
  await context.addInitScript(value=>{if(sessionStorage.getItem('batch-qa'))return;localStorage.setItem('krb_save',JSON.stringify(value));localStorage.setItem('bgmVolume','0');localStorage.setItem('seVolume','0');sessionStorage.setItem('batch-qa','1');},save);
  const page=await context.newPage();page.on('pageerror',e=>evidence.errors.push(e.message));
  const state=()=>page.evaluate(()=>window.fsm.currentState.inspect().session);
  const progress=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('krb_save')).player.miniGames);
  const dialog=page.getByRole('dialog',{name:'学習ノート',exact:true}),search=page.getByRole('searchbox',{name:'記録した問題を検索'});
  const shot=name=>page.screenshot({path:fileURLToPath(new URL(name,out)),fullPage:true});
  await page.goto(base);await page.locator('#titleMiniGameButton').click();
  for(const [i,bank] of learningBanks.entries()){
    const before=await progress(),expected=searchPracticeIds(summarizeLearning(bank,before[keys[i]].items),queries[i]);
    expect(expected.length).toBeGreaterThan(1);if(i===0)expect(expected.length).toBe(10);
    await page.locator('[data-action=learning-notebook]').click();await page.getByLabel('学習ノートのゲーム').selectOption(bank.gameId);
    await search.fill('見つからない文字列');await expect(dialog.locator('[data-action=practice-search]')).toHaveCount(0);
    await search.fill(queries[i]);await expect(dialog.locator('[data-action=practice-search]')).toContainText(`今回${expected.length}${bank.unit}`);
    await expect(dialog.locator('.yt-batch-marker')).toHaveCount(expected.length);
    expect(await progress()).toEqual(before);
    if(i===0)for(const [width,height] of [[320,740],[390,844],[768,1024]]){
      await page.setViewportSize({width,height});expect(await dialog.evaluate(r=>r.scrollWidth<=r.clientWidth+2)).toBe(true);await dialog.locator('[data-action=practice-search]').scrollIntoViewIfNeeded();await shot(`batch-${width}.png`);
    }
    await dialog.locator('[data-action=practice-search]').click();await page.locator('[data-action=start-game]').click();
    expect((await state()).mode).toBe('review');expect((await state()).totalQuestions).toBe(expected.length);
    const seen=[];
    for(let question=0;question<expected.length;question++){
      let s=await state();seen.push(s.problem.contentId??s.problem.fixtureId);
      if(i===2){
        for(let to=0;to<s.problem.correctOrder.length;to++){
          const chunk=s.problem.correctOrder[to];while(s.currentOrder.indexOf(chunk)>to){await page.locator(`[data-chunk-id="${chunk}"]`).click();await page.locator('[data-action=move-left]').click();s=await state();}
        }
        await page.locator('[data-action=submit]').click();
      }else await page.locator(`[data-choice-id="${s.problem.correctChoiceId}"]`).click();
      if((await state()).phase==='feedback')await page.locator('[data-action=next]').click();
    }
    expect(new Set(seen)).toEqual(new Set(expected));expect((await state()).result.correct).toBe(expected.length);
    const after=await progress();expect(after.games).toEqual(before.games);expect(after.companions).toEqual(before.companions);expect(after.hubActivity).toEqual(before.hubActivity);
    for(const id of expected)expect(after[keys[i]].items[id].correct).toBe(before[keys[i]].items[id].correct+1);
    await page.getByRole('button',{name:'通常の10問であそぶ',exact:true}).click();expect((await state()).totalQuestions).toBe(10);expect((await state()).mode).not.toBe('review');
    await page.locator('[data-action=back]').click();evidence.checks.push(`${bank.gameId}: ${expected.length} selected questions completed, history saved, no rewards, normal replay restored`);
  }
  evidence.checks.push('no-match has no batch action','selected-item markers and ten-item cap','read-only search','320/390/768px layout');expect(evidence.errors).toEqual([]);evidence.pass=true;
}finally{await fs.writeFile(new URL('results.json',out),JSON.stringify(evidence,null,2));await browser?.close();await server.close();}
console.log(JSON.stringify(evidence,null,2));
