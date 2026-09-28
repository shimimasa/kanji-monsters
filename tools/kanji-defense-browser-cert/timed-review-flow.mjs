import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDefaultSave } from '../../src/core/saveData.js';
import { launchPreferredBrowser } from './helpers.mjs';
const out = new URL('../../artifacts/timed-review/browser/', import.meta.url);
await fs.mkdir(out, { recursive: true });
const server = await createServer({ configFile: false, server: { host: '127.0.0.1', port: 0, watch: null } });
await server.listen(); const base = server.resolvedUrls.local[0];
const evidence = { checks: [], errors: [] }; let browser;
try {
  const launched = await launchPreferredBrowser(chromium); browser = launched.browser; evidence.browser = launched.name;
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  const save = getDefaultSave(); save.player.name = '時間なし復習QA'; save.player.collection.gotomonIds = ['HKD-E01']; save.meta.compatibilityEntries = { tutorial_seen_title: '1' };
  await context.addInitScript(value => {
    if (sessionStorage.getItem('timed-qa')) return;
    localStorage.setItem('krb_save', JSON.stringify(value)); localStorage.setItem('bgmVolume', '0'); localStorage.setItem('seVolume', '0'); sessionStorage.setItem('timed-qa', '1');
  }, save);
  const page = await context.newPage(); page.on('pageerror', e => evidence.errors.push(e.message));
  const state = () => page.evaluate(() => window.fsm.currentState.inspect().session);
  const progress = () => page.evaluate(() => JSON.parse(localStorage.getItem('krb_save')).player.miniGames);
  const shot = name => page.screenshot({ path: fileURLToPath(new URL(name, out)), fullPage: true });
  async function answer(correct) {
    const s = await state(), choice = s.problem.choices.find(c => (c.choiceId === s.problem.correctChoiceId) === correct);
    await page.locator(`.tc-choice[data-choice-id="${choice.choiceId}"]`).click();
    return s.problem.fixtureId;
  }
  async function next() { if ((await state()).phase === 'feedback') await page.locator('[data-action=next]').click(); }
  await page.goto(base); await page.locator('#titleMiniGameButton').click();
  await page.locator('.yt-game-card[data-game-id=timedChoice]').click(); await page.locator('[data-action=start-game]').click();
  const timeoutId = (await state()).problem.fixtureId;
  await expect.poll(async () => (await state()).timedOut, { timeout: 10000 }).toBe(1);
  const history = (await progress()).timedLearning.items[timeoutId]; expect(history.incorrect).toBe(0); expect(history.timedOut).toBe(1);
  await next(); const wrongId = await answer(false); await next();
  for (let i = 2; i < 10; i++) { await answer(true); await next(); }
  await expect(page.locator('[data-action=review]')).toContainText('2語');
  const normal = await progress(); await shot('normal-result.png');
  await page.locator('[data-action=review]').click(); expect((await state()).mode).toBe('review');
  await expect(page.locator('.tc-timer-track')).toBeHidden(); await expect(page.locator('.tc-help')).toContainText('時間制限なし');
  await page.waitForTimeout(5500); expect((await state()).answered).toBe(0); expect((await state()).timedOut).toBe(0);
  for (const [width, height] of [[320, 740], [390, 844], [768, 1024]]) {
    await page.setViewportSize({ width, height });
    expect(await page.locator('#timedChoiceScreen').evaluate(root => root.scrollWidth <= root.clientWidth + 2)).toBe(true); await shot(`review-${width}.png`);
  }
  await page.locator('[data-action=back]').click(); await page.reload(); await page.locator('#titleMiniGameButton').click();
  await page.getByRole('button', { name: '時間なしで復習する：タイムことば', exact: true }).click(); await page.locator('[data-action=start-game]').click();
  const reviewed = []; reviewed.push(await answer(true));
  const firstReviewProblem = (await state()).problem.problemId;
  await expect(page.locator('.tc-feedback')).toContainText('せいかい！');
  await expect(page.locator('.tc-feedback')).toContainText('は「');
  await page.waitForTimeout(750);
  expect((await state()).problem.problemId).toBe(firstReviewProblem);
  expect((await state()).phase).toBe('feedback');
  await next();
  const beforeFailure = await progress();
  await page.evaluate(() => {
    window.qaSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key === 'krb_save') throw new DOMException('QA quota', 'QuotaExceededError'); return window.qaSet.call(this, key, value); };
  });
  reviewed.push(await answer(true)); await expect(page.locator('.gt-reward')).toContainText('保存できませんでした'); expect(await progress()).toEqual(beforeFailure);
  await page.evaluate(() => { Storage.prototype.setItem = window.qaSet; delete window.qaSet; });
  await page.getByRole('button', { name: '記録の保存を再試行' }).click();
  await expect(page.locator('.gt-reward')).toContainText('復習の記録を保存しました');
  expect(new Set(reviewed)).toEqual(new Set([timeoutId, wrongId]));
  const after = await progress(); expect(after.companions).toEqual(normal.companions); expect(after.games).toEqual(normal.games); expect(after.hubActivity).toEqual(normal.hubActivity);
  expect(after.timedLearning.items[timeoutId].timedOut).toBe(1); expect(after.timedLearning.items[timeoutId].correct).toBe(1);
  await expect(page.locator('[data-action=review]')).toBeHidden(); await shot('review-result.png');
  await page.getByRole('button', { name: '通常の10問であそぶ', exact: true }).click();
  expect((await state()).mode).toBe('deadlineProbe'); expect((await state()).deadlineMs).toBe(5000);
  evidence.checks.push('actual five-second timeout stored separately', 'wrong answer and two-word review', 'review remains answerable beyond five seconds',
    'reload and hub recommendation', 'quota retry', 'review preserves growth, memories and normal activity', 'normal replay restores deadline', '320/390/768px layout');
  expect(evidence.errors).toEqual([]); evidence.pass = true;
} finally {
  await fs.writeFile(new URL('results.json', out), JSON.stringify(evidence, null, 2)); await browser?.close(); await server.close();
}
console.log(JSON.stringify(evidence, null, 2));
