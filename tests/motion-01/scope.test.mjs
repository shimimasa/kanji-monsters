import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { HKD_E01_MOTION } from '../../src/visuals/motion/monsterMotionManifest.js';
const base='src/visuals/motion/';
test('engine imports remain within display-only modules and own no side-effect APIs',()=>{
  const files=fs.readdirSync(base).filter(f=>f.endsWith('.js'));
  for(const file of files){
    const source=fs.readFileSync(base+file,'utf8');
    for(const m of source.matchAll(/from\s+['"]([^'"]+)['"]/g))assert.ok(m[1].startsWith('./'));
    assert.doesNotMatch(source,/Math\.random\s*\(|\b(?:fetch|setTimeout|setInterval|requestAnimationFrame)\s*\(|\b(?:localStorage|sessionStorage)\b/);
  }
});
test('metadata is only HKD-E01 display information; original image hash remains exact',()=>{
  assert.deepEqual(Object.keys(HKD_E01_MOTION).sort(),
    ['monsterId','imageUrl','motionProfile','pivot','floorAnchor','imageSize','fixedEnvelope'].sort());
  const hash=crypto.createHash('sha256').update(fs.readFileSync('public'+HKD_E01_MOTION.imageUrl)).digest('hex');
  assert.equal(hash,'ee2a5e2456227d92efdf4824e7d8b17d3babd74165bd81bf70816e699155110e');
});
test('all baseline tracked source/package/assets remain unchanged',()=>{
  const stable='2a521dd5aa747314b25e761d976bd4f880cd58c3';
  const baseline=new Set(execFileSync('git',['ls-tree','-r','--name-only','-z',stable],{encoding:'utf8'}).split('\0').filter(Boolean));
  assert.ok(baseline.size>0);
  // New committed slice files are allowed; every original path must remain unchanged.
  // Disable rename detection so moving a protected path still exposes its deletion.
  const diff=execFileSync('git',['diff','--no-renames','--name-only','-z',stable,'--'],{encoding:'utf8'});
  assert.deepEqual(diff.split('\0').filter(path=>baseline.has(path)),[]);
});
test('package dependency tree has no Babylon or animation dependency',()=>{
  const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
  assert.deepEqual(pkg.devDependencies,{vite:'^5.3.1'});assert.equal(pkg.dependencies,undefined);
  assert.doesNotMatch(fs.readFileSync('package-lock.json','utf8'),/babylon/i);
});
test('standalone uses existing loader; mock imports no game or collection Core',()=>{
  const source=fs.readFileSync('tools/motion-01/demo.mjs','utf8');
  assert.match(source,/import \{ loadMonsterImage, loadBgImage \} from '\/src\/loaders\/assetsLoader.js'/);
  assert.doesNotMatch(source,/requestAnimationFrame\s*\(|localStorage|sessionStorage|gameState|saveGameData/);
  assert.doesNotMatch(fs.readFileSync('tools/motion-01/bridges.mjs','utf8'),/^import /m);
});
