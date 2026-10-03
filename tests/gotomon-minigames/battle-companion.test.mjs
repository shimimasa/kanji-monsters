import test from 'node:test';
import assert from 'node:assert/strict';
import { subscribe } from '../../src/core/eventBus.js';

// The companion in the battle corner (ui/battleCompanion.js) lights up only when the matchup really
// made a right answer stronger; the damage itself is still decided by companionMatchup alone.
test('companionMatchup announces the cheer only when the bonus applies', async () => {
  const { companionMatchup } = await import('../../src/minigames/battleMatchup.js');
  const heard = [];
  subscribe('battle:companionCheer', payload => heard.push(payload));
  const potato = { name: 'ジャガイモスライム', type: 'food' };
  const fest = { id: 'X', category: '祭り', name: '祭りのゴトモン' }, nature = { id: 'Y', category: '自然', name: '森のゴトモン' };
  assert.equal(companionMatchup(10, fest, [], { getCompanion: () => potato }), 15);
  assert.deepEqual(heard, [{ factor: 1.5 }]);
  assert.equal(companionMatchup(10, nature, [], { getCompanion: () => potato }), 10);
  assert.equal(companionMatchup(10, fest, [], { getCompanion: () => null }), 10);
  assert.equal(heard.length, 1, 'no cheer without a bonus');
});
