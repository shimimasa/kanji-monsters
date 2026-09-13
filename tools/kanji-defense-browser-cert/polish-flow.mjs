import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { getDefaultSave } from '../../src/core/saveData.js';
import { launchPreferredBrowser } from './helpers.mjs';

const output=new URL('../../artifacts/minigame-80plus/decisions/',import.meta.url);
await fs.mkdir(output,{recursive:true});
const {browser,name}=await launchPreferredBrowser(chromium);
const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
const save=getDefaultSave();save.player.name='磨きこみQA';save.player.coreStats.exp=42;
save.player.collection.gotomonIds=['HKD-E01','HKD-E02'];
save.player.miniGames={selectedGotomonId:'HKD-E02',companions:{'HKD-E02':{xp:730,friendship:40},'HKD-E01':{xp:1520,friendship:100}},games:{mathSprint:{bestScore:1700,bestTimeMs:60000,plays:3}}};
save.meta.compatibilityEntries={tutorial_seen_title:'1'};
await context.route(/https:\/\/.*/,route=>route.abort());
await context.addInitScript(save=>{if(sessionStorage.getItem('polish-qa'))return;localStorage.setItem('krb_save',JSON.stringify(save));localStorage.setItem('bgmVolume','0');localStorage.setItem('seVolume','0');sessionStorage.setItem('polish-qa','1');},save);
const page=await context.newPage(),evidence={browser:name,viewport:'390×844',checks:[],errors:[],immediateResponseMs:[]};
page.on('pageerror',error=>evidence.errors.push(error.message));
const inspect=()=>page.evaluate(()=>window.fsm.currentState.inspect());
const state=async()=>(await inspect()).session;
const shot=file=>page.screenshot({path:new URL(`${file}.png`,output).pathname.replace(/^\/(\w:)/,'$1')});
async function start(id,pal='HKD-E02'){
  await page.locator(`[data-game-id="${id}"]`).click();await page.locator(`[data-gotomon-id="${pal}"]`).click();await page.locator('[data-action=start-game]').click();await page.waitForTimeout(550);
}
async function back(){await page.locator('[data-action=back]').click();}
async function advance(){
  const s=await state();if(s.result)return;
  if(s.phase==='feedback'){
    if(s.lastAnswer?.correct||s.lastAnswer?.classification==='fullCorrect')await page.waitForFunction(()=>window.fsm.currentState.inspect().session.phase!=='feedback',null,{timeout:1800});
    else await page.locator('[data-action=next]:visible').click();
  }
}
async function multi(partial=false){
  const s=await state(),ids=partial?[s.problem.correctChoiceIds[0]]:s.problem.correctChoiceIds;
  for(const id of ids)await page.locator(`[data-choice-id="${id}"]`).click();
  const time=Date.now();await page.locator('[data-action=submit]').click();
  const next=await inspect();expect(next.play.answered).toBe(s.answered+1);
  // The final answer also commits a save and builds the result, unlike normal feedback.
  if(next.session.result)evidence.resultResponseMs=Date.now()-time;
  else evidence.immediateResponseMs.push(Date.now()-time);
}
async function choice(wrong=false){const s=await state();await page.locator(`[data-choice-id="${wrong?s.problem.choices.find(c=>c.choiceId!==s.problem.correctChoiceId).choiceId:s.problem.correctChoiceId}"]`).click();}
async function layout(){const value=await page.locator('.yt-game').evaluate(root=>({height:root.clientHeight,scroll:root.scrollHeight,top:root.scrollTop,width:root.clientWidth,scrollWidth:root.scrollWidth}));expect(value.scroll).toBeLessThanOrEqual(value.height+1);expect(value.top).toBe(0);expect(value.scrollWidth).toBeLessThanOrEqual(value.width+1);}
try {
  await page.goto('http://127.0.0.1:4173',{waitUntil:'domcontentloaded'});await page.locator('#titleMiniGameButton').click();
  await start('multiSelect');await page.locator('[data-world-action=star-route-0]').click();await shot('stars-start');
  await multi(true);expect((await inspect()).play.world.routes[0]).toBeGreaterThan(0);await shot('stars-partial');await layout();await advance();
  await page.locator('[data-world-action=star-route-2]').click();
  for(let i=0;i<3;i++){await multi();if(i===2){await expect(page.locator('.gt-actor')).toHaveAttribute('data-tier','SUPER');await shot('stars-super-combo');}await advance();}
  await page.locator('[data-action=boost]').click();const before=(await inspect()).play.world.routes;await shot('stars-skill');
  await multi();const after=(await inspect()).play.world.routes;expect(after.filter((v,i)=>v>before[i]).length).toBeGreaterThanOrEqual(2);await shot('stars-two-routes');await advance();
  while(!(await state()).result){
    const play=(await inspect()).play;
    if(play.gauge>=3)await page.locator('[data-action=boost]').click();
    if((await state()).answered>=8)await shot('stars-climax');
    await multi();await advance();
  }
  expect((await inspect()).play.world.completed).toBe(3);await expect(page.locator('.gt-result')).toHaveAttribute('data-triumph','true');await shot('stars-result');
  await page.locator('[data-action=replay]:visible').click();expect((await inspect()).play.world.routes).toEqual([0,0,0]);await back();
  evidence.checks.push('safe partial → crown → Lv7 combo → skill lights two routes → 3 constellations → result → clean retry');

  await start('englishChoice');await page.locator('[data-world-action=rare]').click();await shot('dungeon-start');
  for(let i=0;i<10;i++){
    if(i===3){await page.locator('[data-world-action=safe]').click();await shot('dungeon-fallback');}
    if(i===6)await page.locator('[data-world-action=rare]').click();
    if((await inspect()).play.gauge>=3){await page.locator('[data-action=boost]').click();await shot('dungeon-skill');}
    if(i===9)await shot('dungeon-final-room');
    await choice(i===1);await advance();
  }
  const dungeon=(await inspect()).play.world;expect(dungeon.steps.length).toBe(10);expect(dungeon.findings.length).toBe(4);expect(dungeon.findings[0].points).toBe(50);
  await expect(page.locator('.gt-result .gt-finding[data-found=true]')).toHaveCount(4);await shot('dungeon-result');await back();
  evidence.checks.push('rare-room failure retains50pt; next safe branch; 10 visited doors,4 rooms and carried treasures');

  await start('asyncChoice');const path=[0,1,4,2,3];await shot('explore-start');
  for(const id of path){await page.locator(`[data-world-action="route-${id}"]`).click();await choice();await advance();if((await inspect()).play.gauge>=3)await page.locator('[data-action=boost]').click();await choice();await advance();if(id===4)await shot('explore-lake-detour');}
  const found=(await inspect()).play.world;expect(found.path).toEqual(path);expect(found.findings.map(item=>item.place)).toEqual(['林道','海辺','湖','遺跡','高原']);
  await shot('explore-ordered-result');await back();evidence.checks.push('lake detour before ruins preserves clues, found treasures remain in chosen order');

  await start('mathSprint','HKD-E01');await expect(page.locator('.gt-rival')).toBeVisible();await expect(page.locator('.gt-actor')).toHaveAttribute('data-tier','MASTER');await shot('race-own-best-start');
  for(let i=0;i<10;i++){
    if(i===2||i===5||i===8)await page.locator('[data-world-action=push]').click();else await page.locator('[data-world-action=charge]').click();
    if((await inspect()).play.gauge>=3)await page.locator('[data-action=boost]').click();
    const s=await state();await page.getByRole('textbox',{name:'こたえ',exact:true}).fill(String(s.problem.answer));await page.locator('[data-action=answer]').click();
    if(i===3)await shot('race-best-delta');if(i===8)await shot('race-last-spurt');await advance();
  }
  await expect(page.locator('.gt-world-result')).toContainText('ベスト比');await expect(page.locator('.gt-world-result')).toContainText('タイム更新！');await shot('race-new-best-result');
  const best=await page.evaluate(()=>JSON.parse(localStorage.getItem('krb_save')).player.miniGames.games.mathSprint.bestTimeMs);expect(best).toBeLessThan(60000);
  await page.locator('[data-action=replay]:visible').click();expect((await inspect()).play.world.bestTimeMs).toBe(best);await shot('race-updated-pace-retry');await back();
  evidence.checks.push('MASTER gauge1; own60second marker → jump/boost → signed delta → new time persists and becomes retry marker');

  await start('sentenceOrder');let s=await state();const from=await page.locator(`[data-chunk-id="${s.currentOrder[0]}"]`).boundingBox(),to=await page.locator(`[data-chunk-id="${s.currentOrder[2]}"]`).boundingBox();
  await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:10});await shot('bridge-drag');await page.mouse.up();
  await expect(page.locator('.so-chunk.gt-landed')).toHaveCount(1);expect((await state()).answered).toBe(0);
  const order=(await state()).problem.correctOrder;
  for(let i=0;i<order.length;i++){while((await state()).currentOrder.indexOf(order[i])>i){await page.locator(`[data-chunk-id="${order[i]}"]`).click();await page.locator('[data-action=move-left]').click();}}
  await page.locator('[data-action=submit]').click();await expect(page.locator('.gt-bridge')).toHaveAttribute('data-crossing','true');await page.waitForTimeout(200);await shot('bridge-crossing');await back();
  evidence.checks.push('pointer plank lands without correctness hint; grading makes one bridge and actor actually crosses');

  await start('timedChoice');await shot('lantern-single-display');await page.waitForTimeout(3500);await shot('lantern-deadline-danger');
  await page.waitForFunction(()=>window.fsm.currentState.inspect().session.phase==='feedback',null,{timeout:2200});
  expect((await inspect()).play.correct).toBe(0);expect((await state()).deadlineMs).toBe(5000);await shot('lantern-timeout');await layout();await advance();
  for(let i=0;i<3;i++){await choice();await advance();}await page.locator('[data-action=boost]').click();await page.locator('[data-world-action=light-tower]').click();await shot('lantern-recovered');await back();
  evidence.checks.push('5second deadline unchanged; darkening arc → timeout → combo light recovery → skill → beacon');
  expect(evidence.errors).toEqual([]);expect(evidence.immediateResponseMs.every(ms=>ms<200)).toBe(true);evidence.status='PASS';
}catch(error){evidence.status='FAIL';evidence.failure=error.stack;console.error(error);process.exitCode=1;await shot('failure').catch(()=>{});}
finally{await fs.writeFile(new URL('results.json',output),JSON.stringify(evidence,null,2));await browser.close();console.log(JSON.stringify(evidence,null,2));}
