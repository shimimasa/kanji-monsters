// Canonical addition ignores operand order. Legacy orientations remain playable
// variants of one item, not additional curriculum items. Subtraction is ordered.
const legacy = [];
for (let a = 1; a <= 8; a++) for (let b = a; b <= 9 - a; b++) {
  legacy.push(['addition', a, b, a !== b]);
}
for (let a = 1; a <= 9; a++) for (let b = 1; b <= a; b++) {
  legacy.push(['subtraction', a, b, false]);
}

// Reviewed additions: different sums and partitions, never mirrored padding.
const additions = [
  [1,9], [2,8], [3,7], [4,6], [5,5],
  [2,9], [3,8], [4,7], [5,6], [1,10],
  [3,9], [4,8], [5,7], [6,6], [2,10],
  [4,9], [5,8], [6,7], [3,10],
  [5,9], [6,8], [7,7], [4,10],
  [6,9], [7,8], [5,10], [4,11],
  [7,9], [8,8], [6,10], [5,11],
  [8,9], [7,10], [6,11], [5,12],
  [9,9], [8,10], [9,10], [9,11], [10,10],
];
const subtractions = [
  [10,3], [11,4], [12,5], [13,6], [14,8],
  [15,7], [16,9], [17,8], [18,9], [19,7],
  [20,8], [12,12], [15,10], [18,11], [20,15],
];

export const MATH_CONTENT = Object.freeze([
  ...legacy,
  ...additions.map(([a,b]) => ['addition',a,b,false]),
  ...subtractions.map(([a,b]) => ['subtraction',a,b,false]),
].map(([operation,a,b,reverse]) => Object.freeze({
  fixtureId: `math-${operation}-${a}-${b}`,
  operation, a, b, answer: operation === 'addition' ? a+b : a-b,
  variants: Object.freeze((reverse ? [[a,b],[b,a]] : [[a,b]])
    .map(([left,right]) => Object.freeze({a:left,b:right}))),
  category: operation,
  difficulty: (operation === 'addition' ? a+b : a) <= 9 ? 'easy' : 'standard',
})));
