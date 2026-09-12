import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {BATTLE_DISPLAY_HOOKS} from './battle-display-hooks.mjs';
import {MINI_GAME_ENTRY_HASHES, MINI_GAME_ADDITIONS, assertMiniGameEntry} from '../minigame-01/scope-contract.mjs';
import {MINIGAME_02_ADDITIONS} from '../minigame-02/scope-contract.mjs';
import {CONTRACT_V1_ADDITIONS} from '../minigame-contract-v1/scope-contract.mjs';
import {MINIGAME_03_ADDITIONS} from '../minigame-03/scope-contract.mjs';
import {MINIGAME_04_ADDITIONS} from '../minigame-04/scope-contract.mjs';
import {MINIGAME_05_ADDITIONS} from '../minigame-05/scope-contract.mjs';
import {MINIGAME_06_ADDITIONS} from '../minigame-06/scope-contract.mjs';
import {MINIGAME_07_ADDITIONS} from '../minigame-07/scope-contract.mjs';
import {PLATFORM_V1_CONSOLIDATION_ADDITIONS} from '../minigame-platform-v1/scope-contract.mjs';

export const STABLE = '2a521dd5aa747314b25e761d976bd4f880cd58c3';
export const CHECKPOINT = '997a08b8b7e1291901b11e279033b1d5d322eda9';
export const BATTLE = 'src/screens/battleScreen.js';
const SCOPE_TEST = 'tests/motion-01/scope.test.mjs';
const git = (...args) => execFileSync('git', args, {maxBuffer: 16 * 1024 * 1024});
const paths = bytes => bytes.toString('utf8').split('\0').filter(Boolean);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const lf = text => text.replaceAll('\r\n', '\n');

// These zero-based checkpoint line boundaries are from the approved nine hunks.
// Unlike substring removal, fixed placement also rejects moving an intact hook.
const OFFSETS = Object.freeze([25, 821, 1073, 1202, 1465, 3376, 5101, 5115, 5691]);
const HOOK_SHA = '118c8f0a11b40b66f6e123308e357bd7a0ce0eb0744d1ff0644a85c0db5d9ccd';

export const MOTION_02_ADDITIONS = Object.freeze([
  'src/visuals/battleMotionBridge.js',
  'tests/motion-02/battle-display-hooks.mjs',
  'tests/motion-02/battle-fixture.mjs',
  'tests/motion-02/battle.test.mjs',
  'tests/motion-02/bridge.test.mjs',
  'tests/motion-02/scope.test.mjs',
  'tests/motion-02/scope-audit.mjs',
  'tools/motion-02/bundle-audit.mjs',
  'tools/motion-02/cdp.mjs',
  'tools/motion-02/functional-qa.mjs',
  'tools/motion-02/input-isolation-qa.mjs',
  'tools/motion-02/legacy-isolation-qa.mjs',
  'tools/motion-02/lifecycle-layout-qa.mjs',
  'tools/motion-02/README.md',
  'tools/motion-02/route-qa.mjs',
  'tools/motion-02/start-qa.mjs',
  'tools/motion-02/verify.mjs',
  'YOMITABI_MOTION_02_BATTLE_INTEGRATION_REPORT.md',
]);
// Pre-existing local freeze document, explicitly separate from new product files.
const CARRYOVER = ['YOMITABI_MOTION_01_GIT_FREEZE.md'];

export function readCheckpointBattle() {
  return git('show', `${CHECKPOINT}:${BATTLE}`).toString('utf8');
}

export function assertBattleDisplayOnly(current, checkpoint = readCheckpointBattle()) {
  assert.equal(BATTLE_DISPLAY_HOOKS.length, 9);
  assert.equal(sha(JSON.stringify(BATTLE_DISPLAY_HOOKS)), HOOK_SHA, 'approved hook contents changed');
  const original = lf(checkpoint).split('\n');
  const expected = [], spans = [];
  let cursor = 0;
  for (const [i, [removed, added]] of BATTLE_DISPLAY_HOOKS.entries()) {
    const at = OFFSETS[i];
    assert.ok(at >= cursor);
    assert.deepEqual(original.slice(at, at + removed.length), removed, `checkpoint hunk ${i + 1}`);
    expected.push(...original.slice(cursor, at));
    spans.push({at: expected.length, added, removed});
    expected.push(...added);
    cursor = at + removed.length;
  }
  expected.push(...original.slice(cursor));
  const actual = lf(current).split('\n');
  assert.equal(actual.join('\n'), expected.join('\n'), 'only the exact nine hooks at approved positions are allowed');
  for (const span of spans.reverse()) {
    assert.deepEqual(actual.slice(span.at, span.at + span.added.length), span.added);
    actual.splice(span.at, span.added.length, ...span.removed);
  }
  assert.equal(actual.join('\n'), lf(checkpoint), 'remaining battle body must equal checkpoint');
}

export function assertAddedPaths(inventory, checkpointPaths) {
  const allowed = new Set([...MOTION_02_ADDITIONS, ...CARRYOVER, ...MINI_GAME_ADDITIONS,
    ...MINIGAME_02_ADDITIONS, ...CONTRACT_V1_ADDITIONS, ...MINIGAME_03_ADDITIONS,
    ...MINIGAME_04_ADDITIONS, ...MINIGAME_05_ADDITIONS, ...MINIGAME_06_ADDITIONS, ...MINIGAME_07_ADDITIONS,
    ...PLATFORM_V1_CONSOLIDATION_ADDITIONS]);
  const added = [...new Set(inventory)].filter(p => !checkpointPaths.has(p));
  assert.deepEqual(added.filter(p => !allowed.has(p)).sort(), [], 'unapproved new paths');
}

export function assertMotionScope() {
  const stablePaths = new Set(paths(git('ls-tree', '-r', '--name-only', '-z', STABLE)));
  const checkpointPaths = new Set(paths(git('ls-tree', '-r', '--name-only', '-z', CHECKPOINT)));
  assert.ok(stablePaths.size > 0 && checkpointPaths.size > stablePaths.size);
  // Compare checkpoint -> index as well as checkpoint -> worktree. A staged change
  // hidden by an opposite unstaged change must not pass the audit.
  for (const cached of [[], ['--cached']]) {
    const stableDiff = paths(git('diff', ...cached, '--no-renames', '--name-only', '-z', STABLE, '--'));
    assert.deepEqual(stableDiff.filter(p => stablePaths.has(p) && p !== BATTLE && !Object.hasOwn(MINI_GAME_ENTRY_HASHES, p)), [], 'protected stable path changed/deleted/renamed/type-changed');
    const checkpointDiff = paths(git('diff', ...cached, '--no-renames', '--name-only', '-z', CHECKPOINT, '--'));
    assert.deepEqual(checkpointDiff.filter(p => checkpointPaths.has(p) && ![BATTLE, SCOPE_TEST, ...Object.keys(MINI_GAME_ENTRY_HASHES)].includes(p)), [], 'checkpoint path changed outside authorized Motion and MiniGame entries');
  }
  for (const p of Object.keys(MINI_GAME_ENTRY_HASHES)) {
    assert.ok(fs.lstatSync(p).isFile());
    assertMiniGameEntry(p, fs.readFileSync(p, 'utf8'));
    const fields = git('ls-files', '--stage', '--', p).toString('utf8').trim().split(/\s+/);
    assert.equal(fields[0], '100644'); assert.equal(fields[2], '0');
    const indexedEntry = git('show', `:${p}`).toString('utf8');
    const checkpointEntry = git('show', `${CHECKPOINT}:${p}`).toString('utf8');
    if (lf(indexedEntry) !== lf(checkpointEntry)) assertMiniGameEntry(p, indexedEntry);
  }
  // Never allow deleting or type-changing even the two intentionally edited paths.
  for (const p of [BATTLE, SCOPE_TEST]) {
    assert.ok(fs.lstatSync(p).isFile(), `expected regular file: ${p}`);
    const modes = git('ls-files', '--stage', '--', p).toString('utf8').trim().split(/\s+/);
    assert.equal(modes[0], '100644');
    assert.equal(modes[2], '0');
  }
  assertBattleDisplayOnly(fs.readFileSync(BATTLE, 'utf8'));
  // An unchanged index is normal before staging. If battle is staged, audit it too.
  const indexed = git('show', `:${BATTLE}`).toString('utf8');
  if (lf(indexed) !== lf(readCheckpointBattle())) assertBattleDisplayOnly(indexed);
  const inventory = paths(git('ls-files', '--cached', '--others', '--exclude-standard', '-z'));
  assertAddedPaths(inventory, checkpointPaths);
  for (const p of MOTION_02_ADDITIONS) {
    assert.ok(inventory.includes(p), `required explicit addition missing: ${p}`);
    assert.ok(fs.lstatSync(p).isFile(), `addition must be a regular file: ${p}`);
    const indexed = git('ls-files', '--stage', '--', p).toString('utf8').trim();
    if (indexed) {
      const fields = indexed.split(/\s+/);
      assert.equal(fields[0], '100644', `addition index type: ${p}`);
      assert.equal(fields[2], '0', `addition conflict: ${p}`);
    }
  }
  const packageHashes = {
    'package.json': '621369ef393b9370479433c944b7679e58b5ae5ac455c1cc6f73e794ae770431',
    'package-lock.json': '213c23ba92664e968f865f874b98945e622f022f5b7c97f061bd344bad6531b9',
  };
  for (const p of ['package.json', 'package-lock.json']) {
    // cat-file --filters materializes the checkpoint's Windows checkout bytes.
    // Raw Git blobs use LF; existing package files use the checkout's CRLF.
    const expected = git('cat-file', '--filters', `${CHECKPOINT}:${p}`);
    const actual = fs.readFileSync(p);
    assert.ok(actual.equals(expected), `${p}: checkpoint checkout bytes differ`);
    assert.equal(sha(actual), sha(expected), `${p}: SHA-256 mismatch`);
    assert.equal(sha(actual), packageHashes[p], `${p}: recorded checkpoint byte hash changed`);
  }
  return {stablePaths: stablePaths.size, checkpointPaths: checkpointPaths.size,
    approvedHooks: BATTLE_DISPLAY_HOOKS.length, explicitAdditions: MOTION_02_ADDITIONS.length};
}
