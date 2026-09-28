import test from 'node:test';
import assert from 'node:assert/strict';
import { companionCourse } from '../../src/minigames/companionCourses.js';
import { createGameplayRun } from '../../src/minigames/gameplay/gameplayRun.js';
import { growthStatus } from '../../src/minigames/companionGrowth.js';

const effects = growthStatus().effects;
const runFor = (gameId, companionId, useCourse = true) => {
  const course = useCourse ? companionCourse(companionId, gameId) : null;
  const run = createGameplayRun(gameId, effects, { course });
  run.context({ phase: 'answering', paused: false });
  return run;
};

test('only the named companion has each special course', () => {
  assert.equal(companionCourse('HKD-E01', 'mathSprint')?.name, 'ころころ近道');
  assert.equal(companionCourse('HKD-E02', 'mathInvader')?.name, '黄金の連射');
  assert.equal(companionCourse('HKD-E03', 'timedChoice')?.name, 'しずくの灯台');
  assert.equal(companionCourse('HKD-E01', 'mathInvader'), null);
  assert.equal(companionCourse('HKD-E04', 'mathSprint'), null);
});

test('potato route uses one energy for a shortcut while normal race has no roll action', () => {
  const run = runFor('mathSprint', 'HKD-E01');
  const normal = runFor('mathSprint', 'HKD-E01', false);
  assert.equal(normal.act('roll'), false);
  run.answer(true, {}, 1); run.answer(true, {}, 2);
  assert.equal(run.snapshot().danger, true);
  assert.equal(run.act('roll'), true);
  run.answer(true, {}, 3);
  assert.equal(run.snapshot().shortcuts, 1);
  assert.equal(run.snapshot().energy, 1);
  assert.equal(run.snapshot().course.id, 'potato-shortcut');
  assert.equal(run.snapshot().challenge.progress, '1/2');
  assert.equal(run.snapshot().challenge.choices.length, 3);
});

test('corn route earns a special shot from priority targets', () => {
  const run = runFor('mathInvader', 'HKD-E02');
  const normal = runFor('mathInvader', 'HKD-E02', false);
  assert.equal(normal.act('golden-burst'), false);
  assert.equal(run.act('golden-burst'), false);
  for (let index = 0; index < 3; index++) {
    const enemy = { enemyId: `e-${index}`, y: .8, lane: 1 };
    run.context({ phase: 'answering', paused: false, life: 3, enemies: [enemy], selectedEnemy: enemy });
    run.answer(true, {}, index + 1);
  }
  assert.equal(run.snapshot().grains, 3);
  assert.equal(run.act('golden-burst'), true);
  run.answer(false, {}, 0);
  assert.equal(run.snapshot().golden, true);
  run.answer(true, {}, 1);
  assert.equal(run.snapshot().bossHp, 6);
  assert.equal(run.snapshot().goldenHits, 1);
  assert.equal(run.snapshot().challenge.status, 'achieved');
});

test('milk route stores and pours light without creating points', () => {
  const run = runFor('timedChoice', 'HKD-E03');
  const normal = runFor('timedChoice', 'HKD-E03', false);
  assert.equal(normal.act('store-light'), false);
  assert.equal(run.act('store-light'), true);
  assert.equal(run.snapshot().light, 45);
  assert.equal(run.snapshot().bottles, 1);
  assert.equal(run.act('store-light'), false);
  assert.equal(run.act('pour-light'), true);
  assert.equal(run.snapshot().light, 70);
  assert.equal(run.snapshot().bottles, 0);
  assert.equal(run.snapshot().bonus, 0);
  assert.equal(run.snapshot().challenge.progress, '0/3');
});
