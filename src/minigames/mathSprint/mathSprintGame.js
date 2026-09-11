import { generateSessionProblems } from './mathSprintGenerator.js';

export function normalizeMathAnswer(raw) {
  const text = String(raw ?? '').replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).trim();
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  return Number.isSafeInteger(value) ? value : null;
}

// Nonpersistent Core: no gameState, Storage, DOM, Motion or scheduler dependencies.
export function createMathSprintGame({ sessionId, random = Math.random, onEvent = () => {} }) {
  const problems = generateSessionProblems({ sessionId, random });
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', index = -1, token = null, seq = 0, activeElapsedMs = 0;
  let answered = 0, correct = 0, incorrect = 0, streak = 0, maxStreak = 0;
  let result = null, lastAnswer = null, aborted = false;
  const snapshot = () => Object.freeze({ gameId: 'mathSprint', mode: 'tenQuestions', sessionId, phase, paused, active, aborted,
    problem: problems[index] ?? null, token, seq, activeElapsedMs,
    answered, correct, incorrect, streak, maxStreak, result, lastAnswer });
  const notify = (type, payload = {}) => {
    const event = Object.freeze({ version: 1, gameId: 'mathSprint', sessionId, seq: ++seq, type,
      problemId: problems[index]?.problemId ?? null,
      activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      // Observer completion/return values never participate in the Core transition.
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation failure cannot undo a committed answer. */ }
    finally { notifying = false; }
  };
  const presentProblem = () => {
    index++;
    token = `${sessionId}:token:${index + 1}`;
    phase = 'answering'; lastAnswer = null;
    notify('problemPresented', { operation: problems[index].operation, skillId: problems[index].skillId });
  };
  return {
    enter() { if (active && phase === 'ready' && !notifying) presentProblem(); },
    update(dtMs) {
      if (active && !paused && phase !== 'ready' && phase !== 'completed' && Number.isFinite(dtMs)) {
        activeElapsedMs += Math.max(0, dtMs);
      }
    },
    setPaused(value) { if (active) paused = !!value; },
    submit({ sessionId: sourceSession, token: sourceToken, value }) {
      if (!active || paused || notifying || phase !== 'answering' || !token ||
          sourceSession !== sessionId || sourceToken !== token) return false;
      const normalized = normalizeMathAnswer(value);
      if (normalized === null) return false;
      const attemptId = token;
      token = null; // Consume first, before counters and before any observer can run.
      const isCorrect = normalized === problems[index].answer;
      answered++;
      if (isCorrect) { correct++; streak++; maxStreak = Math.max(maxStreak, streak); }
      else { incorrect++; streak = 0; }
      lastAnswer = Object.freeze({ value: normalized, correct: isCorrect, answer: problems[index].answer });
      phase = answered === 10 ? 'completed' : 'feedback';
      if (phase === 'completed') result = Object.freeze({ answered, correct, incorrect, accuracy: correct / 10, maxStreak });
      notify(isCorrect ? 'correct' : 'incorrect', { attemptId, value: normalized, answer: problems[index].answer });
      if (result) notify('sessionComplete', result);
      return true;
    },
    next(sourceSession, problemId) {
      if (!active || paused || notifying || phase !== 'feedback' || sourceSession !== sessionId ||
          problemId !== problems[index].problemId) return false;
      presentProblem(); return true;
    },
    snapshot,
    exit() {
      if (!active) return;
      active = false; token = null; aborted = phase !== 'completed'; observer = null;
    },
  };
}
