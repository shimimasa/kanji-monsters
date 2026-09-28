import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDefaultSave } from '../../src/core/saveData.js';
import { launchPreferredBrowser } from './helpers.mjs';
const out = new URL('../../artifacts/constellation-challenge/browser/', import.meta.url);
await fs.mkdir(out, { recursive: true });
const server = await createServer({ configFile: false, server: { host: '127.0.0.1', port: 0, watch: null } });
await server.listen(); const base = server.resolvedUrls.local[0];
const evidence = { checks: [], errors: [] }; let browser;
try {
  const launched = await launchPreferredBrowser(chromium); browser = launched.browser; evidence.browser = launched.name;
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  const save = getDefaultSave(); save.player.name = '星座目標QA'; save.player.collection.gotomonIds = ['HKD-E01'];
  save.meta.compatibilityEntries = { tutorial_seen_title: '1' };
  await context.addInitScript(value => {
    if (sessionStorage.getItem('star-qa')) return;
    localStorage.setItem('krb_save', JSON.stringify(value)); localStorage.setItem('bgmVolume', '0'); localStorage.setItem('seVolume', '0'); sessionStorage.setItem('star-qa', '1');
  }, save);
  const page = await context.newPage(); page.on('pageerror', e => evidence.errors.push(e.message));
  const inspect = () => page.evaluate(() => window.fsm.currentState.inspect());
  const shot = name => page.screenshot({ path: fileURLToPath(new URL(name, out)), fullPage: true });
  async function choose(id) {
    await page.locator('.gt-goal-picker summary').click();
    await page.locator(`[data-world-action=star-goal-${id}]`).click();
    expect((await inspect()).play.world.challenge.id).toBe(id);
    await page.locator('.gt-goal-picker summary').click();
  }
  async function answer(partial = false) {
    const { session: s } = await inspect();
    for (const id of s.problem.correctChoiceIds.slice(0, partial ? 2 : 3)) await page.locator(`.ms-choice[data-choice-id="${id}"]`).click();
    await page.locator('[data-action=submit]').click();
    if ((await inspect()).session.phase === 'feedback') await page.locator('[data-action=next]').click();
  }
  await page.goto(base); await page.locator('#titleMiniGameButton').click();
  await page.locator('.yt-game-card[data-game-id=multiSelect]').click(); await page.locator('[data-action=start-game]').click();
  await expect(page.locator('#multiSelectScreen')).toBeVisible();
  await choose('arc'); expect((await inspect()).play.world.route).toBe(0);
  await page.locator('.gt-goal-picker summary').click(); await shot('goal-picker-390.png');
  await page.locator('[data-action=pause]').click();
  await expect(page.locator('[data-world-action=star-goal-crown]')).toBeDisabled();
  await page.locator('[data-action=pause]').click(); await page.locator('.gt-goal-picker summary').click();
  for (const [width, height] of [[320, 740], [390, 844], [768, 1024]]) {
    await page.setViewportSize({ width, height });
    expect(await page.locator('#multiSelectScreen').evaluate(root => root.scrollWidth <= root.clientWidth + 2)).toBe(true);
    await shot(`playing-${width}.png`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (let i = 0; i < 4; i++) await answer(true);
  expect((await inspect()).play.world.challenge.status).toBe('achieved');
  expect((await inspect()).session.partial).toBe(4);
  await page.locator('.gt-goal-picker summary').click();
  await expect(page.locator('[data-world-action=star-goal-crown]')).toBeDisabled();
  await page.locator('.gt-goal-picker summary').click();
  for (let i = 4; i < 10; i++) await answer();
  await expect(page.locator('.gt-challenge-result')).toContainText('目標達成'); await shot('achieved-result.png');
  await page.locator('.gt-result-actions [data-action=replay]').click();
  expect((await inspect()).play.world.challenge.status).toBe('active');
  await choose('spread');
  for (let i = 0; i < 10; i++) await answer();
  await expect(page.locator('.gt-challenge-result')).toContainText('次の挑戦');
  await expect(page.locator('.gt-result > .gt-replay-goal')).toContainText('別の星座へ'); await shot('missed-result.png');
  await page.locator('.gt-result-actions [data-action=replay]').click(); await choose('spread');
  for (let i = 0; i < 6; i++) { await page.locator(`[data-world-action=star-route-${Math.floor(i / 2)}]`).click(); await answer(); }
  expect((await inspect()).play.world.challenge.status).toBe('achieved');
  await page.locator('[data-action=back]').click();
  await page.locator('.yt-game-card[data-game-id=multiSelect]').click(); await page.locator('[data-action=start-game]').click();
  await choose('crown'); for (let i = 0; i < 3; i++) await answer();
  expect((await inspect()).play.world.challenge.status).toBe('achieved');
  evidence.checks.push('choose before answering; pause and first-answer lock', 'partial credit achieves arc at question 4',
    'result feedback and clean replay', 'same correct answers: spread fails without switching and succeeds with switching',
    'crown first completion', '320/390/768px layout');
  expect(evidence.errors).toEqual([]); evidence.pass = true;
} finally {
  await fs.writeFile(new URL('results.json', out), JSON.stringify(evidence, null, 2));
  await browser?.close(); await server.close();
}
console.log(JSON.stringify(evidence, null, 2));
