import { generateSessionProblems } from '../mathSprint/mathSprintGenerator.js';
import { normalizeMathAnswer } from '../mathSprint/mathSprintGame.js';

export const MATH_INVADER_RULES = Object.freeze({
  totalProblems: 10,
  maxEnemies: 3,
  startingLife: 3,
  spawnIntervalMs: 900,
  descentPerMs: 0.000035,
});

const formatQuestion = problem => `${problem.a} ${problem.operation === 'addition' ? '+' : '−'} ${problem.b}`;

// Nonpersistent Core. Enemy state is authoritative; the DOM only presents snapshots.
export function createMathInvaderGame({ sessionId, random = Math.random, onEvent = () => {} }) {
  const problems = generateSessionProblems({ sessionId, random });
  let active = true, externalPaused = false, notifying = false, observer = onEvent;
  let phase = 'ready', seq = 0, activeElapsedMs = 0, spawnElapsedMs = 0;
  let problemCursor = 0, enemySerial = 0, attemptSerial = 0, projectileSerial = 0;
  let enemies = [], projectiles = [], selectedEnemyId = null;
  let life = MATH_INVADER_RULES.startingLife, correct = 0, incorrect = 0, resolved = 0;
  let streak = 0, maxStreak = 0, result = null, lastAttempt = null, aborted = false;
  let completeEmitted = false;

  const selectedEnemy = () => enemies.find(enemy => enemy.enemyId === selectedEnemyId) ?? null;
  const simulationPaused = () => externalPaused || !!selectedEnemyId;
  const snapshot = () => Object.freeze({
    gameId: 'mathInvader', mode: 'minimalProbe', sessionId, phase,
    paused: externalPaused, simulationPaused: simulationPaused(), answerPaused: !!selectedEnemyId,
    active, aborted, activeElapsedMs, seq, life, correct, incorrect, resolved,
    spawned: problemCursor, remaining: problems.length - problemCursor,
    selectedEnemyId, selectedEnemy: selectedEnemy() ? Object.freeze({ ...selectedEnemy() }) : null,
    enemies: Object.freeze(enemies.map(enemy => Object.freeze({ ...enemy }))),
    projectiles: Object.freeze(projectiles.map(projectile => Object.freeze({ ...projectile }))),
    result, lastAttempt,
  });
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
  const issueAttempt = enemy => {
    const attemptId = `${sessionId}:${enemy.enemyId}:attempt:${++attemptSerial}`;
    enemy.attemptId = attemptId;
    enemy.token = `${attemptId}:token`;
  };
  const spawnOne = () => {
    if (!active || phase !== 'playing' || problemCursor >= problems.length ||
        enemies.length >= MATH_INVADER_RULES.maxEnemies) return false;
    const problem = problems[problemCursor++];
    const occupied = new Set(enemies.map(enemy => enemy.lane));
    const lane = [0, 1, 2].find(value => !occupied.has(value)) ?? (enemySerial % 3);
    const enemy = {
      enemyId: `${sessionId}:enemy:${++enemySerial}`,
      problemId: problem.problemId,
      question: formatQuestion(problem), answer: problem.answer,
      operation: problem.operation, skillId: problem.skillId,
      lane, y: 0.08, state: 'active', attemptId: null, token: null,
    };
    enemies.push(enemy);
    notify('problemPresented', enemy, {
      enemyId: enemy.enemyId, operation: enemy.operation, skillId: enemy.skillId,
    });
    return true;
  };
  const prepareResult = outcome => {
    if (result) return;
    phase = 'completed'; selectedEnemyId = null;
    for (const enemy of enemies) { enemy.attemptId = null; enemy.token = null; }
    result = Object.freeze({ outcome, correct, incorrect, resolved, life,
      accuracy: correct + incorrect ? correct / (correct + incorrect) : 0, maxStreak });
  };
  const emitComplete = () => {
    if (completeEmitted || !result) return;
    completeEmitted = true;
    notify('sessionComplete', null, result);
  };

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying) return false;
      phase = 'playing'; spawnElapsedMs = 0; spawnOne(); return true;
    },
    update(dtMs) {
      if (!active || externalPaused || !Number.isFinite(dtMs)) return;
      const dt = Math.max(0, dtMs);
      const boundedSimulationDt = Math.min(dt, 100);
      projectiles = projectiles
        .map(projectile => ({ ...projectile, remainingMs: projectile.remainingMs - dt }))
        .filter(projectile => projectile.remainingMs > 0);
      if (phase !== 'playing') return;
      activeElapsedMs += dt;
      if (selectedEnemyId) return;
      for (const enemy of enemies) {
        enemy.y = Math.min(0.78, enemy.y + boundedSimulationDt * MATH_INVADER_RULES.descentPerMs);
      }
      // Cap the accumulator at one ready spawn. A long/resume frame may create
      // at most one enemy and never replays elapsed intervals as a burst.
      spawnElapsedMs = Math.min(MATH_INVADER_RULES.spawnIntervalMs,
        spawnElapsedMs + dt);
      if (spawnElapsedMs >= MATH_INVADER_RULES.spawnIntervalMs && spawnOne()) spawnElapsedMs = 0;
    },
    setPaused(value) { if (active) externalPaused = !!value; },
    select({ sessionId: sourceSession, enemyId, problemId }) {
      if (!active || externalPaused || notifying || phase !== 'playing' || sourceSession !== sessionId) return false;
      const enemy = enemies.find(candidate => candidate.enemyId === enemyId &&
        candidate.problemId === problemId && candidate.state === 'active');
      if (!enemy) return false;
      if (selectedEnemyId !== enemyId) {
        const previous = selectedEnemy();
        if (previous) { previous.attemptId = null; previous.token = null; }
        selectedEnemyId = enemyId;
        issueAttempt(enemy);
      } else if (!enemy.token) issueAttempt(enemy);
      return true;
    },
    submit({ sessionId: sourceSession, enemyId, problemId, attemptId, token, value }) {
      if (!active || externalPaused || notifying || phase !== 'playing' || sourceSession !== sessionId ||
          selectedEnemyId !== enemyId) return false;
      const enemy = selectedEnemy();
      if (!enemy || enemy.state !== 'active' || enemy.problemId !== problemId ||
          enemy.attemptId !== attemptId || enemy.token !== token) return false;
      const normalized = normalizeMathAnswer(value);
      if (normalized === null) return false;

      // Consume identity before counters and before observer notification.
      enemy.attemptId = null; enemy.token = null;
      const isCorrect = normalized === enemy.answer;
      const committedAttempt = attemptId;
      if (isCorrect) {
        correct++; resolved++; streak++; maxStreak = Math.max(maxStreak, streak);
        enemy.state = 'resolved'; selectedEnemyId = null;
        enemies = enemies.filter(candidate => candidate !== enemy);
        lastAttempt = Object.freeze({ enemyId, problemId, attemptId: committedAttempt,
          value: normalized, answer: enemy.answer, correct: true });
        if (resolved === MATH_INVADER_RULES.totalProblems) prepareResult('clear');
        notify('correct', enemy, { enemyId, attemptId: committedAttempt,
          value: normalized, answer: enemy.answer, life, resolved });
        // Display-only projectile is created after the learning event.
        projectiles.push({ projectileId: `${sessionId}:projectile:${++projectileSerial}`,
          enemyId, problemId, lane: enemy.lane, targetY: enemy.y, remainingMs: 360, durationMs: 360 });
        if (result) emitComplete();
      } else {
        incorrect++; life = Math.max(0, life - 1); streak = 0;
        lastAttempt = Object.freeze({ enemyId, problemId, attemptId: committedAttempt,
          value: normalized, answer: enemy.answer, correct: false });
        if (life === 0) prepareResult('gameOver');
        else issueAttempt(enemy);
        notify('incorrect', enemy, { enemyId, attemptId: committedAttempt,
          value: normalized, answer: enemy.answer, life, resolved });
        if (result) emitComplete();
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
      active = false; aborted = phase !== 'completed'; selectedEnemyId = null;
      for (const enemy of enemies) { enemy.attemptId = null; enemy.token = null; }
      enemies = []; projectiles = []; observer = null;
    },
  };
}
