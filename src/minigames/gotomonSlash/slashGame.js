import { SLASH_PLATES } from './slashContent.js';

// Field coordinates run 0..1 across and down.
export const SLASH_RULES = Object.freeze({
  // Time a ball spends in the air, launch to landing (normal / ゆっくり), in ms.
  flightMs: Object.freeze({ normal: 3400, slow: 4800 }), launchY: 1.08, apexY: 0.3,
  staggerMs: 420, relaunchMs: 600, hitX: 0.075, hitY: 0.095, minX: 0.14, maxX: 0.86,
});
const R = SLASH_RULES;

function take(random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('random must be in [0, 1)');
  return value;
}

// Distance from a point to a segment, measured in hit-box units (the field is wider than tall).
const reach = (ball, x1, y1, x2, y2) => {
  const sx = (x2 - x1) / R.hitX, sy = (y2 - y1) / R.hitY, px = (ball.x - x1) / R.hitX, py = (ball.y - y1) / R.hitY;
  const length = sx * sx + sy * sy, t = length ? Math.max(0, Math.min(1, (px * sx + py * sy) / length)) : 0;
  return Math.hypot(px - t * sx, py - t * sy);
};

// Nonpersistent Core: a slashing game. Paper balls (くす玉) with plates fly up in arcs;
// the child swipes through the one whose plate answers the problem — it bursts open and
// a Gotomon comes out. A wrong ball is knocked away and shows its plate; the answer
// glows. When every ball has fallen, the same four are thrown again: nothing is lost
// and there is no game over. One learning result per problem, on the first slash; each
// slash is its own problem id so the Host's feedback timing restarts.
export function createSlashGame({ sessionId, random = Math.random, onEvent = () => {}, content, pace = 'normal' }) {
  const problems = content?.problems ?? null;
  const flight = R.flightMs[pace === 'slow' ? 'slow' : 'normal'];
  const rise = R.launchY - R.apexY, gravity = 8 * rise / (flight * flight), lift = 4 * rise / flight;
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', seq = 0, activeElapsedMs = 0, index = 0, tries = 0, ballSerial = 0, slashSerial = 0, throwMs = 0, queue = [];
  let answered = 0, correct = 0, incorrect = 0, opened = 0;
  let result = null, lastAnswer = null, aborted = false, completeEmitted = false, problem = null, attemptId = null, hintPlateId = null;
  let balls = [];
  const missed = [];

  const current = () => problems?.[index] ?? null;
  const snapshot = () => Object.freeze({
    gameId: 'gotomonSlash', mode: 'slash', sessionId, phase, paused, active, aborted, seq, activeElapsedMs,
    balls: Object.freeze(balls.map(ball => Object.freeze({ ...ball }))), hintPlateId,
    problemIndex: index, total: problems ? problems.length : 0, opened,
    problem, attemptId, answered, correct, incorrect, result, lastAnswer, missed: Object.freeze([...missed]),
  });
  const notify = (type, payload = {}) => {
    const event = Object.freeze({ version: 1, gameId: 'gotomonSlash', sessionId, seq: ++seq, type,
      problemId: problem?.problemId ?? null, activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation observers cannot undo a committed answer. */ }
    finally { notifying = false; }
  };
  // The four plates are thrown one after another from random spots along the bottom.
  const throwWave = () => {
    const slots = [0, 1, 2, 3].sort(() => take(random) - 0.5);
    queue = current().plates.map((plate, i) => ({ plate, slot: slots[i], at: i * R.staggerMs })); throwMs = 0;
  };
  const launch = ({ plate, slot }) => {
    const x = R.minX + (slot + take(random)) / SLASH_PLATES * (R.maxX - R.minX);
    const drift = (0.5 - x) * 0.25 / flight;
    balls.push({ ballId: `${sessionId}:ball:${++ballSerial}`, plateId: plate.plateId, text: plate.text, note: plate.note, slot, x, y: R.launchY, vx: drift, vy: -lift, state: 'flying' });
  };
  const openTry = () => {
    const item = current();
    problem = Object.freeze({ problemId: `${item.problemId}:${tries}`, contentId: item.contentId, skillId: item.skillId, kind: item.kind,
      prompt: item.prompt, sentence: item.sentence ?? null, answerId: item.answerId, explain: item.explain,
      choices: Object.freeze(item.plates.map(plate => Object.freeze({ choiceId: plate.plateId, text: plate.text }))), correctChoiceId: item.answerId });
    attemptId = `${problem.problemId}:attempt`; lastAnswer = null; phase = 'answering';
  };
  const startProblem = at => {
    index = at; tries = 0; hintPlateId = null; balls = []; throwWave();
    notify('problemPresented', { skillId: current().skillId, kind: current().kind });
    openTry();
  };
  const complete = () => {
    phase = 'completed'; problem = null; attemptId = null; hintPlateId = null; balls = []; queue = [];
    result = Object.freeze({ answered, correct, incorrect, accuracy: answered ? correct / answered : 0, opened, finished: true });
    if (!completeEmitted) { completeEmitted = true; notify('sessionComplete', result); }
  };
  const cut = ball => {
    const item = current(), right = ball.plateId === item.answerId, first = tries === 0;
    const committedAttempt = attemptId;
    if (first) { answered++; if (right) correct++; else incorrect++; }
    lastAnswer = Object.freeze({ attemptId: committedAttempt, slash: ++slashSerial, correct: right, first, ballId: ball.ballId, text: ball.text, note: ball.note,
      explain: item.explain, x: ball.x, y: ball.y });
    const payload = { attemptId: committedAttempt, contentId: item.contentId, skillId: item.skillId, chosen: ball.plateId };
    if (right) {
      opened++; ball.state = 'open'; hintPlateId = null; attemptId = null; phase = 'feedback'; queue = [];
      notify(first ? 'correct' : 'opened', payload);
    } else {
      ball.state = 'knocked'; ball.vx = (ball.x < 0.5 ? -1 : 1) * 0.0004; ball.vy = Math.max(ball.vy, 0);
      hintPlateId = item.answerId;
      if (first) missed.push(Object.freeze({ contentId: item.contentId, prompt: item.prompt, chosen: ball.text, explain: item.explain, questionNumber: answered }));
      notify(first ? 'incorrect' : 'retry', payload);
      // The next try keeps this answer to show what the ball said.
      const shown = lastAnswer; tries++; openTry(); lastAnswer = shown;
    }
  };

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying || !Array.isArray(problems) || !problems.length
        || problems.some(item => item.plates?.length !== SLASH_PLATES || !item.plates.some(plate => plate.plateId === item.answerId))) return false;
      startProblem(0); return true;
    },
    update(dtMs) {
      if (!active || paused || ['ready', 'completed'].includes(phase) || !Number.isFinite(dtMs) || notifying) return;
      const dt = Math.max(0, Math.min(dtMs, 100));
      activeElapsedMs += dt;
      throwMs += dt;
      while (queue.length && queue[0].at <= throwMs) launch(queue.shift());
      for (const ball of balls) { ball.vy += gravity * dt; ball.x += ball.vx * dt; ball.y += ball.vy * dt; }
      balls = balls.filter(ball => ball.y < 1.25);
      // All balls down and the answer not found: throw the same four again.
      if (phase === 'answering' && !queue.length && !balls.some(ball => ball.state === 'flying')) {
        throwMs = -R.relaunchMs; throwWave(); queue.forEach(item => { item.at += R.relaunchMs; });
      }
    },
    setPaused(value) { if (active) paused = !!value; },
    // A swipe from one point to another cuts the ball it passes through (the answer
    // first, if it passes through more than one). A tap is a swipe of no length.
    slash({ sessionId: s, attemptId: a, x1, y1, x2, y2 } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || s !== sessionId || a !== attemptId) return false;
      if (![x1, y1, x2, y2].every(Number.isFinite)) return false;
      const hit = balls.filter(ball => ball.state === 'flying' && reach(ball, x1, y1, x2, y2) <= 1);
      if (!hit.length) return false;
      cut(hit.find(ball => ball.plateId === current().answerId) ?? hit[0]);
      return true;
    },
    next({ sessionId: sourceSession } = {}) {
      if (!active || paused || notifying || sourceSession !== sessionId || phase !== 'feedback') return false;
      if (index + 1 >= problems.length) { complete(); return true; }
      startProblem(index + 1); return true;
    },
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      if (command.type === 'slash') return this.slash(command.payload);
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
