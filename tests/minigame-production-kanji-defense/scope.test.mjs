import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { KANJI_DEFENSE_BASE } from './scope-contract.mjs';

const git = (...args) => execFileSync('git', args, { maxBuffer: 16 * 1024 * 1024 }).toString('utf8').replaceAll('\r\n', '\n');
const read = path => fs.readFileSync(path, 'utf8').replaceAll('\r\n', '\n');
const NL = String.fromCharCode(10);

// This redesign supersedes the old title-only integration allowlist.
// Preserve certified input/content/Core; the original scope-contract remains.
// Content baseline intentionally expanded under user approval. Old content
// preservation and all 120 records are separately certified in content-120 tests.
// The Content 120 byte freeze of the defense Core/View was retired when the game was
// rebuilt as a real-time arcade game; core.test.mjs and lifecycle.test.mjs specify it now.
test('main scheduler, battle, save transaction, audio and Motion remain unchanged', () => {
  for (const path of ['src/main.js','src/core/gameState.js','src/core/saveData.js','src/core/storageTransaction.js',
    'src/screens/battleScreen.js','src/audio/audioManager.js','src/visuals/motion/monsterMotionHost.js']) {
    // 2026-10-02 (user-approved type matchups): the battle may hold lines marked TYPE-MATCHUP and
    // nothing else new; every other line must still be byte-identical to the base.
    // 2026-10-04 (user-approved battle layout fix): lines marked BATTLE-LAYOUT are allowed the same way.
    const current = path === 'src/screens/battleScreen.js' ? read(path).split(NL).filter(line => !line.includes('// TYPE-MATCHUP') && !line.includes('// BATTLE-LAYOUT')).join(NL) : read(path);
    assert.equal(current, git('show', KANJI_DEFENSE_BASE + ':' + path), path);
  }
});
test('Host delegates every command without interpreting defense rules', () => {
  const host = read('src/minigames/miniGameHost.js');
  assert.ok(host.includes('current.dispatch(command) !== true'));
  for (const token of ['kanjiDefense','reading','escaped','command.type']) assert.ok(!host.includes(token), token);
});
test('production Core and View own no scheduler, Storage, save or shared engine', () => {
  for (const file of ['kanjiDefenseGame.js','kanjiDefenseContent.js','kanjiDefenseView.js']) {
    const source = read('src/minigames/kanjiDefense/' + file);
    for (const token of ['Date.now','performance.now','requestAnimationFrame','setInterval','setTimeout',
      'localStorage','sessionStorage','saveNow(','saveGameData(','battleMotionBridge','battleScreen',
      'sharedLane','InvaderEngine','CombatFramework']) assert.ok(!source.includes(token), token);
  }
});
test('v1 learning event and retry/escape payload remain intact', () => {
  const core = read('src/minigames/kanjiDefense/kanjiDefenseGame.js');
  for (const type of ['problemPresented','correct','incorrect','sessionComplete']) assert.ok(core.includes("'" + type + "'"));
  assert.ok(core.includes("reason: 'attemptsExhausted'")); assert.ok(core.includes("reason: 'escaped'"));
  assert.ok(core.includes('version: 1')); assert.ok(core.includes('activeElapsedMs'));
});
test('v1 Definition stays exact; the public title routes through the registry hub', async () => {
  const { miniGameRegistry } = await import('../../src/minigames/registry.js');
  assert.deepEqual(Object.keys(miniGameRegistry.kanjiDefense).sort(), ['create','createView','id','title']);
  assert.ok(read('src/screens/titleScreen.js').includes("publish('changeScreen', 'miniGameHub')"));
  assert.ok(!read('src/screens/titleScreen.js').includes('titleKanjiDefenseButton'));
  assert.ok(read('src/screens/miniGameHubScreen.js').includes('Object.values(miniGameRegistry)'));
});
test('shell and reward presentation never own Storage or learning answer dispatch', () => {
  for (const path of ['src/minigames/miniGameShell.js','src/minigames/companionScene.js','src/minigames/companionPlay.js']) {
    const source = read(path);
    for (const token of ['localStorage','sessionStorage','.dispatch(','setInterval','requestAnimationFrame']) assert.ok(!source.includes(token), path + ': ' + token);
  }
});
