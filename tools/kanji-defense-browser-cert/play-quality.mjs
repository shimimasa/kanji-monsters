import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { getDefaultSave } from '../../src/core/saveData.js';
import { KANJI_DEFENSE_GOLDEN_CONTENT } from '../../src/minigames/kanjiDefense/kanjiDefenseContent.js';
import { launchPreferredBrowser } from './helpers.mjs';
const phase = process.argv[2] || 'before';
const legacy = phase === 'public-before';
const baseUrl = legacy ? 'https://yomitabi.gamanavi.com/' : 'http://127.0.0.1:4173';
const output = new URL(`../../artifacts/play-quality/${phase}/`, import.meta.url);
await fs.mkdir(output,{recursive:true});
const {browser} = await launchPreferredBrowser(chromium);
const context = await browser.newContext({viewport:{width:390,height:844}});
const save = getDefaultSave(); save.player.name='プレイ監査'; save.player.collection.gotomonIds=['HKD-E01','HKD-E02'];
save.meta.compatibilityEntries={tutorial_seen_title:'1'};
await context.route(/https:\/\/.*/, route => route.request().url().startsWith(baseUrl) ? route.continue() : route.abort());
await context.addInitScript(save=>{
  if(sessionStorage.getItem('audit'))return;
  localStorage.setItem('krb_save',JSON.stringify(save)); localStorage.setItem('bgmVolume','0');localStorage.setItem('seVolume','0');sessionStorage.setItem('audit','1');
},save);
const page=await context.newPage(), results={phase,errors:[],games:{}};
page.on('pageerror',e=>results.errors.push(e.message));
const snap=()=>page.evaluate(()=>window.fsm.currentState.inspect().session);
const shot=async(id,moment)=>page.screenshot({path:new URL(`${id}-${moment}.png`,output).pathname.replace(/^\/(\w:)/,'$1')});
const readings=Object.fromEntries(KANJI_DEFENSE_GOLDEN_CONTENT.map(x=>[x.prompt,x.acceptedReadings[0]]));
const titleButtons = {mathSprint:'titleMiniGameButton',mathInvader:'titleMathInvaderButton',englishChoice:'titleEnglishChoiceButton',sentenceOrder:'titleSentenceOrderButton',timedChoice:'titleTimedChoiceButton',multiSelect:'titleMultiSelectButton',asyncChoice:'titleAsyncChoiceButton',kanjiDefense:'titleKanjiDefenseButton'};
async function answer(id,wrong=false){
  let s=await snap();
  if(s.phase==='feedback'){await page.locator('[data-action=next]:visible').click();s=await snap();}
  if(id==='asyncChoice'){
    const routes=page.locator('[data-action=explore]:not(:disabled)');
    if(await routes.count())await routes.nth(s.answered%await routes.count()).click();
  }
  if(['mathInvader','kanjiDefense'].includes(id)){
    await expect(page.locator('[data-enemy-id]').first()).toBeVisible();
    const r=await page.locator('[data-enemy-id]').first().boundingBox();await page.mouse.click(r.x+r.width/2,r.y+r.height/2);s=await snap();
    await page.locator(`#${id}Screen input[type=text]`).fill(wrong?'999':String(id==='mathInvader'?s.selectedEnemy.answer:readings[s.selectedEnemy.prompt]));
    await page.locator('[data-action=answer]').click();
  }else if(id==='mathSprint'){
    await page.getByRole('textbox',{name:'こたえ',exact:true}).fill(wrong?'999':String(s.problem.answer));await page.locator('[data-action=answer]').click();
  }else if(id==='sentenceOrder'){
    const wanted=[...s.problem.correctOrder];if(wrong)[wanted[0],wanted[1]]=[wanted[1],wanted[0]];
    for(let i=0;i<wanted.length;i++){
      let current=await snap();while(current.currentOrder.indexOf(wanted[i])>i){
        await page.locator(`[data-chunk-id="${wanted[i]}"]`).click();await page.locator('[data-action=move-left]').click();current=await snap();
      }
    }
    await page.locator('[data-action=submit]').click();
  }else if(id==='multiSelect'){
    const ids=wrong?[s.problem.choices.find(c=>!s.problem.correctChoiceIds.includes(c.choiceId)).choiceId]:s.problem.correctChoiceIds;
    for(const choice of ids)await page.locator(`[data-choice-id="${choice}"]`).click();await page.locator('[data-action=submit]').click();
  }else{
    const choice=wrong?s.problem.choices.find(x=>x.choiceId!==s.problem.correctChoiceId).choiceId:s.problem.correctChoiceId;
    await page.locator(`[data-choice-id="${choice}"]`).click();
  }
  if (!legacy && !(await snap()).result) {
    const layout=await page.locator(`#${id}Screen`).evaluate(root=>({scrollHeight:root.scrollHeight,clientHeight:root.clientHeight,scrollTop:root.scrollTop,scrollWidth:root.scrollWidth,clientWidth:root.clientWidth}));
    (results.games[id].answerLayouts??=[]).push(layout);
    if(['growth-after','polish-after'].includes(phase)) {expect(layout.scrollHeight,`${id}: vertical play overflow`).toBeLessThanOrEqual(layout.clientHeight+1);expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth+1);}
  }
}
try{
 await page.goto(baseUrl,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(() => window.fsm?.currentState);
 if (legacy) { const skip = page.getByRole('button',{name:'スキップ',exact:true}); if(await skip.isVisible())await skip.click(); }
 else await page.locator('#titleMiniGameButton').click();
 for(const id of ['mathSprint','mathInvader','englishChoice','sentenceOrder','timedChoice','multiSelect','asyncChoice','kanjiDefense']){
  console.log('PLAY',phase,id);
  if(legacy)await page.locator(`#${titleButtons[id]}`).click();
  else {await page.locator(`[data-game-id="${id}"]`).click();await page.locator('[data-gotomon-id="HKD-E02"]').click();await page.locator('[data-action=start-game]').click();await expect(page.locator('.gt-actor')).toBeVisible();}
  await shot(id,'start');
  const gameRoot = page.locator(`#${id}Screen`);
  const entry=results.games[id]={};entry.initialText=await gameRoot.innerText();
  await answer(id,true);entry.wrong=await snap();await shot(id,'wrong');
  if(id==='kanjiDefense'){await answer(id,true);entry.terminalWrong=await snap();}
  for(let i=0;i<3;i++)await answer(id);
  entry.combo=await page.evaluate(()=>window.fsm.currentState.inspect().play);await shot(id,'playing');
  if(!legacy){await page.locator('[data-action=boost]').click();await page.waitForTimeout(100);entry.boost=await page.evaluate(()=>window.fsm.currentState.inspect().play);await shot(id,'skill');}
  else entry.boost='NOT AVAILABLE: published version has no companion gauge/skill';
  const now=Date.now();await page.waitForTimeout(1100);entry.phaseAfter1100ms=(await snap()).phase;entry.elapsedProbe=Date.now()-now;
  entry.layout=await gameRoot.evaluate(root=>({scrollHeight:root.scrollHeight,clientHeight:root.clientHeight,scrollTop:root.scrollTop,scrollWidth:root.scrollWidth,clientWidth:root.clientWidth}));
  let attempts=0;while(!(await snap()).result&&attempts++<30){await answer(id);if(!legacy&&await page.locator('[data-action=boost]').isEnabled())await page.locator('[data-action=boost]').click();if(id==='mathInvader'&&!legacy&&await page.locator('.gt-boss').isVisible())await shot(id,'boss');}
  expect((await snap()).result).toBeTruthy();await shot(id,'result');entry.finalText=await (legacy?gameRoot:page.locator('.gt-result')).innerText();
  await page.locator('[data-action=replay]:visible').click();expect((await snap()).result).toBeNull();await page.locator('[data-action=back]').click();
  if(legacy)continue;
  await page.locator(`[data-game-id="${id}"]`).click();await page.locator('[data-gotomon-id="HKD-E01"]').click();await page.locator('[data-action=start-game]').click();await answer(id);await shot(id,'other-companion');await page.locator('[data-action=back]').click();
 }
 results.status='PASS';
}catch(e){results.status='FAIL';results.failure=e.stack;console.error(e);process.exitCode=1;}
finally{await fs.writeFile(new URL('observations.json',output),JSON.stringify(results,null,2));await browser.close();console.log(results.status);}
