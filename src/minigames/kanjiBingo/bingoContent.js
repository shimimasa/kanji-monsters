import { contextReading } from '../photoRally/photoRallyContent.js';

export const BINGO_SIZE = 4;
export const BINGO_CELLS = BINGO_SIZE * BINGO_SIZE;
// Four rows, four columns and the two diagonals.
export const BINGO_LINES = Object.freeze([
  ...Array.from({ length: BINGO_SIZE }, (_, row) => Array.from({ length: BINGO_SIZE }, (_, col) => row * BINGO_SIZE + col)),
  ...Array.from({ length: BINGO_SIZE }, (_, col) => Array.from({ length: BINGO_SIZE }, (_, row) => row * BINGO_SIZE + col)),
  Array.from({ length: BINGO_SIZE }, (_, i) => i * BINGO_SIZE + i),
  Array.from({ length: BINGO_SIZE }, (_, i) => i * BINGO_SIZE + BINGO_SIZE - 1 - i),
].map(line => Object.freeze(line)));

const toHira = text => String(text ?? '').replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
function take(random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new TypeError('random must return a finite value in [0, 1)');
  return value;
}
export function shuffled(items, random) {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(take(random) * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
}

// The child-friendly meaning, unless it is missing or gives the kanji away.
export function meaningClue(kanji) {
  const text = String(kanji?.meaning ?? '').trim();
  return text && !text.includes(kanji.kanji) ? text : null;
}
const readingsOf = kanji => new Set([...(kanji.onyomi || []), ...(kanji.kunyomi || [])].map(toHira).filter(Boolean));

// Sixteen kanji whose clues point to exactly one square on the card. A reading clue
// is dropped when another square can be read the same way; a kanji is left off when
// it could answer a clue already on the card. Focus kanji come first, then the
// stage's own kanji, then the grade's.
export function buildBingoCard({ random = Math.random, stageKanji = [], gradeKanji = [], focusKanjiIds = [] }) {
  const focus = new Set(focusKanjiIds);
  const own = new Set(stageKanji.map(kanji => kanji.id));
  const extra = gradeKanji.filter(kanji => !own.has(kanji.id));
  const ordered = [...shuffled(stageKanji.filter(kanji => focus.has(kanji.id)), random),
    ...shuffled(stageKanji.filter(kanji => !focus.has(kanji.id)), random), ...shuffled(extra, random)];
  const picked = [];
  for (const kanji of ordered) {
    if (picked.length >= BINGO_CELLS) break;
    if (picked.some(item => item.kanji === kanji.kanji)) continue;
    const readings = readingsOf(kanji);
    // It must not also answer a reading clue that is already on the card.
    if (picked.some(item => item.reading && readings.has(toHira(item.reading.reading)))) continue;
    const context = contextReading(kanji);
    const reading = context && !picked.some(item => readingsOf(item.source).has(toHira(context.reading)))
      ? Object.freeze({ before: context.before, reading: context.reading, after: context.after }) : null;
    const meaning = meaningClue(kanji);
    const uniqueMeaning = meaning && !picked.some(item => item.meaning === meaning) ? meaning : null;
    if (!reading && !uniqueMeaning) continue;
    picked.push({ source: kanji, kanjiId: kanji.id, kanji: kanji.kanji, reading, meaning: uniqueMeaning, focus: focus.has(kanji.id) });
  }
  if (picked.length < BINGO_CELLS) return null;
  return Object.freeze(shuffled(picked, random).map((item, index) => Object.freeze({
    cellId: `b${index}`, index, kanjiId: item.kanjiId, kanji: item.kanji, reading: item.reading, meaning: item.meaning, focus: item.focus,
    readings: Object.freeze([...readingsOf(item.source)]),
  })));
}

// Lines whose four squares are all marked.
export const completedLines = marked => BINGO_LINES.map((line, index) => line.every(cell => marked[cell]) ? index : -1).filter(index => index >= 0);
