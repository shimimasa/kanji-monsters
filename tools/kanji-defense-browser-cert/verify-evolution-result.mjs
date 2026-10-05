import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { getDefaultSave } from '../../src/core/saveData.js';
import { XP_THRESHOLDS } from '../../src/minigames/companionGrowth.js';
import { launchPreferredBrowser } from './helpers.mjs';

const save = getDefaultSave();
save.player.name = 'しんか結果確認';
save.player.collection.gotomonIds = ['HKD-E01'];
save.player.miniGames = { version: 1, games: {}, selectedGotomonId: 'HKD-E01', companions: {
  'HKD-E01': { plays: 0, friendship: 0, medals: [], xp: XP_THRESHOLDS[4] - 1 },
} };
save.meta.compatibilityEntries = { tutorial_seen_title: '1' };
const hostChunk = (await fs.readdir(new URL('../../dist/assets/', import.meta.url))).find(name => /^miniGameHost-.*\.js$/.test(name));
const { browser } = await launchPreferredBrowser(chromium);
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(value => {
    const serialized = JSON.stringify(value);
    localStorage.setItem('krb_save', serialized);
    localStorage.setItem('yomitabi_confirmed_1', serialized);
    localStorage.setItem('bgmVolume', '0'); localStorage.setItem('seVolume', '0');
  }, save);
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const inspect = () => page.evaluate(async url => (await import(url)).default.inspect(), `/assets/${hostChunk}`);
  await page.goto('http://127.0.0.1:4173/');
  await page.locator('#titleMiniGameButton').click();
  await page.locator('[data-game-id=mathSprint]').click();
  await page.locator('.yt-friend-choice').first().click();
  await page.locator('[data-action=start-game]').click();
  await page.locator('[data-action=start-play]').click();
  let actions = 0;
  while (actions++ < 50) {
    const state = (await inspect()).session;
    if (state.result) break;
    if (state.phase === 'feedback') {
      const next = page.locator('#mathSprintScreen [data-action=next]:visible');
      if (await next.count()) await next.click(); else await page.waitForTimeout(100);
      continue;
    }
    await page.waitForTimeout(1150);
    await page.keyboard.type(String(state.problem.answer));
    await page.keyboard.press('Enter');
  }
  assert.ok((await inspect()).session.result, 'result screen reached');
  await page.locator('#mathSprintScreen .gt-result').waitFor({ state: 'visible', timeout: 15000 });
  const go = page.locator('#mathSprintScreen [data-action=open-evolution]');
  assert.equal(await go.isVisible(), true, 'evolution entry appears after reaching Lv5');
  await go.click();
  assert.equal(await page.locator('#yt-evolution-room').isVisible(), true, 'opens the evolution room');
  assert.equal(await page.locator('#yt-evolution-room [data-action=evolve]').isEnabled(), true);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ resultReached: true, evolutionEntry: true, roomOpened: true, errors: 0 }));
  await context.close();
} finally { await browser.close(); }
