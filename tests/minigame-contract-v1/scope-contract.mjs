export const CONTRACT_V1_BASE = '5a233875de3fdfcbd334349f89943b7af5481987';

export const CONTRACT_V1_CHANGED = Object.freeze([
  'src/minigames/mathInvader/mathInvaderGame.js',
  'src/minigames/mathSprint/mathSprintGame.js',
  'src/minigames/miniGameHost.js',
  'src/minigames/registry.js',
  'tests/minigame-02/scope-contract.mjs',
  'tests/minigame-02/scope.test.mjs',
  'tests/motion-02/scope-audit.mjs',
]);

export const CONTRACT_V1_ADDITIONS = Object.freeze([
  'src/minigames/README.md',
  'tests/minigame-contract-v1/contract.test.mjs',
  'tests/minigame-contract-v1/host.test.mjs',
  'tests/minigame-contract-v1/scope.test.mjs',
  'tests/minigame-contract-v1/scope-contract.mjs',
  'YOMITABI_MINIGAME_CONTRACT_V1_FIXATION_REPORT.md',
]);

const DISPATCH_ADAPTER = /\n    \/\/ Contract-v1 adapter only\. Existing command methods retain all Core logic\.\n    dispatch\(command\) \{[\s\S]*?\n    \},(?=\n    snapshot,)/g;

export function withoutContractDispatch(source) {
  let count = 0;
  const core = source.replace(DISPATCH_ADAPTER, match => { count++; return ''; });
  if (count !== 1) throw new Error(`expected one Contract-v1 dispatch adapter, found ${count}`);
  return core;
}
