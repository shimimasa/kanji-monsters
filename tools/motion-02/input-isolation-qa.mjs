import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {connect} from './cdp.mjs';
const out=process.argv[2],c=await connect(),records=[];const pause=ms=>new Promise(r=>setTimeout(r,ms));
const state=()=>c.ev(`({enemy:__m2.gameState.currentEnemy.id,hp:__m2.gameState.currentEnemy.hp,player:__m2.gameState.playerStats,question:__m2.gameState.currentKanji._recordQuestion,turn:__m2.battleState.turn})`);
async function toggleOff(){if(await c.ev("document.getElementById('kanaPadToggle').textContent.includes('たんまつ')")){const r=await c.ev("document.getElementById('kanaPadToggle').getBoundingClientRect().toJSON()");await c.click(r.x+r.width/2,r.y+r.height/2);await pause(350);}}
try{
 await c.call('Page.bringToFront');await c.call('Emulation.setDeviceMetricsOverride',{width:1086,height:723,deviceScaleFactor:1,mobile:false});await pause(200);await toggleOff();
 if(await c.ev('!__m2.battle._pixelMotion'))await c.ev(`(async()=>{const m=await import(performance.getEntriesByType('resource').find(e=>e.name.includes('/src/visuals/battleMotionBridge.js')).name);__m2.battle._pixelMotion=m.createBattleMotionBridge({session:'qa-display-isolation',durations:{attack:750,damage:500,defeat:1000}})})()`);
 await c.ev("document.getElementById('kanjiInput').focus()");await c.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await c.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});records.push({phase:'tab',value:await c.ev("({active:document.activeElement.id,canvasIndex:document.getElementById('gameCanvas').tabIndex,canvasCount:document.querySelectorAll('canvas').length})")});
 const before=await state();await c.ev("document.getElementById('kanjiInput').value='';document.getElementById('kanjiInput').focus()");await c.call('Input.insertText',{text:await c.ev('__m2.gameState.currentKanji.readings[0]')});
 const p=await c.ev(`(()=>{const b=__m2.theme.BTN.heal,c=document.getElementById('gameCanvas'),r=c.getBoundingClientRect(),s=Math.min(r.width/c.width,r.height/c.height);return{x:r.x+(r.width-c.width*s)/2+(b.x+b.w/2)*s,y:r.y+(r.height-c.height*s)/2+(b.y+b.h/2)*s}})()`);
 await c.call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});await c.call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await pause(500);const after=await state();assert.equal(after.player.healCount,before.player.healCount-1);assert.equal(after.hp,before.hp);records.push({phase:'touch-heal',before,after});
 await c.call('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:false});await pause(250);const r=await c.ev("document.getElementById('kanaPadToggle').getBoundingClientRect().toJSON()");await c.click(r.x+r.width/2,r.y+r.height/2);await pause(1500);
 const geometry=()=>c.ev(`({input:document.getElementById('kanjiInput').getBoundingClientRect().toJSON(),canvas:document.getElementById('gameCanvas').getBoundingClientRect().toJSON(),buttons:__m2.theme.BTN,pad:localStorage.inputMethod})`);
 const motion=await geometry();await c.shot(path.join(out,'landscape-pad-motion.png'));
 await c.ev('__m2.battle._pixelMotion.dispose();__m2.battle._pixelMotion=null');await pause(1500);const legacy=await geometry();assert.deepEqual(legacy,motion);await c.shot(path.join(out,'landscape-pad-legacy.png'));records.push({phase:'same-session-display-only-legacy-isolation',motion,legacy});
 await fs.writeFile(path.join(out,'input-isolation.json'),JSON.stringify(records,null,2));console.log(JSON.stringify(records));
}catch(e){await fs.writeFile(path.join(out,'input-isolation-failure.json'),JSON.stringify({error:String(e),records,state:await state()},null,2));throw e;}finally{c.close();}
