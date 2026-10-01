import { buildTarget } from '../buildReview.js';

export const RACE_RULES = Object.freeze({
  lanes: 4, rivals: 3,
  // Time from one gate to the next at plain speed (normal / ゆっくり), in ms.
  gateMs: Object.freeze({ normal: 5200, slow: 7200 }),
  // The first gate is one gate away; the finish line comes this far after the last right gate.
  finishAfter: 0.6,
  // A dash and a slow-down last this share of a gate's time, so both paces play alike.
  boost: Object.freeze({ share: 0.35, rate: 1.7 }), slow: Object.freeze({ share: 0.23, rate: 0.6 }),
  // Rivals run a little faster than plain speed (dashes beat them), and keep near the child: they ease off
  // when ahead and catch up when far behind, so the race stays close.
  rivalRates: Object.freeze([1.16, 1.1, 1.04]), ahead: 1.0, behind: 1.4,
});
const R = RACE_RULES;

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

// Nonpersistent Core: a race. The child runs with the companion down a four-lane course;
// each gate shows four plates, one per lane. Moving into the lane of the answer before
// the gate gives a dash; another lane slows the runner a little, shows what its plate
// was, and the same question comes at the next gate with the answer's lane glowing.
// A gate counts only when the child has chosen a lane for it (a tap, even on the lane
// already taken): a runner who simply has not decided yet when the gate comes ("まにあわな
// かった") records nothing, and the same question comes again at the next gate, still as a
// first try. After two such gates the answer's lane glows, after three the companion takes
// it; a question whose answer was shown that way records no result.
// Three rival Gotomon run alongside and keep the race close. After twelve questions the
// finish line comes; there is no game over. One learning result per question, on its
// first chosen gate; each gate is its own problem id.
export function createRaceGame({ sessionId, random = Math.random, onEvent = () => {}, content, pace = 'normal' }) {
  const problems = content?.problems ?? null;
  const slow = pace === 'slow';
  const gateMs = R.gateMs[slow ? 'slow' : 'normal'], plain = 1 / gateMs;
  const boostLength = R.boost.share * gateMs, slowLength = R.slow.share * gateMs;
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', seq = 0, activeElapsedMs = 0, index = 0, tries = 0, gateSerial = 0;
  let distance = 0, lane = 1, boostMs = 0, slowMs = 0, gate = null, finishAt = null, hintPlateId = null, chose = false, late = 0, revealed = false, unanswered = 0;
  let answered = 0, correct = 0, incorrect = 0, dashes = 0;
  let result = null, lastGate = null, aborted = false, completeEmitted = false, problem = null, attemptId = null;
  let rivals = [];
  const missed = [];

  const current = () => problems?.[index] ?? null;
  const speed = () => plain * (boostMs > 0 ? R.boost.rate : slowMs > 0 ? R.slow.rate : 1);
  const place = () => 1 + rivals.filter(rival => rival.distance > distance).length;
  const snapshot = () => Object.freeze({
    gameId: 'gotomonRace', mode: 'race', sessionId, phase, paused, active, aborted, seq, activeElapsedMs, pace: slow ? 'slow' : 'normal',
    distance, lane, chose, late, lanes: R.lanes, speed: speed(), plainSpeed: plain, boostMs, slowMs, finishAt, hintPlateId, place: place(),
    gate: gate ? Object.freeze({ ...gate, plates: Object.freeze(gate.plates.map(plate => Object.freeze({ ...plate }))) }) : null,
    rivals: Object.freeze(rivals.map(rival => Object.freeze({ ...rival }))),
    problemIndex: index, total: problems ? problems.length : 0, dashes,
    problem, attemptId, answered, correct, incorrect, result, lastGate, missed: Object.freeze([...missed]),
  });
  const notify = (type, payload = {}, problemId = problem?.problemId ?? null) => {
    const event = Object.freeze({ version: 1, gameId: 'gotomonRace', sessionId, seq: ++seq, type,
      problemId, activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation observers cannot undo a committed answer. */ }
    finally { notifying = false; }
  };
  // The next gate, one gate on, with the plates in a new order across the lanes.
  const openGate = at => {
    const item = current();
    gate = { gateId: `${sessionId}:gate:${++gateSerial}`, at, plates: shuffled(item.plates, random) };
    chose = false;
    problem = Object.freeze({ problemId: `${item.problemId}:${tries}${late ? `:late${late}` : ''}`, contentId: item.contentId, skillId: item.skillId, kind: item.kind,
      prompt: item.prompt, sentence: item.sentence ?? null, answerId: item.answerId, explain: item.explain,
      choices: Object.freeze(gate.plates.map(plate => Object.freeze({ choiceId: plate.plateId, text: plate.text }))), correctChoiceId: item.answerId });
    attemptId = `${problem.problemId}:attempt`;
  };
  const complete = () => {
    phase = 'completed'; problem = null; attemptId = null; gate = null; hintPlateId = null;
    result = Object.freeze({ answered, correct, incorrect, unanswered, accuracy: answered ? correct / answered : 0, dashes, place: place(), finished: true });
    if (!completeEmitted) { completeEmitted = true; notify('sessionComplete', result); }
  };
  const passGate = () => {
    // No lane chosen for this gate: nothing is recorded, the question comes again.
    if (!chose) {
      const item = current(), at = gate.at;
      late++; slowMs = 0; boostMs = 0;
      if (late >= 2 && tries === 0 && !revealed) { revealed = true; hintPlateId = item.answerId; }
      lastGate = Object.freeze({ gate: gateSerial, late: true, lane, correct: null, first: false });
      openGate(at + 1);
      // Third gate in a row without a choice: the companion takes the answer's lane.
      if (late >= 3) { lane = gate.plates.findIndex(p => p.plateId === item.answerId); chose = true; }
      return;
    }
    const item = current(), plate = gate.plates[lane], right = plate.plateId === item.answerId, first = tries === 0 && !revealed;
    if (tries === 0 && revealed) unanswered++;
    const problemId = problem.problemId, committedAttempt = attemptId;
    if (first) { answered++; if (right) correct++; else incorrect++; }
    const answer = item.plates.find(p => p.plateId === item.answerId);
    lastGate = Object.freeze({ gate: gateSerial, correct: right, first, lane, text: plate.text, note: plate.note, answer: answer.text, explain: item.explain });
    const payload = { attemptId: committedAttempt, contentId: item.contentId, skillId: item.skillId, chosen: plate.plateId };
    const at = gate.at;
    if (right) {
      dashes++; boostMs = boostLength; slowMs = 0; hintPlateId = null;
      notify(first ? 'correct' : 'passed', payload, problemId);
      if (index + 1 >= problems.length) { gate = null; problem = null; attemptId = `${sessionId}:finish`; finishAt = at + R.finishAfter; return; }
      index++; tries = 0; late = 0; revealed = false; openGate(at + 1);
      notify('problemPresented', { skillId: current().skillId, kind: current().kind });
    } else {
      slowMs = slowLength; boostMs = 0; hintPlateId = item.answerId;
      if (first) missed.push(Object.freeze({ contentId: item.contentId, prompt: item.prompt, chosen: plate.text, explain: item.explain, build: buildTarget(item), questionNumber: answered }));
      notify(first ? 'incorrect' : 'retry', payload, problemId);
      tries++; late = 0; openGate(at + 1);
    }
  };

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying || !Array.isArray(problems) || !problems.length
        || problems.some(item => item.plates?.length !== R.lanes || !item.plates.some(plate => plate.plateId === item.answerId))) return false;
      rivals = R.rivalRates.map((rate, i) => ({ rivalId: `${sessionId}:rival:${i}`, distance: -0.05 * (i + 1), lane: [0, 2, 3][i], rate }));
      phase = 'answering'; openGate(1);
      notify('problemPresented', { skillId: current().skillId, kind: current().kind });
      return true;
    },
    update(dtMs) {
      if (!active || paused || phase !== 'answering' || !Number.isFinite(dtMs) || notifying) return;
      const dt = Math.max(0, Math.min(dtMs, 100));
      activeElapsedMs += dt;
      distance += speed() * dt;
      boostMs = Math.max(0, boostMs - dt); slowMs = Math.max(0, slowMs - dt);
      for (const rival of rivals) {
        const gap = rival.distance - distance;
        const rate = gap > R.ahead ? rival.rate * 0.85 : gap < -R.behind ? rival.rate * 1.35 : rival.rate;
        rival.distance += plain * rate * dt;
        // Rivals drift between lanes now and then.
        if (take(random) < dt / 2500) rival.lane = Math.max(0, Math.min(R.lanes - 1, rival.lane + (take(random) < 0.5 ? -1 : 1)));
      }
      if (gate && distance >= gate.at) passGate();
      else if (finishAt !== null && distance >= finishAt) complete();
    },
    setPaused(value) { if (active) paused = !!value; },
    // Moves the runner to a lane (0 is the left).
    steer({ sessionId: s, attemptId: a, lane: to } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || s !== sessionId || a !== attemptId) return false;
      if (!Number.isInteger(to) || to < 0 || to >= R.lanes) return false;
      // A tap on the lane already taken also chooses it for this gate.
      lane = to; chose = true; return true;
    },
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      if (command.type === 'steer') return this.steer(command.payload);
      return false;
    },
    snapshot,
    exit() {
      if (!active) return;
      active = false; attemptId = null; aborted = phase !== 'completed'; observer = null;
    },
  };
}
