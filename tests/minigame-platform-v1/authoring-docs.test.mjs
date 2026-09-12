import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8').replaceAll('\r\n', '\n');

test('Authoring Guide publishes only the exact Stable Definition, Instance, and View shapes', () => {
  const guide = read('YOMITABI_MINIGAME_AUTHORING_GUIDE_V1.md');
  assert.match(guide, /\{ id, title, create, createView \}/);
  assert.match(guide, /\{ enter, update, setPaused, snapshot, dispatch, exit \}/);
  assert.match(guide, /\{ root, update, stopInput, dispose, canvas\? \}/);
  assert.match(guide, /Stable does \*\*not\*\* include command names, payload schemas, snapshot schemas/);
  assert.match(guide, /Only the boolean acceptance result of `dispatch` is a Stable return semantic/);
});

test('Guide keeps commands, snapshots, results, score, deadline, and async policy game-local', () => {
  const guide = read('YOMITABI_MINIGAME_AUTHORING_GUIDE_V1.md');
  for (const heading of ['## 7. dispatch', '## 8. snapshot', '## 16. result',
    '## 17. realtime/deadline', '## 18. partial credit', '## 19. async/cancellation']) {
    assert.ok(guide.includes(heading), heading);
  }
  assert.match(guide, /These are examples, not reserved or required names/);
  assert.match(guide, /Do not create a common `MiniGameResult` wrapper/);
  assert.match(guide, /AbortController.*is not the correctness boundary/);
  assert.match(guide, /Do not add shared AbortSignal, async enter\/exit, `onReady`, or a global async manager/);
});

test('Guide preserves LearningEvent, commit-before-event, pause, and stale isolation semantics', () => {
  const guide = read('YOMITABI_MINIGAME_AUTHORING_GUIDE_V1.md');
  for (const field of ['version', 'gameId', 'sessionId', 'seq', 'type', 'problemId', 'activeElapsedMs', 'payload']) {
    assert.match(guide, new RegExp(`\\b${field}\\b`), field);
  }
  for (const type of ['problemPresented', 'correct', 'incorrect', 'sessionComplete']) assert.match(guide, new RegExp(`\\b${type}\\b`));
  assert.match(guide, /Commit before calling `onEvent`/);
  assert.match(guide, /manual and visibility reasons separately and passes only their OR/);
  assert.match(guide, /old callback, command, entity action, or async result must not change the current session/);
  assert.match(guide, /Loading, load success, load failure, cancellation.*not LearningEvents/);
});

test('Guide includes authoring workflow, browser separation, anti-patterns, decision tree, and v2 gates', () => {
  const guide = read('YOMITABI_MINIGAME_AUTHORING_GUIDE_V1.md');
  for (const heading of ['## 2. 5-minute Quick Start', '## 20. accessibility', '## 21. tests',
    '## 22. Browser QA', '## 23. anti-patterns', '## 24. decision tree',
    '## 25. production readiness', '## 26. Contract v2 triggers', '## 27. templates']) {
    assert.ok(guide.includes(heading), heading);
  }
  assert.match(guide, /Automated DOM tests are \*\*not\*\* Browser Certification/);
  assert.match(guide, /Add `if \(gameId === \.\.\.\)` or a game import to Host/);
  assert.match(guide, /These are not triggers: making APIs prettier/);
});

test('Checklist is copyable and covers architecture, mechanics, QA, and stop review', () => {
  const checklist = read('YOMITABI_MINIGAME_AUTHORING_CHECKLIST_V1.md');
  assert.ok((checklist.match(/- \[ \]/g) ?? []).length >= 90);
  for (const heading of ['## Stable Definition and Instance', '## LearningEvent v1',
    '## Realtime/deadline (when applicable)', '## Partial credit (when applicable)',
    '## Async/cancellation (when applicable)', '## Automated tests',
    '## Integrity, build, and release QA', '## Stop and Contract v2 review']) {
    assert.ok(checklist.includes(heading), heading);
  }
  assert.match(checklist, /Browser certification: PASS \/ NOT RUN \/ FAILED/);
});

test('Consolidation report contains the seven-probe matrix, retention decision, final answers, and labels', () => {
  const report = read('YOMITABI_MINIGAME_PLATFORM_V1_CONSOLIDATION_REPORT.md');
  assert.match(report, /\| Dimension \| 01 Math Sprint \| 02 Math Invader \| 03 English Choice \| 04 Sentence Order \| 05 Timed Choice \| 06 Multi Select \| 07 Async Choice \|/);
  assert.match(report, /Option A: retain all seven entries unchanged/);
  assert.match(report, /Option C for low-value probe content/);
  for (const label of ['MINIGAME PLATFORM V1 CONSOLIDATION PASS', 'AUTHORING GUIDE V1 READY',
    'TECHNICAL PROBE PHASE COMPLETE', 'CONTRACT V2 NOT REQUIRED', 'BROWSER CERTIFICATION STILL PENDING']) {
    assert.ok(report.includes(label), label);
  }
  for (const question of ['A. MINIGAME-01〜07', 'B. Stable surface', 'C. game-local',
    'D. LearningEvent', 'E. time-dependent', 'F. partial-credit', 'G. async/cancellation',
    'H. Host', 'I. MiniGameResult', 'J. shared command', 'K. Contract v2',
    'L. 新game量産', 'M. 実ブラウザー']) assert.ok(report.includes(question), question);
});

test('Contract README points to the manual and checklist without changing Stable declarations', () => {
  const contract = read('src/minigames/README.md');
  assert.match(contract, /This file is the normative Contract reference/);
  assert.match(contract, /YOMITABI_MINIGAME_AUTHORING_GUIDE_V1\.md/);
  assert.match(contract, /YOMITABI_MINIGAME_AUTHORING_CHECKLIST_V1\.md/);
  assert.match(contract, /synchronous `dispatch\(\{ type, payload \}\)`, returning only `true` when accepted/);
  assert.match(contract, /fixed event types are `problemPresented`, `correct`, `incorrect`, and\s+`sessionComplete`/);
});
