import { gameState, recordKanjiAnswer, releaseRecordedQuestion } from './gameState.js';
import ReviewQueue from '../models/reviewQueue.js';

function clone(value) {
  if (value instanceof Set) return new Set([...value]);
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
  return value;
}

function restoreProperty(target, key, existed, value) {
  if (existed) target[key] = value;
  else delete target[key];
}

export function getReviewQuality({ isCorrect, hintLevel = 0, answerRevealed = false }) {
  if (!isCorrect || answerRevealed || Number(hintLevel) >= 4) return 1;
  if (Number(hintLevel) === 0) return 5;
  if (Number(hintLevel) === 1) return 4;
  return 3;
}

export function isIndependentOutcome({ isCorrect, hintLevel = 0, answerRevealed = false }) {
  return !!isCorrect && !answerRevealed && Number(hintLevel) === 0;
}

/** 学習記録と復習予定を同じ保存候補へ入れ、失敗時はメモリ側も元へ戻す。 */
export function commitLearningOutcome(kanjiId, isCorrect, context = {}) {
  const key = String(kanjiId);
  const answerRootExisted = Object.prototype.hasOwnProperty.call(gameState, 'kanjiAnswerStats');
  const progressRootExisted = Object.prototype.hasOwnProperty.call(gameState, 'kanjiReadProgress');
  const dailyRootExisted = Object.prototype.hasOwnProperty.call(gameState, 'dailyAnswerStats');
  const answerExisted = !!gameState.kanjiAnswerStats && Object.prototype.hasOwnProperty.call(gameState.kanjiAnswerStats, key);
  const progressExisted = !!gameState.kanjiReadProgress && Object.prototype.hasOwnProperty.call(gameState.kanjiReadProgress, key);
  const beforeAnswer = clone(gameState.kanjiAnswerStats?.[key]);
  const beforeProgress = clone(gameState.kanjiReadProgress?.[key]);
  const beforeDaily = clone(gameState.dailyAnswerStats);
  const beforeCorrect = gameState.playerStats.totalCorrect;
  const beforeIncorrect = gameState.playerStats.totalIncorrect;
  const recordContext = { ...context, deferSave: true };
  if (!recordKanjiAnswer(kanjiId, isCorrect, recordContext)) {
    return { ok: false, reason: 'duplicate' };
  }
  const quality = getReviewQuality({ isCorrect, ...context });
  const result = ReviewQueue.applyOutcome(kanjiId, { isCorrect, quality });
  if (result?.ok) return { ok: true, quality, independent: isIndependentOutcome({ isCorrect, ...context }) };

  if (answerRootExisted) restoreProperty(gameState.kanjiAnswerStats, key, answerExisted, beforeAnswer);
  else delete gameState.kanjiAnswerStats;
  if (progressRootExisted) restoreProperty(gameState.kanjiReadProgress, key, progressExisted, beforeProgress);
  else delete gameState.kanjiReadProgress;
  if (dailyRootExisted) gameState.dailyAnswerStats = beforeDaily;
  else delete gameState.dailyAnswerStats;
  gameState.playerStats.totalCorrect = beforeCorrect;
  gameState.playerStats.totalIncorrect = beforeIncorrect;
  releaseRecordedQuestion(context.question);
  return { ok: false, reason: 'save', error: result?.error };
}
