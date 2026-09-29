import { contextReading } from '../photoRally/photoRallyContent.js';
import { meaningClue, shuffled } from '../kanjiBingo/bingoContent.js';

export const MEMORY_PAIRS = 6;
// Meaning cards stay readable on a phone-sized card.
export const MEANING_MAX = 26;

const toHira = text => String(text ?? '').replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
const readingsOf = kanji => new Set([...(kanji.onyomi || []), ...(kanji.kunyomi || [])].map(toHira).filter(Boolean));

// Two rounds of six pairs: 漢字↔読み, then 漢字↔意味, with different kanji in each.
// A reading card must fit only one kanji on its board, so a kanji is left out when it
// can be read like a reading card already chosen (or its own reading fits one).
// Focus kanji come first, then the stage's own kanji, then the grade's.
export function buildMemoryRounds({ random = Math.random, stageKanji = [], gradeKanji = [], focusKanjiIds = [] }) {
  const focus = new Set(focusKanjiIds);
  const own = new Set(stageKanji.map(kanji => kanji.id));
  const ordered = [...shuffled(stageKanji.filter(kanji => focus.has(kanji.id)), random),
    ...shuffled(stageKanji.filter(kanji => !focus.has(kanji.id)), random),
    ...shuffled(gradeKanji.filter(kanji => !own.has(kanji.id)), random)];
  const used = new Set(), reading = [], meaning = [];
  for (const kanji of ordered) {
    if (reading.length >= MEMORY_PAIRS || used.has(kanji.kanji)) continue;
    const context = contextReading(kanji);
    if (!context) continue;
    const readings = readingsOf(kanji), text = toHira(context.reading);
    if (reading.some(item => readings.has(toHira(item.text)) || readingsOf(item.source).has(text))) continue;
    used.add(kanji.kanji);
    reading.push({ source: kanji, text: context.reading, sentence: Object.freeze({ before: context.before, reading: context.reading, after: context.after }) });
  }
  for (const kanji of ordered) {
    if (meaning.length >= MEMORY_PAIRS || used.has(kanji.kanji)) continue;
    const text = meaningClue(kanji);
    if (!text || text.length > MEANING_MAX || meaning.some(item => item.text === text)) continue;
    used.add(kanji.kanji);
    meaning.push({ source: kanji, text });
  }
  if (reading.length < MEMORY_PAIRS || meaning.length < MEMORY_PAIRS) return null;
  const round = (kind, items) => {
    const pairs = items.map((item, index) => Object.freeze({ pairId: `${kind}-${index}`, kanjiId: item.source.id, kanji: item.source.kanji,
      text: item.text, sentence: item.sentence ?? null, focus: focus.has(item.source.id) }));
    const cards = shuffled(pairs.flatMap(pair => [{ pairId: pair.pairId, face: 'kanji', text: pair.kanji }, { pairId: pair.pairId, face: kind, text: pair.text }]), random)
      .map((card, index) => Object.freeze({ ...card, cardId: `${kind[0]}${index}` }));
    return Object.freeze({ kind, pairs: Object.freeze(pairs), cards: Object.freeze(cards) });
  };
  return Object.freeze([round('reading', reading), round('meaning', meaning)]);
}
