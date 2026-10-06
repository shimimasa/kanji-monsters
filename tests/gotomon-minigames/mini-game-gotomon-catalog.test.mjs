import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { miniGameRegistry } from '../../src/minigames/registry.js';
import { GAME_TYPES } from '../../src/minigames/gotomonTypes.js';
import { MINI_GAME_GOTOMON, miniGameGotomonFor } from '../../src/minigames/miniGameGotomonCatalog.js';

test('50作品にそれぞれ固有の広場ゴトモンがいる', () => {
  const games = Object.keys(miniGameRegistry);
  const friends = Object.values(MINI_GAME_GOTOMON);
  assert.equal(games.length, 50);
  assert.deepEqual(Object.keys(MINI_GAME_GOTOMON).sort(), games.sort());
  assert.equal(new Set(friends.map(friend => friend.id)).size, 50);
  assert.equal(new Set(friends.map(friend => friend.name)).size, 50);
  const known = [
    ...JSON.parse(readFileSync(new URL('../../public/data/enemies_proto.json', import.meta.url), 'utf8')),
    ...JSON.parse(readFileSync(new URL('../../public/data/enemies_legend.json', import.meta.url), 'utf8')),
  ];
  const names = new Set(known.map(monster => monster.name));
  const ids = new Set(known.map(monster => monster.id));
  for (const friend of friends) {
    assert.equal(miniGameGotomonFor(friend.gameId), friend);
    assert.equal(friend.type, GAME_TYPES[friend.gameId]);
    assert.ok(friend.habitat && friend.description && friend.appearance);
    assert.ok(!names.has(friend.name), friend.name);
    assert.ok(!ids.has(friend.id), friend.id);
  }
});

test('50体の画像は個別のWebPとしてそろっている', () => {
  for (const friend of Object.values(MINI_GAME_GOTOMON)) {
    assert.match(friend.imageUrl, /^\/assets\/images\/monsters\/full\/mini-game\/MG-\d{3}\.webp$/);
    const file = new URL(`../../public${friend.imageUrl}`, import.meta.url);
    const image = readFileSync(file);
    assert.ok(image.length > 10_000, friend.id);
    assert.equal(image.toString('ascii', 0, 4), 'RIFF', friend.id);
    assert.equal(image.toString('ascii', 8, 12), 'WEBP', friend.id);
  }
});
