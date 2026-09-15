// Isolated browser QA: real Host/Core/View/Shell, injected seeded sampler only.
// No production/debug API is added to the application.
import { chromium,expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { getDefaultSave } from '../../src/core/saveData.js';
import { banks,itemId,oldItems,question,answer } from '../../scripts/content-120-banks.mjs';
import { seeded } from '../../scripts/validate-content-120.mjs';
import { launchPreferredBrowser } from './helpers.mjs';
const base=process.env.YOMITABI_QA_URL||'http://127.0.0.1:5188';
const out=new URL('../../artifacts/content-120/longest/',import.meta.url);await fs.mkdir(out,{recursive:true});
const {browser,name,version}=await launchPreferredBrowser(chromium);
const evidence={browser:name,version,viewport:{width:390,height:844},mode:'AUTOMATED REAL HOST / SEEDED CONTENT',checks:[],errors:[]};
const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
await context.route(/https:\/\/.*/,route=>route.abort());
const save=getDefaultSave();save.player.name='教材QA';save.player.collection.gotomonIds=['HKD-E01','HKD-E02'];
save.player.coreStats.exp=42;save.meta.compatibilityEntries={tutorial_seen_title:'1'};
await context.addInitScript(save=>{localStorage.setItem('krb_save',JSON.stringify(save));localStorage.setItem('bgmVolume','0');localStorage.setItem('seVolume','0');},save);
const page=await context.newPage();page.on('pageerror',e=>evidence.errors.push(e.message));
function seedFor(bank,predicate) {
  for(let seed=0;seed<15000;seed++){const q=bank.generate({sessionId:'probe',random:seeded(seed)})[0];if(predicate(q))return seed;}
  throw Error('No first-question seed found');
}
try {
  await page.goto(base,{waitUntil:'domcontentloaded'});await expect(page.locator('#titleMiniGameButton')).toBeVisible({timeout:30000});await page.locator('#titleMiniGameButton').click();
  for(const [key,bank] of Object.entries(banks)) {
    const previous=key==='math'?bank.items.filter(q=>(q.operation==='addition'?q.answer:q.a)<=9):await oldItems(key);
    const oldIds=new Set(previous.map(itemId)),added=bank.items.filter(q=>!oldIds.has(itemId(q)));
    const longest=field=>[...bank.items].sort((a,b)=>field(b).length-field(a).length)[0];
    const correctText=q=>q.choices?q.choices.filter(c=>(q.correctChoiceIds||[q.correctChoiceId]).includes(c.choiceId)).map(c=>c.text).sort((a,b)=>b.length-a.length)[0]:answer(key,q);
    const candidates=[['existing',previous[0]],['new-middle',added[Math.floor(added.length/2)]],['new-end',added.at(-1)],
      ['longest-question',longest(q=>question(key,q))],['longest-answer',longest(correctText)]];
    const tasks=candidates.map(([label,q])=>({label,id:itemId(q),seed:seedFor(bank,s=>bank.id(s)===itemId(q))}));
    if(key==='defense') {
      const q=[...added].sort((a,b)=>b.prompt.length-a.prompt.length)[0];
      tasks.push({label:'longest-new-kanji',id:itemId(q),seed:seedFor(bank,s=>bank.id(s)===itemId(q))});
    }
    if(!['math','sentence','defense'].includes(key)) {
      let maximum=0;
      // Fixed-choice banks cannot draw a correct-only option as a distractor.
      for(const q of bank.items)for(const text of q.choices?.filter(c=>!(q.correctChoiceIds||[q.correctChoiceId]).includes(c.choiceId)).map(c=>c.text)||[q.meaning||q.reading])maximum=Math.max(maximum,text.length);
      const seed=seedFor(bank,q=>q.choices.some(c=>!(q.correctChoiceIds||[q.correctChoiceId]).includes(c.choiceId)&&c.text.length===maximum));
      tasks.push({label:'longest-distractor',seed,id:bank.id(bank.generate({sessionId:'probe',random:seeded(seed)})[0])});
    }
    for(const gameId of bank.gameIds)for(const task of tasks) {
      await page.evaluate(async({gameId,seed})=> {
        window.__contentHost?.exit();window.fsm.currentState.exit();
        const {createMiniGameHost}=await import('/src/minigames/miniGameHost.js');
        let value=seed;
        window.__contentHost=createMiniGameHost({random:()=>((value=(Math.imul(value,1664525)+1013904223)>>>0)/4294967296),onBack:()=>{}});
        window.__contentHost.enter({gameId,gotomonId:'HKD-E02'});
      },{gameId,seed:task.seed});
      await page.waitForTimeout(150);await page.evaluate(()=>window.__contentHost.update(0));
      await expect(page.locator('.yt-game')).toBeVisible();
      if(['kanjiDefense','mathInvader'].includes(gameId))await page.locator('[data-enemy-id]').first().click();
      if(gameId==='asyncChoice')await page.locator('[data-world-action="route-0"]').click();
      const state=await page.evaluate(()=>window.__contentHost.inspect().session);
      // A valid Core snapshot is not proof that the question is visible. In
      // exploration mode the location must be selected before choices appear.
      if(['english','timed','multi','async'].includes(key))await expect(page.locator('[data-choice-id]:visible')).toHaveCount(key==='multi'?5:4);
      if(key==='sentence')await expect(page.locator('[data-chunk-id]:visible')).toHaveCount(state.problem.chunks.length);
      if(task.label==='longest-answer'&&['math','defense'].includes(key)) {
        const q=bank.items.find(q=>itemId(q)===task.id);
        await page.locator('.yt-game input[type=text]').fill(answer(key,q));
      }
      const observed=gameId==='kanjiDefense'?state.enemies[0].fixtureId:gameId==='mathInvader'?null:state.problem.fixtureId||state.problem.correctChoiceId?.slice(8);
      if(gameId==='mathInvader') {
        const expected=bank.generate({sessionId:'probe',random:seeded(task.seed)})[0];
        expect(state.enemies[0].question).toBe(`${expected.a} ${expected.operation==='addition'?'+':'−'} ${expected.b}`);
      } else expect(observed).toBe(task.id);
      const layout=await page.locator('.yt-game').evaluate(root=> {
        const nodes=[...root.querySelectorAll('[data-choice-id],[data-chunk-id],input,[data-action=answer],[data-action=submit]')]
          .filter(n=>n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden');
        return {width:root.clientWidth,scrollWidth:root.scrollWidth,height:root.clientHeight,scrollHeight:root.scrollHeight,
          controls:nodes.map(n=>{const r=n.getBoundingClientRect();return {text:n.textContent||n.getAttribute('aria-label'),width:r.width,height:r.height,left:r.left,right:r.right,bottom:r.bottom,
            clientWidth:n.clientWidth,scrollWidth:n.scrollWidth,clientHeight:n.clientHeight,scrollHeight:n.scrollHeight};})};
      });
      const problems=[];
      if(layout.scrollWidth>layout.width+2)problems.push('root horizontal overflow');
      if(layout.scrollHeight>layout.height+2)problems.push('root vertical overflow');
      for(const c of layout.controls) {
        if(c.left< -1||c.right>391||c.bottom>845)problems.push(`outside viewport: ${c.text}`);
        if(c.scrollWidth>c.clientWidth+2||c.scrollHeight>c.clientHeight+2)problems.push(`clipped: ${c.text}`);
        if(c.width<43||c.height<43)problems.push(`target under44px: ${c.text}`);
      }
      const file=`${gameId}-${task.label}.png`;await page.screenshot({path:new URL(file,out).pathname.replace(/^\/(\w:)/,'$1')});
      evidence.checks.push({bank:key,gameId,...task,layout,problems,screenshot:file});
      console.log(`${gameId} ${task.label} ${task.id}: ${problems.length?'ISSUE':'PASS'}`);
    }
  }
  evidence.status=evidence.errors.length||evidence.checks.some(c=>c.problems.length)?'FAIL':'PASS';
  if(evidence.status==='FAIL')process.exitCode=1;
} catch(error){evidence.status='FAIL';evidence.failure=error.stack;console.error(error);process.exitCode=1;}
finally{await browser.close();await fs.writeFile(new URL('results.json',out),JSON.stringify(evidence,null,2));console.log(evidence.status);}
