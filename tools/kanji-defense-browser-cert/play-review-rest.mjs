import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { getDefaultSave } from '../../src/core/saveData.js';
import { predictShot, SCAN_ANGLES, BUBBLE_RULES } from '../../src/minigames/gotomonBubble/bubbleGame.js';
import { launchPreferredBrowser } from './helpers.mjs';

const mobile = process.argv.includes('--mobile');
const requested = process.argv.slice(2).filter(arg => arg !== '--mobile');
const games = requested.length ? requested : ['photoRally', 'proverbDetective'];
const base = new URL('../../artifacts/minigame-review-2026-10-05/', import.meta.url);
await fs.mkdir(base, { recursive: true });
const hostChunk = (await fs.readdir(new URL('../../dist/assets/', import.meta.url))).find(name => /^miniGameHost-.*\.js$/.test(name));
const { browser } = await launchPreferredBrowser(chromium);
const save = getDefaultSave();
save.player.name = 'ミニゲーム実操作';
save.player.collection.gotomonIds = ['HKD-E01', 'HKD-E02'];
save.meta.compatibilityEntries = { tutorial_seen_title: '1' };
const results = [];
try {
  for (const gameId of games) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 } });
    await context.addInitScript(value => {
      const text = JSON.stringify(value);
      localStorage.setItem('krb_save', text);
      localStorage.setItem('yomitabi_confirmed_1', text);
      localStorage.setItem('bgmVolume', '0');
      localStorage.setItem('seVolume', '0');
    }, save);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const inspect = () => page.evaluate(async url => (await import(url)).default.inspect(), `/assets/${hostChunk}`);
    await page.goto('http://127.0.0.1:4173/');
    await page.locator('#titleMiniGameButton').click();
    await page.locator('.yt-subject-tab[data-subject=all]').click();
    await page.locator(`[data-game-id=${gameId}]`).click();
    await page.locator('.yt-friend-choice').first().click();
    await page.locator('[data-action=start-game]').click();
    await page.locator('[data-action=start-play]').click();
    await page.screenshot({ path: new URL(`${gameId}-${mobile ? 'mobile' : 'desktop'}-start.png`, base).pathname.replace(/^\/(\w:)/, '$1') });
    let actions = 0;
    const started = Date.now();
    for (; actions < 1200; actions++) {
      const state = (await inspect()).session;
      if (state.result) break;
      if (gameId === 'gotomonOthello') {
        if (state.phase === 'answering') {
          const wrong = state.problem.choices.find(choice => choice.choiceId !== state.problem.correctChoiceId);
          await page.locator(`#gotomonOthelloScreen .ot-choices button[data-choice="${wrong.choiceId}"]`).click();
        } else if (state.phase === 'placing') {
          await page.locator('#gotomonOthelloScreen .ot-cell[data-legal=true]').first().click();
        } else await page.waitForTimeout(120);
        continue;
      }
      if (gameId === 'tripSugoroku' && state.phase === 'map') {
        await page.locator('#tripSugorokuScreen .tr-node:enabled').first().click({ force: true });
        continue;
      }
      if (gameId === 'tripSugoroku' && state.phase === 'reward') {
        await page.locator('#tripSugorokuScreen [data-action=next]').click();
        continue;
      }
      if (state.phase === 'feedback') {
        const next = page.locator(`#${gameId}Screen [data-action=next]:visible`);
        if (await next.count()) await next.click();
        else await page.waitForTimeout(100);
        continue;
      }
      if (gameId === 'gotomonParts') {
        const partner = state.target.parts.find((part, index) => index !== state.target.parts.indexOf(state.falling.part));
        const column = state.bases.find(base => base.part === partner)?.column;
        if (column === undefined) throw new Error('gotomonParts: partner not found');
        const box = await page.locator('#gotomonPartsScreen .kp-well').boundingBox();
        const x = box.x + box.width * (column + 0.5) / state.bases.length;
        const y = box.y + box.height * 0.5;
        await page.mouse.click(x, y);
        if (state.falling.column !== column) await page.mouse.click(x, y);
        continue;
      }
      if (gameId === 'gotomonPuyo') {
        await page.locator('#gotomonPuyoScreen [data-act=drop]').click();
        continue;
      }
      if (gameId === 'gotomonShooter') {
        const enemy = state.enemies.find(item => item.enemyId === state.problem.correctChoiceId);
        const box = await page.locator('#gotomonShooterScreen .ya-field').boundingBox();
        await page.mouse.click(box.x + box.width * enemy.x, box.y + box.height * enemy.y);
        await page.waitForTimeout(900);
        continue;
      }
      if (gameId === 'gotomonSnake') {
        const target = state.tokens.find(token => token.letter === state.next);
        if (!target) throw new Error('gotomonSnake: next letter not found');
        const directions = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] };
        const start = state.snake[0];
        const queue = [{ ...start, first: null }];
        const seen = new Set([`${start.c},${start.r}`]);
        const blocked = new Set(state.tokens.filter(token => token.letter !== state.next).map(token => `${token.c},${token.r}`));
        let direction = null;
        while (queue.length && !direction) {
          const current = queue.shift();
          for (const [name, [dc, dr]] of Object.entries(directions)) {
            const c = (current.c + dc + 9) % 9, r = (current.r + dr + 7) % 7, key = `${c},${r}`;
            if (seen.has(key) || blocked.has(key)) continue;
            const first = current.first ?? name;
            if (c === target.c && r === target.r) { direction = first; break; }
            seen.add(key); queue.push({ c, r, first });
          }
        }
        if (!direction) throw new Error('gotomonSnake: no route to letter');
        await page.locator(`#gotomonSnakeScreen [data-to=${direction}]`).click();
        await page.waitForTimeout(110);
        continue;
      }
      if (gameId === 'gotomonBreakout') {
        const board = page.locator('#gotomonBreakoutScreen .bk-board');
        const box = await board.boundingBox();
        if (!state.chosenId) {
          const block = state.blocks.find(item => item.number === state.problem.answer);
          await page.mouse.click(box.x + box.width * (block.x + block.w / 2) / 10, box.y + box.height * (block.y + block.h / 2) / 13);
          continue;
        }
        if (state.ball.held) {
          await page.locator('#gotomonBreakoutScreen .bk-launch').click();
          continue;
        }
        let x = state.ball.x;
        if (state.ball.vy > 0) {
          x += state.ball.vx * (12 - state.ball.y) / state.ball.vy;
          x = ((x % 20) + 20) % 20;
          if (x > 10) x = 20 - x;
        }
        await page.mouse.move(box.x + box.width * x / 10, box.y + box.height * 12 / 13);
        await page.waitForTimeout(65);
        continue;
      }
      if (gameId === 'kanjiMemory') {
        const pair = state.pairs.find(item => state.cards.some(card => card.pairId === item.pairId && !state.matched.includes(card.cardId)));
        if (!pair) throw new Error('kanjiMemory: pair not found');
        const cards = state.cards.filter(card => card.pairId === pair.pairId);
        for (const card of cards) await page.locator(`#kanjiMemoryScreen .mm-card[data-card-id="${card.cardId}"]`).click();
        await page.waitForTimeout(150);
        continue;
      }
      if (gameId === 'gotomonColoring') {
        const cell = state.cells.find(item => !item.painted);
        if (!cell) throw new Error('gotomonColoring: no unpainted cell');
        if (state.selected !== cell.color) await page.locator('#gotomonColoringScreen .cl-color').nth(cell.color).click();
        const index = state.cells.findIndex(item => item.cellId === cell.cellId);
        await page.locator('#gotomonColoringScreen button.cl-cell').nth(index).click({ force: true });
        continue;
      }
      if (gameId === 'gotomonMeteor') {
        if (!state.problem?.correctChoiceId) { await page.waitForTimeout(100); continue; }
        const slot = state.bases.findIndex(base => base.baseId === state.problem.correctChoiceId);
        await page.locator(`#gotomonMeteorScreen .mt-base[data-slot="${slot}"]`).click();
        await page.waitForTimeout(150);
        continue;
      }
      if (gameId === 'gotomonBubble') {
        const angle = SCAN_ANGLES.find(value => predictShot(state.bubbles, state.shift, value).touching.some(item => item.value === state.loaded.value));
        if (angle === undefined) throw new Error('gotomonBubble: no matching angle');
        const box = await page.locator('#gotomonBubbleScreen .gb-board').boundingBox();
        const x = box.x + (BUBBLE_RULES.shooter.x + 2 * Math.cos(angle)) / BUBBLE_RULES.columns * box.width;
        const y = box.y + (BUBBLE_RULES.shooter.y - 2 * Math.sin(angle)) / BUBBLE_RULES.height * box.height;
        await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.up();
        await page.waitForTimeout(250);
        continue;
      }
      const id = state.problem?.correctChoiceId;
      if (!id) throw new Error(`${gameId}: no correct choice at action ${actions}: ${JSON.stringify(state).slice(0, 1800)}`);
      let choice;
      if (gameId === 'gotomonDelivery') choice = `.gd-choice[data-name="${id}"]`;
      else if (gameId === 'gotomonFishing') choice = `.fs-swimmer[data-index="${state.swimmers.findIndex(item => item.swimmerId === id)}"]`;
      else if (gameId === 'gotomonToss') choice = `.gt-carrier[data-index="${state.baskets.findIndex(item => item.basketId === id)}"]`;
      else if (gameId === 'gotomonShop') choice = `.gs-kanji[data-cell-id="${id}"]`;
      else if (gameId === 'kanjiSort') choice = `.ks-card[data-card-id="${id}"]`;
      else if (gameId === 'kanjiBingo') choice = `.kb-cell[data-cell-id="${id}"]`;
      else choice = `[data-choice-id="${id}"]`;
      await page.locator(`#${gameId}Screen ${choice}`).click({ force: true });
      await page.waitForTimeout(150);
    }
    const final = (await inspect()).session;
    await page.screenshot({ path: new URL(`${gameId}-${mobile ? 'mobile' : 'desktop'}-end.png`, base).pathname.replace(/^\/(\w:)/, '$1') });
    const result = { gameId, completed: !!final.result, actions, elapsedMs: Date.now() - started,
      answered: final.answered, correct: final.correct, result: final.result,
      resultText: gameId === 'gotomonOthello' ? await page.locator('#gotomonOthelloScreen [data-role=feedback]').textContent() : undefined, errors };
    results.push(result);
    console.log(JSON.stringify(result));
    await context.close();
  }
} finally {
  await fs.writeFile(new URL('results.json', base), JSON.stringify(results, null, 2));
  await browser.close();
}
