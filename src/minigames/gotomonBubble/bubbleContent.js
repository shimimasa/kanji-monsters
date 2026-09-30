export const BUBBLE_LEVELS = Object.freeze(['addsub', 'times']);
export const BUBBLE_VALUES = 5;

function take(random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('random must be in [0, 1)');
  return value;
}
export const pick = (items, random) => items[Math.floor(take(random) * items.length)];
export const shuffled = (items, random) => {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(take(random) * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
};

// Answers used on one board. たし算・ひき算: 5〜15 (each has many sums and differences
// within 20). かけ算: products of the 2〜9の段 that can be made in more than one way,
// plus a few with one way.
const ADD_SUB_VALUES = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const TIMES_VALUES = [12, 16, 18, 24, 36, 8, 20, 30, 6, 14];
export function pickValues(level, random) {
  return level === 'times'
    ? shuffled(TIMES_VALUES.slice(0, 5), random).slice(0, 3).concat(shuffled(TIMES_VALUES.slice(5), random).slice(0, BUBBLE_VALUES - 3))
    : shuffled(ADD_SUB_VALUES, random).slice(0, BUBBLE_VALUES);
}

// Every way to write a value on a bubble: the number itself, sums and differences
// within 20, or products of the 2〜9の段.
export function labelsFor(value, level) {
  if (level === 'times') {
    const products = [];
    for (let a = 2; a <= 9; a++) for (let b = 2; b <= 9; b++) if (a * b === value) products.push(`${a}×${b}`);
    return [String(value), ...products];
  }
  const sums = [], differences = [];
  for (let a = 1; a < value && a <= 10; a++) if (value - a <= 10) sums.push(`${a}+${value - a}`);
  for (let b = 1; value + b <= 20 && b <= 9; b++) differences.push(`${value + b}−${b}`);
  return [String(value), ...sums, ...differences];
}
// Most bubbles are written as a calculation, so the child works each one out.
export const labelFor = (value, level, random) => {
  const all = labelsFor(value, level);
  return take(random) < 0.25 || all.length === 1 ? all[0] : pick(all.slice(1), random);
};
