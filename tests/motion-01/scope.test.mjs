import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { assertMotionScope } from '../motion-02/scope-audit.mjs';
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
test('baseline paths remain unchanged except the exact approved MOTION-02 battle hooks',()=>{
  const audit=assertMotionScope();
  assert.ok(audit.stablePaths>0);
  assert.equal(audit.approvedHooks,9);
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
