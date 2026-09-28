import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDefaultSave } from '../../src/core/saveData.js';
import { launchPreferredBrowser } from './helpers.mjs';

const out = new URL('../../artifacts/hub-recommendations/browser/', import.meta.url);
await fs.mkdir(out, { recursive: true });
const server = await createServer({ configFile: false, server: { host: '127.0.0.1', port: 0, watch: null } });
await server.listen(); const base = server.resolvedUrls.local[0];
const evidence = { checks: [], errors: [] }; let browser;
try {
  const launched = await launchPreferredBrowser(chromium); browser = launched.browser; evidence.browser = launched.name;
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  const save = getDefaultSave(); save.player.name = 'おすすめQA'; save.player.collection.gotomonIds = ['HKD-E01'];
  save.meta.compatibilityEntries = { tutorial_seen_title: '1' };
  await context.addInitScript(value => {
    if (sessionStorage.getItem('hub-qa')) return;
    localStorage.setItem('krb_save', JSON.stringify(value));
    localStorage.setItem('bgmVolume', '0'); localStorage.setItem('seVolume', '0'); sessionStorage.setItem('hub-qa', '1');
  }, save);
  const page = await context.newPage(); page.on('pageerror', e => evidence.errors.push(e.message));
  const state = () => page.evaluate(() => window.fsm.currentState.inspect().session);
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('krb_save')));
  async function start() { await page.locator('[data-action=start-game]').click(); await expect(page.locator('.yt-game')).toBeVisible(); }
  async function back() { await page.locator('[data-action=back]').click(); await expect(page.locator('#miniGameHub')).toBeVisible(); }
  await page.goto(base); await page.locator('#titleMiniGameButton').click();
  await expect(page.locator('[data-recommendation]')).toHaveCount(1);
  await page.locator('[data-recommendation=new]').click();
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  expect((await saved()).player.miniGames?.hubActivity).toBeUndefined();
  await page.locator('[data-recommendation=new]').focus(); await page.keyboard.press('Enter'); await start();
  expect((await state()).gameId).toBe('mathSprint'); await back();
  await expect(page.locator('[data-recommendation=recent]')).toContainText('けいさんスプリント');
  await expect(page.locator('[data-recommendation=new]')).toContainText('けいさんインベーダー');
  await page.reload(); await page.locator('#titleMiniGameButton').click();
  await expect(page.locator('[data-recommendation=recent]')).toContainText('はじめから');
  evidence.checks.push('first discovery; dialog cancel has no activity; keyboard start; recent persists on reload');
  await page.locator('.yt-game-card[data-game-id=englishChoice]').click(); await start();
  const s = await state(); const wrong = s.problem.choices.find(c => c.choiceId !== s.problem.correctChoiceId);
  await page.locator(`.ec-choice[data-choice-id="${wrong.choiceId}"]`).click(); await back();
  await expect(page.locator('[data-recommendation=review]')).toContainText('1語');
  await expect(page.locator('[data-recommendation=recent]')).toHaveCount(0);
  await page.locator('.yt-game-card[data-game-id=mathSprint]').click(); await start(); await back();
  await expect(page.locator('[data-recommendation]')).toHaveCount(3);
  const beforeReview = (await saved()).player.miniGames.hubActivity;
  await page.locator('[data-recommendation=review]').click(); await start();
  expect((await state()).mode).toBe('review'); await back();
  expect((await saved()).player.miniGames.hubActivity).toEqual(beforeReview);
  evidence.checks.push('review deduplicates recent English; three distinct suggestions; review preserves last normal game');
  for (const [width, height] of [[320, 740], [390, 844], [768, 1024], [1366, 768]]) {
    await page.setViewportSize({ width, height });
    expect(await page.locator('#miniGameHub').evaluate(root => root.scrollWidth <= root.clientWidth + 2)).toBe(true);
    for (const card of await page.locator('[data-recommendation]').all()) {
      const box = await card.boundingBox(); expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({ path: fileURLToPath(new URL(`hub-${width}.png`, out)), fullPage: true });
  }
  evidence.checks.push('320/390/768/1366px layout, accessible buttons, eight original cards retained');
  await expect(page.locator('.yt-game-card')).toHaveCount(8);
  expect((await saved()).player.miniGames.games).toEqual({});
  expect((await saved()).player.miniGames.companions).toEqual({});
  expect(evidence.errors).toEqual([]); evidence.pass = true;
} finally {
  await fs.writeFile(new URL('results.json', out), JSON.stringify(evidence, null, 2));
  await browser?.close(); await server.close();
}
console.log(JSON.stringify(evidence, null, 2));
