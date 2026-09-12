import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { PLATFORM_V1_CONSOLIDATION_ADDITIONS, PLATFORM_V1_CONSOLIDATION_BASE,
  PLATFORM_V1_CONSOLIDATION_CHANGED, PLATFORM_V1_README_HASH } from './scope-contract.mjs';

const git = (...args) => execFileSync('git', args, { maxBuffer: 16 * 1024 * 1024 }).toString('utf8').replaceAll('\r\n', '\n');
const read = path => fs.readFileSync(path, 'utf8').replaceAll('\r\n', '\n');
const hash = source => crypto.createHash('sha256').update(source).digest('hex');

test('consolidation stays inside its documentation and test-only allowlist', () => {
  const tracked = git('diff', '--name-only', PLATFORM_V1_CONSOLIDATION_BASE, '--').trim().split('\n').filter(Boolean);
  const untracked = git('ls-files', '--others', '--exclude-standard').trim().split('\n').filter(Boolean);
  const actual = [...new Set([...tracked, ...untracked])].sort();
  const allowed = new Set([...PLATFORM_V1_CONSOLIDATION_CHANGED, ...PLATFORM_V1_CONSOLIDATION_ADDITIONS]);
  assert.deepEqual(actual.filter(path => !allowed.has(path)), []);
  for (const path of PLATFORM_V1_CONSOLIDATION_ADDITIONS) {
    assert.ok(actual.includes(path), `required consolidation file missing: ${path}`);
    assert.ok(fs.lstatSync(path).isFile(), `regular file required: ${path}`);
  }
});

test('Contract README has the reviewed exact hash', () => {
  assert.equal(hash(read('src/minigames/README.md')), PLATFORM_V1_README_HASH);
});

test('Host, adapters, and the seven retained probe sources remain byte-identical', () => {
  const paths = [
    'src/minigames/miniGameHost.js',
    'src/minigames/companionAdapter.js', 'src/minigames/collectionAdapter.js',
    ...['mathSprint', 'mathInvader', 'englishChoice', 'sentenceOrder', 'timedChoice', 'multiSelect', 'asyncChoice']
      .flatMap(name => git('ls-tree', '-r', '--name-only', PLATFORM_V1_CONSOLIDATION_BASE, '--', `src/minigames/${name}`).trim().split('\n').filter(Boolean)),
  ];
  for (const path of paths) assert.equal(read(path), git('show', `${PLATFORM_V1_CONSOLIDATION_BASE}:${path}`), path);
});

test('production integration changes only registry/title behavior and preserves exact v1 shape', () => {
  const registry = read('src/minigames/registry.js');
  const title = read('src/screens/titleScreen.js');
  assert.match(registry, /kanjiDefense: Object\.freeze\(\{ id: 'kanjiDefense', title: '漢字防衛隊'/);
  assert.match(title, /'旗艦ゲーム：漢字防衛隊', 'kanjiDefense'/);
  assert.doesNotMatch(read('src/minigames/miniGameHost.js'), /kanjiDefense/);
});

test('package, lock, save/core, main scheduler, battle, Motion, assets, and tooling are unchanged', () => {
  const protectedPaths = ['package.json', 'package-lock.json', 'src/core', 'src/data', 'src/main.js',
    'src/init/fsmsetup.js', 'src/screens/battleScreen.js', 'src/visuals', 'public', 'tools'];
  assert.equal(git('diff', '--name-only', PLATFORM_V1_CONSOLIDATION_BASE, '--', ...protectedPaths).trim(), '');
  assert.equal(git('ls-files', '--others', '--exclude-standard', '--', ...protectedPaths).trim(), '');
});

test('Host remains generic and all game sources own no continuous scheduler or direct Storage', () => {
  const host = read('src/minigames/miniGameHost.js');
  assert.match(host, /current\.dispatch\(command\) !== true/);
  assert.doesNotMatch(host, /command\.type|switch\s*\(|case\s+['"]|if\s*\([^)]*gameId/);
  for (const gameId of ['mathInvader', 'englishChoice', 'sentenceOrder', 'timedChoice', 'multiSelect', 'asyncChoice', 'kanjiDefense']) {
    assert.doesNotMatch(host, new RegExp(gameId), gameId);
  }
  const sources = fs.readdirSync('src/minigames', { withFileTypes: true })
    .filter(entry => entry.isDirectory()).flatMap(entry => fs.readdirSync(`src/minigames/${entry.name}`)
      .filter(name => name.endsWith('.js')).map(name => `src/minigames/${entry.name}/${name}`));
  for (const path of sources) {
    const source = read(path);
    assert.doesNotMatch(source, /requestAnimationFrame|setInterval|localStorage|sessionStorage/, path);
    assert.doesNotMatch(source, /saveNow\s*\(|saveGameData\s*\(/, path);
  }
});
