import { buildTarget } from '../buildReview.js';

export const TAG_RULES = Object.freeze({
  // The field: # wall, . path (with a sparkle), P a pocket at the edge where a plate waits.
  // Loops everywhere and no dead ends, so the chasers can always be dodged.
  board: Object.freeze([
    '#####P#####',
    '#.........#',
    '#.##.#.##.#',
    '#.#.....#.#',
    '#...#.#...#',
    'P.#.....#.P',
    '#...#.#...#',
    '#.#.....#.#',
    '#.##.#.##.#',
    '#.........#',
    '#####P#####',
  ]),
  start: Object.freeze([5, 5]),
  // The chasers start in the corners, and leave one after another.
  chaserStarts: Object.freeze([[1, 1], [1, 9], [9, 9]]), firstReleaseMs: 3500, releaseMs: 1800,
  // Cells per second (normal / ゆっくり).
  speed: Object.freeze({ normal: 5.2, slow: 4.0 }), chaserSpeed: Object.freeze({ normal: 4.0, slow: 3.0 }), runAwaySpeed: 0.8,
  // How often a chaser turns toward the companion (the rest of its turns are random).
  chase: 0.6,
  // After the answer's plate: this long the chasers run away and can be tagged (they join as friends);
  // the next question's plates come when it ends.
  powerMs: Object.freeze({ normal: 5000, slow: 6500 }),
  // After being tagged: back to the start, safe for this long.
  safeMs: 2500,
  // After the last question, the play ends after this long (one last chase).
  endMs: 3000,
  touch: 0.62,
});
const R = TAG_RULES;
const ROWS = R.board.length, COLS = R.board[0].length;
const DIRS = Object.freeze({ up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] });
const BACK = Object.freeze({ up: 'down', down: 'up', left: 'right', right: 'left' });
const at = (r, c) => R.board[r]?.[c] ?? '#';
const open = (r, c, pockets) => { const ch = at(r, c); return ch === '.' || (pockets && ch === 'P'); };
export const TAG_POCKETS = Object.freeze(R.board.flatMap((line, r) => [...line].map((ch, c) => (ch === 'P' ? [r, c] : null))).filter(Boolean));

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
const key = (r, c) => r * COLS + c;

// Nonpersistent Core: tag in a maze. The child moves the companion (it keeps going and
// turns where the child asks); it eats the sparkles on its way. Three Gotomon are "it"
// and chase it. Four plates wait in the pockets at the edges: the answer's plate makes
// the companion strong for a while — the Gotomon run away, and each one it touches
// joins as a friend (a new Gotomon comes out in its place); then the next plates come. Another plate is gone, says
// what it was, and the answer's plate glows. Being touched only sends the companion back
// to the start, safe for a moment; there is no game over. Twelve questions. One learning
// result per question, on its first plate; every plate taken is its own problem id.
export function createTagGame({ sessionId, random = Math.random, onEvent = () => {}, content, pace = 'normal' }) {
  const problems = content?.problems ?? null;
  const slow = pace === 'slow';
  const speed = R.speed[slow ? 'slow' : 'normal'], chaserSpeed = R.chaserSpeed[slow ? 'slow' : 'normal'], powerLength = R.powerMs[slow ? 'slow' : 'normal'];
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', seq = 0, activeElapsedMs = 0, index = 0, tries = 0, serial = 0, castSerial = 0;
  let player = null, wanted = null, chasers = [], plates = [], sparkles = new Set();
  let powerMs = 0, safeMs = 0, endMs = null, hintPlateId = null;
  let answered = 0, correct = 0, incorrect = 0, eaten = 0, friends = 0, tagged = 0, refills = 0;
  let result = null, lastTake = null, lastTouch = null, aborted = false, completeEmitted = false, problem = null, attemptId = null;
  const missed = [];

  const current = () => problems?.[index] ?? null;
  const pos = mover => {
    const [dr, dc] = mover.dir ? DIRS[mover.dir] : [0, 0];
    return { x: mover.c + dc * mover.t, y: mover.r + dr * mover.t };
  };
  const snapshot = () => Object.freeze({
    gameId: 'gotomonTag', mode: 'tag', sessionId, phase, paused, active, aborted, seq, activeElapsedMs, pace: slow ? 'slow' : 'normal',
    board: R.board, rows: ROWS, cols: COLS,
    player: player ? Object.freeze({ ...pos(player), r: player.r, c: player.c, dir: player.dir, wanted, safe: safeMs > 0 }) : null,
    chasers: Object.freeze(chasers.map(ch => Object.freeze({ chaserId: ch.chaserId, cast: ch.cast, ...pos(ch), dir: ch.dir, waiting: ch.waitMs > 0, running: powerMs > 0 && !ch.fresh }))),
    plates: Object.freeze(plates.map(plate => Object.freeze({ ...plate }))),
    sparkles: Object.freeze([...sparkles]), powerMs, safeMs, hintPlateId, ending: endMs !== null,
    problemIndex: Math.min(index, problems ? problems.length - 1 : 0), total: problems ? problems.length : 0,
    eaten, friends, tagged, refills,
    problem, attemptId, answered, correct, incorrect, result, lastTake, lastTouch, missed: Object.freeze([...missed]),
  });
  const notify = (type, payload = {}, problemId = problem?.problemId ?? null) => {
    const event = Object.freeze({ version: 1, gameId: 'gotomonTag', sessionId, seq: ++seq, type,
      problemId, activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation observers cannot undo a committed answer. */ }
    finally { notifying = false; }
  };
  // The plates of the current question, one per pocket in a new order.
  const lay = () => {
    const item = current();
    plates = shuffled(item.plates, random).map((plate, i) => ({ plateId: plate.plateId, text: plate.text, note: plate.note ?? null, r: TAG_POCKETS[i][0], c: TAG_POCKETS[i][1], gone: false }));
  };
  const present = () => {
    const item = current();
    problem = Object.freeze({ problemId: `${item.problemId}:${tries}`, contentId: item.contentId, skillId: item.skillId, kind: item.kind,
      prompt: item.prompt, sentence: item.sentence ?? null, answerId: item.answerId, explain: item.explain,
      choices: Object.freeze(plates.map(plate => Object.freeze({ choiceId: plate.plateId, text: plate.text }))), correctChoiceId: item.answerId });
    attemptId = `${problem.problemId}:attempt`;
  };
  const fillSparkles = () => {
    sparkles = new Set();
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (at(r, c) === '.' && !(r === R.start[0] && c === R.start[1])) sparkles.add(key(r, c));
  };
  const newChaser = (i, waitMs) => ({ chaserId: `${sessionId}:chaser:${++serial}`, slot: i, cast: castSerial++, r: R.chaserStarts[i][0], c: R.chaserStarts[i][1], dir: null, t: 0, waitMs, fresh: false });
  const complete = () => {
    phase = 'completed'; problem = null; attemptId = null; hintPlateId = null; plates = []; powerMs = 0;
    result = Object.freeze({ answered, correct, incorrect, accuracy: answered ? correct / answered : 0, friends, sparkles: eaten, finished: true });
    if (!completeEmitted) { completeEmitted = true; notify('sessionComplete', result); }
  };
  // The companion reached a pocket with a plate: the answer for this try.
  const takePlate = plate => {
    const item = current(), right = plate.plateId === item.answerId, first = tries === 0;
    const problemId = problem.problemId, committedAttempt = attemptId;
    if (first) { answered++; if (right) correct++; else incorrect++; }
    const answer = item.plates.find(p => p.plateId === item.answerId);
    lastTake = Object.freeze({ take: ++serial, correct: right, first, r: plate.r, c: plate.c, text: plate.text, note: plate.note, answer: answer.text, explain: item.explain });
    const payload = { attemptId: committedAttempt, contentId: item.contentId, skillId: item.skillId, chosen: plate.plateId };
    if (right) {
      // Strong for a while: every chaser on the field runs away.
      powerMs = powerLength; hintPlateId = null;
      for (const chaser of chasers) chaser.fresh = false;
      notify(first ? 'correct' : 'passed', payload, problemId);
      plates = []; problem = null; attemptId = `${sessionId}:power:${index}`;
      if (index + 1 >= problems.length) { endMs = R.endMs; index++; return; }
      index++; tries = 0;
    } else {
      plate.gone = true; hintPlateId = item.answerId;
      if (first) missed.push(Object.freeze({ contentId: item.contentId, prompt: item.prompt, chosen: plate.text, explain: item.explain, build: buildTarget(item), questionNumber: answered }));
      notify(first ? 'incorrect' : 'retry', payload, problemId);
      tries++; present();
    }
  };
  // The companion arrived on a cell: sparkle, plate, then where to go next.
  const arrive = () => {
    const k = key(player.r, player.c);
    if (sparkles.delete(k)) { eaten++; if (!sparkles.size) { refills++; fillSparkles(); } }
    if (at(player.r, player.c) === 'P') {
      const plate = plates.find(p => p.r === player.r && p.c === player.c && !p.gone);
      if (plate && problem) takePlate(plate);
    }
    const go = d => d && open(player.r + DIRS[d][0], player.c + DIRS[d][1], true);
    player.dir = go(wanted) ? wanted : go(player.dir) ? player.dir : null;
  };
  const moveChaser = (ch, dt) => {
    if (ch.waitMs > 0) { ch.waitMs -= dt * 1000; return; }
    const running = powerMs > 0 && !ch.fresh;
    let left = dt * chaserSpeed * (running ? R.runAwaySpeed : 1);
    while (left > 0) {
      if (!ch.dir) {
        // At a cell: turn toward (or, running, away from) the companion now and then.
        const options = Object.keys(DIRS).filter(d => open(ch.r + DIRS[d][0], ch.c + DIRS[d][1], false));
        const forward = options.filter(d => d !== BACK[ch.lastDir]);
        const choices = forward.length ? forward : options;
        if (!choices.length) return;
        const target = pos(player);
        const far = d => Math.abs(ch.r + DIRS[d][0] - target.y) + Math.abs(ch.c + DIRS[d][1] - target.x);
        if (running || take(random) < R.chase) choices.sort((a, b) => (running ? far(b) - far(a) : far(a) - far(b)));
        else choices.sort(() => take(random) - 0.5);
        ch.dir = choices[0]; ch.t = 0;
      }
      const step = Math.min(left, 1 - ch.t);
      ch.t += step; left -= step;
      if (ch.t >= 1 - 1e-9) { ch.r += DIRS[ch.dir][0]; ch.c += DIRS[ch.dir][1]; ch.lastDir = ch.dir; ch.dir = null; ch.t = 0; }
    }
  };
  const touches = () => {
    const me = pos(player);
    for (const ch of chasers) {
      if (ch.waitMs > 0) continue;
      const p = pos(ch);
      if (Math.hypot(p.x - me.x, p.y - me.y) > R.touch) continue;
      if (powerMs > 0 && !ch.fresh) {
        // Touched while running away: it joins, and a new Gotomon comes out of its corner.
        friends++;
        lastTouch = Object.freeze({ touch: ++serial, kind: 'friend', cast: ch.cast, x: p.x, y: p.y });
        const next = newChaser(ch.slot, 1200); next.fresh = true;
        chasers[chasers.indexOf(ch)] = next;
        return;
      }
      if (safeMs <= 0 && powerMs <= 0) {
        // Touched by "it": back to the start, safe for a moment; the chasers go back to their corners.
        tagged++;
        lastTouch = Object.freeze({ touch: ++serial, kind: 'tagged', cast: ch.cast, x: me.x, y: me.y });
        player = { r: R.start[0], c: R.start[1], dir: null, t: 0 }; wanted = null; safeMs = R.safeMs;
        chasers = chasers.map((c, i) => ({ ...c, r: R.chaserStarts[i][0], c: R.chaserStarts[i][1], dir: null, t: 0, waitMs: 600 + i * 500, lastDir: null }));
        return;
      }
    }
  };
  const step = dt => {
    // The companion: turns back at once; other turns happen on the next cell.
    if (wanted && player.dir && wanted === BACK[player.dir]) {
      player.r += DIRS[player.dir][0]; player.c += DIRS[player.dir][1]; player.t = 1 - player.t; player.dir = wanted;
    }
    if (!player.dir && wanted && open(player.r + DIRS[wanted][0], player.c + DIRS[wanted][1], true)) { player.dir = wanted; player.t = 0; }
    let left = dt * speed;
    while (left > 0 && player.dir && phase === 'answering') {
      const stepLen = Math.min(left, 1 - player.t);
      player.t += stepLen; left -= stepLen;
      if (player.t >= 1 - 1e-9) { player.r += DIRS[player.dir][0]; player.c += DIRS[player.dir][1]; player.t = 0; arrive(); }
    }
    for (const ch of chasers) moveChaser(ch, dt);
    touches();
    powerMs = Math.max(0, powerMs - dt * 1000); safeMs = Math.max(0, safeMs - dt * 1000);
    if (powerMs === 0) {
      for (const ch of chasers) ch.fresh = false;
      // The chase is over: the next question's plates come.
      if (!problem && endMs === null) { lay(); present(); notify('problemPresented', { skillId: current().skillId, kind: current().kind }); }
    }
    if (endMs !== null) { endMs -= dt * 1000; if (endMs <= 0) complete(); }
  };

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying || !Array.isArray(problems) || !problems.length
        || problems.some(item => item.plates?.length !== TAG_POCKETS.length || !item.plates.some(plate => plate.plateId === item.answerId))) return false;
      player = { r: R.start[0], c: R.start[1], dir: null, t: 0 };
      chasers = R.chaserStarts.map((_, i) => newChaser(i, R.firstReleaseMs + i * R.releaseMs));
      fillSparkles(); lay();
      phase = 'answering'; present();
      notify('problemPresented', { skillId: current().skillId, kind: current().kind });
      return true;
    },
    update(dtMs) {
      if (!active || paused || phase !== 'answering' || !Number.isFinite(dtMs) || notifying) return;
      const dt = Math.max(0, Math.min(dtMs, 100));
      activeElapsedMs += dt;
      for (let left = dt; left > 0 && phase === 'answering'; left -= 16) step(Math.min(16, left) / 1000);
    },
    setPaused(value) { if (active) paused = !!value; },
    // Asks the companion to go a way (it turns there as soon as it can, and keeps going).
    move({ sessionId: s, attemptId: a, direction } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || s !== sessionId || a !== attemptId) return false;
      if (!DIRS[direction]) return false;
      wanted = direction; return true;
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
