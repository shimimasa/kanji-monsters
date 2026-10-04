// Content-only recertification copy. Historical Candidate browser audit is retained unchanged.
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { getDefaultSave } from '../../src/core/saveData.js';
import { KANJI_DEFENSE_LIMITED_UX_CONTENT } from '../../src/minigames/kanjiDefense/kanjiDefenseContent.js';
import { launchPreferredBrowser } from './helpers.mjs';

const base = process.env.YOMITABI_QA_URL || 'http://127.0.0.1:5188';
const out = new URL('../../artifacts/content-120/browser-flow/', import.meta.url);
await fs.mkdir(out, { recursive: true });
const { browser, name } = await launchPreferredBrowser(chromium);
const evidence = { browser: name, checks: [], errors: [], screenshots: [] };
const save = getDefaultSave(); save.player.name = 'あいぼうQA'; save.player.coreStats.exp = 42;
save.player.collection.gotomonIds = ['HKD-E01', 'HKD-E02'];
const readings = Object.fromEntries(KANJI_DEFENSE_LIMITED_UX_CONTENT.map(item => [item.prompt, item.acceptedReadings[0]]));
const ids = ['mathSprint','mathInvader','englishChoice','sentenceOrder','timedChoice','multiSelect','asyncChoice','kanjiDefense'];
async function contextWithSave(value, viewport = { width: 390, height: 844 }) {
  value.meta.compatibilityEntries = Object.fromEntries(['title','courseSelect','stageSelect','battle','regionSelect'].map(id => [`tutorial_seen_${id}`, '1']));
  const context = await browser.newContext({ viewport });
  await context.route(/https:\/\/.*/, route => route.abort());
  await context.addInitScript(value => {
    if (!sessionStorage.getItem('qa-seeded')) {
      localStorage.setItem('krb_save', JSON.stringify(value));
      localStorage.setItem('bgmVolume', '0'); localStorage.setItem('seVolume', '0');
      for (const id of ['title','stageSelect','battle','regionSelect']) localStorage.setItem(`tutorial_seen_${id}`, '1');
      sessionStorage.setItem('qa-seeded', '1');
    }
  }, value);
  const page = await context.newPage(); page.on('pageerror', error => evidence.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') console.log('BROWSER:', message.text().slice(0,240)); });
  await page.goto(base, { waitUntil: 'domcontentloaded' }); await expect(page.locator('#titleMiniGameButton')).toBeVisible({ timeout: 30000 });
  return { context, page };
}
async function shot(page, file) {
  await page.screenshot({ path: new URL(file, out).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true }); evidence.screenshots.push(file);
}
async function state(page) { return page.evaluate(() => window.fsm.currentState.inspect().session); }
async function layout(page, label) {
  const bad = await page.locator('.yt-world, .yt-game').evaluateAll(roots => roots.filter(root => root.scrollWidth > root.clientWidth + 2).map(root => root.id));
  expect(bad, `${label}: horizontal overflow`).toEqual([]);
  evidence.checks.push(`${label}: no horizontal overflow`);
}
async function start(page, id) {
  await page.locator(`[data-game-id="${id}"]`).click();
  await expect(page.locator('[data-gotomon-id="HKD-E03"]')).toHaveCount(0);
  await page.locator('[data-gotomon-id="HKD-E02"]').click();
  await page.locator('[data-action=start-game]').click();
  await expect(page.locator('.yt-game')).toBeVisible();
  await expect(page.locator('.gt-actor')).toHaveAttribute('data-gotomon-id', 'HKD-E02');
}
async function answer(page, id) {
  let s = await state(page);
  if (s.phase === 'feedback') { await page.locator('[data-action=next]:visible').click(); return; }
  if (id === 'asyncChoice') { const routes=page.locator('[data-action=explore]:not(:disabled)'); if(await routes.count())await routes.first().click(); }
  if (id === 'mathSprint') {
    await page.getByRole('textbox', { name: 'こたえ', exact: true }).fill(String(s.problem.answer));
    await page.locator('[data-action=answer]').click();
  } else if (['mathInvader','kanjiDefense'].includes(id)) {
    await expect(page.locator('[data-enemy-id]').first()).toBeVisible({ timeout: 5000 });
    const target = await page.locator('[data-enemy-id]').first().boundingBox();
    await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2); s = await state(page);
    await page.locator('.yt-game input[type=text]').fill(String(id === 'mathInvader' ? s.selectedEnemy.answer : readings[s.selectedEnemy.prompt]));
    await page.locator('[data-action=answer]').click();
  } else if (id === 'sentenceOrder') {
    for (let i = 0; i < s.problem.correctOrder.length; i++) {
      let current = await state(page), wanted = s.problem.correctOrder[i];
      while (current.currentOrder.indexOf(wanted) > i) {
        await page.locator(`[data-chunk-id="${wanted}"]`).click(); await page.locator('[data-action=move-left]').click(); current = await state(page);
      }
    }
    await page.locator('[data-action=submit]').click();
  } else if (id === 'multiSelect') {
    for (const choice of s.problem.correctChoiceIds) await page.locator(`[data-choice-id="${choice}"]`).click();
    await page.locator('[data-action=submit]').click();
  } else {
    await page.locator(`[data-choice-id="${s.problem.correctChoiceId}"]`).click();
  }
}
try {
  const { context, page } = await contextWithSave(save);
  await expect(page.locator('#titleMiniGameButtons')).toHaveCount(0);
  await expect(page.locator('#adventureTitle [data-game-id]')).toHaveCount(0);
  await shot(page, 'title-390.png');
  await page.locator('#titleAdventureButton').click();
  await expect.poll(() => page.evaluate(() => window.fsm.currentState === window.fsm.states.courseSelect)).toBe(true);
  evidence.checks.push('title → adventure course selection');
  await page.goto(base); await page.locator('#titleMiniGameButton').click();
  await expect(page.locator('.yt-game-card')).toHaveCount(8);
  for (const [width, height] of [[390,844],[412,915],[768,1024],[1366,768],[1920,1080]]) {
    await page.setViewportSize({width,height}); await layout(page, `hub ${width}x${height}`); await shot(page, `hub-${width}.png`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const id of ids) {
    await start(page, id); await layout(page, `${id} 390x844`); await shot(page, `${id}-390.png`);
    await page.locator('[data-action=pause]').click(); const paused = await state(page);
    await page.waitForTimeout(100); expect((await state(page)).activeElapsedMs).toBe(paused.activeElapsedMs);
    for (const [width,height] of [[412,915],[768,1024],[1366,768],[1920,1080]]) {
      await page.setViewportSize({width,height}); await layout(page, `${id} ${width}x${height}`);
      await shot(page, `${id}-${width}.png`);
    }
    await page.setViewportSize({width:390,height:844});
    await page.locator('[data-action=pause]').click();
    let guard = 0;
    while (!(await state(page)).result && guard++ < 35) {
      await answer(page, id);
      const boost = page.locator('[data-action=boost]'); if (await boost.isEnabled()) await boost.click();
    }
    expect((await state(page)).result, `${id} completion`).toBeTruthy();
    await expect(page.locator('.gt-result')).toBeVisible();
    await expect(page.locator('.gt-reward')).toContainText('なかよし');
    await shot(page, `${id}-result.png`);
    const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('krb_save')).player);
    expect(progress.collection.gotomonIds).toEqual(save.player.collection.gotomonIds); expect(progress.coreStats.exp).toBe(42);
    expect(progress.miniGames.games[id].plays).toBe(1); expect(progress.miniGames.selectedGotomonId).toBe('HKD-E02');
    const oldSession = (await state(page)).sessionId;
    await page.locator('.gt-result [data-action=replay]:visible').click(); expect((await state(page)).sessionId).not.toBe(oldSession);
    await page.locator('[data-action=back]').click(); await expect(page.locator('#miniGameHub')).toBeVisible();
    evidence.checks.push(`${id}: choose owned → start → answer → boost → result/save → replay → hub; pause freezes clock`);
  }
  await page.reload(); await page.locator('#titleMiniGameButton').click(); await page.locator('[data-game-id=mathSprint]').click();
  await expect(page.locator('[data-gotomon-id="HKD-E02"]')).toHaveAttribute('aria-pressed','true'); evidence.checks.push('selection and best persist across reload');
  await page.locator('[data-action=start-game]').click();
  await page.getByRole('button',{name:'音量',exact:true}).click();
  for (const [name,steps] of [['BGM音量',7],['効果音音量',9]]) {
    await page.getByRole('slider',{name,exact:true}).focus(); await page.keyboard.press('Home');
    for (let i=0;i<steps;i++) await page.keyboard.press('ArrowRight');
  }
  await page.locator('[data-action=back]').click();
  await start(page,'sentenceOrder');
  await page.getByRole('button',{name:'音量',exact:true}).click();
  await expect(page.getByRole('slider',{name:'BGM音量',exact:true})).toHaveValue('0.35');
  await expect(page.getByRole('slider',{name:'効果音音量',exact:true})).toHaveValue('0.45');
  const beforePause = (await state(page)).answered;
  await page.locator('[data-action=pause]').focus(); await page.keyboard.press('Enter');
  expect((await state(page)).paused).toBe(true); expect((await state(page)).answered).toBe(beforePause);
  await page.keyboard.press('Enter'); expect((await state(page)).paused).toBe(false);
  await page.getByRole('button',{name:'ミュート',exact:true}).click();
  await page.reload(); await page.locator('#titleMiniGameButton').click(); await start(page,'mathSprint');
  await page.getByRole('button',{name:'音量',exact:true}).click();
  await expect(page.getByRole('slider',{name:'BGM音量',exact:true})).toHaveValue('0');
  await expect(page.getByRole('slider',{name:'効果音音量',exact:true})).toHaveValue('0');
  evidence.checks.push('BGM/SE survive game transitions; mute survives reload; Enter on pause never submits sentence');
  await context.close();
  const empty = getDefaultSave(); const fresh = await contextWithSave(empty);
  await fresh.page.locator('#titleMiniGameButton').click(); await fresh.page.locator('[data-game-id=mathSprint]').click();
  await expect(fresh.page.locator('[data-action=start-game]')).toBeDisabled(); evidence.checks.push('uncaptured companion cannot play');
  await fresh.page.locator('dialog button', {hasText:'閉じる'}).click(); await fresh.page.getByRole('button',{name:'タイトルへ',exact:true}).click();
  await fresh.page.locator('#titleAdventureButton').click();
  await expect.poll(() => fresh.page.evaluate(() => window.fsm.currentState === window.fsm.states.playerNameInput)).toBe(true);
  evidence.checks.push('new save title → name entry'); await fresh.context.close();
  const missing = await contextWithSave(save);
  await missing.context.route('**/HKD-E02.webp', route => route.abort());
  await missing.page.locator('#titleMiniGameButton').click(); await start(missing.page,'mathSprint');
  await expect(missing.page.locator('.gt-actor .gt-image-fallback')).toBeVisible();
  await answer(missing.page,'mathSprint'); expect((await state(missing.page)).correct).toBe(1);
  evidence.checks.push('missing companion image falls back to its own name and preserves answers'); await missing.context.close();
  expect(evidence.errors).toEqual([]); evidence.status = 'PASS';
} catch (error) { evidence.status = 'FAIL'; evidence.failure = error.stack; console.error(error); process.exitCode = 1; }
finally { await browser.close(); await fs.writeFile(new URL('results.json',out), JSON.stringify(evidence,null,2)); console.log(JSON.stringify(evidence,null,2)); }
