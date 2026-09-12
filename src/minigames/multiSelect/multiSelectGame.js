import { generateMultiSelectQuestions } from './multiSelectQuestions.js';

export function scoreMultiSelect({ selectedChoiceIds, correctChoiceIds, choiceIds }) {
  const selected = new Set(selectedChoiceIds ?? []), correct = new Set(correctChoiceIds ?? []), choices = new Set(choiceIds ?? []);
  if (!correct.size || choices.size <= correct.size || [...correct].some(id => !choices.has(id)) ||
      [...selected].some(id => !choices.has(id))) throw new TypeError('valid choice identity sets are required');
  const truePositive = [...selected].filter(id => correct.has(id)).length;
  const falsePositive = [...selected].filter(id => !correct.has(id)).length;
  const totalWrong = choices.size - correct.size;
  const maxPoints = correct.size * totalWrong;
  const earnedPoints = Math.max(0, truePositive * totalWrong - falsePositive * correct.size);
  const score = earnedPoints / maxPoints;
  const classification = score === 1 ? 'fullCorrect' : score > 0 ? 'partial' : 'incorrect';
  return Object.freeze({ truePositive, falsePositive, totalCorrect: correct.size, totalWrong,
    earnedPoints, maxPoints, score, classification });
}

// Nonpersistent Core. Selection, scoring, and completion identity stay game-local.
export function createMultiSelectGame({ sessionId, random = Math.random, onEvent = () => {} } = {}) {
  const questions = generateMultiSelectQuestions({ sessionId, random });
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', index = -1, attemptId = null, seq = 0, activeElapsedMs = 0;
  let selected = new Set(), answered = 0, fullCorrect = 0, partial = 0, incorrect = 0;
  let totalPoints = 0, maxPoints = 0, result = null, lastAnswer = null, aborted = false, completeEmitted = false;

  const currentProblem = () => questions[index] ?? null;
  const orderedSelected = problem => Object.freeze(problem.choices.filter(choice => selected.has(choice.choiceId)).map(choice => choice.choiceId));
  const snapshot = () => Object.freeze({
    gameId: 'multiSelect', mode: 'partialCreditProbe', sessionId, phase, paused, active, aborted,
    problem: currentProblem(), attemptId, selectedChoiceIds: currentProblem() ? orderedSelected(currentProblem()) : Object.freeze([]),
    seq, activeElapsedMs, answered, fullCorrect, partial, incorrect, totalPoints, maxPoints, result, lastAnswer,
  });
  const notify = (type, payload = {}) => {
    const event = Object.freeze({ version: 1, gameId: 'multiSelect', sessionId, seq: ++seq, type,
      problemId: currentProblem()?.problemId ?? null, activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Observer failure cannot undo committed scoring. */ }
    finally { notifying = false; }
  };
  const presentProblem = () => {
    index++; selected = new Set(); lastAnswer = null;
    attemptId = `${sessionId}:multi-select-attempt:${index + 1}`; phase = 'answering';
    const problem = currentProblem();
    notify('problemPresented', { skillId: problem.skillId,
      choiceIds: Object.freeze(problem.choices.map(choice => choice.choiceId)) });
  };
  const identityMatches = ({ sessionId: sourceSession, problemId, attemptId: sourceAttempt } = {}) =>
    active && !paused && !notifying && phase === 'answering' && attemptId && sourceSession === sessionId &&
    problemId === currentProblem()?.problemId && sourceAttempt === attemptId;
  const emitComplete = () => {
    if (completeEmitted || !result) return;
    completeEmitted = true; notify('sessionComplete', result);
  };

  return {
    enter() { if (!active || phase !== 'ready' || notifying) return false; presentProblem(); return true; },
    update(dtMs) {
      if (!active || paused || phase === 'ready' || phase === 'completed' || !Number.isFinite(dtMs)) return;
      activeElapsedMs += Math.max(0, dtMs);
    },
    setPaused(value) { if (active) paused = !!value; },
    toggle(payload = {}) {
      if (!identityMatches(payload)) return false;
      const problem = currentProblem();
      if (!problem.choices.some(choice => choice.choiceId === payload.choiceId)) return false;
      if (selected.has(payload.choiceId)) selected.delete(payload.choiceId); else selected.add(payload.choiceId);
      return true;
    },
    submit(payload = {}) {
      if (!identityMatches(payload)) return false;
      const problem = currentProblem(), committedAttempt = attemptId;
      const selectedChoiceIds = orderedSelected(problem);
      const grading = scoreMultiSelect({ selectedChoiceIds, correctChoiceIds: problem.correctChoiceIds,
        choiceIds: problem.choices.map(choice => choice.choiceId) });
      attemptId = null; // Submit is the only operation that consumes this attempt.
      answered++; totalPoints += grading.earnedPoints; maxPoints += grading.maxPoints;
      if (grading.classification === 'fullCorrect') fullCorrect++;
      else if (grading.classification === 'partial') partial++;
      else incorrect++;
      lastAnswer = Object.freeze({ attemptId: committedAttempt, selectedChoiceIds,
        correctChoiceIds: problem.correctChoiceIds, ...grading });
      phase = answered === 10 ? 'completed' : 'feedback';
      if (phase === 'completed') result = Object.freeze({ answered, fullCorrect, partial, incorrect,
        totalPoints, maxPoints, scoreRate: maxPoints ? totalPoints / maxPoints : 0,
        fullCorrectRate: fullCorrect / 10 });
      notify(grading.classification === 'fullCorrect' ? 'correct' : 'incorrect', {
        attemptId: committedAttempt, skillId: problem.skillId, selectedChoiceIds,
        correctChoiceIds: problem.correctChoiceIds, score: grading.score,
        earnedPoints: grading.earnedPoints, maxPoints: grading.maxPoints,
        classification: grading.classification,
      });
      if (result) emitComplete();
      return true;
    },
    next({ sessionId: sourceSession, problemId } = {}) {
      if (!active || paused || notifying || phase !== 'feedback' || sourceSession !== sessionId ||
          problemId !== currentProblem()?.problemId) return false;
      presentProblem(); return true;
    },
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      if (command.type === 'toggle') return this.toggle(command.payload);
      if (command.type === 'submit') return this.submit(command.payload);
      if (command.type === 'next') return this.next(command.payload);
      return false;
    },
    snapshot,
    exit() { if (!active) return; active = false; attemptId = null; selected = new Set(); aborted = phase !== 'completed'; observer = null; },
  };
}
