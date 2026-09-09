import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {connect} from './cdp.mjs';
const out=process.argv[2],c=await connect();const pause=ms=>new Promise(r=>setTimeout(r,ms));
const geometry=()=>c.ev(`({input:document.getElementById('kanjiInput').getBoundingClientRect().toJSON(),canvas:document.getElementById('gameCanvas').getBoundingClientRect().toJSON(),buttons:__m2.theme.BTN,pad:localStorage.inputMethod})`);
try{
 assert.equal(await c.ev("innerWidth===844 && innerHeight===390 && localStorage.inputMethod==='kanaPad'"),true);
 await c.ev(`(async()=>{const m=await import(performance.getEntriesByType('resource').find(e=>e.name.includes('/src/visuals/battleMotionBridge.js')).name);__m2.battle._pixelMotion?.dispose();__m2.battle._pixelMotion=m.createBattleMotionBridge({session:'qa-display-isolation-final',durations:{attack:750,damage:500,defeat:1000}})})()`);
 await c.wait("__m2.battle._pixelMotion?.inspect().imageState==='ready'");await pause(1000);const motion=await geometry();await c.shot(path.join(out,'landscape-pad-motion.png'));
 await c.ev('__m2.battle._pixelMotion.dispose();__m2.battle._pixelMotion=null');await pause(1000);const legacy=await geometry();await c.shot(path.join(out,'landscape-pad-legacy.png'));
 assert.deepEqual(legacy,motion);await fs.writeFile(path.join(out,'legacy-isolation.json'),JSON.stringify({method:'same artificial session; only display bridge enabled/disabled; no Core mutation',motion,legacy},null,2));console.log(JSON.stringify({equal:true,motion}));
}finally{c.close();}
