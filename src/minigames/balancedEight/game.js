import { NEW_GAME_CONTENT } from './content.js';

// One answer boundary for eight different activities. Decorations, speech, and
// elapsed time never decide an outcome. Every round advances after any answer.
export function createBalancedGame(gameId, { sessionId, onEvent = () => {} } = {}) {
  const config = NEW_GAME_CONTENT[gameId];
  if (!config || !sessionId) throw new Error('Unknown balanced mini game or missing session');
  let active = true, paused = false, aborted = false, notifying = false, observer = onEvent;
  let phase = 'ready', round = 0, seq = 0, activeElapsedMs = 0;
  let problem = null, attemptId = null, lastAnswer = null, result = null;
  let answered = 0, correct = 0, incorrect = 0, completeEmitted = false;
  const missed = [], artifacts = [];
  const notify = (type, payload = {}) => {
    const event = Object.freeze({ version: 1, gameId, sessionId, seq: ++seq, type,
      problemId: problem?.problemId ?? null, activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      const value = observer?.(event);
      if (value && typeof value.then === 'function') Promise.resolve(value).catch(() => {});
    } catch { /* Observers cannot change a child's committed choice. */ }
    finally { notifying = false; }
  };
  const present = () => {
    const item = config.rounds[round];
    problem = Object.freeze({ problemId: `${sessionId}:${gameId}:${round}`,
      contentId: `${gameId}:${round}`, skillId: config.skillId, prompt: item.prompt,
      visual: item.visual, speech: item.speech, explain: item.explain,
      choices: Object.freeze(item.choices.map((label, index) => Object.freeze({ choiceId: label, text: label, index }))),
      correctChoiceId: item.correct });
    attemptId = `${problem.problemId}:attempt`;
    lastAnswer = null; phase = 'answering';
    notify('problemPresented', { contentId: problem.contentId, skillId: problem.skillId,
      choiceIds: Object.freeze(problem.choices.map(choice => choice.choiceId)) });
  };
  const snapshot = () => Object.freeze({ gameId, mode: config.subject, sessionId, phase,
    active, paused, aborted, seq, activeElapsedMs, round, rounds: config.rounds.length,
    problem, attemptId, lastAnswer, answered, correct, incorrect, result,
    missed: Object.freeze([...missed]), artifacts: Object.freeze([...artifacts]) });
  const canAct = sourceSession => active && !paused && !notifying && sourceSession === sessionId;
  return {
    enter() {
      if (!active || phase !== 'ready') return false;
      present(); return true;
    },
    update(dtMs) {
      if (active && !paused && phase !== 'ready' && phase !== 'completed' && Number.isFinite(dtMs))
        activeElapsedMs += Math.max(0, dtMs);
    },
    setPaused(value) { if (active) paused = !!value; },
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      const payload = command.payload ?? {};
      if (!canAct(payload.sessionId)) return false;
      if (command.type === 'answer') {
        if (phase !== 'answering' || payload.attemptId !== attemptId ||
            !problem.choices.some(choice => choice.choiceId === payload.choiceId)) return false;
        const right = payload.choiceId === problem.correctChoiceId;
        answered++; if (right) correct++; else incorrect++;
        artifacts.push(problem.visual);
        lastAnswer = Object.freeze({ attemptId, choiceId: payload.choiceId,
          correctChoiceId: problem.correctChoiceId, correct: right });
        if (!right) missed.push(Object.freeze({ contentId: problem.contentId,
          questionNumber: answered, answer: problem.correctChoiceId, chosen: payload.choiceId }));
        attemptId = null; phase = 'feedback';
        notify(right ? 'correct' : 'incorrect', { attemptId: lastAnswer.attemptId,
          contentId: problem.contentId, skillId: problem.skillId,
          choiceId: payload.choiceId, correctChoiceId: problem.correctChoiceId });
        return true;
      }
      if (command.type === 'next') {
        if (phase !== 'feedback' || payload.problemId !== problem?.problemId) return false;
        round++;
        if (round === config.rounds.length) {
          phase = 'completed'; problem = null; attemptId = null;
          result = Object.freeze({ answered, correct, incorrect, finished: true, score: correct * 100 });
          if (!completeEmitted) { completeEmitted = true; notify('sessionComplete', result); }
        } else present();
        return true;
      }
      return false;
    },
    snapshot,
    exit() { if (!active) return; active = false; aborted = phase !== 'completed'; observer = null; attemptId = null; },
  };
}
