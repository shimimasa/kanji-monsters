import { buildTarget } from '../buildReview.js';

export const MAZE_RULES = Object.freeze({
  size: 7, floors: 3, doorsPerFloor: 4, friendsPerFloor: 2,
  // One step along the maze, and how long a finished floor stays before the next (ms).
  stepMs: 120, clearMs: 1500,
});
const R = MAZE_RULES;
const DIRS = Object.freeze({ up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] });
const WALL = Object.freeze({ up: 'n', down: 's', left: 'w', right: 'e' });
const BACK = Object.freeze({ up: 'down', down: 'up', left: 'right', right: 'left' });

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

// A perfect maze (one way between any two cells) carved from the start by a random walk.
// Each cell lists its open sides.
export function carveMaze(size, random) {
  const cells = Array.from({ length: size * size }, () => ({ n: false, e: false, s: false, w: false }));
  const seen = new Set([0]), stack = [0];
  while (stack.length) {
    const at = stack.at(-1), row = Math.floor(at / size), column = at % size;
    const next = shuffled(Object.entries(DIRS), random).map(([dir, [dr, dc]]) => [dir, row + dr, column + dc])
      .find(([, r, c]) => r >= 0 && r < size && c >= 0 && c < size && !seen.has(r * size + c));
    if (!next) { stack.pop(); continue; }
    const [dir, r, c] = next, to = r * size + c;
    cells[at][WALL[dir]] = true; cells[to][WALL[BACK[dir]]] = true;
    seen.add(to); stack.push(to);
  }
  return cells;
}
// Cells one step away that are open from a cell.
const neighbours = (cells, size, at) => Object.entries(DIRS).filter(([dir]) => cells[at][WALL[dir]])
  .map(([dir, [dr, dc]]) => ({ dir, to: (Math.floor(at / size) + dr) * size + (at % size) + dc }));
// The way from one cell to another (cells after the first), or null.
export function wayBetween(cells, size, from, to, blocked = () => false) {
  const before = new Map([[from, null]]), queue = [from];
  while (queue.length) {
    const at = queue.shift();
    if (at === to) break;
    for (const { to: next } of neighbours(cells, size, at)) {
      if (before.has(next) || (blocked(next) && next !== to)) continue;
      before.set(next, at); queue.push(next);
    }
  }
  if (!before.has(to)) return null;
  const way = [];
  for (let at = to; at !== from; at = before.get(at)) way.unshift(at);
  return way;
}

// Nonpersistent Core: a maze. On each of three floors the child walks the companion from
// the top left to the stairs, on the cell farthest from it. Four ？ doors stand on the way; walking
// into one asks its question (four choices). A right answer opens it; a slip shows the
// answer and the door asks again. Friends wait in dead ends and join when reached. No
// time, no game over. One learning result per door, on its first answer; every answer is
// its own problem id.
export function createMazeGame({ sessionId, random = Math.random, onEvent = () => {}, content }) {
  const problems = content?.problems ?? null;
  const N = R.size;
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', seq = 0, activeElapsedMs = 0, floor = 0, doorIndex = 0, tries = 0, answerSerial = 0, stepMs = 0, clearLeft = 0;
  let answered = 0, correct = 0, incorrect = 0, opened = 0, friendsMet = 0, steps = 0;
  let result = null, lastAnswer = null, lastFriend = null, aborted = false, completeEmitted = false, problem = null, attemptId = null;
  let cells = [], player = 0, goal = N * N - 1, doors = [], friends = [], queue = [], atDoor = null, hintChoiceId = null;
  const missed = [];

  const snapshot = () => Object.freeze({
    gameId: 'gotomonMaze', mode: 'maze', sessionId, phase, paused, active, aborted, seq, activeElapsedMs, size: N,
    floor, floors: R.floors, cells: Object.freeze(cells.map(cell => Object.freeze({ ...cell }))), player, goal,
    doors: Object.freeze(doors.map(door => Object.freeze({ ...door }))), friends: Object.freeze(friends.map(friend => Object.freeze({ ...friend }))),
    walking: queue.length > 0, atDoor, hintChoiceId, opened, friendsMet, steps, total: problems ? problems.length : 0,
    problem, attemptId, answered, correct, incorrect, result, lastAnswer, lastFriend, missed: Object.freeze([...missed]),
  });
  const notify = (type, payload = {}, problemId = problem?.problemId ?? null) => {
    const event = Object.freeze({ version: 1, gameId: 'gotomonMaze', sessionId, seq: ++seq, type,
      problemId, activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation observers cannot undo a committed answer. */ }
    finally { notifying = false; }
  };
  const doorAt = at => doors.find(door => door.cell === at && !door.open) ?? null;
  const walkState = () => { problem = null; phase = 'walking'; attemptId = `${sessionId}:f${floor}:walk`; };
  // A floor: a new maze, doors spread along the way to the stairs, friends in dead ends.
  const buildFloor = at => {
    floor = at; cells = carveMaze(N, random); player = 0; queue = []; atDoor = null; hintChoiceId = null;
    // The stairs are on the cell farthest from the start: always a dead end, so nothing lies behind them.
    goal = cells.map((_, index) => index).reduce((far, index) => (wayBetween(cells, N, 0, index)?.length ?? 0) > (wayBetween(cells, N, 0, far)?.length ?? 0) ? index : far, 0);
    const way = wayBetween(cells, N, player, goal);
    doors = Array.from({ length: R.doorsPerFloor }, (_, i) => ({ doorId: `${sessionId}:f${at}:d${i}`,
      cell: way[Math.floor((i + 1) * way.length / (R.doorsPerFloor + 1)) - 1], problem: doorIndex + i, open: false }));
    const onWay = new Set([0, ...way]);
    // Friends wait off the way, in dead ends if there are enough, never behind the stairs
    // (reaching them ends the floor).
    const offWay = cells.map((cell, index) => ({ index, open: Object.values(cell).filter(Boolean).length }))
      .filter(item => !onWay.has(item.index) && !wayBetween(cells, N, 0, item.index).includes(goal));
    const ends = shuffled(offWay.filter(item => item.open === 1), random), others = shuffled(offWay.filter(item => item.open > 1), random);
    friends = [...ends, ...others].map(item => item.index).slice(0, R.friendsPerFloor).map((cell, i) => ({ friendId: `${sessionId}:f${at}:g${i}`, cell, index: at * R.friendsPerFloor + i, met: false }));
    walkState();
    notify('floorStarted', { floor: at });
  };
  const ask = door => {
    const item = problems[door.problem];
    atDoor = door.doorId; queue = [];
    problem = Object.freeze({ problemId: `${item.problemId}:${tries}`, contentId: item.contentId, skillId: item.skillId, kind: item.kind,
      prompt: item.prompt, sentence: item.sentence ?? null, explain: item.explain, doorId: door.doorId,
      choices: Object.freeze(item.plates.map(plate => Object.freeze({ choiceId: plate.plateId, text: plate.text, note: plate.note ?? null }))), correctChoiceId: item.answerId });
    attemptId = `${problem.problemId}:attempt`; phase = 'answering';
    if (tries === 0) notify('problemPresented', { skillId: item.skillId, kind: item.kind });
  };
  const complete = () => {
    phase = 'completed'; problem = null; attemptId = null; queue = [];
    result = Object.freeze({ answered, correct, incorrect, accuracy: answered ? correct / answered : 0, opened, friends: friendsMet, floors: floor + 1, finished: true });
    if (!completeEmitted) { completeEmitted = true; notify('sessionComplete', result); }
  };
  const arrive = () => {
    const friend = friends.find(item => item.cell === player && !item.met);
    if (friend) { friend.met = true; friendsMet++; lastFriend = Object.freeze({ meet: friendsMet, friendId: friend.friendId, index: friend.index, cell: friend.cell }); notify('friendMet', { friends: friendsMet }); }
    if (player === goal) { queue = []; problem = null; attemptId = null; phase = 'cleared'; clearLeft = R.clearMs; }
  };
  // One step of the queued way: a closed door stops the walk and asks its question.
  const step = () => {
    const next = queue[0];
    const door = doorAt(next);
    if (door) { tries = 0; ask(door); return; }
    queue.shift(); player = next; steps++;
    arrive();
  };

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying || !Array.isArray(problems) || problems.length < R.floors * R.doorsPerFloor
        || problems.some(item => !item.plates?.some(plate => plate.plateId === item.answerId))) return false;
      buildFloor(0); return true;
    },
    update(dtMs) {
      if (!active || paused || ['ready', 'completed'].includes(phase) || !Number.isFinite(dtMs) || notifying) return;
      const dt = Math.max(0, Math.min(dtMs, 100));
      activeElapsedMs += dt;
      if (phase === 'cleared') {
        clearLeft -= dt;
        if (clearLeft > 0) return;
        doorIndex += R.doorsPerFloor;
        if (floor + 1 >= R.floors) complete(); else buildFloor(floor + 1);
        return;
      }
      if (phase !== 'walking' || !queue.length) return;
      stepMs += dt;
      while (stepMs >= R.stepMs && queue.length && phase === 'walking') { stepMs -= R.stepMs; step(); }
      if (!queue.length) stepMs = 0;
    },
    setPaused(value) { if (active) paused = !!value; },
    // One step one way, or a walk to a cell along the maze (it stops at a closed door).
    move({ sessionId: s, attemptId: a, direction } = {}) {
      if (!active || paused || notifying || phase !== 'walking' || s !== sessionId || a !== attemptId || !DIRS[direction]) return false;
      if (!cells[player][WALL[direction]]) return false;
      const [dr, dc] = DIRS[direction];
      queue = [(Math.floor(player / N) + dr) * N + (player % N) + dc]; stepMs = R.stepMs;
      return true;
    },
    walkTo({ sessionId: s, attemptId: a, cell } = {}) {
      if (!active || paused || notifying || phase !== 'walking' || s !== sessionId || a !== attemptId) return false;
      if (!Number.isInteger(cell) || cell < 0 || cell >= N * N || cell === player) return false;
      // The walk goes as far as the first closed door on the way, which then asks its question.
      const way = wayBetween(cells, N, player, cell);
      if (!way) return false;
      queue = way; stepMs = R.stepMs;
      return true;
    },
    answer({ sessionId: s, attemptId: a, choiceId } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || s !== sessionId || a !== attemptId) return false;
      const choice = problem.choices.find(item => item.choiceId === choiceId);
      if (!choice) return false;
      const door = doors.find(item => item.doorId === atDoor), right = choiceId === problem.correctChoiceId, first = tries === 0;
      if (first) { answered++; if (right) correct++; else incorrect++; }
      lastAnswer = Object.freeze({ answer: ++answerSerial, correct: right, first, chosen: choice.text, note: choice.note, explain: problem.explain,
        answerText: problem.choices.find(item => item.choiceId === problem.correctChoiceId).text, doorId: door.doorId, cell: door.cell });
      const payload = { attemptId, contentId: problem.contentId, skillId: problem.skillId, chosen: choiceId };
      if (right) {
        door.open = true; opened++; atDoor = null; hintChoiceId = null;
        notify(first ? 'correct' : 'opened', payload);
        // The companion steps through the open door.
        player = door.cell; steps++; walkState(); arrive();
      } else {
        if (first) missed.push(Object.freeze({ contentId: problem.contentId, prompt: problem.prompt, chosen: choice.text, explain: problem.explain, build: buildTarget(problem), questionNumber: answered }));
        hintChoiceId = problem.correctChoiceId;
        notify(first ? 'incorrect' : 'retry', payload);
        tries++; ask(door);
      }
      return true;
    },
    // Steps back from a door without answering, to look around first.
    leave({ sessionId: s } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || s !== sessionId || tries > 0) return false;
      atDoor = null; walkState(); return true;
    },
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      if (command.type === 'move') return this.move(command.payload);
      if (command.type === 'walkTo') return this.walkTo(command.payload);
      if (command.type === 'answer') return this.answer(command.payload);
      if (command.type === 'leave') return this.leave(command.payload);
      return false;
    },
    snapshot,
    exit() {
      if (!active) return;
      active = false; attemptId = null; aborted = phase !== 'completed'; observer = null;
    },
  };
}
