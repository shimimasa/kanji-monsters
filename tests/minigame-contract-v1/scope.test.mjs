import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { CONTRACT_V1_ADDITIONS, CONTRACT_V1_BASE, CONTRACT_V1_CHANGED,
  withoutContractDispatch } from './scope-contract.mjs';
import { MINIGAME_03_ADDITIONS, MINIGAME_03_CHANGED } from '../minigame-03/scope-contract.mjs';
import { MINIGAME_04_ADDITIONS, MINIGAME_04_CHANGED } from '../minigame-04/scope-contract.mjs';
import { MINIGAME_05_ADDITIONS, MINIGAME_05_CHANGED } from '../minigame-05/scope-contract.mjs';
import { MINIGAME_06_ADDITIONS, MINIGAME_06_CHANGED } from '../minigame-06/scope-contract.mjs';
import { MINIGAME_07_ADDITIONS, MINIGAME_07_CHANGED } from '../minigame-07/scope-contract.mjs';
import { PLATFORM_V1_CONSOLIDATION_ADDITIONS, PLATFORM_V1_CONSOLIDATION_CHANGED } from '../minigame-platform-v1/scope-contract.mjs';

const git = (...args) => execFileSync('git', args, { maxBuffer: 16 * 1024 * 1024 })
  .toString('utf8').replaceAll('\r\n', '\n');
const read = path => fs.readFileSync(path, 'utf8').replaceAll('\r\n', '\n');





test('Contract document keeps command identity, snapshots, payloads, and results outside Stable', () => {
  const contract = read('src/minigames/README.md');
  assert.match(contract, /concrete command identity\s+fields and token structure are game-specific and provisional/);
  assert.match(contract, /exact command names and payloads[\s\S]*snapshot fields, and result schemas remain provisional or game-local/);
  assert.match(contract, /Host forwards commands without inspecting\s+`type`/);
});

