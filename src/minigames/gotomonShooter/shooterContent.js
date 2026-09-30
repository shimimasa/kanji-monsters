import { buildFishProblems } from '../gotomonFishing/fishContent.js';
import { readingPool } from '../photoRally/photoRallyContent.js';

export const SHOOTER_WAVES = 12;
export const SHOOTER_FORMATION = 4;
export const SHOOTER_MODES = Object.freeze(['english', 'kanji']);

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

const toHira = text => String(text ?? '').replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
// Every way a kanji can be read, with and without its okurigana.
const readingsOf = kanji => new Set([...(kanji.onyomi || []), ...(kanji.kunyomi || [])]
  .flatMap(reading => [toHira(reading).split(/[.・-]/)[0], toHira(reading).replace(/[.・-]/g, '')]).filter(Boolean));

// Kanji whose example-sentence readings fit only themselves among the chosen: a kanji
// joins only when its reading is no reading of the others and theirs are none of its.
// Focus kanji come first, then the stage's own, then the grade's.
export function kanjiCells({ random = Math.random, stageKanji = [], gradeKanji = [], focusKanjiIds = [], size = 16 }) {
  const picked = [];
  for (const { kanji, context } of readingPool({ random, stageKanji, gradeKanji, focusKanjiIds }).ordered) {
    if (picked.length >= size) break;
    // Plates are all hiragana: a katakana reading would stand out from the others.
    if (context.katakana) continue;
    const reading = toHira(context.reading), own = readingsOf(kanji);
    if (picked.some(item => item.kanji === kanji.kanji || readingsOf(item.source).has(reading) || own.has(toHira(item.reading.reading)))) continue;
    picked.push({ source: kanji, cellId: `k${picked.length}`, kanjiId: kanji.id, kanji: kanji.kanji,
      reading: Object.freeze({ before: context.before, reading: context.reading, after: context.after }) });
  }
  return picked.map(({ source, ...cell }) => Object.freeze(cell));
}

// Waves of four plates. 英語: the words of ゴトモンつり (英語→日本語 and 日本語→英語
// take turns). 漢字の読み: a kanji is shown in its sentence and the plates are readings
// of other chosen kanji (kanjiCells), so only the answer's plate can be read that way.
export function buildShooterWaves({ sessionId, random = Math.random, mode = 'english', cells: given = null, stageKanji = [], gradeKanji = [], focusKanjiIds = [] }) {
  if (mode === 'kanji') {
    const cells = given ?? kanjiCells({ random, stageKanji, gradeKanji, focusKanjiIds });
    if (cells.length < SHOOTER_FORMATION + 2) return null;
    const picked = shuffled(cells, random).slice(0, Math.min(SHOOTER_WAVES, cells.length));
    return Object.freeze(picked.map((cell, index) => {
      const others = shuffled(cells.filter(other => other.cellId !== cell.cellId && other.reading.reading !== cell.reading.reading), random).slice(0, SHOOTER_FORMATION - 1);
      const plates = shuffled([cell, ...others], random).map(item => Object.freeze({ contentId: item.kanjiId, text: item.reading.reading,
        word: item.kanji, meaning: item.reading.reading }));
      return Object.freeze({ problemId: `${sessionId}:shooter:${index + 1}:${cell.kanjiId}`, contentId: cell.kanjiId, kind: 'kanji',
        prompt: cell.kanji, sentence: Object.freeze({ before: cell.reading.before, after: cell.reading.after }),
        word: cell.kanji, meaning: cell.reading.reading, plates: Object.freeze(plates), skillId: `kanji:${cell.kanjiId}` });
    }));
  }
  return buildFishProblems({ sessionId, random });
}
