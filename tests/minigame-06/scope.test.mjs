import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { MINIGAME_06_ADDITIONS, MINIGAME_06_BASE, MINIGAME_06_CHANGED } from './scope-contract.mjs';

const git = (...args) => execFileSync('git', args, { maxBuffer: 16 * 1024 * 1024 }).toString('utf8').replaceAll('\r\n', '\n');
const read = path => fs.readFileSync(path, 'utf8').replaceAll('\r\n', '\n');

test('Partial-credit probe stays inside its exact changed-file allowlist', () => {
  const tracked = git('diff', '--name-only', MINIGAME_06_BASE, '--').trim().split('\n').filter(Boolean);
  const untracked = git('ls-files', '--others', '--exclude-standard').trim().split('\n').filter(Boolean);
  const actual = [...new Set([...tracked, ...untracked])].sort();
  const allowed = new Set([...MINIGAME_06_CHANGED, ...MINIGAME_06_ADDITIONS]);
  assert.deepEqual(actual.filter(path => !allowed.has(path)), []);
  for (const path of MINIGAME_06_ADDITIONS.filter(path => path.startsWith('src/') || path.startsWith('tests/'))) {
    assert.ok(actual.includes(path), `required MINIGAME-06 file missing: ${path}`);
    assert.ok(fs.lstatSync(path).isFile(), `regular file required: ${path}`);
  }
});

test('Stable Contract, Host, adapters, and games 01-05 remain byte-identical', () => {
  const protectedFiles = [
    'src/minigames/README.md', 'src/minigames/miniGameHost.js',
    'src/minigames/collectionAdapter.js', 'src/minigames/companionAdapter.js',
    'src/minigames/mathSprint/mathSprintGame.js', 'src/minigames/mathSprint/mathSprintInput.js',
    'src/minigames/mathSprint/mathSprintView.js', 'src/minigames/mathInvader/mathInvaderGame.js',
    'src/minigames/mathInvader/mathInvaderView.js', 'src/minigames/englishChoice/englishChoiceGame.js',
    'src/minigames/englishChoice/englishChoiceQuestions.js', 'src/minigames/englishChoice/englishChoiceView.js',
    'src/minigames/sentenceOrder/sentenceOrderGame.js', 'src/minigames/sentenceOrder/sentenceOrderQuestions.js',
    'src/minigames/sentenceOrder/sentenceOrderView.js', 'src/minigames/timedChoice/timedChoiceGame.js',
    'src/minigames/timedChoice/timedChoiceQuestions.js', 'src/minigames/timedChoice/timedChoiceView.js',
  ];
  for (const path of protectedFiles) assert.equal(read(path), git('show', `${MINIGAME_06_BASE}:${path}`), path);
});

test('Host has no partial/game/score branch and Multi Select alone owns toggle/submit/next commands', () => {
  const host = read('src/minigames/miniGameHost.js');
  assert.match(host, /current\.dispatch\(command\) !== true/);
  assert.doesNotMatch(host, /multiSelect|partial|score|command\.type|switch\s*\(|case\s+['"]|if\s*\([^)]*gameId/);
  const core = read('src/minigames/multiSelect/multiSelectGame.js');
  assert.match(core, /command\.type === 'toggle'/); assert.match(core, /command\.type === 'submit'/); assert.match(core, /command\.type === 'next'/);
  const registry = read('src/minigames/registry.js');
  assert.doesNotMatch(registry, /onToggle|partialScore|universalScore|MiniGameResult/);
});

test('partial completion uses existing incorrect type and preserves the exact LearningEvent envelope', () => {
  const readme = read('src/minigames/README.md'), core = read('src/minigames/multiSelect/multiSelectGame.js');
  assert.match(readme, /fixed event types are `problemPresented`, `correct`, `incorrect`, and\s+`sessionComplete`/);
  assert.match(readme, /Problem generation, difficulty, answer semantics, normalization, score/);
  assert.match(readme, /game-specific `payload`/); assert.match(readme, /result schemas remain provisional or game-local/);
  assert.match(core, /grading\.classification === 'fullCorrect' \? 'correct' : 'incorrect'/);
  assert.match(core, /classification: grading\.classification/);
  assert.match(core, /version: 1, gameId: 'multiSelect', sessionId, seq: \+\+seq, type/);
  assert.doesNotMatch(core, /notify\(['"](?:partial|score|graded|partiallyCorrect)['"]/);
});

test('Companion remains display-only and does not inspect partial-credit payload', () => {
  const companion = read('src/minigames/companionAdapter.js');
  assert.match(companion, /event\.type === 'correct'/); assert.doesNotMatch(companion, /event\.payload|partial|score|multiSelect/);
  const collection = read('src/minigames/collectionAdapter.js');
  assert.doesNotMatch(collection, /partial|score|multiSelect/);
});

test('probe owns no scheduler, Storage, save, persistence, or common result abstraction', () => {
  for (const path of MINIGAME_06_ADDITIONS.filter(path => path.startsWith('src/'))) {
    const source = read(path);
    assert.doesNotMatch(source, /Date\.now|performance\.now|requestAnimationFrame|setInterval|setTimeout|Worker\s*\(/, path);
    assert.doesNotMatch(source, /localStorage|sessionStorage|saveNow\s*\(|saveGameData\s*\(|battleMotionBridge|battleScreen/, path);
    assert.doesNotMatch(source, /MiniGameResult|UniversalScore|AssessmentResult/, path);
  }
  const core = read('src/minigames/multiSelect/multiSelectGame.js').replace(/\/\/[^\n]*/g, '');
  assert.doesNotMatch(core, /\b(?:document|window|gameState|Storage|Motion|Companion|Collection)\b/);
});

test('package, save schema, main RAF, battle, Motion, assets, and FSM are unchanged', () => {
  const protectedPaths = ['package.json', 'package-lock.json', 'src/core', 'src/data', 'src/main.js',
    'src/init/fsmsetup.js', 'src/screens/battleScreen.js', 'src/visuals', 'public'];
  assert.equal(git('diff', '--name-only', MINIGAME_06_BASE, '--', ...protectedPaths).trim(), '');
  assert.equal(git('ls-files', '--others', '--exclude-standard', '--', ...protectedPaths).trim(), '');
});
