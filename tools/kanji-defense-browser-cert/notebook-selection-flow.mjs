import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDefaultSave } from '../../src/core/saveData.js';
import { learningBanks } from '../../src/minigames/learningNotebook.js';
import { launchPreferredBrowser } from './helpers.mjs';
const out=new URL('../../artifacts/notebook-selection/browser/',import.meta.url);
await fs.mkdir(out,{recursive:true});
const server=await createServer({configFile:false,server:{host:'127.0.0.1',port:0,watch:null}});
await server.listen();const base=server.resolvedUrls.local[0],evidence={checks:[],errors:[]};let browser;
try{
  const launched=await launchPreferredBrowser(chromium);browser=launched.browser;evidence.browser=launched.name;
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  const save=getDefaultSave();save.player.name='選択QA';save.player.collection.gotomonIds=['HKD-E01'];save.meta.compatibilityEntries={tutorial_seen_title:'1'};
  save.player.miniGames={version:1,games:{},companions:{}};
  const keys=['englishLearning','timedLearning','sentenceLearning'];
  for(const [i,bank] of learningBanks.entries())save.player.miniGames[keys[i]]={version:1,recentAttempts:[],items:Object.fromEntries(bank.entries.slice(0,14).map((e,j)=>[e.id,{
    correct:j===0?1:0,incorrect:j===0?0:1,lastCorrect:j===0,lastAnsweredAt:j,...(i===1?{timedOut:0,lastReason:'answer'}:{})
  }]))};
  await context.addInitScript(value=>{if(sessionStorage.getItem('selection-qa'))return;localStorage.setItem('krb_save',JSON.stringify(value));localStorage.setItem('bgmVolume','0');localStorage.setItem('seVolume','0');sessionStorage.setItem('selection-qa','1');},save);
  const page=await context.newPage();page.on('pageerror',e=>evidence.errors.push(e.message));
  const state=()=>page.evaluate(()=>window.fsm.currentState.inspect().session);
  const progress=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('krb_save')).player.miniGames);
  const dialog=page.getByRole('dialog',{name:'学習ノート',exact:true}),search=page.getByRole('searchbox',{name:'記録した問題を検索'});
  const selection=dialog.getByRole('region',{name:'選んだ問題',exact:true});
  const checkbox=id=>dialog.locator(`[data-select-content="${id}"]`);
  const shot=name=>page.screenshot({path:fileURLToPath(new URL(name,out)),fullPage:true});
  await page.goto(base);await page.locator('#titleMiniGameButton').click();await page.locator('[data-action=learning-notebook]').click();
  const beforeSelection=await progress();
  for(const entry of learningBanks[0].entries.slice(1,11))await checkbox(entry.id).check();
  await expect(selection).toContainText('10 / 10問');await expect(checkbox(learningBanks[0].entries[11].id)).toBeDisabled();
  await checkbox(learningBanks[0].entries[1].id).uncheck();await expect(checkbox(learningBanks[0].entries[11].id)).toBeEnabled();
  await selection.locator('[data-action=clear-practice-selection]').click();await expect(selection).toBeHidden();
  await checkbox('book').check();await page.getByLabel('学習ノートのゲーム').selectOption('timedChoice');await expect(selection).toBeHidden();
  expect(await progress()).toEqual(beforeSelection);
  for(const [i,bank] of learningBanks.entries()){
    await page.getByLabel('学習ノートのゲーム').selectOption(bank.gameId);
    const before=await progress(), chosen=bank.entries.slice(0,2);
    await search.fill(chosen[0].text);await checkbox(chosen[0].id).check();
    await search.fill(chosen[1].text);await expect(selection).toContainText('検索条件に合わない選択 1問');await checkbox(chosen[1].id).check();
    await expect(selection.locator('[data-action=practice-selected]')).toHaveText('選んだ2問を練習');
    await expect(dialog.locator('[data-action=practice-search]')).toBeHidden();
    await selection.getByRole('button',{name:'選んだ問題を確認',exact:true}).click();
    await expect(selection.locator('li')).toHaveCount(2);
    if(i===0){
      await selection.getByRole('button',{name:`選択から外す：${chosen[0].text}`,exact:true}).click();await expect(selection).toContainText('1 / 10問');
      await search.fill(chosen[0].text);await checkbox(chosen[0].id).check();await search.fill(chosen[1].text);
      for(const [width,height] of [[320,740],[390,844],[768,1024]]){
        await page.setViewportSize({width,height});expect(await dialog.evaluate(r=>r.scrollWidth<=r.clientWidth+2)).toBe(true);await shot(`selection-${width}.png`);
      }
    }
    expect(await progress()).toEqual(before);
    await selection.locator('[data-action=practice-selected]').click();await page.locator('[data-action=start-game]').click();expect((await state()).totalQuestions).toBe(2);
    const seen=[];
    for(let q=0;q<2;q++){
      let s=await state();seen.push(s.problem.contentId??s.problem.fixtureId);
      if(i===2){for(let to=0;to<s.problem.correctOrder.length;to++){const chunk=s.problem.correctOrder[to];while(s.currentOrder.indexOf(chunk)>to){await page.locator(`[data-chunk-id="${chunk}"]`).click();await page.locator('[data-action=move-left]').click();s=await state();}}await page.locator('[data-action=submit]').click();}
      else await page.locator(`[data-choice-id="${s.problem.correctChoiceId}"]`).click();
      if((await state()).phase==='feedback')await page.locator('[data-action=next]').click();
    }
    expect(new Set(seen)).toEqual(new Set(chosen.map(e=>e.id)));expect((await state()).result.correct).toBe(2);
    const after=await progress();expect(after.games).toEqual(before.games);expect(after.companions).toEqual(before.companions);
    for(const entry of chosen)expect(after[keys[i]].items[entry.id].correct).toBe(before[keys[i]].items[entry.id].correct+1);
    await page.locator('[data-action=return-notebook]').click();await expect(search).toHaveValue(chosen[1].text);await expect(selection).toBeHidden();
    evidence.checks.push(`${bank.gameId}: cross-search correct/incorrect selection, exact two-item practice, updated notebook return`);
  }
  evidence.checks.push('ten-item cap and deselection','clear and game-switch reset','hidden selected item disclosure and removal','selection does not save','no growth rewards','320/390/768px layout');expect(evidence.errors).toEqual([]);evidence.pass=true;
}finally{await fs.writeFile(new URL('results.json',out),JSON.stringify(evidence,null,2));await browser?.close();await server.close();}
console.log(JSON.stringify(evidence,null,2));
