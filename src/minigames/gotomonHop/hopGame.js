export const HOP_RULES = Object.freeze({
  // The course: 9 columns, 8 rows from the bottom. Rows: start, two roads, the middle bank,
  // two river lanes, the far bank, and the four homes (one plate each) above it.
  // (Three roads and three rivers made a play of about 3 minutes for a child-like bot; two make about 2.)
  cols: 9, start: 0, roads: Object.freeze([1, 2]), middle: 3, river: Object.freeze([4, 5]), bank: 6, homeRow: 7,
  homeCols: Object.freeze([1, 3, 5, 7]),
  // Lane speeds in cells per second, and a little faster each question.
  roadSpeed: Object.freeze({ min: 0.9, max: 1.6 }), riverSpeed: Object.freeze({ min: 0.55, max: 1.0 }), speedUp: 0.03,
  // Carts are 1 or 2 cells with gaps of 2.5-4.5; logs and floating Gotomon are 2-3 cells with gaps of 1-2.
  cart: Object.freeze([1, 2]), cartGap: Object.freeze({ min: 2.5, max: 4.5 }),
  log: Object.freeze([2, 3]), logGap: Object.freeze({ min: 1, max: 2 }),
  // The companion is this wide when a cart meets it; it stays on a log while its centre is this far inside.
  halfW: 0.3, logGrip: 0.1,
  // A hop takes this long (no next hop before); a bump or a splash shows this long before starting again.
  hopMs: 150, oopsMs: 700, homeMs: 1000,
  // Bumps and splashes on one question: after this many everything moves at half speed; after this many more
  // a Gotomon's bubble keeps the companion safe for the rest of the question (no cart bumps it, the water holds it up).
  slowAfter: 3, bubbleAfter: 5,
  // Stars on the road and the middle bank, picked up by hopping on them.
  stars: 2,
});
const R = HOP_RULES;
const TOP = R.cols - 1;

function take(random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('random must be in [0, 1)');
  return value;
}
const between = (random, { min, max }) => min + take(random) * (max - min);
const shuffled = (items, random) => {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(take(random) * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
};

// One lane: things in a loop longer than the course, so they come in from one side and leave at the other.
// x is the left edge of a thing in cells (a cell i spans i - 0.5 .. i + 0.5).
function buildLane(row, kind, dir, speed, random, serial) {
  const items = [];
  let at = 0;
  const sizes = kind === 'road' ? R.cart : R.log, gap = kind === 'road' ? R.cartGap : R.logGap;
  // At least the course and a bit more, so a loop always holds a few things.
  while (at < R.cols + 5 || items.length < 3) {
    const len = sizes[Math.floor(take(random) * sizes.length)];
    items.push({ id: `${row}:${serial.n++}`, offset: at, len, cast: serial.n, float: kind === 'river' && len === 2 });
    at += len + between(random, gap);
  }
  return { row, kind, dir, speed, loop: at, shift: take(random) * at, items };
}
// Where a thing of a lane is now (left edge), wrapped into -loop/2 .. so it slides in from off the course.
const itemX = (lane, item) => {
  const span = lane.loop, start = (R.cols - span) / 2 - 0.5;
  return start + ((((item.offset + lane.shift) % span) + span) % span);
};
export const laneItems = lane => lane.items.map(item => ({ ...item, x: itemX(lane, item) }));

// Nonpersistent Core: crossing the road and the river (like Frogger). The companion hops
// one cell at a time (up, down, left, right) from the bottom: across two roads where
// carts driven by Gotomon go by, a middle bank, two river lanes of logs and floating
// Gotomon to ride (the water itself cannot be stood in), to the far bank. Above it are
// four homes, each with a Gotomon holding a plate. From the bank the child walks
// sideways to the home of the answer and hops in (a home is only entered from the bank,
// never by drifting on a log). The answer's home brings the companion back to the start
// for the next question; another home tells its plate, stays shut, and the answer's home
// glows. A cart or the water sends the companion back to the last bank (the start or
// the middle), never a game over; after three of those on a question everything moves
// at half speed, after five a Gotomon's bubble keeps it safe until the next question (so
// every child gets across). A log that reaches the side of the course slides on under
// the companion, who holds on at the edge until the log has gone. Stars and a waiting Gotomon friend along the
// way. One learning result per question, on its first home; every home its own problem id.
export function createHopGame({ sessionId, random = Math.random, onEvent = () => {}, content, pace = 'normal' }) {
  const problems = content?.problems ?? null;
  const slow = pace === 'slow';
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', seq = 0, activeElapsedMs = 0, index = 0, tries = 0, serial = 0;
  let lanes = [], homes = [], stars = [], friend = null, x = 4, row = 0, hopLeft = 0, oopsLeft = 0, homeLeft = 0, bestRow = 0;
  let mishaps = 0, totalMishaps = 0, helpLevel = 0, starsTaken = 0, friends = 0, hops = 0;
  let answered = 0, correct = 0, incorrect = 0, hintPlateId = null;
  let result = null, lastHome = null, lastOops = null, lastPickup = null, lastBlock = null, lastHelp = null, aborted = false, completeEmitted = false;
  let problem = null, attemptId = null;
  const missed = [];
  const laneSerial = { n: 0 };

  const current = () => problems?.[index] ?? null;
  const laneAt = r => lanes.find(lane => lane.row === r) ?? null;
  const speedFactor = () => (helpLevel >= 1 ? 0.5 : 1) * (slow ? 0.7 : 1);
  const snapshot = () => Object.freeze({
    gameId: 'gotomonHop', mode: 'hop', sessionId, phase, paused, active, aborted, seq, activeElapsedMs, pace: slow ? 'slow' : 'normal',
    cols: R.cols, x, row, hopping: hopLeft > 0, helpLevel, bubble: helpLevel >= 2, mishaps, totalMishaps, hops, bestRow,
    lanes: Object.freeze(lanes.map(lane => Object.freeze({ row: lane.row, kind: lane.kind, dir: lane.dir, speed: lane.speed * speedFactor(),
      items: Object.freeze(laneItems(lane).map(item => Object.freeze(item))) }))),
    homes: Object.freeze(homes.map(home => Object.freeze({ ...home }))),
    stars: Object.freeze(stars.filter(star => !star.taken).map(star => Object.freeze({ ...star }))),
    friend: friend && !friend.met ? Object.freeze({ ...friend }) : null,
    hintPlateId, problemIndex: Math.min(index, problems ? problems.length - 1 : 0), total: problems ? problems.length : 0,
    starsTaken, friends, problem, attemptId, answered, correct, incorrect, result,
    lastHome, lastOops, lastPickup, lastBlock, lastHelp, missed: Object.freeze([...missed]),
  });
  const notify = (type, payload = {}, problemId = problem?.problemId ?? null) => {
    const event = Object.freeze({ version: 1, gameId: 'gotomonHop', sessionId, seq: ++seq, type,
      problemId, activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation observers cannot undo a committed answer. */ }
    finally { notifying = false; }
  };
  const present = () => {
    const item = current();
    problem = Object.freeze({ problemId: `${item.problemId}:${tries}`, contentId: item.contentId, skillId: item.skillId, kind: item.kind,
      prompt: item.prompt, sentence: item.sentence ?? null, answerId: item.answerId, explain: item.explain,
      choices: Object.freeze(homes.map(home => Object.freeze({ choiceId: home.plateId, text: home.text }))), correctChoiceId: item.answerId });
    attemptId = `${problem.problemId}:attempt`;
  };
  // A new question: new lanes (a little faster), new homes, stars and a friend; back to the start.
  const startQuestion = () => {
    const item = current(), boost = 1 + R.speedUp * index;
    lanes = [
      ...R.roads.map((r, i) => buildLane(r, 'road', i % 2 ? 1 : -1, between(random, R.roadSpeed) * boost, random, laneSerial)),
      ...R.river.map((r, i) => buildLane(r, 'river', i % 2 ? -1 : 1, between(random, R.riverSpeed) * boost, random, laneSerial)),
    ];
    const plates = shuffled(item.plates, random);
    homes = R.homeCols.map((col, i) => ({ homeId: `home${i}`, col, plateId: plates[i].plateId, text: plates[i].text, note: plates[i].note ?? null, cast: index * 4 + i, gone: false }));
    const spots = shuffled([...R.roads, R.middle].flatMap(r => Array.from({ length: R.cols }, (_, c) => [c, r])), random);
    stars = spots.slice(0, R.stars).map(([c, r], i) => ({ starId: `${sessionId}:star:${index}:${i}`, x: c, row: r, taken: false }));
    const middleSpots = spots.filter(([c, r]) => r === R.middle && c !== 4 && !stars.some(s => s.x === c && s.row === r));
    friend = { friendId: `${sessionId}:friend:${index}`, x: middleSpots[0][0], row: R.middle, cast: index, met: false };
    x = 4; row = R.start; bestRow = 0; mishaps = 0; helpLevel = 0; tries = 0; hintPlateId = null; phase = 'answering';
    present();
    notify('problemPresented', { skillId: item.skillId, kind: item.kind });
  };
  const complete = () => {
    phase = 'completed'; problem = null; attemptId = null; hintPlateId = null;
    result = Object.freeze({ answered, correct, incorrect, accuracy: answered ? correct / answered : 0, stars: starsTaken, friends, mishaps: totalMishaps, finished: true });
    if (!completeEmitted) { completeEmitted = true; notify('sessionComplete', result); }
  };
  // A cart or the water: back to the bank behind, and help after many.
  const oops = kind => {
    lastOops = Object.freeze({ oops: ++serial, kind, x, row });
    mishaps++; totalMishaps++;
    row = row > R.middle ? R.middle : R.start; x = Math.max(0, Math.min(TOP, Math.round(x)));
    phase = 'oops'; oopsLeft = R.oopsMs; hopLeft = 0;
    const level = mishaps >= R.bubbleAfter ? 2 : mishaps >= R.slowAfter ? 1 : 0;
    if (level > helpLevel) { helpLevel = level; lastHelp = Object.freeze({ help: ++serial, level }); }
  };
  // Is the companion safe where it stands now? (Roads: no cart over it; river: on a log or a floating Gotomon.)
  const check = () => {
    const lane = laneAt(row);
    if (!lane || helpLevel >= 2) return;
    const items = laneItems(lane);
    if (lane.kind === 'road') { if (items.some(item => x + R.halfW > item.x && x - R.halfW < item.x + item.len)) oops('cart'); return; }
    if (!items.some(item => x >= item.x + R.logGrip && x <= item.x + item.len - R.logGrip)) oops('water');
  };
  const pickUp = () => {
    for (const star of stars) {
      if (star.taken || star.row !== row || Math.abs(star.x - x) > 0.5) continue;
      star.taken = true; starsTaken++; lastPickup = Object.freeze({ pickup: ++serial, kind: 'star', x: star.x, row });
    }
    if (friend && !friend.met && friend.row === row && Math.abs(friend.x - x) < 0.5) {
      friend.met = true; friends++; lastPickup = Object.freeze({ pickup: ++serial, kind: 'friend', x: friend.x, row, cast: friend.cast });
    }
  };
  // Hopping into a home from the bank: the answer for this try.
  const enter = home => {
    const item = current(), right = home.plateId === item.answerId, first = tries === 0;
    const problemId = problem.problemId, committedAttempt = attemptId;
    if (first) { answered++; if (right) correct++; else incorrect++; }
    const answer = item.plates.find(p => p.plateId === item.answerId);
    lastHome = Object.freeze({ home: ++serial, homeId: home.homeId, correct: right, first, col: home.col, text: home.text, note: home.note, answer: answer.text, explain: item.explain });
    const payload = { attemptId: committedAttempt, contentId: item.contentId, skillId: item.skillId, chosen: home.plateId };
    if (right) {
      row = R.homeRow; x = home.col; hintPlateId = null;
      phase = 'home'; homeLeft = R.homeMs;
      notify(first ? 'correct' : 'passed', payload, problemId);
      attemptId = `${problemId}:home`;
    } else {
      // The home tells its plate and stays shut; the companion stays on the bank in front of it.
      home.gone = true; hintPlateId = item.answerId;
      if (first) missed.push(Object.freeze({ contentId: item.contentId, prompt: item.prompt, chosen: home.text, explain: item.explain, questionNumber: answered }));
      notify(first ? 'incorrect' : 'retry', payload, problemId);
      tries++; present();
    }
  };
  const step = dt => {
    const factor = speedFactor();
    for (const lane of lanes) lane.shift += lane.dir * lane.speed * factor * dt;
    // Riding a log: carried along, holding on at the side of the course (in the bubble, floating where it is).
    const lane = laneAt(row);
    if (phase === 'answering' && lane?.kind === 'river') {
      const riding = laneItems(lane).some(item => x >= item.x + R.logGrip && x <= item.x + item.len - R.logGrip);
      if (riding) x = Math.max(0, Math.min(TOP, x + lane.dir * lane.speed * factor * dt));
    }
    if (phase === 'answering') check();
  };

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying || !Array.isArray(problems) || !problems.length
        || problems.some(item => item.plates?.length !== R.homeCols.length || !item.plates.some(plate => plate.plateId === item.answerId))) return false;
      startQuestion();
      return true;
    },
    update(dtMs) {
      if (!active || paused || !['answering', 'oops', 'home'].includes(phase) || !Number.isFinite(dtMs) || notifying) return;
      const dt = Math.max(0, Math.min(dtMs, 100));
      activeElapsedMs += dt;
      hopLeft = Math.max(0, hopLeft - dt);
      if (phase === 'oops' && (oopsLeft -= dt) <= 0) phase = 'answering';
      if (phase === 'home' && (homeLeft -= dt) <= 0) {
        if (index + 1 >= problems.length) { complete(); return; }
        index++; startQuestion(); return;
      }
      for (let left = dt; left > 0 && active; left -= 16) step(Math.min(16, left) / 1000);
    },
    setPaused(value) { if (active) paused = !!value; },
    // One hop: dir 'up' | 'down' | 'left' | 'right'.
    hop({ sessionId: s, attemptId: a, dir } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || hopLeft > 0 || s !== sessionId || a !== attemptId) return false;
      const d = { up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0] }[dir];
      if (!d) return false;
      // Up from the bank: into a home, or bump the hedge between homes.
      if (row === R.bank && d[1] === 1) {
        const home = homes.find(h => h.col === Math.round(x) && !h.gone);
        if (!home) { lastBlock = Object.freeze({ block: ++serial, x, gone: homes.some(h => h.col === Math.round(x)) }); return false; }
        hops++; hopLeft = R.hopMs; enter(home); return true;
      }
      const nextRow = row + d[1];
      if (nextRow < R.start || nextRow > R.bank) return false;
      let nextX = x + d[0];
      // On solid ground the companion stands on a cell; on the river it keeps its place on the log.
      if (!laneAt(nextRow) || laneAt(nextRow).kind === 'road') nextX = Math.round(nextX);
      if (nextX < -0.45 || nextX > TOP + 0.45) return false;
      nextX = Math.max(0, Math.min(TOP, nextX));
      x = nextX; row = nextRow; hops++; hopLeft = R.hopMs; bestRow = Math.max(bestRow, row);
      pickUp(); check();
      return true;
    },
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      if (command.type === 'hop') return this.hop(command.payload);
      return false;
    },
    snapshot,
    exit() {
      if (!active) return;
      active = false; attemptId = null; aborted = phase !== 'completed'; observer = null;
    },
  };
}
