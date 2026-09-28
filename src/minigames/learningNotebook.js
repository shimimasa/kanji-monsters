import { ENGLISH_CHOICE_FIXTURE } from './englishChoice/englishChoiceQuestions.js';
import { TIMED_CHOICE_FIXTURE } from './timedChoice/timedChoiceQuestions.js';
import { SENTENCE_ORDER_FIXTURE, SENTENCE_CHALLENGE_FIXTURE } from './sentenceOrder/sentenceOrderQuestions.js';

export const learningBanks = [
  { gameId: 'englishChoice', title: '英単語', unit: '語', entries: ENGLISH_CHOICE_FIXTURE.map(e => ({ id: e.id, text: e.prompt, answer: e.meaning })) },
  { gameId: 'timedChoice', title: 'タイムことば', unit: '語', entries: TIMED_CHOICE_FIXTURE.map(e => ({ id: e.fixtureId, text: e.word, answer: e.reading })) },
  { gameId: 'sentenceOrder', title: '文ならべ', unit: '文', entries: [...SENTENCE_ORDER_FIXTURE, ...SENTENCE_CHALLENGE_FIXTURE].map(e => ({
    id: e.fixtureId, text: e.chunks.map(c => c.text).join(''), answer: `${e.chunks.length}ピース`,
  })) },
];

// Count known content, not answer attempts. Latest correctness is not a mastery estimate.
export function summarizeLearning(bank, history = {}) {
  const attempted = bank.entries.filter(e => typeof history[e.id]?.lastCorrect === 'boolean').map(e => ({ ...e,
    lastCorrect: history[e.id].lastCorrect,
    lastAnsweredAt: Number.isSafeInteger(history[e.id].lastAnsweredAt) ? history[e.id].lastAnsweredAt : 0,
    timedOut: history[e.id].lastReason === 'timeout',
  }));
  attempted.sort((a, b) => b.lastAnsweredAt - a.lastAnsweredAt || a.id.localeCompare(b.id));
  const pending = attempted.filter(e => !e.lastCorrect), correct = attempted.filter(e => e.lastCorrect);
  return { total: bank.entries.length, attempted: attempted.length, unseen: bank.entries.length - attempted.length, pending, correct };
}

const normalizeSearch = value => String(value).normalize('NFKC').toLowerCase()
  .replace(/[ァ-ヶ]/g, character => String.fromCharCode(character.charCodeAt(0) - 0x60));

// Match literal text only; each space-separated term must appear in the item.
export function filterLearningEntries(entries, query = '') {
  const terms = normalizeSearch(query).trim().split(/\s+/).filter(Boolean);
  return entries.filter(entry => {
    const text = normalizeSearch(`${entry.text} ${entry.answer}`);
    return terms.every(term => text.includes(term));
  });
}

export function searchPracticeIds(summary, query) {
  if (!query?.trim()) return [];
  const pending = filterLearningEntries(summary.pending, query);
  // Rechecking older correct answers first lets later batches reach other items.
  const correct = filterLearningEntries(summary.correct, query)
    .sort((a, b) => a.lastAnsweredAt - b.lastAnsweredAt || a.id.localeCompare(b.id));
  return [...pending, ...correct].slice(0, 10).map(entry => entry.id);
}

// Navigation state lives only in memory; learning records are reread on return.
export function notebookContext(value) {
  if (!value || !learningBanks.some(bank => bank.gameId === value.gameId)) return null;
  return Object.freeze({ gameId: value.gameId, query: typeof value.query === 'string' ? value.query.slice(0, 100) : '',
    correctOpen: value.correctOpen === true });
}
