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

// The readings of one kind (音 or 訓) in hiragana, without okurigana, longest first.
const stems = list => [...new Set((list || []).map(reading => toHira(reading).split(/[.・-]/)[0]).filter(Boolean))];

// Small changes to how a reading is written, the slips children weak at kanji make:
// a dakuten on or off, a small っ/ゃゅょ made big, a long vowel written the other way.
const DAKUTEN = Object.freeze({ か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご', さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ', た: 'だ', ち: 'ぢ', つ: 'づ', て: 'で', と: 'ど',
  は: 'ば', ひ: 'び', ふ: 'ぶ', へ: 'べ', ほ: 'ぼ' });
const UNDAKUTEN = Object.fromEntries(Object.entries(DAKUTEN).map(([a, b]) => [b, a]));
const SMALL = Object.freeze({ っ: 'つ', ゃ: 'や', ゅ: 'ゆ', ょ: 'よ' });
const LONG = Object.freeze([['おう', 'おお'], ['こう', 'こお'], ['そう', 'そお'], ['とう', 'とお'], ['ほう', 'ほお'], ['よう', 'よお'], ['ろう', 'ろお'], ['えい', 'ええ'], ['せい', 'せえ'], ['けい', 'けえ']]);
export function writingSlips(reading) {
  const chars = [...reading], out = new Set();
  chars.forEach((ch, i) => {
    const swap = DAKUTEN[ch] ?? UNDAKUTEN[ch] ?? SMALL[ch];
    if (swap) out.add([...chars.slice(0, i), swap, ...chars.slice(i + 1)].join(''));
  });
  for (const [a, b] of LONG) { if (reading.includes(a)) out.add(reading.replace(a, b)); if (reading.includes(b)) out.add(reading.replace(b, a)); }
  out.delete(reading);
  return [...out];
}

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
      reading: Object.freeze({ before: context.before, reading: context.reading, after: context.after }),
      onyomi: Object.freeze(stems(kanji.onyomi)), kunyomi: Object.freeze(stems(kanji.kunyomi)) });
  }
  return picked.map(({ source, ...cell }) => Object.freeze(cell));
}

// Waves of four plates. 英語: the words of ゴトモンつり (英語→日本語 and 日本語→英語
// take turns). 漢字の読み: a kanji is shown in its sentence, and the plates make the child
// read it in that sentence: one plate is another reading of the same kanji of the other kind
// (訓 for an 音 answer, 音 for a 訓 one), which that sentence never uses; one is the answer
// written with a small slip (が/か, っ/つ, おう/おお) that is no reading of the kanji; the rest
// are readings of other chosen kanji (kanjiCells). When a kanji has no such reading or slip,
// another kanji's reading takes its place.
export function buildShooterWaves({ sessionId, random = Math.random, mode = 'english', cells: given = null, stageKanji = [], gradeKanji = [], focusKanjiIds = [] }) {
  if (mode === 'kanji') {
    const cells = given ?? kanjiCells({ random, stageKanji, gradeKanji, focusKanjiIds });
    if (cells.length < SHOOTER_FORMATION + 2) return null;
    const picked = shuffled(cells, random).slice(0, Math.min(SHOOTER_WAVES, cells.length));
    return Object.freeze(picked.map((cell, index) => {
      const answer = toHira(cell.reading.reading);
      const own = new Set([...cell.onyomi, ...cell.kunyomi]);
      // Is the answer an 音 reading (also as the first part of a doubled sound: 学校 → がっ)?
      const isOn = cell.onyomi.some(r => r === answer || (answer.endsWith('っ') && r.startsWith(answer.slice(0, -1))));
      const special = [];
      const alt = shuffled((isOn ? cell.kunyomi : cell.onyomi).filter(r => r !== answer && r.length >= 2), random)[0];
      if (alt) special.push({ contentId: `${cell.kanjiId}:alt`, text: alt, word: cell.kanji, meaning: alt, note: `「${cell.kanji}」の べつの読み。この文では こう読まない` });
      const slip = shuffled(writingSlips(answer).filter(w => !own.has(w) && w !== alt), random)[0];
      if (slip) special.push({ contentId: `${cell.kanjiId}:slip`, text: slip, word: cell.kanji, meaning: slip, note: `「${answer}」と にているけれど、ちがう書き方` });
      const others = shuffled(cells.filter(other => other.cellId !== cell.cellId && other.reading.reading !== cell.reading.reading
        && !special.some(sp => sp.text === toHira(other.reading.reading))), random).slice(0, SHOOTER_FORMATION - 1 - special.length);
      const plates = shuffled([
        { contentId: cell.kanjiId, text: cell.reading.reading, word: cell.kanji, meaning: cell.reading.reading },
        ...special,
        ...others.map(item => ({ contentId: item.kanjiId, text: item.reading.reading, word: item.kanji, meaning: item.reading.reading, note: `${item.kanji}の読み` })),
      ], random).map(plate => Object.freeze(plate));
      return Object.freeze({ problemId: `${sessionId}:shooter:${index + 1}:${cell.kanjiId}`, contentId: cell.kanjiId, kind: 'kanji',
        prompt: cell.kanji, sentence: Object.freeze({ before: cell.reading.before, after: cell.reading.after }),
        word: cell.kanji, meaning: cell.reading.reading, plates: Object.freeze(plates), skillId: `kanji:${cell.kanjiId}` });
    }));
  }
  return buildFishProblems({ sessionId, random });
}
