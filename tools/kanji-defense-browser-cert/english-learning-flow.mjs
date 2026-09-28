import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDefaultSave } from '../../src/core/saveData.js';
import { launchPreferredBrowser } from './helpers.mjs';

const out = new URL('../../artifacts/english-learning/browser/', import.meta.url);
await fs.mkdir(out, { recursive: true });
const server = await createServer({ configFile: false, server: { host: '127.0.0.1', port: 0, watch: null } });
await server.listen();
const base = server.resolvedUrls.local[0];
let browser;
const evidence = { checks: [], errors: [] };
try {
  const launched = await launchPreferredBrowser(chromium); browser = launched.browser; evidence.browser = launched.name;
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  const save = getDefaultSave(); save.player.name = '英単語復習QA'; save.player.collection.gotomonIds = ['HKD-E01'];
  save.meta.compatibilityEntries = { tutorial_seen_title: '1' };
  await context.addInitScript(value => {
    if (sessionStorage.getItem('review-qa')) return;
    localStorage.setItem('krb_save', JSON.stringify(value));
    localStorage.setItem('bgmVolume', '0'); localStorage.setItem('seVolume', '0');
    sessionStorage.setItem('review-qa', '1');
  }, save);
  const page = await context.newPage(); page.on('pageerror', error => evidence.errors.push(error.message));
  const state = () => page.evaluate(() => window.fsm.currentState.inspect().session);
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('krb_save')));
  async function start() { await page.locator('[data-action=start-game]').click(); await expect(page.locator('#englishChoiceScreen')).toBeVisible(); }
  async function answer(correct) {
    const s = await state();
    const choice = s.problem.choices.find(choice => (choice.choiceId === s.problem.correctChoiceId) === correct);
    await page.locator(`.ec-choice[data-choice-id="${choice.choiceId}"]`).click();
    return s.problem.contentId;
  }
  async function next() {
    if ((await state()).phase === 'feedback') await page.locator('[data-action=next]').click();
  }
  async function screenshot(name) {
    await page.screenshot({ path: fileURLToPath(new URL(name, out)), fullPage: true });
    expect(await page.locator('.yt-world, .yt-game').evaluateAll(roots => roots.filter(root => root.scrollWidth > root.clientWidth + 2).map(root => root.id))).toEqual([]);
  }
  await page.goto(base); await page.locator('#titleMiniGameButton').click();
  await expect(page.locator('[data-recommendation=review]')).toHaveCount(0);
  await page.locator('[data-game-id=englishChoice]').click(); await start();
  const missed = [];
  await page.evaluate(() => {
    window.qaStorageSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'krb_save') throw new DOMException('QA quota', 'QuotaExceededError');
      return window.qaStorageSet.call(this, key, value);
    };
  });
  missed.push(await answer(false));
  await expect(page.locator('.gt-learning-save-alert')).toBeVisible();
  await expect(page.locator('.gt-learning-save-alert')).toContainText('1問の記録');
  await screenshot('in-play-save-failure.png');
  await page.evaluate(() => { Storage.prototype.setItem = window.qaStorageSet; delete window.qaStorageSet; });
  await page.locator('[data-action=retry-learning-save]').click();
  await expect(page.locator('.gt-learning-save-alert')).toBeHidden();
  await next();
  for (let i = 1; i < 10; i++) {
    const id = await answer(i >= 3); if (i < 3) missed.push(id); await next();
  }
  evidence.checks.push('in-play save failure shows pending count and retry clears warning');
  await expect(page.locator('.gt-result')).toBeVisible();
  await expect(page.locator('.gt-reward')).toContainText('なかよし');
  await expect(page.locator('[data-action=review]')).toContainText('3語');
  const normal = (await saved()).player.miniGames;
  expect(Object.keys(normal.englishLearning.items)).toHaveLength(10);
  await screenshot('normal-result.png'); evidence.checks.push('normal 10 answers stored; review CTA shows 3 words');
  // Result -> review, then interrupt to verify hub and reload use canonical history.
  await page.locator('[data-action=review]').click();
  expect((await state()).mode).toBe('review'); expect((await state()).totalQuestions).toBe(3);
  await screenshot('review-playing.png');
  await page.locator('[data-action=back]').click();
  await expect(page.getByRole('region', { name: '今日のおすすめ' })).toContainText('3語');
  await screenshot('hub-recommendation.png');
  await page.reload(); await page.locator('#titleMiniGameButton').click();
  await page.getByRole('button', { name: '相棒と復習する' }).click(); await start();
  const reviewed = [];
  for (let i = 0; i < 3; i++) { reviewed.push(await answer(true)); await next(); }
  expect(new Set(reviewed)).toEqual(new Set(missed));
  await expect(page.locator('.gt-reward')).toHaveText('復習の記録を保存しました。');
  await expect(page.locator('.gt-rank')).toBeHidden();
  await expect(page.locator('[data-action=review]')).toBeHidden();
  const afterReview = (await saved()).player.miniGames;
  expect(afterReview.games).toEqual(normal.games); expect(afterReview.companions).toEqual(normal.companions);
  for (const id of missed) expect(afterReview.englishLearning.items[id].lastCorrect).toBe(true);
  await screenshot('review-result.png'); evidence.checks.push('reload -> hub -> 3-word review; no growth or rank farming');
  await page.getByRole('button', { name: '通常の10問であそぶ', exact: true }).click();
  expect((await state()).mode).toBe('tenQuestions');
  expect((await state()).totalQuestions).toBe(10);
  await answer(false); await page.locator('[data-action=back]').click();
  await expect(page.getByRole('region', { name: '今日のおすすめ' })).toContainText('1語');
  evidence.checks.push('normal replay and interrupted answer history');
  await page.getByRole('button', { name: '相棒と復習する' }).click(); await start();
  expect((await state()).totalQuestions).toBe(1);
  await answer(false);
  await expect(page.locator('[data-action=review]')).toContainText('1語');
  await page.locator('.gt-result-details summary').click();
  await expect(page.locator('.ec-missed')).not.toBeEmpty();
  await page.locator('[data-action=review]').click();
  const beforeFailure = (await saved()).player.miniGames;
  await page.evaluate(() => {
    window.qaStorageSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'krb_save') throw new DOMException('QA quota', 'QuotaExceededError');
      return window.qaStorageSet.call(this, key, value);
    };
  });
  await answer(true);
  await expect(page.locator('.gt-reward')).toContainText('保存できませんでした');
  expect((await saved()).player.miniGames).toEqual(beforeFailure);
  await page.evaluate(() => { Storage.prototype.setItem = window.qaStorageSet; delete window.qaStorageSet; });
  await page.getByRole('button', { name: '記録の保存を再試行' }).click();
  await expect(page.locator('.gt-reward')).toHaveText('復習の記録を保存しました。');
  await expect(page.locator('[data-action=review]')).toBeHidden();
  expect((await saved()).player.miniGames.companions).toEqual(normal.companions);
  for (const [width, height] of [[320, 740], [768, 1024]]) {
    await page.setViewportSize({ width, height }); await screenshot(`review-result-${width}.png`);
  }
  evidence.checks.push('single-word miss feedback; quota failure and retry; 320/768px layout');
  expect(evidence.errors).toEqual([]);
  evidence.pass = true;
} finally {
  await fs.writeFile(new URL('results.json', out), JSON.stringify(evidence, null, 2));
  await browser?.close(); await server.close();
}
console.log(JSON.stringify(evidence, null, 2));
