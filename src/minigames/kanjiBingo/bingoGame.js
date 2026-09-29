import { BINGO_CELLS, BINGO_LINES, completedLines, shuffled } from './bingoContent.js';

export const BINGO_CALLS = 10;
export const STAMP_STREAK = 3;
// A missed kanji is called again after this many other calls.
export const RETRY_GAP = 2;

// Nonpersistent Core. The card (sixteen kanji with checked clues) comes from the caller.
// Each call names one square by its reading in a sentence or by its meaning; the child
// taps it. A first-try tap marks the square. A miss shows the right square and brings
// the kanji back a little later, so nothing is lost. Three first tries in a row earn a
// ⭐ stamp that marks any other square.
export function createBingoGame({ sessionId, random = Math.random, onEvent = () => {}, content }) {
  const stage = content?.stage ?? null, card = content?.card ?? null;
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', seq = 0, activeElapsedMs = 0, callSerial = 0, callsMade = 0;
  let answered = 0, correct = 0, incorrect = 0, streak = 0, stamps = 0, stampArmed = false;
  let result = null, lastAnswer = null, aborted = false, completeEmitted = false, problem = null, attemptId = null;
  const marked = Array(BINGO_CELLS).fill(null);
  const missed = [], queue = [];
  const tries = new Map();
  let lines = [];

  const snapshot = () => Object.freeze({
    gameId: 'kanjiBingo', mode: 'bingo', stage, sessionId, phase, paused, active, aborted, seq, activeElapsedMs,
    card, marked: Object.freeze([...marked]), lines: Object.freeze([...lines]),
    bingo: Object.freeze({ lines: lines.length, marked: marked.filter(Boolean).length }),
    calls: Object.freeze({ made: callsMade, total: BINGO_CALLS }), stamps, stampArmed, streak,
    problem, attemptId, answered, correct, incorrect, result, lastAnswer, missed: Object.freeze([...missed]),
  });
  const notify = (type, payload = {}) => {
    const event = Object.freeze({ version: 1, gameId: 'kanjiBingo', sessionId, seq: ++seq, type,
      problemId: problem?.problemId ?? null, activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation observers cannot undo a committed answer. */ }
    finally { notifying = false; }
  };
  const updateLines = () => {
    const before = lines.length;
    lines = completedLines(marked);
    return lines.length - before;
  };
  // A kanji called again keeps its clue type; new ones alternate between reading and meaning.
  const clueFor = cell => {
    const previous = tries.get(cell.cellId);
    if (previous && cell[previous]) return previous;
    const prefer = callSerial % 2 === 0 ? 'reading' : 'meaning';
    return cell[prefer] ? prefer : prefer === 'reading' ? 'meaning' : 'reading';
  };
  const present = () => {
    while (queue.length && marked[queue[0].index]) queue.shift();
    const cell = queue.shift();
    if (!cell) return false;
    const kind = clueFor(cell);
    tries.set(cell.cellId, kind);
    callSerial++; callsMade++;
    problem = Object.freeze({ problemId: `${sessionId}:bingo:${callSerial}:${cell.kanjiId}`, contentId: cell.kanjiId, skillId: `kanji:${cell.kanjiId}`,
      kind, cellId: cell.cellId, kanji: cell.kanji,
      clue: kind === 'reading' ? cell.reading : Object.freeze({ meaning: cell.meaning }),
      choices: Object.freeze(card.filter((_, index) => !marked[index]).map(item => Object.freeze({ choiceId: item.cellId, text: item.kanji }))),
      correctChoiceId: cell.cellId });
    attemptId = `${problem.problemId}:attempt`; lastAnswer = null; phase = 'answering';
    notify('problemPresented', { skillId: problem.skillId, clue: kind, choiceIds: Object.freeze(problem.choices.map(choice => choice.choiceId)) });
    return true;
  };
  const complete = () => {
    phase = 'completed'; problem = null; attemptId = null; stampArmed = false;
    result = Object.freeze({ answered, correct, incorrect, accuracy: answered ? correct / answered : 0,
      lines: lines.length, marked: marked.filter(Boolean).length, finished: true });
    if (!completeEmitted) { completeEmitted = true; notify('sessionComplete', result); }
  };
  const allMarked = () => marked.every(Boolean);
  const cellById = cellId => card?.find(cell => cell.cellId === cellId) ?? null;

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying || !card || card.length !== BINGO_CELLS) return false;
      // Focus kanji are called first, the rest in random order.
      queue.push(...shuffled(card.filter(cell => cell.focus), random), ...shuffled(card.filter(cell => !cell.focus), random));
      return present();
    },
    update(dtMs) {
      if (active && !paused && !['ready', 'completed'].includes(phase) && Number.isFinite(dtMs)) activeElapsedMs += Math.max(0, dtMs);
    },
    setPaused(value) { if (active) paused = !!value; },
    armStamp({ sessionId: sourceSession, armed = true } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || sourceSession !== sessionId) return false;
      if (armed && !stamps) return false;
      stampArmed = !!armed; return true;
    },
    stamp({ sessionId: sourceSession, cellId } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || sourceSession !== sessionId || !stampArmed) return false;
      const cell = cellById(cellId);
      // The square being called is left for the child to find.
      if (!cell || marked[cell.index] || cell.cellId === problem?.cellId) return false;
      marked[cell.index] = 'stamp'; stamps--; stampArmed = false;
      const newLines = updateLines();
      notify('stamp', { cellId, lines: lines.length, newLines });
      return true;
    },
    answer({ sessionId: sourceSession, problemId, attemptId: sourceAttempt, choiceId } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || sourceSession !== sessionId ||
          problemId !== problem?.problemId || sourceAttempt !== attemptId || stampArmed) return false;
      const tapped = cellById(choiceId);
      if (!tapped || marked[tapped.index]) return false;
      const committedAttempt = attemptId, target = cellById(problem.cellId);
      attemptId = null; answered++;
      const isCorrect = tapped.cellId === target.cellId;
      let newLines = 0, earned = false;
      if (isCorrect) {
        correct++; streak++;
        marked[target.index] = 'call'; newLines = updateLines();
        if (streak % STAMP_STREAK === 0) { stamps++; earned = true; }
      } else {
        incorrect++; streak = 0;
        missed.push(Object.freeze({ contentId: target.kanjiId, kanji: target.kanji, clue: problem.kind,
          answer: problem.kind === 'reading' ? target.reading.reading : target.meaning, questionNumber: answered }));
        queue.splice(Math.min(RETRY_GAP, queue.length), 0, target);
      }
      lastAnswer = Object.freeze({ attemptId: committedAttempt, choiceId: tapped.cellId, correctChoiceId: target.cellId, correct: isCorrect,
        newLines, lines: lines.length, earnedStamp: earned,
        tapped: Object.freeze({ kanji: tapped.kanji, readings: tapped.readings, meaning: tapped.meaning }) });
      phase = 'feedback';
      notify(isCorrect ? 'correct' : 'incorrect', { attemptId: committedAttempt, choiceId: tapped.cellId, correctChoiceId: target.cellId,
        contentId: target.kanjiId, skillId: problem.skillId, clue: problem.kind, lines: lines.length, newLines });
      return true;
    },
    next({ sessionId: sourceSession } = {}) {
      if (!active || paused || notifying || sourceSession !== sessionId || phase !== 'feedback') return false;
      if (callsMade >= BINGO_CALLS || allMarked() || !present()) complete();
      return true;
    },
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      if (command.type === 'answer') return this.answer(command.payload);
      if (command.type === 'armStamp') return this.armStamp(command.payload);
      if (command.type === 'stamp') return this.stamp(command.payload);
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

export { BINGO_LINES };
