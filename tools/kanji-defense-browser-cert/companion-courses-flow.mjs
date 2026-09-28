import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDefaultSave } from '../../src/core/saveData.js';
import { launchPreferredBrowser } from './helpers.mjs';

const out = new URL('../../artifacts/companion-courses/', import.meta.url);
await fs.mkdir(out, { recursive: true });
const server = await createServer({ configFile: false, server: { host: '127.0.0.1', port: 0, watch: null } });
await server.listen();
let browser;
const report = { courses: [], layout: {}, errors: [], pass: false };
try {
  const launched = await launchPreferredBrowser(chromium);
  browser = launched.browser; report.browser = launched.name;
  const save = getDefaultSave();
  save.player.name = '相棒コースQA';
  save.player.collection.gotomonIds = ['HKD-E01', 'HKD-E02', 'HKD-E03', 'HKD-E04', 'AOM-E09'];
  save.meta.compatibilityEntries = { tutorial_seen_title: '1' };
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(value => {
    if (sessionStorage.getItem('course-qa')) return;
    localStorage.setItem('krb_save', JSON.stringify(value));
    localStorage.setItem('bgmVolume', '0');
    localStorage.setItem('seVolume', '0');
    sessionStorage.setItem('course-qa', '1');
  }, save);
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0]);
  await page.locator('#titleMiniGameButton').click();
  for (const [gameId, gotomonId, action, courseName] of [
    ['mathSprint', 'HKD-E01', 'roll', 'ころころ近道'],
    ['mathInvader', 'HKD-E02', 'golden-burst', '黄金の連射'],
    ['englishChoice', 'HKD-E01', 'use-key', 'ひみつの鍵'],
    ['sentenceOrder', 'AOM-E09', 'bridge-anchor', '虹の支え'],
    ['timedChoice', 'HKD-E03', 'store-light', 'しずくの灯台'],
    ['multiSelect', 'HKD-E04', 'release-spark', '星のたくわえ'],
    ['asyncChoice', 'HKD-E04', 'use-compass', '発見の羅針盤'],
    ['kanjiDefense', 'AOM-E09', 'use-ward', '守りの札'],
  ]) {
    await page.locator(`[data-game-id=${gameId}]`).click();
    const dialog = page.locator('.yt-companion-dialog');
    await dialog.locator(`[data-gotomon-id=${gotomonId}]`).click();
    const choice = dialog.locator('.yt-course-choice');
    await expect(choice).toBeVisible();
    await expect(choice).toContainText(courseName);
    await expect(choice.locator('input')).toBeChecked();
    await dialog.locator('[data-action=start-game]').click();
    await expect(page.locator('.gt-goal-picker summary')).toContainText(courseName);
    await page.locator('.gt-goal-picker summary').click();
    await expect(page.locator('.gt-goal-actions button')).toHaveCount(gameId === 'multiSelect' ? 4 : 3);
    await page.locator('.gt-goal-picker summary').click();
    const specialAction = page.locator(`[data-world-action=${action}]`);
    await expect(specialAction).toBeVisible();
    report.layout[gameId] = await page.locator('.gt-scene').evaluate(node => ({ height: Math.round(node.getBoundingClientRect().height), classes: node.className }));
    if (!['mathInvader', 'kanjiDefense'].includes(gameId)) {
      await expect(page.locator('.gt-scene > .gt-play-controls')).toBeVisible();
      expect(await page.locator('.gt-scene .gt-play-controls [data-role=problem]').count()).toBe(1);
    } else {
      const enemy = page.locator(gameId === 'mathInvader' ? '.mi-enemy' : '.kd-monster').first();
      await expect(enemy).toBeVisible();
      await enemy.click({ force: true });
      const answer = page.locator(gameId === 'mathInvader' ? '.mi-answer-row input' : '.kd-controls input');
      await expect(answer).toBeVisible();
      report.layout[gameId].answerBottom = await answer.evaluate(node => Math.round(node.getBoundingClientRect().bottom));
      expect(report.layout[gameId].answerBottom).toBeLessThanOrEqual(844);
    }
    if (gameId === 'timedChoice') {
      await specialAction.click();
      await expect(page.locator('.gt-scene-metric')).toContainText('しずく 1/2');
      await page.locator('[data-world-action=pour-light]').click();
      await expect(page.locator('.gt-scene-metric')).toContainText('しずく 0/2');
    }
    expect(await page.locator('.yt-game').evaluate(root => root.scrollWidth <= root.clientWidth + 2)).toBe(true);
    await page.screenshot({ path: fileURLToPath(new URL(`${gameId}.png`, out)), fullPage: true });
    await page.setViewportSize({ width: 320, height: 568 });
    expect(await page.locator('.yt-game').evaluate(root => root.scrollWidth <= root.clientWidth + 2 && root.scrollHeight <= root.clientHeight + 2)).toBe(true);
    await page.screenshot({ path: fileURLToPath(new URL(`${gameId}-small.png`, out)), fullPage: true });
    await page.setViewportSize({ width: 768, height: 900 });
    expect(await page.locator('.yt-game').evaluate(root => root.scrollWidth <= root.clientWidth + 2 && root.scrollHeight <= root.clientHeight + 2)).toBe(true);
    await page.screenshot({ path: fileURLToPath(new URL(`${gameId}-wide.png`, out)), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    if (gameId === 'mathSprint') {
      await page.locator('.gt-play-controls .ms-answer-row input').fill('0');
      await page.locator('.gt-play-controls .ms-answer-row input').press('Enter');
      await expect(page.locator('.gt-play-controls .ms-feedback')).not.toBeEmpty();
    }
    if (gameId === 'englishChoice') {
      await page.locator('.gt-play-controls .ec-choice').first().focus();
      await page.keyboard.press('1');
      await expect(page.locator('.gt-play-controls .ec-feedback')).not.toBeEmpty();
    }
    await page.locator('[data-action=back]').click();
    await expect(page.locator('#miniGameHub')).toBeVisible();
    report.courses.push(gameId);
  }
  await page.locator('[data-game-id=mathSprint]').click();
  const dialog = page.locator('.yt-companion-dialog');
  await dialog.locator('.yt-course-choice input').uncheck();
  await dialog.locator('[data-action=start-game]').click();
  await expect(page.locator('[data-world-action=roll]')).toHaveCount(0);
  await page.locator('[data-action=back]').click();
  expect(report.errors).toEqual([]);
  report.pass = true;
} finally {
  await fs.writeFile(new URL('results.json', out), JSON.stringify(report, null, 2));
  await browser?.close();
  await server.close();
}
console.log(JSON.stringify(report, null, 2));
