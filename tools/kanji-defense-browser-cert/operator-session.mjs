// Operator-only launcher. Never attaches to an existing Chrome/profile.
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline/promises';
import { newInitialContext, INITIAL_SAVE_ID } from './initial-save.mjs';

const destination = new URL('../../playtest-records/', import.meta.url);
await fs.mkdir(destination, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: false });
const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
let context, page, verified = 0, pending = Promise.resolve();
async function prepare() {
  context = await newInitialContext(browser); verified = 0;
  page = await context.newPage();
  page.on('download', download => {
    pending = pending.then(async () => {
      const filename = download.suggestedFilename();
      if (!/^yomitabi-playtest-pt-[a-f0-9-]{36}\.json$/i.test(filename)) throw new Error('Unexpected export name');
      const raw = await fs.readFile(await download.path(), 'utf8');
      const data = JSON.parse(raw);
      if (data.schemaVersion !== 1 || data.status !== 'ended' || data.truncated ||
          filename !== `yomitabi-playtest-${data.anonymousParticipantId}.json`) throw new Error('Export incomplete/invalid');
      // wx prevents silently overwriting an earlier child's export.
      const path = new URL(filename, destination);
      await fs.writeFile(path, raw, { flag: 'wx' });
      if (await fs.readFile(path, 'utf8') !== raw) throw new Error('Export verification failed');
      verified++; console.log('JSON VERIFIED:', fileURLToPath(path));
    }).catch(error => { console.error('EXPORT FAILED:', error.message); });
  });
  await page.goto('http://127.0.0.1:5181/', { waitUntil: 'domcontentloaded' });
  await page.locator('#titleMiniGameButton').click({ timeout: 60000 });
  console.log('READY:', INITIAL_SAVE_ID, '390x844. Confirm consent, then use the documented logger API in DevTools.');
}
try {
  await prepare();
  for (;;) {
    const command = (await terminal.question('NEXT after end → download → JSON VERIFIED → clear; EXIT to close: ')).trim();
    await pending;
    if (command !== 'NEXT' && command !== 'EXIT') continue;
    const snapshot = await page.evaluate(() => window.yomitabiPlaytest.snapshot());
    if (snapshot !== null) { console.log('REFUSED: end, download, verify and clear the observation first.'); continue; }
    if (command === 'NEXT' && verified === 0) { console.log('REFUSED: no verified export in this session.'); continue; }
    await context.close();
    if (command === 'EXIT') break;
    await prepare();
  }
} finally { terminal.close(); await browser.close(); }
