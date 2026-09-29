export const PEEK_MS = 1800;
export const PEEK_STREAK = 3;

// Nonpersistent Core. Rounds of cards (漢字 and its 読み or 意味) come from the caller.
// The child turns two cards per try. A pair stays open; other cards turn back and the
// try is just part of the search, never a mistake. Each pair gives one learning result
// when it is found: correct, unless one of its cards was paired wrongly while its
// partner had already been seen (then it goes to the review list). The companion's
// のぞき見 shows every card for a moment; three clean pairs in a row earn another.
export function createMemoryGame({ sessionId, onEvent = () => {}, content }) {
  const stage = content?.stage ?? null, rounds = content?.rounds ?? null;
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', seq = 0, activeElapsedMs = 0, round = 0, trySerial = 0;
  let answered = 0, correct = 0, incorrect = 0, tries = 0, cleanStreak = 0, peeks = 1, peekMs = 0;
  let result = null, lastAnswer = null, aborted = false, completeEmitted = false, problem = null, attemptId = null;
  let up = [], matched = new Set(), seen = new Set(), slipped = new Set();
  const missed = [];

  const cards = () => rounds?.[round]?.cards ?? [];
  const pairOf = pairId => rounds?.[round]?.pairs.find(pair => pair.pairId === pairId) ?? null;
  const snapshot = () => Object.freeze({
    gameId: 'kanjiMemory', mode: 'memory', stage, sessionId, phase, paused, active, aborted, seq, activeElapsedMs,
    round, rounds: rounds ? rounds.length : 0, roundKind: rounds?.[round]?.kind ?? null, cards: cards(), pairs: rounds?.[round]?.pairs ?? [],
    up: Object.freeze([...up]), matched: Object.freeze([...matched]), peeks, peeking: peekMs > 0, tries,
    pairsLeft: (rounds?.[round]?.pairs.length ?? 0) - matched.size / 2,
    problem, attemptId, answered, correct, incorrect, result, lastAnswer, missed: Object.freeze([...missed]),
  });
  const notify = (type, payload = {}) => {
    const event = Object.freeze({ version: 1, gameId: 'kanjiMemory', sessionId, seq: ++seq, type,
      problemId: problem?.problemId ?? null, activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation observers cannot undo a committed answer. */ }
    finally { notifying = false; }
  };
  // Every try (two cards) is its own problem so the Host's feedback timing restarts.
  const openTry = () => {
    problem = Object.freeze({ problemId: `${sessionId}:memory:${++trySerial}`, kind: rounds[round].kind });
    attemptId = `${problem.problemId}:attempt`; up = []; lastAnswer = null; phase = 'answering';
  };
  const startRound = index => { round = index; matched = new Set(); seen = new Set(); slipped = new Set(); openTry(); };
  const complete = () => {
    phase = 'completed'; problem = null; attemptId = null; up = []; peekMs = 0;
    result = Object.freeze({ answered, correct, incorrect, accuracy: answered ? correct / answered : 0, tries, finished: true });
    if (!completeEmitted) { completeEmitted = true; notify('sessionComplete', result); }
  };
  const cardById = cardId => cards().find(card => card.cardId === cardId) ?? null;
  const partnerSeen = card => cards().some(other => other.pairId === card.pairId && other !== card && seen.has(other.cardId));

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying || !Array.isArray(rounds) || !rounds.length || rounds.some(item => !item.cards?.length)) return false;
      startRound(0); return true;
    },
    update(dtMs) {
      if (!active || paused || ['ready', 'completed'].includes(phase) || !Number.isFinite(dtMs)) return;
      const dt = Math.max(0, dtMs);
      activeElapsedMs += dt;
      if (peekMs > 0) peekMs = Math.max(0, peekMs - dt);
    },
    setPaused(value) { if (active) paused = !!value; },
    peek({ sessionId: sourceSession } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || sourceSession !== sessionId || peeks < 1 || peekMs > 0) return false;
      peeks--; peekMs = PEEK_MS;
      // Cards seen during the peek count as seen.
      for (const card of cards()) if (!matched.has(card.cardId)) seen.add(card.cardId);
      notify('peek', { peeks });
      return true;
    },
    flip({ sessionId: sourceSession, attemptId: sourceAttempt, cardId } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || sourceSession !== sessionId || sourceAttempt !== attemptId || peekMs > 0) return false;
      const card = cardById(cardId);
      if (!card || matched.has(card.cardId) || up.includes(card.cardId)) return false;
      if (!up.length) { up = [card.cardId]; return true; }
      const first = cardById(up[0]);
      up = [first.cardId, card.cardId]; tries++;
      const committedAttempt = attemptId; attemptId = null; phase = 'feedback';
      if (first.pairId === card.pairId) {
        const pair = pairOf(card.pairId), clean = !slipped.has(pair.pairId);
        matched.add(first.cardId); matched.add(card.cardId);
        answered++;
        let earned = false;
        if (clean) { correct++; cleanStreak++; if (cleanStreak % PEEK_STREAK === 0) { peeks++; earned = true; } }
        else {
          incorrect++; cleanStreak = 0;
          missed.push(Object.freeze({ contentId: pair.kanjiId, kanji: pair.kanji, kind: rounds[round].kind, answer: pair.text, questionNumber: answered }));
        }
        lastAnswer = Object.freeze({ attemptId: committedAttempt, match: true, correct: clean, pairId: pair.pairId, earnedPeek: earned,
          roundDone: matched.size === cards().length });
        notify(clean ? 'correct' : 'incorrect', { attemptId: committedAttempt, choiceId: card.cardId, correctChoiceId: card.cardId,
          contentId: pair.kanjiId, skillId: `kanji:${pair.kanjiId}`, round: rounds[round].kind });
      } else {
        // A card paired wrongly while its own partner had already been seen.
        for (const item of [first, card]) if (partnerSeen(item)) slipped.add(item.pairId);
        cleanStreak = 0;
        lastAnswer = Object.freeze({ attemptId: committedAttempt, match: false, correct: false, pairId: null, earnedPeek: false, roundDone: false });
        notify('mismatch', { attemptId: committedAttempt, cardIds: Object.freeze([first.cardId, card.cardId]) });
      }
      seen.add(first.cardId); seen.add(card.cardId);
      return true;
    },
    next({ sessionId: sourceSession } = {}) {
      if (!active || paused || notifying || sourceSession !== sessionId || phase !== 'feedback') return false;
      if (matched.size < cards().length) { openTry(); return true; }
      // A new board brings one more のぞき見.
      if (round + 1 < rounds.length) { peeks++; startRound(round + 1); return true; }
      complete(); return true;
    },
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      if (command.type === 'flip') return this.flip(command.payload);
      if (command.type === 'peek') return this.peek(command.payload);
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
