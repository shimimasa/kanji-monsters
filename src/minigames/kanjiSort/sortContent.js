import { contextReading } from '../photoRally/photoRallyContent.js';
import { shuffled } from '../kanjiBingo/bingoContent.js';

// Puzzle order and sizes: 画数 and 読み take turns; the last four have five cards.
export const SORT_PLAN = Object.freeze(['strokes', 'reading', 'strokes', 'reading', 'strokes', 'reading', 'strokes', 'reading']);
export const SORT_SIZES = Object.freeze([4, 4, 4, 4, 5, 5, 5, 5]);
// The word shown under a reading card stays short on a phone-sized card.
export const WORD_SIDE_MAX = 4;

const GOJUON = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん';
const PLAIN = Object.freeze({ が: 'か', ぎ: 'き', ぐ: 'く', げ: 'け', ご: 'こ', ざ: 'さ', じ: 'し', ず: 'す', ぜ: 'せ', ぞ: 'そ',
  だ: 'た', ぢ: 'ち', づ: 'つ', で: 'て', ど: 'と', ば: 'は', び: 'ひ', ぶ: 'ふ', べ: 'へ', ぼ: 'ほ', ぱ: 'は', ぴ: 'ひ', ぷ: 'ふ', ぺ: 'へ', ぽ: 'ほ', ゔ: 'う' });
const toHira = text => String(text ?? '').replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
// The first sound decides the order (が counts as か), the way children look words up.
export const firstSound = reading => { const head = toHira(reading)[0] ?? ''; return PLAIN[head] ?? head; };
export const soundIndex = reading => GOJUON.indexOf(firstSound(reading));

// The word the kanji sits in: what is written right before and after it, up to a space
// or a comma. A long tail is cut with …, so a card never shows a whole sentence.
export function readingWord(context) {
  const before = context.before.split(/[\s、。「」]/).at(-1).slice(-WORD_SIDE_MAX);
  const tail = context.after.split(/[\s、。「」]/)[0];
  return Object.freeze({ before, after: tail.length > WORD_SIDE_MAX + 1 ? `${tail.slice(0, WORD_SIDE_MAX)}…` : tail });
}

// Eight puzzles of kanji to put in order: by stroke count (fewest first) or by the
// first sound of the reading (あいうえお順). Each kanji is used once per run.
// Stroke puzzles keep counts two apart when they can, so children can compare them by
// eye; reading puzzles use kanji whose reading is fixed by their example sentence and
// start with different sounds, so the order never depends on which reading a child knows.
// Focus kanji come first, then the stage's own kanji, then the grade's.
export function buildSortPuzzles({ random = Math.random, stageKanji = [], gradeKanji = [], focusKanjiIds = [] }) {
  const focus = new Set(focusKanjiIds);
  const own = new Set(stageKanji.map(kanji => kanji.id));
  const ordered = [...shuffled(stageKanji.filter(kanji => focus.has(kanji.id)), random),
    ...shuffled(stageKanji.filter(kanji => !focus.has(kanji.id)), random),
    ...shuffled(gradeKanji.filter(kanji => !own.has(kanji.id)), random)].map(kanji => ({ kanji, context: contextReading(kanji) }));
  const used = new Set();
  const fill = (size, fits) => {
    const picked = [];
    for (const item of ordered) {
      if (picked.length >= size) break;
      if (used.has(item.kanji.kanji) || picked.some(other => other.kanji.kanji === item.kanji.kanji) || !fits(item, picked)) continue;
      picked.push(item);
    }
    if (picked.length < size) return null;
    picked.forEach(item => used.add(item.kanji.kanji));
    return picked;
  };
  const readingCards = size => fill(size, (item, picked) => {
    if (!item.context || item.context.katakana || soundIndex(item.context.reading) < 0) return false;
    const sound = firstSound(item.context.reading);
    return picked.every(other => firstSound(other.context.reading) !== sound);
  });
  const strokeCards = size => {
    const apart = gap => (item, picked) => Number.isInteger(item.kanji.strokes) && item.kanji.strokes > 0
      && picked.every(other => Math.abs(other.kanji.strokes - item.kanji.strokes) >= gap);
    return fill(size, apart(2)) ?? fill(size, apart(1));
  };
  // Readings are rarer, so reading puzzles choose first.
  const built = new Array(SORT_PLAN.length).fill(null);
  for (const pass of ['reading', 'strokes']) {
    SORT_PLAN.forEach((kind, index) => {
      if (kind !== pass) return;
      built[index] = kind === 'reading' ? readingCards(SORT_SIZES[index]) : strokeCards(SORT_SIZES[index]);
    });
  }
  if (built.some(cards => !cards)) return null;
  return Object.freeze(built.map((items, index) => {
    const kind = SORT_PLAN[index];
    const key = item => kind === 'reading' ? soundIndex(item.context.reading) : item.kanji.strokes;
    const order = [...items].sort((a, b) => key(a) - key(b)).map(item => item.kanji.id);
    const cards = shuffled(items, random).map((item, place) => Object.freeze({
      cardId: `p${index}c${place}`, kanjiId: item.kanji.id, kanji: item.kanji.kanji, strokes: item.kanji.strokes,
      reading: kind === 'reading' ? toHira(item.context.reading) : null,
      word: kind === 'reading' ? readingWord(item.context) : null,
      rank: order.indexOf(item.kanji.id), focus: focus.has(item.kanji.id) }));
    return Object.freeze({ puzzleId: `p${index}`, kind, cards: Object.freeze(cards) });
  }));
}

