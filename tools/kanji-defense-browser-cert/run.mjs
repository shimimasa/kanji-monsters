import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { KANJI_DEFENSE_GOLDEN_CONTENT } from '../../src/minigames/kanjiDefense/kanjiDefenseContent.js';
import { getDefaultSave } from '../../src/core/saveData.js';
import {
  addResult, createRunDirectory, delay, findFreePort, launchPreferredBrowser,
  runLogged, spawnLogged, stopProcess, waitForHttp, writeJson,
} from './helpers.mjs';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, '..', '..');
const npmCommand = process.env.npm_execpath ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm');
const npmPrefix = process.env.npm_execpath ? [process.env.npm_execpath] : [];
const runDir = await createRunDirectory(repoRoot);
const screenshotsDir = path.join(runDir, 'screenshots');
await fs.mkdir(screenshotsDir, { recursive: true });

const answerByPrompt = Object.fromEntries(KANJI_DEFENSE_GOLDEN_CONTENT.map(item => [item.prompt, item.acceptedReadings[0]]));
const qaSave = getDefaultSave();
qaSave.player.name = 'Browser QA';
qaSave.settings.bgmVolume = 0;
qaSave.settings.seVolume = 0;
const result = {
  schemaVersion: 1,
  gameId: 'kanjiDefense',
  startedAt: new Date().toISOString(),
  status: 'RUNNING',
  environment: { platform: process.platform, arch: process.arch, node: process.version, runDir },
  browser: null,
  server: null,
  checks: [],
  screenshots: [],
  console: [],
  pageErrors: [],
  network: [],
  expectedExternalRequests: [],
  unexpectedExternalRequests: [],
  measurements: {},
  performance: {},
  issues: [],
  manualResidualGates: [
    { id: 'actual-windows-ime', status: 'MANUAL_REQUIRED' },
    { id: 'real-mobile-soft-keyboard', status: 'MANUAL_REQUIRED' },
  ],
};

const record = (id, category, status, actual, expected, evidence = [], viewport = null) =>
  addResult(result, { id, category, viewport, status, actual, expected, evidence });
const pass = (id, category, actual, expected, evidence = [], viewport = null) =>
  record(id, category, 'PASS', actual, expected, evidence, viewport);
const fail = (id, category, actual, expected, evidence = [], viewport = null) => {
  record(id, category, 'FAIL', actual, expected, evidence, viewport);
  result.issues.push({ id, category, actual, expected, severity: 'BLOCKER' });
};
const verify = (condition, id, category, actual, expected, evidence = [], viewport = null) => {
  if (condition) pass(id, category, actual, expected, evidence, viewport);
  else fail(id, category, actual, expected, evidence, viewport);
  return condition;
};

let browser;
let preview;
let mainContext;
let mainPage;
let cdp;

const screenshot = async (page, name) => {
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(screenshotsDir, file), fullPage: false });
  result.screenshots.push(`screenshots/${file}`);
  return `screenshots/${file}`;
};

async function configureContext(context, origin, { failMonsterImages = false } = {}) {
  const expectedExternalOrigins = new Set(['https://www.gstatic.com']);
  await context.addInitScript(({ save }) => {
    if (!location.protocol.startsWith('http')) return;
    localStorage.setItem('krb_save', save);
    localStorage.setItem('tutorialEnabled', '0');
    localStorage.setItem('tutorial_seen_title', '1');
    localStorage.setItem('inputMethod', 'device');
    window.__kdBrowserQa = { gameRaf: 0, gameIntervals: 0, longTasks: [] };
    const originalRaf = window.requestAnimationFrame;
    const originalInterval = window.setInterval;
    window.requestAnimationFrame = function(callback) {
      if (new Error().stack?.includes('/src/minigames/kanjiDefense/')) window.__kdBrowserQa.gameRaf++;
      return originalRaf.call(this, callback);
    };
    window.setInterval = function(callback, timeout, ...args) {
      if (new Error().stack?.includes('/src/minigames/kanjiDefense/')) window.__kdBrowserQa.gameIntervals++;
      return originalInterval.call(this, callback, timeout, ...args);
    };
    try {
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (document.getElementById('kanjiDefenseScreen')) {
            window.__kdBrowserQa.longTasks.push({ startTime: entry.startTime, duration: entry.duration });
          }
        }
      }).observe({ type: 'longtask', buffered: false });
    } catch { /* Unsupported browsers report an empty long-task list. */ }
  }, { save: JSON.stringify(qaSave) });
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (failMonsterImages && /\/assets\/images\/monsters\/full\/grade4-chuubu\//.test(url)) {
      return route.abort('failed');
    }
    let parsed;
    try { parsed = new URL(url); } catch { return route.continue(); }
    if (['data:', 'blob:', 'about:'].includes(parsed.protocol) || parsed.origin === origin) return route.continue();
    if (expectedExternalOrigins.has(parsed.origin)) {
      result.expectedExternalRequests.push({ url, method: route.request().method(), disposition: 'intentionally blocked in isolated QA' });
      return route.abort('blockedbyclient');
    }
    result.unexpectedExternalRequests.push({ url, method: route.request().method() });
    return route.abort('blockedbyclient');
  });
}

async function createPage(origin, viewport, options = {}) {
  const context = await browser.newContext({
    viewport, locale: 'ja-JP', timezoneId: 'Asia/Tokyo', colorScheme: 'light',
    hasTouch: options.hasTouch ?? false, isMobile: options.isMobile ?? false,
  });
  await configureContext(context, origin, options);
  const page = await context.newPage();
  page.on('console', message => result.console.push({
    type: message.type(), text: message.text(), location: message.location(), page: options.name ?? 'page',
  }));
  page.on('pageerror', error => result.pageErrors.push({ message: error.message, stack: error.stack, page: options.name ?? 'page' }));
  page.on('request', request => result.network.push({ event: 'request', method: request.method(), url: request.url(), page: options.name ?? 'page' }));
  page.on('response', response => result.network.push({ event: 'response', status: response.status(), url: response.url(), page: options.name ?? 'page' }));
  page.on('requestfailed', request => result.network.push({ event: 'requestfailed', url: request.url(), error: request.failure()?.errorText, page: options.name ?? 'page' }));
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.locator('#titleKanjiDefenseButton').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('#bootProgress').waitFor({ state: 'detached', timeout: 30000 });
  return { context, page };
}

const inspect = page => page.evaluate(() => window.fsm?.states?.miniGame?.inspect());
const session = async page => (await inspect(page))?.session;
const input = page => page.getByRole('textbox', { name: '選んだ漢字の読み' });
const submit = page => page.locator('[data-action="answer"]');

async function enterGame(page) {
  await page.locator('#titleKanjiDefenseButton').click();
  await page.locator('#kanjiDefenseScreen').waitFor({ state: 'visible' });
  await page.waitForFunction(() => window.fsm?.states?.miniGame?.inspect()?.session?.gameId === 'kanjiDefense');
  await page.locator('.kd-monster').first().waitFor({ state: 'visible' });
}

async function advance(page, ms) {
  await page.evaluate(value => window.fsm.states.miniGame.update(value), ms);
}

async function ensureEnemy(page) {
  if ((await session(page)).enemies.length === 0) {
    await advance(page, 800);
    await page.waitForFunction(() => window.fsm.states.miniGame.inspect().session?.enemies.length > 0);
  }
}

async function selectEnemy(page, index = 0) {
  await ensureEnemy(page);
  const monsters = page.locator('.kd-monster');
  const count = await monsters.count();
  if (index >= count) throw new Error(`Monster index ${index} unavailable; count=${count}`);
  const enemyId = await monsters.nth(index).getAttribute('data-enemy-id');
  await monsters.nth(index).click();
  await page.waitForFunction(id => window.fsm.states.miniGame.inspect().session?.selectedEnemyId === id, enemyId);
  return (await session(page)).selectedEnemy;
}

async function answerSelected(page, value, terminalExpected) {
  const before = await session(page);
  const started = Date.now();
  await input(page).fill(value);
  await submit(page).click();
  if (terminalExpected) {
    await page.waitForFunction(resolved => window.fsm.states.miniGame.inspect().session?.resolved > resolved, before.resolved);
  } else {
    await page.waitForFunction(wrong => window.fsm.states.miniGame.inspect().session?.wrongAttempts > wrong, before.wrongAttempts);
  }
  return { before, after: await session(page), latencyMs: Date.now() - started };
}

async function correctCurrent(page, { keyboard = false } = {}) {
  let state = await session(page);
  if (!state.selectedEnemy) await selectEnemy(page);
  state = await session(page);
  const answer = answerByPrompt[state.selectedEnemy.prompt];
  if (!answer) throw new Error(`No QA answer for ${state.selectedEnemy.prompt}`);
  const started = Date.now();
  await input(page).fill(answer);
  if (keyboard) await page.keyboard.press('Enter'); else await submit(page).click();
  await page.waitForFunction(resolved => window.fsm.states.miniGame.inspect().session?.resolved > resolved, state.resolved);
  return Date.now() - started;
}

async function resolveUntil(page, target) {
  let guard = 0;
  while (!(await session(page)).result && (await session(page)).resolved < target) {
    if (++guard > 30) throw new Error(`resolveUntil guard: ${target}`);
    await ensureEnemy(page);
    await selectEnemy(page);
    await correctCurrent(page);
  }
}

async function completeSession(page) {
  let guard = 0;
  while (!(await session(page)).result) {
    if (++guard > 30) throw new Error('completeSession guard');
    await ensureEnemy(page);
    await selectEnemy(page);
    await correctCurrent(page);
  }
}

async function measureLayout(page, label) {
  const value = await page.evaluate(() => {
    const metric = element => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        width: rect.width, height: rect.height, x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom,
        clientWidth: element.clientWidth, scrollWidth: element.scrollWidth,
        display: style.display, visibility: style.visibility, outlineWidth: style.outlineWidth,
      };
    };
    const root = document.getElementById('kanjiDefenseScreen');
    return {
      viewport: { width: innerWidth, height: innerHeight, visualWidth: visualViewport?.width, visualHeight: visualViewport?.height },
      documentElement: metric(document.documentElement), body: metric(document.body), root: metric(root),
      board: metric(root?.querySelector('.kd-board')), monster: metric(root?.querySelector('.kd-monster')),
      submit: metric(root?.querySelector('[data-action="answer"]')), back: metric(root?.querySelector('[data-action="back"]')),
      replay: metric(root?.querySelector('[data-action="replay"]')), input: metric(root?.querySelector('input')),
      selected: metric(root?.querySelector('.kd-monster[aria-pressed="true"]')),
      companion: metric(root?.querySelector('.kd-companion')),
    };
  });
  result.measurements[label] = value;
  return value;
}

const noHorizontalOverflow = metrics => ['documentElement', 'body', 'root', 'board']
  .every(key => !metrics[key] || metrics[key].scrollWidth <= metrics[key].clientWidth + 1);
const controlsAtLeast44 = (metrics, names) => names.every(name => metrics[name] && metrics[name].width >= 44 && metrics[name].height >= 44);
const rectVisible = (rect, viewport) => rect && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.y < viewport.height;
const rectFullyVisible = (rect, viewport) => rect && rect.width > 0 && rect.height > 0 && rect.x >= 0 && rect.y >= 0 &&
  rect.right <= viewport.width && rect.bottom <= viewport.height;

async function mainCertification(origin) {
  ({ context: mainContext, page: mainPage } = await createPage(origin, { width: 1280, height: 720 }, { name: 'main' }));
  cdp = await mainContext.newCDPSession(mainPage);
  await cdp.send('Performance.enable');

  await enterGame(mainPage);
  const firstShot = await screenshot(mainPage, 'desktop-first-monster');
  verify(await mainPage.locator('.kd-monster').count() === 1, 'desktop-first-monster', 'desktop', await mainPage.locator('.kd-monster').count(), 1, [firstShot], '1280x720');

  await mainPage.keyboard.press('Tab');
  const initialFocus = await mainPage.evaluate(() => ({
    action: document.activeElement?.dataset?.action,
    focusVisible: document.activeElement?.matches?.(':focus-visible'),
    outline: getComputedStyle(document.activeElement).outlineWidth,
  }));
  verify(initialFocus.action === 'back' && initialFocus.focusVisible, 'focus-visible-back', 'keyboard', initialFocus, 'Back focused visibly');

  const firstState = await session(mainPage);
  const firstLaneKey = String(firstState.enemies[0].lane + 1);
  await mainPage.keyboard.press(firstLaneKey);
  await mainPage.waitForFunction(() => !!window.fsm.states.miniGame.inspect().session?.selectedEnemy);
  const laneFocus = await mainPage.evaluate(() => ({
    tag: document.activeElement?.tagName, label: document.activeElement?.getAttribute('aria-label'),
    pressed: document.querySelector('.kd-monster[aria-pressed="true"]')?.getAttribute('aria-pressed'),
  }));
  verify(laneFocus.tag === 'INPUT' && laneFocus.pressed === 'true', 'keyboard-lane-select', 'keyboard', laneFocus, 'lane key selects and focuses input');

  await input(mainPage).fill('か');
  await mainPage.evaluate(() => window.fsm.states.miniGame.setPaused(true));
  const pauseStarted = await session(mainPage);
  const pauseBefore = pauseStarted.enemies.map(enemy => ({ id: enemy.enemyId, progress: enemy.progress }));
  await delay(350);
  const pauseDuring = await session(mainPage);
  const pausedText = await input(mainPage).inputValue();
  verify(JSON.stringify(pauseDuring.enemies.map(enemy => ({ id: enemy.enemyId, progress: enemy.progress }))) === JSON.stringify(pauseBefore) && pausedText === 'か' && pauseDuring.paused,
    'manual-pause-freeze', 'pause', { before: pauseBefore, during: pauseDuring.enemies, text: pausedText }, 'positions/text preserved');
  await mainPage.evaluate(() => window.fsm.states.miniGame.setPaused(false));

  const firstLatency = await correctCurrent(mainPage, { keyboard: true });
  pass('desktop-correct', 'smoke', { resolved: (await session(mainPage)).resolved, latencyMs: firstLatency }, 'one correct resolution', [], '1280x720');

  await ensureEnemy(mainPage); await selectEnemy(mainPage);
  const wrongBefore = await session(mainPage);
  const wrong = await answerSelected(mainPage, 'あああ', false);
  const retryText = await mainPage.locator('.kd-feedback').innerText();
  const retryShot = await screenshot(mainPage, 'desktop-first-wrong-retry');
  verify(wrong.after.resolved === wrongBefore.resolved && wrong.after.life === wrongBefore.life && wrong.after.selectedEnemy && /もう一度/.test(retryText),
    'first-wrong-retry', 'smoke', { before: wrongBefore, after: wrong.after, feedback: retryText }, 'Monster/life retained and retry visible', [retryShot]);
  await correctCurrent(mainPage);
  pass('retry-correct', 'smoke', (await session(mainPage)).resolved, 2);

  await ensureEnemy(mainPage); await selectEnemy(mainPage);
  const secondWrongStart = await session(mainPage);
  await answerSelected(mainPage, 'あああ', false);
  await answerSelected(mainPage, 'あああ', true);
  const secondWrongEnd = await session(mainPage);
  verify(secondWrongEnd.resolved === secondWrongStart.resolved + 1 && secondWrongEnd.incorrect === secondWrongStart.incorrect + 1,
    'second-wrong-terminal', 'smoke', secondWrongEnd, 'one terminal incorrect');

  await ensureEnemy(mainPage);
  const escapeBefore = await session(mainPage);
  const escape = await mainPage.evaluate(() => {
    const host = window.fsm.states.miniGame;
    const start = host.inspect().session.life;
    let updates = 0;
    while (host.inspect().session?.life === start && updates < 5000) { host.update(250); updates++; }
    return { updates, state: host.inspect().session };
  });
  verify(escape.state.life === escapeBefore.life - 1 && escape.state.incorrect === escapeBefore.incorrect + 1,
    'escape-life', 'smoke', escape, 'one escape and one life decrement');

  let current = await session(mainPage);
  if (current.resolved < 4) await resolveUntil(mainPage, 4);
  await ensureEnemy(mainPage);
  await advance(mainPage, 4700);
  current = await session(mainPage);
  verify(current.enemies.length === 2, 'two-monster-state', 'smoke', current.enemies.length, 2);
  await resolveUntil(mainPage, 9);
  await ensureEnemy(mainPage);
  await advance(mainPage, 3700); await advance(mainPage, 3700);
  current = await session(mainPage);
  verify(current.enemies.length === 3, 'three-monster-state', 'three-monster', current.enemies.map(enemy => ({ lane: enemy.lane, prompt: enemy.prompt, threat: enemy.threat })), 'three unique lanes/prompts');
  await selectEnemy(mainPage, 1);
  const threeAccessibility = await mainPage.evaluate(() => ({
    lanes: [...document.querySelectorAll('.kd-lane')].map(node => node.dataset.lane),
    labels: [...document.querySelectorAll('.kd-monster')].map(node => node.getAttribute('aria-label')),
    selectedText: document.querySelector('.kd-monster[aria-pressed="true"] .kd-marker')?.textContent,
    selectedPressed: document.querySelector('.kd-monster[aria-pressed="true"]')?.getAttribute('aria-pressed'),
    threatTexts: [...document.querySelectorAll('.kd-threat')].map(node => node.textContent),
  }));
  verify(threeAccessibility.lanes.length === 3 && threeAccessibility.labels.every(Boolean) && threeAccessibility.selectedText.includes('選択中') && threeAccessibility.selectedPressed === 'true' && threeAccessibility.threatTexts.every(Boolean),
    'three-monster-semantic-readability', 'three-monster', threeAccessibility, 'lane/label/selected/threat semantics');
  const threeShot = await screenshot(mainPage, 'desktop-three-monsters');

  const desktopMetrics = await measureLayout(mainPage, 'desktop-1280x720-three');
  verify(noHorizontalOverflow(desktopMetrics), 'desktop-overflow', 'overflow', desktopMetrics, 'no horizontal overflow', [threeShot], '1280x720');
  verify(controlsAtLeast44(desktopMetrics, ['monster', 'submit', 'back']), 'desktop-touch-targets', 'touch', desktopMetrics, 'monster/submit/back >=44x44', [], '1280x720');

  await mainPage.setViewportSize({ width: 390, height: 844 }); await delay(120);
  const portraitMetrics = await measureLayout(mainPage, 'portrait-390x844-three');
  const portraitShot = await screenshot(mainPage, 'portrait-390x844-three-monsters');
  verify(noHorizontalOverflow(portraitMetrics), 'portrait-overflow', 'overflow', portraitMetrics, 'no horizontal overflow', [portraitShot], '390x844');
  verify(controlsAtLeast44(portraitMetrics, ['monster', 'submit', 'back']), 'portrait-touch-targets', 'touch', portraitMetrics, 'monster/submit/back >=44x44', [], '390x844');
  verify(rectVisible(portraitMetrics.monster, portraitMetrics.viewport) && rectVisible(portraitMetrics.input, portraitMetrics.viewport),
    'portrait-readability', 'portrait', portraitMetrics, 'Monster and input visible', [portraitShot], '390x844');
  await input(mainPage).focus();
  const portraitFocusedShot = await screenshot(mainPage, 'portrait-390x844-focused-input');
  await mainPage.setViewportSize({ width: 390, height: 500 }); await delay(120);
  const keyboardProxy = await measureLayout(mainPage, 'portrait-390x500-keyboard-proxy');
  const keyboardProxyShot = await screenshot(mainPage, 'portrait-390x500-keyboard-proxy');
  verify(noHorizontalOverflow(keyboardProxy) && rectVisible(keyboardProxy.input, keyboardProxy.viewport) && rectVisible(keyboardProxy.selected, keyboardProxy.viewport),
    'soft-keyboard-viewport-proxy', 'soft-keyboard', keyboardProxy, 'focused input and selected Monster visible without horizontal overflow', [portraitFocusedShot, keyboardProxyShot], '390x500');

  await mainPage.setViewportSize({ width: 844, height: 390 }); await delay(120);
  const landscapeMetrics = await measureLayout(mainPage, 'landscape-844x390-three');
  const landscapeShot = await screenshot(mainPage, 'landscape-844x390-three-monsters');
  verify(noHorizontalOverflow(landscapeMetrics), 'landscape-overflow', 'overflow', landscapeMetrics, 'no horizontal overflow', [landscapeShot], '844x390');
  verify(controlsAtLeast44(landscapeMetrics, ['monster', 'submit', 'back']), 'landscape-touch-targets', 'touch', landscapeMetrics, 'monster/submit/back >=44x44', [], '844x390');
  verify(rectFullyVisible(landscapeMetrics.monster, landscapeMetrics.viewport) && rectFullyVisible(landscapeMetrics.input, landscapeMetrics.viewport) &&
    rectFullyVisible(landscapeMetrics.submit, landscapeMetrics.viewport),
    'landscape-readability', 'landscape', landscapeMetrics, 'Monster, input and Submit fully visible', [landscapeShot], '844x390');

  await mainPage.setViewportSize({ width: 1280, height: 720 });
  const actionLatencies = [];
  while (!(await session(mainPage)).result) actionLatencies.push(await correctCurrent(mainPage));
  const completed = await session(mainPage);
  verify(completed.result && completed.result.resolved === 12 && completed.combo > 0,
    'desktop-result', 'smoke', completed.result, '12 resolved result with combo');
  const resultShot = await screenshot(mainPage, 'desktop-result');
  const resultMetrics = await measureLayout(mainPage, 'desktop-result');
  verify(controlsAtLeast44(resultMetrics, ['back', 'replay']), 'result-touch-targets', 'touch', resultMetrics, 'Back/Replay >=44x44', [resultShot]);

  await mainPage.setViewportSize({ width: 844, height: 390 }); await delay(80);
  const landscapeResult = await measureLayout(mainPage, 'landscape-844x390-result');
  verify(noHorizontalOverflow(landscapeResult) && controlsAtLeast44(landscapeResult, ['back', 'replay']),
    'landscape-result-usable', 'landscape', landscapeResult, 'no overflow and Back/Replay >=44x44', [], '844x390');
  await mainPage.setViewportSize({ width: 1280, height: 720 });

  const oldSession = completed.sessionId;
  await mainPage.locator('[data-action="replay"]').click();
  await mainPage.waitForFunction(id => window.fsm.states.miniGame.inspect().session?.sessionId !== id, oldSession);
  verify(await mainPage.locator('#kanjiDefenseScreen').count() === 1, 'replay-single-root', 'lifecycle', await mainPage.locator('#kanjiDefenseScreen').count(), 1);
  await mainPage.locator('[data-action="back"]').click();
  await mainPage.locator('#titleKanjiDefenseButton').waitFor({ state: 'visible' });
  verify(await mainPage.locator('#kanjiDefenseScreen').count() === 0, 'back-cleanup', 'lifecycle', 0, 0);

  const perfMetrics = await cdp.send('Performance.getMetrics');
  const instrumentation = await mainPage.evaluate(() => window.__kdBrowserQa);
  result.performance.main = { cdpMetrics: perfMetrics.metrics, instrumentation, actionLatencies };
  verify(instrumentation.gameRaf === 0 && instrumentation.gameIntervals === 0,
    'game-owned-scheduler-zero', 'scheduler', instrumentation, 'game RAF=0 and interval=0');
  verify(instrumentation.longTasks.every(task => task.duration < 200),
    'performance-longtasks', 'performance', instrumentation.longTasks, 'no game-visible long task >=200ms');
  verify(actionLatencies.every(ms => ms < 1000), 'performance-input-latency', 'performance', actionLatencies, 'all action feedback <1000ms');
}

async function compositionCertification(origin) {
  const { context, page } = await createPage(origin, { width: 1280, height: 720 }, { name: 'composition' });
  try {
    await enterGame(page); await selectEnemy(page);
    const baseline = await session(page);
    const dispatchComposition = (type, data = '') => page.evaluate(({ type, data }) => {
      const node = document.querySelector('#kanjiDefenseScreen input');
      node.dispatchEvent(new CompositionEvent(type, { data, bubbles: true, cancelable: true }));
    }, { type, data });
    const dispatchEnter = (options = {}) => page.evaluate(options => {
      const node = document.querySelector('#kanjiDefenseScreen input');
      node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true, ...options }));
    }, options);
    const unchanged = async before => {
      const after = await session(page);
      return after.resolved === before.resolved && after.wrongAttempts === before.wrongAttempts;
    };

    await dispatchComposition('compositionstart', 'あ');
    verify(await unchanged(baseline), 'composition-start', 'composition', await session(page), 'no submit');
    await dispatchEnter({ isComposing: true });
    verify(await unchanged(baseline), 'composition-enter', 'composition', await session(page), 'no submit');
    await dispatchComposition('compositionupdate', 'あい');
    verify(await unchanged(baseline), 'composition-update', 'composition', await session(page), 'state intact');
    const firstAnswer = answerByPrompt[(await session(page)).selectedEnemy.prompt];
    await input(page).fill(firstAnswer); await dispatchComposition('compositionend', firstAnswer);
    verify(await unchanged(baseline) && await input(page).inputValue() === firstAnswer,
      'composition-end', 'composition', { state: await session(page), value: await input(page).inputValue() }, 'text retained, no submit');
    await page.keyboard.press('Enter');
    await page.waitForFunction(value => window.fsm.states.miniGame.inspect().session?.resolved === value, baseline.resolved + 1);
    pass('composition-enter-after-end', 'composition', (await session(page)).resolved, baseline.resolved + 1);

    await ensureEnemy(page); await selectEnemy(page);
    const repeatBefore = await session(page); const repeatAnswer = answerByPrompt[repeatBefore.selectedEnemy.prompt];
    await input(page).fill(repeatAnswer); await dispatchEnter({ repeat: true });
    verify(await unchanged(repeatBefore), 'composition-repeat-enter', 'composition', await session(page), 'repeat rejected');
    await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
    await page.waitForFunction(value => window.fsm.states.miniGame.inspect().session?.resolved === value, repeatBefore.resolved + 1);
    verify((await session(page)).resolved === repeatBefore.resolved + 1, 'composition-no-duplicate', 'composition', (await session(page)).resolved, repeatBefore.resolved + 1);

    await resolveUntil(page, 4); await ensureEnemy(page); await advance(page, 4700);
    const multi = await session(page);
    verify(multi.enemies.length === 2, 'composition-switch-setup', 'composition', multi.enemies.length, 2);
    await selectEnemy(page, 0); const oldEnemy = (await session(page)).selectedEnemy.enemyId;
    await dispatchComposition('compositionstart', 'あ'); await selectEnemy(page, 1);
    const switched = await session(page); await dispatchEnter({ isComposing: true });
    verify(switched.selectedEnemy.enemyId !== oldEnemy && await unchanged(switched),
      'composition-target-switch', 'composition', { oldEnemy, current: (await session(page)).selectedEnemy.enemyId }, 'old target not submitted');
    await dispatchComposition('compositionend', '');

    const blurBefore = await session(page); await dispatchComposition('compositionstart', 'あ');
    await input(page).evaluate(node => node.blur()); await dispatchEnter({ isComposing: true });
    verify(await unchanged(blurBefore), 'composition-focus-loss', 'composition', await session(page), 'no unexpected submit');
    await dispatchComposition('compositionend', '');

    await input(page).focus(); const pauseBefore = await session(page); await dispatchComposition('compositionstart', 'あ');
    await page.evaluate(() => window.fsm.states.miniGame.setPaused(true)); await dispatchEnter({ isComposing: true });
    verify(await unchanged(pauseBefore) && (await session(page)).paused, 'composition-pause', 'composition', await session(page), 'paused command rejected');
    await page.evaluate(() => window.fsm.states.miniGame.setPaused(false)); await dispatchComposition('compositionend', '');

    const staleInput = await input(page).elementHandle(); await dispatchComposition('compositionstart', 'あ');
    await page.locator('[data-action="back"]').click(); await page.locator('#titleKanjiDefenseButton').waitFor({ state: 'visible' });
    await staleInput.evaluate(node => {
      node.dispatchEvent(new CompositionEvent('compositionend', { data: 'あ', bubbles: true }));
      node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });
    verify(await page.locator('#kanjiDefenseScreen').count() === 0 && (await inspect(page)).session === null,
      'composition-back-stale', 'composition', { root: await page.locator('#kanjiDefenseScreen').count(), inspect: await inspect(page) }, 'old session untouched');
  } finally { await context.close(); }
}

async function visibilityCertification(origin) {
  const { context, page } = await createPage(origin, { width: 1280, height: 720 }, { name: 'visibility' });
  try {
    await enterGame(page);
    const before = await session(page);
    const visibilityCdp = await context.newCDPSession(page);
    try {
      await visibilityCdp.send('Page.setWebLifecycleState', { state: 'frozen' });
      await delay(600);
      await visibilityCdp.send('Page.setWebLifecycleState', { state: 'active' });
      await delay(120);
      const after = await session(page);
      verify(after.resolved === before.resolved && after.life === before.life && after.enemies.length <= before.enemies.length + 1,
        'visibility-background', 'visibility', { mode: 'CDP Page frozen/active', before, after }, 'no catch-up escape or duplicate spawn');
    } catch (error) {
      record('visibility-background', 'visibility', 'NOT_RUN', { mode: 'CDP Page frozen/active', error: error.message }, 'CDP lifecycle support required');
    } finally {
      await visibilityCdp.detach().catch(() => {});
    }
  } finally { await context.close(); }
}

async function reducedMotionCertification(origin) {
  const { context, page } = await createPage(origin, { width: 390, height: 844 }, { name: 'reduced-motion', isMobile: true, hasTouch: true });
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await enterGame(page); await selectEnemy(page);
    const media = await page.evaluate(() => ({
      matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
      transition: getComputedStyle(document.querySelector('.kd-monster')).transitionDuration,
      selected: document.querySelector('.kd-monster[aria-pressed="true"] .kd-marker')?.textContent,
    }));
    const before = await session(page); await correctCurrent(page); const after = await session(page);
    verify(media.matches && media.transition === '0s' && media.selected.includes('選択中') && after.resolved === before.resolved + 1,
      'reduced-motion-playable', 'reduced-motion', { media, resolved: after.resolved }, 'media active, no transition, gameplay works');
  } finally { await context.close(); }
}

async function imageFailureCertification(origin) {
  const { context, page } = await createPage(origin, { width: 1280, height: 720 }, { name: 'image-failure', failMonsterImages: true });
  try {
    await enterGame(page);
    await page.locator('.kd-fallback').first().waitFor({ state: 'visible' });
    const fallback = await page.evaluate(() => ({
      fallback: getComputedStyle(document.querySelector('.kd-fallback')).display,
      image: getComputedStyle(document.querySelector('.kd-monster img')).display,
      label: document.querySelector('.kd-monster').getAttribute('aria-label'),
    }));
    await selectEnemy(page); const before = await session(page); await correctCurrent(page); const after = await session(page);
    const shot = await screenshot(page, 'desktop-image-failure-fallback');
    verify(fallback.fallback !== 'none' && fallback.image === 'none' && fallback.label && after.resolved === before.resolved + 1,
      'image-failure-fallback', 'image-failure', { fallback, resolved: after.resolved }, 'text fallback selectable and answerable', [shot]);
  } finally { await context.close(); }
}

async function lifecycleCertification(origin) {
  const { context, page } = await createPage(origin, { width: 1280, height: 720 }, { name: 'lifecycle' });
  const cycles = [];
  try {
    const titleNodes = await page.locator('body *').count();
    for (let index = 1; index <= 5; index++) {
      await enterGame(page); const sessionId = (await session(page)).sessionId;
      await page.locator('[data-action="back"]').click(); await page.locator('#titleKanjiDefenseButton').waitFor({ state: 'visible' });
      cycles.push({ index, path: 'Back', sessionId, roots: await page.locator('#kanjiDefenseScreen').count(), titleNodes: await page.locator('body *').count(), listeners: (await inspect(page)).listeners });
    }
    await enterGame(page);
    for (let index = 6; index <= 10; index++) {
      const oldId = (await session(page)).sessionId; await completeSession(page);
      await page.locator('[data-action="replay"]').click();
      await page.waitForFunction(id => window.fsm.states.miniGame.inspect().session?.sessionId !== id, oldId);
      cycles.push({ index, path: 'Replay', oldId, newId: (await session(page)).sessionId, roots: await page.locator('#kanjiDefenseScreen').count(), monsters: await page.locator('.kd-monster').count(), companions: await page.locator('.kd-companion').count() });
    }
    await page.locator('[data-action="back"]').click(); await page.locator('#titleKanjiDefenseButton').waitFor({ state: 'visible' });
    const final = { roots: await page.locator('#kanjiDefenseScreen').count(), titleNodes: await page.locator('body *').count(), inspect: await inspect(page), titleNodesBaseline: titleNodes };
    result.measurements.lifecycle = { cycles, final };
    verify(cycles.slice(0, 5).every(cycle => cycle.roots === 0 && cycle.listeners === 0) && cycles.slice(5).every(cycle => cycle.roots === 1 && cycle.companions === 1) && final.roots === 0 && final.inspect.listeners === 0,
      'ten-cycle-lifecycle', 'lifecycle', { cycles, final }, 'no duplicate root/Companion/listener and final cleanup');
  } finally { await context.close(); }
}

async function writeSummary() {
  const counts = Object.fromEntries(['PASS', 'FAIL', 'NOT_RUN', 'MANUAL_REQUIRED'].map(status => [status, result.checks.filter(check => check.status === status).length]));
  const rows = result.checks.map(check => `| ${check.id} | ${check.category} | ${check.viewport ?? ''} | ${check.status} |`).join('\n');
  const summary = `# Kanji Defense Playwright Certification Run\n\n` +
    `- Started: ${result.startedAt}\n- Finished: ${result.finishedAt}\n- Browser: ${result.browser?.name ?? 'none'} ${result.browser?.version ?? ''}\n` +
    `- Server: ${result.server?.url ?? 'not started'}\n- Automated result: **${result.status}**\n` +
    `- Checks: PASS ${counts.PASS}, FAIL ${counts.FAIL}, NOT_RUN ${counts.NOT_RUN}\n\n` +
    `| Check | Category | Viewport | Status |\n| --- | --- | --- | --- |\n${rows}\n\n` +
    `## Out of automated scope\n\n- Actual Windows Japanese IME: see YOMITABI_KANJI_DEFENSE_MANUAL_INPUT_CERTIFICATION.md\n` +
    `- Real mobile soft keyboard: see YOMITABI_KANJI_DEFENSE_MANUAL_INPUT_CERTIFICATION.md\n`;
  await fs.writeFile(path.join(runDir, 'summary.md'), summary, 'utf8');
}

try {
  await runLogged(npmCommand, [...npmPrefix, 'run', 'build'], { cwd: repoRoot, logPath: path.join(runDir, 'build.log') });
  const port = await findFreePort();
  const origin = `http://127.0.0.1:${port}`;
  const viteCli = path.join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js');
  preview = spawnLogged(process.execPath, [viteCli, 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: repoRoot, logPath: path.join(runDir, 'server.log'),
  });
  await waitForHttp(origin);
  result.server = { url: origin, port, mode: 'fresh production build + vite preview' };

  const launched = await launchPreferredBrowser(chromium);
  browser = launched.browser;
  result.browser = { name: launched.name, version: launched.version, options: launched.options, failedAttempts: launched.attempts };

  await mainCertification(origin);
  await compositionCertification(origin);
  await visibilityCertification(origin);
  await reducedMotionCertification(origin);
  await imageFailureCertification(origin);
  await lifecycleCertification(origin);

  const consoleBlockers = result.console.filter(entry => {
    if (entry.type !== 'error') return false;
    if (entry.page === 'image-failure' && /assets\/images\/monsters\/full\/grade4-chuubu/.test(entry.location?.url ?? '')) return false;
    if (/ERR_BLOCKED_BY_CLIENT/.test(entry.text) && (entry.location?.url ?? '').startsWith('https://www.gstatic.com/')) return false;
    return true;
  });
  verify(result.pageErrors.length === 0 && consoleBlockers.length === 0,
    'runtime-errors-zero', 'runtime', { pageErrors: result.pageErrors, consoleErrors: consoleBlockers }, 'zero');
  verify(result.unexpectedExternalRequests.length === 0,
    'unexpected-external-requests-zero', 'network', result.unexpectedExternalRequests, 'zero');

  const required = [
    'desktop-first-monster', 'desktop-correct', 'first-wrong-retry', 'retry-correct', 'second-wrong-terminal',
    'escape-life', 'two-monster-state', 'three-monster-state', 'three-monster-semantic-readability',
    'desktop-overflow', 'desktop-touch-targets', 'portrait-overflow', 'portrait-touch-targets', 'portrait-readability',
    'soft-keyboard-viewport-proxy', 'landscape-overflow', 'landscape-touch-targets', 'landscape-readability',
    'desktop-result', 'result-touch-targets', 'landscape-result-usable', 'focus-visible-back', 'keyboard-lane-select',
    'manual-pause-freeze', 'composition-start', 'composition-enter', 'composition-update', 'composition-end',
    'composition-enter-after-end', 'composition-repeat-enter', 'composition-no-duplicate', 'composition-target-switch',
    'composition-focus-loss', 'composition-pause', 'composition-back-stale', 'reduced-motion-playable',
    'image-failure-fallback', 'game-owned-scheduler-zero', 'performance-longtasks', 'performance-input-latency',
    'ten-cycle-lifecycle', 'runtime-errors-zero', 'unexpected-external-requests-zero',
  ];
  const byId = new Map(result.checks.map(check => [check.id, check]));
  result.requiredCheckIds = required;
  result.status = required.every(id => byId.get(id)?.status === 'PASS') ? 'PASS' : 'FAIL';
} catch (error) {
  result.status = 'FAIL';
  result.fatalError = { message: error.message, stack: error.stack, attempts: error.attempts };
  if (mainPage) await screenshot(mainPage, 'fatal-failure').catch(() => {});
} finally {
  result.finishedAt = new Date().toISOString();
  if (browser) await browser.close().catch(() => {});
  if (preview) { await stopProcess(preview.child); await preview.flush(); }
  await writeJson(path.join(runDir, 'console.json'), result.console);
  await writeJson(path.join(runDir, 'network.json'), result.network);
  await writeJson(path.join(runDir, 'measurements.json'), result.measurements);
  await writeJson(path.join(runDir, 'performance.json'), result.performance);
  await writeJson(path.join(runDir, 'result.json'), result);
  await writeSummary();
  console.log(JSON.stringify({ status: result.status, runDir, browser: result.browser, checks: result.checks.length, issues: result.issues.length, fatalError: result.fatalError?.message }, null, 2));
  process.exit(result.status === 'PASS' ? 0 : 1);
}
