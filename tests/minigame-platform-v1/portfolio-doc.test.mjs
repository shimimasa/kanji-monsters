import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const report = fs.readFileSync('YOMITABI_PRODUCTION_GAME_PORTFOLIO_DESIGN.md', 'utf8').replaceAll('\r\n', '\n');

test('portfolio report has the required 32-section structure', () => {
  const headings = report.match(/^## \d+\. .+$/gm) ?? [];
  assert.equal(headings.length, 32);
  assert.equal(headings[0], '## 1. Executive Summary');
  assert.equal(headings.at(-1), '## 32. Final Recommendation');
});

test('all seven probes have scores, production criteria, and explicit dispositions', () => {
  for (const probe of ['01 Math Sprint', '02 Math Invader', '03 English Choice', '04 Sentence Order',
    '05 Timed Choice', '06 Multi Select', '07 Async Choice']) assert.ok(report.includes(probe), probe);
  for (const status of ['KEEP', 'UPGRADE', 'HIDE / DEV-ONLY', 'REPLACE']) assert.ok(report.includes(status), status);
  assert.match(report, /\*\*KEEP: none\.\*\*/);
  assert.match(report, /Production Cost uses 5 = low cost/);
});

test('concept catalog contains at least 15 distinct specified concepts and a scored matrix', () => {
  for (let id = 1; id <= 18; id++) assert.match(report, new RegExp(`\\| ${id} `), `concept ${id}`);
  for (const field of ['Subject / age', 'Learning goal', 'Core mechanic', 'Play / difficulty',
    'Replayability', 'YOMITABI connection', 'v1 pattern', 'Effort', 'Priority']) assert.ok(report.includes(field), field);
  assert.match(report, /## 12\. Scoring Matrix/);
});

test('Phase 1 portfolio is balanced and names one next implementation with concrete gates', () => {
  for (const game of ['漢字防衛隊', 'ことわざモンスター劇場', 'なかま分け図鑑', '文脈トレジャー',
    '鬼よみボスラッシュ', '旅文クラフト', 'まちがい追跡隊']) assert.ok(report.includes(game), game);
  assert.match(report, /Phase 1 contains \*\*7 games\*\*/);
  assert.match(report, /\*\*Flagship: 漢字防衛隊\*\*/);
  assert.match(report, /### Next implementation: 漢字防衛隊/);
  for (const gate of ['Why now', 'MVP scope', 'Core mechanic', 'Production upgrade', 'Success criteria', 'Kill criteria']) {
    assert.ok(report.includes(`**${gate}:**`), gate);
  }
});

test('strategy, release boundary, final decisions, and completion labels are explicit', () => {
  assert.match(report, /\*\*Decision: Strategy A for the next 6〜12 months\.\*\*/);
  assert.match(report, /real Browser Certification remains pending/i);
  assert.match(report, /Product analytics are separate from LearningEvent v1/);
  for (const question of ['A. 01〜07', 'B. KEEP', 'C. UPGRADE', 'D. HIDE / DEV-ONLY', 'E. REPLACE',
    'F. 最初のproduction portfolio', 'G. Flagship', 'H. Product direction',
    'I. 次に実装するproduction game', 'J. Technical Probe']) assert.ok(report.includes(question), question);
  for (const label of ['PRODUCTION PORTFOLIO DESIGN COMPLETE', 'TECHNICAL PROBE PHASE CLOSED',
    'PRODUCTION AUTHORING PHASE READY']) assert.ok(report.includes(label), label);
  assert.match(report, /https:\/\/www\.mext\.go\.jp\//);
});
