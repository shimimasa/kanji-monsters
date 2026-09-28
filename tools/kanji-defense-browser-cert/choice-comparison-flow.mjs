import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDefaultSave } from '../../src/core/saveData.js';
import { launchPreferredBrowser } from './helpers.mjs';
const out=new URL('../../artifacts/choice-comparison/browser/',import.meta.url);
await fs.mkdir(out,{recursive:true});
const server=await createServer({configFile:false,server:{host:'127.0.0.1',port:0,watch:null}});
await server.listen();const base=server.resolvedUrls.local[0],evidence={checks:[],errors:[]};let browser;
try{
  const launched=await launchPreferredBrowser(chromium);browser=launched.browser;evidence.browser=launched.name;
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  const save=getDefaultSave();save.player.name='回答比較QA';save.player.collection.gotomonIds=['HKD-E01'];save.meta.compatibilityEntries={tutorial_seen_title:'1'};
  await context.addInitScript(value=>{if(sessionStorage.getItem('compare-choice-qa'))return;localStorage.setItem('krb_save',JSON.stringify(value));localStorage.setItem('bgmVolume','0');localStorage.setItem('seVolume','0');sessionStorage.setItem('compare-choice-qa','1');},save);
  const page=await context.newPage();page.on('pageerror',e=>evidence.errors.push(e.message));
  const state=()=>page.evaluate(()=>window.fsm.currentState.inspect().session),saved=()=>page.evaluate(()=>localStorage.getItem('krb_save'));
  const comparison=page.getByRole('region',{name:'今回まちがえた問題の比較',exact:true});
  const shot=name=>page.screenshot({path:fileURLToPath(new URL(name,out)),fullPage:true});
  async function answer(correct){const s=await state(),choice=s.problem.choices.find(c=>(c.choiceId===s.problem.correctChoiceId)===correct);await page.locator(`[data-choice-id="${choice.choiceId}"]`).click();return choice.text;}
  async function next(){if((await state()).phase==='feedback')await page.locator('[data-action=next]').click();}
  await page.goto(base);await page.locator('#titleMiniGameButton').click();
  for(const gameId of ['englishChoice','timedChoice']){
    await page.locator(`.yt-game-card[data-game-id=${gameId}]`).click();await page.locator('[data-action=start-game]').click();
    const expected=[];
    for(let i=0;i<10;i++){
      const s=await state();let selected=null;
      if(gameId==='timedChoice'&&i===0)await page.waitForFunction(()=>window.fsm.currentState.inspect().session.answered===1,{},{timeout:8000});
      else selected=await answer(i>=2);
      if(i<2)expected.push({id:s.problem.contentId??s.problem.fixtureId,prompt:s.problem.prompt,selected,correct:s.problem.choices.find(c=>c.choiceId===s.problem.correctChoiceId).text});
      await next();
    }
    expect((await state()).result.correct).toBe(8);expect((await state()).missed).toHaveLength(2);const before=await saved();
    await page.locator('.gt-result-details > summary').click();await expect(comparison).toBeVisible();await expect(comparison.locator('[data-missed-content]')).toHaveCount(2);
    for(const [i,item] of expected.entries()){
      const row=comparison.locator(`[data-missed-content="${item.id}"]`);await expect(row.locator('h4')).toHaveText(`第${i+1}問 · ${item.prompt}`);
      await expect(row.locator('.gt-comparison-selected')).toHaveText(item.selected===null?'時間切れ（回答なし）':`選んだ答え：${item.selected}`);
      await expect(row.locator('.gt-comparison-correct')).toHaveText(`正しい答え：${item.correct}`);
    }
    await comparison.evaluate(el=>{window.qaCompareRow=el.querySelector('li');});await page.waitForTimeout(700);expect(await comparison.evaluate(el=>el.querySelector('li')===window.qaCompareRow)).toBe(true);expect(await saved()).toBe(before);
    for(const [width,height] of [[320,740],[390,844],[768,1024]]){await page.setViewportSize({width,height});await comparison.scrollIntoViewIfNeeded();expect(await page.locator(`#${gameId}Screen`).evaluate(r=>r.scrollWidth<=r.clientWidth+2)).toBe(true);await shot(`${gameId}-${width}.png`);}
    await page.locator('[data-action=retry-mistakes]').click();expect((await state()).totalQuestions).toBe(2);expect((await state()).missed).toEqual([]);
    await answer(true);await next();await answer(true);await page.locator('.gt-result-details > summary').click();await expect(comparison).toBeHidden();await expect(comparison.locator('li')).toHaveCount(0);
    await page.getByRole('button',{name:'ミニゲーム広場へ',exact:true}).click();evidence.checks.push(`${gameId}: two mistakes retained after correct final answer, exact comparison, stable read-only display, retry clears comparison`);
  }
  evidence.checks.push('actual timed timeout displayed as unanswered','normal ten-question and short-review results','320/390/768px layout');expect(evidence.errors).toEqual([]);evidence.pass=true;
}finally{await fs.writeFile(new URL('results.json',out),JSON.stringify(evidence,null,2));await browser?.close();await server.close();}
console.log(JSON.stringify(evidence,null,2));
