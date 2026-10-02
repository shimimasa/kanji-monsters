import { toTraceItems, lookalikesOf, fillLetters } from './gotomonTrace/traceGame.js';

export const BUILD_REVIEW = Object.freeze({
  // Questions missed in the run that come back at most (the first ones missed).
  max: 4,
  // Letters on the table besides the answer's own: look-alikes first (か/が, つ/っ, b/d …).
  extra: 4,
});

const SIGNS = ['+', '−', '×'];
const KANA = /^[ぁ-んァ-ヶー]+$/;
// `note` is a line under the question (a proverb's meaning, a Gotomon's hint); `fill` the cards
// that fill the table when the decoys run short (default: the script's letters).
// `frame` (proverbs): the written kana stay in place and only the kanji's readings are built —
// [{ kanji: '能', size: 2 }, { kana: 'ある' }, …]; `answer` is then the built letters alone.
const target = ({ prompt, sentence = null, note = null, script, answer, accept = [], decoys = [], fill = null, explain = null, frame = null }) => Object.freeze({
  prompt, sentence: sentence ? Object.freeze({ before: sentence.before ?? '', after: sentence.after ?? '' }) : null, note, script, answer,
  frame: frame ? Object.freeze(frame.map(part => Object.freeze({ ...part }))) : null,
  accept: Object.freeze([...new Set(accept)].filter(a => a !== answer)), decoys: Object.freeze([...new Set(decoys)]),
  fill: fill ? Object.freeze([...new Set(fill)]) : null, explain });

// 漢字: the reading of a kanji (in its sentence when there is one) or of a word, in kana.
// `others` are the other choices of the game (their letters go on the table).
export function readingTarget({ word, reading, sentence = null, note = null, others = [] } = {}) {
  if (!word || !KANA.test(reading ?? '')) return null;
  return target({ prompt: sentence ? `「${word}」は この文で どう読む？` : `「${word}」の よみは？`, sentence, note, script: 'kana', answer: reading,
    decoys: others.flatMap(t => [...String(t ?? '')]).filter(ch => KANA.test(ch)), explain: `「${word}」は「${reading}」` });
}

// 英語: the English word, asked from its meaning. Only single words (a–z) are built.
export function wordTarget({ meaning, word, others = [] } = {}) {
  const answer = String(word ?? '').toLowerCase();
  if (!meaning || !/^[a-z]+$/.test(answer)) return null;
  return target({ prompt: `「${meaning}」は英語で？`, script: 'letters', answer,
    decoys: others.flatMap(t => [...String(t ?? '').toLowerCase()]).filter(ch => /[a-z]/.test(ch)), explain: `${meaning} ＝ ${answer}` });
}

// 算数: the whole number sentence (6+9=15) from number and sign cards, so a one-digit answer is
// not just one card to pick. For + and × the turned-round sentence (9+6=15) is right too.
// `question` is "6 + 9" (or "6 + 9 = ?"); null when it is not one sum of two numbers.
export function equationTarget({ question, answer, others = [] } = {}) {
  const m = String(question ?? '').replace(/\s*=\s*\?\s*$/, '').match(/^\s*(\d+)\s*([+−×*-])\s*(\d+)\s*$/);
  if (!m) return null;
  const a = Number(m[1]), b = Number(m[3]), sign = { '-': '−', '*': '×' }[m[2]] ?? m[2];
  const value = sign === '+' ? a + b : sign === '−' ? a - b : a * b;
  if (String(value) !== String(answer)) return null;
  return target({ prompt: `「${a} ${sign} ${b}」の しきと こたえを ならべよう`, script: 'equation', answer: `${a}${sign}${b}=${value}`,
    accept: sign === '−' ? [] : [`${b}${sign}${a}=${value}`], decoys: others.flatMap(t => [...String(t ?? '')]).filter(ch => /\d/.test(ch)),
    explain: `${a} ${sign} ${b} = ${value}` });
}

// 漢字パーツ: the two parts of a kanji in the order they are written (left → right,
// top → bottom, outside → inside). `others` are other parts (the one the child chose first).
const PART_ORDER = { lr: 'ひだり → みぎ', tb: 'うえ → した', out: 'そと → なか' };
export function partsTarget({ kanji, reading = null, parts = [], layout, others = [], fill = [] } = {}) {
  if (!kanji || parts.length !== 2 || !PART_ORDER[layout]) return null;
  return target({ prompt: `「${kanji}」の パーツを ${PART_ORDER[layout]} の じゅんに ならべよう`, note: reading ? `（${reading}）` : null,
    script: 'parts', answer: parts.join(''), decoys: others, fill, explain: `${parts.join(' と ')} で「${kanji}」` });
}

// The ways to give each kanji run of `text` a part of `reading`, keeping the written kana in place
// (猫に小判 / ねこにこばん → [ねこ, こばん]). Usually only one; 鬼に金棒 has two (お|にかなぼう, おに|かなぼう).
const HIRA = /^[ぁ-んー]+$/;
export function kanjiSplits(text, reading) {
  const runs = String(text ?? '').match(/[ぁ-んー]+|[^ぁ-んー]+/g) ?? [], out = [];
  const go = (i, at, acc) => {
    if (out.length > 8) return;
    if (i === runs.length) { if (at === reading.length) out.push(acc); return; }
    if (HIRA.test(runs[i])) { if (reading.startsWith(runs[i], at)) go(i + 1, at + runs[i].length, acc); return; }
    for (let end = at + 1; end <= reading.length; end++) go(i + 1, end, [...acc, reading.slice(at, end)]);
  };
  go(0, 0, []);
  return { runs, ways: out };
}

// ことわざ: its reading, built only where kanji are written (能ある鷹は爪を隠す → □□ある□□は□□を□□す),
// with the meaning under the question. `split` settles a proverb that can be split two ways.
// Without one clear split the whole reading is built.
export function proverbTarget({ text, reading, meaning = null, split = null } = {}) {
  const note = meaning ? `いみ：${meaning}` : null;
  const whole = readingTarget({ word: text, reading, note });
  if (!whole) return null;
  const { runs, ways } = kanjiSplits(text, reading);
  const way = ways.length === 1 ? ways[0] : ways.find(w => split && w.join('/') === split.join('/'));
  if (!way || runs.every(r => HIRA.test(r))) return whole;
  let k = 0;
  const frame = runs.map(r => (HIRA.test(r) ? { kana: r } : { kanji: r, size: [...way[k++]].length }));
  return target({ prompt: `「${text}」の よみは？ 漢字の ところを ならべよう`, note, script: 'kana', answer: way.join(''), frame,
    explain: `「${text}」は「${reading}」` });
}

// 都道府県: a prefecture's full name (北海道, 東京都 …) from kanji cards.
export function placeTarget({ name, fullName, note = null, others = [], fill = [] } = {}) {
  if (!name || !fullName) return null;
  return target({ prompt: `${name}の ふるさとは どこ？ 名前を ならべよう`, note, script: 'place', answer: fullName,
    decoys: others.flatMap(t => [...String(t ?? '')]), fill: fill.flatMap(t => [...String(t ?? '')]), explain: `${name}の ふるさとは ${fullName}` });
}

// What to build for a missed 4-plate question (the shared problems of the slash game and its kin):
// 漢字 the reading in kana, 英語 the English word (asked from its meaning), 算数 the number sentence.
// Takes the content item (plates, answerId) or a game's problem (choices, correctChoiceId).
export function buildTarget(item) {
  const plates = item?.plates ?? item?.choices?.map(c => ({ plateId: c.choiceId, text: c.text, note: c.note ?? null }));
  const answerId = item?.answerId ?? item?.correctChoiceId;
  if (!Array.isArray(plates) || !plates.some(p => p.plateId === answerId)) return null;
  const [it] = toTraceItems([{ ...item, plates, answerId }]);
  if (!it.target.length) return null;
  if (it.script === 'digits') {
    const sum = equationTarget({ question: it.prompt, answer: it.target.join(''), others: plates.filter(p => p.plateId !== answerId).map(p => p.text) });
    if (sum) return sum;
  }
  return target({ prompt: it.prompt, sentence: it.sentence ?? null, script: it.script, answer: it.target.join(''), decoys: it.decoys, explain: it.explain ?? null });
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

// Look-alikes on the table: か/が, b/d …; in a number sentence the other signs (+ − ×).
const lookOf = (ch, script) => script === 'equation' ? (SIGNS.includes(ch) ? SIGNS.filter(s => s !== ch) : []) : lookalikesOf(ch, script);

// The letter cards for one answer: its own letters and BUILD_REVIEW.extra others, shuffled.
export function buildTiles(target, random) {
  const answer = [...target.answer];
  const pick = [], seen = new Set(answer);
  const add = ch => { if (pick.length < BUILD_REVIEW.extra && ch && !seen.has(ch)) { seen.add(ch); pick.push(ch); } };
  for (const ch of shuffled(answer.flatMap(c => lookOf(c, target.script)), random)) add(ch);
  for (const ch of shuffled(target.decoys, random)) add(ch);
  for (const ch of shuffled(target.fill ?? fillLetters(target.script), random)) add(ch);
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
  // The right rows (a number sentence may also be turned round); the one the cards head for is
  // the one that matches the most cards from the start (the first one when none does).
  const answers = () => [items[at].target.answer, ...(items[at].target.accept ?? [])].map(a => [...a]);
  const agree = (word, a) => { const k = word.findIndex((ch, i) => ch !== a[i]); return k < 0 ? word.length : k; };
  const answer = () => {
    const word = placed.map(k => tiles[k]);
    return answers().reduce((best, a) => (agree(word, a) > agree(word, best) ? a : best));
  };
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
      prompt: items[at]?.target.prompt ?? null, sentence: items[at]?.target.sentence ?? null, note: items[at]?.target.note ?? null,
      frame: items[at]?.target.frame ?? null,
      script: items[at]?.target.script ?? null,
      chosen: items[at]?.chosen ?? null, explain: items[at]?.target.explain ?? null,
      length: items[at] ? answer().length : 0,
      tiles: Object.freeze([...tiles]), placed: Object.freeze([...placed]),
      word: placed.map(k => tiles[k]).join(''),
      // Help after a wrong row: the next card glows; after two, the answer is shown.
      hintTile: status === 'building' && tries > 0 ? nextTile() : -1,
      shownAnswer: status === 'solved' ? last.word : status === 'building' && tries >= 2 ? items[at].target.answer : null,
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
      if (++at >= items.length) { status = 'done'; tiles = []; placed = []; tries = 0; last = null; return true; }
      deal();
      return true;
    },
  };
}
