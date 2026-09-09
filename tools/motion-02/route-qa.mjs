import fs from 'node:fs/promises';
import path from 'node:path';
import {connect} from './cdp.mjs';
const out=process.argv[2];if(!out)throw Error('output directory required');
const c=await connect(),steps=[];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function guide(){await pause(150);for(let i=0;i<15;i++){
  const r=await c.ev(`(()=>{if(!__m2.tutorial.guide)return null;const b=[...document.querySelectorAll('button')].find(b=>['つぎへ','はじめる！'].includes(b.textContent)&&b.getClientRects().length);return b?.getBoundingClientRect().toJSON()})()`);
  if(!r)return;await c.click(r.x+r.width/2,r.y+r.height/2);await pause(100);
}}
async function key(){await c.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await c.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});}
try{
  await c.call('Page.enable');await c.call('Runtime.enable');await c.call('Page.bringToFront');
  await c.ev(`(async()=>{window.__m2={...(await import('/src/core/gameState.js')),battle:(await import(performance.getEntriesByType('resource').find(e=>e.name.includes('/src/screens/battleScreen.js')).name)).default,theme:await import('/src/screens/battle/theme.js'),tutorial:(await import('/src/tutorial/TutorialManager.js')).default};})()`);
  await c.wait("!document.getElementById('bootProgress')",'boot ready');await guide();
  await c.point('fsm.currentState.playButton');await c.wait("document.querySelector('#playerNameInputField') || fsm.currentState===fsm.states.courseSelect",'name/course');await guide();
  if(await c.ev("!!document.querySelector('#playerNameInputField')")){
    await c.ev("document.querySelector('#playerNameInputField').focus()");await c.call('Input.insertText',{text:'テスト'});await key();
  }
  await c.wait('fsm.currentState===fsm.states.courseSelect','course');await guide();await pause(400);
  await c.point('fsm.currentState.japanButton');await c.wait('fsm.currentState===fsm.states.regionSelect','region');await guide();await pause(400);
  await c.point(`(()=>{const s=fsm.currentState,m=s.mapRect,c=s.camera;return{x:c.x+(m.x+m.width*.82)*c.scale,y:c.y+(m.y+m.height*.175)*c.scale,w:0,h:0}})()`);
  await c.wait('fsm.currentState===fsm.states.stageSelect','stage');await guide();
  await c.point("fsm.currentState.stageButtons.find(b=>b.id==='hokkaido_area1')");await pause(500);
  if(await c.ev('fsm.currentState===fsm.states.stageSelect'))await c.point("fsm.currentState.stageButtons.find(b=>b.id==='hokkaido_area1')");
  await c.wait('fsm.currentState===fsm.states.battle','battle');await pause(200);
  steps.push(await c.ev(`({phase:'unread',tutorial:!!__m2.tutorial.guide,seen:JSON.parse(localStorage.krb_save).meta.compatibilityEntries?.tutorial_seen_battle,motion:__m2.battle._pixelMotion?.inspect()})`));
  await c.shot(path.join(out,'battle-tutorial-unread.png'));await guide();
  await c.wait("__m2.battle._pixelMotion?.inspect().imageState==='ready'",'motion ready');
  steps.push(await c.ev(`({phase:'read',tutorial:!!__m2.tutorial.guide,motion:__m2.battle._pixelMotion.inspect(),focus:document.activeElement?.id,enemy:__m2.gameState.currentEnemy.id})`));
  await c.shot(path.join(out,'battle-idle.png'));
  console.log(JSON.stringify(steps));await fs.writeFile(path.join(out,'route.json'),JSON.stringify(steps,null,2));
}catch(e){await c.shot(path.join(out,'route-failure.png'));await fs.writeFile(path.join(out,'route-failure.json'),JSON.stringify({error:String(e),steps,state:await c.ev("({state:Object.keys(fsm.states).find(k=>fsm.states[k]===fsm.currentState),text:document.body.innerText})")},null,2));throw e;}
finally{c.close();}
