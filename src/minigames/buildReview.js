import { toTraceItems, lookalikesOf, fillLetters } from './gotomonTrace/traceGame.js';

export const BUILD_REVIEW = Object.freeze({
  // Questions missed in the run that come back at most (the first ones missed).
  max: 4,
  // Letters on the table besides the answer's own: look-alikes first (か/が, つ/っ, b/d …).
  extra: 4,
});

// What to build for a missed 4-plate question (the shared problems of the slash game and its kin):
// 漢字 the reading in kana, 英語 the English word (asked from its meaning), 算数 the answer's digits.
// Takes the content item (plates, answerId) or a game's problem (choices, correctChoiceId).
export function buildTarget(item) {
  const plates = item?.plates ?? item?.choices?.map(c => ({ plateId: c.choiceId, text: c.text, note: c.note ?? null }));
  const answerId = item?.answerId ?? item?.correctChoiceId;
  if (!Array.isArray(plates) || !plates.some(p => p.plateId === answerId)) return null;
  const [it] = toTraceItems([{ ...item, plates, answerId }]);
  if (!it.target.length) return null;
  return Object.freeze({ prompt: it.prompt, sentence: it.sentence ?? null, script: it.script, answer: it.target.join(''),
    decoys: Object.freeze([...new Set(it.decoys)]), explain: it.explain ?? null });
}

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

// The letter cards for one answer: its own letters and BUILD_REVIEW.extra others, shuffled.
export function buildTiles(target, random) {
  const answer = [...target.answer];
  const pick = [], seen = new Set(answer);
  const add = ch => { if (pick.length < BUILD_REVIEW.extra && ch && !seen.has(ch)) { seen.add(ch); pick.push(ch); } };
  for (const ch of shuffled(answer.flatMap(c => lookalikesOf(c, target.script)), random)) add(ch);
  for (const ch of shuffled(target.decoys, random)) add(ch);
  for (const ch of shuffled(fillLetters(target.script), random)) add(ch);
  return shuffled([...answer, ...pick], random);
}

// Practice after a run, by recall: each question missed comes back and the child builds the
// answer from letter cards (no choices of whole answers). Nothing is recorded: the learning
// result was the first answer in the game. A full row is checked; a wrong one keeps the letters
// that were right, says which letter differs, and the next card glows. After two wrong rows
// the answer is shown too. No time limit and no way to fail.
export function createBuildReview({ missed = [], random = Math.random } = {}) {
  const seen = new Set();
  const items = missed.filter(m => m?.build && !seen.has(m.contentId) && seen.add(m.contentId))
    .slice(0, BUILD_REVIEW.max).map(m => ({ target: m.build, chosen: m.chosen ?? null }));
  let at = 0, tiles = [], placed = [], tries = 0, status = items.length ? 'building' : 'done', last = null, solved = 0, firstTry = 0;
  const deal = () => { tiles = buildTiles(items[at].target, random); placed = []; tries = 0; last = null; status = 'building'; };
  if (items.length) deal();
  const answer = () => [...items[at].target.answer];
  // The card that should come next (the first unused card with the next letter).
  const nextTile = () => {
    const want = answer()[placed.length];
    return tiles.findIndex((ch, k) => ch === want && !placed.includes(k));
  };
  const check = () => {
    const word = placed.map(k => tiles[k]), target = answer();
    const wrongAt = word.findIndex((ch, k) => ch !== target[k]);
    if (wrongAt < 0) {
      solved++; if (tries === 0) firstTry++;
      status = 'solved'; last = Object.freeze({ correct: true, word: word.join('') });
      return;
    }
    tries++;
    last = Object.freeze({ correct: false, word: word.join(''), wrongAt: wrongAt + 1, expected: target[wrongAt], got: word[wrongAt] });
    placed = placed.slice(0, wrongAt);
  };
  return {
    snapshot: () => Object.freeze({
      status, total: items.length, index: at, solved, firstTry, tries,
      prompt: items[at]?.target.prompt ?? null, sentence: items[at]?.target.sentence ?? null, script: items[at]?.target.script ?? null,
      chosen: items[at]?.chosen ?? null, explain: items[at]?.target.explain ?? null,
      length: items[at] ? answer().length : 0,
      tiles: Object.freeze([...tiles]), placed: Object.freeze([...placed]),
      word: placed.map(k => tiles[k]).join(''),
      // Help after a wrong row: the next card glows; after two, the answer is shown.
      hintTile: status === 'building' && tries > 0 ? nextTile() : -1,
      shownAnswer: status === 'solved' || tries >= 2 ? items[at].target.answer : null,
      last,
    }),
    place(tile) {
      if (status !== 'building' || !Number.isInteger(tile) || tile < 0 || tile >= tiles.length || placed.includes(tile)) return false;
      placed.push(tile); last = null;
      if (placed.length === answer().length) check();
      return true;
    },
    // Takes back the card in this slot (and the cards after it close up).
    unplace(slot) {
      if (status !== 'building' || !Number.isInteger(slot) || slot < 0 || slot >= placed.length) return false;
      placed.splice(slot, 1); last = null;
      return true;
    },
    next() {
      if (status !== 'solved') return false;
      if (++at >= items.length) { status = 'done'; tiles = []; placed = []; last = null; return true; }
      deal();
      return true;
    },
  };
}
