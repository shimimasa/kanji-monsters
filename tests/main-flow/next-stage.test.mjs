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
