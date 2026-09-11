import { generateSentenceOrderQuestions } from './sentenceOrderQuestions.js';

// Nonpersistent Core: no DOM, Storage, save, Motion, or scheduler dependencies.
export function createSentenceOrderGame({ sessionId, random = Math.random, onEvent = () => {} }) {
  const questions = generateSentenceOrderQuestions({ sessionId, random });
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', index = -1, attemptId = null, seq = 0, activeElapsedMs = 0;
  let answered = 0, correct = 0, incorrect = 0, result = null, lastAnswer = null, aborted = false;
  let currentOrder = Object.freeze([]), completeEmitted = false;

  const currentProblem = () => questions[index] ?? null;
  const snapshot = () => Object.freeze({
    gameId: 'sentenceOrder', mode: 'tenQuestions', sessionId, phase, paused, active, aborted,
    problem: currentProblem(), attemptId, currentOrder, seq, activeElapsedMs,
    answered, correct, incorrect, result, lastAnswer,
  });
  const notify = (type, payload = {}) => {
    const event = Object.freeze({
      version: 1, gameId: 'sentenceOrder', sessionId, seq: ++seq, type,
      problemId: currentProblem()?.problemId ?? null, activeElapsedMs,
      payload: Object.freeze(payload),
    });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation observers cannot undo committed learning state. */ }
    finally { notifying = false; }
  };
  const presentProblem = () => {
    index++;
    const problem = currentProblem();
    attemptId = `${sessionId}:sentence-attempt:${index + 1}`;
    currentOrder = Object.freeze([...problem.initialOrder]);
    phase = 'answering'; lastAnswer = null;
    notify('problemPresented', {
      skillId: problem.skillId,
      chunkIds: Object.freeze(problem.chunks.map(chunk => chunk.chunkId)),
    });
  };
  const complete = () => {
    if (completeEmitted || !result) return;
    completeEmitted = true;
    notify('sessionComplete', result);
  };
  const matchesIdentity = identity => {
    if (!identity || typeof identity !== 'object') return false;
    const { sessionId: sourceSession, problemId, attemptId: sourceAttempt } = identity;
    return active && !paused && !notifying && phase === 'answering' && !!attemptId &&
      sourceSession === sessionId && problemId === currentProblem()?.problemId && sourceAttempt === attemptId;
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
    reorder(payload = {}) {
      if (!payload || typeof payload !== 'object') return false;
      const { chunkId, direction, ...identity } = payload;
      if (!matchesIdentity(identity) || (direction !== 'left' && direction !== 'right')) return false;
      const from = currentOrder.indexOf(chunkId);
      const to = from + (direction === 'left' ? -1 : 1);
      if (from < 0 || to < 0 || to >= currentOrder.length) return false;
      const nextOrder = [...currentOrder];
      [nextOrder[from], nextOrder[to]] = [nextOrder[to], nextOrder[from]];
      currentOrder = Object.freeze(nextOrder);
      return true;
    },
    submit(identity = {}) {
      const problem = currentProblem();
      if (!matchesIdentity(identity)) return false;
      if (currentOrder.length !== problem.correctOrder.length ||
          new Set(currentOrder).size !== problem.correctOrder.length ||
          currentOrder.some(chunkId => !problem.correctOrder.includes(chunkId))) return false;

      const committedAttempt = attemptId;
      attemptId = null; // Consume exactly once before score and observer notification.
      const submittedOrder = Object.freeze([...currentOrder]);
      const isCorrect = submittedOrder.every((chunkId, orderIndex) => chunkId === problem.correctOrder[orderIndex]);
      answered++;
      if (isCorrect) correct++;
      else incorrect++;
      lastAnswer = Object.freeze({
        attemptId: committedAttempt,
        submittedOrder,
        correctOrder: problem.correctOrder,
        correct: isCorrect,
      });
      phase = answered === 10 ? 'completed' : 'feedback';
      if (phase === 'completed') result = Object.freeze({ answered, correct, incorrect, accuracy: correct / 10 });
      notify(isCorrect ? 'correct' : 'incorrect', {
        attemptId: committedAttempt,
        skillId: problem.skillId,
        submittedOrder,
        correctOrder: problem.correctOrder,
      });
      if (result) complete();
      return true;
    },
    next(payload = {}) {
      if (!payload || typeof payload !== 'object') return false;
      const { sessionId: sourceSession, problemId } = payload;
      if (!active || paused || notifying || phase !== 'feedback' || sourceSession !== sessionId ||
          problemId !== currentProblem()?.problemId) return false;
      presentProblem(); return true;
    },
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      if (command.type === 'reorder') return this.reorder(command.payload);
      if (command.type === 'submit') return this.submit(command.payload);
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
