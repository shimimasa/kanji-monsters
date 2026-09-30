import { buildTossProblems, nearbyNumbers } from '../gotomonToss/tossContent.js';

// Board units: 10 wide, 13 tall; the view keeps this shape.
export const BREAKOUT_RULES = Object.freeze({
  width: 10, height: 13, columns: 6, rows: 4, maxRows: 6, blockTop: 1.1, blockHeight: 0.9, gap: 0.12,
  paddleY: 12, paddleWidth: 2.6, paddleHeight: 0.35, ballRadius: 0.24,
  speedPerMs: Object.freeze({ normal: 0.0068, slow: 0.0044 }), step: 8,
  // Three other blocks may be hit before a question counts as missed: the ball bounces
  // around, and a stray bounce is no slip in the calculation.
  missesAllowed: 3, questions: 12, refillBelow: 12, autoLaunchMs: 1600,
});
const R = BREAKOUT_RULES;
const blockWidth = (R.width - R.gap * (R.columns + 1)) / R.columns;

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

// Nonpersistent Core: a breakout game. A calculation is asked; numbered blocks sit at
// the top and the child bounces a ball off a paddle. Only the block with the answer
// breaks — with its neighbours, freeing a Gotomon — and the next question comes; other
// blocks just bounce the ball back and show their number. A dropped ball comes back to
// the paddle: there is no game over. One learning result per question: found when the
// answer breaks before the ball has hit three other blocks; after that, the answer glows
// and the companion aims the next bounce off the paddle straight at it.
export function createBreakoutGame({ sessionId, random = Math.random, onEvent = () => {}, content, pace = 'normal' }) {
  const level = content?.level === 'times' ? 'times' : 'addsub';
  const questions = content?.questions ?? buildTossProblems({ sessionId, random, level });
  const speed = R.speedPerMs[pace === 'slow' ? 'slow' : 'normal'];
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', seq = 0, activeElapsedMs = 0, index = 0, blockSerial = 0, hitSerial = 0, version = 0;
  let answered = 0, correct = 0, incorrect = 0, broken = 0, freed = 0, misses = 0, judged = false, drops = 0, assisted = 0;
  let result = null, lastAnswer = null, lastBounce = null, aborted = false, completeEmitted = false, problem = null, attemptId = null, hintId = null;
  let paddleX = R.width / 2, ball = null, waitMs = 0, blocks = [], touching = null;
  const missedList = [];

  const current = () => questions?.[index] ?? null;
  const rowY = row => R.blockTop + row * (R.blockHeight + R.gap);
  const colX = column => R.gap + column * (blockWidth + R.gap);
  const addRow = () => {
    for (const block of blocks) block.row++;
    for (let column = 0; column < R.columns; column++) blocks.push({ blockId: `${sessionId}:b${++blockSerial}`, row: 0, column, number: null });
    version++;
  };
  // Every question writes new numbers: the answer on one block, likely slips and other
  // numbers on the rest, never the answer twice.
  const label = () => {
    const item = current();
    const slips = shuffled(nearbyNumbers(item), random);
    const pool = level === 'times'
      ? Array.from({ length: 64 }, (_, i) => (Math.floor(i / 8) + 2) * (i % 8 + 2))
      : Array.from({ length: 21 }, (_, i) => i);
    const extra = shuffled([...new Set(pool)].filter(n => n !== item.answer && !slips.includes(n)), random);
    // The answer goes on a block the ball can reach: nothing below it in its column.
    const open = blocks.filter(block => !blocks.some(other => other.column === block.column && other.row > block.row));
    const target = open[Math.floor(take(random) * open.length)];
    const order = [target, ...shuffled(blocks.filter(block => block !== target), random)];
    order.forEach((block, i) => { block.number = i === 0 ? item.answer : (slips[i - 1] ?? extra[i - 1 - slips.length] ?? extra[i % extra.length]); });
    version++;
  };
  const resetBall = () => { ball = { x: paddleX, y: R.paddleY - R.ballRadius - 0.05, vx: 0, vy: 0, held: true }; waitMs = 0; };
  const launch = () => {
    if (!ball?.held) return false;
    const angle = -Math.PI / 2 + (random() - 0.5) * 0.7;
    ball = { ...ball, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, held: false }; return true;
  };
  const answerBlock = () => blocks.find(block => block.number === current()?.answer) ?? null;
  const snapshot = () => Object.freeze({
    gameId: 'gotomonBreakout', mode: 'breakout', sessionId, phase, paused, active, aborted, seq, activeElapsedMs, level, version,
    blocks: Object.freeze(blocks.map(block => Object.freeze({ ...block, x: colX(block.column), y: rowY(block.row), w: blockWidth, h: R.blockHeight }))),
    ball: ball ? Object.freeze({ ...ball }) : null, paddle: Object.freeze({ x: paddleX, y: R.paddleY, w: R.paddleWidth, h: R.paddleHeight }),
    hintId, misses, assisted, question: index, questions: questions ? questions.length : 0, broken, freed, drops, lastBounce,
    problem, attemptId, answered, correct, incorrect, result, lastAnswer, missed: Object.freeze([...missedList]),
  });
  const notify = (type, payload = {}) => {
    const event = Object.freeze({ version: 1, gameId: 'gotomonBreakout', sessionId, seq: ++seq, type,
      problemId: problem?.problemId ?? null, activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation observers cannot undo a committed answer. */ }
    finally { notifying = false; }
  };
  const startQuestion = at => {
    index = at; misses = 0; judged = false; hintId = null;
    if (blocks.length < R.refillBelow && Math.max(-1, ...blocks.map(block => block.row)) < R.maxRows - 1) addRow();
    label();
    const item = current();
    problem = Object.freeze({ problemId: `${item.problemId}:0`, contentId: item.problemId, skillId: item.skillId, question: item.question, answer: item.answer });
    attemptId = `${problem.problemId}:attempt`; lastAnswer = null; phase = 'answering';
    // A new row may come down onto the ball: then it goes back to the paddle.
    const inside = ball && !ball.held && blocks.some(block => {
      const bx = colX(block.column), by = rowY(block.row);
      return ball.x > bx - R.ballRadius && ball.x < bx + blockWidth + R.ballRadius && ball.y > by - R.ballRadius && ball.y < by + R.blockHeight + R.ballRadius;
    });
    if (!ball || ball.held || inside) resetBall();
    notify('problemPresented', { skillId: item.skillId });
  };
  const complete = () => {
    phase = 'completed'; problem = null; attemptId = null; hintId = null; ball = null;
    result = Object.freeze({ answered, correct, incorrect, accuracy: answered ? correct / answered : 0, broken, freed, drops, finished: true });
    if (!completeEmitted) { completeEmitted = true; notify('sessionComplete', result); }
  };
  const judge = right => {
    if (judged) return; judged = true; answered++;
    if (right) correct++;
    else {
      incorrect++; hintId = answerBlock()?.blockId ?? null;
      missedList.push(Object.freeze({ contentId: current().problemId, question: current().question, answer: current().answer, questionNumber: answered }));
    }
    notify(right ? 'correct' : 'incorrect', { attemptId, contentId: current().problemId, skillId: current().skillId, misses });
  };
  const hitBlock = block => {
    const item = current();
    if (block.number === item.answer) {
      // The answer breaks with its neighbours; a Gotomon comes out.
      const around = blocks.filter(other => Math.abs(other.row - block.row) + Math.abs(other.column - block.column) <= 1);
      blocks = blocks.filter(other => !around.includes(other)); broken += around.length; freed++;
      const first = !judged; judge(true);
      lastAnswer = Object.freeze({ attemptId, hit: ++hitSerial, correct: true, first, question: item.question, answer: item.answer,
        x: colX(block.column) + blockWidth / 2, y: rowY(block.row) + R.blockHeight / 2, broken: Object.freeze(around.map(other => other.blockId)) });
      attemptId = null; phase = 'feedback'; version++;
      if (!first) notify('solved', { contentId: item.problemId });
      return;
    }
    misses++;
    lastBounce = Object.freeze({ bounce: ++hitSerial, blockId: block.blockId, number: block.number, x: colX(block.column) + blockWidth / 2, y: rowY(block.row) + R.blockHeight / 2 });
    if (misses >= R.missesAllowed) judge(false);
  };
  const stepBall = dt => {
    if (ball.held) { ball.x = paddleX; return; }
    let nx = ball.x + ball.vx * dt, ny = ball.y + ball.vy * dt;
    const r = R.ballRadius;
    if (nx < r) { nx = r; ball.vx = Math.abs(ball.vx); }
    if (nx > R.width - r) { nx = R.width - r; ball.vx = -Math.abs(ball.vx); }
    if (ny < r) { ny = r; ball.vy = Math.abs(ball.vy); }
    // Paddle: the further from the middle, the steeper the bounce.
    if (ball.vy > 0 && ny + r >= R.paddleY && ny + r <= R.paddleY + R.paddleHeight + 0.3 && Math.abs(nx - paddleX) <= R.paddleWidth / 2 + r) {
      const offset = Math.max(-1, Math.min(1, (nx - paddleX) / (R.paddleWidth / 2)));
      // Never straight up: a ball going up and down forever would hit one block for good.
      const tilt = offset * 1.05, lean = Math.abs(tilt) < 0.22 ? (tilt < 0 || (tilt === 0 && random() < 0.5) ? -0.22 : 0.22) : tilt;
      let angle = -Math.PI / 2 + lean;
      // Once the answer glows, the companion helps: the ball flies straight at it.
      const help = hintId && blocks.find(block => block.blockId === hintId);
      if (help) angle = Math.atan2(rowY(help.row) + R.blockHeight / 2 - (R.paddleY - r), colX(help.column) + blockWidth / 2 - nx);
      ball.vx = Math.cos(angle) * speed; ball.vy = Math.sin(angle) * speed; ny = R.paddleY - r;
      if (help) assisted++;
    }
    // Blocks: move across, then down; an axis that runs into a block turns back and
    // stays put, so the ball can never sink into a block or a corner between two.
    const overlapping = (x, y) => blocks.find(block => {
      const bx = colX(block.column), by = rowY(block.row);
      const cx = Math.max(bx, Math.min(x, bx + blockWidth)), cy = Math.max(by, Math.min(y, by + R.blockHeight));
      return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
    }) ?? null;
    // Already inside a block (a new row came down on it): move on until free.
    if (overlapping(ball.x, ball.y)) { ball.x = nx; ball.y = ny; return; }
    let struck = null;
    const acrossHit = overlapping(nx, ball.y);
    if (acrossHit) { struck = acrossHit; ball.vx = -ball.vx; nx = ball.x; }
    const downHit = overlapping(nx, ny);
    if (downHit) { struck = struck ?? downHit; ball.vy = -ball.vy; ny = ball.y; }
    if (struck) {
      // A little turn keeps the ball from settling into a loop (never flatter than 20°).
      const heading = Math.atan2(ball.vy, ball.vx) + (random() - 0.5) * 0.3;
      let vx = Math.cos(heading), vy = Math.sin(heading);
      if (Math.abs(vy) < 0.35) { vy = Math.sign(ball.vy || 1) * 0.35; vx = Math.sign(ball.vx || 1) * Math.sqrt(1 - 0.35 * 0.35); }
      ball.vx = Math.sign(ball.vx || vx) * Math.abs(vx) * speed; ball.vy = Math.sign(ball.vy || vy) * Math.abs(vy) * speed;
      if (touching !== struck.blockId) { touching = struck.blockId; hitBlock(struck); }
    } else if (!overlapping(nx, ny)) touching = null;
    if (phase !== 'answering') return;
    ball.x = nx; ball.y = ny;
    if (ball.y > R.height + r) { drops++; resetBall(); }
  };

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying || !Array.isArray(questions) || !questions.length) return false;
      for (let row = 0; row < R.rows; row++) addRow();
      startQuestion(0); return true;
    },
    update(dtMs) {
      if (!active || paused || ['ready', 'completed'].includes(phase) || !Number.isFinite(dtMs)) return;
      const dt = Math.max(0, dtMs);
      activeElapsedMs += dt;
      if (phase !== 'answering' || notifying) return;
      if (ball.held && (waitMs += dt) >= R.autoLaunchMs) launch();
      for (let left = Math.min(dt, 100); left > 0 && phase === 'answering'; left -= R.step) stepBall(Math.min(left, R.step));
    },
    setPaused(value) { if (active) paused = !!value; },
    steer({ sessionId: s, attemptId: a, x } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || s !== sessionId || a !== attemptId || !Number.isFinite(x)) return false;
      paddleX = Math.min(R.width - R.paddleWidth / 2, Math.max(R.paddleWidth / 2, x)); return true;
    },
    launch({ sessionId: s, attemptId: a } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || s !== sessionId || a !== attemptId) return false;
      return launch();
    },
    next({ sessionId: sourceSession } = {}) {
      if (!active || paused || notifying || sourceSession !== sessionId || phase !== 'feedback') return false;
      if (index + 1 >= questions.length) { complete(); return true; }
      // The ball keeps its way; a new question relabels the blocks.
      startQuestion(index + 1);
      return true;
    },
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      if (['steer', 'launch', 'next'].includes(command.type)) return this[command.type](command.payload);
      return false;
    },
    snapshot,
    exit() {
      if (!active) return;
      active = false; attemptId = null; aborted = phase !== 'completed'; observer = null;
    },
  };
}
