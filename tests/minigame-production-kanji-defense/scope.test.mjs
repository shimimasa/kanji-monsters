import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { KANJI_DEFENSE_ADDITIONS, KANJI_DEFENSE_BASE, KANJI_DEFENSE_CHANGED } from './scope-contract.mjs';

const git = (...args) => execFileSync('git', args, { maxBuffer: 16 * 1024 * 1024 }).toString('utf8').replaceAll('\r\n', '\n');
const read = path => fs.readFileSync(path, 'utf8').replaceAll('\r\n', '\n');

test('production change stays inside its exact allowlist', () => {
  const tracked = git('diff', '--name-only', KANJI_DEFENSE_BASE, '--').trim().split('\n').filter(Boolean);
  const untracked = git('ls-files', '--others', '--exclude-standard').trim().split('\n').filter(Boolean);
  const actual = [...new Set([...tracked, ...untracked])].sort();
  const allowed = new Set([...KANJI_DEFENSE_CHANGED, ...KANJI_DEFENSE_ADDITIONS]);
  assert.deepEqual(actual.filter(path => !allowed.has(path)), []);
  for (const path of KANJI_DEFENSE_ADDITIONS.filter(path => path !== 'YOMITABI_KANJI_DEFENSE_PRODUCTION_IMPLEMENTATION_REPORT.md')) {
    assert.ok(actual.includes(path), `required production file missing: ${path}`);
    assert.ok(fs.lstatSync(path).isFile(), `regular file required: ${path}`);
  }
});
test('Stable Host, Contract, Companion, Collection, Math Invader and main scheduler are byte unchanged', () => {
  const paths = [
    'src/minigames/miniGameHost.js',
    'src/minigames/README.md',
    'src/minigames/companionAdapter.js',
    'src/minigames/collectionAdapter.js',
    'src/minigames/mathInvader/mathInvaderGame.js',
    'src/minigames/mathInvader/mathInvaderView.js',
    'src/main.js',
  ];
  for (const path of paths) assert.equal(read(path), git('show', `${KANJI_DEFENSE_BASE}:${path}`), path);
});

test('Host has no Kanji Defense, command, reading, retry or escape knowledge', () => {
  const host = read('src/minigames/miniGameHost.js');
  assert.match(host, /current\.dispatch\(command\) !== true/);
  assert.doesNotMatch(host, /kanjiDefense|reading|retry|escaped|command\.type|switch\s*\(|case\s+['"]|if\s*\([^)]*gameId/);
});

test('production Core and View own no scheduler, wall clock, Storage, save, battle or shared engine', () => {
  for (const path of KANJI_DEFENSE_ADDITIONS.filter(path => path.startsWith('src/'))) {
    const source = read(path);
    assert.doesNotMatch(source, /Date\.now|performance\.now|requestAnimationFrame|setInterval|setTimeout|Worker\s*\(/, path);
    assert.doesNotMatch(source, /localStorage|sessionStorage|saveNow\s*\(|saveGameData\s*\(|battleMotionBridge|battleScreen/, path);
    assert.doesNotMatch(source, /sharedLane|InvaderEngine|CombatFramework/, path);
  }
});

test('LearningEvent uses only v1 types with terminal retry and escape reasons in payload', () => {
  const core = read('src/minigames/kanjiDefense/kanjiDefenseGame.js');
  for (const type of ['problemPresented', 'correct', 'incorrect', 'sessionComplete']) assert.match(core, new RegExp(`['"]${type}['"]`));
  assert.doesNotMatch(core, /notify\(['"](?:retry|escaped|wrongAttempt|monsterDefeated)['"]/);
  assert.match(core, /reason: 'attemptsExhausted'/); assert.match(core, /reason: 'escaped'/);
  assert.match(core, /version: 1/); assert.match(core, /activeElapsedMs/);
});

test('registry is an exact v1 Definition and title is the only public entry integration', async () => {
  const { miniGameRegistry } = await import('../../src/minigames/registry.js');
  assert.deepEqual(Object.keys(miniGameRegistry.kanjiDefense).sort(), ['create', 'createView', 'id', 'title']);
  assert.equal(miniGameRegistry.kanjiDefense.id, 'kanjiDefense');
  const registryDiff = git('diff', '--unified=0', KANJI_DEFENSE_BASE, '--', 'src/minigames/registry.js');
  const titleDiff = git('diff', '--unified=0', KANJI_DEFENSE_BASE, '--', 'src/screens/titleScreen.js');
  assert.match(registryDiff, /createKanjiDefenseGame/); assert.match(registryDiff, /createKanjiDefenseView/);
  assert.match(titleDiff, /titleKanjiDefenseButton/);
});

test('package, lock, public data/assets, save schema, Motion and audio sources are unchanged', () => {
  const protectedPaths = ['package.json', 'package-lock.json', 'public', 'src/core', 'src/visuals', 'src/audio',
    'src/screens/battleScreen.js', 'src/init/fsmsetup.js'];
  assert.equal(git('diff', '--name-only', KANJI_DEFENSE_BASE, '--', ...protectedPaths).trim(), '');
  assert.equal(git('ls-files', '--others', '--exclude-standard', '--', ...protectedPaths).trim(), '');
});
