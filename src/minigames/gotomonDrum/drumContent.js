import { buildSlashProblems } from '../gotomonSlash/slashContent.js';
import { buildTarget } from '../buildReview.js';

export const DRUM_MODES = Object.freeze(['kanji', 'english', 'math']);

function take(random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('random must be in [0, 1)');
  return value;
}

// Twelve そう？ちがう？ questions from the slash game's problems: each shows one plate
// with the question, and about half show the answer. ドン says そう, カッ says ちがう.
const ask = (item, text) => item.kind === 'math' ? `${item.prompt.replace(/\s*=\s*\?$/, '')} = ${text}`
  : item.kind === 'kanji' ? `${item.prompt.replace(/？$/, '')}「${text}」` : item.kind === 'ja2en' ? `${item.prompt.replace(/？$/, '')} ${text}`
  : `${item.prompt.replace(/？$/, '')}「${text}」`;

export function buildDrumQuestions({ sessionId, random = Math.random, mode = 'kanji', stageKanji = [], gradeKanji = [], focusKanjiIds = [] }) {
  const problems = buildSlashProblems({ sessionId, random, mode, stageKanji, gradeKanji, focusKanjiIds });
  if (!problems) return null;
  // Exactly half are true, in a shuffled order, so neither drum is always right.
  const truths = problems.map((_, i) => i % 2 === 0);
  for (let i = truths.length - 1; i > 0; i--) { const j = Math.floor(take(random) * (i + 1)); [truths[i], truths[j]] = [truths[j], truths[i]]; }
  return Object.freeze(problems.map((item, i) => {
    const answer = item.plates.find(plate => plate.plateId === item.answerId);
    const others = item.plates.filter(plate => plate !== answer);
    const shown = truths[i] ? answer : others[Math.floor(take(random) * others.length)];
    return Object.freeze({ problemId: item.problemId, contentId: item.contentId, skillId: item.skillId, kind: item.kind,
      statement: `${ask(item, shown.text)}？`, sentence: item.sentence ?? null, truth: truths[i], shown: shown.text,
      shownNote: truths[i] ? null : shown.note, answer: answer.text, explain: item.explain, build: buildTarget(item) });
  }));
}
