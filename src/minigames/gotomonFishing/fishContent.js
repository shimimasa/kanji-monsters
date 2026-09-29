import { ENGLISH_CHOICE_FIXTURE } from '../englishChoice/englishChoiceQuestions.js';
import { englishCategory } from '../englishChoice/englishContent.js';

export const FISH_PROBLEMS = 12;
export const FISH_SWIMMERS = 4;

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

// Twelve words from the English vocabulary of 宝箱キャッチ. Problems take turns:
// 英語→日本語 (the word is shown and read aloud; the Gotomon carry meanings), then
// 日本語→英語 (the meaning is shown; they carry words). Each problem has four plates:
// the answer, two from the same topic and one from another, like 宝箱キャッチ.
export function buildFishProblems({ sessionId, random = Math.random, words = ENGLISH_CHOICE_FIXTURE }) {
  const picked = shuffled(words, random).slice(0, FISH_PROBLEMS);
  if (picked.length < FISH_PROBLEMS) return null;
  return Object.freeze(picked.map((entry, index) => {
    const kind = index % 2 === 0 ? 'en2ja' : 'ja2en';
    const others = words.filter(item => item.id !== entry.id && item.meaning !== entry.meaning);
    const topic = englishCategory(entry.prompt);
    const related = shuffled(others.filter(item => englishCategory(item.prompt) === topic), random).slice(0, 2);
    const outside = shuffled(others.filter(item => englishCategory(item.prompt) !== topic), random).slice(0, FISH_SWIMMERS - 1 - related.length);
    const plates = shuffled([entry, ...related, ...outside], random).map(item => Object.freeze({
      contentId: item.id, word: item.prompt, meaning: item.meaning, text: kind === 'en2ja' ? item.meaning : item.prompt }));
    return Object.freeze({ problemId: `${sessionId}:fish:${index + 1}:${entry.id}`, contentId: entry.id, kind,
      word: entry.prompt, meaning: entry.meaning, prompt: kind === 'en2ja' ? entry.prompt : entry.meaning,
      plates: Object.freeze(plates), skillId: kind === 'en2ja' ? 'english.basicVocabulary.meaning' : 'english.basicVocabulary.word' });
  }));
}
