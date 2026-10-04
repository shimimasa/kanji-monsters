import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { MINIGAME_03_ADDITIONS, MINIGAME_03_BASE, MINIGAME_03_CHANGED } from './scope-contract.mjs';
import { MINIGAME_04_ADDITIONS, MINIGAME_04_CHANGED,
  MINIGAME_04_CONTRACT_DOC_HASH } from '../minigame-04/scope-contract.mjs';
import { MINIGAME_05_ADDITIONS, MINIGAME_05_CHANGED } from '../minigame-05/scope-contract.mjs';
import { MINIGAME_06_ADDITIONS, MINIGAME_06_CHANGED } from '../minigame-06/scope-contract.mjs';
import { MINIGAME_07_ADDITIONS, MINIGAME_07_CHANGED } from '../minigame-07/scope-contract.mjs';
import { PLATFORM_V1_CONSOLIDATION_ADDITIONS, PLATFORM_V1_CONSOLIDATION_CHANGED } from '../minigame-platform-v1/scope-contract.mjs';

const git = (...args) => execFileSync('git', args, { maxBuffer: 16 * 1024 * 1024 }).toString('utf8').replaceAll('\r\n', '\n');
const read = path => fs.readFileSync(path, 'utf8').replaceAll('\r\n', '\n');
const hash = source => crypto.createHash('sha256').update(source).digest('hex');




test('English source owns no numeric helper, scheduler, Storage, save, battle, or Motion code', () => {
  for (const path of MINIGAME_03_ADDITIONS.filter(path => path.startsWith('src/'))) {
    const source = read(path);
    assert.doesNotMatch(source, /mathSprintInput|normalizeMathAnswer|requestAnimationFrame|setInterval|setTimeout/, path);
    assert.doesNotMatch(source, /localStorage|sessionStorage|saveNow\s*\(|saveGameData\s*\(|battleMotionBridge|battleScreen/, path);
  }
  const core = read('src/minigames/englishChoice/englishChoiceGame.js').replace(/\/\/[^\n]*/g, '');
  assert.doesNotMatch(core, /\b(?:document|window|gameState|Storage|Motion)\b/);
});

