import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { MINIGAME_05_ADDITIONS, MINIGAME_05_BASE, MINIGAME_05_CHANGED } from './scope-contract.mjs';
import { MINIGAME_06_ADDITIONS, MINIGAME_06_CHANGED } from '../minigame-06/scope-contract.mjs';
import { MINIGAME_07_ADDITIONS, MINIGAME_07_CHANGED } from '../minigame-07/scope-contract.mjs';
import { PLATFORM_V1_CONSOLIDATION_ADDITIONS, PLATFORM_V1_CONSOLIDATION_CHANGED,
  PLATFORM_V1_README_HASH } from '../minigame-platform-v1/scope-contract.mjs';

const git = (...args) => execFileSync('git', args, { maxBuffer: 16 * 1024 * 1024 }).toString('utf8').replaceAll('\r\n', '\n');
const read = path => fs.readFileSync(path, 'utf8').replaceAll('\r\n', '\n');
const hash = source => crypto.createHash('sha256').update(source).digest('hex');




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

