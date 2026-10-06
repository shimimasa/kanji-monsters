import { HISTORY_BUILDINGS, HISTORY_PAIRS, historyCard } from './historyContent.js';

// Six small turns. Reading is judged only from an explicit answer tap. Picking a
// card and building a town change the playfield, never the learning outcome.
export function createHistoryGame({ sessionId, onEvent = () => {} }) {
  let active = true, paused = false, aborted = false, notifying = false, observer = onEvent;
  let phase = 'ready', round = 0, seq = 0, activeElapsedMs = 0;
  let chosen = null, problem = null, attemptId = null, lastAnswer = null;
  let rice = 1, knowledge = 0, points = 0, answered = 0, correct = 0, incorrect = 0;
  let builtThisRound = false, lastBuild = null, result = null, completeEmitted = false;
  const deck = [], town = [], missed = [];
  const snapshot = () => Object.freeze({
    gameId: 'historyBuild', mode: 'history', sessionId, phase, paused, active, aborted, seq, activeElapsedMs,
    round, rounds: HISTORY_PAIRS.length,
    offers: Object.freeze((HISTORY_PAIRS[round] ?? []).map(historyCard)),
    chosen, problem, attemptId, lastAnswer, rice, knowledge, points,
    deck: Object.freeze([...deck]), town: Object.freeze([...town]), buildings: HISTORY_BUILDINGS,
    builtThisRound, lastBuild, answered, correct, incorrect, result, missed: Object.freeze([...missed]),
  });
  const notify = (type, payload = {}) => {
    const event = Object.freeze({ version: 1, gameId: 'historyBuild', sessionId,
      seq: ++seq, type, problemId: problem?.problemId ?? null, activeElapsedMs,
      payload: Object.freeze(payload) });
    notifying = true;
    try {
      const value = observer?.(event);
      if (value && typeof value.then === 'function') Promise.resolve(value).catch(() => {});
    } catch { /* A view or observer cannot change a committed answer. */ }
    finally { notifying = false; }
  };
  const complete = () => {
    phase = 'completed'; attemptId = null;
    result = Object.freeze({ answered, correct, incorrect, finished: true,
      score: correct * 100 + points * 25, points, buildings: town.length });
    if (!completeEmitted) { completeEmitted = true; notify('sessionComplete', result); }
  };
  const canAct = sourceSession => active && !paused && !notifying && sourceSession === sessionId;
  return {
    enter() {
      if (!active || phase !== 'ready') return false;
      phase = 'choosing'; return true;
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
      if (command.type === 'choose') {
        if (phase !== 'choosing' || !HISTORY_PAIRS[round]?.includes(payload.cardId)) return false;
        chosen = historyCard(payload.cardId);
        deck.push(chosen.id);
        const choices = chosen.choices.map((reading, index) => Object.freeze({ choiceId: reading, text: reading, index }));
        const shift = round % choices.length;
        problem = Object.freeze({ problemId: `${sessionId}:history:${round}`, contentId: `history:${chosen.id}`,
          skillId: 'japanese.historyTerm.reading', name: chosen.name,
          choices: Object.freeze([...choices.slice(shift), ...choices.slice(0, shift)]), correctChoiceId: chosen.reading });
        attemptId = `${problem.problemId}:attempt`;
        lastAnswer = null; phase = 'answering';
        notify('problemPresented', { contentId: problem.contentId, skillId: problem.skillId,
          choiceIds: Object.freeze(problem.choices.map(choice => choice.choiceId)) });
        return true;
      }
      if (command.type === 'answer') {
        if (phase !== 'answering' || payload.attemptId !== attemptId ||
            !problem.choices.some(choice => choice.choiceId === payload.choiceId)) return false;
        const right = payload.choiceId === problem.correctChoiceId;
        answered++; if (right) correct++; else incorrect++;
        rice += chosen.rice; knowledge += chosen.knowledge; points += chosen.points;
        lastAnswer = Object.freeze({ attemptId, choiceId: payload.choiceId,
          correctChoiceId: problem.correctChoiceId, correct: right, reading: chosen.reading });
        if (!right) missed.push(Object.freeze({ contentId: problem.contentId,
          questionNumber: answered, answer: chosen.reading, chosen: payload.choiceId }));
        attemptId = null; phase = 'building';
        notify(right ? 'correct' : 'incorrect', { attemptId: lastAnswer.attemptId,
          contentId: problem.contentId, skillId: problem.skillId,
          choiceId: payload.choiceId, correctChoiceId: problem.correctChoiceId });
        return true;
      }
      if (command.type === 'build') {
        if (phase !== 'building' || builtThisRound) return false;
        const building = HISTORY_BUILDINGS.find(item => item.id === payload.buildingId);
        if (!building || rice < building.rice || knowledge < building.knowledge) return false;
        rice -= building.rice; knowledge -= building.knowledge; points += building.points;
        town.push(building.id); builtThisRound = true; lastBuild = building.id;
        return true;
      }
      if (command.type === 'next') {
        if (phase !== 'building' || payload.problemId !== problem?.problemId) return false;
        round++; chosen = null; problem = null; attemptId = null;
        builtThisRound = false; lastBuild = null; lastAnswer = null;
        if (round === HISTORY_PAIRS.length) complete();
        else phase = 'choosing';
        return true;
      }
      return false;
    },
    snapshot,
    exit() { if (!active) return; active = false; aborted = phase !== 'completed'; observer = null; attemptId = null; },
  };
}
