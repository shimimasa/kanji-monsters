import { pickValues, labelFor, pick } from '../gotomonBubble/bubbleContent.js';
import { equationTarget } from '../buildReview.js';

export const PUYO_RULES = Object.freeze({
  columns: 6, rows: 11, pieces: 16, values: 4,
  // A piece falls one row per this many ms (normal / ゆっくり); later pieces fall a little faster.
  fallMs: Object.freeze({ normal: 850, slow: 1450 }), speedUpPerPiece: 0.02, minFallMs: 520,
  spawn: Object.freeze({ row: 1, column: 2 }), clearAt: 3, tidyRows: 3,
  maxSimulationStepMs: 100,
});
const R = PUYO_RULES;
// Where the second egg sits around the first, by orientation: up, right, down, left.
const OFFSETS = Object.freeze([[-1, 0], [0, 1], [1, 0], [0, -1]]);

// Nonpersistent Core: a falling-pair puzzle. Pairs of eggs written with calculations
// fall into a 6x11 well; the child moves and turns them. Three or more eggs with the
// same answer (「7」「3+4」「10−3」) touching each other hatch into
// Gotomon, and the eggs above fall and may hatch in a chain. When the well fills to the
// top, the Gotomon tidy away the three bottom rows: there is no game over. Each pair is
// one problem: it counts as found when an egg lands touching an egg with its answer.
export function createPuyoGame({ sessionId, random = Math.random, onEvent = () => {}, content, pace = 'normal' }) {
  const level = content?.level === 'times' ? 'times' : 'addsub';
  const values = pickValues(level, random).slice(0, R.values);
  const baseFall = R.fallMs[pace === 'slow' ? 'slow' : 'normal'];
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', seq = 0, activeElapsedMs = 0, fallElapsed = 0, pieceSerial = 0, eggSerial = 0, version = 0;
  let answered = 0, correct = 0, incorrect = 0, hatched = 0, bestChain = 0, tidied = 0;
  let result = null, lastAnswer = null, aborted = false, completeEmitted = false, problem = null, attemptId = null;
  let piece = null, upcoming = null;
  const grid = Array.from({ length: R.rows }, () => Array(R.columns).fill(null));
  const missed = [];

  const egg = value => ({ eggId: `${sessionId}:e${++eggSerial}`, value, label: labelFor(value, level, random) });
  // Mostly two different answers, so a pair never finds itself.
  const makePair = () => {
    const first = pick(values, random), others = values.filter(value => value !== first);
    return { pieceId: `${sessionId}:piece:${++pieceSerial}`, eggs: [egg(first), egg(random() < 0.15 ? first : pick(others, random))] };
  };
  const cellsOf = (row, column, turn) => [[row, column], [row + OFFSETS[turn][0], column + OFFSETS[turn][1]]];
  const free = (row, column) => column >= 0 && column < R.columns && row < R.rows && (row < 0 || !grid[row][column]);
  const fits = (row, column, turn) => cellsOf(row, column, turn).every(([r, c]) => free(r, c));
  const fallMs = () => Math.max(R.minFallMs, baseFall * (1 - answered * R.speedUpPerPiece));
  const landingRow = () => { let row = piece.row; while (fits(row + 1, piece.column, piece.turn)) row++; return row; };
  const snapshotPiece = () => piece ? Object.freeze({ pieceId: piece.pieceId, row: piece.row, column: piece.column, turn: piece.turn,
    eggs: Object.freeze(piece.eggs.map(e => Object.freeze({ ...e }))), cells: Object.freeze(cellsOf(piece.row, piece.column, piece.turn).map(c => Object.freeze(c))),
    landing: landingRow() }) : null;
  const snapshot = () => Object.freeze({
    gameId: 'gotomonPuyo', mode: 'puyo', sessionId, phase, paused, active, aborted, seq, activeElapsedMs, level, version,
    grid: Object.freeze(grid.map(row => Object.freeze(row.map(cell => cell ? Object.freeze({ ...cell }) : null)))),
    piece: snapshotPiece(), upcoming: upcoming ? Object.freeze(upcoming.eggs.map(e => Object.freeze({ ...e }))) : null,
    placed: answered, pieces: R.pieces, hatched, bestChain, tidied, fallMs: fallMs(),
    problem, attemptId, answered, correct, incorrect, result, lastAnswer, missed: Object.freeze([...missed]),
  });
  const notify = (type, payload = {}) => {
    const event = Object.freeze({ version: 1, gameId: 'gotomonPuyo', sessionId, seq: ++seq, type,
      problemId: problem?.problemId ?? null, activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation observers cannot undo a committed answer. */ }
    finally { notifying = false; }
  };
  const spawn = () => {
    const next = upcoming ?? makePair(); upcoming = makePair();
    piece = { ...next, row: R.spawn.row, column: R.spawn.column, turn: 0 };
    // The well is full at the top: the Gotomon tidy away the bottom rows first.
    if (!fits(piece.row, piece.column, piece.turn)) {
      grid.splice(R.rows - R.tidyRows, R.tidyRows); for (let i = 0; i < R.tidyRows; i++) grid.unshift(Array(R.columns).fill(null));
      tidied++; settle(); version++;
    }
    problem = Object.freeze({ problemId: `${piece.pieceId}:0`, contentId: `${level}:${piece.eggs.map(e => e.value).join('+')}`,
      skillId: `puyo:${level}`, prompt: piece.eggs.map(e => e.label).join(' / ') });
    attemptId = `${problem.problemId}:attempt`; lastAnswer = null; fallElapsed = 0; phase = 'answering';
    notify('problemPresented', { skillId: problem.skillId });
  };
  // Eggs drop straight down into any gap below them.
  const settle = () => {
    for (let column = 0; column < R.columns; column++) {
      const stack = []; for (let row = R.rows - 1; row >= 0; row--) if (grid[row][column]) stack.push(grid[row][column]);
      for (let row = R.rows - 1, i = 0; row >= 0; row--, i++) grid[row][column] = stack[i] ?? null;
    }
  };
  const groups = () => {
    const seen = new Set(), found = [];
    for (let row = 0; row < R.rows; row++) for (let column = 0; column < R.columns; column++) {
      const start = grid[row][column]; if (!start || seen.has(start.eggId)) continue;
      const group = [], stack = [[row, column]]; seen.add(start.eggId);
      while (stack.length) {
        const [r, c] = stack.pop(); group.push({ row: r, column: c, egg: grid[r][c] });
        for (const [dr, dc] of OFFSETS) {
          const nr = r + dr, nc = c + dc, other = grid[nr]?.[nc];
          if (other && !seen.has(other.eggId) && other.value === start.value) { seen.add(other.eggId); stack.push([nr, nc]); }
        }
      }
      if (group.length >= R.clearAt) found.push(group);
    }
    return found;
  };
  const complete = () => {
    phase = 'completed'; piece = null; problem = null; attemptId = null;
    result = Object.freeze({ answered, correct, incorrect, accuracy: answered ? correct / answered : 0, hatched, bestChain, tidied, finished: true });
    if (!completeEmitted) { completeEmitted = true; notify('sessionComplete', result); }
  };
  // The pair lands: eggs settle, groups hatch in chains, and the pair is judged.
  const lock = () => {
    const cells = cellsOf(piece.row, piece.column, piece.turn);
    cells.forEach(([row, column], i) => { if (row >= 0) grid[row][column] = { ...piece.eggs[i] }; });
    settle();
    // Judge where the eggs ended up (before hatching): touching an egg with the same answer.
    const where = piece.eggs.map(e => { for (let r = 0; r < R.rows; r++) for (let c = 0; c < R.columns; c++) if (grid[r][c]?.eggId === e.eggId) return [r, c]; return null; });
    const own = new Set(piece.eggs.map(e => e.eggId));
    const touching = where.map((spot, i) => spot ? OFFSETS.map(([dr, dc]) => grid[spot[0] + dr]?.[spot[1] + dc]).filter(other => other && !own.has(other.eggId)) : []);
    const found = piece.eggs.map((e, i) => touching[i].some(other => other.value === e.value));
    const right = found.some(Boolean);
    const waves = [];
    for (let chain = 1; chain < 20; chain++) {
      const clear = groups(); if (!clear.length) break;
      waves.push(Object.freeze(clear.map(group => Object.freeze(group.map(({ row, column, egg: e }) => Object.freeze({ row, column, eggId: e.eggId, label: e.label, value: e.value }))))));
      for (const group of clear) for (const { row, column } of group) grid[row][column] = null;
      hatched += clear.length; settle();
    }
    bestChain = Math.max(bestChain, waves.length);
    answered++; if (right) correct++; else incorrect++;
    if (!right) missed.push(Object.freeze({ contentId: problem.contentId, labels: Object.freeze(piece.eggs.map(e => e.label)),
      answers: Object.freeze(piece.eggs.map(e => e.value)), questionNumber: answered,
      build: piece.eggs.map(e => equationTarget({ question: e.label, answer: e.value })).find(Boolean) ?? null }));
    lastAnswer = Object.freeze({ attemptId, pieceId: piece.pieceId, correct: right, first: true,
      eggs: Object.freeze(piece.eggs.map((e, i) => Object.freeze({ ...e, found: found[i], cell: where[i] ? Object.freeze([...where[i]]) : null,
        touching: Object.freeze(touching[i].map(other => other.label)) }))),
      waves: Object.freeze(waves), chain: waves.length, hatchedNow: waves.reduce((sum, wave) => sum + wave.length, 0) });
    const payload = { attemptId, contentId: problem.contentId, skillId: problem.skillId, chain: waves.length };
    attemptId = null; piece = null; phase = 'feedback'; version++;
    notify(right ? 'correct' : 'incorrect', payload);
  };
  const act = (sourceSession, sourceAttempt) => active && !paused && !notifying && phase === 'answering' && sourceSession === sessionId && sourceAttempt === attemptId && piece;

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying) return false;
      spawn(); return true;
    },
    update(dtMs) {
      if (!active || paused || ['ready', 'completed'].includes(phase) || !Number.isFinite(dtMs)) return;
      const dt = Math.max(0, dtMs);
      activeElapsedMs += dt;
      if (phase !== 'answering' || notifying) return;
      fallElapsed += Math.min(dt, R.maxSimulationStepMs);
      while (phase === 'answering' && fallElapsed >= fallMs()) {
        fallElapsed -= fallMs();
        if (fits(piece.row + 1, piece.column, piece.turn)) piece.row++; else lock();
      }
    },
    setPaused(value) { if (active) paused = !!value; },
    // Moves the pair to a column, sliding across while the way is clear.
    move({ sessionId: s, attemptId: a, column } = {}) {
      if (!act(s, a) || !Number.isInteger(column)) return false;
      const step = Math.sign(column - piece.column); let moved = false;
      while (piece.column !== column && fits(piece.row, piece.column + step, piece.turn)) { piece.column += step; moved = true; }
      return moved;
    },
    shift({ sessionId: s, attemptId: a, direction } = {}) {
      if (!act(s, a) || ![-1, 1].includes(direction) || !fits(piece.row, piece.column + direction, piece.turn)) return false;
      piece.column += direction; return true;
    },
    // Turns clockwise; against a wall or an egg it steps aside if it can.
    rotate({ sessionId: s, attemptId: a } = {}) {
      if (!act(s, a)) return false;
      const turn = (piece.turn + 1) % 4;
      for (const [up, kick] of [[0, 0], [0, -1], [0, 1], [-1, 0]]) {
        if (fits(piece.row + up, piece.column + kick, turn)) { piece.row += up; piece.column += kick; piece.turn = turn; return true; }
      }
      return false;
    },
    drop({ sessionId: s, attemptId: a } = {}) {
      if (!act(s, a)) return false;
      piece.row = landingRow(); lock(); return true;
    },
    next({ sessionId: sourceSession } = {}) {
      if (!active || paused || notifying || sourceSession !== sessionId || phase !== 'feedback') return false;
      if (answered >= R.pieces) { complete(); return true; }
      spawn(); return true;
    },
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      if (['move', 'shift', 'rotate', 'drop', 'next'].includes(command.type)) return this[command.type](command.payload);
      return false;
    },
    snapshot,
    exit() {
      if (!active) return;
      active = false; attemptId = null; aborted = phase !== 'completed'; observer = null;
    },
  };
}
