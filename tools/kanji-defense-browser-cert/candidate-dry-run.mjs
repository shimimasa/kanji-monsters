import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { launchPreferredBrowser } from './helpers.mjs';
import { initialSave, newInitialContext } from './initial-save.mjs';

const out = new URL('../../artifacts/candidate-1/', import.meta.url);
await fs.mkdir(out, { recursive:true });
const { browser, name, version } = await launchPreferredBrowser(chromium);
const report = { kind:'Software / Operations Dry Run — synthetic, no children', browser:name, version, checks:[], status:'RUNNING' };
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('krb_save')));
const state = page => page.evaluate(() => window.fsm.currentState.inspect().session);
async function fresh() {
  const context = await newInitialContext(browser), page = await context.newPage();
  await page.goto('http://127.0.0.1:5181/', { waitUntil:'domcontentloaded' });
  await page.locator('#titleMiniGameButton').click({ timeout:60000 });
  return { context,page };
}
async function start(page, game, pal='HKD-E01') {
  await page.locator(`[data-game-id="${game}"]`).click();
  await page.locator(`[data-gotomon-id="${pal}"]`).click();
  await page.locator('[data-action=start-game]').click();
}
try {
  let { context,page } = await fresh();
  const baseline = await saved(page);
  expect(baseline.player.name).toBe('ゲスト');
  expect(baseline.player.collection.gotomonIds).toEqual(initialSave().player.collection.gotomonIds);
  expect(await page.evaluate(() => [localStorage.getItem('bgmVolume'),localStorage.getItem('seVolume')])).toEqual(['0.2','0.3']);
  const baselinePlayer = baseline.player;
  expect(await page.evaluate(() => yomitabiPlaytest.snapshot())).toBeNull();
  expect(await page.evaluate(() => yomitabiPlaytest.start())).toBe(false);
  const participant = await page.evaluate(() => yomitabiPlaytest.start({ consentConfirmed:true, name:'FORBIDDEN_NAME', school:'FORBIDDEN_SCHOOL', address:'FORBIDDEN_ADDRESS', accountId:'FORBIDDEN_ACCOUNT', url:'FORBIDDEN_URL' }));
  expect(participant).toMatch(/^pt-/);
  expect(await page.evaluate(() => yomitabiPlaytest.start({consentConfirmed:true}))).toBe(false);
  expect(await page.evaluate(() => yomitabiPlaytest.clear())).toBe(false);
  await start(page,'mathSprint');
  for(let i=0;i<10;i++) {
    let s=await state(page);
    if(s.phase==='feedback') { await page.locator('[data-action=next]:visible').click(); s=await state(page); }
    await page.getByRole('textbox',{name:'こたえ',exact:true}).fill(String(s.problem.answer));
    await page.locator('[data-action=answer]').click();
  }
  await expect(page.locator('.gt-rank')).toBeVisible();
  await page.waitForTimeout(250);
  await page.locator('[data-action=replay]:visible').click();
  await page.locator('[data-action=back]').click();
  await start(page,'englishChoice');
  await page.locator('[data-action=back]').click();
  await start(page,'multiSelect','HKD-E02');
  for(const mark of ['help','replay-prompt','technical','observer-interruption'])
    expect(await page.evaluate(mark => yomitabiPlaytest.mark(mark), mark)).toBe(true);
  expect(await page.evaluate(() => yomitabiPlaytest.mark('FREE_TEXT_FORBIDDEN'))).toBe(false);
  await page.locator('[data-action=back]').click();
  expect(await page.evaluate(() => yomitabiPlaytest.end('child-stop'))).toBe(true);
  const data = await page.evaluate(() => yomitabiPlaytest.snapshot());
  expect(await page.evaluate(() => yomitabiPlaytest.end('child-stop'))).toBe(false);
  expect(await page.evaluate(() => yomitabiPlaytest.mark('help'))).toBe(false);
  expect(await page.evaluate(() => yomitabiPlaytest.snapshot())).toEqual(data);
  expect(data.runs.map(run => run.sessionId)).toEqual(['run-1','run-2','run-3','run-4']);
  expect(data.runs[0].status).toBe('completed'); expect(data.runs[0].replayPressed).toBe(true);
  expect(data.runs[0].resultDwellMs).toBeGreaterThanOrEqual(250);
  expect(data.runs.slice(1).every(run => run.quitMidGame)).toBe(true);
  expect(data.runs[3].companionChangedFromPrevious).toBe(true);
  expect(data.runs[3].assisted && data.runs[3].technicalIssue && data.runs[3].decisionPrompted && data.runs[3].decisionCensored).toBe(true);
  const summary = await page.evaluate(() => yomitabiPlaytest.summary());
  expect(summary.secondRunCandidates.every(pair => pair.strategyChanged===null)).toBe(true);
  const raw=JSON.stringify(data);
  for(const token of ['FORBIDDEN','FREE_TEXT','ゲスト','coreStats','acceptedReadings','http:','firebase','userAgent']) expect(raw.includes(token)).toBe(false);
  expect(data.runs.every(run => /^run-\d+$/.test(run.sessionId))).toBe(true);
  const [download] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => yomitabiPlaytest.download())]);
  await download.saveAs(new URL('operations-synthetic-export.json',out).pathname.replace(/^\/(\w:)/,'$1'));
  expect(JSON.parse(await fs.readFile(new URL('operations-synthetic-export.json',out),'utf8'))).toEqual(data);
  const beforeClear = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(key=>[key,localStorage.getItem(key)])));
  expect(await page.evaluate(() => yomitabiPlaytest.clear())).toBe(true);
  expect(await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(key=>[key,localStorage.getItem(key)])))).toEqual(beforeClear);
  expect(await page.evaluate(() => yomitabiPlaytest.snapshot())).toBeNull();
  expect(Object.keys(beforeClear).some(key => /playtest/i.test(key))).toBe(false);
  expect(await page.evaluate(() => yomitabiPlaytest.start({consentConfirmed:true}))).not.toBe(participant);
  await page.reload(); await page.locator('#titleMiniGameButton').click({timeout:60000});
  expect(await page.evaluate(() => yomitabiPlaytest.snapshot())).toBeNull();
  expect((await saved(page)).player.miniGames.games.mathSprint.plays).toBeGreaterThan(0);
  report.checks.push('start/consent/double-start; completion/replay/switch/quit/companion; all 4 marks; end/double-end; summary; exact JSON download; clear preserves all Storage; reload loses only memory log');
  await context.close();
  ({context,page}=await fresh());
  const restored = await saved(page);
  expect(restored.player).toEqual(baselinePlayer);
  expect(restored.settings).toEqual(baseline.settings);
  expect(restored.meta.compatibilityEntries).toEqual(baseline.meta.compatibilityEntries);
  expect(await page.evaluate(() => yomitabiPlaytest.snapshot())).toBeNull();
  await page.locator('[data-game-id=mathSprint]').click();
  expect(await page.locator('[data-gotomon-id]').count()).toBe(3);
  report.checks.push('new owned context restores identical player/progress/3 companions/Lv1/XP0/records/settings/tutorial; storage timestamps excluded, not gameplay');
  report.observationMapping = data.runs.map(run => ({run:run.sessionId, game:run.gameId, companion:run.gotomonId, startWaitMs:run.selectionToStartMs, status:run.status, resultMs:run.resultDwellMs, replay:run.replayPressed, nextGame:run.nextGameId, companionChange:run.companionChangedFromPrevious, help:run.assisted, prompted:run.decisionPrompted, technical:run.technicalIssue, censored:run.decisionCensored}));
  report.initialSaveSHA256 = createHash('sha256').update(await fs.readFile(new URL('./CHILD_PLAYTEST_INITIAL_SAVE.json',import.meta.url))).digest('hex');
  report.summary=summary; report.status='PASS'; await context.close();
} catch(error) { report.status='FAIL'; report.failure=error.stack; process.exitCode=1; }
finally { await browser.close(); await fs.writeFile(new URL('operations-results.json',out),JSON.stringify(report,null,2)); console.log(JSON.stringify(report,null,2)); }
