import { buildTarget } from '../buildReview.js';

export const GOLF_RULES = Object.freeze({
  // The course is W wide and 1 high; the tee is on the left, the four cups on the right.
  W: 1.6, tee: Object.freeze([0.15, 0.5]),
  ballR: 0.022, cupR: 0.05,
  // A full shot starts this fast (course units per second); the ball slows by decel + drag * speed.
  maxSpeed: 2.6, decel: 0.75, drag: 0.55, stopSpeed: 0.04,
  // Walls give back this share of the speed; Gotomon bumpers bounce at least this fast.
  wallBounce: 0.8, bumperSpeed: 1.0,
  // A ball slower than this drops into the open cup it rolls over; near it, it is pulled in a little.
  dropSpeed: 1.15, pullRange: 2.2, pull: 1.6,
  // After this many shots without reaching the cup, a Gotomon carries the ball nearer:
  // first to an open spot before the cups, then right in front of the chosen cup.
  helpAfter: 4, nearCup: 0.14,
  // The cup's flag stays on screen this long after the answer's cup before the next hole.
  sunkMs: 1400,
});
const R = GOLF_RULES;
const CUPS = Object.freeze({
  arc: [[1.38, 0.18], [1.46, 0.4], [1.46, 0.62], [1.38, 0.84]],
  square: [[1.25, 0.25], [1.47, 0.3], [1.25, 0.75], [1.47, 0.7]],
});
// Six courses (walls are boxes; bumpers are round Gotomon; a mover walks up and down).
// approach: where a helping Gotomon first puts the ball (an open spot from which every cup can be reached).
// The wall lengths of ジグザグ were picked by trying every shot: each cup can still be reached from the tee.
export const GOLF_COURSES = Object.freeze([
  { name: 'ひろば', cups: CUPS.arc, walls: [], bumpers: [], approach: [1.0, 0.5] },
  { name: 'まんなかの かべ', cups: CUPS.square, walls: [[0.72, 0.32, 0.8, 0.68]], bumpers: [], approach: [1.05, 0.5] },
  { name: 'ゴトモン バンパー', cups: CUPS.arc, walls: [], bumpers: [[0.7, 0.3, 0.07], [0.92, 0.5, 0.07], [0.7, 0.7, 0.07]], approach: [1.12, 0.5] },
  { name: 'ジグザグ', cups: CUPS.arc, walls: [[0.5, 0, 0.57, 0.3], [0.85, 0.7, 0.92, 1]], bumpers: [], approach: [1.15, 0.5] },
  { name: 'うごくゴトモン', cups: CUPS.arc, walls: [], bumpers: [], movers: [[0.9, 0.15, 0.85, 0.08, 3200]], approach: [1.15, 0.5] },
  { name: 'まもりの かべ', cups: CUPS.square, walls: [[1.14, 0.4, 1.2, 0.6]], bumpers: [[0.7, 0.25, 0.07], [0.7, 0.75, 0.07]], approach: [0.98, 0.5] },
].map(course => Object.freeze(course)));

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

// The round things on a course at a time: bumpers stand still, movers walk up and down.
export function bumpersAt(hole, timeMs) {
  const still = hole.bumpers.map(([x, y, r], i) => ({ id: `b${i}`, x, y, r, cast: i }));
  const moving = hole.movers.map(([x, y1, y2, r, period], i) => ({ id: `m${i}`, x, r, cast: hole.bumpers.length + i,
    y: y1 + (y2 - y1) * (0.5 - 0.5 * Math.cos(2 * Math.PI * timeMs / period)) }));
  return [...still, ...moving];
}

// One small step of a rolling ball (mutates ball {x, y, vx, vy}). Pure apart from that:
// the Core and the aiming guide use the same rules. Only an open cup takes the ball
// (the others have a Gotomon's lid on them). Returns the cup it dropped into, or null.
export function stepBall(hole, ball, dt, timeMs) {
  const r = R.ballR;
  let speed = Math.hypot(ball.vx, ball.vy);
  // The open cup: pulls the ball in when near and slow enough, takes it when over it and slow enough.
  for (const cup of hole.cups) {
    if (!cup.open) continue;
    const dx = cup.x - ball.x, dy = cup.y - ball.y, d = Math.hypot(dx, dy);
    if (d < R.cupR && speed < R.dropSpeed) return cup;
    if (d < R.cupR * R.pullRange && speed < R.dropSpeed && d > 1e-6) { ball.vx += dx / d * R.pull * dt; ball.vy += dy / d * R.pull * dt; }
  }
  speed = Math.hypot(ball.vx, ball.vy);
  const slow = Math.max(0, speed - (R.decel + R.drag * speed) * dt);
  if (speed > 0) { ball.vx *= slow / speed; ball.vy *= slow / speed; }
  ball.x += ball.vx * dt; ball.y += ball.vy * dt;
  // The course's edges.
  if (ball.x < r) { ball.x = r; ball.vx = Math.abs(ball.vx) * R.wallBounce; }
  if (ball.x > R.W - r) { ball.x = R.W - r; ball.vx = -Math.abs(ball.vx) * R.wallBounce; }
  if (ball.y < r) { ball.y = r; ball.vy = Math.abs(ball.vy) * R.wallBounce; }
  if (ball.y > 1 - r) { ball.y = 1 - r; ball.vy = -Math.abs(ball.vy) * R.wallBounce; }
  // Walls: push out along the side hit and bounce.
  for (const [x1, y1, x2, y2] of hole.walls) {
    const cx = Math.max(x1, Math.min(x2, ball.x)), cy = Math.max(y1, Math.min(y2, ball.y));
    let nx = ball.x - cx, ny = ball.y - cy, d = Math.hypot(nx, ny);
    if (d >= r) continue;
    if (d < 1e-9) {
      // The center went inside: out through the nearest side.
      const sides = [[ball.x - x1, -1, 0], [x2 - ball.x, 1, 0], [ball.y - y1, 0, -1], [y2 - ball.y, 0, 1]].sort((a, b) => a[0] - b[0]);
      [, nx, ny] = sides[0];
      ball.x = nx ? (nx < 0 ? x1 - r : x2 + r) : ball.x; ball.y = ny ? (ny < 0 ? y1 - r : y2 + r) : ball.y;
    } else { nx /= d; ny /= d; ball.x = cx + nx * r; ball.y = cy + ny * r; }
    const vn = ball.vx * nx + ball.vy * ny;
    if (vn < 0) { ball.vx -= (1 + R.wallBounce) * vn * nx; ball.vy -= (1 + R.wallBounce) * vn * ny; }
  }
  // Gotomon bumpers: boing.
  for (const b of bumpersAt(hole, timeMs)) {
    let nx = ball.x - b.x, ny = ball.y - b.y; const d = Math.hypot(nx, ny);
    if (d >= b.r + r || d < 1e-9) continue;
    nx /= d; ny /= d; ball.x = b.x + nx * (b.r + r); ball.y = b.y + ny * (b.r + r);
    const vn = ball.vx * nx + ball.vy * ny;
    if (vn < 0) { ball.vx -= 2 * vn * nx; ball.vy -= 2 * vn * ny; }
    const s = Math.hypot(ball.vx, ball.vy);
    if (s < R.bumperSpeed) { const k = R.bumperSpeed / Math.max(s, 1e-6); ball.vx = (s ? ball.vx * k : nx * R.bumperSpeed); ball.vy = (s ? ball.vy * k : ny * R.bumperSpeed); }
    ball.bumped = b.id;
  }
  return null;
}
export const launch = (angle, power) => ({ vx: Math.cos(angle) * R.maxSpeed * power, vy: Math.sin(angle) * R.maxSpeed * power });

// The way the ball would roll from (x, y), for the aiming guide: points until it has rolled `length`.
export function tracePath(hole, x, y, angle, power, timeMs, length = 0.7) {
  const ball = { x, y, ...launch(angle, power) }, points = [[x, y]];
  let rolled = 0, t = timeMs;
  for (let i = 0; i < 600 && rolled < length && Math.hypot(ball.vx, ball.vy) > R.stopSpeed; i++) {
    const px = ball.x, py = ball.y;
    if (stepBall(hole, ball, 0.008, t += 8)) break;
    rolled += Math.hypot(ball.x - px, ball.y - py);
    if (i % 3 === 0) points.push([ball.x, ball.y]);
  }
  points.push([ball.x, ball.y]);
  return points;
}

// Builds the holes: the six courses in order, then again upside down; the plates go to
// the cups in a new order. Every cup starts with its lid on (open: false).
export function buildGolfHoles(problems, random) {
  return problems.map((item, index) => {
    const course = GOLF_COURSES[index % GOLF_COURSES.length], flip = index >= GOLF_COURSES.length;
    const fy = y => (flip ? 1 - y : y);
    const plates = shuffled(item.plates, random);
    return {
      name: course.name, flip,
      walls: course.walls.map(([x1, y1, x2, y2]) => [x1, Math.min(fy(y1), fy(y2)), x2, Math.max(fy(y1), fy(y2))]),
      bumpers: course.bumpers.map(([x, y, r]) => [x, fy(y), r]),
      movers: (course.movers ?? []).map(([x, y1, y2, r, period]) => [x, fy(y1), fy(y2), r, period]),
      cups: course.cups.map(([x, y], i) => {
        // In front of the cup, toward the tee: where the second help puts the ball.
        const dx = R.tee[0] - x, dy = R.tee[1] - fy(y), d = Math.hypot(dx, dy);
        return { cupId: `cup${i}`, x, y: fy(y), near: [x + dx / d * R.nearCup, fy(y) + dy / d * R.nearCup],
          plateId: plates[i].plateId, text: plates[i].text, note: plates[i].note ?? null, open: false, gone: false };
      }),
      approach: [course.approach[0], fy(course.approach[1])],
    };
  });
}

// Nonpersistent Core: mini golf. On each of twelve holes four cups wait on the right,
// each with a flag whose plate a Gotomon holds. The child first taps the flag of the
// answer (that is the answer: a Gotomon puts lids on the other cups, so a ball that
// rolls over them never counts), then pulls the ball back and lets go (an angle and a
// power). The ball rolls, bounces off walls and round Gotomon bumpers (one walks up and
// down), and drops into the open cup when it rolls over it slowly enough. The answer's
// cup ends the hole; another cup tells what its plate was, stays shut, and the answer's
// flag glows for the next choice. Until the first shot after a choice the child may
// choose again. After four shots without the cup a Gotomon carries the ball nearer
// (first before the cups, then in front of the chosen cup). Shots are counted (one shot
// is a ホールインワン). No time limit, no game over. One learning result per hole, on its
// first chosen cup reached; every cup reached is its own problem id.
export function createGolfGame({ sessionId, random = Math.random, onEvent = () => {}, content, pace = 'normal' }) {
  const problems = content?.problems ?? null;
  const slow = pace === 'slow';
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', seq = 0, activeElapsedMs = 0, worldMs = 0, index = 0, tries = 0, serial = 0;
  let holes = null, ball = null, from = null, shots = 0, sinceCup = 0, helpLevel = 0, totalShots = 0, holeInOnes = 0, sunkMs = 0;
  let chosen = null, shotSinceChoice = false, hintPlateId = null;
  let answered = 0, correct = 0, incorrect = 0, helped = 0;
  let result = null, lastCup = null, lastShot = null, lastHelp = null, aborted = false, completeEmitted = false, problem = null, attemptId = null;
  const missed = [];

  const current = () => problems?.[index] ?? null;
  const hole = () => holes?.[index] ?? null;
  const snapshot = () => {
    const h = hole();
    return Object.freeze({
      gameId: 'gotomonGolf', mode: 'golf', sessionId, phase, paused, active, aborted, seq, activeElapsedMs, worldMs, pace: slow ? 'slow' : 'normal',
      W: R.W, tee: R.tee,
      hole: h ? Object.freeze({ name: h.name, flip: h.flip, walls: h.walls,
        cups: Object.freeze(h.cups.map(({ near, ...cup }) => Object.freeze(cup))),
        bumpers: Object.freeze(bumpersAt(h, worldMs).map(b => Object.freeze(b))),
        // The course as stepBall reads it (with the cups above), for the aiming guide's tracePath.
        course: Object.freeze({ walls: h.walls, bumpers: h.bumpers, movers: h.movers }) }) : null,
      ball: ball ? Object.freeze({ x: ball.x, y: ball.y, moving: phase === 'rolling' }) : null,
      chosenPlateId: chosen?.plateId ?? null, canChoose: (phase === 'choosing' || phase === 'aiming') && !shotSinceChoice,
      shots, totalShots, holeInOnes, helped, hintPlateId, problemIndex: Math.min(index, problems ? problems.length - 1 : 0), total: problems ? problems.length : 0,
      problem, attemptId, answered, correct, incorrect, result, lastCup, lastShot, lastHelp, missed: Object.freeze([...missed]),
    });
  };
  const notify = (type, payload = {}, problemId = problem?.problemId ?? null) => {
    const event = Object.freeze({ version: 1, gameId: 'gotomonGolf', sessionId, seq: ++seq, type,
      problemId, activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation observers cannot undo a committed answer. */ }
    finally { notifying = false; }
  };
  const present = () => {
    const item = current(), h = hole();
    problem = Object.freeze({ problemId: `${item.problemId}:${tries}`, contentId: item.contentId, skillId: item.skillId, kind: item.kind,
      prompt: item.prompt, sentence: item.sentence ?? null, answerId: item.answerId, explain: item.explain,
      choices: Object.freeze(h.cups.map(cup => Object.freeze({ choiceId: cup.plateId, text: cup.text }))), correctChoiceId: item.answerId });
    attemptId = `${problem.problemId}:attempt`;
  };
  // Back to choosing a flag: every lid goes on, no cup is chosen.
  const toChoosing = () => {
    for (const cup of hole().cups) cup.open = false;
    chosen = null; shotSinceChoice = false; sinceCup = 0; helpLevel = 0; phase = 'choosing';
  };
  const startHole = () => {
    ball = { x: R.tee[0], y: R.tee[1], vx: 0, vy: 0 }; shots = 0; tries = 0; hintPlateId = null; from = [...R.tee];
    toChoosing(); present();
    notify('problemPresented', { skillId: current().skillId, kind: current().kind });
  };
  const complete = () => {
    phase = 'completed'; problem = null; attemptId = null; hintPlateId = null; chosen = null;
    result = Object.freeze({ answered, correct, incorrect, accuracy: answered ? correct / answered : 0, shots: totalShots, holeInOnes, helped, finished: true });
    if (!completeEmitted) { completeEmitted = true; notify('sessionComplete', result); }
  };
  // The ball dropped into the chosen cup: the answer for this try.
  const sink = cup => {
    const item = current(), right = cup.plateId === item.answerId, first = tries === 0;
    const problemId = problem.problemId, committedAttempt = attemptId;
    if (first) { answered++; if (right) correct++; else incorrect++; }
    const answer = item.plates.find(p => p.plateId === item.answerId);
    lastCup = Object.freeze({ cup: ++serial, cupId: cup.cupId, correct: right, first, x: cup.x, y: cup.y, text: cup.text, note: cup.note, answer: answer.text, explain: item.explain, shots, holeInOne: right && shots === 1 });
    const payload = { attemptId: committedAttempt, contentId: item.contentId, skillId: item.skillId, chosen: cup.plateId };
    if (right) {
      if (shots === 1) holeInOnes++;
      ball = { x: cup.x, y: cup.y, vx: 0, vy: 0 }; hintPlateId = null;
      phase = 'sunk'; sunkMs = R.sunkMs;
      notify(first ? 'correct' : 'passed', payload, problemId);
      attemptId = `${problemId}:sunk`;
    } else {
      // The cup tells its plate and stays shut; the ball goes back to where it was hit from.
      cup.gone = true; hintPlateId = item.answerId;
      ball = { x: from[0], y: from[1], vx: 0, vy: 0 };
      if (first) missed.push(Object.freeze({ contentId: item.contentId, prompt: item.prompt, chosen: cup.text, explain: item.explain, build: buildTarget(item), questionNumber: answered }));
      toChoosing();
      notify(first ? 'incorrect' : 'retry', payload, problemId);
      tries++; present();
    }
  };
  // While the ball waits, a walking Gotomon that reaches it nudges it aside (no shot, no bounce).
  const standClear = () => {
    for (const b of bumpersAt(hole(), worldMs)) {
      const nx = ball.x - b.x, ny = ball.y - b.y, d = Math.hypot(nx, ny), reach = b.r + R.ballR;
      if (d >= reach) continue;
      const ux = d > 1e-6 ? nx / d : -1, uy = d > 1e-6 ? ny / d : 0;
      ball.x = Math.min(R.W - R.ballR, Math.max(R.ballR, b.x + ux * reach));
      ball.y = Math.min(1 - R.ballR, Math.max(R.ballR, b.y + uy * reach));
    }
  };
  const roll = dt => {
    const h = hole();
    for (let left = dt; left > 0 && phase === 'rolling'; left -= 8) {
      const t = Math.min(8, left);
      worldMs += t;
      const cup = stepBall(h, ball, t / 1000, worldMs);
      if (cup) { sink(cup); return; }
      if (Math.hypot(ball.vx, ball.vy) <= R.stopSpeed) {
        ball.vx = 0; ball.vy = 0; phase = 'aiming';
        // Many shots without the cup: a Gotomon carries the ball nearer.
        if (++sinceCup >= R.helpAfter) {
          sinceCup = 0; helped++; helpLevel = Math.min(2, helpLevel + 1);
          [ball.x, ball.y] = helpLevel === 1 ? h.approach : chosen.near;
          lastHelp = Object.freeze({ help: ++serial, level: helpLevel, x: ball.x, y: ball.y });
        }
        return;
      }
    }
  };

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying || !Array.isArray(problems) || !problems.length
        || problems.some(item => item.plates?.length !== 4 || !item.plates.some(plate => plate.plateId === item.answerId))) return false;
      holes = buildGolfHoles(problems, random);
      startHole();
      return true;
    },
    update(dtMs) {
      if (!active || paused || !['choosing', 'aiming', 'rolling', 'sunk'].includes(phase) || !Number.isFinite(dtMs) || notifying) return;
      // ゆっくり: the world (rolling, the walking Gotomon) runs slower.
      const dt = Math.max(0, Math.min(dtMs, 100)) * (slow ? 0.7 : 1);
      activeElapsedMs += Math.max(0, Math.min(dtMs, 100));
      if (phase === 'rolling') { roll(dt); return; }
      worldMs += dt;
      if (phase === 'choosing' || phase === 'aiming') standClear();
      else if (phase === 'sunk' && (sunkMs -= dtMs) <= 0) {
        if (index + 1 >= problems.length) { complete(); return; }
        index++; startHole();
      }
    },
    setPaused(value) { if (active) paused = !!value; },
    // Chooses the flag (the answer for this try): its cup opens, the others get lids.
    // Allowed until the first shot after the choice.
    choose({ sessionId: s, attemptId: a, plateId } = {}) {
      if (!active || paused || notifying || !['choosing', 'aiming'].includes(phase) || shotSinceChoice || s !== sessionId || a !== attemptId) return false;
      const cup = hole().cups.find(c => c.plateId === plateId && !c.gone);
      if (!cup) return false;
      for (const c of hole().cups) c.open = c === cup;
      chosen = cup; phase = 'aiming';
      return true;
    },
    // Hits the ball toward the chosen cup: angle in radians (0 is to the right, y goes down), power 0..1.
    shoot({ sessionId: s, attemptId: a, angle, power } = {}) {
      if (!active || paused || notifying || phase !== 'aiming' || !chosen || s !== sessionId || a !== attemptId) return false;
      if (!Number.isFinite(angle) || !Number.isFinite(power) || power <= 0 || power > 1) return false;
      from = [ball.x, ball.y];
      Object.assign(ball, launch(angle, power));
      shots++; totalShots++; shotSinceChoice = true; phase = 'rolling';
      lastShot = Object.freeze({ shot: ++serial, angle, power });
      return true;
    },
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      if (command.type === 'choose') return this.choose(command.payload);
      if (command.type === 'shoot') return this.shoot(command.payload);
      return false;
    },
    snapshot,
    exit() {
      if (!active) return;
      active = false; attemptId = null; aborted = phase !== 'completed'; observer = null;
    },
  };
}
