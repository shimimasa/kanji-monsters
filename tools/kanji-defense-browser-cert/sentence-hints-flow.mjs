import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDefaultSave } from '../../src/core/saveData.js';
import { launchPreferredBrowser } from './helpers.mjs';
const out=new URL('../../artifacts/sentence-hints/browser/',import.meta.url);
await fs.mkdir(out,{recursive:true});
const server=await createServer({configFile:false,server:{host:'127.0.0.1',port:0,watch:null}});
await server.listen();const base=server.resolvedUrls.local[0],evidence={checks:[],errors:[]};let browser;
try{
  const launched=await launchPreferredBrowser(chromium);browser=launched.browser;evidence.browser=launched.name;
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  const save=getDefaultSave();save.player.name='ヒントQA';save.player.collection.gotomonIds=['HKD-E01'];save.meta.compatibilityEntries={tutorial_seen_title:'1'};
  const item={correct:0,incorrect:1,lastCorrect:false,lastAnsweredAt:1};
  save.player.miniGames={version:1,games:{},companions:{},sentenceLearning:{version:1,recentAttempts:[],items:{'library-book':item,'challenge-roof-snow':item}}};
  await context.addInitScript(value=>{if(sessionStorage.getItem('hint-qa'))return;localStorage.setItem('krb_save',JSON.stringify(value));localStorage.setItem('bgmVolume','0');localStorage.setItem('seVolume','0');sessionStorage.setItem('hint-qa','1');},save);
  const page=await context.newPage();page.on('pageerror',e=>evidence.errors.push(e.message));
  const state=()=>page.evaluate(()=>window.fsm.currentState.inspect().session);
  const saved=()=>page.evaluate(()=>localStorage.getItem('krb_save'));
  const hint=page.locator('[data-action=sentence-hint]'),text=page.locator('.so-hints [role=status]');
  const shot=name=>page.screenshot({path:fileURLToPath(new URL(name,out)),fullPage:true});
  async function solve(){
    let s=await state();for(let to=0;to<s.problem.correctOrder.length;to++){
      const chunk=s.problem.correctOrder[to];while(s.currentOrder.indexOf(chunk)>to){await page.locator(`[data-chunk-id="${chunk}"]`).click();await page.locator('[data-action=move-left]').click();s=await state();}
    }
    await page.locator('[data-action=submit]').click();
  }
  await page.goto(base);await page.locator('#titleMiniGameButton').click();await page.locator('[data-action=learning-notebook]').click();await page.getByLabel('学習ノートのゲーム').selectOption('sentenceOrder');await page.locator('[data-action=notebook-review]').click();await page.locator('[data-action=start-game]').click();
  expect((await state()).totalQuestions).toBe(2);
  for(let i=0;i<2;i++){
    const before=await state(),beforeSave=await saved(),first=before.problem.correctOrder[0],last=before.problem.correctOrder.at(-1);
    expect(before.problem.chunks.length).toBe(i===0?3:4);await expect(hint).toHaveText('ヒント：はじめの言葉');await expect(page.locator('[data-hint=first], [data-hint=last]')).toHaveCount(0);
    await page.locator('[data-action=pause]').click();await expect(hint).toBeDisabled();await page.locator('[data-action=pause]').click();
    await hint.focus();await page.keyboard.press('Enter');await expect(hint).toHaveText('ヒント：おわりの言葉');
    await expect(text).toContainText(before.problem.chunks.find(c=>c.chunkId===first).text);await expect(page.locator('[data-hint=first]')).toHaveAttribute('data-chunk-id',first);
    await page.keyboard.press('Space');await expect(hint).toBeDisabled();await expect(page.locator('[data-hint=last]')).toHaveAttribute('data-chunk-id',last);
    const after=await state();for(const key of ['answered','correct','incorrect','attemptId','seq','currentOrder'])expect(after[key]).toEqual(before[key]);expect(await saved()).toBe(beforeSave);
    if(i===0){
      // Hints follow piece identities when a piece changes position.
      await page.locator(`[data-chunk-id="${first}"]`).click();const direction=after.currentOrder.indexOf(first)===0?'right':'left';await page.locator(`[data-action=move-${direction}]`).click();await expect(page.locator('[data-hint=first]')).toHaveAttribute('data-chunk-id',first);
    }
    for(const [width,height] of [[320,740],[390,844],[768,1024]]){
      await page.setViewportSize({width,height});expect(await page.locator('#sentenceOrderScreen').evaluate(r=>r.scrollWidth<=r.clientWidth+2)).toBe(true);await shot(`hint-${i+1}-${width}.png`);
    }
    await solve();expect((await state()).correct).toBe(i+1);
    if(i===0){await expect(hint).toBeDisabled();await page.waitForTimeout(700);expect((await state()).phase).toBe('feedback');await page.locator('[data-action=next]').click();}
  }
  expect((await state()).result.correct).toBe(2);
  await page.getByRole('button',{name:'通常の10問であそぶ',exact:true}).click();await expect(hint).toBeHidden();
  await hint.evaluate(el=>el.click());expect((await state()).answered).toBe(0);await expect(page.locator('[data-hint=first], [data-hint=last]')).toHaveCount(0);
  await page.locator('[data-action=back]').click();await page.locator('.yt-game-card[data-game-id=sentenceOrder]').click();await page.getByLabel('文ならべのコース').selectOption('challenge');await page.locator('[data-action=start-game]').click();await expect(hint).toBeHidden();
  evidence.checks.push('three/four-piece progressive hints','Enter and Space reveal hints without submitting','hint clicks leave core and save unchanged','pause and feedback gates','piece marker follows reorder','next problem resets hints','both normal courses hide hints','320/390/768px layout');expect(evidence.errors).toEqual([]);evidence.pass=true;
}finally{await fs.writeFile(new URL('results.json',out),JSON.stringify(evidence,null,2));await browser?.close();await server.close();}
console.log(JSON.stringify(evidence,null,2));
