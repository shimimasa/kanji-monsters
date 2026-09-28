import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { companionCourse, companionCourseGames } from '../../src/minigames/companionCourses.js';
import { createGameplayRun } from '../../src/minigames/gameplay/gameplayRun.js';
import { growthStatus } from '../../src/minigames/companionGrowth.js';

const effects = growthStatus().effects;
const monsters = JSON.parse(readFileSync(new URL('../../public/data/enemies_proto.json', import.meta.url), 'utf8'));
const monster = id => monsters.find(item => item.id === id);
const runFor = (gameId, companionId, useCourse = true) => {
  const course = useCourse ? companionCourse(monster(companionId), gameId) : null;
  const run = createGameplayRun(gameId, effects, { course });
  run.context({ phase: 'answering', paused: false });
  return run;
};

test('only the named companion has each special course', () => {
  assert.equal(companionCourse(monster('HKD-E01'), 'mathSprint')?.name, 'ころころ近道');
  assert.equal(companionCourse(monster('HKD-E02'), 'mathInvader')?.name, '黄金の連射');
  assert.equal(companionCourse(monster('HKD-E03'), 'timedChoice')?.name, 'しずくの灯台');
  assert.equal(companionCourse(monster('HKD-E01'), 'mathInvader'), null);
  assert.equal(companionCourse(monster('HKD-E04'), 'mathSprint'), null);
});

test('every monster receives two shared routes across all eight games', () => {
  const covered = new Set();
  for (const entry of monsters) {
    const games = companionCourseGames(entry);
    assert.equal(games.length, 2, entry.id);
    assert.equal(new Set(games).size, 2, entry.id);
    for (const gameId of games) {
      assert.ok(companionCourse(entry, gameId), `${entry.id}: ${gameId}`);
      covered.add(gameId);
    }
  }
  assert.deepEqual([...covered].sort(), ['mathSprint','mathInvader','englishChoice','sentenceOrder',
    'timedChoice','multiSelect','asyncChoice','kanjiDefense'].sort());
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

test('shared treasure, bridge, craft, exploration and defense routes have distinct actions', () => {
  const treasure = runFor('englishChoice', 'HKD-E01');
  treasure.answer(true, {}, 1); treasure.answer(true, {}, 2);
  assert.equal(treasure.snapshot().keys, 1);
  assert.equal(treasure.act('use-key'), true);
  treasure.answer(true, {}, 3);
  assert.equal(treasure.snapshot().challenge.status, 'achieved');

  const bridge = runFor('sentenceOrder', 'AOM-E09');
  bridge.answer(true, {}, 1); bridge.answer(true, {}, 2);
  assert.equal(bridge.act('bridge-anchor'), true);
  bridge.answer(true, {}, 3);
  assert.equal(bridge.snapshot().anchorBridges, 1);

  const craft = runFor('multiSelect', 'HKD-E04');
  craft.answer(true, {}, 1); craft.answer(true, {}, 2);
  assert.equal(craft.act('release-spark'), true);
  craft.answer(true, {}, 3); craft.answer(true, {}, 4);
  assert.equal(craft.act('release-spark'), true);
  assert.equal(craft.snapshot().challenge.status, 'achieved');

  const explore = runFor('asyncChoice', 'HKD-E04');
  explore.act('route-0'); explore.answer(true, {}, 1); explore.answer(true, {}, 2);
  assert.equal(explore.act('use-compass'), true);
  explore.act('route-1'); explore.answer(true, {}, 3); explore.answer(true, {}, 4);
  assert.equal(explore.snapshot().compassFindings, 1);

  const defense = runFor('kanjiDefense', 'AOM-E09');
  defense.answer(true, {}, 1); defense.answer(true, {}, 2);
  assert.equal(defense.act('use-ward'), true);
  defense.answer(true, {}, 3);
  assert.equal(defense.snapshot().wardHits, 1);
});
