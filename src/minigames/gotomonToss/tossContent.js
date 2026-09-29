import { MATH_CONTENT } from '../mathSprint/mathContent.js';

export const TOSS_PROBLEMS = 12;
export const TOSS_BASKETS = 4;
export const TOSS_LEVELS = Object.freeze(['addsub', 'times']);

function take(random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('random must be in [0, 1)');
  return value;
}
const shuffled = (items, random) => {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(take(random) * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
};

// Numbers a child who slipped would likely pick: one or two off, the other
// operation, or a neighbour in the same times table. Never the answer, never negative.
export function nearbyNumbers({ operation, a, b, answer }) {
  const near = [answer + 1, answer - 1, answer + 2, answer - 2, answer + 10, answer - 10];
  const mixed = operation === 'addition' ? [a - b, b - a] : operation === 'subtraction' ? [a + b] : [a + b, a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b];
  return [...new Set([...mixed, ...near])].filter(value => Number.isInteger(value) && value >= 0 && value !== answer);
}

const sign = { addition: '+', subtraction: '−', multiplication: '×' };

// Twelve problems for one run. たし算・ひき算 uses the reviewed within-20 set of the
// other math games (six of each); かけ算 uses the 2〜9の段 (no ×1). Each problem
// carries four basket numbers: the answer and three likely slips.
export function buildTossProblems({ sessionId, random = Math.random, level = 'addsub' }) {
  const kind = TOSS_LEVELS.includes(level) ? level : 'addsub';
  let picked;
  if (kind === 'times') {
    const facts = [];
    for (let a = 2; a <= 9; a++) for (let b = 2; b <= 9; b++) facts.push({ operation: 'multiplication', a, b, answer: a * b });
    picked = shuffled(facts, random).slice(0, TOSS_PROBLEMS);
  } else {
    const pick = operation => shuffled(MATH_CONTENT.filter(item => item.operation === operation), random).slice(0, TOSS_PROBLEMS / 2)
      .map(item => { const variant = shuffled([...item.variants], random)[0]; return { operation, a: variant.a, b: variant.b, answer: item.answer }; });
    picked = shuffled([...pick('addition'), ...pick('subtraction')], random);
  }
  return Object.freeze(picked.map((item, index) => {
    const options = nearbyNumbers(item);
    // Two close slips, then any other slip, so the baskets never all look alike.
    const close = shuffled(options.slice(0, Math.min(options.length, 4)), random).slice(0, 2);
    const rest = shuffled(options.filter(value => !close.includes(value)), random);
    const numbers = shuffled([item.answer, ...close, ...rest].slice(0, TOSS_BASKETS), random);
    return Object.freeze({ problemId: `${sessionId}:toss:${index + 1}`, operation: item.operation, a: item.a, b: item.b,
      question: `${item.a} ${sign[item.operation]} ${item.b}`, answer: item.answer, numbers: Object.freeze(numbers),
      skillId: item.operation === 'multiplication' ? `times-${item.a}` : `${item.operation}-within-${(item.operation === 'addition' ? item.answer : item.a) <= 9 ? 9 : 20}` });
  }));
}
