import { SHOOTER_FORMATION } from './shooterContent.js';
import { buildTarget } from '../buildReview.js';
import { sharedProblem } from '../gotomonSlash/slashContent.js';

// Field coordinates run 0..1 across and down.
export const SHOOTER_RULES = Object.freeze({
  shipY: 0.86, shipSpeedPerMs: 0.0016, minX: 0.08, maxX: 0.92,
  beamSpeedPerMs: 0.0017, beamCooldownMs: 320, maxBeams: 3,
  lanes: Object.freeze([0.2, 0.4, 0.6, 0.8]), sway: 0.05, swayMs: 2600,
  // The formation drifts down (normal / ゆっくり) and loops back to the top.
  fallPerMs: Object.freeze({ normal: 0.000055, slow: 0.00003 }), startY: 0.1, loopY: 0.66,
  hitX: 0.075, hitY: 0.07,
  maxSimulationStepMs: 50,
});
const R = SHOOTER_RULES;

// Nonpersistent Core: a vertical shooter. The companion's ship moves along the bottom
// and fires friendship beams; a formation of four Gotomon holding plates drifts down
// and loops back to the top, so nothing is ever lost. The beam that reaches the
// Gotomon with the answer makes friends with it and the next wave comes. A beam that
// reaches another Gotomon shows that plate's word and meaning; that Gotomon leaves,
// the answer glows, and the wave stays. One learning result per wave, on the first
// hit; each hit is its own problem id so the Host's feedback timing restarts.
export function createShooterGame({ sessionId, onEvent = () => {}, content, pace = 'normal' }) {
  const waves = content?.waves ?? null;
  const fall = R.fallPerMs[pace === 'slow' ? 'slow' : 'normal'];
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', seq = 0, activeElapsedMs = 0, index = 0, tries = 0, hitSerial = 0, beamSerial = 0;
  let answered = 0, correct = 0, incorrect = 0, friends = 0;
  let result = null, lastAnswer = null, aborted = false, completeEmitted = false, problem = null, attemptId = null, hintId = null;
  let shipX = 0.5, targetX = 0.5, fireOnArrival = false, cooldown = 0, formationY = R.startY, clock = 0;
  let enemies = [], beams = [];
  const missed = [];

  const current = () => waves?.[index] ?? null;
  const enemyX = enemy => enemy.lane + Math.sin((clock / R.swayMs) * Math.PI * 2 + enemy.slot * 1.3) * R.sway;
  const snapshot = () => Object.freeze({
    gameId: 'gotomonShooter', mode: 'shooter', sessionId, phase, paused, active, aborted, seq, activeElapsedMs,
    ship: Object.freeze({ x: shipX, y: R.shipY, targetX }),
    enemies: Object.freeze(enemies.map(enemy => Object.freeze({ ...enemy, x: enemyX(enemy), y: formationY }))),
    beams: Object.freeze(beams.map(beam => Object.freeze({ ...beam }))), hintId,
    wave: index, waves: waves ? waves.length : 0, friends,
    problem, attemptId, answered, correct, incorrect, result, lastAnswer, missed: Object.freeze([...missed]),
  });
  const notify = (type, payload = {}) => {
    const event = Object.freeze({ version: 1, gameId: 'gotomonShooter', sessionId, seq: ++seq, type,
      problemId: problem?.problemId ?? null, activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation observers cannot undo a committed answer. */ }
    finally { notifying = false; }
  };
  const openTry = () => {
    const item = current(), answer = enemies.find(enemy => enemy.plate.contentId === item.contentId);
    problem = Object.freeze({ problemId: `${item.problemId}:${tries}`, contentId: item.contentId, skillId: item.skillId, kind: item.kind,
      prompt: item.prompt, sentence: item.sentence ?? null, word: item.word, meaning: item.meaning,
      choices: Object.freeze(enemies.map(enemy => Object.freeze({ choiceId: enemy.enemyId, text: enemy.plate.text }))), correctChoiceId: answer?.enemyId ?? null });
    attemptId = `${problem.problemId}:attempt`; lastAnswer = null; phase = 'answering'; beams = [];
  };
  const startWave = at => {
    index = at; tries = 0; hintId = null; formationY = R.startY;
    enemies = current().plates.map((plate, slot) => ({ enemyId: `${sessionId}:w${at}:e${slot}`, slot, lane: R.lanes[slot], plate }));
    notify('problemPresented', { skillId: current().skillId, kind: current().kind });
    openTry();
  };
  const complete = () => {
    phase = 'completed'; problem = null; attemptId = null; hintId = null; enemies = []; beams = [];
    result = Object.freeze({ answered, correct, incorrect, accuracy: answered ? correct / answered : 0, friends, finished: true });
    if (!completeEmitted) { completeEmitted = true; notify('sessionComplete', result); }
  };
  const shoot = () => {
    if (cooldown > 0 || beams.length >= R.maxBeams) return false;
    beams.push({ beamId: `${sessionId}:beam:${++beamSerial}`, x: shipX, y: R.shipY - 0.04 }); cooldown = R.beamCooldownMs;
    return true;
  };
  const hit = enemy => {
    const item = current(), right = enemy.plate.contentId === item.contentId, first = tries === 0;
    const at = { x: enemyX(enemy), y: formationY }, committedAttempt = attemptId;
    attemptId = null; phase = 'feedback'; beams = [];
    if (first) { answered++; if (right) correct++; else incorrect++; }
    if (right) { friends++; hintId = null; }
    else {
      tries++; enemies = enemies.filter(other => other !== enemy);
      hintId = enemies.find(other => other.plate.contentId === item.contentId)?.enemyId ?? null;
      if (first) missed.push(Object.freeze({ contentId: item.contentId, word: item.word, meaning: item.meaning, kind: item.kind,
        chosen: enemy.plate.text, build: buildTarget(sharedProblem(item)), questionNumber: answered }));
    }
    lastAnswer = Object.freeze({ attemptId: committedAttempt, hit: ++hitSerial, correct: right, first, kind: item.kind, word: item.word, meaning: item.meaning,
      prompt: item.prompt, plate: enemy.plate, slot: enemy.slot, x: at.x, y: at.y });
    const payload = { attemptId: committedAttempt, contentId: item.contentId, skillId: item.skillId, chosen: enemy.plate.contentId };
    // One learning result per wave: the first hit. Later hits are just play.
    if (first) notify(right ? 'correct' : 'incorrect', payload);
    else notify(right ? 'befriended' : 'retry', payload);
  };

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying || !Array.isArray(waves) || !waves.length
        || waves.some(item => item.plates?.length !== SHOOTER_FORMATION || !item.plates.some(plate => plate.contentId === item.contentId))) return false;
      startWave(0); return true;
    },
    update(dtMs) {
      if (!active || paused || ['ready', 'completed'].includes(phase) || !Number.isFinite(dtMs)) return;
      const dt = Math.max(0, dtMs);
      activeElapsedMs += dt;
      if (phase !== 'answering') return;
      for (let left = dt; left > 0 && phase === 'answering'; left -= R.maxSimulationStepMs) {
        const step = Math.min(left, R.maxSimulationStepMs);
        clock += step; cooldown = Math.max(0, cooldown - step);
        // The ship glides toward where the child pointed; a tap fires once it arrives.
        const gap = targetX - shipX, move = R.shipSpeedPerMs * step;
        shipX = Math.abs(gap) <= move ? targetX : shipX + Math.sign(gap) * move;
        if (fireOnArrival && shipX === targetX) { fireOnArrival = false; shoot(); }
        formationY += fall * step; if (formationY > R.loopY) formationY = R.startY - 0.08;
        for (const beam of beams) beam.y -= R.beamSpeedPerMs * step;
        beams = beams.filter(beam => beam.y > -0.05);
        for (const beam of beams) {
          const enemy = enemies.find(other => Math.abs(enemyX(other) - beam.x) <= R.hitX && Math.abs(formationY - beam.y) <= R.hitY);
          if (enemy) { hit(enemy); break; }
        }
      }
    },
    setPaused(value) { if (active) paused = !!value; },
    steer({ sessionId: s, attemptId: a, x } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || s !== sessionId || a !== attemptId || !Number.isFinite(x)) return false;
      targetX = Math.min(R.maxX, Math.max(R.minX, x)); fireOnArrival = false; return true;
    },
    // Glide to a spot and fire when there: one tap aims and shoots.
    aimFire({ sessionId: s, attemptId: a, x } = {}) {
      if (!this.steer({ sessionId: s, attemptId: a, x })) return false;
      if (shipX === targetX) return shoot();
      fireOnArrival = true; return true;
    },
    fire({ sessionId: s, attemptId: a } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || s !== sessionId || a !== attemptId) return false;
      return shoot();
    },
    next({ sessionId: sourceSession } = {}) {
      if (!active || paused || notifying || sourceSession !== sessionId || phase !== 'feedback') return false;
      if (lastAnswer?.correct) {
        if (index + 1 >= waves.length) { complete(); return true; }
        startWave(index + 1); return true;
      }
      openTry();
      return true;
    },
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      if (['steer', 'aimFire', 'fire', 'next'].includes(command.type)) return this[command.type](command.payload);
      return false;
    },
    snapshot,
    exit() {
      if (!active) return;
      active = false; attemptId = null; aborted = phase !== 'completed'; observer = null;
    },
  };
}
