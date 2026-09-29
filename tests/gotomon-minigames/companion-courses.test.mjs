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
  assert.equal(companionCourse(monster('HKD-E03'), 'timedChoice')?.name, 'しずくハンマー');
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

test('potato route rolls ahead after two correct jumps in a row', () => {
  const run = runFor('mathSprint', 'HKD-E01');
  const normal = runFor('mathSprint', 'HKD-E01', false);
  for (const target of [run, normal]) { target.answer(true, {}, 1); target.answer(true, {}, 2); target.update(20000); }
  assert.equal(run.snapshot().shortcuts, 1);
  assert.equal(normal.snapshot().shortcuts, 0);
  assert.equal(run.snapshot().course.id, 'potato-shortcut');
  assert.equal(run.snapshot().challenge.progress, '1/2');
});
test('corn route loads a golden shot after three hits in a row', () => {
  const run = runFor('mathInvader', 'HKD-E02');
  const normal = runFor('mathInvader', 'HKD-E02', false);
  for (let index = 0; index < 3; index++) { run.answer(true, {}, index + 1); normal.answer(true, {}, index + 1); }
  assert.equal(run.snapshot().golden, true); assert.equal(normal.snapshot().golden, false);
  run.answer(false, { reason: 'wrong' }, 0);
  assert.equal(run.snapshot().golden, true);
  const before = run.snapshot().bonus; run.answer(true, {}, 1);
  assert.equal(run.snapshot().goldenHits, 1); assert.ok(run.snapshot().bonus - before >= 40);
  assert.equal(run.snapshot().challenge.status, 'achieved');
});
test('milk route charges a splash hammer after two hits and a miss drops the charge', () => {
  const run = runFor('timedChoice', 'HKD-E03');
  const normal = runFor('timedChoice', 'HKD-E03', false);
  for (const target of [run, normal]) { target.answer(true, {}, 1); target.answer(true, {}, 2); }
  assert.equal(run.snapshot().charged, true); assert.equal(normal.snapshot().charged, false);
  // In-play buttons were removed: the charge is used by the next hit on its own.
  assert.equal(run.act('store-light'), false);
  run.answer(false, { reason: 'timeout' }, 0);
  assert.equal(run.snapshot().charged, false); assert.equal(run.snapshot().special, 0);
  run.answer(true, {}, 1); run.answer(true, {}, 2);
  const before = run.snapshot().bonus; run.answer(true, {}, 3);
  assert.equal(run.snapshot().special, 1); assert.ok(run.snapshot().bonus - before >= 40);
  assert.equal(run.snapshot().challenge.status, 'achieved');
});

test('shared treasure, bridge, star, cart and defense routes charge and spend on their own', () => {
  // Each quiz route is automatic: two hits in a row charge it, the next hit spends it.
  for (const [gameId, companionId, name] of [['englishChoice', 'HKD-E01', '金の宝箱'], ['sentenceOrder', 'AOM-E09', '虹の橋'],
    ['multiSelect', 'HKD-E04', '流れ星'], ['asyncChoice', 'HKD-E04', '羅針盤の宝']]) {
    const run = runFor(gameId, companionId), normal = runFor(gameId, companionId, false);
    assert.equal(run.snapshot().course?.id, companionCourse(monster(companionId), gameId).id, gameId);
    for (const target of [run, normal]) { target.answer(true, {}, 1); target.answer(true, {}, 2); target.answer(true, {}, 3); }
    assert.equal(run.snapshot().special, 1, gameId); assert.equal(normal.snapshot().special, 0, gameId);
    assert.ok(run.snapshot().bonus > normal.snapshot().bonus, gameId);
    assert.match(run.snapshot().summary, new RegExp(name), gameId);
    assert.equal(run.act('use-key'), false, gameId);
    if (gameId !== 'asyncChoice') assert.equal(run.snapshot().challenge.status, 'achieved', gameId);
    else { run.answer(true, {}, 4); run.answer(true, {}, 5); run.answer(true, {}, 6); assert.equal(run.snapshot().challenge.status, 'achieved', gameId); }
  }

  // The defense ward is automatic: two hits in a row make one, the next hit uses it.
  const defense = runFor('kanjiDefense', 'AOM-E09');
  defense.answer(true, {}, 1); defense.answer(true, {}, 2);
  assert.equal(defense.snapshot().wards, 1);
  defense.answer(true, {}, 3);
  assert.equal(defense.snapshot().wardHits, 1);
});
