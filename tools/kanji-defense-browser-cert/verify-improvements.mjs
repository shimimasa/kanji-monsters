import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { getDefaultSave } from '../../src/core/saveData.js';
import { launchPreferredBrowser } from './helpers.mjs';

const output = new URL('../../artifacts/improvements-review/', import.meta.url);
await fs.mkdir(output, { recursive: true });
const { browser } = await launchPreferredBrowser(chromium);
const results = [];
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const context = await browser.newContext({ viewport });
    const save = getDefaultSave();
    save.player.name = '表示確認';
    save.player.collection.gotomonIds = ['HKD-E01'];
    save.player.miniGames = { version: 1, games: {}, selectedGotomonId: 'HKD-E01', companions: {} };
    save.meta.compatibilityEntries = { tutorial_seen_title: '1' };
    await context.addInitScript(value => {
      const serialized = JSON.stringify(value);
      localStorage.setItem('krb_save', serialized);
      localStorage.setItem('yomitabi_confirmed_1', serialized);
      localStorage.setItem('bgmVolume', '0'); localStorage.setItem('seVolume', '0');
    }, save);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4173/');
    await page.locator('#titleMiniGameButton').click();
    await page.locator('.yt-start-here').waitFor();
    assert.equal(await page.locator('.yt-start-here').evaluate(node => {
      const recommendation = node.parentElement.querySelector('.yt-recommendations');
      return !recommendation || !!(node.compareDocumentPosition(recommendation) & Node.DOCUMENT_POSITION_FOLLOWING);
    }), true);
    await page.locator('[data-game-id=gotomonColoring]').click();
    await page.locator('[data-action=start-game]').click();
    await page.locator('[data-action=start-play]').click();
    await page.locator('#gotomonColoringScreen .cl-rows').waitFor();
    assert.match(await page.locator('#gotomonColoringScreen .cl-rows').innerText(), /だん目/);
    const first = await page.locator('#gotomonColoringScreen .cl-cell[data-outside=false]').count();
    assert.ok(first <= 10 && first > 0);
    await page.screenshot({ path: new URL(`${viewport.width}-coloring-focus.png`, output).pathname.replace(/^\/(\w:)/, '$1') });
    await page.locator('#gotomonColoringScreen .cl-rows button').last().click();
    assert.equal(await page.locator('#gotomonColoringScreen .cl-cell[data-outside=true]').count(), 0);
    await page.screenshot({ path: new URL(`${viewport.width}-coloring.png`, output).pathname.replace(/^\/(\w:)/, '$1') });
    await page.locator('#gotomonColoringScreen [data-action=back]').click();
    await page.locator('[data-game-id=gotomonShooter]').click();
    assert.equal(await page.locator('.yt-pace-choice[data-pace=slow]').getAttribute('aria-checked'), 'true');
    await page.locator('[data-action=start-game]').click();
    await page.locator('[data-action=start-play]').click();
    await page.locator('#gotomonShooterScreen .gs-fire').waitFor();
    assert.match(await page.locator('#gotomonShooterScreen .gs-fire').innerText(), /いまの位置/);
    await page.screenshot({ path: new URL(`${viewport.width}-shooter.png`, output).pathname.replace(/^\/(\w:)/, '$1') });
    assert.deepEqual(errors, []);
    results.push({ viewport, focusCells: first, errors: errors.length });
    await context.close();
  }
} finally { await browser.close(); }
console.log(JSON.stringify(results));
