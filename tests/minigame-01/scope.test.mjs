import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {MINI_GAME_ADDITIONS, MINI_GAME_ENTRY_HASHES, assertMiniGameEntry} from './scope-contract.mjs';
const git=(...args)=>execFileSync('git',args,{maxBuffer:16*1024*1024}).toString('utf8').replaceAll('\r\n','\n');
test('only fixed title/FSM deltas; negative mutation fixtures reject extra code and missing/moved hooks',()=>{
  for(const p of Object.keys(MINI_GAME_ENTRY_HASHES)){
    const source=fs.readFileSync(p,'utf8');assertMiniGameEntry(p,source);
    assert.throws(()=>assertMiniGameEntry(p,source+'\ngameState.playerStats.hp=0;'));
    assert.throws(()=>assertMiniGameEntry(p,source.slice(10)));
    assert.throws(()=>assertMiniGameEntry(p,source.split('\n').reverse().join('\n')));
  }
});
test('all Motion source and battle remain exactly at adopted checkpoint; no runtime dependency or new assets',()=>{
  const sha='7166de414c766f96a713d3f4c43be37bc6182db3';
  const paths=['src/screens/battleScreen.js','src/visuals/battleMotionBridge.js','package.json','package-lock.json',
    ...fs.readdirSync('src/visuals/motion').map(n=>'src/visuals/motion/'+n)];
  for(const p of paths)assert.equal(fs.readFileSync(p,'utf8').replaceAll('\r\n','\n'),git('show',`${sha}:${p}`),p);
  assert.equal(git('diff',sha,'--name-only','--','public').trim(),'');
});
test('mini-game source has no scheduler, battle bridge, Storage writes or kanji mutations',()=>{
  for(const p of MINI_GAME_ADDITIONS.filter(p=>p.startsWith('src/'))){
    const source=fs.readFileSync(p,'utf8');
    assert.doesNotMatch(source,/\b(?:requestAnimationFrame|setInterval|setTimeout)\s*\(/,p);
    assert.doesNotMatch(source,/battleMotionBridge|battleScreen|\b(?:localStorage|sessionStorage)\b|saveNow\s*\(|saveGameData\s*\(/,p);
    if(p.includes('mathSprintGame')||p.includes('mathSprintGenerator'))assert.doesNotMatch(source.replace(/\/\/[^\n]*/g,''),/gameState|document|window|Motion|Storage/);
  }
});
