import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCast, castAt } from '../../src/minigames/gotomonCast.js';

const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const monsters = {
  a: { id: 'a', name: 'アー' }, b: { id: 'b', name: 'ビー' }, c: { id: 'c', name: 'シー' },
  boss: { id: 'boss', name: 'ボス', isBoss: true }, nopic: { id: 'nopic', name: '絵なし' },
};
const stages = [{ stageId: 's1', enemyIdList: ['a', 'b', 'boss'] }, { stageId: 's2', enemyIdList: ['c', 'nopic', 'a'] }];
const imageOf = id => id === 'nopic' ? null : `${id}.webp`;

test('the cast mixes the child\'s Gotomon with wild ones from reached stages, pictures only', () => {
  const cast = buildCast({ owned: [{ id: 'mine', name: 'マイン', imageUrl: 'mine.webp' }, { id: 'x', name: '絵なし', imageUrl: null }],
    stages, lookup: id => monsters[id], imageOf, random: seeded(3) });
  assert.deepEqual(cast.friends.map(item => item.id), ['mine']);
  assert.deepEqual([...cast.wild.map(item => item.id)].sort(), ['a', 'b', 'c', 'mine']);
  assert.equal(cast.boss.id, 'boss');
  assert.ok([...cast.friends, ...cast.wild, cast.boss].every(item => item.imageUrl));
});

test('an empty save still casts the wild Gotomon; nothing at all casts nobody', () => {
  const wildOnly = buildCast({ stages, lookup: id => monsters[id], imageOf, random: seeded(1) });
  assert.equal(wildOnly.friends.length, 0); assert.equal(wildOnly.wild.length, 3);
  const none = buildCast({});
  assert.deepEqual([none.friends.length, none.wild.length, none.boss], [0, 0, null]);
  assert.equal(castAt(none.wild, 5), null);
  assert.equal(castAt([1, 2, 3], 4), 2); assert.equal(castAt([1, 2, 3], -1), 3);
});

test('the companion is left out of the cast', () => {
  const cast = buildCast({ owned: [{ id: 'a', name: 'アー', imageUrl: 'a.webp' }, { id: 'mine', name: 'マイン', imageUrl: 'mine.webp' }],
    stages, lookup: id => monsters[id], imageOf, random: seeded(4), exclude: 'a' });
  assert.deepEqual(cast.friends.map(item => item.id), ['mine']);
  assert.ok(!cast.wild.some(item => item.id === 'a'));
});

test('the cast is capped', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ id: `m${i}`, name: `m${i}` }));
  const cast = buildCast({ stages: [{ enemyIdList: many.map(m => m.id) }], lookup: id => many.find(m => m.id === id), imageOf, random: seeded(2), limit: 8 });
  assert.equal(cast.wild.length, 8);
});
