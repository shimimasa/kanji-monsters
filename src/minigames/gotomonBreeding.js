// はいごう (ゴトモン拡張の第3弾, 2026-10-02): two Gotomon at Lv5 or more meet a legendary Gotomon.
// Every legend has one fixed recipe (breedingRecipes.js): a Gotomon of type A from the legend's region
// and a Gotomon of type B from anywhere. Nothing is random, and the parents stay (they are not used up).
// A region's recipes show once the child has a Gotomon from that region. Learning records are not touched.
import { RECIPES } from './breedingRecipes.js';
import { LEGEND_REGION_BY_PREFIX, regionOfStage } from './breedingRegions.js';

export const BREED_LEVEL = 5;
export const recipeFor = id => {
  const recipe = RECIPES[id];
  return recipe ? Object.freeze({ legendId: id, region: recipe[0], a: recipe[1], b: recipe[2] }) : null;
};
export const isLegend = id => Object.hasOwn(RECIPES, id);
export const LEGEND_IDS = Object.freeze(Object.keys(RECIPES));

// Where a Gotomon is from: a legend by its id, any other by its stage.
export function regionOf(monster) {
  if (!monster?.id) return null;
  if (isLegend(monster.id)) return LEGEND_REGION_BY_PREFIX[monster.id.split('-')[0]] ?? null;
  return regionOfStage(monster.stageId);
}

// friends: [{ id, type, region, level }]. Who can stand on each side of the recipe.
export function candidates(recipe, friends = []) {
  const ready = friends.filter(friend => friend.level >= BREED_LEVEL && friend.id !== recipe.legendId);
  return { a: ready.filter(friend => friend.region === recipe.region && friend.type === recipe.a),
    b: ready.filter(friend => friend.type === recipe.b) };
}
// The first pair that works (two different Gotomon), or null.
export function firstPair(recipe, friends = []) {
  const { a, b } = candidates(recipe, friends);
  for (const left of a) { const right = b.find(friend => friend.id !== left.id); if (right) return [left.id, right.id]; }
  return null;
}
export function canBreed(recipe, friends, parentA, parentB) {
  if (!recipe || !parentA || !parentB || parentA === parentB) return false;
  const { a, b } = candidates(recipe, friends);
  return a.some(friend => friend.id === parentA) && b.some(friend => friend.id === parentB);
}

// Saved: { [legendId]: { parents: [a, b], at } } for each legend met by はいごう.
export function validateBreeding(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('Invalid breeding');
  for (const [id, entry] of Object.entries(record)) {
    if (!isLegend(id) || !entry || typeof entry !== 'object' || !Array.isArray(entry.parents) || entry.parents.length !== 2 ||
        entry.parents.some(parent => typeof parent !== 'string' || !parent) || entry.parents[0] === entry.parents[1] ||
        !Number.isSafeInteger(entry.at) || entry.at < 0) throw new Error('Invalid breeding');
  }
}
