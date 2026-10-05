import { buildTarget } from '../buildReview.js';

export const PUSH_RULES = Object.freeze({
  // A 7 x 7 room; a few rocks stand in it. Ten rooms, one question each.
  size: 7, rooms: 10, rocks: [3, 5],
  // The answer box needs this many pushes at least to reach the nest (a short puzzle, never a long one).
  pushes: Object.freeze([2, 5]),
  // The companion offers to carry the box after this many steps, or this long, in one room (normal / ゆっくり).
  helpAfterMoves: 36, helpAfterMs: Object.freeze({ normal: 45000, slow: 65000 }),
  // ⭐3: the first choice right, no help, and at most this many pushes more than the fewest.
  spare: 3,
  // How long a finished room stays (the Gotomon comes out of the box) before the next one (ms).
  clearMs: 1400,
});
const R = PUSH_RULES;
const N = R.size;
const DIRS = Object.freeze({ up: -N, down: N, left: -1, right: 1 });

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
// One step from a cell, or -1 off the room (rows do not wrap).
export const stepFrom = (at, direction) => {
  const d = DIRS[direction];
  if (d === undefined || at < 0 || at >= N * N) return -1;
  if (direction === 'left' && at % N === 0) return -1;
  if (direction === 'right' && at % N === N - 1) return -1;
  const to = at + d;
  return to >= 0 && to < N * N ? to : -1;
};

// The fewest pushes that bring one box onto the nest, walking around the rocks (and the other
// boxes, which never move). Returns { pushes, plan } — plan: the pushes in order, each the
// direction and where the player stands before it — or null when it cannot be done.
export function solvePush({ blocked, box, player, goal }) {
  const free = at => at >= 0 && !blocked.has(at);
  const reach = (from, boxAt) => {
    const seen = new Set([from]), queue = [from];
    while (queue.length) {
      const at = queue.shift();
      for (const dir of Object.keys(DIRS)) {
        const to = stepFrom(at, dir);
        if (free(to) && to !== boxAt && !seen.has(to)) { seen.add(to); queue.push(to); }
      }
    }
    return seen;
  };
  const key = (boxAt, area) => `${boxAt}:${Math.min(...area)}`;
  const start = reach(player, box);
  const seen = new Set([key(box, start)]);
  let layer = [{ box, area: start, plan: [] }];
  for (let pushes = 0; layer.length && pushes <= 12; pushes++) {
    const next = [];
    for (const state of layer) {
      if (state.box === goal) return { pushes, plan: state.plan };
      for (const dir of Object.keys(DIRS)) {
        const behind = stepFrom(state.box, { up: 'down', down: 'up', left: 'right', right: 'left' }[dir]);
        const to = stepFrom(state.box, dir);
        if (!state.area.has(behind) || !free(to)) continue;
        const area = reach(state.box, to), k = key(to, area);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ box: to, area, plan: [...state.plan, { direction: dir, from: behind }] });
      }
    }
    layer = next;
  }
  return null;
}

// One room: rocks, the nest, four boxes (one per choice) and the player. The answer box can
// always be pushed onto the nest with the other boxes standing still, in R.pushes pushes at
// least; no box starts on the nest or right next to it.
export function buildRoom(answerIndex, random) {
  const cells = [...Array(N * N).keys()];
  const inner = cells.filter(at => at >= N && at < N * N - N && at % N && at % N !== N - 1);
  for (let tries = 0; tries < 400; tries++) {
    const rockCount = R.rocks[0] + Math.floor(take(random) * (R.rocks[1] - R.rocks[0] + 1));
    const order = shuffled(cells, random);
    const goal = shuffled(inner, random)[0];
    const near = new Set(Object.keys(DIRS).map(d => stepFrom(goal, d)));
    const rocks = order.filter(at => at !== goal && !near.has(at)).slice(0, rockCount);
    const used = new Set([goal, ...rocks]);
    // Boxes off the walls of the room (a box against a wall can only slide along it).
    const spots = shuffled(inner.filter(at => !used.has(at) && !near.has(at)), random);
    if (spots.length < 4) continue;
    const boxes = spots.slice(0, 4);
    boxes.forEach(at => used.add(at));
    const player = shuffled(cells.filter(at => !used.has(at)), random)[0];
    const blocked = new Set([...rocks, ...boxes.filter((_, i) => i !== answerIndex)]);
    const solved = solvePush({ blocked, box: boxes[answerIndex], player, goal });
    if (!solved || solved.pushes < R.pushes[0] || solved.pushes > R.pushes[1]) continue;
    return { rocks, goal, boxes, player, fewest: solved.pushes };
  }
  return null;
}

// Nonpersistent Core: box pushing (倉庫番). In each of ten rooms four boxes carry the four
// answers and a Gotomon's nest waits. The child first taps the box with the answer — that tap
// alone is the learning result, so pushing never records a slip. A wrong box cracks and the
// answer box glows. Then the child pushes the answer box onto the nest (the other boxes do not
// move); one step back and starting the room over are always there, and after a while the
// companion offers to carry the box. No time limit, no game over.
export function createPushGame({ sessionId, random = Math.random, onEvent = () => {}, content, pace = 'normal' }) {
  const problems = content?.problems ?? null;
  const helpMs = pace === 'slow' ? R.helpAfterMs.slow : R.helpAfterMs.normal;
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', seq = 0, activeElapsedMs = 0, room = -1, tries = 0, answerSerial = 0, clearLeft = 0, clearSerial = 0;
  let answered = 0, correct = 0, incorrect = 0, stars = 0, helped = 0, friends = 0, combo = 0, maxCombo = 0;
  let result = null, lastAnswer = null, lastClear = null, aborted = false, completeEmitted = false, problem = null, attemptId = null;
  let layout = null, player = 0, box = 0, boxes = [], moves = 0, pushes = 0, roomMs = 0, history = [], hintChoiceId = null, firstRight = false;
  const missed = [];

  const canHelp = () => phase === 'pushing' && (moves >= R.helpAfterMoves || roomMs >= helpMs);
  const snapshot = () => Object.freeze({
    gameId: 'gotomonPush', mode: 'push', sessionId, phase, paused, active, aborted, seq, activeElapsedMs, pace: pace === 'slow' ? 'slow' : 'normal',
    size: N, room, rooms: R.rooms, rocks: Object.freeze([...(layout?.rocks ?? [])]), goal: layout?.goal ?? -1, player,
    boxes: Object.freeze(boxes.map(item => Object.freeze({ ...item }))), moves, pushes, fewest: layout?.fewest ?? 0,
    canHelp: canHelp(), canUndo: phase === 'pushing' && history.length > 0, hintChoiceId,
    problem, attemptId, answered, correct, incorrect, stars, helped, friends, combo, maxCombo, total: R.rooms,
    result, lastAnswer, lastClear, missed: Object.freeze([...missed]),
  });
  const notify = (type, payload = {}, problemId = problem?.problemId ?? null) => {
    const event = Object.freeze({ version: 1, gameId: 'gotomonPush', sessionId, seq: ++seq, type,
      problemId, activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation observers cannot undo a committed answer. */ }
    finally { notifying = false; }
  };
  const ask = () => {
    const item = problems[room];
    problem = Object.freeze({ problemId: `${item.problemId}:${tries}`, contentId: item.contentId, skillId: item.skillId, kind: item.kind,
      prompt: item.prompt, sentence: item.sentence ?? null, explain: item.explain,
      choices: Object.freeze(item.plates.map(plate => Object.freeze({ choiceId: plate.plateId, text: plate.text, note: plate.note ?? null }))), correctChoiceId: item.answerId });
    attemptId = `${problem.problemId}:attempt`; phase = 'choosing';
    if (tries === 0) notify('problemPresented', { skillId: item.skillId, kind: item.kind });
  };
  const startRoom = at => {
    room = at; tries = 0; hintChoiceId = null; firstRight = false;
    const item = problems[at], answerIndex = item.plates.findIndex(plate => plate.plateId === item.answerId);
    layout = buildRoom(answerIndex, random);
    boxes = item.plates.map((plate, i) => ({ boxId: plate.plateId, text: plate.text, cell: layout.boxes[i], state: 'idle' }));
    player = layout.player; box = layout.boxes[answerIndex]; moves = 0; pushes = 0; roomMs = 0; history = [];
    ask();
  };
  const complete = () => {
    phase = 'completed'; problem = null; attemptId = null;
    result = Object.freeze({ answered, correct, incorrect, accuracy: answered ? correct / answered : 0, rooms: room + 1, stars, helped, friends, maxCombo, finished: true });
    if (!completeEmitted) { completeEmitted = true; notify('sessionComplete', result); }
  };
  const clearRoom = byHelp => {
    const earned = byHelp || !firstRight ? 1 : pushes <= layout.fewest + R.spare ? 3 : 2;
    stars += earned; friends++; if (byHelp) helped++;
    lastClear = Object.freeze({ clear: ++clearSerial, room, stars: earned, helped: byHelp, pushes, fewest: layout.fewest });
    phase = 'cleared'; clearLeft = R.clearMs; attemptId = null;
    notify('roomCleared', { room, stars: earned, helped: byHelp });
  };
  const blockedNow = () => new Set([...layout.rocks, ...boxes.filter(item => item.cell !== box).map(item => item.cell)]);
  const pushAttempt = () => `${sessionId}:r${room}:push`;

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying || !Array.isArray(problems) || problems.length < R.rooms
        || problems.some(item => !item.plates?.some(plate => plate.plateId === item.answerId) || item.plates.length !== 4)) return false;
      startRoom(0); return true;
    },
    update(dtMs) {
      if (!active || paused || ['ready', 'completed'].includes(phase) || !Number.isFinite(dtMs) || notifying) return;
      const dt = Math.max(0, Math.min(dtMs, 100));
      activeElapsedMs += dt;
      if (phase === 'pushing') roomMs += dt;
      if (phase !== 'cleared') return;
      clearLeft -= dt;
      if (clearLeft > 0) return;
      if (room + 1 >= R.rooms) complete(); else startRoom(room + 1);
    },
    setPaused(value) { if (active) paused = !!value; },
    // The learning result: the box the child taps. Only the first tap of a room counts.
    choose({ sessionId: s, attemptId: a, boxId } = {}) {
      if (!active || paused || notifying || phase !== 'choosing' || s !== sessionId || a !== attemptId) return false;
      const chosen = boxes.find(item => item.boxId === boxId);
      if (!chosen || chosen.state === 'wrong') return false;
      const right = boxId === problem.correctChoiceId, first = tries === 0;
      if (first) { answered++; if (right) { correct++; combo++; maxCombo = Math.max(maxCombo, combo); } else { incorrect++; combo = 0; } }
      const choice = problem.choices.find(item => item.choiceId === boxId);
      lastAnswer = Object.freeze({ answer: ++answerSerial, correct: right, first, chosen: choice.text, note: choice.note, explain: problem.explain,
        answerText: problem.choices.find(item => item.choiceId === problem.correctChoiceId).text, boxId });
      const payload = { attemptId, contentId: problem.contentId, skillId: problem.skillId, chosen: boxId };
      if (right) {
        firstRight = first;
        boxes.forEach(item => { item.state = item.boxId === boxId ? 'chosen' : 'rock'; });
        hintChoiceId = null;
        notify(first ? 'correct' : 'chosen', payload);
        problem = null; phase = 'pushing'; attemptId = pushAttempt();
      } else {
        if (first) missed.push(Object.freeze({ contentId: problem.contentId, prompt: problem.prompt, chosen: choice.text, explain: problem.explain, build: buildTarget(problem), questionNumber: answered }));
        chosen.state = 'wrong'; hintChoiceId = problem.correctChoiceId;
        notify(first ? 'incorrect' : 'retry', payload);
        tries++; ask();
      }
      return true;
    },
    // One step; walking into the answer box pushes it when the cell beyond is free.
    move({ sessionId: s, attemptId: a, direction } = {}) {
      if (!active || paused || notifying || phase !== 'pushing' || s !== sessionId || a !== attemptId || !DIRS[direction]) return false;
      const to = stepFrom(player, direction), blocked = blockedNow();
      if (to < 0 || blocked.has(to)) return false;
      if (to === box) {
        const beyond = stepFrom(box, direction);
        if (beyond < 0 || blocked.has(beyond)) return false;
        history.push({ player, box, moves, pushes });
        box = beyond; player = to; pushes++; moves++;
        boxes.find(item => item.state === 'chosen').cell = box;
        if (box === layout.goal) clearRoom(false);
        return true;
      }
      history.push({ player, box, moves, pushes });
      player = to; moves++;
      return true;
    },
    undo({ sessionId: s } = {}) {
      if (!active || paused || notifying || phase !== 'pushing' || s !== sessionId || !history.length) return false;
      const last = history.pop();
      player = last.player; box = last.box; pushes = last.pushes; moves = last.moves + 1;
      boxes.find(item => item.state === 'chosen').cell = box;
      return true;
    },
    // Back to how the room began (the steps still count toward the companion's help).
    reset({ sessionId: s } = {}) {
      if (!active || paused || notifying || phase !== 'pushing' || s !== sessionId || !history.length) return false;
      const first = history[0];
      player = first.player; box = first.box; pushes = 0; moves += 1; history = [];
      boxes.find(item => item.state === 'chosen').cell = box;
      return true;
    },
    // The companion carries the box onto the nest (offered after a while; the room gets ⭐1).
    help({ sessionId: s } = {}) {
      if (!active || paused || notifying || s !== sessionId || !canHelp()) return false;
      box = layout.goal; boxes.find(item => item.state === 'chosen').cell = box;
      clearRoom(true);
      return true;
    },
    // Once the answer is chosen, the child may hand over the physical puzzle.
    // This does not judge the answer again or change the learning record.
    carry({ sessionId: s, attemptId: a } = {}) {
      if (!active || paused || notifying || phase !== 'pushing' || s !== sessionId || a !== attemptId) return false;
      box = layout.goal; boxes.find(item => item.state === 'chosen').cell = box;
      clearRoom(true);
      return true;
    },
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      if (command.type === 'choose') return this.choose(command.payload);
      if (command.type === 'move') return this.move(command.payload);
      if (command.type === 'undo') return this.undo(command.payload);
      if (command.type === 'reset') return this.reset(command.payload);
      if (command.type === 'help') return this.help(command.payload);
      if (command.type === 'carry') return this.carry(command.payload);
      return false;
    },
    snapshot,
    exit() {
      if (!active) return;
      active = false; attemptId = null; aborted = phase !== 'completed'; observer = null;
    },
  };
}
