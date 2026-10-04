import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { MINIGAME_07_ADDITIONS, MINIGAME_07_BASE, MINIGAME_07_CHANGED } from './scope-contract.mjs';
import { PLATFORM_V1_CONSOLIDATION_ADDITIONS, PLATFORM_V1_CONSOLIDATION_CHANGED,
  PLATFORM_V1_README_HASH } from '../minigame-platform-v1/scope-contract.mjs';

const git = (...args) => execFileSync('git', args, { maxBuffer: 16 * 1024 * 1024 }).toString('utf8').replaceAll('\r\n', '\n');
const read = path => fs.readFileSync(path, 'utf8').replaceAll('\r\n', '\n');
const hash = source => crypto.createHash('sha256').update(source).digest('hex');




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
    // The SVG namespace URI names an XML vocabulary; it is never requested.
    const source = read(path).replaceAll("'http://www.w3.org/2000/svg'", "'svg-namespace'");
    assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|Firebase|https?:\/\//, path);
    assert.doesNotMatch(source, /Date\.now|performance\.now|requestAnimationFrame|setInterval|setTimeout|Worker\s*\(/, path);
    assert.doesNotMatch(source, /localStorage|sessionStorage|saveNow\s*\(|saveGameData\s*\(|battleMotionBridge|battleScreen/, path);
    assert.doesNotMatch(source, /MiniGameResult|AsyncManager|CancellationRegistry/, path);
  }
  const core = read('src/minigames/asyncChoice/asyncChoiceGame.js').replace(/\/\/[^\n]*/g, '');
  assert.doesNotMatch(core, /\b(?:document|window|gameState|Storage|Motion|Companion|Collection)\b/);
});

