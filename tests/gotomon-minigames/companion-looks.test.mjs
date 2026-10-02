import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installStorage } from '../phase-a/storage-helper.mjs';
import { getDefaultSave, loadSave } from '../../src/core/saveData.js';
import { loadGameData } from '../../src/core/gameState.js';
import { createGotomonService } from '../../src/minigames/gotomonService.js';
import { validateSave } from '../../src/core/saveValidation.js';
import { shinyHue, lookProgress, wornLook, openedLooks, validateCompanionLook, SHINY_GOLD, GLOW_LEVEL } from '../../src/minigames/companionLooks.js';
import { XP_THRESHOLDS } from '../../src/minigames/companionGrowth.js';

const golds = n => Object.fromEntries(Array.from({ length: n }, (_, i) => [`game${i}`, { tier: 'gold', review: false, subjects: [], firstAt: 1, goldAt: 1 }]));
const silvers = n => Object.fromEntries(Array.from({ length: n }, (_, i) => [`silver${i}`, { tier: 'silver', review: false, subjects: [], firstAt: 1, goldAt: null }]));

test('色ちがい opens at 10 gold stickers (silver does not count), かがやき at Lv10', () => {
  assert.equal(lookProgress({ stickers: golds(9) }).shiny.unlocked, false);
  assert.equal(lookProgress({ stickers: { ...golds(9), ...silvers(20) } }).shiny.unlocked, false, 'silver does not count');
  assert.deepEqual({ ...lookProgress({ stickers: golds(SHINY_GOLD) }).shiny }, { unlocked: true, have: 10, need: 10 });
  assert.equal(lookProgress({ xp: XP_THRESHOLDS[8] }).glow.unlocked, false, 'Lv9');
  assert.equal(lookProgress({ xp: XP_THRESHOLDS[9] }).glow.unlocked, true, `Lv${GLOW_LEVEL}`);
  assert.deepEqual(openedLooks(lookProgress({ stickers: golds(9) }), lookProgress({ stickers: golds(10), xp: 1520 })), ['shiny', 'glow']);
});

test('the hue is fixed for each Gotomon (no luck), and only what is open shows', () => {
  for (const id of ['HKD-E01', 'AOM-E01', 'HKD-L01']) assert.equal(shinyHue(id), shinyHue(id));
  const data = file => JSON.parse(readFileSync(new URL(`../../public/data/${file}`, import.meta.url), 'utf8')).flat(Infinity).filter(m => m?.id);
  const hues = {}; for (const m of data('enemies_proto.json')) hues[shinyHue(m.id)] = (hues[shinyHue(m.id)] ?? 0) + 1;
  assert.equal(Object.keys(hues).length, 5, 'five hues spread over the Gotomon');
  console.log(`hues over 880 Gotomon: ${JSON.stringify(hues)}`);
  assert.deepEqual({ ...wornLook({ look: { shiny: true, glow: true } }, 'HKD-E01') }, { shiny: false, glow: false, hue: shinyHue('HKD-E01') }, 'chosen but not open');
  assert.equal(wornLook({ look: { shiny: true }, stickers: golds(10) }, 'x').shiny, true);
  validateCompanionLook({}); validateCompanionLook({ shiny: true, glow: false });
  for (const bad of [[], { shiny: 'yes' }, { color: true }, null]) assert.throws(() => validateCompanionLook(bad));
});

async function fixture() {
  const initial = getDefaultSave(); initial.player.collection.gotomonIds = ['HKD-E01', 'HKD-E02'];
  initial.player.miniGames = { games: {}, companions: {
    'HKD-E01': { plays: 30, friendship: 50, xp: XP_THRESHOLDS[9], medals: [], stickers: golds(9) },
    'HKD-E02': { plays: 1, friendship: 1, xp: 10, medals: [] } } };
  installStorage({ krb_save: JSON.stringify(initial) }); await loadGameData();
  return createGotomonService({ now: () => 1000, lookup: id => ({ id, name: id, grade: 1, category: '食文化' }) });
}

test('the choice is saved, checked, and drawn; a 10th gold sticker opens 色ちがい on the result', async () => {
  const service = await fixture();
  assert.equal(service.setLook({ gotomonId: 'HKD-E01', key: 'shiny', on: true }).ok, false, '9 gold: not open yet');
  assert.equal(service.setLook({ gotomonId: 'HKD-E02', key: 'glow', on: true }).ok, false, 'Lv1: not open yet');
  assert.equal(service.setLook({ gotomonId: 'HKD-E01', key: 'glow', on: true }).ok, true);
  assert.deepEqual({ ...service.getGotomonById('HKD-E01').look }, { shiny: false, glow: true, hue: shinyHue('HKD-E01') });
  const value = { owner: service.getOwner(), sessionId: 's1', gameId: 'gotomonPush', gotomonId: 'HKD-E01',
    score: 5000, correct: 10, maxCombo: 10, completed: true, finished: true, activeElapsedMs: 90000, subject: 'kanji' };
  value.ticket = service.beginPlay(value);
  const { reward } = service.awardGotomonPlayResult(value);
  assert.equal(reward.sticker.tier, 'gold'); assert.deepEqual(reward.newLooks, ['shiny'], 'the 10th gold sticker');
  assert.equal(service.setLook({ gotomonId: 'HKD-E01', key: 'shiny', on: true }).ok, true);
  assert.equal(service.getGotomonById('HKD-E01').look.shiny, true);
  assert.equal(service.setLook({ gotomonId: 'HKD-E01', key: 'shiny', on: false }).ok, true, 'it can always go back');
  assert.equal(service.getGotomonById('HKD-E01').look.shiny, false);
  assert.equal(service.setLook({ gotomonId: 'HKD-E01', key: 'size', on: true }).ok, false);
  validateSave(loadSave());
  assert.deepEqual(loadSave().player.miniGames.companions['HKD-E01'].look, { glow: true, shiny: false });
});

test('the portrait draws the look on the picture only (the きせかえ keep their colours)', () => {
  const ui = readFileSync(new URL('../../src/ui/adventureUI.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../../public/adventure.css', import.meta.url), 'utf8');
  assert.match(ui, /frame\.dataset\.look/); assert.match(css, /\.gt-portrait\[data-look\] img\{filter:var\(--look-hue/);
});
