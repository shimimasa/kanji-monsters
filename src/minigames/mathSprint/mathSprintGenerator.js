import { MATH_CONTENT } from './mathContent.js';
// Sample canonical items without replacement, then shuffle ten items.
// All randomness and history belong to the caller's session.
function shuffle(items, random) {
  for (let i = items.length - 1; i > 0; i--) {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('random must be in [0, 1)');
    const j = Math.floor(value * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function generateSessionProblems({ sessionId, random = Math.random }) {
  const addition = MATH_CONTENT.filter(item => item.operation === 'addition');
  const subtraction = MATH_CONTENT.filter(item => item.operation === 'subtraction');
  const selected = [...shuffle(addition, random).slice(0, 5), ...shuffle(subtraction, random).slice(0, 5)];
  return Object.freeze(shuffle(selected, random).map((problem, index) => Object.freeze({
    ...problem, ...shuffle([...problem.variants], random)[0],
    problemId: `${sessionId}:problem:${index + 1}`,
    skillId: `${problem.operation}-within-${(problem.operation === 'addition' ? problem.answer : problem.a) <= 9 ? 9 : 20}`,
  })));
}
