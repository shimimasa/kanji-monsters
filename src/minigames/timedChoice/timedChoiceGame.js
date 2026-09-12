import { generateTimedChoiceQuestions } from './timedChoiceQuestions.js';

export const TIMED_CHOICE_DEFAULT_DEADLINE_MS = 5000;

// Nonpersistent Core: time advances only through update(dtMs).
export function createTimedChoiceGame({ sessionId, random = Math.random, onEvent = () => {},
  deadlineMs = TIMED_CHOICE_DEFAULT_DEADLINE_MS } = {}) {
  if (!Number.isFinite(deadlineMs) || deadlineMs <= 0) throw new TypeError('deadlineMs must be positive and finite');
  const questions = generateTimedChoiceQuestions({ sessionId, random });
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', index = -1, attemptId = null, seq = 0, activeElapsedMs = 0;
  let problemElapsedMs = 0, answered = 0, correct = 0, incorrect = 0, timedOut = 0;
  let result = null, lastAnswer = null, aborted = false, completeEmitted = false;

  const currentProblem = () => questions[index] ?? null;
  const remainingMs = () => Math.max(0, deadlineMs - problemElapsedMs);
  const snapshot = () => Object.freeze({
    gameId: 'timedChoice', mode: 'deadlineProbe', sessionId, phase, paused, active, aborted,
    problem: currentProblem(), attemptId, seq, activeElapsedMs,
    problemElapsedMs, remainingMs: remainingMs(), deadlineMs,
    answered, correct, incorrect, timedOut, result, lastAnswer,
  });
  const notify = (type, payload = {}) => {
    const event = Object.freeze({
      version: 1, gameId: 'timedChoice', sessionId, seq: ++seq, type,
      problemId: currentProblem()?.problemId ?? null, activeElapsedMs,
      payload: Object.freeze(payload),
    });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Observer failure cannot undo a committed completion. */ }
    finally { notifying = false; }
  };
  const presentProblem = () => {
    index++;
    const problem = currentProblem();
    attemptId = `${sessionId}:timed-attempt:${index + 1}`;
    problemElapsedMs = 0; phase = 'answering'; lastAnswer = null;
    notify('problemPresented', {
      skillId: problem.skillId,
      choiceIds: Object.freeze(problem.choices.map(choice => choice.choiceId)),
      deadlineMs,
    });
  };
  const emitComplete = () => {
    if (completeEmitted || !result) return;
    completeEmitted = true; notify('sessionComplete', result);
  };
  const consumeAttempt = ({ choiceId = null, reason }) => {
    const problem = currentProblem();
    if (!active || paused || notifying || phase !== 'answering' || !attemptId || !problem) return false;
    const choice = reason === 'answer'
      ? problem.choices.find(candidate => candidate.choiceId === choiceId) : null;
    if ((reason === 'answer' && !choice) || (reason !== 'answer' && reason !== 'timeout')) return false;

    const committedAttempt = attemptId;
    attemptId = null; // The first answer/update completion consumes the attempt.
    const isCorrect = reason === 'answer' && choiceId === problem.correctChoiceId;
    answered++;
    if (isCorrect) correct++;
    else incorrect++;
    if (reason === 'timeout') timedOut++;
    lastAnswer = Object.freeze({
      attemptId: committedAttempt, choiceId, correctChoiceId: problem.correctChoiceId,
      correct: isCorrect, reason,
    });
    phase = answered === 10 ? 'completed' : 'feedback';
    if (phase === 'completed') {
      result = Object.freeze({ answered, correct, incorrect, accuracy: correct / 10, timedOut });
    }
    notify(isCorrect ? 'correct' : 'incorrect', {
      attemptId: committedAttempt, choiceId, correctChoiceId: problem.correctChoiceId,
      skillId: problem.skillId, reason, problemElapsedMs, deadlineMs,
    });
    if (result) emitComplete();
    return true;
  };

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying) return false;
      presentProblem(); return true;
    },
    update(dtMs) {
      if (!active || paused || phase === 'ready' || phase === 'completed' || !Number.isFinite(dtMs)) return;
      const dt = Math.max(0, dtMs);
      activeElapsedMs += dt;
      if (phase !== 'answering' || !attemptId || dt === 0) return;
      problemElapsedMs = Math.min(deadlineMs, problemElapsedMs + dt);
      if (problemElapsedMs >= deadlineMs) consumeAttempt({ reason: 'timeout' });
    },
    setPaused(value) { if (active) paused = !!value; },
    answer({ sessionId: sourceSession, problemId, attemptId: sourceAttempt, choiceId } = {}) {
      const problem = currentProblem();
      if (!active || paused || notifying || phase !== 'answering' || !attemptId ||
          sourceSession !== sessionId || problemId !== problem?.problemId || sourceAttempt !== attemptId) return false;
      return consumeAttempt({ choiceId, reason: 'answer' });
    },
    next({ sessionId: sourceSession, problemId } = {}) {
      if (!active || paused || notifying || phase !== 'feedback' || sourceSession !== sessionId ||
          problemId !== currentProblem()?.problemId) return false;
      presentProblem(); return true;
    },
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      if (command.type === 'answer') return this.answer(command.payload);
      if (command.type === 'next') return this.next(command.payload);
      return false;
    },
    snapshot,
    exit() {
      if (!active) return;
      active = false; attemptId = null; aborted = phase !== 'completed'; observer = null;
    },
  };
}
