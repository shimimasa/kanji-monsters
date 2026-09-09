import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BATTLE_DISPLAY_HOOKS} from './battle-display-hooks.mjs';
import {assertBattleDisplayOnly,assertMotionScope,assertAddedPaths,readCheckpointBattle} from './scope-audit.mjs';
test('complete original battle source reconstructs exactly after removing only explicit display hooks',()=>{
 const source=fs.readFileSync('src/screens/battleScreen.js','utf8').replaceAll('\r\n','\n');
 const checkpoint=readCheckpointBattle();
 assertBattleDisplayOnly(source,checkpoint);
 const hook=BATTLE_DISPLAY_HOOKS[0][1].join('\n')+'\n';
 const mutations={
   'extra statement in hook':source.replace(hook,hook+'gameState.playerStats.hp = 0;\n'),
   'changed hook':source.replace('this._pixelMotion?.update({','this._pixelMotion?.dispose({'),
   'deleted hook':source.replace(hook,''),
   'moved intact hook':source.replace(hook,'')+hook,
   'duplicated hook':source.replace(hook,hook+hook),
   'unapproved body change':source+'// unapproved addition\n',
   'removed existing body':source.replace("import { getContainedRect } from '../ui/viewportLayout.js';\n",''),
 };
 for(const [name,fixture] of Object.entries(mutations)){
   assert.notEqual(fixture,source,name);
   assert.throws(()=>assertBattleDisplayOnly(fixture,checkpoint),{name:'AssertionError'},name);
 }
});
test('stable/checkpoint paths, exact new-file allowlist and package bytes remain protected',()=>{
 assert.equal(assertMotionScope().approvedHooks,9);
 for(const path of ['src/screens/extra.js','src/visuals/motion/extra.js','tests/motion-02/unapproved.test.mjs','tools/motion-02/raw.json'])
   assert.throws(()=>assertAddedPaths([path],new Set()),{name:'AssertionError'},path);
});
test('battle bridge imports only display modules, owns no clock/loader/Core/random/DOM',()=>{
 const source=fs.readFileSync('src/visuals/battleMotionBridge.js','utf8');
 for(const match of source.matchAll(/(?:from\s*|import\()['"]([^'"]+)['"]/g))assert.ok(match[1].startsWith('./motion/'));
 assert.doesNotMatch(source,/Math\.random\s*\(|\b(?:fetch|setTimeout|setInterval|requestAnimationFrame)\s*\(|\b(?:localStorage|sessionStorage|document|gameState|battleState|questionToken)\b/);
});
