import { readingTarget } from '../buildReview.js';

// Nonpersistent Core: no DOM, Storage, save, Motion, or scheduler dependencies.
// The rally content (stage, kanji and monsters) is built by the caller and passed in.
export function createPhotoRallyGame({ sessionId, onEvent = () => {}, content }) {
  const shots = content?.shots ?? [];
  const stage = content?.stage ?? null;
  const total = shots.length;
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', index = -1, attemptId = null, seq = 0, activeElapsedMs = 0;
  let answered = 0, correct = 0, incorrect = 0, result = null, lastAnswer = null, aborted = false, completeEmitted = false;
  const missed = [];

  const currentProblem = () => shots[index] ?? null;
  const snapshot = () => Object.freeze({
    gameId: 'photoRally', mode: 'rally', stage, totalQuestions: total, sessionId, phase, paused, active, aborted,
    problem: currentProblem(), attemptId, seq, activeElapsedMs,
    answered, correct, incorrect, result, lastAnswer, missed: Object.freeze([...missed]),
  });
  const notify = (type, payload = {}) => {
    const event = Object.freeze({ version: 1, gameId: 'photoRally', sessionId, seq: ++seq, type,
      problemId: currentProblem()?.problemId ?? null, activeElapsedMs, payload: Object.freeze(payload) });
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
    attemptId = `${sessionId}:photo-attempt:${index + 1}`;
    phase = 'answering'; lastAnswer = null;
    notify('problemPresented', { skillId: problem.skillId, monsterId: problem.monsterId,
      choiceIds: Object.freeze(problem.choices.map(choice => choice.choiceId)) });
  };

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying || !total) return false;
      presentProblem(); return true;
    },
    update(dtMs) {
      if (active && !paused && phase !== 'ready' && phase !== 'completed' && Number.isFinite(dtMs)) activeElapsedMs += Math.max(0, dtMs);
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
      else {
        incorrect++;
        missed.push(Object.freeze({ contentId: problem.contentId, kanji: problem.kanji, reading: problem.reading,
          selectedAnswer: choice.text, chosen: choice.text, questionNumber: answered,
          build: readingTarget({ word: problem.kanji, reading: problem.reading, sentence: problem, others: problem.choices.filter(c => c.choiceId !== problem.correctChoiceId).map(c => c.text) }) }));
      }
      lastAnswer = Object.freeze({ attemptId: committedAttempt, choiceId, correctChoiceId: problem.correctChoiceId, correct: isCorrect });
      phase = answered === total ? 'completed' : 'feedback';
      if (phase === 'completed') result = Object.freeze({ answered, correct, incorrect, accuracy: correct / total });
      notify(isCorrect ? 'correct' : 'incorrect', { attemptId: committedAttempt, choiceId, correctChoiceId: problem.correctChoiceId,
        contentId: problem.contentId, skillId: problem.skillId, monsterId: problem.monsterId });
      if (result && !completeEmitted) { completeEmitted = true; notify('sessionComplete', result); }
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
