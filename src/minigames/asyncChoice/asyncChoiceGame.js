import { loadAsyncChoiceFixture, prepareAsyncChoiceQuestions } from './asyncChoiceQuestions.js';

export function createAsyncChoiceGame({ sessionId, random = Math.random, onEvent = () => {},
  loadQuestions = loadAsyncChoiceFixture,
  makeAbortController = () => typeof AbortController === 'function' ? new AbortController() : null } = {}) {
  if (typeof loadQuestions !== 'function') throw new TypeError('loadQuestions must be a function');
  if (typeof makeAbortController !== 'function') throw new TypeError('makeAbortController must be a function');
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'idle', generation = 0, controller = null, questions = Object.freeze([]), index = -1;
  let attemptId = null, seq = 0, activeElapsedMs = 0, answered = 0, correct = 0, incorrect = 0;
  let result = null, lastAnswer = null, loadError = null, aborted = false, completeEmitted = false;

  const currentProblem = () => questions[index] ?? null;
  const snapshot = () => Object.freeze({ gameId: 'asyncChoice', mode: 'asyncLifecycleProbe', sessionId,
    phase, paused, active, aborted, loadGeneration: generation, loadError, problem: currentProblem(), attemptId,
    seq, activeElapsedMs, answered, correct, incorrect, result, lastAnswer });
  const notify = (type, payload = {}) => {
    const event = Object.freeze({ version: 1, gameId: 'asyncChoice', sessionId, seq: ++seq, type,
      problemId: currentProblem()?.problemId ?? null, activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Observer failure cannot undo committed state. */ }
    finally { notifying = false; }
  };
  const presentProblem = () => {
    if (!active || paused || phase !== 'ready') return false;
    index++; const problem = currentProblem(); if (!problem) return false;
    attemptId = `${sessionId}:async-attempt:${index + 1}`; lastAnswer = null; phase = 'answering';
    notify('problemPresented', { skillId: problem.skillId,
      choiceIds: Object.freeze(problem.choices.map(choice => choice.choiceId)) });
    return true;
  };
  const isCurrentLoad = loadId => active && generation === loadId && phase === 'loading';
  const applyLoaded = (loadId, fixture) => {
    if (!isCurrentLoad(loadId)) return false;
    try { questions = prepareAsyncChoiceQuestions({ fixture, sessionId, random }); }
    catch { return applyFailed(loadId); }
    controller = null; loadError = null; phase = 'ready';
    if (!paused) presentProblem();
    return true;
  };
  const applyFailed = loadId => {
    if (!isCurrentLoad(loadId)) return false;
    controller = null; questions = Object.freeze([]); attemptId = null;
    loadError = 'questionsUnavailable'; phase = 'failed'; return true;
  };
  const beginLoad = () => {
    const loadId = ++generation; phase = 'loading'; loadError = null;
    try { controller = makeAbortController(); }
    catch { controller = null; applyFailed(loadId); return; }
    let pending;
    try { pending = loadQuestions({ signal: controller?.signal, sessionId, generation: loadId }); }
    catch { applyFailed(loadId); return; }
    Promise.resolve(pending).then(fixture => applyLoaded(loadId, fixture), () => applyFailed(loadId));
  };
  const identityMatches = ({ sessionId: sourceSession, problemId, attemptId: sourceAttempt } = {}) =>
    active && !paused && !notifying && phase === 'answering' && attemptId && sourceSession === sessionId &&
    problemId === currentProblem()?.problemId && sourceAttempt === attemptId;
  const emitComplete = () => { if (completeEmitted || !result) return; completeEmitted = true; notify('sessionComplete', result); };

  return {
    enter() { if (!active || phase !== 'idle' || notifying) return false; beginLoad(); return true; },
    update(dtMs) {
      if (!active || paused || (phase !== 'answering' && phase !== 'feedback') || !Number.isFinite(dtMs)) return;
      activeElapsedMs += Math.max(0, dtMs);
    },
    setPaused(value) {
      if (!active) return;
      const wasPaused = paused; paused = !!value;
      if (wasPaused && !paused && phase === 'ready') presentProblem();
    },
    answer(payload = {}) {
      if (!identityMatches(payload)) return false;
      const problem = currentProblem(), choice = problem.choices.find(item => item.choiceId === payload.choiceId);
      if (!choice) return false;
      const committedAttempt = attemptId; attemptId = null;
      const isCorrect = payload.choiceId === problem.correctChoiceId; answered++;
      if (isCorrect) correct++; else incorrect++;
      lastAnswer = Object.freeze({ attemptId: committedAttempt, choiceId: payload.choiceId,
        correctChoiceId: problem.correctChoiceId, correct: isCorrect });
      phase = answered === 10 ? 'completed' : 'feedback';
      if (phase === 'completed') result = Object.freeze({ answered, correct, incorrect, accuracy: correct / 10 });
      notify(isCorrect ? 'correct' : 'incorrect', { attemptId: committedAttempt, choiceId: payload.choiceId,
        correctChoiceId: problem.correctChoiceId, skillId: problem.skillId });
      if (result) emitComplete();
      return true;
    },
    next({ sessionId: sourceSession, problemId } = {}) {
      if (!active || paused || notifying || phase !== 'feedback' || sourceSession !== sessionId ||
          problemId !== currentProblem()?.problemId) return false;
      phase = 'ready'; return presentProblem();
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
      active = false; generation++; attemptId = null; aborted = phase !== 'completed';
      try { controller?.abort(); } catch { /* Invalidation remains the safety boundary. */ }
      controller = null; observer = null;
    },
  };
}
