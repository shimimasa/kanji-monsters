import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDefaultSave } from '../../src/core/saveData.js';
import { miniGameRegistry } from '../../src/minigames/registry.js';
import { gameExperiences } from '../../src/minigames/gameExperiences.js';
import { launchPreferredBrowser } from './helpers.mjs';

const out = new URL('../../artifacts/minigame-guides/', import.meta.url);
await fs.mkdir(out, { recursive: true });
const server = await createServer({ configFile: false, server: { host: '127.0.0.1', port: 0, watch: null } });
await server.listen();
let browser;
const report = { games: [], errors: [], pass: false };
try {
  const launched = await launchPreferredBrowser(chromium);
  browser = launched.browser; report.browser = launched.name;
  const save = getDefaultSave();
  save.player.name = 'あそびかたQA';
  save.player.collection.gotomonIds = ['HKD-E01'];
  save.meta.compatibilityEntries = { tutorial_seen_title: '1' };
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(value => {
    if (sessionStorage.getItem('guide-qa')) return;
    localStorage.setItem('krb_save', JSON.stringify(value));
    localStorage.setItem('bgmVolume', '0');
    localStorage.setItem('seVolume', '0');
    sessionStorage.setItem('guide-qa', '1');
  }, save);
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0]);
  await page.locator('#titleMiniGameButton').click();
  const snapshot = () => page.evaluate(() => window.fsm.currentState.inspect().session);
  for (const id of Object.keys(miniGameRegistry)) {
    await page.locator(`[data-game-id=${id}]`).click();
    const dialog = page.locator('.yt-companion-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.yt-game-guide li')).toHaveText(gameExperiences[id].howTo);
    if (id === 'mathSprint') await page.screenshot({ path: fileURLToPath(new URL('start-dialog.png', out)), fullPage: true });
    await dialog.locator('[data-action=start-game]').click();
    const goalPicker = page.locator('.gt-goal-picker');
    await expect(goalPicker).toBeVisible();
    await goalPicker.locator('summary').click();
    const goals = goalPicker.locator('.gt-goal-actions button');
    expect(await goals.count()).toBeGreaterThanOrEqual(2);
    await expect(goals.nth(1)).toBeEnabled();
    await goals.nth(1).click();
    await expect(goals.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await goalPicker.locator('summary').click();
    const guide = page.locator('.gt-how-to');
    await expect(guide).toBeVisible();
    await guide.locator('summary').click();
    await expect(guide).toHaveAttribute('open', '');
    await expect.poll(async () => (await snapshot()).paused).toBe(true);
    if (id === 'timedChoice') {
      const before = (await snapshot()).remainingMs;
      await page.waitForTimeout(200);
      expect((await snapshot()).remainingMs).toBe(before);
    }
    await page.screenshot({ path: fileURLToPath(new URL(`${id}.png`, out)), fullPage: true });
    expect(await page.locator('.yt-game').evaluate(root => root.scrollWidth <= root.clientWidth + 2)).toBe(true);
    await guide.locator('summary').click();
    await expect.poll(async () => (await snapshot()).paused).toBe(false);
    if (id === 'timedChoice') {
      await page.locator('[data-action=pause]').click();
      await expect.poll(async () => (await snapshot()).paused).toBe(true);
      await guide.locator('summary').click();
      await guide.locator('summary').click();
      await expect.poll(async () => (await snapshot()).paused).toBe(true);
      await page.locator('[data-action=pause]').click();
      await expect.poll(async () => (await snapshot()).paused).toBe(false);
    }
    await page.locator('[data-action=back]').click();
    await expect(page.locator('#miniGameHub')).toBeVisible();
    report.games.push(id);
  }
  expect(report.errors).toEqual([]);
  report.pass = true;
} finally {
  await fs.writeFile(new URL('results.json', out), JSON.stringify(report, null, 2));
  await browser?.close();
  await server.close();
}
console.log(JSON.stringify(report, null, 2));
