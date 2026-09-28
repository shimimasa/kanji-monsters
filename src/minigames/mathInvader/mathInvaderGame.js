import { generateSessionProblems } from '../mathSprint/mathSprintGenerator.js';
import { normalizeMathAnswer } from '../mathSprint/mathSprintGame.js';

export const MATH_INVADER_RULES = Object.freeze({
  totalProblems: 10,
  maxEnemies: 3,
  firstWaveCapacity: 2,
  startingShield: 3,
  spawnY: 0.06,
  barrierY: 0.84,
  spawnIntervalMs: 3600,
  emptySpawnMs: 700,
  waveSpeedsPerMs: Object.freeze([0.000058, 0.000068, 0.00008]),
  bossSpeedPerMs: 0.000045,
  targetSpeedFactor: 0.6,
  slowPaceFactor: 0.55,
  maxSimulationStepMs: 100,
});

const formatQuestion = problem => `${problem.a} ${problem.operation === 'addition' ? '+' : '−'} ${problem.b}`;
const waveFor = spawnedNumber => spawnedNumber <= 3 ? 0 : spawnedNumber <= 6 ? 1 : 2;

// Nonpersistent Core. Enemies never stop falling while play runs: a typed
// answer hits the enemy it solves, and an enemy reaching the barrier only
// reveals its answer. There is no game over; every run resolves ten problems.
export function createMathInvaderGame({ sessionId, random = Math.random, pace = 'normal', onEvent = () => {} }) {
  const rules = MATH_INVADER_RULES;
  const problems = generateSessionProblems({ sessionId, random });
  const paceFactor = pace === 'slow' ? rules.slowPaceFactor : 1;
  let active = true, externalPaused = false, notifying = false, observer = onEvent;
  let phase = 'ready', seq = 0, activeElapsedMs = 0, spawnElapsedMs = 0;
  let problemCursor = 0, enemySerial = 0, projectileSerial = 0, inputSerial = 0;
  let enemies = [], projectiles = [], explicitTargetId = null, inputToken = null;
  let shield = rules.startingShield, correct = 0, incorrect = 0, escaped = 0, resolved = 0;
  let streak = 0, maxStreak = 0, result = null, lastAttempt = null, lastEscape = null, aborted = false;
  let completeEmitted = false;
  const solved = [];

  const frontmost = () => enemies.reduce((best, enemy) => !best || enemy.y > best.y ? enemy : best, null);
  const target = () => enemies.find(enemy => enemy.enemyId === explicitTargetId) ?? frontmost();
  const publicEnemy = enemy => Object.freeze({ ...enemy });
  const snapshot = () => {
    const aimed = target();
    return Object.freeze({
      gameId: 'mathInvader', mode: 'arcade', sessionId, phase, pace: pace === 'slow' ? 'slow' : 'normal',
      paused: externalPaused, active, aborted, activeElapsedMs, seq,
      life: shield, maxLife: rules.startingShield, correct, incorrect, escaped, resolved, streak,
      spawned: problemCursor, remaining: problems.length - problemCursor, total: problems.length,
      inputToken, targetId: aimed?.enemyId ?? null, explicitTargetId,
      targetEnemy: aimed ? publicEnemy(aimed) : null,
      enemies: Object.freeze(enemies.map(publicEnemy)),
      projectiles: Object.freeze(projectiles.map(projectile => Object.freeze({ ...projectile }))),
      solved: Object.freeze([...solved]), result, lastAttempt, lastEscape,
    });
  };
  const notify = (type, enemy = null, payload = {}) => {
    const event = Object.freeze({
      version: 1, gameId: 'mathInvader', sessionId, seq: ++seq, type,
      problemId: enemy?.problemId ?? null, activeElapsedMs,
      payload: Object.freeze(payload),
    });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Display observers cannot undo committed state. */ }
    finally { notifying = false; }
  };
  const renewInput = () => { inputToken = `${sessionId}:input:${++inputSerial}`; };
  const spawnOne = () => {
    if (!active || phase !== 'playing' || problemCursor >= problems.length) return false;
    const boss = problemCursor === problems.length - 1;
    const capacity = problemCursor < 3 ? rules.firstWaveCapacity : rules.maxEnemies;
    if (boss ? enemies.length > 0 : enemies.length >= capacity) return false;
    const problem = problems[problemCursor++];
    const occupied = new Set(enemies.map(enemy => enemy.lane));
    const start = Math.floor(Math.min(Math.max(Number(random()) || 0, 0), 0.999999) * 3);
    const lane = boss ? 1 : [0, 1, 2].map(offset => (start + offset) % 3).find(value => !occupied.has(value)) ?? start;
    const enemy = {
      enemyId: `${sessionId}:enemy:${++enemySerial}`,
      problemId: problem.problemId,
      question: formatQuestion(problem), answer: problem.answer,
      operation: problem.operation, skillId: problem.skillId,
      lane, y: rules.spawnY, wave: boss ? 2 : waveFor(problemCursor), boss, wrongAttempts: 0,
    };
    enemies.push(enemy);
    spawnElapsedMs = 0;
    notify('problemPresented', enemy, {
      enemyId: enemy.enemyId, operation: enemy.operation, skillId: enemy.skillId, boss,
    });
    return true;
  };
  const prepareResult = () => {
    if (result || resolved < problems.length) return;
    phase = 'completed'; explicitTargetId = null; inputToken = null;
    result = Object.freeze({ outcome: 'clear', correct, incorrect, escaped, resolved, life: shield,
      accuracy: correct / problems.length, maxStreak });
  };
  const emitComplete = () => {
    if (completeEmitted || !result) return;
    completeEmitted = true;
    notify('sessionComplete', null, result);
  };
  const removeEnemy = enemy => {
    enemies = enemies.filter(candidate => candidate !== enemy);
    if (explicitTargetId === enemy.enemyId) explicitTargetId = null;
    // A cleared board gets a short breather before the next enemy.
    if (!enemies.length) spawnElapsedMs = 0;
  };
  const escape = enemy => {
    removeEnemy(enemy);
    resolved++; escaped++; streak = 0; shield = Math.max(0, shield - 1);
    solved.push(Object.freeze({ question: enemy.question, answer: enemy.answer, outcome: 'escaped' }));
    lastEscape = Object.freeze({ enemyId: enemy.enemyId, question: enemy.question, answer: enemy.answer, lane: enemy.lane, serial: escaped });
    prepareResult();
    notify('incorrect', enemy, { enemyId: enemy.enemyId, reason: 'escaped', answer: enemy.answer, life: shield, resolved });
    if (result) emitComplete();
  };

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying) return false;
      phase = 'playing'; renewInput(); spawnOne(); return true;
    },
    update(dtMs) {
      if (!active || externalPaused || !Number.isFinite(dtMs)) return;
      const dt = Math.max(0, dtMs);
      projectiles = projectiles
        .map(projectile => ({ ...projectile, remainingMs: projectile.remainingMs - dt }))
        .filter(projectile => projectile.remainingMs > 0);
      if (phase !== 'playing') return;
      activeElapsedMs += dt;
      const step = Math.min(dt, rules.maxSimulationStepMs);
      const aimed = target();
      for (const enemy of enemies) {
        const speed = enemy.boss ? rules.bossSpeedPerMs : rules.waveSpeedsPerMs[enemy.wave];
        enemy.y = Math.min(rules.barrierY, enemy.y + step * speed * paceFactor * (enemy === aimed ? rules.targetSpeedFactor : 1));
      }
      for (const enemy of enemies.filter(candidate => candidate.y >= rules.barrierY)) {
        if (phase !== 'playing') break;
        escape(enemy);
      }
      if (phase !== 'playing') return;
      // Cap the accumulator at one ready spawn: a long/resume frame never bursts.
      const interval = enemies.length ? rules.spawnIntervalMs / paceFactor : rules.emptySpawnMs;
      spawnElapsedMs = Math.min(interval, spawnElapsedMs + dt);
      if (spawnElapsedMs >= interval) spawnOne();
    },
    setPaused(value) { if (active) externalPaused = !!value; },
    // Optional: tapping an enemy aims at it. Falling never stops.
    select({ sessionId: sourceSession, enemyId, problemId } = {}) {
      if (!active || externalPaused || notifying || phase !== 'playing' || sourceSession !== sessionId) return false;
      const enemy = enemies.find(candidate => candidate.enemyId === enemyId && candidate.problemId === problemId);
      if (!enemy || explicitTargetId === enemyId) return false;
      explicitTargetId = enemyId;
      return true;
    },
    submit({ sessionId: sourceSession, token, value } = {}) {
      if (!active || externalPaused || notifying || phase !== 'playing' || sourceSession !== sessionId ||
          !inputToken || token !== inputToken || !enemies.length) return false;
      const normalized = normalizeMathAnswer(value);
      if (normalized === null) return false;
      renewInput(); // Consume before counters and before observer notification.
      const aimed = target();
      const matches = enemies.filter(enemy => enemy.answer === normalized).sort((a, b) => b.y - a.y);
      const hit = matches.includes(aimed) ? aimed : matches[0];
      if (hit) {
        removeEnemy(hit);
        correct++; resolved++; streak++; maxStreak = Math.max(maxStreak, streak);
        solved.push(Object.freeze({ question: hit.question, answer: hit.answer, outcome: 'correct' }));
        lastAttempt = Object.freeze({ enemyId: hit.enemyId, problemId: hit.problemId, value: normalized, question: hit.question,
          correct: true, lane: hit.lane, y: hit.y, boss: hit.boss, serial: inputSerial });
        prepareResult();
        notify('correct', hit, { enemyId: hit.enemyId, value: normalized, answer: hit.answer, resolved,
          boss: hit.boss, wrongAttempts: hit.wrongAttempts, targeted: hit === aimed });
        // Display-only projectile is created after the learning event.
        projectiles.push({ projectileId: `${sessionId}:projectile:${++projectileSerial}`, enemyId: hit.enemyId,
          lane: hit.lane, targetY: hit.y, boss: hit.boss, remainingMs: 260, durationMs: 260 });
        if (result) emitComplete();
      } else {
        incorrect++; streak = 0; aimed.wrongAttempts++;
        lastAttempt = Object.freeze({ enemyId: aimed.enemyId, problemId: aimed.problemId, value: normalized,
          question: aimed.question, correct: false, lane: aimed.lane, y: aimed.y, serial: inputSerial });
        notify('incorrect', aimed, { enemyId: aimed.enemyId, value: normalized, answer: aimed.answer, reason: 'wrong', resolved });
      }
      return true;
    },
    // Contract-v1 adapter only. Existing command methods retain all Core logic.
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      if (command.type === 'submit') return this.submit(command.payload);
      if (command.type === 'select') return this.select(command.payload);
      return false;
    },
    snapshot,
    exit() {
      if (!active) return;
      active = false; aborted = phase !== 'completed'; explicitTargetId = null; inputToken = null;
      enemies = []; projectiles = []; observer = null;
    },
  };
}
