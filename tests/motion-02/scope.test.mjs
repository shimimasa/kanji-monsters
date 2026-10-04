import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BATTLE_DISPLAY_HOOKS} from './battle-display-hooks.mjs';
import {assertMotionScope,assertAddedPaths} from './scope-audit.mjs';
// 2026-10-04 (user decision): the battle screen is no longer frozen byte for byte, so it can be
// improved directly. What stays protected is the Motion integration itself: each of the nine
// approved display hooks must still be in battleScreen.js, whole and in order.
const NL=String.fromCharCode(10), CRLF=String.fromCharCode(13,10);
function assertHooksPresent(source){
 const lines=source.replaceAll(CRLF,NL).split(NL);
 let cursor=0;
 for(const [i,[,added]] of BATTLE_DISPLAY_HOOKS.entries()){
   const body=added.filter(line=>line.trim()!=='');
   let at=-1;
   for(let k=cursor;k<=lines.length-body.length;k++){
     if(body.every((line,j)=>lines[k+j]===line)){at=k;break;}
   }
   assert.ok(at>=0,`Motion hook ${i+1} is missing or changed`);
   cursor=at+body.length;
 }
}
test('the nine Motion display hooks are still in the battle screen, whole and in order',()=>{
 const lf=fs.readFileSync('src/screens/battleScreen.js','utf8').replaceAll(CRLF,NL);
 assertHooksPresent(lf);
 const hook=BATTLE_DISPLAY_HOOKS[3][1].join(NL);
 assert.ok(lf.includes(hook));
 const mutations={
   'deleted hook':lf.replace(hook,''),
   'changed hook':lf.replace('this._pixelMotion?.update({','this._pixelMotion?.dispose({'),
 };
 for(const [name,fixture] of Object.entries(mutations)){
   assert.notEqual(fixture,lf,name);
   assert.throws(()=>assertHooksPresent(fixture),{name:'AssertionError'},name);
 }
});
test('battle bridge imports only display modules, owns no clock/loader/Core/random/DOM',()=>{
 const source=fs.readFileSync('src/visuals/battleMotionBridge.js','utf8');
 for(const match of source.matchAll(/(?:from\s*|import\()['"]([^'"]+)['"]/g))assert.ok(match[1].startsWith('./motion/'));
 assert.doesNotMatch(source,/Math\.random\s*\(|\b(?:fetch|setTimeout|setInterval|requestAnimationFrame)\s*\(|\b(?:localStorage|sessionStorage|document|gameState|battleState|questionToken)\b/);
});
