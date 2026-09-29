import { PROVERB_CASES } from './proverbCases.js';

export const DETECTIVE_CASES = 10;

function take(random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new TypeError('random must return a finite value in [0, 1)');
  return value;
}
function shuffled(items, random) {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(take(random) * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
}

// Ten cases; each has the true proverb and three other suspects.
export function buildDetectiveCases({ sessionId, random = Math.random, cases = PROVERB_CASES }) {
  return Object.freeze(shuffled(cases, random).slice(0, DETECTIVE_CASES).map((item, index) => {
    const problemId = `${sessionId}:case:${index + 1}:${item.id}`;
    const others = shuffled(cases.filter(other => other.id !== item.id), random).slice(0, 3);
    const choices = shuffled([item, ...others], random).map((proverb, i) => Object.freeze({
      choiceId: `${problemId}:suspect:${i + 1}`, text: proverb.text, meaning: proverb.meaning }));
    return Object.freeze({ problemId, contentId: `proverb:${item.id}`, caseId: item.id, client: item.client,
      clues: item.clues, question: item.question, text: item.text, reading: item.reading, meaning: item.meaning,
      choices: Object.freeze(choices), correctChoiceId: choices.find(choice => choice.text === item.text).choiceId,
      skillId: 'japanese.proverb.meaning' });
  }));
}

// Nonpersistent Core. A wrong suspect is ruled out and play goes on; the case is solved by
// naming the right proverb, and counts as correct only when it was the first try.
export function createProverbDetectiveGame({ sessionId, random = Math.random, onEvent = () => {}, cases }) {
  const problems = buildDetectiveCases({ sessionId, random, cases });
  const total = problems.length;
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', index = -1, attemptId = null, seq = 0, activeElapsedMs = 0;
  let answered = 0, correct = 0, incorrect = 0, result = null, lastAnswer = null, aborted = false, completeEmitted = false;
  let ruledOut = [], lastTry = null, trySerial = 0;
  const missed = [];

  const currentProblem = () => problems[index] ?? null;
  const snapshot = () => Object.freeze({
    gameId: 'proverbDetective', mode: 'cases', totalQuestions: total, sessionId, phase, paused, active, aborted,
    problem: currentProblem(), attemptId, seq, activeElapsedMs, ruledOut: Object.freeze([...ruledOut]), lastTry,
    answered, correct, incorrect, result, lastAnswer, missed: Object.freeze([...missed]),
  });
  const notify = (type, payload = {}) => {
    const event = Object.freeze({ version: 1, gameId: 'proverbDetective', sessionId, seq: ++seq, type,
      problemId: currentProblem()?.problemId ?? null, activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation observers cannot undo a committed answer. */ }
    finally { notifying = false; }
  };
  const presentProblem = () => {
    index++; ruledOut = []; lastTry = null; lastAnswer = null;
    attemptId = `${sessionId}:case-attempt:${index + 1}`; phase = 'answering';
    const problem = currentProblem();
    notify('problemPresented', { skillId: problem.skillId, caseId: problem.caseId,
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
      if (!choice || ruledOut.includes(choiceId)) return false;
      lastTry = Object.freeze({ serial: ++trySerial, choiceId, ok: choiceId === problem.correctChoiceId });
      if (!lastTry.ok) { ruledOut = [...ruledOut, choiceId]; return true; }
      const committedAttempt = attemptId;
      attemptId = null; // The case closes once; stale taps are rejected from here.
      const firstTry = ruledOut.length === 0;
      answered++;
      if (firstTry) correct++;
      else {
        incorrect++;
        missed.push(Object.freeze({ contentId: problem.contentId, text: problem.text, reading: problem.reading, meaning: problem.meaning,
          questionNumber: answered, tries: ruledOut.length + 1 }));
      }
      lastAnswer = Object.freeze({ attemptId: committedAttempt, choiceId, correctChoiceId: problem.correctChoiceId, correct: firstTry,
        tries: ruledOut.length + 1 });
      phase = answered === total ? 'completed' : 'feedback';
      if (phase === 'completed') result = Object.freeze({ answered, correct, incorrect, accuracy: correct / total });
      notify(firstTry ? 'correct' : 'incorrect', { attemptId: committedAttempt, choiceId, correctChoiceId: problem.correctChoiceId,
        contentId: problem.contentId, skillId: problem.skillId, caseId: problem.caseId, tries: ruledOut.length + 1 });
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
