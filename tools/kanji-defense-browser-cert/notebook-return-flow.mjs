import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDefaultSave } from '../../src/core/saveData.js';
import { launchPreferredBrowser } from './helpers.mjs';
const out=new URL('../../artifacts/notebook-return/browser/',import.meta.url);
await fs.mkdir(out,{recursive:true});
const server=await createServer({configFile:false,server:{host:'127.0.0.1',port:0,watch:null}});
await server.listen();const base=server.resolvedUrls.local[0],evidence={checks:[],errors:[]};let browser;
try{
  const launched=await launchPreferredBrowser(chromium);browser=launched.browser;evidence.browser=launched.name;
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  const save=getDefaultSave();save.player.name='ノート復帰QA';save.player.collection.gotomonIds=['HKD-E01'];save.meta.compatibilityEntries={tutorial_seen_title:'1'};
  const item=correct=>({correct:correct?1:0,incorrect:correct?0:1,lastCorrect:correct,lastAnsweredAt:1});
  save.player.miniGames={version:1,games:{},companions:{},
    englishLearning:{version:1,recentAttempts:[],items:{apple:item(false),red:item(true)}},
    timedLearning:{version:1,recentAttempts:[],items:{kibou:{...item(false),timedOut:0,lastReason:'answer'},yuujou:{...item(true),timedOut:0,lastReason:'answer'}}},
    sentenceLearning:{version:1,recentAttempts:[],items:{'challenge-roof-snow':item(false),'library-book':item(true)}}};
  await context.addInitScript(value=>{if(sessionStorage.getItem('return-qa'))return;localStorage.setItem('krb_save',JSON.stringify(value));localStorage.setItem('bgmVolume','0');localStorage.setItem('seVolume','0');sessionStorage.setItem('return-qa','1');},save);
  const page=await context.newPage();page.on('pageerror',e=>evidence.errors.push(e.message));
  const state=()=>page.evaluate(()=>window.fsm.currentState.inspect().session);
  const dialog=page.getByRole('dialog',{name:'学習ノート',exact:true}),search=page.getByRole('searchbox',{name:'記録した問題を検索'});
  const shot=name=>page.screenshot({path:fileURLToPath(new URL(name,out)),fullPage:true});
  async function answer(){
    let s=await state();
    if(s.gameId==='sentenceOrder'){
      for(let to=0;to<s.problem.correctOrder.length;to++){
        const chunk=s.problem.correctOrder[to];while(s.currentOrder.indexOf(chunk)>to){await page.locator(`[data-chunk-id="${chunk}"]`).click();await page.locator('[data-action=move-left]').click();s=await state();}
      }
      await page.locator('[data-action=submit]').click();
    }else await page.locator(`[data-choice-id="${s.problem.correctChoiceId}"]`).click();
  }
  await page.goto(base);await page.locator('#titleMiniGameButton').click();
  for(const [gameId,query] of [['englishChoice','Ｅ'],['timedChoice','ウ'],['sentenceOrder','ピース']]){
    await page.locator('[data-action=learning-notebook]').click();await page.getByLabel('学習ノートのゲーム').selectOption(gameId);await search.fill(query);
    await dialog.locator('[data-action=practice-search]').click();await page.locator('[data-action=start-game]').click();expect((await state()).totalQuestions).toBe(2);
    await answer();if((await state()).phase==='feedback')await page.locator('[data-action=next]').click();
    if(gameId==='englishChoice')await page.evaluate(()=>{window.qaSet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='krb_save')throw new DOMException('quota','QuotaExceededError');return window.qaSet.call(this,key,value);};});
    await answer();
    const back=page.locator('[data-action=return-notebook]');
    if(gameId==='englishChoice'){
      await expect(back).toBeDisabled();await expect(page.locator('.gt-reward')).toContainText('保存できませんでした');
      await page.evaluate(()=>{Storage.prototype.setItem=window.qaSet;delete window.qaSet;});await page.getByRole('button',{name:'記録の保存を再試行',exact:true}).click();
    }
    await expect(back).toBeEnabled();
    for(const [width,height] of [[320,740],[390,844],[768,1024]])if(gameId==='englishChoice'){
      await page.setViewportSize({width,height});expect(await page.locator('#englishChoiceScreen').evaluate(r=>r.scrollWidth<=r.clientWidth+2)).toBe(true);await shot(`result-${width}.png`);
    }
    await back.click();await expect(dialog).toBeVisible();await expect(search).toHaveValue(query);await expect(page.getByLabel('学習ノートのゲーム')).toHaveValue(gameId);
    await expect(dialog.locator('.yt-search-status')).toContainText('復習 0・最後に正解 2');await expect(dialog.locator('li:visible')).toHaveCount(2);
    await shot(`${gameId}-returned.png`);await page.keyboard.press('Escape');await expect(page.locator('[data-action=learning-notebook]')).toBeFocused();
    evidence.checks.push(`${gameId}: filtered batch returns to same game and query with updated history`);
  }
  // A correct single item with no query restores the expanded list too.
  await page.locator('[data-action=learning-notebook]').click();await dialog.locator('summary').click();await dialog.locator('[data-content-id=apple] [data-action=practice-one]').click();await page.locator('[data-action=start-game]').click();await answer();
  await page.locator('[data-action=return-notebook]').click();await expect(search).toHaveValue('');await expect(dialog.locator('[data-content-id=apple]')).toBeVisible();
  await dialog.locator('[data-content-id=apple] [data-action=practice-one]').click();await page.locator('[data-action=start-game]').click();await answer();
  await page.getByRole('button',{name:'通常の10問であそぶ',exact:true}).click();await expect(page.locator('[data-action=return-notebook]')).toBeHidden();
  await page.locator('[data-action=back]').click();await expect(dialog).toHaveCount(0);await page.locator('[data-action=learning-notebook]').click();await expect(search).toHaveValue('');
  evidence.checks.push('save failure disables return until retry','correct-list expansion restored','normal replay clears notebook context','ordinary hub navigation remains unchanged','320/390/768px result layout');expect(evidence.errors).toEqual([]);evidence.pass=true;
}finally{await fs.writeFile(new URL('results.json',out),JSON.stringify(evidence,null,2));await browser?.close();await server.close();}
console.log(JSON.stringify(evidence,null,2));
