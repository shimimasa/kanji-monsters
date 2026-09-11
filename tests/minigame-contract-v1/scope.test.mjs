import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { CONTRACT_V1_ADDITIONS, CONTRACT_V1_BASE, CONTRACT_V1_CHANGED,
  withoutContractDispatch } from './scope-contract.mjs';

const git = (...args) => execFileSync('git', args, { maxBuffer: 16 * 1024 * 1024 })
  .toString('utf8').replaceAll('\r\n', '\n');
const read = path => fs.readFileSync(path, 'utf8').replaceAll('\r\n', '\n');

test('Contract-v1 fixation stays inside its explicit checkpoint allowlist', () => {
  const tracked = git('diff', '--name-only', CONTRACT_V1_BASE, '--').trim().split('\n').filter(Boolean);
  const untracked = git('ls-files', '--others', '--exclude-standard').trim().split('\n').filter(Boolean);
  const actual = [...new Set([...tracked, ...untracked])].sort();
  const allowed = new Set([...CONTRACT_V1_CHANGED, ...CONTRACT_V1_ADDITIONS]);
  assert.deepEqual(actual.filter(path => !allowed.has(path)), []);
  for (const path of CONTRACT_V1_ADDITIONS.filter(path => path.startsWith('src/') || path.startsWith('tests/'))) {
    assert.ok(actual.includes(path), `required Contract-v1 file missing: ${path}`);
    assert.ok(fs.lstatSync(path).isFile(), `regular file required: ${path}`);
  }
});

test('dispatch adapters are the only Sprint and Invader Core changes', () => {
  for (const path of ['src/minigames/mathSprint/mathSprintGame.js',
    'src/minigames/mathInvader/mathInvaderGame.js']) {
    assert.equal(withoutContractDispatch(read(path)), git('show', `${CONTRACT_V1_BASE}:${path}`), path);
  }
});

test('View, LearningEvent dependencies, Collection and Companion remain byte-identical', () => {
  for (const path of ['src/minigames/mathSprint/mathSprintView.js',
    'src/minigames/mathInvader/mathInvaderView.js', 'src/minigames/mathSprint/mathSprintInput.js',
    'src/minigames/collectionAdapter.js', 'src/minigames/companionAdapter.js']) {
    assert.equal(read(path), git('show', `${CONTRACT_V1_BASE}:${path}`), path);
  }
});

test('Host owns no command vocabulary or game-specific branch', () => {
  const host = read('src/minigames/miniGameHost.js');
  assert.match(host, /current\.dispatch\(command\) !== true/);
  assert.doesNotMatch(host, /command\.type|switch\s*\(|case\s+['"]|mathInvader|if\s*\([^)]*gameId/);
  const registry = read('src/minigames/registry.js');
  assert.match(registry, /context\.dispatch\(\{ type: 'submit', payload \}\)/);
  assert.doesNotMatch(registry, /globalThis|addEventListener|requestAnimationFrame|setInterval/);
});

test('Platform source adds no scheduler, Storage, save or battle dependency', () => {
  const paths = ['src/minigames/miniGameHost.js', 'src/minigames/registry.js',
    'src/minigames/mathSprint/mathSprintGame.js', 'src/minigames/mathInvader/mathInvaderGame.js'];
  for (const path of paths) {
    const source = read(path);
    assert.doesNotMatch(source, /\b(?:requestAnimationFrame|setInterval|setTimeout|localStorage|sessionStorage)\s*(?:\.|\()/, path);
    assert.doesNotMatch(source, /battleMotionBridge|battleScreen|saveNow\s*\(|saveGameData\s*\(/, path);
  }
  assert.equal(git('diff', '--name-only', CONTRACT_V1_BASE, '--', 'package.json', 'package-lock.json',
    'src/core', 'src/screens/battleScreen.js', 'src/visuals', 'public').trim(), '');
});
