import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { MINIGAME_02_ADDITIONS, MINIGAME_02_CHANGED, MINIGAME_02_SOURCE_HASHES } from './scope-contract.mjs';
import { CONTRACT_V1_ADDITIONS, CONTRACT_V1_CHANGED, withoutContractDispatch } from '../minigame-contract-v1/scope-contract.mjs';
import { MINIGAME_03_ADDITIONS, MINIGAME_03_CHANGED } from '../minigame-03/scope-contract.mjs';
import { MINIGAME_04_ADDITIONS, MINIGAME_04_CHANGED } from '../minigame-04/scope-contract.mjs';
import { MINIGAME_05_ADDITIONS, MINIGAME_05_CHANGED } from '../minigame-05/scope-contract.mjs';

const BASE = 'f067a6ce8c611b0f68d8ba456a4fb511e5dfc9e2';
const git = (...args) => execFileSync('git', args, { maxBuffer: 16 * 1024 * 1024 }).toString('utf8').replaceAll('\r\n', '\n');
const hash = source => crypto.createHash('sha256').update(source.replaceAll('\r\n', '\n')).digest('hex');

test('reviewed Host, registry, views, Core and title contents are exact', () => {
  for (const [path, expected] of Object.entries(MINIGAME_02_SOURCE_HASHES)) {
    const source = fs.readFileSync(path, 'utf8'); const actual = hash(source);
    assert.ok(expected.includes(actual), `${path} (${actual})`);
    assert.ok(!expected.includes(hash(`${source}\nunapproved()`)), `${path} negative fixture`);
  }
});

test('probe changes and additions stay inside the explicit MINIGAME-02 allowlist', () => {
  const tracked = git('diff', '--name-only', BASE, '--').trim().split('\n').filter(Boolean);
  const untracked = git('ls-files', '--others', '--exclude-standard').trim().split('\n').filter(Boolean);
  const actual = [...new Set([...tracked, ...untracked])].sort();
  const allowed = new Set([...MINIGAME_02_CHANGED, ...MINIGAME_02_ADDITIONS,
    ...CONTRACT_V1_CHANGED, ...CONTRACT_V1_ADDITIONS,
    ...MINIGAME_03_CHANGED, ...MINIGAME_03_ADDITIONS,
    ...MINIGAME_04_CHANGED, ...MINIGAME_04_ADDITIONS,
    ...MINIGAME_05_CHANGED, ...MINIGAME_05_ADDITIONS]);
  assert.deepEqual(actual.filter(path => !allowed.has(path)), []);
  for (const path of MINIGAME_02_ADDITIONS.filter(path => path.startsWith('src/') || path.startsWith('tests/'))) {
    assert.ok(actual.includes(path), `required probe file missing: ${path}`);
    assert.ok(fs.lstatSync(path).isFile(), `regular file required: ${path}`);
  }
  for (const path of ['src/minigames/mathInvader/extra.js', 'src/core/mathSave.js',
    'tests/minigame-02/raw.json', 'public/assets/math-invader.png']) {
    assert.ok(!allowed.has(path));
  }
});

test('generator, input, LearningEvent source, Companion and Collection boundaries are byte-reused', () => {
  const reused = [
    'src/minigames/mathSprint/mathSprintGenerator.js',
    'src/minigames/mathSprint/mathSprintInput.js',
    'src/minigames/companionAdapter.js',
    'src/minigames/collectionAdapter.js',
  ];
  for (const path of reused) {
    assert.equal(fs.readFileSync(path, 'utf8').replaceAll('\r\n', '\n'), git('show', `${BASE}:${path}`), path);
  }
  const sprint = fs.readFileSync('src/minigames/mathSprint/mathSprintGame.js', 'utf8').replaceAll('\r\n', '\n');
  assert.equal(withoutContractDispatch(sprint), git('show', `${BASE}:src/minigames/mathSprint/mathSprintGame.js`));
  const host = fs.readFileSync('src/minigames/miniGameHost.js', 'utf8');
  assert.doesNotMatch(host, /mathInvader|case\s+['"]math|if\s*\([^)]*gameId/);
});

test('battle, Motion, save/package and kanji Core are unchanged; probe owns no scheduler or Storage', () => {
  const protectedPaths = ['src/screens/battleScreen.js', 'src/visuals', 'src/core', 'src/data',
    'package.json', 'package-lock.json', 'public'];
  assert.equal(git('diff', '--name-only', BASE, '--', ...protectedPaths).trim(), '');
  const additions = git('ls-files', '--others', '--exclude-standard', '--', ...protectedPaths).trim();
  assert.equal(additions, '');
  for (const path of ['src/minigames/mathInvader/mathInvaderGame.js', 'src/minigames/mathInvader/mathInvaderView.js']) {
    const source = fs.readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /\b(?:requestAnimationFrame|setInterval|setTimeout|localStorage|sessionStorage)\s*(?:\.|\()/, path);
    assert.doesNotMatch(source, /battleMotionBridge|battleScreen|saveNow\s*\(|saveGameData\s*\(/, path);
  }
  const core = fs.readFileSync('src/minigames/mathInvader/mathInvaderGame.js', 'utf8').replace(/\/\/[^\n]*/g, '');
  assert.doesNotMatch(core, /\b(?:document|window|gameState|Storage|Motion)\b/);
});
