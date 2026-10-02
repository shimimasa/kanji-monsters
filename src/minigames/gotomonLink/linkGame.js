import { readingTarget, wordTarget, equationTarget } from '../buildReview.js';

// The 「もじを ならべて ふくしゅう」 of a missed line: 漢字 readings in their sentence, English words
// from their meaning, sums as the whole number sentence. Meanings of kanji are not built.
export const linkBuildTarget = (kind, pair) => kind === 'reading' ? readingTarget({ word: pair.left, reading: pair.right, sentence: pair.sentence })
  : kind === 'meaning' ? null : kind.startsWith('words') ? wordTarget({ word: pair.left, meaning: pair.right })
  : equationTarget({ question: pair.left, answer: pair.right });

function take(random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('random must be in [0, 1)');
  return value;
}
const shuffled = (items, random) => {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(take(random) * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
};

// Time the finished board stays before the next one, in ms.
export const LINK_CLEAR_MS = 1400;

// Nonpersistent Core: draw lines. Each board has six cards on the left (held by Gotomon)
// and six on the right; the child joins each left card to the right card that fits
// (漢字↔読み, a word ↔ its meaning, a calculation ↔ its answer). A right line stays and
// the Gotomon crosses it; a wrong one springs back and says what that card was, and the
// card that fits glows. Two boards; no time, no game over. One learning result per
// left card, on its first line; every line is its own problem id.
export function createLinkGame({ sessionId, random = Math.random, onEvent = () => {}, content }) {
  const rounds = content?.rounds ?? null;
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', seq = 0, activeElapsedMs = 0, roundIndex = 0, lineSerial = 0, clearMs = 0;
  let answered = 0, correct = 0, incorrect = 0, joined = 0;
  let result = null, lastLine = null, aborted = false, completeEmitted = false, problem = null, attemptId = null;
  let lefts = [], rights = [];
  const missed = [];

  const round = () => rounds?.[roundIndex] ?? null;
  const snapshot = () => Object.freeze({
    gameId: 'gotomonLink', mode: 'link', sessionId, phase, paused, active, aborted, seq, activeElapsedMs,
    roundIndex, rounds: rounds ? rounds.length : 0, roundKind: round()?.kind ?? null, roundLabel: round()?.label ?? null,
    lefts: Object.freeze(lefts.map(item => Object.freeze({ ...item }))), rights: Object.freeze(rights.map(item => Object.freeze({ ...item }))),
    joined, total: rounds ? rounds.reduce((sum, item) => sum + item.pairs.length, 0) : 0, clearing: clearMs > 0,
    problem, attemptId, answered, correct, incorrect, result, lastLine, missed: Object.freeze([...missed]),
  });
  const notify = (type, payload = {}, problemId = problem?.problemId ?? null) => {
    const event = Object.freeze({ version: 1, gameId: 'gotomonLink', sessionId, seq: ++seq, type,
      problemId, activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation observers cannot undo a committed answer. */ }
    finally { notifying = false; }
  };
  // One attempt is open at a time; each line drawn is its own problem id.
  const openLine = () => {
    problem = Object.freeze({ problemId: `${sessionId}:line:${lineSerial}`, round: roundIndex, kind: round().kind, label: round().label });
    attemptId = `${problem.problemId}:attempt`;
  };
  const startRound = at => {
    roundIndex = at; clearMs = 0;
    const pairs = round().pairs;
    lefts = pairs.map((pair, index) => ({ leftId: `${sessionId}:r${at}:l${index}`, pairId: pair.pairId, text: pair.left, sentence: pair.sentence ?? null,
      speak: pair.speak ?? null, slot: index, linked: false, tries: 0, hint: false }));
    rights = shuffled(pairs, random).map((pair, index) => ({ rightId: `${sessionId}:r${at}:r${index}`, pairId: pair.pairId, text: pair.right, slot: index, linked: false }));
    phase = 'answering'; openLine();
    notify('problemPresented', { round: at, kind: round().kind });
  };
  const complete = () => {
    phase = 'completed'; problem = null; attemptId = null;
    result = Object.freeze({ answered, correct, incorrect, accuracy: answered ? correct / answered : 0, joined, finished: true });
    if (!completeEmitted) { completeEmitted = true; notify('sessionComplete', result); }
  };

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying || !Array.isArray(rounds) || !rounds.length
        || rounds.some(item => !item.pairs?.length || new Set(item.pairs.map(pair => pair.right)).size !== item.pairs.length)) return false;
      startRound(0); return true;
    },
    update(dtMs) {
      if (!active || paused || !['answering', 'cleared'].includes(phase) || !Number.isFinite(dtMs) || notifying) return;
      const dt = Math.max(0, Math.min(dtMs, 100));
      activeElapsedMs += dt;
      if (phase !== 'cleared') return;
      clearMs -= dt;
      if (clearMs > 0) return;
      if (roundIndex + 1 >= rounds.length) complete(); else startRound(roundIndex + 1);
    },
    setPaused(value) { if (active) paused = !!value; },
    // A line from a left card to a right card.
    link({ sessionId: s, attemptId: a, leftId, rightId } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || s !== sessionId || a !== attemptId) return false;
      const left = lefts.find(item => item.leftId === leftId), right = rights.find(item => item.rightId === rightId);
      if (!left || !right || left.linked || right.linked) return false;
      const pair = round().pairs.find(item => item.pairId === left.pairId);
      const fits = left.pairId === right.pairId, first = left.tries === 0, problemId = problem.problemId, committedAttempt = attemptId;
      left.tries++; lineSerial++;
      if (first) { answered++; if (fits) correct++; else incorrect++; }
      const other = round().pairs.find(item => item.pairId === right.pairId);
      lastLine = Object.freeze({ line: lineSerial, correct: fits, first, leftId, rightId, left: left.text, right: right.text,
        explain: pair.explain, otherExplain: fits ? null : other.explain });
      const payload = { attemptId: committedAttempt, contentId: pair.contentId, skillId: pair.skillId, chosen: right.pairId };
      if (fits) { left.linked = true; right.linked = true; left.hint = false; joined++; }
      else {
        left.hint = true;
        if (first) missed.push(Object.freeze({ contentId: pair.contentId, prompt: left.text, chosen: right.text, explain: pair.explain, questionNumber: answered,
          build: linkBuildTarget(round().kind, pair) }));
      }
      notify(first ? (fits ? 'correct' : 'incorrect') : (fits ? 'joined' : 'retry'), payload, problemId);
      if (lefts.every(item => item.linked)) { phase = 'cleared'; clearMs = LINK_CLEAR_MS; problem = null; attemptId = null; return true; }
      openLine();
      return true;
    },
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      if (command.type === 'link') return this.link(command.payload);
      return false;
    },
    snapshot,
    exit() {
      if (!active) return;
      active = false; attemptId = null; aborted = phase !== 'completed'; observer = null;
    },
  };
}
