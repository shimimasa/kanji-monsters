import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lessonCatalog } from '../../src/lessons/lessonCatalog.js';
import { stories, canAdvance, outcomeFor } from '../../public/lessons/gotomon/lesson-game.js';

test('休止中の2作品は直接URLから遊べず、記録シートと元データは残る', () => {
  for (const lesson of lessonCatalog) {
    assert.equal(lesson.url, `/lessons/gotomon/${lesson.slug}.html`);
    assert.equal(lesson.sheetUrl, `/lessons/gotomon/${lesson.slug}-sheet.html`);
    const html = readFileSync(new URL(`../../public${lesson.url}`, import.meta.url), 'utf8');
    const sheet = readFileSync(new URL(`../../public${lesson.sheetUrl}`, import.meta.url), 'utf8');
    assert.match(html, new RegExp(`data-lesson="${lesson.slug}"`));
    assert.match(html, /この旅は お休み中/);
    assert.match(html, /href="\/"/);
    assert.doesNotMatch(html, /<script/);
    assert.match(sheet, /いんさつする/);
    assert.equal(stories[lesson.slug].stages.length, 5);
  }
});

test('比較を終える前とクルルの計画を見つける前には先へ進めない', () => {
  const experiment = stories.kururu.stages[0];
  assert.equal(canAdvance(experiment, new Set(['slow']), 'slow'), false);
  assert.equal(canAdvance(experiment, new Set(['slow', 'fast']), 'fast'), true);
  const finalPlan = stories.kururu.stages[4];
  assert.equal(canAdvance(finalPlan, new Set(['dayBulb']), 'dayBulb'), false);
  assert.equal(canAdvance(finalPlan, new Set(['dayBulb', 'nightPlan']), 'nightPlan'), true);
  assert.equal(outcomeFor('kururu', 0, 'fast').metric, '2.8V');
});

test('ヒョウの投票はどの提案でも進め、1票による集計の差を見せる', () => {
  const finalVote = stories.hitotsubu.stages[4];
  for (const option of finalVote.options) {
    assert.equal(canAdvance(finalVote, new Set([option.id]), option.id), true);
    const result = outcomeFor('hitotsubu', 4, option.id);
    assert.equal(Object.values(result.tally).reduce((sum, count) => sum + count, 0), 5);
  }
  assert.deepEqual(outcomeFor('hitotsubu', 4, 'bridge').tally, { bridge: 3, market: 1, map: 1 });
  assert.deepEqual(outcomeFor('hitotsubu', 4, 'market').tally, { bridge: 2, market: 2, map: 1 });
  assert.deepEqual(outcomeFor('hitotsubu', 4, 'map').tally, { bridge: 2, market: 1, map: 2 });
});
