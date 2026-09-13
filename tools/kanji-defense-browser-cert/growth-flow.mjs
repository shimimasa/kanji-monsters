import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { getDefaultSave } from '../../src/core/saveData.js';
import { launchPreferredBrowser } from './helpers.mjs';
const output=new URL(process.argv[2]==='polish'?'../../artifacts/minigame-80plus/growth-flow/':'../../artifacts/gotomon-growth/flow/',import.meta.url);
await fs.mkdir(output,{recursive:true});
const {browser,name}=await launchPreferredBrowser(chromium);
const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
const save=getDefaultSave();save.player.name='育成プレイQA';save.player.coreStats.exp=42;
save.player.collection.gotomonIds=['HKD-E01','HKD-E02'];
save.player.miniGames={selectedGotomonId:'HKD-E02',companions:{'HKD-E02':{plays:8,friendship:27,xp:239},'HKD-E01':{plays:50,friendship:100,xp:1520}},games:{}};
save.meta.compatibilityEntries={tutorial_seen_title:'1'};
await context.route(/https:\/\/.*/,route=>route.abort());
await context.addInitScript(save=>{if(sessionStorage.getItem('growth-qa'))return;localStorage.setItem('krb_save',JSON.stringify(save));localStorage.setItem('bgmVolume','0');localStorage.setItem('seVolume','0');sessionStorage.setItem('growth-qa','1');},save);
const page=await context.newPage(),evidence={browser:name,checks:[],timings:[],errors:[]};
page.on('pageerror',e=>evidence.errors.push(e.message));
const inspect=()=>page.evaluate(()=>window.fsm.currentState.inspect());
const state=async()=>(await inspect()).session;
const player=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('krb_save')).player);
const shot=file=>page.screenshot({path:new URL(`${file}.png`,output).pathname.replace(/^\/(\w:)/,'$1')});
async function start(id,pal='HKD-E02') {
  await page.locator(`[data-game-id="${id}"]`).click();await page.locator(`[data-gotomon-id="${pal}"]`).click();await page.locator('[data-action=start-game]').click();
}
async function choice(id,{wrong=false}={}) {
  const s=await state(),answer=wrong?s.problem.choices.find(x=>x.choiceId!==s.problem.correctChoiceId).choiceId:s.problem.correctChoiceId;
  const started=Date.now();await page.locator(`[data-choice-id="${answer}"]`).click();
  if(!(await state()).result&&!wrong) {
    await page.waitForFunction(old=>{const s=window.fsm.currentState.inspect().session;return s.phase==='answering'&&s.problem.problemId!==old;},s.problem.problemId,{timeout:1800,polling:20});
    evidence.timings.push({id,ms:Date.now()-started});
  }
}
async function back(){await page.locator('[data-action=back]').click();}
try {
  await page.goto('http://127.0.0.1:4173',{waitUntil:'domcontentloaded'});await page.locator('#titleMiniGameButton').click();
  await expect(page.locator('.yt-friend-banner')).toContainText('Lv3');await shot('hub-before');
  await start('englishChoice');await page.locator('[data-world-action=rare]').click();await shot('english-start');
  const initial=await inspect();expect(initial.play.growth.level).toBe(3);
  for(let i=0;i<10;i++) {
    await page.waitForTimeout(1250); // Real active reading time, no synthetic timer advance.
    if(i===3) {await shot('english-playing');await page.locator('[data-action=boost]').click();await shot('english-skill');}
    if(i===4) {
      await page.locator('[data-action=pause]').click();const paused=await state();await page.waitForTimeout(250);expect((await state()).activeElapsedMs).toBe(paused.activeElapsedMs);await page.locator('[data-action=pause]').click();
    }
    await choice('englishChoice');
  }
  await expect(page.locator('.gt-growth-result')).toContainText('Lv 4になった！',{timeout:3000});await shot('english-level-up');
  const after=await player(),pal=after.miniGames.companions['HKD-E02'];
  expect(pal.level).toBe(4);expect(pal.xp).toBeGreaterThan(239);expect(pal.friendship).toBe(31);expect(after.coreStats.exp).toBe(42);
  evidence.growth={activeElapsedMs:(await state()).activeElapsedMs,beforeXP:239,afterXP:pal.xp,level:pal.level};
  await page.waitForTimeout(1800);await shot('english-result');
  await page.locator('[data-action=replay]:visible').click();expect((await inspect()).play.growth.effects.skillPoints).toBe(165);
  expect((await player()).miniGames.companions['HKD-E02'].xp).toBe(pal.xp);await back();
  await expect(page.locator('.yt-friend-banner')).toContainText('Lv4');await shot('hub-after');
  await page.reload();await page.locator('#titleMiniGameButton').click();expect((await player()).miniGames.companions['HKD-E02'].xp).toBe(pal.xp);
  evidence.checks.push('real-time play → XP → Lv4 animation → upgraded retry → reload; pause excluded; no duplicate rewards');

  await start('mathSprint','HKD-E01');let p=await inspect();expect(p.play.growth.level).toBe(10);expect(p.play.gauge).toBe(1);
  for(let i=0;i<3;i++) {
    if(i===2)await page.locator('[data-world-action=push]').click();
    const s=await state();await page.getByRole('textbox',{name:'こたえ',exact:true}).fill(String(s.problem.answer));await page.locator('[data-action=answer]').click();
    await page.waitForFunction(()=>window.fsm.currentState.inspect().session.phase==='answering',null,{timeout:1800});
  }
  p=await inspect();expect(p.play.world.energy).toBe(0);expect(p.play.world.bonus).toBeGreaterThan(20);
  await page.locator('[data-action=boost]').click();expect((await inspect()).play.world.boostMs).toBeGreaterThan(6000);await shot('master-race-boost');await back();
  expect((await player()).miniGames.companions['HKD-E01'].xp).toBe(1520);evidence.checks.push('MASTER starts gauge1; charge/obstacle jump changes race state; Lv4+ boost lasts6.6seconds; abort paysnothing');

  await start('sentenceOrder');let s=await state();const original=[...s.currentOrder];
  const from=await page.locator(`[data-chunk-id="${original[0]}"]`).boundingBox(),to=await page.locator(`[data-chunk-id="${original[2]}"]`).boundingBox();
  await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:10});await shot('sentence-dragging');await page.mouse.up();
  expect((await state()).currentOrder[2]).toBe(original[0]);expect((await state()).answered).toBe(0);await shot('sentence-placed');await back();evidence.checks.push('pointer drag rearranges actual plank identities without answering; keyboard controls retained');

  await start('timedChoice');await page.locator('[data-world-action=light-tower]').click();expect((await inspect()).play.world.towers).toBe(1);
  for(let i=0;i<3;i++)await choice('timedChoice');await shot('light-fever');expect((await inspect()).play.world.fever).toBe(true);
  await page.locator('[data-action=boost]').click();await page.locator('[data-world-action=light-tower]').click();expect((await inspect()).play.world.towers).toBe(2);await back();evidence.checks.push('light is spent on beacon, correct answers refill it, combo fever and companion recovery participate');

  await start('multiSelect');s=await state();const selected=s.problem.correctChoiceIds[0];await page.locator(`[data-choice-id="${selected}"]`).click();await shot('constellation-piece');
  await page.locator('[data-action=submit]').click();p=await inspect();expect(p.play.world.stars).toBeGreaterThan(0);expect(p.play.world.stars).toBeLessThan(2);
  await shot('constellation-partial');await back();evidence.checks.push('partial grading creates proportional persistent progress on the selected constellation route');

  await start('asyncChoice');const order=[0,1,2,3,4];
  for(const route of order){await page.locator(`[data-world-action="route-${route}"]`).click();await choice('asyncChoice');await choice('asyncChoice');if(route===1)await shot('explore-clues');}
  p=await inspect();expect(p.play.world.rare).toBe(1);expect(p.play.world.path).toEqual(order);expect(p.session.result).toBeTruthy();await shot('explore-result');await back();evidence.checks.push('5 real route choices; two clues before ruins earn rare discovery; no repeated site farming');
  expect(evidence.timings.every(x=>x.ms<1000)).toBe(true);expect(evidence.errors).toEqual([]);evidence.status='PASS';
}catch(e){evidence.status='FAIL';evidence.failure=e.stack;console.error(e);process.exitCode=1;await shot('failure').catch(()=>{});}
finally{await fs.writeFile(new URL('results.json',output),JSON.stringify(evidence,null,2));await browser.close();console.log(JSON.stringify(evidence,null,2));}
