import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDefaultSave } from '../../src/core/saveData.js';
import { launchPreferredBrowser } from './helpers.mjs';

const out = new URL('../../artifacts/title-learning-paths/', import.meta.url);
await fs.mkdir(out, { recursive: true });
const server = await createServer({ configFile: false, server: { host: '127.0.0.1', port: 0, watch: null } });
await server.listen();
let browser;
const evidence = { checks: [], errors: [], pass: false };
try {
  const launched = await launchPreferredBrowser(chromium);
  browser = launched.browser;
  evidence.browser = launched.name;
  const save = getDefaultSave();
  save.player.name = '経路QA';
  save.player.collection.gotomonIds = ['HKD-E01'];
  save.meta.compatibilityEntries = { tutorial_seen_title: '1' };
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(value => {
    if (sessionStorage.getItem('title-paths-qa')) return;
    localStorage.setItem('krb_save', JSON.stringify(value));
    localStorage.setItem('bgmVolume', '0');
    localStorage.setItem('seVolume', '0');
    sessionStorage.setItem('title-paths-qa', '1');
  }, save);
  const page = await context.newPage();
  page.on('pageerror', error => evidence.errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0]);
  const title = page.locator('#adventureTitle');
  await expect(title).toBeVisible();
  await expect(title.locator('.yt-title-path')).toHaveCount(2);
  await expect(title.locator('h2')).toHaveText(['ヨミタビ本編', 'ミニゲーム']);
  await expect(title.locator('[id^=title][id$=Button]')).toHaveCount(2);
  const picture = async name => {
    await page.screenshot({ path: fileURLToPath(new URL(name, out)), fullPage: true });
    expect(await title.evaluate(node => node.scrollWidth <= node.clientWidth + 2)).toBe(true);
  };
  await picture('title-390.png');
  await page.locator('#titleMiniGameButton').click();
  await expect(page.locator('#miniGameHub')).toBeVisible();
  await expect(page.locator('.yt-game-card')).toHaveCount(8);
  evidence.checks.push('title -> eight-game hub');
  await page.getByRole('button', { name: 'タイトルへ' }).click();
  await expect(title).toBeVisible();
  await page.locator('#titleAdventureButton').click();
  await expect(page.locator('#adventureTitle')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.fsm.currentState === window.fsm.states.courseSelect)).toBe(true);
  evidence.checks.push('title -> main adventure');
  await page.reload();
  await expect(title).toBeVisible();
  await page.setViewportSize({ width: 320, height: 700 });
  await picture('title-320.png');
  await page.setViewportSize({ width: 768, height: 1024 });
  await picture('title-768.png');
  evidence.checks.push('320, 390 and 768px title layouts have no horizontal overflow');
  expect(evidence.errors).toEqual([]);
  evidence.pass = true;
} finally {
  await fs.writeFile(new URL('results.json', out), JSON.stringify(evidence, null, 2));
  await browser?.close();
  await server.close();
}
console.log(JSON.stringify(evidence, null, 2));
