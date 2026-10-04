import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { MINIGAME_06_ADDITIONS, MINIGAME_06_BASE, MINIGAME_06_CHANGED } from './scope-contract.mjs';
import { MINIGAME_07_ADDITIONS, MINIGAME_07_CHANGED } from '../minigame-07/scope-contract.mjs';
import { PLATFORM_V1_CONSOLIDATION_ADDITIONS, PLATFORM_V1_CONSOLIDATION_CHANGED,
  PLATFORM_V1_README_HASH } from '../minigame-platform-v1/scope-contract.mjs';

const git = (...args) => execFileSync('git', args, { maxBuffer: 16 * 1024 * 1024 }).toString('utf8').replaceAll('\r\n', '\n');
const read = path => fs.readFileSync(path, 'utf8').replaceAll('\r\n', '\n');
const hash = source => crypto.createHash('sha256').update(source).digest('hex');




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

