import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDefaultSave } from '../../src/core/saveData.js';
import { launchPreferredBrowser } from './helpers.mjs';
const out=new URL('../../artifacts/sentence-comparison/browser/',import.meta.url);
await fs.mkdir(out,{recursive:true});
const server=await createServer({configFile:false,server:{host:'127.0.0.1',port:0,watch:null}});
await server.listen();const base=server.resolvedUrls.local[0],evidence={checks:[],errors:[]};let browser;
try{
  const launched=await launchPreferredBrowser(chromium);browser=launched.browser;evidence.browser=launched.name;
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  const save=getDefaultSave();save.player.name='文の比較QA';save.player.collection.gotomonIds=['HKD-E01'];save.meta.compatibilityEntries={tutorial_seen_title:'1'};
  const item={correct:0,incorrect:1,lastCorrect:false,lastAnsweredAt:1};
  save.player.miniGames={version:1,games:{},companions:{},sentenceLearning:{version:1,recentAttempts:[],items:{'library-book':item,'challenge-roof-snow':item,'challenge-garden-flower':item}}};
  await context.addInitScript(value=>{if(sessionStorage.getItem('comparison-qa'))return;localStorage.setItem('krb_save',JSON.stringify(value));localStorage.setItem('bgmVolume','0');localStorage.setItem('seVolume','0');sessionStorage.setItem('comparison-qa','1');},save);
  const page=await context.newPage();page.on('pageerror',e=>evidence.errors.push(e.message));
  const state=()=>page.evaluate(()=>window.fsm.currentState.inspect().session),saved=()=>page.evaluate(()=>localStorage.getItem('krb_save'));
  const shot=name=>page.screenshot({path:fileURLToPath(new URL(name,out)),fullPage:true});
  async function solve(){let s=await state();for(let to=0;to<s.problem.correctOrder.length;to++){const chunk=s.problem.correctOrder[to];while(s.currentOrder.indexOf(chunk)>to){await page.locator(`[data-chunk-id="${chunk}"]`).click();await page.locator('[data-action=move-left]').click();s=await state();}}await page.locator('[data-action=submit]').click();}
  await page.goto(base);await page.locator('#titleMiniGameButton').click();await page.locator('[data-action=learning-notebook]').click();await page.getByLabel('学習ノートのゲーム').selectOption('sentenceOrder');await page.locator('[data-action=notebook-review]').click();await page.locator('[data-action=start-game]').click();
  for(let i=0;i<3;i++){if(i<2)await page.locator('[data-action=submit]').click();else await solve();if((await state()).phase==='feedback')await page.locator('[data-action=next]').click();}
  const final=await state();expect(final.result.correct).toBe(1);expect(final.lastAnswer.correct).toBe(true);expect(final.missed).toHaveLength(2);
  const beforeView=await saved();await page.locator('.gt-result-details > summary').click();await expect(page.getByRole('region',{name:'今回まちがえた文の比較',exact:true})).toBeVisible();
  await expect(page.locator('[data-missed-content]')).toHaveCount(2);
  for(const item of final.missed){
    const row=page.locator(`[data-missed-content="${item.contentId}"]`);
    await expect(row).toContainText(`第${item.questionNumber}問`);await expect(row.locator('.so-missed-explanation')).toHaveText(item.explanation);
    const submitted=row.getByRole('list',{name:'あなたの並び',exact:true}),correct=row.getByRole('list',{name:'正しい並び',exact:true});
    for(let i=0;i<item.correctParts.length;i++){
      await expect(submitted.locator('li').nth(i)).toContainText(`${i+1}. ${item.submittedParts[i]}`);await expect(correct.locator('li').nth(i)).toHaveText(`${i+1}. ${item.correctParts[i]}`);
      expect(await submitted.locator('li').nth(i).evaluate(el=>el.classList.contains('so-order-difference'))).toBe(item.submittedParts[i]!==item.correctParts[i]);
    }
  }
  await page.locator('.so-missed').evaluate(el=>{window.qaComparisonNode=el.querySelector('[data-missed-content]');});await page.waitForTimeout(700);
  expect(await page.locator('.so-missed').evaluate(el=>el.querySelector('[data-missed-content]')===window.qaComparisonNode)).toBe(true);expect(await saved()).toBe(beforeView);
  for(const [width,height] of [[320,740],[390,844],[768,1024]]){await page.setViewportSize({width,height});await page.locator('[data-missed-content]').first().scrollIntoViewIfNeeded();expect(await page.locator('#sentenceOrderScreen').evaluate(r=>r.scrollWidth<=r.clientWidth+2)).toBe(true);await shot(`comparison-${width}.png`);}
  await page.locator('[data-action=retry-mistakes]').click();expect((await state()).totalQuestions).toBe(2);expect((await state()).missed).toEqual([]);
  for(let i=0;i<2;i++){await solve();if((await state()).phase==='feedback')await page.locator('[data-action=next]').click();}
  await page.locator('.gt-result-details > summary').click();await expect(page.locator('.so-missed')).toBeHidden();await expect(page.locator('[data-missed-content]')).toHaveCount(0);await expect(page.locator('[data-action=retry-mistakes]')).toBeHidden();
  evidence.checks.push('three/four-piece mistakes remain after correct final answer','exact submitted/correct text and positional markers','per-item explanations','read-only result view','stable result DOM across updates','retry collects only the two wrong sentences','all-correct retry clears comparison','320/390/768px layout');expect(evidence.errors).toEqual([]);evidence.pass=true;
}finally{await fs.writeFile(new URL('results.json',out),JSON.stringify(evidence,null,2));await browser?.close();await server.close();}
console.log(JSON.stringify(evidence,null,2));
