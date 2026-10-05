import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { getDefaultSave } from '../../src/core/saveData.js';
import { SHORT_COURSE_COUNTS } from '../../src/minigames/courseLength.js';
import { launchPreferredBrowser } from './helpers.mjs';

const hostChunk = (await fs.readdir(new URL('../../dist/assets/', import.meta.url))).find(name => /^miniGameHost-.*\.js$/.test(name));
const { browser } = await launchPreferredBrowser(chromium);
const results = [];
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const context = await browser.newContext({ viewport });
    const save = getDefaultSave();
    save.player.name = '長さ設定確認';
    save.player.collection.gotomonIds = ['HKD-E01'];
    save.player.miniGames = { version: 1, games: {}, selectedGotomonId: 'HKD-E01', companions: {} };
    save.meta.compatibilityEntries = { tutorial_seen_title: '1' };
    await context.addInitScript(value => {
      const serialized = JSON.stringify(value);
      if (!localStorage.getItem('krb_save')) {
        localStorage.setItem('krb_save', serialized);
        localStorage.setItem('yomitabi_confirmed_1', serialized);
      }
      localStorage.setItem('bgmVolume', '0'); localStorage.setItem('seVolume', '0');
    }, save);
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const hub = async () => {
      await page.goto('http://localhost:4173/');
      await page.locator('#titleMiniGameButton').click();
    };
    await hub();
    await page.locator('[data-action=game-settings]').click();
    const settings = page.getByRole('dialog', { name: 'ミニゲームの設定' });
    assert.equal(await settings.locator('[data-value=full]').getAttribute('aria-checked'), 'true');
    await settings.locator('[data-value=short]').click();
    assert.equal(await settings.locator('[data-value=short]').getAttribute('aria-checked'), 'true');
    await settings.getByRole('button', { name: '閉じる' }).click();
    assert.match(await page.locator('[data-game-id=gotomonPush] .yt-card-meta').textContent(), /5へや/);
    for (const [gameId, count] of Object.entries(SHORT_COURSE_COUNTS)) {
      await hub();
      await page.locator(`[data-game-id=${gameId}]`).click();
      const length = page.getByLabel('あそぶ長さ');
      assert.equal(await length.inputValue(), 'short', gameId);
      const mode = page.locator('dialog select:has(option[value="math"])');
      if (await mode.count()) await mode.selectOption('math');
      await page.locator('[data-action=start-game]').click();
      const start = page.locator('[data-action=start-play]');
      if (await start.count()) await start.click();
      await page.waitForTimeout(200);
      const state = await page.evaluate(async url => (await import(url)).default.inspect().session, `/assets/${hostChunk}`);
      assert.ok(state, `${viewport.width} ${gameId}: host session is missing; screens ${await page.locator('section[id]').evaluateAll(nodes => nodes.map(node => node.id).join(','))}; errors ${errors.join(' | ')}`);
      const actual = gameId === 'gotomonPush' ? state.rooms : gameId === 'gotomonBreakout' ? state.questions
        : gameId === 'gotomonTrace' ? state.firstRound : gameId === 'gotomonShooter' ? state.waves : state.total;
      assert.equal(actual, count, gameId);
    }
    await hub();
    await page.locator('[data-game-id=gotomonSlash]').click();
    await page.getByLabel('あそぶ長さ').selectOption('full');
    await page.locator('dialog select:has(option[value="math"])').selectOption('math');
    await page.locator('[data-action=start-game]').click();
    const fullStart = page.locator('[data-action=start-play]');
    if (await fullStart.count()) await fullStart.click();
    await page.waitForTimeout(200);
    const full = await page.evaluate(async url => (await import(url)).default.inspect().session, `/assets/${hostChunk}`);
    assert.equal(full.total, 12, 'this run alone uses the full length');
    await hub();
    await page.locator('[data-game-id=mathSprint]').click();
    assert.equal(await page.getByLabel('あそぶ長さ').count(), 0, 'a game without a short ending keeps its own length');
    await page.getByRole('dialog').getByRole('button', { name: '閉じる' }).click();
    await page.locator('[data-action=game-settings]').click();
    assert.equal(await page.getByRole('dialog', { name: 'ミニゲームの設定' }).locator('[data-value=short]').getAttribute('aria-checked'), 'true');
    assert.deepEqual(errors, []);
    results.push({ viewport: viewport.width, games: Object.keys(SHORT_COURSE_COUNTS).length, errors: errors.length });
    await context.close();
  }
} finally { await browser.close(); }
console.log(JSON.stringify(results));
