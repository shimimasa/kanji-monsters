import { buildShooterWaves } from '../gotomonShooter/shooterContent.js';
import { buildFishProblems } from '../gotomonFishing/fishContent.js';
import { buildTossProblems } from '../gotomonToss/tossContent.js';

export const SLASH_MODES = Object.freeze(['kanji', 'english', 'math']);
export const SLASH_PLATES = 4;

// Twelve problems of four plates in one shape, from the builders of other games:
// 漢字の読み (ゴトモン・シューター: only the answer's plate reads the kanji right),
// 英語 (ゴトモンつり: 英語→日本語 and 日本語→英語), 算数 (ゴトモン玉入れ: likely slips).
export function buildSlashProblems({ sessionId, random = Math.random, mode = 'kanji', stageKanji = [], gradeKanji = [], focusKanjiIds = [] }) {
  if (mode === 'math') {
    return Object.freeze(buildTossProblems({ sessionId, random }).map(item => Object.freeze({
      problemId: item.problemId, contentId: item.problemId, skillId: item.skillId, kind: 'math',
      prompt: `${item.question} = ?`, answerId: String(item.answer),
      plates: Object.freeze(item.numbers.map(n => Object.freeze({ plateId: String(n), text: String(n), note: null }))),
      explain: `${item.question} = ${item.answer}` })));
  }
  const waves = mode === 'english' ? buildFishProblems({ sessionId, random })
    : buildShooterWaves({ sessionId, random, mode: 'kanji', stageKanji, gradeKanji, focusKanjiIds });
  if (!waves) return null;
  return Object.freeze(waves.map(item => Object.freeze({
    problemId: item.problemId, contentId: item.contentId, skillId: item.skillId, kind: item.kind,
    prompt: item.kind === 'ja2en' ? `「${item.meaning}」は英語で？` : item.kind === 'en2ja' ? `${item.word} の意味は？` : `「${item.prompt}」の読みは？`,
    sentence: item.sentence ?? null, word: item.word, answerId: item.contentId,
    plates: Object.freeze(item.plates.map(plate => Object.freeze({ plateId: plate.contentId, text: plate.text,
      note: item.kind === 'kanji' ? `${plate.word}の読み` : `${plate.word} ＝ ${plate.meaning}` }))),
    explain: item.kind === 'kanji' ? `「${item.prompt}」は「${item.meaning}」` : `${item.word} ＝ ${item.meaning}` })));
}
