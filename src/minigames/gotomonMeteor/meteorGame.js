import { buildTossProblems, nearbyNumbers } from '../gotomonToss/tossContent.js';
import { equationTarget } from '../buildReview.js';

// Field coordinates run 0..1 across and down.
export const METEOR_RULES = Object.freeze({
  bases: Object.freeze([0.2, 0.5, 0.8]), groundY: 0.78, startY: -0.02,
  // Time a meteor takes to reach the ground (normal / ゆっくり), in ms.
  fallMs: Object.freeze({ normal: 15000, slow: 24000 }),
  maxMeteors: 2, spawnEveryMs: Object.freeze({ normal: 5200, slow: 8000 }), meteors: 12,
  minX: 0.14, maxX: 0.86,
});
const R = METEOR_RULES;

function take(random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('random must be in [0, 1)');
  return value;
}

// Nonpersistent Core: meteor defence. Meteors with calculations fall, at most two at
// a time; three bases, each guarded by a Gotomon with a number, stand on the ground.
// The child fires from the base whose number answers the targeted meteor (the lowest,
// or the one tapped). A wrong base only says so and the right base glows; a meteor that
// lands is caught by the shield and shows its answer — no game over. Every meteor on
// the field has its answer on a base; bases no meteor needs get new likely numbers.
// One learning result per meteor: the first shot at it. A meteor that lands before any
// shot at it records nothing (with two falling at once, the child may well have been busy
// with the other one); the shield shows its answer and it is counted as unanswered.
export function createMeteorGame({ sessionId, random = Math.random, onEvent = () => {}, content, pace = 'normal' }) {
  const level = content?.level === 'times' ? 'times' : 'addsub';
  const problems = content?.problems ?? buildTossProblems({ sessionId, random, level });
  const fallPerMs = (R.groundY - R.startY) / R.fallMs[pace === 'slow' ? 'slow' : 'normal'];
  const spawnEvery = R.spawnEveryMs[pace === 'slow' ? 'slow' : 'normal'];
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', seq = 0, activeElapsedMs = 0, cursor = 0, spawnMs = 0, shotSerial = 0, landSerial = 0;
  let answered = 0, correct = 0, incorrect = 0, unanswered = 0, defended = 0, shielded = 0, resolved = 0;
  let result = null, lastShot = null, lastLanding = null, aborted = false, completeEmitted = false, explicitTarget = null;
  let meteors = [];
  const bases = R.bases.map((x, i) => ({ baseId: `${sessionId}:base:${i}`, slot: i, x, number: null, version: 0 }));
  const missed = [];

  const target = () => meteors.find(m => m.meteorId === explicitTarget) ?? meteors.reduce((low, m) => !low || m.y > low.y ? m : low, null);
  const problemOf = meteor => meteor ? Object.freeze({ problemId: `${meteor.problemId}:${meteor.tries}`, contentId: meteor.problemId, skillId: meteor.skillId,
    question: meteor.question, answer: meteor.answer, meteorId: meteor.meteorId,
    choices: Object.freeze(bases.map(base => Object.freeze({ choiceId: base.baseId, text: String(base.number) }))),
    correctChoiceId: bases.find(base => base.number === meteor.answer)?.baseId ?? null }) : null;
  const attemptOf = meteor => meteor ? `${meteor.problemId}:${meteor.tries}:attempt` : null;
  const snapshot = () => {
    const aimed = target();
    return Object.freeze({
      gameId: 'gotomonMeteor', mode: 'meteor', sessionId, phase, paused, active, aborted, seq, activeElapsedMs, level,
      meteors: Object.freeze(meteors.map(m => Object.freeze({ ...m }))), bases: Object.freeze(bases.map(b => Object.freeze({ ...b }))),
      targetId: aimed?.meteorId ?? null, hintBaseId: aimed?.hintBaseId ?? null,
      problem: problemOf(aimed), attemptId: attemptOf(aimed), fallen: resolved, total: problems.length, defended, shielded,
      answered, correct, incorrect, result, lastShot, lastLanding, missed: Object.freeze([...missed]),
    });
  };
  const notify = (type, meteor, payload = {}) => {
    const event = Object.freeze({ version: 1, gameId: 'gotomonMeteor', sessionId, seq: ++seq, type,
      problemId: meteor ? `${meteor.problemId}:${meteor.tries}` : null, activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation observers cannot undo a committed answer. */ }
    finally { notifying = false; }
  };
  // Bases no meteor needs get likely slips of a falling meteor, all three different.
  const relabel = () => {
    const needed = [...new Set(meteors.map(m => m.answer))];
    const keep = new Set(bases.filter(b => needed.includes(b.number)).map(b => b.baseId));
    for (const answer of needed) {
      if (bases.some(b => b.number === answer)) continue;
      const free = bases.find(b => !keep.has(b.baseId)); if (!free) continue;
      free.number = answer; free.version++; keep.add(free.baseId);
    }
    const source = meteors[meteors.length - 1] ?? problems[Math.min(cursor, problems.length - 1)];
    const slips = source ? nearbyNumbers(source) : [];
    for (const base of bases) {
      if (keep.has(base.baseId)) continue;
      const used = new Set(bases.filter(b => b !== base).map(b => b.number));
      const options = slips.filter(n => !used.has(n) && !needed.includes(n));
      const pick = options.length ? options[Math.floor(take(random) * options.length)] : [...Array(40).keys()].find(n => !used.has(n) && !needed.includes(n));
      if (base.number !== pick) { base.number = pick; base.version++; }
    }
  };
  const spawn = () => {
    if (cursor >= problems.length || meteors.length >= R.maxMeteors) return false;
    const item = problems[cursor++];
    const x = R.minX + take(random) * (R.maxX - R.minX);
    meteors.push({ meteorId: `${sessionId}:m${cursor}`, problemId: item.problemId, skillId: item.skillId, question: item.question, answer: item.answer,
      operation: item.operation, a: item.a, b: item.b,
      x, y: R.startY, tries: 0, judged: false, hintBaseId: null });
    relabel(); spawnMs = 0;
    notify('problemPresented', meteors[meteors.length - 1], { skillId: item.skillId });
    return true;
  };
  const judge = (meteor, right, reason) => {
    if (meteor.judged) return false;
    meteor.judged = true; answered++;
    if (right) correct++;
    else {
      incorrect++;
      missed.push(Object.freeze({ contentId: meteor.problemId, question: meteor.question, answer: meteor.answer, reason, questionNumber: answered,
        build: equationTarget({ question: meteor.question, answer: meteor.answer }) }));
    }
    return true;
  };
  const remove = meteor => {
    meteors = meteors.filter(m => m !== meteor); resolved++;
    if (explicitTarget === meteor.meteorId) explicitTarget = null;
    relabel();
    if (resolved >= problems.length) complete();
    else if (!meteors.length) spawnMs = spawnEvery * 0.75;
  };
  const complete = () => {
    phase = 'completed'; meteors = []; explicitTarget = null;
    result = Object.freeze({ answered, correct, incorrect, unanswered, accuracy: answered ? correct / answered : 0, defended, shielded, finished: true });
    if (!completeEmitted) { completeEmitted = true; notify('sessionComplete', null, result); }
  };

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying || !Array.isArray(problems) || !problems.length) return false;
      phase = 'answering'; spawn(); return true;
    },
    update(dtMs) {
      if (!active || paused || ['ready', 'completed'].includes(phase) || !Number.isFinite(dtMs) || notifying) return;
      const dt = Math.max(0, Math.min(dtMs, 100));
      activeElapsedMs += dt;
      for (const meteor of meteors) meteor.y += fallPerMs * dt;
      for (const meteor of meteors.filter(m => m.y >= R.groundY)) {
        if (phase !== 'answering') break;
        // The shield catches it and shows the answer; not shot at, it is no answer.
        const unshot = !meteor.judged; shielded++;
        if (unshot) { meteor.judged = true; unanswered++; }
        lastLanding = Object.freeze({ landing: ++landSerial, meteorId: meteor.meteorId, x: meteor.x, question: meteor.question, answer: meteor.answer, unshot });
        // Report before removing: the last meteor's removal ends the run.
        if (unshot) notify('landed', meteor, { contentId: meteor.problemId, skillId: meteor.skillId, reason: 'landed', answer: meteor.answer });
        remove(meteor);
      }
      if (phase !== 'answering') return;
      spawnMs += dt;
      if (!meteors.length || (spawnMs >= spawnEvery && meteors.length < R.maxMeteors)) spawn();
    },
    setPaused(value) { if (active) paused = !!value; },
    // Tapping a meteor aims at it.
    select({ sessionId: s, meteorId } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || s !== sessionId) return false;
      if (!meteors.some(m => m.meteorId === meteorId) || explicitTarget === meteorId) return false;
      explicitTarget = meteorId; return true;
    },
    fire({ sessionId: s, attemptId: a, baseId } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || s !== sessionId) return false;
      const aimed = target(), base = bases.find(b => b.baseId === baseId);
      if (!aimed || !base || a !== attemptOf(aimed)) return false;
      const right = base.number === aimed.answer, first = judge(aimed, right, 'wrong');
      lastShot = Object.freeze({ shot: ++shotSerial, baseId, slot: base.slot, number: base.number, meteorId: aimed.meteorId, question: aimed.question,
        answer: aimed.answer, correct: right, first, x: aimed.x, y: aimed.y });
      const payload = { contentId: aimed.problemId, skillId: aimed.skillId, chosen: base.number, answer: aimed.answer };
      if (right) {
        defended++;
        notify(first ? 'correct' : 'defended', aimed, payload);
        remove(aimed);
      } else {
        aimed.hintBaseId = bases.find(b => b.number === aimed.answer)?.baseId ?? null;
        notify(first ? 'incorrect' : 'retry', aimed, payload);
        aimed.tries++;
      }
      return true;
    },
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      if (command.type === 'fire') return this.fire(command.payload);
      if (command.type === 'select') return this.select(command.payload);
      return false;
    },
    snapshot,
    exit() {
      if (!active) return;
      active = false; aborted = phase !== 'completed'; observer = null; meteors = [];
    },
  };
}
