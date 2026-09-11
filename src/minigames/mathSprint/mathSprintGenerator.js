// Enumerate finite legal pools, sample without replacement, then shuffle ten items.
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
  const addition = [], subtraction = [];
  for (let a = 1; a <= 8; a++) {
    for (let b = 1; b <= 9 - a; b++) addition.push({ a, b, operation: 'addition', answer: a + b });
  }
  for (let a = 1; a <= 9; a++) {
    for (let b = 1; b <= a; b++) subtraction.push({ a, b, operation: 'subtraction', answer: a - b });
  }
  const selected = [...shuffle(addition, random).slice(0, 5), ...shuffle(subtraction, random).slice(0, 5)];
  return Object.freeze(shuffle(selected, random).map((problem, index) => Object.freeze({
    ...problem, problemId: `${sessionId}:problem:${index + 1}`,
    skillId: problem.operation === 'addition' ? 'addition-within-9' : 'subtraction-within-9',
  })));
}
