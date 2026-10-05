import { pickValues, labelFor, pick, shuffled } from './bubbleContent.js';
import { equationTarget } from '../buildReview.js';

// Board geometry in bubble diameters. Rows are packed like a honeycomb: every other
// row sits half a bubble to the right and holds one bubble less.
export const BUBBLE_RULES = Object.freeze({
  columns: 6, startRows: 4, maxRows: 8, rowHeight: Math.sqrt(3) / 2,
  shooter: Object.freeze({ x: 3, y: 8.2 }), height: 8.8,
  shots: 15, trapped: 5,
  // A new row comes down when the board gets thin, while there is room.
  refillBelow: 10, refillMaxRow: 5,
  minAngle: Math.PI * 0.07, maxAngle: Math.PI * 0.93,
  hitDistance: 0.86, step: 0.05,
});
const R = BUBBLE_RULES;
const keyOf = (row, column) => `${row},${column}`;

// Pure geometry, shared by the Core and the View's aiming guide.
export function createGeometry(shift) {
  const odd = row => ((row + shift) & 1) === 1;
  const width = row => odd(row) ? R.columns - 1 : R.columns;
  const center = (row, column) => ({ x: column + 0.5 + (odd(row) ? 0.5 : 0), y: row * R.rowHeight + 0.5 });
  const neighbours = (row, column) => {
    const side = odd(row) ? [0, 1] : [-1, 0];
    return [[row, column - 1], [row, column + 1], ...side.flatMap(d => [[row - 1, column + d], [row + 1, column + d]])]
      .filter(([r, c]) => r >= 0 && r < R.maxRows && c >= 0 && c < width(r));
  };
  return { odd, width, center, neighbours };
}

// The ball's path for an angle (0 = right, π/2 = straight up): it bounces off the side
// walls and stops at the ceiling or next to the first bubble it meets.
export function tracePath(bubbles, angle) {
  const a = Math.min(R.maxAngle, Math.max(R.minAngle, Number(angle) || Math.PI / 2));
  let x = R.shooter.x, y = R.shooter.y, dx = Math.cos(a), dy = -Math.sin(a);
  const points = [{ x, y }];
  for (let i = 0; i < 4000; i++) {
    x += dx * R.step; y += dy * R.step;
    if (x < 0.5) { x = 1 - x; dx = -dx; points.push({ x: 0.5, y }); }
    if (x > R.columns - 0.5) { x = 2 * (R.columns - 0.5) - x; dx = -dx; points.push({ x: R.columns - 0.5, y }); }
    if (y <= 0.5) { y = 0.5; break; }
    if (bubbles.some(b => (b.x - x) ** 2 + (b.y - y) ** 2 < R.hitDistance ** 2)) break;
  }
  points.push({ x, y });
  return { angle: a, points, end: { x, y } };
}

// Where a shot at this angle ends up: the empty cell it sticks in (next to a bubble or
// on the ceiling) and the bubbles around that cell.
export function predictShot(bubbles, shift, angle) {
  const geo = createGeometry(shift), taken = new Map(bubbles.map(bubble => [keyOf(bubble.row, bubble.column), bubble]));
  const path = tracePath(bubbles, angle);
  let land = null;
  for (let row = 0; row < R.maxRows; row++) for (let column = 0; column < geo.width(row); column++) {
    if (taken.has(keyOf(row, column))) continue;
    if (row > 0 && !geo.neighbours(row, column).some(([r, c]) => taken.has(keyOf(r, c)))) continue;
    const { x, y } = geo.center(row, column), d = (x - path.end.x) ** 2 + (y - path.end.y) ** 2;
    if (!land || d < land.d) land = { row, column, x, y, d };
  }
  const touching = land ? geo.neighbours(land.row, land.column).map(([r, c]) => taken.get(keyOf(r, c))).filter(Boolean) : [];
  return { path, land, touching };
}
// Angles tried when checking that a loaded bubble has somewhere to go.
export const SCAN_ANGLES = Object.freeze(Array.from({ length: 121 }, (_, i) => R.minAngle + (R.maxAngle - R.minAngle) * i / 120));

// Nonpersistent Core: a bubble shooter. The companion shoots a bubble written with a
// calculation; it sticks when it touches a bubble with the same answer, and three or
// more with the same answer pop. Bubbles cut off from the ceiling fall. Some bubbles
// hold trapped Gotomon, freed when their bubble pops or falls. A shot that touches no
// bubble with its answer bounces back: the bubbles it could join glow, and the same
// bubble stays loaded. No game over. One learning result per loaded bubble, on the
// first shot; each shot is its own problem id so the Host's feedback timing restarts.
export function createBubbleGame({ sessionId, random = Math.random, onEvent = () => {}, content }) {
  const level = content?.level === 'times' ? 'times' : 'addsub', carriers = content?.carriers ?? [];
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', seq = 0, activeElapsedMs = 0, loaded = null, upcoming = null, loadSerial = 0, tries = 0, shotSerial = 0, bubbleSerial = 0;
  let answered = 0, correct = 0, incorrect = 0, popped = 0, dropped = 0, bigPops = 0, shift = 0, version = 0;
  let result = null, lastAnswer = null, aborted = false, completeEmitted = false, problem = null, attemptId = null, hintIds = [];
  const cells = new Map(), freed = [], missed = [];
  const values = pickValues(level, random);
  let geo = createGeometry(shift);

  const bubbles = () => [...cells.values()];
  const place = (row, column, value, gotomon = null) => {
    const { x, y } = geo.center(row, column);
    const bubble = { bubbleId: `${sessionId}:b${++bubbleSerial}`, row, column, x, y, value, label: labelFor(value, level, random), gotomon };
    cells.set(keyOf(row, column), bubble); return bubble;
  };
  // Neighbours often share an answer, so the board has groups to aim for.
  const fillRow = row => {
    for (let column = 0; column < geo.width(row); column++) {
      const near = geo.neighbours(row, column).map(([r, c]) => cells.get(keyOf(r, c))).filter(Boolean);
      place(row, column, near.length && random() < 0.45 ? pick(near, random).value : pick(values, random));
    }
  };
  const reposition = () => { for (const bubble of cells.values()) Object.assign(bubble, geo.center(bubble.row, bubble.column)); };
  // A new row pushes in at the top; the others move down one row and keep their place.
  const pushRow = () => {
    const moved = bubbles().map(bubble => ({ ...bubble, row: bubble.row + 1 }));
    cells.clear(); shift ^= 1; geo = createGeometry(shift);
    for (const bubble of moved) cells.set(keyOf(bubble.row, bubble.column), bubble);
    reposition(); fillRow(0); version++;
  };
  // Bubbles the ball can reach: next to an empty cell that opens down to the shooter
  // (a hole walled in by other bubbles does not count).
  const exposed = () => {
    const open = new Set(), stack = [];
    for (let column = 0; column < geo.width(R.maxRows - 1); column++) if (!cells.has(keyOf(R.maxRows - 1, column))) stack.push([R.maxRows - 1, column]);
    while (stack.length) {
      const [row, column] = stack.pop(), key = keyOf(row, column);
      if (open.has(key) || cells.has(key)) continue; open.add(key);
      for (const [r, c] of geo.neighbours(row, column)) if (!open.has(keyOf(r, c)) && !cells.has(keyOf(r, c))) stack.push([r, c]);
    }
    return bubbles().filter(bubble => geo.neighbours(bubble.row, bubble.column).some(([r, c]) => open.has(keyOf(r, c))));
  };
  // Answers a shot can really join: some angle lands the ball next to one of them.
  const reachable = () => {
    const list = bubbles(), found = new Set();
    for (const angle of SCAN_ANGLES) for (const bubble of predictShot(list, shift, angle).touching) found.add(bubble.value);
    return found;
  };
  const chooseValue = () => {
    const can = reachable(), open = exposed().filter(bubble => can.has(bubble.value));
    const counts = new Map(); for (const bubble of open) counts.set(bubble.value, (counts.get(bubble.value) ?? 0) + 1);
    // Prefer answers already in a pair, so a good shot pops.
    const pairs = [...counts].filter(([, n]) => n >= 2).map(([value]) => value);
    return pick(pairs.length ? pairs : counts.size ? [...counts.keys()] : [...can], random);
  };
  const load = value => ({ loadId: `${sessionId}:load:${++loadSerial}`, value, label: labelFor(value, level, random) });
  const snapshot = () => Object.freeze({
    gameId: 'gotomonBubble', mode: 'bubble', sessionId, phase, paused, active, aborted, seq, activeElapsedMs, level, version, shift,
    bubbles: Object.freeze(bubbles().map(bubble => Object.freeze({ ...bubble }))), loaded, upcoming, hintIds: Object.freeze([...hintIds]),
    shot: answered, shots: R.shots, popped, dropped, bigPops, freed: Object.freeze([...freed]), trapped: carriers.length,
    problem, attemptId, answered, correct, incorrect, result, lastAnswer, missed: Object.freeze([...missed]),
  });
  const notify = (type, payload = {}) => {
    const event = Object.freeze({ version: 1, gameId: 'gotomonBubble', sessionId, seq: ++seq, type,
      problemId: problem?.problemId ?? null, activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation observers cannot undo a committed answer. */ }
    finally { notifying = false; }
  };
  const openShot = () => {
    problem = Object.freeze({ problemId: `${loaded.loadId}:${tries}`, contentId: `${level}:${loaded.value}`, skillId: `bubble:${level}:${loaded.value}`,
      prompt: loaded.label, answer: loaded.value });
    attemptId = `${problem.problemId}:attempt`; lastAnswer = null; phase = 'answering';
  };
  const nextLoad = () => {
    tries = 0; hintIds = [];
    loaded = upcoming && reachable().has(upcoming.value) ? upcoming : load(chooseValue());
    upcoming = load(chooseValue());
    notify('problemPresented', { skillId: `bubble:${level}:${loaded.value}` });
    openShot();
  };
  const complete = cleared => {
    phase = 'completed'; problem = null; attemptId = null; hintIds = [];
    result = Object.freeze({ answered, correct, incorrect, accuracy: answered ? correct / answered : 0, popped, dropped, bigPops,
      freed: freed.length, cleared: !!cleared, finished: true });
    if (!completeEmitted) { completeEmitted = true; notify('sessionComplete', result); }
  };
  // Bubbles still hanging from the ceiling, found from the top row.
  const hanging = () => {
    const seen = new Set(), stack = bubbles().filter(bubble => bubble.row === 0);
    while (stack.length) {
      const bubble = stack.pop();
      if (seen.has(bubble)) continue; seen.add(bubble);
      for (const [r, c] of geo.neighbours(bubble.row, bubble.column)) { const other = cells.get(keyOf(r, c)); if (other && !seen.has(other)) stack.push(other); }
    }
    return seen;
  };
  return {
    enter() {
      if (!active || phase !== 'ready' || notifying) return false;
      for (let row = 0; row < R.startRows; row++) fillRow(row);
      // Trapped Gotomon wait in the upper rows, so freeing them takes a few pops.
      const spots = shuffled(bubbles().filter(bubble => bubble.row <= 2), random).slice(0, Math.min(R.trapped, carriers.length));
      spots.forEach((bubble, i) => { bubble.gotomon = Object.freeze({ ...carriers[i] }); });
      version++;
      nextLoad(); return true;
    },
    update(dtMs) {
      if (!active || paused || ['ready', 'completed'].includes(phase) || !Number.isFinite(dtMs)) return;
      activeElapsedMs += Math.max(0, dtMs);
    },
    setPaused(value) { if (active) paused = !!value; },
    shoot({ sessionId: sourceSession, attemptId: sourceAttempt, angle } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || sourceSession !== sessionId || sourceAttempt !== attemptId) return false;
      if (!Number.isFinite(angle)) return false;
      const { path, land, touching } = predictShot(bubbles(), shift, angle);
      if (!land) return false;
      const right = touching.some(bubble => bubble.value === loaded.value), first = tries === 0;
      const committedAttempt = attemptId; attemptId = null; phase = 'feedback';
      if (first) { answered++; if (right) correct++; else incorrect++; }
      let pop = [], fall = [], rescued = [];
      if (right) {
        const shot = place(land.row, land.column, loaded.value); shot.label = loaded.label;
        const group = new Set([shot]), stack = [shot];
        while (stack.length) {
          const bubble = stack.pop();
          for (const [r, c] of geo.neighbours(bubble.row, bubble.column)) {
            const other = cells.get(keyOf(r, c));
            if (other && other.value === loaded.value && !group.has(other)) { group.add(other); stack.push(other); }
          }
        }
        if (group.size >= 3) {
          pop = [...group]; pop.forEach(bubble => cells.delete(keyOf(bubble.row, bubble.column)));
          const keep = hanging(); fall = bubbles().filter(bubble => !keep.has(bubble));
          fall.forEach(bubble => cells.delete(keyOf(bubble.row, bubble.column)));
          popped += pop.length; dropped += fall.length; if (pop.length + fall.length >= 5) bigPops++;
          rescued = [...pop, ...fall].filter(bubble => bubble.gotomon).map(bubble => bubble.gotomon);
          freed.push(...rescued);
        }
        hintIds = [];
        version++;
      } else {
        tries++;
        hintIds = exposed().filter(bubble => bubble.value === loaded.value).map(bubble => bubble.bubbleId);
        if (first) missed.push(Object.freeze({ contentId: problem.contentId, label: loaded.label, answer: loaded.value,
          touched: Object.freeze(touching.map(bubble => bubble.label)), questionNumber: answered,
          build: equationTarget({ question: loaded.label, answer: loaded.value }) }));
      }
      const view = bubble => Object.freeze({ bubbleId: bubble.bubbleId, x: bubble.x, y: bubble.y, label: bubble.label, gotomon: bubble.gotomon ?? null });
      lastAnswer = Object.freeze({ attemptId: committedAttempt, shot: ++shotSerial, correct: right, first, value: loaded.value, label: loaded.label,
        path: Object.freeze(path.points.map(point => Object.freeze(point))), land: Object.freeze({ row: land.row, column: land.column, x: land.x, y: land.y }),
        touched: Object.freeze(touching.map(bubble => Object.freeze({ label: bubble.label, value: bubble.value }))),
        popped: Object.freeze(pop.map(view)), dropped: Object.freeze(fall.map(view)), freed: Object.freeze(rescued) });
      const payload = { attemptId: committedAttempt, contentId: problem.contentId, skillId: problem.skillId, popped: pop.length, dropped: fall.length, freed: rescued.length };
      // One learning result per loaded bubble: the first shot. Later shots are just play.
      if (first) notify(right ? 'correct' : 'incorrect', payload);
      else notify(right ? 'stuck' : 'retry', payload);
      return true;
    },
    next({ sessionId: sourceSession } = {}) {
      if (!active || paused || notifying || sourceSession !== sessionId || phase !== 'feedback') return false;
      if (!lastAnswer?.correct) { openShot(); return true; }
      if (!cells.size) { complete(true); return true; }
      if (answered >= R.shots) { complete(false); return true; }
      if (cells.size < R.refillBelow && Math.max(...bubbles().map(bubble => bubble.row)) < R.refillMaxRow) pushRow();
      nextLoad();
      return true;
    },
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      if (command.type === 'shoot') return this.shoot(command.payload);
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
