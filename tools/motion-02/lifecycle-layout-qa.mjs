import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {connect} from './cdp.mjs';
const out=process.argv[2],c=await connect(),loops=[],layouts=[],errors=[];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function stageEnter(){await c.point("fsm.currentState.stageButtons.find(b=>b.id==='hokkaido_area1')");await pause(600);if(await c.ev('fsm.currentState===fsm.states.stageSelect'))await c.point("fsm.currentState.stageButtons.find(b=>b.id==='hokkaido_area1')");await c.wait("__m2.battle._pixelMotion?.inspect().imageState==='ready'",'E01 ready');}
try{
 await c.call('Runtime.enable');await c.call('Page.bringToFront');c.on(m=>{if(m.method==='Runtime.exceptionThrown')errors.push(m.params);});
 if(await c.ev('fsm.currentState===fsm.states.courseSelect')){await c.point('({x:195,y:295,w:10,h:10})');await c.wait('fsm.currentState===fsm.states.regionSelect');await pause(600);await c.point(`(()=>{const s=fsm.currentState,m=s.mapRect,c=s.camera;return{x:c.x+(m.x+m.width*.82)*c.scale,y:c.y+(m.y+m.height*.175)*c.scale,w:0,h:0}})()`);await c.wait('fsm.currentState===fsm.states.stageSelect');await pause(600);await stageEnter();}
 for(let i=0;i<10;i++){
   await c.ev('window.__oldMotion=__m2.battle._pixelMotion');const before=await c.ev('__oldMotion.inspect()');
   await c.point('__m2.theme.BTN.stage');await c.wait('fsm.currentState===fsm.states.stageSelect');await pause(150);
   const exit=await c.ev('({bridge:__oldMotion.inspect(),current:__m2.battle._pixelMotion})');assert.equal(exit.current,null);assert.equal(exit.bridge.hostCount,0);assert.equal(exit.bridge.timeline,null);assert.equal(exit.bridge.imageReference,false);assert.equal(exit.bridge.activeSession,null);
   await c.ev('window.__oldMotion=null');await pause(450);await stageEnter();const entered=await c.ev('__m2.battle._pixelMotion.inspect()');assert.equal(entered.hostCount,1);assert.notEqual(entered.activeSession,before.activeSession);
   loops.push({i:i+1,before,exit,entered,tutorial:await c.ev('!!__m2.tutorial.guide')});
 }
 for(const [width,height] of [[1086,723],[390,844],[844,390]])for(const pad of [false,true]){
   await c.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await pause(300);
   const isOn=await c.ev("localStorage.getItem('inputMethod')==='kana' || document.getElementById('kanaPadToggle')?.getAttribute('aria-expanded')==='true'");
   const actual=await c.ev("({value:localStorage.getItem('inputMethod'),button:document.getElementById('kanaPadToggle')?.outerHTML})");
   // Use the product's visible toggle; its label describes the next mode.
   const wantsOpen=await c.ev("document.getElementById('kanaPadToggle')?.textContent.includes('50')");
   if(wantsOpen===pad){const r=await c.ev("document.getElementById('kanaPadToggle').getBoundingClientRect().toJSON()");await c.click(r.x+r.width/2,r.y+r.height/2);await pause(350);}
   const record=await c.ev(`(()=>{const c=document.getElementById('gameCanvas'),r=c.getBoundingClientRect(),i=document.getElementById('kanjiInput');return{requested:{width:${width},height:${height},pad:${pad}},inner:[innerWidth,innerHeight,devicePixelRatio],canvas:r.toJSON(),logical:[c.width,c.height],input:i.getBoundingClientRect().toJSON(),pad:localStorage.getItem('inputMethod'),toggle:document.getElementById('kanaPadToggle')?.textContent,buttons:__m2.theme.BTN,motion:__m2.battle._pixelMotion.inspect(),tutorial:!!__m2.tutorial.guide}})()`);
   layouts.push(record);await c.shot(path.join(out,`layout-${width}x${height}-pad-${pad}.png`));
 }
 await c.call('Emulation.setDeviceMetricsOverride',{width:1086,height:723,deviceScaleFactor:1,mobile:false});await pause(300);
 await c.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await pause(100);await c.shot(path.join(out,'reduced-motion.png'));await c.call('Emulation.setEmulatedMedia',{features:[]});
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'lifecycle-layout.json'),JSON.stringify({loops,layouts,errors},null,2));console.log(JSON.stringify({loops:loops.length,layouts:layouts.length,errors}));
}catch(e){await c.shot(path.join(out,'lifecycle-failure.png'));await fs.writeFile(path.join(out,'lifecycle-failure.json'),JSON.stringify({error:String(e),loops,layouts,errors},null,2));throw e;}finally{c.close();}
