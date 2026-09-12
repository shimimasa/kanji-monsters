import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { MINIGAME_03_ADDITIONS, MINIGAME_03_BASE, MINIGAME_03_CHANGED } from './scope-contract.mjs';
import { MINIGAME_04_ADDITIONS, MINIGAME_04_CHANGED,
  MINIGAME_04_CONTRACT_DOC_HASH } from '../minigame-04/scope-contract.mjs';
import { MINIGAME_05_ADDITIONS, MINIGAME_05_CHANGED } from '../minigame-05/scope-contract.mjs';
import { MINIGAME_06_ADDITIONS, MINIGAME_06_CHANGED } from '../minigame-06/scope-contract.mjs';
import { MINIGAME_07_ADDITIONS, MINIGAME_07_CHANGED } from '../minigame-07/scope-contract.mjs';

const git = (...args) => execFileSync('git', args, { maxBuffer: 16 * 1024 * 1024 }).toString('utf8').replaceAll('\r\n', '\n');
const read = path => fs.readFileSync(path, 'utf8').replaceAll('\r\n', '\n');
const hash = source => crypto.createHash('sha256').update(source).digest('hex');

test('English probe and the later Sentence probe stay inside their explicit allowlists', () => {
  const tracked = git('diff', '--name-only', MINIGAME_03_BASE, '--').trim().split('\n').filter(Boolean);
  const untracked = git('ls-files', '--others', '--exclude-standard').trim().split('\n').filter(Boolean);
  const actual = [...new Set([...tracked, ...untracked])].sort();
  const allowed = new Set([...MINIGAME_03_CHANGED, ...MINIGAME_03_ADDITIONS,
    ...MINIGAME_04_CHANGED, ...MINIGAME_04_ADDITIONS,
    ...MINIGAME_05_CHANGED, ...MINIGAME_05_ADDITIONS,
    ...MINIGAME_06_CHANGED, ...MINIGAME_06_ADDITIONS,
    ...MINIGAME_07_CHANGED, ...MINIGAME_07_ADDITIONS]);
  assert.deepEqual(actual.filter(path => !allowed.has(path)), []);
  for (const path of MINIGAME_03_ADDITIONS.filter(path => path.startsWith('src/') || path.startsWith('tests/'))) {
    assert.ok(actual.includes(path), `required MINIGAME-03 file missing: ${path}`);
    assert.ok(fs.lstatSync(path).isFile(), `regular file required: ${path}`);
  }
});

test('Stable Host, Collection, Companion, and existing views are byte-identical; final Contract doc is exact', () => {
  for (const path of [
    'src/minigames/miniGameHost.js', 'src/minigames/collectionAdapter.js', 'src/minigames/companionAdapter.js',
    'src/minigames/mathSprint/mathSprintView.js',
    'src/minigames/mathInvader/mathInvaderView.js', 'src/minigames/mathSprint/mathSprintInput.js',
  ]) assert.equal(read(path), git('show', `${MINIGAME_03_BASE}:${path}`), path);
  assert.equal(hash(read('src/minigames/README.md')), MINIGAME_04_CONTRACT_DOC_HASH);
});

test('Host has no game command or gameId branch and registry keeps a thin English adapter', () => {
  const host = read('src/minigames/miniGameHost.js');
  assert.match(host, /current\.dispatch\(command\) !== true/);
  assert.doesNotMatch(host, /englishChoice|sentenceOrder|command\.type|switch\s*\(|case\s+['"]|if\s*\([^)]*gameId/);
  const registry = read('src/minigames/registry.js');
  assert.match(registry, /onAnswer: payload => context\.dispatch\(\{ type: 'answer', payload \}\)/);
  assert.doesNotMatch(registry, /globalThis|addEventListener|requestAnimationFrame|setInterval/);
});

test('English source owns no numeric helper, scheduler, Storage, save, battle, or Motion code', () => {
  for (const path of MINIGAME_03_ADDITIONS.filter(path => path.startsWith('src/'))) {
    const source = read(path);
    assert.doesNotMatch(source, /mathSprintInput|normalizeMathAnswer|requestAnimationFrame|setInterval|setTimeout/, path);
    assert.doesNotMatch(source, /localStorage|sessionStorage|saveNow\s*\(|saveGameData\s*\(|battleMotionBridge|battleScreen/, path);
  }
  const core = read('src/minigames/englishChoice/englishChoiceGame.js').replace(/\/\/[^\n]*/g, '');
  assert.doesNotMatch(core, /\b(?:document|window|gameState|Storage|Motion)\b/);
});

test('package, save, kanji Core, battle, Motion, assets, and FSM are unchanged', () => {
  const protectedPaths = ['package.json', 'package-lock.json', 'src/core', 'src/data',
    'src/init/fsmsetup.js', 'src/screens/battleScreen.js', 'src/visuals', 'public'];
  assert.equal(git('diff', '--name-only', MINIGAME_03_BASE, '--', ...protectedPaths).trim(), '');
  assert.equal(git('ls-files', '--others', '--exclude-standard', '--', ...protectedPaths).trim(), '');
});
