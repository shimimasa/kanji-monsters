import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { launchPreferredBrowser } from './helpers.mjs';

// Isolated browser: never imports a real user's profile or modifies their saves.
const out = new URL('../../artifacts/play-quality/public/', import.meta.url);
await fs.mkdir(out, { recursive: true });
const { browser, name, version } = await launchPreferredBrowser(chromium);
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const report = { browser: name, version, errors: [], failedRequests: [] };
page.on('pageerror', error => report.errors.push(error.message));
page.on('requestfailed', request => report.failedRequests.push({url: request.url(), error: request.failure()}));
try {
  const response = await page.goto('https://yomitabi.gamanavi.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  report.status = response.status();
  await page.waitForFunction(() => window.fsm?.currentState, { timeout: 60000 });
  await page.screenshot({ path: new URL('title.png', out).pathname.replace(/^\/(\w:)/, '$1') });
  report.title = await page.title();
  report.text = await page.locator('body').innerText();
  report.buttons = await page.locator('button').evaluateAll(nodes => nodes.map(node => ({id: node.id, text: node.textContent, visible: !!node.getClientRects().length})));
  report.scripts = await page.locator('script[src]').evaluateAll(nodes => nodes.map(node => node.src));
  report.learningPathsPresent = await page.locator('#adventureTitle .yt-title-path').count() === 2 &&
    await page.locator('#titleMiniGameButton').textContent() === 'ミニゲーム広場へ';
  console.log(JSON.stringify(report, null, 2));
} catch (error) { report.failure = error.stack; console.error(error); process.exitCode = 1; }
finally { await fs.writeFile(new URL('observations.json', out), JSON.stringify(report,null,2)); await browser.close(); }
