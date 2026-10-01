export const JUMP_RULES = Object.freeze({
  // Four answer clouds per row, across the tower (x is 0..1 of its width; y is in tower heights, up).
  clouds: 4, cloudW: 0.23,
  // One plain bounce rises this high; a right cloud sends the companion this high (past the gap to the next part).
  jump: 0.3, superJump: 1.05, spring: 0.52,
  // Seconds to the top of a plain bounce (normal / ゆっくり): the same heights, played slower.
  apexSec: Object.freeze({ normal: 0.46, slow: 0.62 }),
  // Sideways speed in tower widths per second (normal / ゆっくり).
  run: Object.freeze({ normal: 1.0, slow: 0.78 }),
  // Ledges between rows: how far apart, and how wide.
  gap: Object.freeze({ min: 0.15, max: 0.21 }), ledgeW: Object.freeze({ min: 0.17, max: 0.24 }),
  // Each part climbs to its row of clouds; the next part starts this far above the row.
  partLedges: Object.freeze({ min: 5, max: 6 }), above: 0.45, below: 0.17,
  // The camera keeps the companion this far above the bottom of the view.
  follow: 0.36, playerW: 0.09,
  // After this many bounces in a row that climb no higher (on a ledge or the trampoline), the next one reaches the clouds.
  bigBounceAfter: 2,
  // After a slip, with no steering for this long, the companion drifts to the glowing cloud.
  helpAfterMs: 5000,
  // Moving ledges from this part on, springs from this one; stars and a balloon friend in every part.
  movingFrom: 3, springFrom: 1, stars: 3,
});
const R = JUMP_RULES;

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
const wrap = x => ((x % 1) + 1) % 1;
// Sideways distance on the tower, whose sides join.
const across = (a, b) => { const d = Math.abs(wrap(a) - wrap(b)); return Math.min(d, 1 - d); };

// Builds the tower: for each question a part of ledges and, on top, its row of clouds.
// The last ledge of a part is always just under the row, so the row can be reached.
function buildTower(problems, random, sessionId) {
  const ledges = [], rows = [], stars = [], balloons = [];
  let serial = 0, y = 0;
  problems.forEach((item, part) => {
    const count = R.partLedges.min + Math.floor(take(random) * (R.partLedges.max - R.partLedges.min + 1));
    let x = 0.5;
    const start = y;
    for (let i = 0; i < count; i++) {
      y += R.gap.min + take(random) * (R.gap.max - R.gap.min);
      // Each ledge a step away from the last (never straight above), so the climb wanders.
      x = wrap(x + (take(random) < 0.5 ? -1 : 1) * (0.22 + take(random) * 0.3));
      const kind = part >= R.springFrom && i === count - 3 && take(random) < 0.6 ? 'spring'
        : part >= R.movingFrom && i > 0 && i < count - 1 && take(random) < 0.35 ? 'move' : 'plain';
      ledges.push({ ledgeId: `${sessionId}:ledge:${serial++}`, part, x: Math.min(0.85, Math.max(0.15, x)), y,
        w: R.ledgeW.min + take(random) * (R.ledgeW.max - R.ledgeW.min), kind,
        vx: kind === 'move' ? (take(random) < 0.5 ? -1 : 1) * (0.16 + take(random) * 0.1) : 0 });
    }
    // The ledge under the row: wide and near enough for a plain bounce to pass the clouds.
    y += 0.04;
    const rowY = y + R.below;
    ledges.push({ ledgeId: `${sessionId}:ledge:${serial++}`, part, x: 0.25 + take(random) * 0.5, y, w: 0.3, kind: 'plain', vx: 0 });
    rows.push({ rowId: `${sessionId}:row:${part}`, part, y: rowY, plates: shuffled(item.plates, random) });
    // Stars between the ledges, and one Gotomon with a balloon off to the side, up high.
    for (let s = 0; s < R.stars; s++) {
      stars.push({ starId: `${sessionId}:star:${part}:${s}`, part, x: 0.1 + take(random) * 0.8, y: start + 0.2 + (rowY - start - 0.35) * (s + take(random)) / R.stars, taken: false });
    }
    balloons.push({ balloonId: `${sessionId}:balloon:${part}`, part, cast: part, x: take(random) < 0.5 ? 0.1 : 0.9, y: start + (rowY - start) * (0.5 + take(random) * 0.25), met: false });
    y = rowY + R.above - R.gap.min;
  });
  const goalY = y + 0.35;
  return { ledges, rows, stars, balloons, goalY };
}

// Nonpersistent Core: a climb. The companion bounces up a tower by itself; the child
// steers it left and right (the tower's sides join). On top of each part waits a row of
// four clouds, each with a Gotomon holding a plate. Landing on the answer's cloud sends
// the companion high up to the next part; another cloud puffs away, shows what its
// plate was, the companion falls back, and the answer's cloud glows. Until the row is
// answered nothing above it can be reached. A trampoline at the bottom of the view
// catches every fall (no game over), and after two falls in a row it bounces the
// companion up to the clouds. Stars and Gotomon with balloons wait along the way.
// One learning result per row, on its first cloud; every landing is its own problem id.
export function createJumpGame({ sessionId, random = Math.random, onEvent = () => {}, content, pace = 'normal' }) {
  const problems = content?.problems ?? null;
  const slow = pace === 'slow';
  const apex = R.apexSec[slow ? 'slow' : 'normal'];
  const gravity = 2 * R.jump / (apex * apex);
  const launch = height => Math.sqrt(2 * gravity * height);
  const runSpeed = R.run[slow ? 'slow' : 'normal'];
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', seq = 0, activeElapsedMs = 0, index = 0, tries = 0, landingSerial = 0;
  let tower = null, x = 0.5, y = 0, vy = 0, camera = 0, steer = { dir: 0, toX: null }, idleMs = 0, falls = 0, stuck = 0, best = 0, bounces = 0, goalAt = null;
  let answered = 0, correct = 0, incorrect = 0, starsTaken = 0, friends = 0, superJumps = 0;
  let hintPlateId = null, puffed = [], result = null, lastLanding = null, lastPickup = null, aborted = false, completeEmitted = false;
  let problem = null, attemptId = null;
  const missed = [];

  const current = () => problems?.[index] ?? null;
  const row = () => tower?.rows[index] ?? null;
  const cloudX = i => (i + 0.5) / R.clouds;
  const snapshot = () => Object.freeze({
    gameId: 'gotomonJump', mode: 'jump', sessionId, phase, paused, active, aborted, seq, activeElapsedMs, pace: slow ? 'slow' : 'normal',
    x, y, vy, camera, rising: vy > 0, goalY: tower?.goalY ?? null, goalAt, hintPlateId, puffed: Object.freeze([...puffed]),
    ledges: Object.freeze((tower?.ledges ?? []).filter(ledge => ledge.y > camera - 0.2 && ledge.y < camera + 1.4)
      .map(ledge => Object.freeze({ ...ledge, locked: ledge.part > index }))),
    row: row() ? Object.freeze({ rowId: row().rowId, part: row().part, y: row().y, plates: Object.freeze(row().plates.map((plate, i) => Object.freeze({ ...plate, x: cloudX(i), gone: puffed.includes(plate.plateId) }))) }) : null,
    stars: Object.freeze((tower?.stars ?? []).filter(star => !star.taken && star.y > camera - 0.2 && star.y < camera + 1.4).map(star => Object.freeze({ ...star }))),
    balloons: Object.freeze((tower?.balloons ?? []).filter(b => !b.met && b.y > camera - 0.2 && b.y < camera + 1.4).map(b => Object.freeze({ ...b }))),
    problemIndex: index, total: problems ? problems.length : 0, superJumps, starsTaken, friends, falls,
    problem, attemptId, answered, correct, incorrect, result, lastLanding, lastPickup, missed: Object.freeze([...missed]),
  });
  const notify = (type, payload = {}, problemId = problem?.problemId ?? null) => {
    const event = Object.freeze({ version: 1, gameId: 'gotomonJump', sessionId, seq: ++seq, type,
      problemId, activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation observers cannot undo a committed answer. */ }
    finally { notifying = false; }
  };
  const present = () => {
    const item = current(), r = row();
    problem = Object.freeze({ problemId: `${item.problemId}:${tries}`, contentId: item.contentId, skillId: item.skillId, kind: item.kind,
      prompt: item.prompt, sentence: item.sentence ?? null, answerId: item.answerId, explain: item.explain,
      choices: Object.freeze(r.plates.map(plate => Object.freeze({ choiceId: plate.plateId, text: plate.text }))), correctChoiceId: item.answerId });
    attemptId = `${problem.problemId}:attempt`;
  };
  const complete = () => {
    phase = 'completed'; problem = null; attemptId = null; hintPlateId = null;
    result = Object.freeze({ answered, correct, incorrect, accuracy: answered ? correct / answered : 0, superJumps, stars: starsTaken, friends, finished: true });
    if (!completeEmitted) { completeEmitted = true; notify('sessionComplete', result); }
  };
  // A landing on a cloud of the row: the answer for this try.
  const land = plate => {
    const item = current(), right = plate.plateId === item.answerId, first = tries === 0;
    const problemId = problem.problemId, committedAttempt = attemptId;
    if (first) { answered++; if (right) correct++; else incorrect++; }
    const answer = item.plates.find(p => p.plateId === item.answerId);
    lastLanding = Object.freeze({ landing: ++landingSerial, correct: right, first, x: wrap(x), y: row().y, text: plate.text, note: plate.note, answer: answer.text, explain: item.explain, part: index });
    const payload = { attemptId: committedAttempt, contentId: item.contentId, skillId: item.skillId, chosen: plate.plateId };
    stuck = 0;
    if (right) {
      best = row().y; superJumps++; vy = launch(R.superJump); hintPlateId = null; puffed = []; idleMs = 0;
      notify(first ? 'correct' : 'passed', payload, problemId);
      if (index + 1 >= problems.length) { problem = null; attemptId = `${sessionId}:goal`; goalAt = tower.goalY; index++; return; }
      index++; tries = 0; present();
      notify('problemPresented', { skillId: current().skillId, kind: current().kind });
    } else {
      // The cloud puffs away and the companion falls through it.
      puffed = [...puffed, plate.plateId]; hintPlateId = item.answerId; idleMs = 0;
      if (first) missed.push(Object.freeze({ contentId: item.contentId, prompt: item.prompt, chosen: plate.text, explain: item.explain, questionNumber: answered }));
      notify(first ? 'incorrect' : 'retry', payload, problemId);
      tries++; present();
    }
  };
  // Every bounce: one that climbs no higher than before counts as stuck, and being stuck
  // twice makes the next bounce reach the row (so every child gets to the clouds).
  const bounce = (from, height) => {
    if (from > best + 0.01) { best = from; stuck = 0; } else stuck++;
    const r = row(), big = r && stuck > R.bigBounceAfter;
    vy = launch(big ? Math.max(height, r.y + 0.1 - from) : height); bounces++;
    if (big) stuck = 0;
    return big;
  };
  const step = dt => {
    const r = row();
    // Moving ledges slide and turn at the walls.
    for (const ledge of tower.ledges) {
      if (ledge.kind !== 'move') continue;
      ledge.x += ledge.vx * dt;
      if (ledge.x < 0.15 || ledge.x > 0.85) { ledge.vx = -ledge.vx; ledge.x = Math.min(0.85, Math.max(0.15, ledge.x)); }
    }
    // Sideways: toward the finger, or along the arrow; after a slip, a long rest drifts to the glowing cloud.
    let target = steer.toX;
    if (steer.dir === 0 && target === null && hintPlateId && idleMs >= R.helpAfterMs && r) target = cloudX(r.plates.findIndex(p => p.plateId === hintPlateId));
    if (steer.dir !== 0) x += steer.dir * runSpeed * dt;
    else if (target !== null) {
      let d = wrap(target) - wrap(x);
      if (steer.toX === null) { if (d > 0.5) d -= 1; if (d < -0.5) d += 1; }
      x += Math.max(-runSpeed * dt, Math.min(runSpeed * dt, d * 10 * dt));
    }
    x = wrap(x);
    const before = y;
    vy -= gravity * dt; y += vy * dt;
    // Until the row is answered, nothing above it can be reached.
    if (r && y > r.y + R.above - 0.1) { y = r.y + R.above - 0.1; vy = Math.min(vy, 0); }
    if (vy <= 0) {
      const reach = R.playerW * 0.5;
      // Clouds of the row first (they sit above the ledges under them).
      if (r && before >= r.y && y <= r.y) {
        const i = r.plates.findIndex((plate, k) => !puffed.includes(plate.plateId) && across(x, cloudX(k)) <= R.cloudW / 2 + reach * 0.4);
        if (i >= 0) { y = r.y; land(r.plates[i]); return; }
      }
      for (const ledge of tower.ledges) {
        if (ledge.part > index || before < ledge.y || y > ledge.y) continue;
        if (across(x, ledge.x) > ledge.w / 2 + reach * 0.6) continue;
        y = ledge.y;
        const big = bounce(y, ledge.kind === 'spring' ? R.spring : R.jump);
        if (big || ledge.kind === 'spring') lastPickup = Object.freeze({ pickup: ++landingSerial, kind: big ? 'big' : 'spring', x, y });
        return;
      }
      // The trampoline at the bottom of the view.
      if (y <= camera) {
        y = camera; falls++;
        const big = bounce(y, R.jump);
        lastPickup = Object.freeze({ pickup: ++landingSerial, kind: big ? 'big' : 'trampoline', x, y });
      }
    }
    // Stars and balloon friends are picked up by touching them.
    for (const star of tower.stars) {
      if (star.taken || Math.abs(star.y - (y + 0.04)) > 0.06 || across(star.x, x) > 0.07) continue;
      star.taken = true; starsTaken++; lastPickup = Object.freeze({ pickup: ++landingSerial, kind: 'star', x: star.x, y: star.y });
    }
    for (const balloon of tower.balloons) {
      if (balloon.met || Math.abs(balloon.y - (y + 0.04)) > 0.08 || across(balloon.x, x) > 0.09) continue;
      balloon.met = true; friends++; lastPickup = Object.freeze({ pickup: ++landingSerial, kind: 'friend', x: balloon.x, y: balloon.y, cast: balloon.cast });
    }
    // The camera only goes up; while a row waits, it keeps the row in view.
    let want = Math.max(camera, y - R.follow);
    if (r) want = Math.min(want, r.y - 0.3);
    camera = want;
    if (goalAt !== null && vy <= 0) complete();
  };

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying || !Array.isArray(problems) || !problems.length
        || problems.some(item => item.plates?.length !== R.clouds || !item.plates.some(plate => plate.plateId === item.answerId))) return false;
      tower = buildTower(problems, random, sessionId);
      x = 0.5; y = 0; camera = 0; vy = launch(R.jump);
      phase = 'answering'; present();
      notify('problemPresented', { skillId: current().skillId, kind: current().kind });
      return true;
    },
    update(dtMs) {
      if (!active || paused || phase !== 'answering' || !Number.isFinite(dtMs) || notifying) return;
      const dt = Math.max(0, Math.min(dtMs, 100));
      activeElapsedMs += dt;
      if (steer.dir === 0 && steer.toX === null) idleMs += dt; else idleMs = 0;
      // Small steps keep fast falls from passing through a ledge.
      for (let left = dt; left > 0 && phase === 'answering'; left -= 16) step(Math.min(16, left) / 1000);
    },
    setPaused(value) { if (active) paused = !!value; },
    // Steers sideways: dir -1/0/1 (arrows), or toX 0..1 (a finger on the tower), or both null/0 to let go.
    move({ sessionId: s, attemptId: a, dir = 0, toX = null } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || s !== sessionId || a !== attemptId) return false;
      if (![-1, 0, 1].includes(dir) || (toX !== null && !(Number.isFinite(toX) && toX >= 0 && toX <= 1))) return false;
      steer = { dir, toX }; return true;
    },
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      if (command.type === 'move') return this.move(command.payload);
      return false;
    },
    snapshot,
    exit() {
      if (!active) return;
      active = false; attemptId = null; aborted = phase !== 'completed'; observer = null;
    },
  };
}
