import { labelsFor } from '../gotomonBubble/bubbleContent.js';
import { nearbyNumbers } from '../gotomonToss/tossContent.js';

export const MERGE_RULES = Object.freeze({
  size: 4, questions: 16, choices: 4,
  // Values a question tile can have, and how often (たし算・ひき算 / かけ算).
  spawn: Object.freeze({
    addsub: Object.freeze([[2, 0.35], [4, 0.35], [8, 0.2], [16, 0.1]]),
    times: Object.freeze([[4, 0.12], [8, 0.38], [16, 0.35], [32, 0.15]]),
  }),
});
const R = MERGE_RULES;
const DIRS = Object.freeze({ left: [0, -1], right: [0, 1], up: [-1, 0], down: [1, 0] });

function take(random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('random must be in [0, 1)');
  return value;
}
const pick = (items, random) => items[Math.floor(take(random) * items.length)];
const weighted = (table, random) => { let roll = take(random); for (const [value, weight] of table) { if ((roll -= weight) < 0) return value; } return table.at(-1)[0]; };

// A calculation for a value (never the bare number) and three likely slips beside the answer.
export function mergeQuestion(value, level, random) {
  const labels = labelsFor(value, level).slice(1);
  const label = pick(labels, random);
  const [a, b] = label.split(/[+−×]/).map(Number);
  const operation = label.includes('+') ? 'addition' : label.includes('−') ? 'subtraction' : 'multiplication';
  const slips = nearbyNumbers({ operation, a, b, answer: value }).filter(n => n > 0);
  const others = [];
  for (const n of slips) { if (others.length >= R.choices - 1) break; if (!others.includes(n)) others.push(n); }
  const numbers = [value, ...others];
  for (let i = numbers.length - 1; i > 0; i--) { const j = Math.floor(take(random) * (i + 1)); [numbers[i], numbers[j]] = [numbers[j], numbers[i]]; }
  return { label, answer: value, numbers };
}

// Slides tiles ({tileId, value, row, column}) one way, as in 2048: each tile runs to the
// wall or the next tile, and two tiles of the same number merge once per move. Returns
// the new tiles (merged ones marked), the tiles merged away (with the square they went
// to), and the number of merges; or null when nothing would move.
export function slideTiles(tiles, direction, size = R.size) {
  const [dr, dc] = DIRS[direction];
  const next = tiles.map(tile => ({ ...tile, merged: false, fresh: false }));
  const find = (row, column) => next.find(tile => tile.row === row && tile.column === column && !tile.gone);
  const order = [...Array(size).keys()];
  const rows = dr > 0 ? [...order].reverse() : order, columns = dc > 0 ? [...order].reverse() : order;
  let moved = false, joined = 0;
  for (const row of rows) for (const column of columns) {
    const tile = find(row, column); if (!tile) continue;
    let r = row, c = column;
    while (true) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) break;
      const other = find(nr, nc);
      if (!other) { r = nr; c = nc; continue; }
      if (other.value === tile.value && !other.merged) { other.value *= 2; other.merged = true; tile.gone = true; tile.row = nr; tile.column = nc; joined++; moved = true; }
      break;
    }
    if (!tile.gone && (r !== row || c !== column)) { tile.row = r; tile.column = c; moved = true; }
  }
  return moved ? { tiles: next.filter(tile => !tile.gone), gone: next.filter(tile => tile.gone).map(tile => Object.freeze({ tileId: tile.tileId, row: tile.row, column: tile.column })), joined } : null;
}

// Nonpersistent Core: 2048 with calculations. Each turn a new tile arrives showing a
// calculation (「6+2」); the child picks its answer from four numbers and the tile
// becomes that number (a slip still gives the right number, and says so). Then a swipe
// slides every tile; two tiles of the same number merge into their sum, and bigger
// numbers are bigger Gotomon. Sixteen question tiles; a full board simply ends the
// play early. No game over. One learning result per question tile.
export function createMergeGame({ sessionId, random = Math.random, onEvent = () => {}, content }) {
  const level = content?.level === 'times' ? 'times' : 'addsub';
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', seq = 0, activeElapsedMs = 0, tileSerial = 0, moveSerial = 0, asked = 0;
  let answered = 0, correct = 0, incorrect = 0, merges = 0, best = 0, full = false;
  let result = null, lastAnswer = null, lastMove = null, aborted = false, completeEmitted = false, problem = null, attemptId = null;
  let tiles = [];
  const missed = [];

  const at = (row, column) => tiles.find(tile => tile.row === row && tile.column === column) ?? null;
  const empties = () => {
    const out = [];
    for (let row = 0; row < R.size; row++) for (let column = 0; column < R.size; column++) if (!at(row, column)) out.push([row, column]);
    return out;
  };
  const snapshot = () => Object.freeze({
    gameId: 'gotomonMerge', mode: 'merge', sessionId, phase, paused, active, aborted, seq, activeElapsedMs, level, size: R.size,
    tiles: Object.freeze(tiles.map(tile => Object.freeze({ ...tile }))), asked, questions: R.questions, merges, best, full,
    problem, attemptId, answered, correct, incorrect, result, lastAnswer, lastMove, missed: Object.freeze([...missed]),
  });
  const notify = (type, payload = {}) => {
    const event = Object.freeze({ version: 1, gameId: 'gotomonMerge', sessionId, seq: ++seq, type,
      problemId: problem?.problemId ?? null, activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation observers cannot undo a committed answer. */ }
    finally { notifying = false; }
  };
  const slid = direction => slideTiles(tiles, direction);
  const canMove = () => Object.keys(DIRS).some(direction => slid(direction));
  const complete = () => {
    phase = 'completed'; problem = null; attemptId = null;
    result = Object.freeze({ answered, correct, incorrect, accuracy: answered ? correct / answered : 0, merges, best, full, finished: true });
    if (!completeEmitted) { completeEmitted = true; notify('sessionComplete', result); }
  };
  // A question tile arrives on an empty square; none left (or all asked) ends the play.
  const ask = () => {
    const free = empties();
    if (asked >= R.questions || !free.length) { full = asked < R.questions; complete(); return; }
    const [row, column] = pick(free, random);
    const value = weighted(R.spawn[level], random), question = mergeQuestion(value, level, random);
    asked++;
    tiles.push({ tileId: `${sessionId}:tile:${++tileSerial}`, value, row, column, question: question.label, merged: false, fresh: true });
    problem = Object.freeze({ problemId: `${sessionId}:q:${asked}`, contentId: `${level}:${question.label}`, skillId: `merge:${level}`,
      prompt: `${question.label} = ?`, answer: value, label: question.label, tileId: `${sessionId}:tile:${tileSerial}`,
      choices: Object.freeze(question.numbers.map(n => Object.freeze({ choiceId: String(n), text: String(n) }))), correctChoiceId: String(value) });
    attemptId = `${problem.problemId}:attempt`; phase = 'answering';
    notify('problemPresented', { skillId: problem.skillId });
  };

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying) return false;
      const [row, column] = pick(empties(), random);
      tiles.push({ tileId: `${sessionId}:tile:${++tileSerial}`, value: level === 'times' ? 4 : 2, row, column, question: null, merged: false, fresh: true });
      best = tiles[0].value;
      ask();
      return true;
    },
    update(dtMs) {
      if (!active || paused || ['ready', 'completed'].includes(phase) || !Number.isFinite(dtMs)) return;
      activeElapsedMs += Math.max(0, Math.min(dtMs, 100));
    },
    setPaused(value) { if (active) paused = !!value; },
    answer({ sessionId: s, attemptId: a, choiceId } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || s !== sessionId || a !== attemptId) return false;
      if (!problem.choices.some(choice => choice.choiceId === choiceId)) return false;
      const right = choiceId === problem.correctChoiceId;
      answered++; if (right) correct++; else incorrect++;
      const tile = tiles.find(item => item.tileId === problem.tileId);
      tile.question = null;
      best = Math.max(best, tile.value);
      lastAnswer = Object.freeze({ answer: answered, correct: right, label: problem.label, value: problem.answer, chosen: Number(choiceId), tileId: tile.tileId });
      if (!right) missed.push(Object.freeze({ contentId: problem.contentId, prompt: problem.prompt, chosen: choiceId, explain: `${problem.label} = ${problem.answer}`, questionNumber: answered }));
      const payload = { attemptId, contentId: problem.contentId, skillId: problem.skillId, chosen: choiceId };
      attemptId = `${sessionId}:move:${moveSerial + 1}`; phase = 'sliding';
      notify(right ? 'correct' : 'incorrect', payload);
      // Nowhere to slide: the play ends here, with what was built.
      if (!canMove()) { full = true; complete(); }
      return true;
    },
    // Slides every tile one way (left, right, up, down).
    slide({ sessionId: s, attemptId: a, direction } = {}) {
      if (!active || paused || notifying || phase !== 'sliding' || s !== sessionId || a !== attemptId || !DIRS[direction]) return false;
      const move = slid(direction);
      if (!move) return false;
      tiles = move.tiles; moveSerial++; merges += move.joined;
      best = Math.max(best, ...tiles.map(tile => tile.value));
      lastMove = Object.freeze({ move: moveSerial, direction, joined: move.joined, gone: Object.freeze(move.gone),
        mergedIds: Object.freeze(tiles.filter(tile => tile.merged).map(tile => tile.tileId)), best });
      if (move.joined) notify('merged', { joined: move.joined, best });
      ask();
      return true;
    },
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      if (command.type === 'answer') return this.answer(command.payload);
      if (command.type === 'slide') return this.slide(command.payload);
      return false;
    },
    snapshot,
    exit() {
      if (!active) return;
      active = false; attemptId = null; aborted = phase !== 'completed'; observer = null;
    },
  };
}
