import { generateEnglishChoiceQuestions } from './englishChoiceQuestions.js';

// Nonpersistent Core: no DOM, Storage, save, Motion, or scheduler dependencies.
export function createEnglishChoiceGame({ sessionId, random = Math.random, onEvent = () => {} }) {
  const questions = generateEnglishChoiceQuestions({ sessionId, random });
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', index = -1, attemptId = null, seq = 0, activeElapsedMs = 0;
  let answered = 0, correct = 0, incorrect = 0, result = null, lastAnswer = null, aborted = false;
  let completeEmitted = false;

  const currentProblem = () => questions[index] ?? null;
  const snapshot = () => Object.freeze({
    gameId: 'englishChoice', mode: 'tenQuestions', sessionId, phase, paused, active, aborted,
    problem: currentProblem(), attemptId, seq, activeElapsedMs,
    answered, correct, incorrect, result, lastAnswer,
  });
  const notify = (type, payload = {}) => {
    const event = Object.freeze({
      version: 1, gameId: 'englishChoice', sessionId, seq: ++seq, type,
      problemId: currentProblem()?.problemId ?? null, activeElapsedMs,
      payload: Object.freeze(payload),
    });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation observers cannot undo a committed answer. */ }
    finally { notifying = false; }
  };
  const presentProblem = () => {
    index++;
    const problem = currentProblem();
    attemptId = `${sessionId}:english-attempt:${index + 1}`;
    phase = 'answering'; lastAnswer = null;
    notify('problemPresented', {
      skillId: problem.skillId,
      choiceIds: Object.freeze(problem.choices.map(choice => choice.choiceId)),
    });
  };
  const complete = () => {
    if (completeEmitted || !result) return;
    completeEmitted = true;
    notify('sessionComplete', result);
  };

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying) return false;
      presentProblem(); return true;
    },
    update(dtMs) {
      if (active && !paused && phase !== 'ready' && phase !== 'completed' && Number.isFinite(dtMs)) {
        activeElapsedMs += Math.max(0, dtMs);
      }
    },
    setPaused(value) { if (active) paused = !!value; },
    answer({ sessionId: sourceSession, problemId, attemptId: sourceAttempt, choiceId } = {}) {
      const problem = currentProblem();
      if (!active || paused || notifying || phase !== 'answering' || !attemptId ||
          sourceSession !== sessionId || problemId !== problem?.problemId || sourceAttempt !== attemptId) return false;
      const choice = problem.choices.find(candidate => candidate.choiceId === choiceId);
      if (!choice) return false;

      const committedAttempt = attemptId;
      attemptId = null; // Consume identity before counters and observer notification.
      const isCorrect = choiceId === problem.correctChoiceId;
      answered++;
      if (isCorrect) correct++;
      else incorrect++;
      lastAnswer = Object.freeze({
        attemptId: committedAttempt, choiceId, correctChoiceId: problem.correctChoiceId, correct: isCorrect,
      });
      phase = answered === 10 ? 'completed' : 'feedback';
      if (phase === 'completed') result = Object.freeze({ answered, correct, incorrect, accuracy: correct / 10 });
      notify(isCorrect ? 'correct' : 'incorrect', {
        attemptId: committedAttempt, choiceId, correctChoiceId: problem.correctChoiceId,
        skillId: problem.skillId,
      });
      if (result) complete();
      return true;
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
