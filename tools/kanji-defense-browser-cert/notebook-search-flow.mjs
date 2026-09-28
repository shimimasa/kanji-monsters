import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDefaultSave } from '../../src/core/saveData.js';
import { launchPreferredBrowser } from './helpers.mjs';
const out=new URL('../../artifacts/notebook-search/browser/',import.meta.url);
await fs.mkdir(out,{recursive:true});
const server=await createServer({configFile:false,server:{host:'127.0.0.1',port:0,watch:null}});
await server.listen();const base=server.resolvedUrls.local[0],evidence={checks:[],errors:[]};let browser;
try{
  const launched=await launchPreferredBrowser(chromium);browser=launched.browser;evidence.browser=launched.name;
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
  const save=getDefaultSave();save.player.name='検索QA';save.player.collection.gotomonIds=['HKD-E01'];save.meta.compatibilityEntries={tutorial_seen_title:'1'};
  const item=correct=>({correct:correct?1:0,incorrect:correct?0:1,lastCorrect:correct,lastAnsweredAt:1});
  save.player.miniGames={version:1,games:{},companions:{},
    englishLearning:{version:1,recentAttempts:[],items:{apple:item(true),book:item(false)}},
    timedLearning:{version:1,recentAttempts:[],items:{anzen:{...item(false),timedOut:0,lastReason:'answer'}}},
    sentenceLearning:{version:1,recentAttempts:[],items:{'challenge-roof-snow':item(false)}}};
  await context.addInitScript(value=>{if(sessionStorage.getItem('search-qa'))return;localStorage.setItem('krb_save',JSON.stringify(value));localStorage.setItem('bgmVolume','0');localStorage.setItem('seVolume','0');sessionStorage.setItem('search-qa','1');},save);
  const page=await context.newPage();page.on('pageerror',e=>evidence.errors.push(e.message));
  const stored=()=>page.evaluate(()=>localStorage.getItem('krb_save'));
  const dialog=page.getByRole('dialog',{name:'学習ノート',exact:true});
  const search=page.getByRole('searchbox',{name:'記録した問題を検索'});
  const status=dialog.locator('.yt-search-status');
  const shot=name=>page.screenshot({path:fileURLToPath(new URL(name,out)),fullPage:true});
  await page.goto(base);await page.locator('#titleMiniGameButton').click();const before=await stored();
  await page.locator('[data-action=learning-notebook]').click();
  await search.fill('ＡＰＰＬＥ');await expect(status).toHaveText('検索結果 1語（復習 0・最後に正解 1）');
  await expect(dialog.locator('[data-content-id=apple]')).toBeVisible();await expect(dialog.locator('[data-content-id=book]')).toHaveCount(0);await expect(search).toBeFocused();
  await expect(dialog.locator('[data-action=notebook-review]')).toHaveCount(0);
  await search.fill('ﾘﾝｺﾞ');await expect(dialog.locator('[data-content-id=apple]')).toBeVisible();
  await search.fill('<script>');await expect(status).toContainText('検索結果 0語');await expect(dialog).toContainText('見つかりませんでした');
  await expect(dialog).not.toContainText('今、復習が必要な問題はありません。');
  await dialog.locator('[data-action=clear-notebook-search]').click();await expect(search).toHaveValue('');await expect(search).toBeFocused();await expect(dialog.locator('[data-action=notebook-review]')).toBeVisible();
  // During IME composition the current list stays stable until composition ends.
  await search.dispatchEvent('compositionstart');await search.evaluate(el=>{el.value='本';el.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));});
  await expect(status).toHaveCount(0);await search.dispatchEvent('compositionend');await expect(status).toContainText('検索結果 1語');
  await page.getByLabel('学習ノートのゲーム').selectOption('timedChoice');await expect(search).toHaveValue('');
  await search.fill('ｱﾝｾﾞﾝ');await expect(dialog.locator('[data-content-id=anzen]')).toBeVisible();
  await page.getByLabel('学習ノートのゲーム').selectOption('sentenceOrder');await search.fill('屋根 ４ピース');await expect(status).toContainText('検索結果 1文');
  for(const [width,height] of [[320,740],[390,844],[768,1024]]){
    await page.setViewportSize({width,height});expect(await dialog.evaluate(r=>r.scrollWidth<=r.clientWidth+2)).toBe(true);await dialog.evaluate(r=>{r.scrollTop=0;});await shot(`search-${width}.png`);
  }
  expect(await stored()).toBe(before);
  await dialog.locator('[data-action=practice-one]').click();await page.locator('[data-action=start-game]').click();
  const state=await page.evaluate(()=>window.fsm.currentState.inspect().session);
  expect(state.mode).toBe('review');expect(state.totalQuestions).toBe(1);expect(state.problem.fixtureId).toBe('challenge-roof-snow');
  await page.locator('[data-action=back]').click();await page.locator('[data-action=learning-notebook]').click();await expect(search).toHaveValue('');
  evidence.checks.push('width and case normalization','meaning and kana search','correct items automatically visible','no-match state and clear with focus','IME composition','game switch resets query','sentence fragment and piece count','read-only search','filtered single practice','reopen reset','320/390/768px layout');
  expect(evidence.errors).toEqual([]);evidence.pass=true;
}finally{await fs.writeFile(new URL('results.json',out),JSON.stringify(evidence,null,2));await browser?.close();await server.close();}
console.log(JSON.stringify(evidence,null,2));
