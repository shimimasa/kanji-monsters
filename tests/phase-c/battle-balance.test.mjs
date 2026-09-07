import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BALANCE_VERSION,
  computeEnemyParams,
  getBossShieldHits,
  getStageDifficultyIndex,
  requiredCorrectAnswers,
  stageBestTimeKey,
} from '../../src/core/battleBalance.js';

const stages = [
  { stageId: 'g1-a', grade: 1 },
  { stageId: 'g1-b', grade: 1 },
  { stageId: 'bonus_g1', grade: 1 },
  { stageId: 'g3-a', grade: 3 },
  { stageId: 'g3-b', grade: 3 },
  { stageId: 'g6-a', grade: 6 },
];

test('a new child starts at the same operation difficulty in grades 1, 3, and 6', () => {
  for (const id of ['g1-a', 'g3-a', 'g6-a']) {
    const stageIndex = getStageDifficultyIndex(id, stages);
    assert.equal(stageIndex, 0);
    const normal = computeEnemyParams({ isBoss: false, stageIndex, playerLevel: 1, playerAtk: 10, playerMaxHp: 100 });
    const boss = computeEnemyParams({ isBoss: true, stageIndex, playerLevel: 1, playerAtk: 10, playerMaxHp: 100 });
    assert.deepEqual({ hp: normal.hp, atk: normal.atk, correct: requiredCorrectAnswers(normal.hp, 10) }, { hp: 31, atk: 9, correct: 4 });
    assert.deepEqual({ hp: boss.hp, atk: boss.atk, correct: requiredCorrectAnswers(boss.hp, 10), shield: getBossShieldHits(stageIndex) }, { hp: 62, atk: 11, correct: 7, shield: 1 });
  }
});

test('stage familiarity grows within a grade and ignores bonus stages', () => {
  assert.equal(getStageDifficultyIndex('g1-b', stages), 1);
  assert.equal(getStageDifficultyIndex('bonus_g1', stages), 2);
  assert.equal(getBossShieldHits(0), 1);
  assert.equal(getBossShieldHits(3), 2);
  assert.equal(getBossShieldHits(6), 3);
});

test('best times are isolated by balance version without changing existing keys', () => {
  assert.equal(stageBestTimeKey('g1-a'), `g1-a@balance-${BALANCE_VERSION}`);
});
