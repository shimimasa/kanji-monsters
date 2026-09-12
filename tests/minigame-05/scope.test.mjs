import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { MINIGAME_05_ADDITIONS, MINIGAME_05_BASE, MINIGAME_05_CHANGED } from './scope-contract.mjs';

const git = (...args) => execFileSync('git', args, { maxBuffer: 16 * 1024 * 1024 }).toString('utf8').replaceAll('\r\n', '\n');
const read = path => fs.readFileSync(path, 'utf8').replaceAll('\r\n', '\n');

test('Deadline probe stays inside its exact changed-file allowlist', () => {
  const tracked = git('diff', '--name-only', MINIGAME_05_BASE, '--').trim().split('\n').filter(Boolean);
  const untracked = git('ls-files', '--others', '--exclude-standard').trim().split('\n').filter(Boolean);
  const actual = [...new Set([...tracked, ...untracked])].sort();
  const allowed = new Set([...MINIGAME_05_CHANGED, ...MINIGAME_05_ADDITIONS]);
  assert.deepEqual(actual.filter(path => !allowed.has(path)), []);
  for (const path of MINIGAME_05_ADDITIONS.filter(path => path.startsWith('src/') || path.startsWith('tests/'))) {
    assert.ok(actual.includes(path), `required MINIGAME-05 file missing: ${path}`);
    assert.ok(fs.lstatSync(path).isFile(), `regular file required: ${path}`);
  }
});

test('Stable Contract, Host, adapters, and existing games remain byte-identical', () => {
  const protectedFiles = [
    'src/minigames/README.md',
    'src/minigames/miniGameHost.js',
    'src/minigames/collectionAdapter.js',
    'src/minigames/companionAdapter.js',
    'src/minigames/mathSprint/mathSprintGame.js',
    'src/minigames/mathSprint/mathSprintInput.js',
    'src/minigames/mathSprint/mathSprintView.js',
    'src/minigames/mathInvader/mathInvaderGame.js',
    'src/minigames/mathInvader/mathInvaderView.js',
    'src/minigames/englishChoice/englishChoiceGame.js',
    'src/minigames/englishChoice/englishChoiceQuestions.js',
    'src/minigames/englishChoice/englishChoiceView.js',
    'src/minigames/sentenceOrder/sentenceOrderGame.js',
    'src/minigames/sentenceOrder/sentenceOrderQuestions.js',
    'src/minigames/sentenceOrder/sentenceOrderView.js',
  ];
  for (const path of protectedFiles) assert.equal(read(path), git('show', `${MINIGAME_05_BASE}:${path}`), path);
});

test('Host has no timeout/game branch and Timed Choice owns only answer/next commands', () => {
  const host = read('src/minigames/miniGameHost.js');
  assert.match(host, /current\.dispatch\(command\) !== true/);
  assert.doesNotMatch(host, /timedChoice|timeout|command\.type|switch\s*\(|case\s+['"]|if\s*\([^)]*gameId/);
  const core = read('src/minigames/timedChoice/timedChoiceGame.js');
  assert.match(core, /command\.type === 'answer'/); assert.match(core, /command\.type === 'next'/);
  assert.doesNotMatch(core, /command\.type === 'timeout'/);
});

test('Deadline source owns no wall clock, scheduler, Storage, save, battle, or Motion dependency', () => {
  for (const path of MINIGAME_05_ADDITIONS.filter(path => path.startsWith('src/'))) {
    const source = read(path);
    assert.doesNotMatch(source, /Date\.now|performance\.now|requestAnimationFrame|setInterval|setTimeout|Worker\s*\(/, path);
    assert.doesNotMatch(source, /localStorage|sessionStorage|saveNow\s*\(|saveGameData\s*\(|battleMotionBridge|battleScreen/, path);
  }
  const core = read('src/minigames/timedChoice/timedChoiceGame.js').replace(/\/\/[^\n]*/g, '');
  assert.doesNotMatch(core, /\b(?:document|window|gameState|Storage|Motion|Companion|Collection)\b/);
});

test('timeout uses existing incorrect semantics and preserves the LearningEvent envelope source', () => {
  const core = read('src/minigames/timedChoice/timedChoiceGame.js');
  assert.match(core, /notify\(isCorrect \? 'correct' : 'incorrect'/);
  assert.match(core, /consumeAttempt\(\{ reason: 'timeout' \}\)/);
  assert.match(core, /version: 1, gameId: 'timedChoice', sessionId, seq: \+\+seq, type/);
  assert.doesNotMatch(core, /notify\(['"]timeout['"]/);
});

test('package, save schema, main RAF, battle, Motion, assets, and FSM are unchanged', () => {
  const protectedPaths = ['package.json', 'package-lock.json', 'src/core', 'src/data', 'src/main.js',
    'src/init/fsmsetup.js', 'src/screens/battleScreen.js', 'src/visuals', 'public'];
  assert.equal(git('diff', '--name-only', MINIGAME_05_BASE, '--', ...protectedPaths).trim(), '');
  assert.equal(git('ls-files', '--others', '--exclude-standard', '--', ...protectedPaths).trim(), '');
});
