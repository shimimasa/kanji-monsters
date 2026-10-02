import { readingTarget } from '../buildReview.js';

// Stars for a finished puzzle: every card placed on the first try gives three.
export const starsFor = slips => slips === 0 ? 3 : slips === 1 ? 2 : 1;

// Nonpersistent Core. Puzzles (kanji cards to put in order by stroke count or by the
// first sound of their reading) come from the caller. The child taps the card that comes
// next; the last card places itself. A wrong card stays in the tray with a gentle clue
// about it, and the right card glows until it is placed. One learning result per place
// in the row, on the first tap; each tap is its own problem so the Host's feedback
// timing restarts.
export function createSortGame({ sessionId, onEvent = () => {}, content }) {
  const stage = content?.stage ?? null, puzzles = content?.puzzles ?? null;
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', seq = 0, activeElapsedMs = 0, index = 0, step = 0, tries = 0, slips = 0;
  let answered = 0, correct = 0, incorrect = 0, solved = 0, stars = 0;
  let result = null, lastAnswer = null, aborted = false, completeEmitted = false, problem = null, attemptId = null;
  let placed = [], hintCardId = null;
  const missed = [];

  const puzzle = () => puzzles?.[index] ?? null;
  const cardById = cardId => puzzle()?.cards.find(card => card.cardId === cardId) ?? null;
  const nextCard = () => puzzle()?.cards.find(card => card.rank === step) ?? null;
  const snapshot = () => Object.freeze({
    gameId: 'kanjiSort', mode: 'sort', stage, sessionId, phase, paused, active, aborted, seq, activeElapsedMs,
    puzzle: index, puzzles: puzzles ? puzzles.length : 0, puzzleId: puzzle()?.puzzleId ?? null, kind: puzzle()?.kind ?? null,
    cards: puzzle()?.cards ?? [], placed: Object.freeze([...placed]), hintCardId, solved, stars,
    problem, attemptId, answered, correct, incorrect, result, lastAnswer, missed: Object.freeze([...missed]),
  });
  const notify = (type, payload = {}) => {
    const event = Object.freeze({ version: 1, gameId: 'kanjiSort', sessionId, seq: ++seq, type,
      problemId: problem?.problemId ?? null, activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation observers cannot undo a committed answer. */ }
    finally { notifying = false; }
  };
  const openTap = () => {
    const card = nextCard();
    problem = Object.freeze({ problemId: `${sessionId}:sort:${index}:${step}:${tries}`, contentId: card.kanjiId, skillId: `kanji:${card.kanjiId}`,
      kind: puzzle().kind, step, size: puzzle().cards.length,
      choices: Object.freeze(puzzle().cards.filter(item => !placed.includes(item.cardId)).map(item => Object.freeze({ choiceId: item.cardId, text: item.kanji }))),
      correctChoiceId: card.cardId });
    attemptId = `${problem.problemId}:attempt`; lastAnswer = null; phase = 'answering';
  };
  const startPuzzle = at => {
    index = at; step = 0; tries = 0; slips = 0; placed = []; hintCardId = null;
    notify('problemPresented', { puzzleId: puzzle().puzzleId, kind: puzzle().kind });
    openTap();
  };
  const complete = () => {
    phase = 'completed'; problem = null; attemptId = null; hintCardId = null;
    result = Object.freeze({ answered, correct, incorrect, accuracy: answered ? correct / answered : 0, solved, stars, finished: true });
    if (!completeEmitted) { completeEmitted = true; notify('sessionComplete', result); }
  };

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying || !Array.isArray(puzzles) || !puzzles.length || puzzles.some(item => (item.cards?.length ?? 0) < 2)) return false;
      startPuzzle(0); return true;
    },
    update(dtMs) {
      if (!active || paused || ['ready', 'completed'].includes(phase) || !Number.isFinite(dtMs)) return;
      activeElapsedMs += Math.max(0, dtMs);
    },
    setPaused(value) { if (active) paused = !!value; },
    place({ sessionId: sourceSession, attemptId: sourceAttempt, cardId } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || sourceSession !== sessionId || sourceAttempt !== attemptId) return false;
      const card = cardById(cardId);
      if (!card || placed.includes(card.cardId)) return false;
      const want = nextCard(), right = card.cardId === want.cardId, first = tries === 0;
      const committedAttempt = attemptId; attemptId = null; phase = 'feedback';
      if (first) { answered++; if (right) correct++; else incorrect++; }
      let finished = false, earned = 0;
      if (right) {
        placed.push(card.cardId); step++; tries = 0; hintCardId = null;
        // The last card has only one place left, so it goes in by itself.
        const rest = puzzle().cards.filter(item => !placed.includes(item.cardId));
        if (rest.length === 1) { placed.push(rest[0].cardId); step++; }
        finished = placed.length === puzzle().cards.length;
        if (finished) { solved++; earned = starsFor(slips); stars += earned; }
      } else {
        tries++; hintCardId = want.cardId;
        if (first) {
          slips++;
          missed.push(Object.freeze({ contentId: want.kanjiId, kanji: want.kanji, kind: puzzle().kind,
            answer: puzzle().kind === 'reading' ? want.reading : `${want.strokes}画`, chosen: card.kanji, questionNumber: answered,
            // A reading card comes back as its reading, in the short word shown on the card.
            build: puzzle().kind === 'reading' ? readingTarget({ word: want.kanji, reading: want.reading,
              sentence: want.word?.includes(want.kanji) ? { before: want.word.slice(0, want.word.indexOf(want.kanji)), after: want.word.slice(want.word.indexOf(want.kanji) + 1) } : null }) : null }));
        }
      }
      lastAnswer = Object.freeze({ attemptId: committedAttempt, choiceId: card.cardId, correctChoiceId: want.cardId, correct: right, first,
        kind: puzzle().kind, kanji: card.kanji, strokes: card.strokes, reading: card.reading, word: card.word, wantKanji: want.kanji, finished, stars: earned });
      const payload = { attemptId: committedAttempt, choiceId: card.cardId, correctChoiceId: want.cardId, contentId: want.kanjiId,
        skillId: `kanji:${want.kanjiId}`, kind: puzzle().kind, finished, stars: earned };
      // One learning result per place in the row: the first tap. A tap after a miss is just placing.
      if (first) notify(right ? 'correct' : 'incorrect', payload);
      else notify(right ? 'placed' : 'retry', payload);
      return true;
    },
    next({ sessionId: sourceSession } = {}) {
      if (!active || paused || notifying || sourceSession !== sessionId || phase !== 'feedback') return false;
      if (lastAnswer?.finished) {
        if (index + 1 >= puzzles.length) { complete(); return true; }
        startPuzzle(index + 1); return true;
      }
      openTap();
      return true;
    },
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      if (command.type === 'place') return this.place(command.payload);
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
