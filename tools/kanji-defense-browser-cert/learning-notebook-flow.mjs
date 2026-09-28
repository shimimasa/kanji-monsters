import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDefaultSave } from '../../src/core/saveData.js';
import { learningBanks } from '../../src/minigames/learningNotebook.js';
import { launchPreferredBrowser } from './helpers.mjs';
const out=new URL('../../artifacts/learning-notebook/browser/',import.meta.url);
await fs.mkdir(out,{recursive:true});
const server=await createServer({configFile:false,server:{host:'127.0.0.1',port:0,watch:null}});
await server.listen(); const base=server.resolvedUrls.local[0];
const evidence={checks:[],errors:[]};let browser;
try {
  const launched=await launchPreferredBrowser(chromium);browser=launched.browser;evidence.browser=launched.name;
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  const save=getDefaultSave();save.player.name='ノートQA';save.player.collection.gotomonIds=['HKD-E01'];save.meta.compatibilityEntries={tutorial_seen_title:'1'};
  const item=(correct,at)=>({correct:correct?1:0,incorrect:correct?0:1,lastCorrect:correct,lastAnsweredAt:at});
  save.player.miniGames={version:1,games:{},companions:{},
    englishLearning:{version:1,recentAttempts:[],items:Object.fromEntries(learningBanks[0].entries.slice(0,14).map((e,i)=>[e.id,item(i===13,i+1)]))},
    timedLearning:{version:1,recentAttempts:[],items:{anzen:{...item(false,1),incorrect:0,timedOut:1,lastReason:'timeout'}}},
    sentenceLearning:{version:1,recentAttempts:[],items:Object.fromEntries([learningBanks[2].entries[0],learningBanks[2].entries[120]].map(e=>[e.id,item(false,1)]))},
  };
  await context.addInitScript(value=>{
    if(sessionStorage.getItem('notebook-qa'))return;
    localStorage.setItem('krb_save',JSON.stringify(value));localStorage.setItem('bgmVolume','0');localStorage.setItem('seVolume','0');sessionStorage.setItem('notebook-qa','1');
  },save);
  const page=await context.newPage();page.on('pageerror',e=>evidence.errors.push(e.message));
  const snapshot=()=>page.evaluate(()=>window.fsm.currentState.inspect().session);
  const stored=()=>page.evaluate(()=>localStorage.getItem('krb_save'));
  const open=async()=>{await page.locator('[data-action=learning-notebook]').click();await expect(page.getByRole('dialog',{name:'学習ノート',exact:true})).toBeVisible();};
  const dialog=page.getByRole('dialog',{name:'学習ノート',exact:true});
  const shot=name=>page.screenshot({path:fileURLToPath(new URL(name,out)),fullPage:true});
  await page.goto(base);await page.locator('#titleMiniGameButton').click(); const before=await stored();await open();
  await expect(dialog).toContainText('復習する 13語 · 最後に正解 1語');await expect(dialog.locator('[data-action=notebook-review]')).toHaveText('復習する（今回10語）');
  await expect(dialog.locator('li:visible')).toHaveCount(13);
  await dialog.locator('summary').click();await expect(dialog.locator('li:visible')).toHaveCount(14);
  for(const [width,height] of [[320,740],[390,844],[768,1024]]){
    await page.setViewportSize({width,height});expect(await dialog.evaluate(r=>r.scrollWidth<=r.clientWidth+2)).toBe(true);
    await dialog.evaluate(r=>{r.scrollTop=0;});await shot(`notebook-${width}.png`);
  }
  await page.getByLabel('学習ノートのゲーム').selectOption('timedChoice');await expect(dialog).toContainText('前回は時間切れ');await expect(dialog).toContainText('あんぜん');
  await page.getByLabel('学習ノートのゲーム').selectOption('sentenceOrder');await expect(dialog).toContainText('3ピース');await expect(dialog).toContainText('4ピース');
  expect(await stored()).toBe(before);await page.keyboard.press('Escape');await expect(page.locator('[data-action=learning-notebook]')).toBeFocused();
  await open();await page.getByLabel('学習ノートのゲーム').selectOption('timedChoice');await dialog.locator('[data-action=notebook-review]').click();
  await page.locator('[data-action=start-game]').click();let s=await snapshot();expect(s.mode).toBe('review');expect(s.totalQuestions).toBe(1);
  await page.locator(`[data-choice-id="${s.problem.correctChoiceId}"]`).click();
  await page.getByRole('button',{name:'ミニゲーム広場へ',exact:true}).click();await open();await page.getByLabel('学習ノートのゲーム').selectOption('timedChoice');
  await expect(dialog).toContainText('復習する 0語 · 最後に正解 1語');await expect(dialog.locator('[data-action=notebook-review]')).toHaveCount(0);await shot('corrected.png');
  await page.keyboard.press('Escape');await page.reload();await page.locator('#titleMiniGameButton').click();await open();await page.getByLabel('学習ノートのゲーム').selectOption('timedChoice');await expect(dialog).toContainText('最後に正解 1語');
  // A fresh profile can read an empty notebook without owning a companion.
  const empty=await browser.newContext();await empty.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  const emptySave=getDefaultSave();emptySave.meta.compatibilityEntries={tutorial_seen_title:'1'};
  await empty.addInitScript(value=>{localStorage.setItem('krb_save',JSON.stringify(value));},emptySave);
  const emptyPage=await empty.newPage();await emptyPage.goto(base);await emptyPage.locator('#titleMiniGameButton').click();await emptyPage.locator('[data-action=learning-notebook]').click();
  await expect(emptyPage.getByRole('dialog',{name:'学習ノート',exact:true})).toContainText('まだ記録なし 120語');await expect(emptyPage.locator('[data-action=notebook-review]')).toHaveCount(0);await empty.close();
  evidence.checks.push('all 13 mistakes visible; batch capped at ten','read-only viewing','three banks and timeout explanation','Escape restores focus','start review and corrected item moves to latest-correct list','reload persistence','320/390/768px layout','empty profile without companion');
  expect(evidence.errors).toEqual([]);evidence.pass=true;
}finally{await fs.writeFile(new URL('results.json',out),JSON.stringify(evidence,null,2));await browser?.close();await server.close();}
console.log(JSON.stringify(evidence,null,2));
