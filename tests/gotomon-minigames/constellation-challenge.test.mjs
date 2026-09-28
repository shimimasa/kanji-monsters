import test from 'node:test';
import assert from 'node:assert/strict';
import { createConstellationWorld } from '../../src/minigames/gameplay/constellationWorld.js';
import { growthStatus } from '../../src/minigames/companionGrowth.js';
import { createCompanionPlay } from '../../src/minigames/companionPlay.js';
const effects = growthStatus().effects;
test('goal can be changed before first answer only; selecting it supplies a matching route', () => {
  const world = createConstellationWorld(effects);
  assert.equal(world.act('star-goal-crown'), true); assert.equal(world.snapshot().route, 2);
  assert.equal(world.act('star-goal-unknown'), false);
  world.answer(false, { score: 0 });
  assert.equal(world.act('star-goal-arc'), false); assert.equal(world.snapshot().challenge.id, 'crown');
  assert.equal(world.act('star-route-0'), true);
});
test('arc succeeds at the four-question boundary and remembers the actual achievement question', () => {
  const world = createConstellationWorld(effects); world.act('star-goal-arc');
  world.answer(false, { score: 0 });
  for (let i = 0; i < 3; i++) world.answer(true);
  assert.equal(world.snapshot().challenge.status, 'achieved'); assert.equal(world.snapshot().challenge.achievedAt, 4);
  world.answer(true); assert.equal(world.snapshot().challenge.achievedAt, 4);
});
test('deadline failure cannot turn into success later and does not stop playing', () => {
  const world = createConstellationWorld(effects); world.act('star-goal-arc');
  for (let i = 0; i < 4; i++) world.answer(false, { score: 0 });
  for (let i = 0; i < 3; i++) world.answer(true);
  assert.equal(world.snapshot().challenge.status, 'missed'); assert.equal(world.snapshot().completed, 1);
});
test('spread rewards deliberate switching rather than waiting for auto-completion', () => {
  const deliberate = createConstellationWorld(effects), automatic = createConstellationWorld(effects);
  for (let i = 0; i < 6; i++) {
    deliberate.act(`star-route-${Math.floor(i / 2)}`); deliberate.answer(true); automatic.answer(true);
  }
  assert.equal(deliberate.snapshot().challenge.status, 'achieved');
  assert.equal(deliberate.snapshot().challenge.achievedAt, 6);
  assert.equal(automatic.snapshot().challenge.status, 'missed');
});
test('crown must be the first completed route even when both finish within four answers', () => {
  const world = createConstellationWorld({ ...effects, potency: 10 });
  world.act('star-goal-crown'); world.act('star-route-0'); world.boost(); world.answer(true);
  assert.equal(world.snapshot().routes[2], 6); assert.equal(world.snapshot().challenge.status, 'missed');
  const right = createConstellationWorld(effects); right.act('star-goal-crown');
  for (let i = 0; i < 3; i++) right.answer(true);
  assert.equal(right.snapshot().challenge.status, 'achieved');
});
test('partial answers and skill light use the actual route progress; zero score gives no progress', () => {
  const world = createConstellationWorld(effects); world.act('star-goal-arc');
  for (let i = 0; i < 4; i++) world.answer(false, { score: 2 / 3 });
  assert.equal(world.snapshot().challenge.status, 'achieved');
  const zero = createConstellationWorld(effects); zero.act('star-goal-crown'); zero.boost(); zero.answer(false, { score: 0 });
  assert.deepEqual(zero.snapshot().routes, [0, 0, 0]); assert.equal(zero.snapshot().challenge.status, 'active');
});
test('different goals never change existing star score for identical route/answer choices', () => {
  const worlds = ['arc', 'spread', 'crown'].map(id => { const world = createConstellationWorld(effects); world.act(`star-goal-${id}`); return world; });
  for (let i = 0; i < 10; i++) for (const world of worlds) { world.act(`star-route-${i % 3}`); world.answer(i % 2 === 0, { score: .5 }); }
  assert.equal(new Set(worlds.map(world => world.snapshot().bonus)).size, 1);
  assert.deepEqual(worlds[0].snapshot().routes, worlds[1].snapshot().routes);
});
test('host play wrapper rejects paused/feedback/completed choices and duplicate learning events', () => {
  const play = createCompanionPlay('goal', { gameId: 'multiSelect' });
  play.context({ phase: 'answering', paused: true }); assert.equal(play.act('star-goal-arc'), false);
  play.context({ phase: 'feedback', paused: false }); assert.equal(play.act('star-goal-arc'), false);
  play.context({ phase: 'answering', paused: false }); assert.equal(play.act('star-goal-arc'), true);
  const event = { sessionId: 'goal', seq: 1, type: 'correct' }; play.observe(event); play.observe(event);
  assert.equal(play.snapshot().world.challenge.remaining, 3);
  assert.equal(play.act('star-goal-crown'), false);
  play.observe({ sessionId: 'goal', seq: 2, type: 'sessionComplete' }); assert.equal(play.act('star-route-2'), false);
});
