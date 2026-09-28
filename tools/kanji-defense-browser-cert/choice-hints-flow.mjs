import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDefaultSave } from '../../src/core/saveData.js';
import { launchPreferredBrowser } from './helpers.mjs';
const out=new URL('../../artifacts/choice-hints/browser/',import.meta.url);
await fs.mkdir(out,{recursive:true});
const server=await createServer({configFile:false,server:{host:'127.0.0.1',port:0,watch:null}});
await server.listen();const base=server.resolvedUrls.local[0],evidence={checks:[],errors:[]};let browser;
try{
  const launched=await launchPreferredBrowser(chromium);browser=launched.browser;evidence.browser=launched.name;
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  const save=getDefaultSave();save.player.name='2択QA';save.player.collection.gotomonIds=['HKD-E01'];save.meta.compatibilityEntries={tutorial_seen_title:'1'};
  const item={correct:0,incorrect:1,lastCorrect:false,lastAnsweredAt:1};
  save.player.miniGames={version:1,games:{},companions:{},englishLearning:{version:1,recentAttempts:[],items:{apple:item,book:item}},timedLearning:{version:1,recentAttempts:[],items:{anzen:{...item,timedOut:0,lastReason:'answer'},kibou:{...item,timedOut:0,lastReason:'answer'}}}};
  await context.addInitScript(value=>{if(sessionStorage.getItem('choice-hint-qa'))return;localStorage.setItem('krb_save',JSON.stringify(value));localStorage.setItem('bgmVolume','0');localStorage.setItem('seVolume','0');sessionStorage.setItem('choice-hint-qa','1');},save);
  const page=await context.newPage();page.on('pageerror',e=>evidence.errors.push(e.message));
  const state=()=>page.evaluate(()=>window.fsm.currentState.inspect().session),saved=()=>page.evaluate(()=>localStorage.getItem('krb_save'));
  const hint=page.locator('[data-action=choice-hint]');
  const shot=name=>page.screenshot({path:fileURLToPath(new URL(name,out)),fullPage:true});
  await page.goto(base);await page.locator('#titleMiniGameButton').click();
  for(const [gameId,screen,prefix] of [['englishChoice','englishChoiceScreen','ec'],['timedChoice','timedChoiceScreen','tc']]){
    await page.locator('[data-action=learning-notebook]').click();await page.getByLabel('学習ノートのゲーム').selectOption(gameId);await page.locator('[data-action=notebook-review]').click();await page.locator('[data-action=start-game]').click();
    const choices=page.locator(`.${prefix}-choice`);
    for(let q=0;q<2;q++){
      const before=await state(),beforeSave=await saved();await expect(choices.filter({visible:true})).toHaveCount(4);await expect(hint).toHaveText('ヒント：2つにしぼる');
      await page.locator('[data-action=pause]').click();await expect(hint).toBeDisabled();await page.locator('[data-action=pause]').click();
      await hint.focus();await page.keyboard.press(q===0?'Enter':'Space');await expect(hint).toBeDisabled();await expect(page.locator(`.${prefix}-choice:visible`)).toHaveCount(2);
      await expect(page.locator(`[data-choice-id="${before.problem.correctChoiceId}"]`)).toBeVisible();
      const after=await state();for(const key of ['answered','correct','incorrect','attemptId','seq'])expect(after[key]).toEqual(before[key]);expect(await saved()).toBe(beforeSave);
      // Excluded choices cannot be submitted by keyboard or a synthetic click.
      const excluded=page.locator(`.${prefix}-choice[hidden]`).first(),key=await excluded.getAttribute('data-choice-index');
      await page.locator('[data-role=problem]').click();await page.keyboard.press(key);await excluded.evaluate(el=>el.dispatchEvent(new MouseEvent('click',{bubbles:true})));
      expect((await state()).answered).toBe(q);expect(await saved()).toBe(beforeSave);
      if(q===0){
        for(const [width,height] of [[320,740],[390,844],[768,1024]]){await page.setViewportSize({width,height});expect(await page.locator(`#${screen}`).evaluate(r=>r.scrollWidth<=r.clientWidth+2)).toBe(true);await shot(`${gameId}-${width}.png`);}
        const retained=await page.locator(`.${prefix}-choice:visible`).evaluateAll(nodes=>nodes.map(n=>n.dataset.choiceId));
        const wrong=retained.find(id=>id!==before.problem.correctChoiceId);await page.locator(`[data-choice-id="${wrong}"]`).click();expect((await state()).incorrect).toBe(1);await expect(hint).toBeDisabled();await page.locator('[data-action=next]').click();
      }else{
        const answer=page.locator(`[data-choice-id="${before.problem.correctChoiceId}"]`),number=await answer.getAttribute('data-choice-index');
        await page.locator('[data-role=problem]').click();await page.keyboard.press(number);expect((await state()).result.correct).toBe(1);
      }
    }
    await page.getByRole('button',{name:'通常の10問であそぶ',exact:true}).click();await expect(hint).toBeHidden();await expect(page.locator(`.${prefix}-choice:visible`)).toHaveCount(4);await hint.evaluate(el=>el.click());await expect(page.locator(`.${prefix}-choice:visible`)).toHaveCount(4);
    if(gameId==='timedChoice')expect((await state()).deadlineMs).toBe(5000);
    await page.locator('[data-action=back]').click();evidence.checks.push(`${gameId}: pause, keyboard reveal, two candidates with correct retained, excluded input blocked, wrong/correct scoring, reset and normal replay`);
  }
  evidence.checks.push('hint does not change core or save','320/390/768px layout');expect(evidence.errors).toEqual([]);evidence.pass=true;
}finally{await fs.writeFile(new URL('results.json',out),JSON.stringify(evidence,null,2));await browser?.close();await server.close();}
console.log(JSON.stringify(evidence,null,2));
