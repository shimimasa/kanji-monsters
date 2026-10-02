import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { secretsFor, openedSecrets, SECRET_TIERS } from '../../src/minigames/companionSecrets.js';

const monsters = JSON.parse(readFileSync(new URL('../../public/data/enemies_proto.json', import.meta.url), 'utf8'));

test('the notebook opens by なかよし 0/5/12/25/40 and skips a tier the data lacks', () => {
  const potato = monsters.find(m => m.id === 'HKD-E01');
  const at = f => secretsFor(potato, { friendship: f }).filter(s => s.open).map(s => s.key);
  assert.deepEqual(at(0), ['home']);
  assert.deepEqual(at(5), ['home', 'catchphrase']);
  assert.deepEqual(at(24), ['home', 'catchphrase', 'habitat']);
  assert.deepEqual(at(40), ['home', 'catchphrase', 'habitat', 'desc', 'trivia']);
  assert.equal(secretsFor(potato, {}).find(s => s.key === 'trivia').text, potato.trivia);
  assert.deepEqual(openedSecrets(potato, { friendship: 10 }, { friendship: 13 }), ['すみか・なかま']);
  assert.deepEqual(openedSecrets(potato, { friendship: 13 }, { friendship: 14 }), []);
  assert.deepEqual(secretsFor({ ...potato, catchphrase: '' }, { friendship: 99 }).map(s => s.key), ['home', 'habitat', 'desc', 'trivia']);
  assert.deepEqual(secretsFor(null, {}), []);
});

test('for the record: every Gotomon has at least four of the five secrets', () => {
  const counts = monsters.map(m => secretsFor(m, { friendship: 99 }).length);
  assert.ok(counts.every(n => n >= 4));
  console.log(`secrets: ${monsters.length} Gotomon, ${counts.filter(n => n === SECRET_TIERS.length).length} with all five`);
});

test('a run that raises なかよし past a step says what opened; the notebook reads the save', async () => {
  const { installStorage } = await import('../phase-a/storage-helper.mjs');
  const { getDefaultSave } = await import('../../src/core/saveData.js');
  const { loadGameData } = await import('../../src/core/gameState.js');
  const { createGotomonService } = await import('../../src/minigames/gotomonService.js');
  const potato = monsters.find(m => m.id === 'HKD-E01');
  const initial = getDefaultSave(); initial.player.collection.gotomonIds = ['HKD-E01'];
  initial.player.miniGames = { games: {}, companions: { 'HKD-E01': { plays: 4, friendship: 11, xp: 40, medals: [] } } };
  installStorage({ krb_save: JSON.stringify(initial) }); await loadGameData();
  const service = createGotomonService({ now: () => 1000, lookup: id => (id === 'HKD-E01' ? potato : null) });
  assert.deepEqual(service.getSecrets('HKD-E01').filter(s => s.open).map(s => s.key), ['home', 'catchphrase']);
  const value = { owner: service.getOwner(), sessionId: 's1', gameId: 'gotomonPush', gotomonId: 'HKD-E01', score: 300, correct: 4, maxCombo: 2,
    completed: true, finished: true, activeElapsedMs: 60000 };
  value.ticket = service.beginPlay(value);
  const reward = service.awardGotomonPlayResult(value).reward;
  assert.ok(reward.friendship >= 12); assert.deepEqual(reward.newSecrets, ['すみか・なかま']);
  assert.equal(service.getSecrets('HKD-E01').find(s => s.key === 'habitat').open, true);
});
