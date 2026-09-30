

export const OTHELLO_RULES = Object.freeze({
  size: 6,
  // How long the rival thinks before placing (ms), and after a slip so its answer can be read.
  rivalMs: 900, afterSlipMs: 1800,
  // The play ends after this many questions even if the board is not full.
  maxQuestions: 20,
  // How often the rival takes a square that turns the fewest stones (else any square).
  gentle: 0.9,
  // Every so many right answers in a row, the child's stone is a star: it is never turned.
  starEvery: 2,
});
const R = OTHELLO_RULES;
const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

function take(random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('random must be in [0, 1)');
  return value;
}

// The stones a move at (row, column) would turn, for the player (empty if it is no move).
// A star ('star') is the child's stone that is never turned: it closes the child's lines
// and blocks the rival's.
const owner = cell => cell === 'star' ? 'me' : cell;
export function flipsFor(board, row, column, player, size = R.size) {
  if (board[row * size + column]) return [];
  const other = player === 'me' ? 'rival' : 'me', out = [];
  for (const [dr, dc] of DIRS) {
    const line = [];
    let r = row + dr, c = column + dc;
    while (r >= 0 && r < size && c >= 0 && c < size && board[r * size + c] === other) { line.push(r * size + c); r += dr; c += dc; }
    if (line.length && r >= 0 && r < size && c >= 0 && c < size && owner(board[r * size + c]) === player) out.push(...line);
  }
  return out;
}
export function movesFor(board, player, size = R.size) {
  const out = [];
  for (let row = 0; row < size; row++) for (let column = 0; column < size; column++) {
    const flips = flipsFor(board, row, column, player, size);
    if (flips.length) out.push({ row, column, flips });
  }
  return out;
}

// Nonpersistent Core: Othello on a 6×6 board against a rival Gotomon. On the child's turn
// a question comes first (4 choices); a right answer lets the child place a stone on any
// square that turns stones, a slip shows the answer and the turn goes to the rival. The
// rival plays a gentle game (it mostly takes a square that turns the fewest stones, or any
// square, and never one that would take all of the child's stones). A player with no
// square passes; the play ends when the board is full, neither can move, or after twenty
// questions. No time limit. One learning result per question.
export function createOthelloGame({ sessionId, random = Math.random, onEvent = () => {}, content }) {
  const problems = content?.problems ?? null;
  const N = R.size;
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', seq = 0, activeElapsedMs = 0, index = 0, moveSerial = 0, waitMs = 0;
  let answered = 0, correct = 0, incorrect = 0, placed = 0, turned = 0, passes = 0, streak = 0, stars = 0, starNow = false;
  let result = null, lastAnswer = null, lastMove = null, lastPass = null, aborted = false, completeEmitted = false, problem = null, attemptId = null;
  let board = Array(N * N).fill(null);
  const missed = [];

  const count = player => board.filter(cell => owner(cell) === player).length;
  const snapshot = () => Object.freeze({
    gameId: 'gotomonOthello', mode: 'othello', sessionId, phase, paused, active, aborted, seq, activeElapsedMs, size: N,
    board: Object.freeze([...board]), mine: count('me'), theirs: count('rival'),
    legal: Object.freeze(phase === 'placing' ? movesFor(board, 'me', N).map(move => Object.freeze({ row: move.row, column: move.column, turns: move.flips.length })) : []),
    turn: phase === 'rival' ? 'rival' : 'me', placed, turned, passes, streak, stars, starNext: starNow, starEvery: R.starEvery, maxQuestions: R.maxQuestions,
    problem, attemptId, answered, correct, incorrect, result, lastAnswer, lastMove, lastPass, missed: Object.freeze([...missed]),
  });
  const notify = (type, payload = {}) => {
    const event = Object.freeze({ version: 1, gameId: 'gotomonOthello', sessionId, seq: ++seq, type,
      problemId: problem?.problemId ?? null, activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation observers cannot undo a committed answer. */ }
    finally { notifying = false; }
  };
  const complete = () => {
    phase = 'completed'; problem = null; attemptId = null;
    const mine = count('me'), theirs = count('rival');
    result = Object.freeze({ answered, correct, incorrect, accuracy: answered ? correct / answered : 0, mine, theirs, placed, turned, stars,
      outcome: mine > theirs ? 'win' : mine === theirs ? 'draw' : 'lose', finished: true });
    if (!completeEmitted) { completeEmitted = true; notify('sessionComplete', result); }
  };
  const put = (row, column, player, flips) => {
    board[row * N + column] = player;
    for (const cell of flips) board[cell] = player;
    lastMove = Object.freeze({ move: ++moveSerial, by: player, row, column, flipped: Object.freeze([...flips]) });
  };
  // The child's turn: a question, unless there is no square to play (then a pass).
  const myTurn = () => {
    if (answered >= R.maxQuestions) { complete(); return; }
    if (!movesFor(board, 'me', N).length) {
      if (!movesFor(board, 'rival', N).length) { complete(); return; }
      passes++; lastPass = Object.freeze({ pass: passes, by: 'me' });
      rivalTurn(R.rivalMs); return;
    }
    const item = problems[index % problems.length];
    problem = Object.freeze({ problemId: `${item.problemId}:q${index}`, contentId: item.contentId, skillId: item.skillId, kind: item.kind,
      prompt: item.prompt, sentence: item.sentence ?? null, explain: item.explain,
      choices: Object.freeze(item.plates.map(plate => Object.freeze({ choiceId: plate.plateId, text: plate.text, note: plate.note ?? null }))), correctChoiceId: item.answerId });
    index++;
    attemptId = `${problem.problemId}:attempt`; phase = 'answering';
    notify('problemPresented', { skillId: item.skillId, kind: item.kind });
  };
  const rivalTurn = delay => { phase = 'rival'; waitMs = delay; attemptId = `${sessionId}:rival:${moveSerial}`; };
  // The rival mostly takes a square that turns the fewest stones, and never the child's last stones.
  const rivalMove = () => {
    const all = movesFor(board, 'rival', N), mine = count('me');
    // A move that would take every one of the child's stones is not played (the rival passes instead).
    const moves = all.filter(move => move.flips.length < mine);
    if (!moves.length) {
      if (!movesFor(board, 'me', N).length) { complete(); return; }
      passes++; lastPass = Object.freeze({ pass: passes, by: 'rival' }); myTurn(); return;
    }
    const fewest = Math.min(...moves.map(move => move.flips.length));
    const gentle = moves.filter(move => move.flips.length === fewest);
    const move = take(random) < R.gentle ? gentle[Math.floor(take(random) * gentle.length)] : moves[Math.floor(take(random) * moves.length)];
    put(move.row, move.column, 'rival', move.flips);
    if (board.every(Boolean)) { complete(); return; }
    myTurn();
  };

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying || !Array.isArray(problems) || !problems.length
        || problems.some(item => !item.plates?.some(plate => plate.plateId === item.answerId))) return false;
      const a = N / 2 - 1, b = N / 2;
      board[a * N + a] = 'rival'; board[b * N + b] = 'rival'; board[a * N + b] = 'me'; board[b * N + a] = 'me';
      myTurn(); return true;
    },
    update(dtMs) {
      if (!active || paused || ['ready', 'completed'].includes(phase) || !Number.isFinite(dtMs) || notifying) return;
      const dt = Math.max(0, Math.min(dtMs, 100));
      activeElapsedMs += dt;
      if (phase !== 'rival') return;
      waitMs -= dt;
      if (waitMs <= 0) rivalMove();
    },
    setPaused(value) { if (active) paused = !!value; },
    answer({ sessionId: s, attemptId: a, choiceId } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || s !== sessionId || a !== attemptId) return false;
      const choice = problem.choices.find(item => item.choiceId === choiceId);
      if (!choice) return false;
      const right = choiceId === problem.correctChoiceId;
      answered++; if (right) { correct++; streak++; } else { incorrect++; streak = 0; }
      starNow = right && streak % R.starEvery === 0;
      lastAnswer = Object.freeze({ answer: answered, correct: right, chosen: choice.text, note: choice.note, explain: problem.explain,
        answerText: problem.choices.find(item => item.choiceId === problem.correctChoiceId).text });
      if (!right) missed.push(Object.freeze({ contentId: problem.contentId, prompt: problem.prompt, chosen: choice.text, explain: problem.explain, questionNumber: answered }));
      const payload = { attemptId, contentId: problem.contentId, skillId: problem.skillId, chosen: choiceId };
      if (right) { phase = 'placing'; attemptId = `${problem.problemId}:place`; } else rivalTurn(R.afterSlipMs);
      notify(right ? 'correct' : 'incorrect', payload);
      return true;
    },
    // Places the child's stone on a square that turns stones.
    place({ sessionId: s, attemptId: a, row, column } = {}) {
      if (!active || paused || notifying || phase !== 'placing' || s !== sessionId || a !== attemptId) return false;
      if (!Number.isInteger(row) || !Number.isInteger(column) || row < 0 || row >= N || column < 0 || column >= N) return false;
      const flips = flipsFor(board, row, column, 'me', N);
      if (!flips.length) return false;
      put(row, column, 'me', flips); placed++; turned += flips.length;
      if (starNow) { board[row * N + column] = 'star'; stars++; starNow = false; }
      notify('placed', { turned: flips.length });
      if (board.every(Boolean)) { complete(); return true; }
      rivalTurn(R.rivalMs);
      return true;
    },
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      if (command.type === 'answer') return this.answer(command.payload);
      if (command.type === 'place') return this.place(command.payload);
      return false;
    },
    snapshot,
    exit() {
      if (!active) return;
      active = false; attemptId = null; aborted = phase !== 'completed'; observer = null;
    },
  };
}
