import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDefaultSave } from '../../src/core/saveData.js';
import { launchPreferredBrowser } from './helpers.mjs';
const out = new URL('../../artifacts/companion-memories/browser/', import.meta.url);
await fs.mkdir(out, { recursive: true });
const server = await createServer({ configFile: false, server: { host: '127.0.0.1', port: 0, watch: null } });
await server.listen(); const base = server.resolvedUrls.local[0];
const evidence = { checks: [], errors: [] }; let browser;
try {
  const launched = await launchPreferredBrowser(chromium); browser = launched.browser; evidence.browser = launched.name;
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  const save = getDefaultSave(); save.player.name = '思い出QA'; save.player.collection.gotomonIds = ['HKD-E01', 'HKD-E02'];
  save.meta.compatibilityEntries = { tutorial_seen_title: '1' };
  await context.addInitScript(value => {
    if (sessionStorage.getItem('memory-qa')) return;
    localStorage.setItem('krb_save', JSON.stringify(value)); localStorage.setItem('bgmVolume', '0'); localStorage.setItem('seVolume', '0'); sessionStorage.setItem('memory-qa', '1');
  }, save);
  const page = await context.newPage(); page.on('pageerror', e => evidence.errors.push(e.message));
  const state = () => page.evaluate(() => window.fsm.currentState.inspect().session);
  const progress = () => page.evaluate(() => JSON.parse(localStorage.getItem('krb_save')).player.miniGames);
  async function start(friend = 'HKD-E01') {
    await page.locator('.yt-game-card[data-game-id=englishChoice]').click();
    await page.locator(`[data-gotomon-id="${friend}"]`).click();
    await page.locator('[data-action=start-game]').click(); await expect(page.locator('#englishChoiceScreen')).toBeVisible();
  }
  async function answer(correct) {
    const s = await state(), choice = s.problem.choices.find(c => (c.choiceId === s.problem.correctChoiceId) === correct);
    await page.locator(`.ec-choice[data-choice-id="${choice.choiceId}"]`).click();
    if ((await state()).phase === 'feedback') await page.locator('[data-action=next]').click();
  }
  async function hub() { await page.getByRole('button', { name: 'ミニゲーム広場へ', exact: true }).click(); }
  async function shot(name) { await page.screenshot({ path: fileURLToPath(new URL(name, out)), fullPage: true }); }
  await page.goto(base); await page.locator('#titleMiniGameButton').click();
  await page.locator('[data-action=memories]').click();
  await expect(page.locator('.yt-memory-content')).toContainText('思い出はこれから');
  await page.keyboard.press('Escape'); await expect(page.locator('[data-action=memories]')).toBeFocused();
  await start(); for (let i = 0; i < 10; i++) await answer(i < 5);
  await expect(page.locator('.gt-memory-notice')).toContainText('最後まで');
  const first = (await progress()).companions['HKD-E01'].memories.games.englishChoice;
  expect(first.plays).toBe(1); expect(first.firstFinishedAt).not.toBeNull();
  await shot('first-result.png'); await hub();
  await page.locator('[data-action=memories]').click();
  await expect(page.locator('[data-memory-game=englishChoice]')).toContainText('記録 1回');
  const selectedBefore = (await progress()).selectedGotomonId;
  await page.getByLabel('思い出を見る相棒').selectOption('HKD-E02');
  await expect(page.locator('.yt-memory-content')).toContainText('思い出はこれから');
  expect((await progress()).selectedGotomonId).toBe(selectedBefore);
  await page.keyboard.press('Escape');
  await page.reload(); await page.locator('#titleMiniGameButton').click(); await start();
  for (let i = 0; i < 9; i++) await answer(true);
  const beforeFailure = await progress();
  await page.evaluate(() => {
    window.qaOriginalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key === 'krb_save') throw new DOMException('QA quota', 'QuotaExceededError'); return window.qaOriginalSet.call(this, key, value); };
  });
  await answer(true); await expect(page.locator('.gt-reward')).toContainText('保存できませんでした');
  expect((await progress()).companions).toEqual(beforeFailure.companions);
  await page.evaluate(() => { Storage.prototype.setItem = window.qaOriginalSet; delete window.qaOriginalSet; });
  await page.getByRole('button', { name: '記録の保存を再試行' }).click();
  await expect(page.locator('.gt-memory-notice')).toContainText('自己ベスト');
  const second = (await progress()).companions['HKD-E01'].memories.games.englishChoice;
  expect(second.plays).toBe(2); expect(second.bestScore).toBeGreaterThan(first.bestScore);
  expect(second.firstPlayedAt).toBe(first.firstPlayedAt); expect(second.firstFinishedAt).toBe(first.firstFinishedAt);
  await hub(); await page.locator('[data-action=memories]').click();
  for (const [width, height] of [[320, 740], [390, 844], [768, 1024]]) {
    await page.setViewportSize({ width, height });
    expect(await page.locator('.yt-memory-dialog').evaluate(root => root.scrollWidth <= root.clientWidth + 2)).toBe(true);
    await shot(`memories-${width}.png`);
  }
  await page.keyboard.press('Escape');
  await start('HKD-E02'); for (let i = 0; i < 10; i++) await answer(false);
  expect((await progress()).companions['HKD-E02'].memories.games.englishChoice.plays).toBe(1);
  expect((await progress()).companions['HKD-E01'].memories.games.englishChoice.plays).toBe(2);
  evidence.checks.push('empty state and Escape focus', 'first finish, best update, reload', 'companion browsing does not change selection',
    'quota rollback and retry', 'separate companion records', '320/390/768px dialog layout');
  expect(evidence.errors).toEqual([]); evidence.pass = true;
} finally {
  await fs.writeFile(new URL('results.json', out), JSON.stringify(evidence, null, 2));
  await browser?.close(); await server.close();
}
console.log(JSON.stringify(evidence, null, 2));
