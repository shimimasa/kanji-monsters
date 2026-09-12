import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { MINIGAME_07_ADDITIONS, MINIGAME_07_BASE, MINIGAME_07_CHANGED } from './scope-contract.mjs';

const git = (...args) => execFileSync('git', args, { maxBuffer: 16 * 1024 * 1024 }).toString('utf8').replaceAll('\r\n', '\n');
const read = path => fs.readFileSync(path, 'utf8').replaceAll('\r\n', '\n');

test('Async probe stays inside its exact changed-file allowlist', () => {
  const tracked = git('diff', '--name-only', MINIGAME_07_BASE, '--').trim().split('\n').filter(Boolean);
  const untracked = git('ls-files', '--others', '--exclude-standard').trim().split('\n').filter(Boolean);
  const actual = [...new Set([...tracked, ...untracked])].sort(); const allowed = new Set([...MINIGAME_07_CHANGED, ...MINIGAME_07_ADDITIONS]);
  assert.deepEqual(actual.filter(path => !allowed.has(path)), []);
  for (const path of MINIGAME_07_ADDITIONS.filter(path => path.startsWith('src/') || path.startsWith('tests/'))) {
    assert.ok(actual.includes(path), `required MINIGAME-07 file missing: ${path}`); assert.ok(fs.lstatSync(path).isFile(), `regular file required: ${path}`);
  }
});

test('Stable Contract, Host, adapters, and games 01-06 remain byte-identical', () => {
  const protectedFiles = [
    'src/minigames/README.md', 'src/minigames/miniGameHost.js', 'src/minigames/collectionAdapter.js', 'src/minigames/companionAdapter.js',
    'src/minigames/mathSprint/mathSprintGame.js', 'src/minigames/mathSprint/mathSprintInput.js', 'src/minigames/mathSprint/mathSprintView.js',
    'src/minigames/mathInvader/mathInvaderGame.js', 'src/minigames/mathInvader/mathInvaderView.js',
    'src/minigames/englishChoice/englishChoiceGame.js', 'src/minigames/englishChoice/englishChoiceQuestions.js', 'src/minigames/englishChoice/englishChoiceView.js',
    'src/minigames/sentenceOrder/sentenceOrderGame.js', 'src/minigames/sentenceOrder/sentenceOrderQuestions.js', 'src/minigames/sentenceOrder/sentenceOrderView.js',
    'src/minigames/timedChoice/timedChoiceGame.js', 'src/minigames/timedChoice/timedChoiceQuestions.js', 'src/minigames/timedChoice/timedChoiceView.js',
    'src/minigames/multiSelect/multiSelectGame.js', 'src/minigames/multiSelect/multiSelectQuestions.js', 'src/minigames/multiSelect/multiSelectView.js',
  ];
  for (const path of protectedFiles) assert.equal(read(path), git('show', `${MINIGAME_07_BASE}:${path}`), path);
});

test('Host has no async lifecycle knowledge, awaits, game branch, or changed Promise behavior', () => {
  const host = read('src/minigames/miniGameHost.js'); assert.equal(host, git('show', `${MINIGAME_07_BASE}:src/minigames/miniGameHost.js`));
  assert.match(host, /game\.enter\(\); host\.update\(0\)/); assert.match(host, /current\.dispatch\(command\) !== true/);
  assert.doesNotMatch(host, /asyncChoice|AbortController|loading|onReady|asyncEnter|cancelLoad|loadingPromise|await\s+game|if\s*\([^)]*gameId/);
  assert.equal((host.match(/\bPromise\b/g) ?? []).length, 2, 'only the unchanged Companion image loader Promise references remain');
});

test('Async Choice keeps enter synchronous and owns generation, resolve/reject, and optional abort locally', () => {
  const core = read('src/minigames/asyncChoice/asyncChoiceGame.js');
  assert.match(core, /const isCurrentLoad = loadId => active && generation === loadId && phase === 'loading'/);
  assert.match(core, /Promise\.resolve\(pending\)\.then\(fixture => applyLoaded\(loadId, fixture\), \(\) => applyFailed\(loadId\)\)/);
  assert.match(core, /active = false; generation\+\+; attemptId = null/); assert.match(core, /controller\?\.abort\(\)/);
  assert.match(core, /enter\(\) \{/); assert.doesNotMatch(core, /async\s+enter|sharedAsync|globalAsync|AsyncManager/);
});

test('loading/failure emit no new LearningEvent and envelope source stays exact', () => {
  const core = read('src/minigames/asyncChoice/asyncChoiceGame.js');
  assert.match(core, /version: 1, gameId: 'asyncChoice', sessionId, seq: \+\+seq, type/);
  assert.match(core, /notify\('problemPresented'/); assert.match(core, /notify\(isCorrect \? 'correct' : 'incorrect'/); assert.match(core, /notify\('sessionComplete'/);
  assert.doesNotMatch(core, /notify\(['"](?:loading|loaded|loadFailed|ready|cancelled)['"]/);
  const readme = read('src/minigames/README.md'); assert.match(readme, /fixed event types are `problemPresented`, `correct`, `incorrect`, and\s+`sessionComplete`/);
});

test('production loader is local-only and source owns no scheduler, Storage, save, or global async manager', () => {
  for (const path of MINIGAME_07_ADDITIONS.filter(path => path.startsWith('src/'))) {
    const source = read(path); assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|Firebase|https?:\/\//, path);
    assert.doesNotMatch(source, /Date\.now|performance\.now|requestAnimationFrame|setInterval|setTimeout|Worker\s*\(/, path);
    assert.doesNotMatch(source, /localStorage|sessionStorage|saveNow\s*\(|saveGameData\s*\(|battleMotionBridge|battleScreen/, path);
    assert.doesNotMatch(source, /MiniGameResult|AsyncManager|CancellationRegistry/, path);
  }
  const core = read('src/minigames/asyncChoice/asyncChoiceGame.js').replace(/\/\/[^\n]*/g, '');
  assert.doesNotMatch(core, /\b(?:document|window|gameState|Storage|Motion|Companion|Collection)\b/);
});

test('package, save schema, main RAF, battle, Motion, assets, and FSM are unchanged', () => {
  const protectedPaths = ['package.json', 'package-lock.json', 'src/core', 'src/data', 'src/main.js',
    'src/init/fsmsetup.js', 'src/screens/battleScreen.js', 'src/visuals', 'public'];
  assert.equal(git('diff', '--name-only', MINIGAME_07_BASE, '--', ...protectedPaths).trim(), '');
  assert.equal(git('ls-files', '--others', '--exclude-standard', '--', ...protectedPaths).trim(), '');
});
