import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// Two reviewed entry-point deltas only. LF hashes fix their complete contents;
// neither a moved hook nor an unrelated edit can hide behind a path allowlist.
export const MINI_GAME_ENTRY_HASHES = Object.freeze({
  'src/init/fsmsetup.js': '5d4291c0c8b3593cdad0e61511b9968096d8fc0cbe0eaf0bc7e4e3982a437ee8',
  'src/screens/titleScreen.js': 'fc2b525478472f4f4882cfdd15f3ba2f2f88b4627f43e79fed28b1c2a5b47e96',
});
const APPROVED_ENTRY_HASHES = Object.freeze({
  'src/init/fsmsetup.js': Object.freeze([MINI_GAME_ENTRY_HASHES['src/init/fsmsetup.js']]),
  // The index can legitimately remain at the frozen MINIGAME-01 entry while
  // the worktree contains the reviewed MINIGAME-02 title choice.
  'src/screens/titleScreen.js': Object.freeze([
    'b4a76b5ebf837a3c012738ebe468414b89ed88228397e9806dea884564b92ee5',
    MINI_GAME_ENTRY_HASHES['src/screens/titleScreen.js'],
  ]),
});
export const MINI_GAME_ADDITIONS = Object.freeze([
  'src/minigames/registry.js', 'src/minigames/miniGameHost.js',
  'src/minigames/collectionAdapter.js', 'src/minigames/companionAdapter.js',
  'src/minigames/mathSprint/mathSprintGame.js', 'src/minigames/mathSprint/mathSprintGenerator.js',
  'src/minigames/mathSprint/mathSprintInput.js', 'src/minigames/mathSprint/mathSprintView.js',
  'tests/minigame-01/core.test.mjs', 'tests/minigame-01/lifecycle.test.mjs',
  'tests/minigame-01/scope.test.mjs', 'tests/minigame-01/scope-contract.mjs',
  'tools/minigame-01/functional-qa.mjs', 'tools/minigame-01/README.md',
  'YOMITABI_MINIGAME_01_MATH_SPRINT_REPORT.md',
]);
export function assertMiniGameEntry(path, source) {
  assert.ok(Object.hasOwn(MINI_GAME_ENTRY_HASHES, path));
  const actual = crypto.createHash('sha256').update(source.replaceAll('\r\n','\n')).digest('hex');
  assert.ok(APPROVED_ENTRY_HASHES[path].includes(actual), `mini-game entry changed outside its reviewed delta: ${path}`);
}
