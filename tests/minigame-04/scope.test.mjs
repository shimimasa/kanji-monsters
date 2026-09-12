import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { MINIGAME_03_ADDITIONS, MINIGAME_03_CHANGED } from '../minigame-03/scope-contract.mjs';
import { MINIGAME_04_ADDITIONS, MINIGAME_04_BASE, MINIGAME_04_CHANGED,
  MINIGAME_04_CONTRACT_DOC_HASH } from './scope-contract.mjs';
import { MINIGAME_05_ADDITIONS, MINIGAME_05_CHANGED } from '../minigame-05/scope-contract.mjs';
import { MINIGAME_06_ADDITIONS, MINIGAME_06_CHANGED } from '../minigame-06/scope-contract.mjs';

const git = (...args) => execFileSync('git', args, { maxBuffer: 16 * 1024 * 1024 }).toString('utf8').replaceAll('\r\n', '\n');
const read = path => fs.readFileSync(path, 'utf8').replaceAll('\r\n', '\n');
const hash = source => crypto.createHash('sha256').update(source).digest('hex');

test('Sentence Order probe stays inside the cumulative MINIGAME-03/04 allowlist', () => {
  const tracked = git('diff', '--name-only', MINIGAME_04_BASE, '--').trim().split('\n').filter(Boolean);
  const untracked = git('ls-files', '--others', '--exclude-standard').trim().split('\n').filter(Boolean);
  const actual = [...new Set([...tracked, ...untracked])].sort();
  const allowed = new Set([...MINIGAME_03_CHANGED, ...MINIGAME_03_ADDITIONS,
    ...MINIGAME_04_CHANGED, ...MINIGAME_04_ADDITIONS,
    ...MINIGAME_05_CHANGED, ...MINIGAME_05_ADDITIONS,
    ...MINIGAME_06_CHANGED, ...MINIGAME_06_ADDITIONS]);
  assert.deepEqual(actual.filter(path => !allowed.has(path)), []);
  for (const path of MINIGAME_04_ADDITIONS.filter(path => path.startsWith('src/') || path.startsWith('tests/'))) {
    assert.ok(actual.includes(path), `required MINIGAME-04 file missing: ${path}`);
    assert.ok(fs.lstatSync(path).isFile(), `regular file required: ${path}`);
  }
});

test('Stable Host, adapters, existing views, and numeric helper are byte-identical; final Contract doc is exact', () => {
  for (const path of [
    'src/minigames/miniGameHost.js', 'src/minigames/collectionAdapter.js', 'src/minigames/companionAdapter.js',
    'src/minigames/mathSprint/mathSprintView.js',
    'src/minigames/mathInvader/mathInvaderView.js',
    'src/minigames/mathSprint/mathSprintInput.js',
  ]) assert.equal(read(path), git('show', `${MINIGAME_04_BASE}:${path}`), path);
  assert.equal(hash(read('src/minigames/englishChoice/englishChoiceView.js')),
    '596845c9e12b79a8858e33fab2748ee75a69bd0388d2ef8138cad9dd6f673423');
  assert.equal(hash(read('src/minigames/README.md')), MINIGAME_04_CONTRACT_DOC_HASH);
});

test('Host has no game or command branch while Sentence View sends generic dispatch commands', () => {
  const host = read('src/minigames/miniGameHost.js');
  assert.match(host, /current\.dispatch\(command\) !== true/);
  assert.doesNotMatch(host, /sentenceOrder|englishChoice|command\.type|switch\s*\(|case\s+['"]|if\s*\([^)]*gameId/);
  const view = read('src/minigames/sentenceOrder/sentenceOrderView.js');
  for (const type of ['reorder', 'submit', 'next']) assert.match(view, new RegExp(`type: '${type}'`));
});

test('Sentence source owns no numeric helper, scheduler, Storage, save, battle, or Motion dependency', () => {
  for (const path of MINIGAME_04_ADDITIONS.filter(path => path.startsWith('src/'))) {
    const source = read(path);
    assert.doesNotMatch(source, /mathSprintInput|normalizeMathAnswer|requestAnimationFrame|setInterval|setTimeout/, path);
    assert.doesNotMatch(source, /localStorage|sessionStorage|saveNow\s*\(|saveGameData\s*\(|battleMotionBridge|battleScreen/, path);
  }
  const core = read('src/minigames/sentenceOrder/sentenceOrderGame.js').replace(/\/\/[^\n]*/g, '');
  assert.doesNotMatch(core, /\b(?:document|window|gameState|Storage|Motion)\b/);
});

test('package, save schema, kanji Core, battle, Motion, assets, main lifecycle, and FSM are unchanged', () => {
  const protectedPaths = ['package.json', 'package-lock.json', 'src/core', 'src/data', 'src/main.js',
    'src/init/fsmsetup.js', 'src/screens/battleScreen.js', 'src/visuals', 'public'];
  assert.equal(git('diff', '--name-only', MINIGAME_04_BASE, '--', ...protectedPaths).trim(), '');
  assert.equal(git('ls-files', '--others', '--exclude-standard', '--', ...protectedPaths).trim(), '');
});
