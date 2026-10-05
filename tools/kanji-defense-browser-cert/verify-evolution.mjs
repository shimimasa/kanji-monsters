import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { getDefaultSave } from '../../src/core/saveData.js';
import { XP_THRESHOLDS } from '../../src/minigames/companionGrowth.js';
import { launchPreferredBrowser } from './helpers.mjs';

const out = new URL('../../artifacts/evolution-review/', import.meta.url);
await fs.mkdir(out, { recursive: true });
const { browser } = await launchPreferredBrowser(chromium);
const verified = [];
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    for (const ready of [false, true]) {
      const context = await browser.newContext({ viewport });
      const save = getDefaultSave();
      save.player.name = 'しんか確認';
      save.player.collection.gotomonIds = ['HKD-E01'];
      save.player.miniGames = { version: 1, games: {}, selectedGotomonId: 'HKD-E01', companions: {
        'HKD-E01': { plays: 0, friendship: 0, medals: [], xp: XP_THRESHOLDS[4] - (ready ? 0 : 1) },
      } };
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
      await page.locator('[data-action=evolution]').waitFor({ state: 'visible' });
      await page.screenshot({ path: new URL(`${viewport.width}-${ready ? 'ready' : 'waiting'}-hub.png`, out).pathname.replace(/^\/(\w:)/, '$1') });
      await page.locator('[data-action=evolution]').click();
      const room = page.locator('#yt-evolution-room');
      assert.equal(await room.isVisible(), true);
      const action = room.locator('[data-action=evolve]');
      const label = `${viewport.width}-${ready ? 'ready' : 'waiting'}`;
      await page.screenshot({ path: new URL(`${label}-before.png`, out).pathname.replace(/^\/(\w:)/, '$1') });
      if (!ready) {
        assert.equal(await action.isDisabled(), true);
        assert.match(await room.innerText(), /あと 1 XP/);
      } else {
        assert.equal(await action.isEnabled(), true);
        await action.click();
        await page.getByText('しんかした！', { exact: false }).waitFor();
        const stored = await page.evaluate(() => {
          const a = localStorage.getItem('krb_save'), b = localStorage.getItem('yomitabi_confirmed_1');
          return { same: a === b, look: JSON.parse(a).player.miniGames.companions['HKD-E01'].look };
        });
        assert.equal(stored.same, true);
        assert.equal(stored.look.evolve, true);
        await page.screenshot({ path: new URL(`${label}-evolved.png`, out).pathname.replace(/^\/(\w:)/, '$1') });
        await action.click();
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('krb_save')).player.miniGames.companions['HKD-E01'].look.evolve), false);
        await room.getByRole('button', { name: '広場へもどる' }).click();
        await page.locator('[data-action=sticker-book]').click();
        await page.locator('[data-action=open-evolution]').click();
        assert.equal(await room.isVisible(), true);
      }
      assert.deepEqual(errors, []);
      verified.push({ viewport, ready, errors: errors.length });
      await context.close();
    }
  }
} finally { await browser.close(); }
console.log(JSON.stringify(verified));
