import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {connect} from './cdp.mjs';
const out=process.argv[2],c=await connect(),records=[],errors=[];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const state=()=>c.ev(`({enemy:__m2.gameState.currentEnemy?.id,hp:__m2.gameState.currentEnemy?.hp,player:__m2.gameState.playerStats,action:__m2.battleState.enemyAction,timer:__m2.battleState.enemyActionTimer,turn:__m2.battleState.turn,motion:__m2.battle._pixelMotion?.inspect(),focus:document.activeElement?.id})`);
async function enter(){await c.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await c.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});}
async function answer(text,button=false){await c.ev("document.getElementById('kanjiInput').value='';document.getElementById('kanjiInput').focus()");await c.call('Input.insertText',{text});if(button)await c.point('__m2.theme.BTN.attack');else await enter();}
try{
 await c.call('Runtime.enable');await c.call('Page.bringToFront');c.on(m=>{if(m.method==='Runtime.exceptionThrown')errors.push(m.params);});
 records.push({phase:'before',state:await state()});
 await c.ev("document.getElementById('kanjiInput').focus();document.getElementById('kanjiInput').dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'え'}))");
 const before=await state();await enter();await pause(100);const after=await state();for(const k of Object.keys(before.player).filter(k=>k!=='playtimeSeconds'))assert.deepEqual(after.player[k],before.player[k],k);assert.equal(after.hp,before.hp);
 await c.ev("document.getElementById('kanjiInput').dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:''}))");records.push({phase:'composition-enter-blocked',state:after});
 await answer('あいうえお');await c.wait("__m2.battleState.enemyAction==='attack'",'attack');await pause(180);await c.shot(path.join(out,'battle-attack.png'));records.push({phase:'attack',state:await state()});
 await c.wait("__m2.battleState.turn==='player' && !__m2.battleState.enemyAction",'player after attack');
 const reading=await c.ev("__m2.gameState.currentKanji?.onyomi?.[0] || __m2.gameState.currentKanji?.readings?.[0]");
 if(!reading)throw Error('current reading absent');await answer(reading,true);await c.wait("__m2.battleState.enemyAction==='damage'",'hit');await pause(110);await c.shot(path.join(out,'battle-hit.png'));records.push({phase:'hit',state:await state()});
 for(let i=0;i<8;i++){
   await c.wait("__m2.battleState.turn==='player' && !__m2.battleState.enemyAction",'next answer');
   if((await state()).enemy!=='HKD-E01')break;
   const r=await c.ev("__m2.gameState.currentKanji?.onyomi?.[0] || __m2.gameState.currentKanji?.readings?.[0]");await answer(r);
   await c.wait("!!__m2.battleState.enemyAction",'action');
   if(await c.ev("__m2.battleState.enemyAction==='defeat'")){await pause(300);await c.shot(path.join(out,'battle-defeat.png'));records.push({phase:'defeat',state:await state()});break;}
 }
 await c.wait("__m2.gameState.currentEnemy?.id==='HKD-E02'",'E02');await pause(100);const e2=await state();assert.equal(e2.motion.hostCount,0);assert.equal(e2.motion.timeline,null);records.push({phase:'E02',state:e2});await c.shot(path.join(out,'battle-E02.png'));
 records.push({phase:'saved-tutorial',value:await c.ev("({body:JSON.parse(localStorage.krb_save).meta.compatibilityEntries?.tutorial_seen_battle,ambient:localStorage.tutorial_seen_battle})")});
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'functional.json'),JSON.stringify({records,errors},null,2));console.log(JSON.stringify(records));
}catch(e){await c.shot(path.join(out,'functional-failure.png'));await fs.writeFile(path.join(out,'functional-failure.json'),JSON.stringify({error:String(e),records,errors,state:await state()},null,2));throw e;}finally{c.close();}
