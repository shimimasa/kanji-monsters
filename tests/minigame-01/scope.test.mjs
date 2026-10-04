import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {MINI_GAME_ADDITIONS, MINI_GAME_ENTRY_HASHES, assertMiniGameEntry} from './scope-contract.mjs';
const git=(...args)=>execFileSync('git',args,{maxBuffer:16*1024*1024}).toString('utf8').replaceAll('\r\n','\n');
test('mini-game source has no scheduler, battle bridge, Storage writes or kanji mutations',()=>{
  // The sprint input helper was removed with the arcade rebuild; the shared arcade kit replaces it.
  const sources=[...MINI_GAME_ADDITIONS.filter(p=>p.startsWith('src/')&&fs.existsSync(p)),
    'src/minigames/arcade/arcadeKit.js','src/minigames/arcade/arcadeStyles.js','src/minigames/gameplay/arcadeWorlds.js',
    'src/minigames/mathInvader/mathInvaderGame.js','src/minigames/mathInvader/mathInvaderView.js',
    'src/minigames/kanjiDefense/kanjiDefenseGame.js','src/minigames/kanjiDefense/kanjiDefenseView.js'];
  for(const p of sources){
    const source=fs.readFileSync(p,'utf8');
    assert.doesNotMatch(source,/\b(?:requestAnimationFrame|setInterval|setTimeout)\s*\(/,p);
    assert.doesNotMatch(source,/battleMotionBridge|battleScreen|\b(?:localStorage|sessionStorage)\b|saveNow\s*\(|saveGameData\s*\(/,p);
    if(p.includes('mathSprintGame')||p.includes('mathSprintGenerator'))assert.doesNotMatch(source.replace(/\/\/[^\n]*/g,''),/gameState|document|window|Motion|Storage/);
  }
});
