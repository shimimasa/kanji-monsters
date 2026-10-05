import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { getDefaultSave } from '../../src/core/saveData.js';
import { BREAKOUT_RULES } from '../../src/minigames/gotomonBreakout/breakoutGame.js';
import { launchPreferredBrowser } from './helpers.mjs';

const hostChunk = (await fs.readdir(new URL('../../dist/assets/', import.meta.url))).find(name => /^miniGameHost-.*\.js$/.test(name));
const output = new URL('../../artifacts/physical-help-review/', import.meta.url);
await fs.mkdir(output, { recursive: true });
const { browser } = await launchPreferredBrowser(chromium);
const results = [];
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const context = await browser.newContext({ viewport });
    const save = getDefaultSave();
    save.player.name = 'あいぼう確認';
    save.player.collection.gotomonIds = ['HKD-E01'];
    save.player.miniGames = { version: 1, games: {}, selectedGotomonId: 'HKD-E01', companions: {} };
    save.meta.compatibilityEntries = { tutorial_seen_title: '1' };
    await context.addInitScript(value => {
      const serialized = JSON.stringify(value);
      localStorage.setItem('krb_save', serialized);
      localStorage.setItem('yomitabi_confirmed_1', serialized);
      localStorage.setItem('bgmVolume', '0'); localStorage.setItem('seVolume', '0');
    }, save);
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const inspect = () => page.evaluate(async url => (await import(url)).default.inspect().session, `/assets/${hostChunk}`);
    await page.goto('http://127.0.0.1:4173/');
    await page.locator('#titleMiniGameButton').click();
    await page.locator('[data-game-id=gotomonPush]').click();
    await page.locator('[data-action=start-game]').click();
    await page.locator('[data-action=start-play]').click();
    const push = await inspect();
    assert.equal(await page.locator('#gotomonPushScreen [data-action=carry]').isVisible(), false);
    const correctIndex = push.problem.choices.findIndex(choice => choice.choiceId === push.problem.correctChoiceId);
    await page.locator('#gotomonPushScreen .ps-choice').nth(correctIndex).click();
    assert.equal(await page.locator('#gotomonPushScreen [data-action=carry]').isVisible(), true);
    await page.screenshot({ path: new URL(`${viewport.width}-push-choice.png`, output).pathname.replace(/^\/(\w:)/, '$1') });
    await page.locator('#gotomonPushScreen [data-action=carry]').click();
    assert.equal((await inspect()).phase, 'cleared');
    await page.goto('http://127.0.0.1:4173/');
    await page.locator('#titleMiniGameButton').click();
    await page.locator('[data-game-id=gotomonBreakout]').click();
    await page.locator('[data-action=start-game]').click();
    await page.locator('[data-action=start-play]').click();
    const breakout = await inspect();
    assert.equal(await page.locator('#gotomonBreakoutScreen [data-action=assist]').isVisible(), false);
    const block = breakout.blocks.find(item => item.number === breakout.problem.answer);
    const board = await page.locator('#gotomonBreakoutScreen .bk-board').boundingBox();
    await page.mouse.click(board.x + (block.x + block.w / 2) / BREAKOUT_RULES.width * board.width,
      board.y + (block.y + block.h / 2) / BREAKOUT_RULES.height * board.height);
    assert.equal(await page.locator('#gotomonBreakoutScreen [data-action=assist]').isVisible(), true);
    await page.screenshot({ path: new URL(`${viewport.width}-breakout-choice.png`, output).pathname.replace(/^\/(\w:)/, '$1') });
    await page.locator('#gotomonBreakoutScreen [data-action=assist]').click();
    assert.equal((await inspect()).phase, 'feedback');
    assert.deepEqual(errors, []);
    results.push({ viewport, push: 'cleared', breakout: 'feedback', errors: errors.length });
    await context.close();
  }
} finally { await browser.close(); }
console.log(JSON.stringify(results));
