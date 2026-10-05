import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { getDefaultSave } from '../../src/core/saveData.js';
import { BREAKOUT_RULES } from '../../src/minigames/gotomonBreakout/breakoutGame.js';
import { launchPreferredBrowser } from './helpers.mjs';

const hostChunk = (await fs.readdir(new URL('../../dist/assets/', import.meta.url))).find(name => /^miniGameHost-.*\.js$/.test(name));
const { browser } = await launchPreferredBrowser(chromium);
const results = [];
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const context = await browser.newContext({ viewport });
    const save = getDefaultSave();
    save.player.name = '長さ確認';
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
    for (const [gameId, limit] of [['gotomonPush', 5], ['gotomonBreakout', 6]]) {
      await page.goto('http://localhost:4173/');
      await page.locator('#titleMiniGameButton').click();
      await page.locator(`[data-game-id=${gameId}]`).click();
      const length = page.getByLabel('あそぶ長さ');
      assert.equal(await length.inputValue(), 'full');
      await length.selectOption('short');
      await page.locator('[data-action=start-game]').click();
      await page.locator('[data-action=start-play]').click();
      assert.equal((await inspect())[gameId === 'gotomonPush' ? 'rooms' : 'questions'], limit);
      for (let i = 0; i < limit; i++) {
        const state = await inspect();
        assert.ok(state.problem, `${viewport.width} ${gameId} ${i}: ${JSON.stringify({ phase: state.phase, room: state.room, answered: state.answered })}`);
        if (gameId === 'gotomonPush') {
          const index = state.problem.choices.findIndex(choice => choice.choiceId === state.problem.correctChoiceId);
          await page.locator('#gotomonPushScreen .ps-choice').nth(index).click();
          await page.locator('#gotomonPushScreen [data-action=carry]').click();
          await page.waitForTimeout(1400);
        } else {
          const block = state.blocks.find(item => item.number === state.problem.answer);
          const board = await page.locator('#gotomonBreakoutScreen .bk-board').boundingBox();
          await page.mouse.click(board.x + (block.x + block.w / 2) / BREAKOUT_RULES.width * board.width,
            board.y + (block.y + block.h / 2) / BREAKOUT_RULES.height * board.height);
          await page.locator('#gotomonBreakoutScreen [data-action=assist]').click();
          await page.waitForTimeout(1400);
        }
      }
      const done = await inspect();
      assert.equal(done.phase, 'completed'); assert.equal(done.answered, limit);
      const result = page.locator(`#${gameId}Screen`);
      await result.locator('.gt-result').waitFor({ state: 'visible', timeout: 10000 });
      assert.equal(await result.locator('.gt-rank').isVisible(), false);
      const record = await result.locator('.gt-record').textContent();
      assert.match(record, /ちょこっとコース/, JSON.stringify({ gameId, viewport, text: (await result.textContent()).slice(-1200) }));
      results.push({ viewport: viewport.width, gameId, answered: done.answered });
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
} finally { await browser.close(); }
console.log(JSON.stringify(results));
