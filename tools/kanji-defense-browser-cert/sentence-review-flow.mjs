import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDefaultSave } from '../../src/core/saveData.js';
import { launchPreferredBrowser } from './helpers.mjs';
const out = new URL('../../artifacts/sentence-review/browser/', import.meta.url);
await fs.mkdir(out, { recursive: true });
const server = await createServer({ configFile: false, server: { host: '127.0.0.1', port: 0, watch: null } });
await server.listen(); const base = server.resolvedUrls.local[0];
const evidence = { checks: [], errors: [] }; let browser;
try {
  const launched = await launchPreferredBrowser(chromium); browser = launched.browser; evidence.browser = launched.name;
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  const save = getDefaultSave(); save.player.name = '復習QA'; save.player.collection.gotomonIds = ['HKD-E01']; save.meta.compatibilityEntries = { tutorial_seen_title: '1' };
  await context.addInitScript(value => {
    if (sessionStorage.getItem('sentence-review-qa')) return;
    localStorage.setItem('krb_save', JSON.stringify(value)); localStorage.setItem('bgmVolume', '0'); localStorage.setItem('seVolume', '0'); sessionStorage.setItem('sentence-review-qa', '1');
  }, save);
  const page = await context.newPage(); page.on('pageerror', e => evidence.errors.push(e.message));
  const state = () => page.evaluate(() => window.fsm.currentState.inspect().session);
  const progress = () => page.evaluate(() => JSON.parse(localStorage.getItem('krb_save')).player.miniGames);
  const shot = name => page.screenshot({ path: fileURLToPath(new URL(name, out)), fullPage: true });
  const next = async () => { if ((await state()).phase === 'feedback') await page.locator('[data-action=next]').click(); };
  async function answer(correct) {
    let s = await state(); const id=s.problem.fixtureId;
    if (correct) for (let to=0;to<s.problem.chunks.length;to++) {
      const wanted=s.problem.correctOrder[to];
      while (s.currentOrder.indexOf(wanted)>to) {
        await page.locator(`[data-chunk-id="${wanted}"]`).click(); await page.locator('[data-action=move-left]').click(); s=await state();
      }
    }
    await page.locator('[data-action=submit]').click(); return id;
  }
  await page.goto(base); await page.locator('#titleMiniGameButton').click();
  await page.locator('.yt-game-card[data-game-id=sentenceOrder]').click(); await page.locator('[data-action=start-game]').click();
  const standardId=await answer(false); await page.locator('[data-action=back]').click();
  await page.locator('.yt-game-card[data-game-id=sentenceOrder]').click(); await page.getByLabel('文ならべのコース').selectOption('challenge'); await page.locator('[data-action=start-game]').click();
  const challengeId=await answer(false); await next();
  for(let i=1;i<10;i++){await answer(true);await next();}
  await expect(page.locator('[data-action=review]')).toContainText('2文');
  const normal=await progress();
  await page.locator('[data-action=review]').click(); expect((await state()).mode).toBe('review');
  await page.locator('[data-action=back]').click(); await page.reload(); await page.locator('#titleMiniGameButton').click();
  await page.getByRole('button',{name:'文を復習する：文ならべ',exact:true}).click();
  await expect(page.getByLabel('文ならべのコース')).toHaveCount(0); await page.locator('[data-action=start-game]').click();
  expect((await state()).totalQuestions).toBe(2);
  const reviewed=[];
  reviewed.push(await answer(true)); await expect(page.locator('.gt-sentence-explanation')).toBeVisible();
  await page.waitForTimeout(1100); expect((await state()).phase).toBe('feedback'); await shot('review-feedback.png'); await next();
  for(const [width,height] of [[320,740],[390,844],[768,1024]]) {
    await page.setViewportSize({width,height}); expect(await page.locator('#sentenceOrderScreen').evaluate(r=>r.scrollWidth<=r.clientWidth+2)).toBe(true); await shot(`review-${width}.png`);
  }
  reviewed.push(await answer(true)); expect(new Set(reviewed)).toEqual(new Set([standardId,challengeId]));
  await expect(page.locator('[data-action=review]')).toBeHidden();
  const after=await progress(); expect(after.games).toEqual(normal.games); expect(after.companions).toEqual(normal.companions); expect(after.hubActivity).toEqual(normal.hubActivity);
  await page.locator('.gt-result-details summary').click(); await expect(page.locator('.gt-sentence-explanation')).toBeVisible(); await shot('review-result.png');
  await page.getByRole('button',{name:'通常の10問であそぶ',exact:true}).click(); expect((await state()).mode).toBe('tenQuestions'); expect((await state()).totalQuestions).toBe(10);
  evidence.checks.push('interrupted standard mistake persists','challenge result review action','reload hub mixed review','manual next after correct answer with explanation','three viewport widths','review preserves growth, memories and records','normal ten-question replay');
  expect(evidence.errors).toEqual([]); evidence.pass=true;
} finally {
  await fs.writeFile(new URL('results.json',out),JSON.stringify(evidence,null,2)); await browser?.close(); await server.close();
}
console.log(JSON.stringify(evidence,null,2));
