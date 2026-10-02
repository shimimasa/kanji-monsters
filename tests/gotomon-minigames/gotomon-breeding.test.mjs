import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installStorage } from '../phase-a/storage-helper.mjs';
import { getDefaultSave, loadSave } from '../../src/core/saveData.js';
import { loadGameData } from '../../src/core/gameState.js';
import { createGotomonService } from '../../src/minigames/gotomonService.js';
import { validateSave } from '../../src/core/saveValidation.js';
import { typeOf } from '../../src/minigames/gotomonTypes.js';
import { RECIPES } from '../../src/minigames/breedingRecipes.js';
import { REGIONS, regionOfStage } from '../../src/minigames/breedingRegions.js';
import { recipeFor, regionOf, candidates, firstPair, canBreed, validateBreeding, LEGEND_IDS, BREED_LEVEL } from '../../src/minigames/gotomonBreeding.js';

const data = file => JSON.parse(readFileSync(new URL(`../../public/data/${file}`, import.meta.url), 'utf8')).flat(Infinity).filter(m => m?.id);
const legends = data('enemies_legend.json'), legendIds = new Set(legends.map(m => m.id));
const ordinary = [...new Map([...data('enemies_proto.json'), ...data('enemy_world.json')].filter(m => !legendIds.has(m.id)).map(m => [m.id, m])).values()];

test('one fixed recipe for each of the 120 legends: 10 per region, all different in a region', () => {
  assert.deepEqual(Object.keys(RECIPES).sort(), [...legendIds].sort());
  for (const region of REGIONS) {
    const mine = LEGEND_IDS.map(recipeFor).filter(recipe => recipe.region === region.id);
    assert.equal(mine.length, 10, region.id);
    assert.equal(new Set(mine.map(recipe => `${recipe.a}+${recipe.b}`)).size, 10, `${region.id}: no two legends share a recipe`);
  }
  assert.equal(recipeFor('HKD-E01'), null, 'only legends have recipes');
});

test('every recipe can be made: its region has at least 3 ordinary Gotomon of type A, and type B is common', () => {
  const count = (region, type) => ordinary.filter(m => regionOfStage(m.stageId) === region && typeOf(m) === type).length;
  const thinnest = {};
  for (const id of LEGEND_IDS) {
    const recipe = recipeFor(id), a = count(recipe.region, recipe.a), b = ordinary.filter(m => typeOf(m) === recipe.b).length;
    assert.ok(a >= 3, `${id}: ${recipe.region} has ${a} ${recipe.a}`);
    assert.ok(b >= 40, `${id}: ${b} ordinary ${recipe.b}`);
    thinnest[recipe.region] = Math.min(thinnest[recipe.region] ?? Infinity, a);
  }
  console.log(`fewest type-A Gotomon a region's recipe asks among: ${JSON.stringify(thinnest)}`);
});

test('a Gotomon\'s region: a legend by its id, any other by its stage (old spellings too)', () => {
  assert.equal(regionOf({ id: 'HKD-L01', stageId: 'hokkaido_bonus' }), 'hokkaido');
  assert.equal(regionOf({ id: 'AS-L01', stageId: '' }), 'asia', 'a legend with no stage');
  assert.equal(regionOf({ id: 'AOM-E01', stageId: 'tohoku_area1' }), 'tohoku');
  assert.equal(regionOf({ id: 'X', stageId: 'kantou_area2' }), 'kanto');
  assert.equal(regionOf({ id: 'X', stageId: '' }), null); assert.equal(regionOf(null), null);
  const missing = ordinary.filter(m => !regionOfStage(m.stageId));
  assert.ok(missing.length <= 3, `${missing.length} ordinary Gotomon have no region`);
});

test('the rules: both parents Lv5 or more, type A from the region, two different Gotomon', () => {
  const recipe = recipeFor('HKD-L01'); // 北海道の たべもの ＋ でんせつ
  assert.deepEqual([recipe.region, recipe.a, recipe.b], ['hokkaido', 'food', 'legend']);
  const friends = [
    { id: 'potato', type: 'food', region: 'hokkaido', level: 5 },
    { id: 'tea', type: 'food', region: 'kinki', level: 9 },
    { id: 'ghost', type: 'legend', region: 'tohoku', level: 5 },
    { id: 'young', type: 'legend', region: 'hokkaido', level: BREED_LEVEL - 1 },
  ];
  assert.deepEqual(candidates(recipe, friends).a.map(f => f.id), ['potato'], 'only the region\'s たべもの');
  assert.deepEqual(candidates(recipe, friends).b.map(f => f.id), ['ghost'], 'the Lv4 one waits');
  assert.deepEqual(firstPair(recipe, friends), ['potato', 'ghost']);
  assert.equal(canBreed(recipe, friends, 'potato', 'ghost'), true);
  assert.equal(canBreed(recipe, friends, 'tea', 'ghost'), false); assert.equal(canBreed(recipe, friends, 'potato', 'young'), false);
  assert.equal(canBreed(recipe, friends, 'ghost', 'potato'), false, 'the sides matter');
  const same = recipeFor('HKD-L04'); // たべもの ＋ たべもの
  assert.equal(firstPair(same, [{ id: 'potato', type: 'food', region: 'hokkaido', level: 5 }]), null, 'one Gotomon cannot be both parents');
  validateBreeding({}); validateBreeding({ 'HKD-L01': { parents: ['a', 'b'], at: 5 } });
  for (const bad of [[], { 'HKD-E01': { parents: ['a', 'b'], at: 1 } }, { 'HKD-L01': { parents: ['a', 'a'], at: 1 } },
    { 'HKD-L01': { parents: ['a'], at: 1 } }, { 'HKD-L01': { parents: ['a', 'b'], at: -1 } }]) assert.throws(() => validateBreeding(bad));
});

const MONSTERS = {
  'HKD-E01': { name: 'ジャガイモスライム', category: '食文化', stageId: 'hokkaido_area1' },
  'AOM-E01': { name: 'ねぶたゴースト', category: '伝説', stageId: 'tohoku_area1' },
  'HKD-E02': { name: 'わかい子', category: '伝説', stageId: 'hokkaido_area1' },
  'HKD-L01': { name: 'オーロラスピリット', category: '伝説', stageId: 'hokkaido_bonus' },
};
async function fixture(xp = { 'HKD-E01': 370, 'AOM-E01': 400, 'HKD-E02': 369 }) {
  const initial = getDefaultSave(); initial.player.collection.gotomonIds = ['HKD-E01', 'AOM-E01', 'HKD-E02'];
  initial.player.miniGames = { games: {}, companions: Object.fromEntries(Object.entries(xp).map(([id, value]) => [id, { plays: 3, friendship: 4, xp: value, medals: [] }])) };
  installStorage({ krb_save: JSON.stringify(initial) }); await loadGameData();
  return createGotomonService({ now: () => 4242, lookup: id => ({ id, grade: 1, ...(MONSTERS[id] ?? { name: id, category: '', stageId: '' }) }) });
}

test('はいごう: the legend joins, both parents stay, and it is saved once', async () => {
  const service = await fixture();
  const book = service.getBreedingBook(), aurora = book.legends.find(item => item.gotomon.id === 'HKD-L01');
  assert.equal(book.legends.length, 120);
  assert.equal(aurora.revealed, true, 'the child has a 北海道 Gotomon'); assert.equal(aurora.owned, false);
  assert.deepEqual(aurora.pair, ['HKD-E01', 'AOM-E01']);
  assert.equal(book.legends.find(item => item.gotomon.id === 'KIN-L01').revealed, false, 'no 近畿 Gotomon yet');
  assert.equal(service.breed({ legendId: 'HKD-L01', parentA: 'HKD-E01', parentB: 'HKD-E02' }).ok, false, 'a Lv4 parent');
  assert.equal(service.breed({ legendId: 'HKD-L01', parentA: 'AOM-E01', parentB: 'HKD-E01' }).ok, false, 'the wrong sides');
  const result = service.breed({ legendId: 'HKD-L01', parentA: 'HKD-E01', parentB: 'AOM-E01' });
  assert.equal(result.ok, true); assert.equal(result.gotomon.name, 'オーロラスピリット');
  const save = loadSave();
  assert.deepEqual(save.player.collection.gotomonIds, ['HKD-E01', 'AOM-E01', 'HKD-E02', 'HKD-L01'], 'the parents are still there');
  assert.deepEqual(save.player.miniGames.breeding, { 'HKD-L01': { parents: ['HKD-E01', 'AOM-E01'], at: 4242 } });
  assert.equal(save.player.miniGames.companions['HKD-E01'].xp, 370, 'the parents keep their level');
  validateSave(save);
  assert.equal(service.breed({ legendId: 'HKD-L01', parentA: 'HKD-E01', parentB: 'AOM-E01' }).ok, false, 'met once');
  const after = service.getBreedingBook().legends.find(item => item.gotomon.id === 'HKD-L01');
  assert.equal(after.owned, true); assert.equal(after.bred, true); assert.equal(after.pair, null);
  assert.equal(service.breed({ legendId: 'HKD-E01', parentA: 'HKD-E01', parentB: 'AOM-E01' }).ok, false, 'not a legend');
});
