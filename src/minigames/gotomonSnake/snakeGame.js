import { ENGLISH_CHOICE_FIXTURE } from '../englishChoice/englishChoiceQuestions.js';

export const SNAKE_RULES = Object.freeze({
  columns: 9, rows: 7, words: 8, minLength: 3, maxLength: 6, decoys: 3,
  // A snake can run into a letter by accident, so the second wrong letter marks a miss.
  slipsAllowed: 2,
  // One step per this many ms (normal / ゆっくり).
  stepMs: Object.freeze({ normal: 430, slow: 680 }),
});
const R = SNAKE_RULES;
// Letters easy to mix up with each other, used first as decoys.
const LOOKALIKE = Object.freeze({ b: 'dp', d: 'bq', p: 'qb', q: 'pd', m: 'nw', n: 'mh', u: 'vn', v: 'uw', w: 'vm', i: 'lj', l: 'it', e: 'ac', a: 'eo', o: 'ac', c: 'eo', h: 'nk', g: 'qy', y: 'gv', t: 'fl', f: 't', s: 'z', z: 's', r: 'n', k: 'h', j: 'i', x: 'k' });
const DIRECTIONS = Object.freeze({ left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] });

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

// Eight short words (three to six plain letters) from the English vocabulary.
export function pickSnakeWords({ random = Math.random, words = ENGLISH_CHOICE_FIXTURE } = {}) {
  const usable = words.filter(item => /^[a-z]+$/.test(item.prompt) && item.prompt.length >= R.minLength && item.prompt.length <= R.maxLength);
  return shuffled(usable, random).slice(0, R.words).map(item => Object.freeze({ contentId: item.id, word: item.prompt, meaning: item.meaning }));
}

// Nonpersistent Core: a spelling snake. The companion leads a snake around a board
// whose edges wrap and whose body can be crossed, so it can never crash. Wild Gotomon
// hold letters; the child steers into the next letter of the word (shown with its
// meaning), and each letter eaten joins the body. A wrong letter says what it was, the
// next letter glows, and a new decoy appears elsewhere. One learning result per word:
// found when spelled with at most one wrong letter, missed at the second.
export function createSnakeGame({ sessionId, random = Math.random, onEvent = () => {}, content, pace = 'normal' }) {
  const words = content?.words ?? pickSnakeWords({ random });
  const stepMs = R.stepMs[pace === 'slow' ? 'slow' : 'normal'];
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', seq = 0, activeElapsedMs = 0, index = 0, spelled = 0, wrongs = 0, judged = false, tokenSerial = 0, slipSerial = 0, doneSerial = 0;
  let answered = 0, correct = 0, incorrect = 0, eaten = 0;
  let result = null, lastAnswer = null, lastSlip = null, aborted = false, completeEmitted = false, problem = null, attemptId = null, hintTokenId = null;
  let snake = [], direction = 'right', turnTo = null, elapsed = 0, tokens = [];
  const missed = [];

  const current = () => words?.[index] ?? null;
  const nextLetter = () => current()?.word[spelled] ?? null;
  const occupied = (c, r) => snake.some(cell => cell.c === c && cell.r === r) || tokens.some(token => token.c === c && token.r === r);
  // Letters appear on free squares, never right in front of the head.
  const place = letter => {
    const head = snake[0], free = [];
    for (let r = 0; r < R.rows; r++) for (let c = 0; c < R.columns; c++) {
      if (occupied(c, r)) continue;
      if (Math.abs(c - head.c) + Math.abs(r - head.r) < 2) continue;
      free.push({ c, r });
    }
    const spot = free[Math.floor(take(random) * free.length)];
    if (!spot) return null;
    const token = { tokenId: `${sessionId}:t${++tokenSerial}`, c: spot.c, r: spot.r, letter };
    tokens.push(token); return token;
  };
  const decoyLetter = () => {
    const want = nextLetter(), onBoard = new Set(tokens.map(token => token.letter));
    const alike = [...(LOOKALIKE[want] ?? '')].filter(letter => letter !== want && !onBoard.has(letter));
    const others = [...'abcdefghijklmnoprstuvwy'].filter(letter => letter !== want && !onBoard.has(letter));
    return alike.length && take(random) < 0.6 ? alike[Math.floor(take(random) * alike.length)] : others[Math.floor(take(random) * others.length)];
  };
  // The board always holds the next letter once, plus decoys.
  const stock = () => {
    const want = nextLetter();
    if (want && !tokens.some(token => token.letter === want)) place(want);
    while (tokens.filter(token => token.letter !== want).length < R.decoys) if (!place(decoyLetter())) break;
  };
  const snapshot = () => Object.freeze({
    gameId: 'gotomonSnake', mode: 'snake', sessionId, phase, paused, active, aborted, seq, activeElapsedMs, direction,
    snake: Object.freeze(snake.map(cell => Object.freeze({ ...cell }))), tokens: Object.freeze(tokens.map(token => Object.freeze({ ...token }))),
    word: current(), spelled, next: nextLetter(), hintTokenId, wordIndex: index, total: words ? words.length : 0, eaten,
    problem, attemptId, answered, correct, incorrect, result, lastAnswer, lastSlip, missed: Object.freeze([...missed]),
  });
  const notify = (type, payload = {}) => {
    const event = Object.freeze({ version: 1, gameId: 'gotomonSnake', sessionId, seq: ++seq, type,
      problemId: problem?.problemId ?? null, activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation observers cannot undo a committed answer. */ }
    finally { notifying = false; }
  };
  const startWord = at => {
    index = at; spelled = 0; wrongs = 0; judged = false; hintTokenId = null; tokens = [];
    const head = snake[0] ?? { c: Math.floor(R.columns / 2), r: Math.floor(R.rows / 2) };
    snake = [{ c: head.c, r: head.r, letter: null }];
    stock();
    const item = current();
    problem = Object.freeze({ problemId: `${sessionId}:snake:${at + 1}:${item.contentId}`, contentId: item.contentId, skillId: 'english.spelling',
      word: item.word, meaning: item.meaning });
    attemptId = `${problem.problemId}:attempt`; lastAnswer = null; phase = 'answering'; elapsed = 0;
    notify('problemPresented', { skillId: 'english.spelling' });
  };
  const complete = () => {
    phase = 'completed'; problem = null; attemptId = null; hintTokenId = null; tokens = [];
    result = Object.freeze({ answered, correct, incorrect, accuracy: answered ? correct / answered : 0, eaten, finished: true });
    if (!completeEmitted) { completeEmitted = true; notify('sessionComplete', result); }
  };
  const eat = token => {
    tokens = tokens.filter(other => other !== token);
    const want = nextLetter(), item = current();
    if (token.letter === want) {
      spelled++; eaten++; hintTokenId = null;
      snake.push({ ...snake[snake.length - 1], letter: token.letter });
      if (spelled >= item.word.length) {
        const first = !judged;
        if (first) { judged = true; answered++; correct++; }
        lastAnswer = Object.freeze({ attemptId, done: ++doneSerial, correct: true, first, word: item.word, meaning: item.meaning, wrongs });
        phase = 'feedback'; attemptId = null;
        notify(first ? 'correct' : 'spelled', { contentId: item.contentId, skillId: 'english.spelling', wrongs });
        return;
      }
      stock(); return;
    }
    wrongs++;
    lastSlip = Object.freeze({ slip: ++slipSerial, letter: token.letter, expected: want, c: token.c, r: token.r });
    stock(); hintTokenId = tokens.find(other => other.letter === want)?.tokenId ?? null;
    if (!judged && wrongs >= R.slipsAllowed) {
      judged = true; answered++; incorrect++;
      missed.push(Object.freeze({ contentId: item.contentId, word: item.word, meaning: item.meaning, slip: token.letter, at: spelled, questionNumber: answered }));
      notify('incorrect', { contentId: item.contentId, skillId: 'english.spelling', letter: token.letter, expected: want });
    }
  };
  const step = () => {
    if (turnTo) { direction = turnTo; turnTo = null; }
    const [dc, dr] = DIRECTIONS[direction], head = snake[0];
    const c = (head.c + dc + R.columns) % R.columns, r = (head.r + dr + R.rows) % R.rows;
    // The body follows the head, each segment keeping its letter.
    for (let i = snake.length - 1; i > 0; i--) { snake[i].c = snake[i - 1].c; snake[i].r = snake[i - 1].r; }
    snake[0] = { ...head, c, r };
    const token = tokens.find(other => other.c === c && other.r === r);
    if (token) eat(token);
  };

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying || !Array.isArray(words) || !words.length) return false;
      startWord(0); return true;
    },
    update(dtMs) {
      if (!active || paused || ['ready', 'completed'].includes(phase) || !Number.isFinite(dtMs) || notifying) return;
      const dt = Math.max(0, Math.min(dtMs, 100));
      activeElapsedMs += dt;
      if (phase !== 'answering') return;
      elapsed += dt;
      while (phase === 'answering' && elapsed >= stepMs) { elapsed -= stepMs; step(); }
    },
    setPaused(value) { if (active) paused = !!value; },
    turn({ sessionId: s, attemptId: a, to } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || s !== sessionId || a !== attemptId || !DIRECTIONS[to]) return false;
      turnTo = to; return true;
    },
    next({ sessionId: sourceSession } = {}) {
      if (!active || paused || notifying || sourceSession !== sessionId || phase !== 'feedback') return false;
      if (index + 1 >= words.length) { complete(); return true; }
      startWord(index + 1); return true;
    },
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      if (command.type === 'turn') return this.turn(command.payload);
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
