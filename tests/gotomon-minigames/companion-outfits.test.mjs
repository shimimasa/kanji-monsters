import test from 'node:test';
import assert from 'node:assert/strict';
import { installStorage } from '../phase-a/storage-helper.mjs';
import { getDefaultSave, loadSave } from '../../src/core/saveData.js';
import { loadGameData, saveGameData } from '../../src/core/gameState.js';
import { createGotomonService } from '../../src/minigames/gotomonService.js';
import { validateSave } from '../../src/core/saveValidation.js';
import { outfitProgress, wornItems, validateCompanionOutfit, OUTFIT_ITEMS, OUTFIT_SLOTS } from '../../src/minigames/companionOutfits.js';

const sticker = (tier = 'silver', subjects = [], review = false) => ({ tier, review, subjects, firstAt: 1, goldAt: tier === 'gold' ? 1 : null });
const stickersOf = list => Object.fromEntries(list.map((s, i) => [`game${i}x`, s]));

test('each item opens from records that only grow: stickers, subjects, gold, がんばり, level and なかよし', () => {
  assert.ok(Object.values(outfitProgress({})).every(p => !p.unlocked), 'a new companion has nothing yet');
  const friend = { friendship: 12, xp: 0, stickers: stickersOf([sticker('gold', ['math'], true), sticker('silver', ['math']), sticker('silver', ['math', 'kanji'])]) };
  const p = outfitProgress(friend);
  assert.equal(p.ribbon.unlocked, true); assert.equal(p.flowers.unlocked, true); assert.equal(p.scholar.unlocked, true);
  assert.deepEqual({ ...p.hat }, { have: 3, need: 8, unlocked: false });
  assert.deepEqual({ ...p.glasses }, { have: 1, need: 3, unlocked: false });
  assert.equal(p.sparkle.unlocked, false); assert.equal(p.rainbow.unlocked, false); assert.equal(p.cape.unlocked, false);
  assert.equal(outfitProgress({ xp: 1520 }).crown.unlocked, true, 'Lv10 opens the crown');
  assert.equal(outfitProgress({ xp: 960 }).cape.unlocked, true, 'Lv7 opens the cape');
  assert.equal(outfitProgress({ stickers: stickersOf(Array.from({ length: 41 }, () => sticker())) }, { gameCount: 41 }).crown.unlocked, true, 'every sticker opens the crown');
  // Worn: only open items, one per place, in place order.
  assert.deepEqual(wornItems({ ...friend, outfit: { head: 'hat', face: null } }).map(i => i.id), [], 'a closed item is not worn');
  assert.deepEqual(wornItems({ ...friend, outfit: { aura: null, head: 'scholar' } }).map(i => i.id), ['scholar']);
  assert.equal(new Set(OUTFIT_ITEMS.map(i => i.id)).size, 10); assert.ok(OUTFIT_ITEMS.every(i => OUTFIT_SLOTS.includes(i.slot)));
  validateCompanionOutfit({ head: 'crown', face: null });
  for (const bad of [[], { head: 'glasses' }, { feet: null }, { head: 'nothing' }]) assert.throws(() => validateCompanionOutfit(bad));
});

async function fixture() {
  const initial = getDefaultSave(); initial.player.collection.gotomonIds = ['HKD-E01', 'HKD-E02'];
  initial.player.miniGames = { games: {}, companions: { 'HKD-E01': { plays: 4, friendship: 10, xp: 40, medals: [] } } };
  installStorage({ krb_save: JSON.stringify(initial) }); await loadGameData();
  return createGotomonService({ now: () => 1000, lookup: id => ({ id, name: id, grade: 1 }) });
}
const run = (service, sessionId) => {
  const value = { owner: service.getOwner(), sessionId, gameId: 'gotomonPush', gotomonId: 'HKD-E01', score: 300, correct: 4, maxCombo: 2,
    completed: true, finished: true, activeElapsedMs: 60000, subject: 'kanji' };
  value.ticket = service.beginPlay(value); return service.awardGotomonPlayResult(value);
};

test('the first sticker opens the ribbon; it can be put on, shown on the companion, taken off, and closed items are refused', async () => {
  const service = await fixture();
  assert.equal(service.setOutfit({ gotomonId: 'HKD-E01', slot: 'head', itemId: 'ribbon' }).ok, false, 'not open yet');
  const reward = run(service, 'one').reward;
  assert.ok(reward.newOutfits.includes('ribbon'));
  assert.equal(run(service, 'one').reward.duplicate, true);
  assert.equal(service.setOutfit({ gotomonId: 'HKD-E01', slot: 'head', itemId: 'ribbon' }).ok, true);
  assert.deepEqual(service.getGotomonById('HKD-E01').outfit.map(i => i.id), ['ribbon']);
  assert.deepEqual(service.getOwnedGotomon().find(g => g.id === 'HKD-E01').outfit.map(i => i.id), ['ribbon']);
  assert.deepEqual(service.getGotomonById('HKD-E02').outfit, [], 'each companion dresses alone');
  assert.equal(service.setOutfit({ gotomonId: 'HKD-E01', slot: 'face', itemId: 'ribbon' }).ok, false, 'the wrong place');
  assert.equal(service.setOutfit({ gotomonId: 'HKD-E01', slot: 'back', itemId: 'cape' }).ok, false, 'Lv7 not reached');
  assert.equal(service.setOutfit({ gotomonId: 'NOPE', slot: 'head', itemId: null }).ok, false);
  saveGameData(); await loadGameData(); validateSave(loadSave());
  assert.equal(service.getOutfit('HKD-E01').chosen.head, 'ribbon');
  assert.equal(service.setOutfit({ gotomonId: 'HKD-E01', slot: 'head', itemId: null }).ok, true);
  assert.deepEqual(service.getGotomonById('HKD-E01').outfit, []);
});
