import { buildMemoryRounds } from '../kanjiMemory/memoryContent.js';
import { ENGLISH_CHOICE_FIXTURE } from '../englishChoice/englishChoiceQuestions.js';
import { labelsFor } from '../gotomonBubble/bubbleContent.js';

export const LINK_MODES = Object.freeze(['kanji', 'english', 'math']);
export const LINK_PAIRS = 6;

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

// Two boards of six pairs to join with lines; on each board every right-hand card fits
// only one left-hand card.
//   漢字: the rounds of 漢字カードめくり (漢字↔読み in its sentence, then 漢字↔意味).
//   英語: words of 宝箱キャッチ ↔ their meanings, no two alike on a board.
//   算数: calculations ↔ their answers (たし算・ひき算 within 20), six different answers a board.
export function buildLinkRounds({ random = Math.random, mode = 'kanji', stageKanji = [], gradeKanji = [], focusKanjiIds = [], words = ENGLISH_CHOICE_FIXTURE }) {
  const board = (kind, label, pairs) => Object.freeze({ kind, label, pairs: Object.freeze(pairs.map((pair, index) => Object.freeze({ pairId: `${kind}-${index}`, ...pair }))) });
  if (mode === 'math') {
    const values = shuffled([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], random);
    const round = (kind, label, list, pickLabel) => board(kind, label, list.map(value => {
      const left = pickLabel(value);
      return { left, right: String(value), contentId: `addsub:${left}`, skillId: 'link:addsub', explain: `${left} = ${value}` };
    }));
    const sums = value => { const all = labelsFor(value, 'addsub').filter(l => l.includes('+')); return all[Math.floor(take(random) * all.length)]; };
    const differences = value => { const all = labelsFor(value, 'addsub').filter(l => l.includes('−')); return all[Math.floor(take(random) * all.length)]; };
    return Object.freeze([round('plus', 'たし算と答え', values.slice(0, LINK_PAIRS), sums),
      round('minus', 'ひき算と答え', shuffled(values, random).slice(0, LINK_PAIRS), differences)]);
  }
  if (mode === 'english') {
    const picked = [];
    for (const entry of shuffled(words, random)) {
      if (picked.length >= LINK_PAIRS * 2) break;
      if (picked.some(item => item.prompt === entry.prompt || item.meaning === entry.meaning)) continue;
      picked.push(entry);
    }
    if (picked.length < LINK_PAIRS * 2) return null;
    const round = (kind, items) => board(kind, '英単語と意味', items.map(item => ({ left: item.prompt, right: item.meaning, contentId: item.id,
      skillId: 'english.basicVocabulary.meaning', explain: `${item.prompt} ＝ ${item.meaning}`, speak: item.prompt })));
    return Object.freeze([round('words1', picked.slice(0, LINK_PAIRS)), round('words2', picked.slice(LINK_PAIRS))]);
  }
  const rounds = buildMemoryRounds({ random, stageKanji, gradeKanji, focusKanjiIds });
  if (!rounds) return null;
  return Object.freeze(rounds.map(round => board(round.kind, round.kind === 'reading' ? '漢字と読み' : '漢字と意味', round.pairs.slice(0, LINK_PAIRS).map(pair => ({
    left: pair.kanji, right: pair.text, contentId: `${round.kind}:${pair.kanjiId}`, skillId: `kanji.${round.kind}`, kanjiId: pair.kanjiId,
    sentence: pair.sentence ? Object.freeze({ before: pair.sentence.before, kanji: pair.kanji, after: pair.sentence.after }) : null,
    explain: round.kind === 'reading' ? `「${pair.kanji}」は「${pair.text}」${pair.sentence ? `（${pair.sentence.before}${pair.kanji}${pair.sentence.after}）` : ''}` : `「${pair.kanji}」は「${pair.text}」という意味` })))));
}
