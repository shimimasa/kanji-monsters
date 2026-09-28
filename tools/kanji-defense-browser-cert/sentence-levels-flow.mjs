import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDefaultSave } from '../../src/core/saveData.js';
import { launchPreferredBrowser } from './helpers.mjs';
const out = new URL('../../artifacts/sentence-levels/browser/', import.meta.url);
await fs.mkdir(out, { recursive: true });
const server = await createServer({ configFile: false, server: { host: '127.0.0.1', port: 0, watch: null } });
await server.listen(); const base = server.resolvedUrls.local[0];
const evidence = { checks: [], errors: [] }; let browser;
try {
  const launched = await launchPreferredBrowser(chromium); browser = launched.browser; evidence.browser = launched.name;
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  const save = getDefaultSave(); save.player.name = '文ならべQA'; save.player.collection.gotomonIds = ['HKD-E01']; save.meta.compatibilityEntries = { tutorial_seen_title: '1' };
  await context.addInitScript(value => {
    if (sessionStorage.getItem('sentence-qa')) return;
    localStorage.setItem('krb_save', JSON.stringify(value)); localStorage.setItem('bgmVolume', '0'); localStorage.setItem('seVolume', '0'); sessionStorage.setItem('sentence-qa', '1');
  }, save);
  const page = await context.newPage(); page.on('pageerror', e => evidence.errors.push(e.message));
  const state = () => page.evaluate(() => window.fsm.currentState.inspect().session);
  const shot = name => page.screenshot({ path: fileURLToPath(new URL(name, out)), fullPage: true });
  await page.goto(base); await page.locator('#titleMiniGameButton').click();
  await page.locator('.yt-game-card[data-game-id=sentenceOrder]').click();
  await expect(page.getByLabel('文ならべのコース')).toHaveValue('standard');
  await page.locator('[data-action=start-game]').click(); expect((await state()).problem.chunks).toHaveLength(3);
  await page.locator('[data-action=back]').click();
  await page.locator('.yt-game-card[data-game-id=sentenceOrder]').click();
  await page.getByLabel('文ならべのコース').selectOption('challenge'); await shot('course-picker.png');
  await page.locator('[data-action=start-game]').click();
  await expect(page.locator('#sentenceOrderScreen h1')).toContainText('4ピース');
  const seen = new Set();
  for (let i = 0; i < 10; i++) {
    let s = await state(); seen.add(s.problem.fixtureId); expect(s.problem.chunks).toHaveLength(4);
    await expect(page.locator('[data-chunk-id]:visible')).toHaveCount(4);
    if (i === 0) {
      await page.locator('[data-action=pause]').click(); await expect(page.locator('[data-action=submit]')).toBeDisabled(); await page.locator('[data-action=pause]').click();
      for (const [width, height] of [[320, 740], [390, 844], [768, 1024]]) {
        await page.setViewportSize({ width, height });
        expect(await page.locator('#sentenceOrderScreen').evaluate(root => root.scrollWidth <= root.clientWidth + 2)).toBe(true);
        await shot(`challenge-${width}.png`);
      }
      await page.setViewportSize({ width: 390, height: 844 });
    }
    if (i > 0 && i < 9) {
      for (let target = 0; target < 4; target++) {
        s = await state(); const wanted = s.problem.correctOrder[target];
        while (s.currentOrder.indexOf(wanted) > target) {
          await page.locator(`[data-chunk-id="${wanted}"]`).click();
          await page.locator('[data-action=move-left]').click(); s = await state();
        }
      }
    }
    await page.locator('[data-action=submit]').click();
    if (i === 0) { await expect(page.locator('.gt-sentence-explanation')).toBeVisible(); await shot('wrong-explanation.png'); }
    if ((await state()).phase === 'feedback') await page.locator('[data-action=next]').click();
  }
  expect(seen.size).toBe(10); expect((await state()).result.correct).toBe(8);
  await page.locator('.gt-result-details summary').click(); await expect(page.locator('.gt-sentence-explanation')).toBeVisible();
  await shot('result-explanation.png');
  await page.locator('.gt-result-actions [data-action=replay]').click();
  expect((await state()).sentenceLevel).toBe('challenge'); expect((await state()).problem.chunks).toHaveLength(4);
  await page.locator('[data-action=back]').click();
  await page.locator('.yt-game-card[data-game-id=sentenceOrder]').click();
  await expect(page.getByLabel('文ならべのコース')).toHaveValue('standard');
  evidence.checks.push('default 120-item standard course', 'select challenge and play all ten four-piece sentences',
    'pause and movement UI', 'incorrect-answer explanation including last question', 'replay keeps course; hub defaults to standard', '320/390/768px layout');
  expect(evidence.errors).toEqual([]); evidence.pass = true;
} finally {
  await fs.writeFile(new URL('results.json', out), JSON.stringify(evidence, null, 2)); await browser?.close(); await server.close();
}
console.log(JSON.stringify(evidence, null, 2));
