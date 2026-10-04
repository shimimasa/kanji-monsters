import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { findNextStage } from '../../src/core/nextStage.js';

const stages = [
  ...JSON.parse(fs.readFileSync(new URL('../../public/data/stages_proto.json', import.meta.url), 'utf8')),
  ...JSON.parse(fs.readFileSync(new URL('../../public/data/stages.bonus.json', import.meta.url), 'utf8')),
];
const locked = () => false, open = () => true;

test('the next stage is the following normal stage of the same grade, in stage-select order', () => {
  assert.equal(findNextStage(stages, 'hokkaido_area1', locked)?.stageId, 'hokkaido_area2');
  assert.equal(findNextStage(stages, 'tohoku_area3', locked)?.stageId, 'tohoku_area4');
  assert.equal(findNextStage(stages, 'europe_area1', locked)?.stageId, 'europe_area2');
});

test('after the last normal stage, the grade summary only when it is unlocked; never another grade', () => {
  assert.equal(findNextStage(stages, 'hokkaido_area2', locked), null);
  assert.equal(findNextStage(stages, 'hokkaido_area2', open)?.stageId, 'hokkaido_bonus');
  assert.equal(findNextStage(stages, 'tohoku_area6', locked), null);
});

test('no next stage after a summary stage or for an unknown stage', () => {
  assert.equal(findNextStage(stages, 'hokkaido_bonus', open), null);
  assert.equal(findNextStage(stages, 'no_such_stage', open), null);
  assert.equal(findNextStage(stages, '', open), null);
});

test('every normal stage except the last of its grade has a next stage of the same grade', () => {
  let checked = 0;
  for (const grade of new Set(stages.map(s => s.grade))) {
    const normal = stages.filter(s => s.grade === grade && !/_bonus$|^bonus_/i.test(s.stageId));
    normal.forEach((s, i) => {
      const next = findNextStage(stages, s.stageId, locked);
      if (i < normal.length - 1) { assert.equal(next?.grade, grade, s.stageId); checked++; }
      else assert.equal(next, null, s.stageId);
    });
  }
  assert.ok(checked > 60, `checked ${checked}`);
});

// 2026-10-04: 学年の さいごで まとめに 鍵が ある時
import { gradeEndGuide } from '../../src/core/nextStage.js';

test('after the last stage with the summary locked: an earlier stage not yet cleared comes next', () => {
  const notCleared = new Set(['tohoku_area2']);
  assert.equal(findNextStage(stages, 'tohoku_area6', locked, id => !notCleared.has(id))?.stageId, 'tohoku_area2');
  assert.equal(findNextStage(stages, 'tohoku_area6', open, id => !notCleared.has(id))?.stageId, 'tohoku_bonus', 'an open summary comes first');
});

test('all cleared but the summary locked: guide to マスター, starting from the first stage not mastered', () => {
  const all = () => true;
  const mastered = new Set(['hokkaido_area1']);
  const guide = gradeEndGuide(stages, 'hokkaido_area2', { isCleared: all, isBonusUnlocked: locked, isMastered: id => mastered.has(id) });
  assert.deepEqual({ region: guide.region, mastered: guide.mastered, total: guide.total, stage: guide.stage.stageId },
    { region: '北海道', mastered: 1, total: 2, stage: 'hokkaido_area2' });
  assert.equal(gradeEndGuide(stages, 'hokkaido_area2', { isCleared: all, isBonusUnlocked: open, isMastered: none => false }), null, 'summary open: no guide');
  assert.equal(gradeEndGuide(stages, 'hokkaido_area2', { isCleared: id => id !== 'hokkaido_area1', isBonusUnlocked: locked, isMastered: () => false }), null, 'a stage still to clear: no guide');
  assert.equal(gradeEndGuide(stages, 'hokkaido_bonus', { isCleared: all, isBonusUnlocked: locked, isMastered: () => false }), null);
});
