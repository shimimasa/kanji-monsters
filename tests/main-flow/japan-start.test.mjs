import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pickJapanGrade } from '../../src/core/japanStart.js';

// 日本編は 地方の地図を飛ばして ステージ選択へ。どの学年のタブを開くか（2026-10-04）。
const stages = [
  ...JSON.parse(fs.readFileSync(new URL('../../public/data/stages_proto.json', import.meta.url), 'utf8')),
  ...JSON.parse(fs.readFileSync(new URL('../../public/data/stages.bonus.json', import.meta.url), 'utf8')),
];
const none = () => false;
const clearedGrades = (...grades) => (id) => grades.includes(stages.find(s => s.stageId === id)?.grade);

test('the grade of the last stage played in Japan', () => {
  assert.equal(pickJapanGrade(stages, none, 'tohoku_area3'), 2);
  assert.equal(pickJapanGrade(stages, clearedGrades(1, 2, 3), 'hokkaido_area1'), 1, 'even if that grade is done');
});

test('a world stage or nothing played: the first grade not yet all cleared, like NEXT! on the old map', () => {
  assert.equal(pickJapanGrade(stages, none, null), 1);
  assert.equal(pickJapanGrade(stages, clearedGrades(1, 2), 'europe_area1'), 3);
  assert.equal(pickJapanGrade(stages, clearedGrades(1, 2, 3, 4, 5, 6), null), 1, 'all done: 1年');
});

test('a locked 小学生 / 全漢字 tab is not opened from the last stage', () => {
  const shikoku = stages.find(s => s.grade === 11 && !/_bonus$/.test(s.stageId));
  assert.equal(pickJapanGrade(stages, none, shikoku.stageId, g => g !== 11), 1);
  assert.equal(pickJapanGrade(stages, none, shikoku.stageId), 11);
});
