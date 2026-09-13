import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { getDefaultSave } from '../../src/core/saveData.js';
import { KANJI_DEFENSE_GOLDEN_CONTENT } from '../../src/minigames/kanjiDefense/kanjiDefenseContent.js';
import { launchPreferredBrowser } from './helpers.mjs';

const out=new URL('../../artifacts/child-playtest-qa/',import.meta.url);await fs.mkdir(out,{recursive:true});
const {browser,name}=await launchPreferredBrowser(chromium);
const evidence={browser:name,checks:[],errors:[],status:'RUNNING'};
const save=getDefaultSave();save.player.name='PRIVATE_SENTINEL_NOT_TO_EXPORT';save.player.coreStats.exp=42;
save.player.collection.gotomonIds=['HKD-E01','HKD-E02'];
save.player.miniGames={selectedGotomonId:'HKD-E01',companions:{'HKD-E01':{xp:239}},games:{}};
save.meta.compatibilityEntries={tutorial_seen_title:'1'};
const readings=Object.fromEntries(KANJI_DEFENSE_GOLDEN_CONTENT.map(item=>[item.prompt,item.acceptedReadings[0]]));
const ids=['mathSprint','mathInvader','englishChoice','sentenceOrder','timedChoice','multiSelect','asyncChoice','kanjiDefense'];
async function open(base){
  console.log('OPEN',base);
  const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
  await context.route(/https:\/\/.*/,route=>route.abort());
  await context.addInitScript(save=>{if(sessionStorage.getItem('logger-qa'))return;localStorage.setItem('krb_save',JSON.stringify(save));localStorage.setItem('bgmVolume','0');localStorage.setItem('seVolume','0');sessionStorage.setItem('logger-qa','1');},save);
  const page=await context.newPage();page.on('pageerror',error=>evidence.errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')console.log('PAGE',message.text().slice(0,220));});
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:120000});
  await page.screenshot({path:new URL(`opening-${new URL(base).port}.png`,out).pathname.replace(/^\/(\w:)/,'$1'),timeout:10000});
  console.log('LOADED',base,(await page.locator('body').innerText()).slice(0,150));
  await page.locator('#titleMiniGameButton').click({timeout:60000});
  return{context,page};
}
const state=page=>page.evaluate(()=>window.fsm.currentState.inspect().session);
async function start(page,id,pal='HKD-E01'){
  await page.locator(`[data-game-id="${id}"]`).click();await page.locator(`[data-gotomon-id="${pal}"]`).click();await page.locator('[data-action=start-game]').click();
}
async function answer(page,id){
  let s=await state(page);if(s.phase==='feedback'){await page.locator('[data-action=next]:visible').click();s=await state(page);}
  if(id==='asyncChoice'){const routes=page.locator('[data-action=explore]:not(:disabled)');if(await routes.count())await routes.first().click();}
  if(['mathInvader','kanjiDefense'].includes(id)){
    await expect(page.locator('[data-enemy-id]').first()).toBeVisible();const box=await page.locator('[data-enemy-id]').first().boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);s=await state(page);
    await page.locator('.yt-game input[type=text]').fill(String(id==='mathInvader'?s.selectedEnemy.answer:readings[s.selectedEnemy.prompt]));await page.locator('[data-action=answer]').click();
  }else if(id==='mathSprint'){
    await page.getByRole('textbox',{name:'こたえ',exact:true}).fill(String(s.problem.answer));await page.locator('[data-action=answer]').click();
  }else if(id==='sentenceOrder'){
    for(let i=0;i<s.problem.correctOrder.length;i++){const wanted=s.problem.correctOrder[i];while((await state(page)).currentOrder.indexOf(wanted)>i){await page.locator(`[data-chunk-id="${wanted}"]`).click();await page.locator('[data-action=move-left]').click();}}
    await page.locator('[data-action=submit]').click();
  }else if(id==='multiSelect'){
    for(const choice of s.problem.correctChoiceIds)await page.locator(`[data-choice-id="${choice}"]`).click();await page.locator('[data-action=submit]').click();
  }else await page.locator(`[data-choice-id="${s.problem.correctChoiceId}"]`).click();
}
try{
  const off=await open('http://127.0.0.1:5182'),on=await open('http://127.0.0.1:5181'),prod=await open('http://127.0.0.1:4173');
  expect(await off.page.evaluate(()=>typeof window.yomitabiPlaytest)).toBe('undefined');expect(await prod.page.evaluate(()=>typeof window.yomitabiPlaytest)).toBe('undefined');
  const before=await off.page.locator('#miniGameHub').innerText();expect(await on.page.locator('#miniGameHub').innerText()).toBe(before);
  await off.page.screenshot({path:new URL('hub-flag-off.png',out).pathname.replace(/^\/(\w:)/,'$1')});await on.page.screenshot({path:new URL('hub-flag-on.png',out).pathname.replace(/^\/(\w:)/,'$1')});
  evidence.checks.push('flag-off observation build and flag-on normal production expose no logger; hub text/controls unchanged');
  await off.context.close();await prod.context.close();const {page}=on;
  expect(await page.evaluate(()=>yomitabiPlaytest.snapshot())).toBeNull();await start(page,'mathSprint');await answer(page,'mathSprint');await page.locator('[data-action=back]').click();
  expect(await page.evaluate(()=>yomitabiPlaytest.snapshot())).toBeNull();expect(await page.evaluate(()=>yomitabiPlaytest.start())).toBe(false);
  const raw=await page.evaluate(()=>localStorage.getItem('krb_save'));const participant=await page.evaluate(()=>yomitabiPlaytest.start({consentConfirmed:true,name:'IGNORED_PRIVATE_FIELD'}));expect(participant).toMatch(/^pt-/);
  expect(await page.evaluate(()=>localStorage.getItem('krb_save'))).toBe(raw);expect(await page.evaluate(()=>yomitabiPlaytest.start({consentConfirmed:true}))).toBe(false);
  evidence.checks.push('no record before explicit consent/start; logger start writes no save and cannot double-start');
  for(const [index,id] of ids.entries()){
    console.log('LOGGER PLAY',id);await start(page,id,index%2?'HKD-E02':'HKD-E01');
    if(id==='mathSprint')await page.locator('[data-world-action=push]').click();
    if(id==='englishChoice')await page.locator('[data-world-action=rare]').click();
    if(id==='multiSelect')await page.locator('[data-world-action=star-route-2]').click();
    let guard=0;while(!(await state(page)).result&&guard++<30){
      if(id==='englishChoice'){if((await state(page)).phase==='feedback')await page.locator('[data-action=next]:visible').click();await page.waitForTimeout(1250);}
      await answer(page,id);if(await page.locator('[data-action=boost]').isEnabled())await page.locator('[data-action=boost]').click();
    }
    const run=await page.evaluate(()=>yomitabiPlaytest.snapshot().runs.at(-1));expect(run.status).toBe('completed');expect(run.gameId).toBe(id);expect(run.saveSucceeded).toBe(true);
    await expect(page.locator('.gt-rank')).toContainText(run.resultRank);expect(run.score).toBeGreaterThan(0);expect(run.completedAt).toBeGreaterThanOrEqual(run.startedAt);
    if(id==='englishChoice'){expect(run.levelBefore).toBe(3);expect(run.levelAfter).toBe(4);expect(run.earnedXP).toBeGreaterThan(0);}
    await page.waitForTimeout(150);
    if(index%2===0){await page.locator('[data-action=replay]:visible').click();await page.locator('[data-action=back]').click();}else await page.locator('[data-action=back]').click();
  }
  expect(await page.evaluate(()=>yomitabiPlaytest.end('child-stop'))).toBe(true);
  const data=await page.evaluate(()=>yomitabiPlaytest.snapshot()),summary=await page.evaluate(()=>yomitabiPlaytest.summary());
  expect(data.runs.length).toBe(12);expect(summary.completed).toBe(8);expect(summary.voluntaryReplay).toEqual({numerator:4,denominator:8,rate:.5});
  expect(summary.gameSwitch.numerator).toBe(3);expect(summary.earlyExit).toEqual({numerator:4,denominator:12,rate:1/3});expect(summary.companionSwitch.numerator).toBe(7);
  expect(data.runs.filter(run=>run.status==='completed').every(run=>run.resultDwellMs>=150&&run.resultVisibleMs>=150)).toBe(true);
  const serialized=JSON.stringify(data);for(const forbidden of ['PRIVATE_SENTINEL','IGNORED_PRIVATE','acceptedReadings','coreStats','correctOrder','player','question','answerText'])expect(serialized.includes(forbidden)).toBe(false);
  const keys=await page.evaluate(()=>Object.keys(localStorage).concat(Object.keys(sessionStorage)));expect(keys.some(key=>/playtest/i.test(key))).toBe(false);
  const [download]=await Promise.all([page.waitForEvent('download'),page.evaluate(()=>yomitabiPlaytest.download())]);const file=new URL('synthetic-export.json',out).pathname.replace(/^\/(\w:)/,'$1');await download.saveAs(file);
  expect(JSON.parse(await fs.readFile(file,'utf8'))).toEqual(data);expect(download.suggestedFilename()).toContain(participant);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('krb_save')).player);expect(saved.coreStats.exp).toBe(42);expect(saved.collection.gotomonIds).toEqual(save.player.collection.gotomonIds);
  evidence.checks.push('all8 games log real completion/rank/XP, 4 replays, 3 result-to-game switches, 4 intentional exits, 7 companion switches; no question/name/raw save exported');
  evidence.checks.push('real Lv3→4 logged; JSON download exact; no logger Storage keys; main progress preserved');
  await page.evaluate(()=>yomitabiPlaytest.clear());expect(await page.evaluate(()=>yomitabiPlaytest.snapshot())).toBeNull();expect(await page.evaluate(()=>yomitabiPlaytest.start({consentConfirmed:true}))).not.toBe(participant);
  await page.evaluate(()=>yomitabiPlaytest.end('time-limit'));expect(evidence.errors).toEqual([]);evidence.summary=summary;evidence.status='PASS';
}catch(error){evidence.status='FAIL';evidence.failure=error.stack;console.error(error);process.exitCode=1;}
finally{await browser.close();await fs.writeFile(new URL('results.json',out),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));}
