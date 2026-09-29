import { buildKanjiDefenseSession, normalizeKanjiDefenseReading } from './kanjiDefenseContent.js';

export const KANJI_DEFENSE_RULES = Object.freeze({
  totalEncounters: 12,
  maxMonsters: 3,
  startingLife: 3,
  gateProgress: 0.88,
  spawnProgress: 0.08,
  emptySpawnDelayMs: 800,
  act1SpawnMs: 3200,
  act2SpawnMs: 4700,
  act3SpawnMs: 3700,
  act1SpeedPerMs: 0.000027,
  act2SpeedPerMs: 0.000031,
  act3SpeedPerMs: 0.000036,
  targetSpeedFactor: 0.6,
  slowPaceFactor: 0.6,
  maxSimulationStepMs: 250,
  maxAttempts: 2,
});

const actFor = encounterNumber => encounterNumber <= 4 ? 1 : encounterNumber <= 9 ? 2 : 3;
const capacityFor = encounterNumber => actFor(encounterNumber);
const spawnDelayFor = (encounterNumber, rules) => {
  const act = actFor(encounterNumber);
  return act === 1 ? rules.act1SpawnMs : act === 2 ? rules.act2SpawnMs : rules.act3SpawnMs;
};
const speedFor = (act, rules) => act === 1 ? rules.act1SpeedPerMs : act === 2 ? rules.act2SpeedPerMs : rules.act3SpeedPerMs;
const freezeArray = values => Object.freeze(values.map(value => Object.freeze({ ...value })));

function validateRules(rules) {
  const positive = ['totalEncounters', 'maxMonsters', 'startingLife', 'gateProgress', 'emptySpawnDelayMs',
    'act1SpawnMs', 'act2SpawnMs', 'act3SpawnMs', 'act1SpeedPerMs', 'act2SpeedPerMs', 'act3SpeedPerMs',
    'slowPaceFactor', 'maxSimulationStepMs', 'maxAttempts'];
  for (const key of positive) if (!Number.isFinite(rules[key]) || rules[key] <= 0) throw new TypeError(`invalid rule: ${key}`);
  if (rules.totalEncounters !== 12 || rules.maxMonsters !== 3 || rules.startingLife !== 3 ||
      rules.maxAttempts !== 2 || rules.spawnProgress < 0 || rules.gateProgress <= rules.spawnProgress ||
      rules.targetSpeedFactor <= 0 || rules.targetSpeedFactor > 1 || rules.slowPaceFactor > 1) throw new TypeError('invalid MVP rules');
}

// Monsters keep walking while play runs. A typed reading hits the Monster it
// reads; a Monster reaching the gate reveals its reading and dims one guard
// light. The route never breaks: all twelve encounters are always played.
export function createKanjiDefenseGame({ sessionId, random = Math.random, onEvent = () => {},
  content, monsters, pace = 'normal', rules: ruleOverrides = {} } = {}) {
  if (typeof sessionId !== 'string' || !sessionId) throw new TypeError('sessionId is required');
  const rules = Object.freeze({ ...KANJI_DEFENSE_RULES, ...ruleOverrides });
  validateRules(rules);
  const paceFactor = pace === 'slow' ? rules.slowPaceFactor : 1;
  const encounters = buildKanjiDefenseSession({ random, content, monsters, count: rules.totalEncounters });
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', seq = 0, activeElapsedMs = 0, spawnElapsedMs = 0;
  let encounterCursor = 0, monsterSerial = 0, inputSerial = 0, projectileSerial = 0;
  let enemies = [], projectiles = [], explicitTargetId = null, inputToken = null;
  let life = rules.startingLife, correct = 0, incorrect = 0, resolved = 0, wrongAttempts = 0;
  let combo = 0, maxCombo = 0, score = 0, result = null, aborted = false, completeEmitted = false;
  let lastAttempt = null, lastResolution = null, practice = [];

  const frontmost = () => enemies.reduce((best, enemy) => !best || enemy.progress > best.progress ? enemy : best, null);
  const target = () => enemies.find(enemy => enemy.enemyId === explicitTargetId) ?? frontmost();
  const nextEncounter = () => encounters[encounterCursor] ?? null;
  const threatLabel = progress => progress >= 0.7 ? '危険' : progress >= 0.48 ? '近い' : '接近中';
  const publicEnemy = enemy => Object.freeze({
    enemyId: enemy.enemyId,
    problemId: enemy.problemId,
    fixtureId: enemy.content.fixtureId,
    encounterNumber: enemy.encounterNumber,
    act: enemy.act,
    lane: enemy.lane,
    progress: enemy.progress,
    threat: threatLabel(enemy.progress),
    prompt: enemy.content.prompt,
    hint: enemy.content.hint,
    monsterId: enemy.monster.monsterId,
    monsterName: enemy.monster.name,
    region: enemy.monster.region,
    imageUrl: enemy.monster.imageUrl,
    wrongAttempts: enemy.wrongAttempts,
  });
  const makeResult = outcome => {
    const strongWords = practice.filter(item => item.outcome === 'correct' && item.wrongAttempts === 0)
      .map(item => item.prompt);
    const weakWords = practice.filter(item => item.outcome !== 'correct' || item.wrongAttempts > 0)
      .map(item => item.prompt);
    return Object.freeze({
      outcome,
      score: score + life * 100,
      correct,
      incorrect,
      wrongAttempts,
      maxCombo,
      life,
      encountersStarted: encounterCursor,
      resolved,
      defeatRate: resolved ? correct / resolved : 0,
      strongWords: Object.freeze(strongWords),
      weakWords: Object.freeze(weakWords),
      wordsPracticed: Object.freeze(practice.map(item => Object.freeze({ ...item }))),
    });
  };
  const snapshot = () => {
    const enemySnapshots = enemies.map(publicEnemy);
    const aimed = target();
    const currentAct = encounterCursor === 0 ? 1 : actFor(Math.min(encounterCursor, rules.totalEncounters));
    return Object.freeze({
      gameId: 'kanjiDefense', mode: 'arcade', sessionId, phase, paused, active, aborted, pace: pace === 'slow' ? 'slow' : 'normal',
      seq, activeElapsedMs, act: currentAct, waveLabel: `第${currentAct}波`,
      life, correct, incorrect, resolved, wrongAttempts, combo, maxCombo, score,
      spawned: encounterCursor, remaining: rules.totalEncounters - encounterCursor,
      inputToken, explicitTargetId, targetId: aimed?.enemyId ?? null,
      targetEnemy: enemySnapshots.find(enemy => enemy.enemyId === aimed?.enemyId) ?? null,
      enemies: Object.freeze(enemySnapshots),
      projectiles: freezeArray(projectiles),
      lastAttempt, lastResolution, result,
      rules,
    });
  };
  const notify = (type, problemId, payload = {}) => {
    const event = Object.freeze({
      version: 1,
      gameId: 'kanjiDefense',
      sessionId,
      seq: ++seq,
      type,
      problemId,
      activeElapsedMs,
      payload: Object.freeze(payload),
    });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation observers cannot roll back committed learning state. */ }
    finally { notifying = false; }
  };
  const renewInput = () => { inputToken = `${sessionId}:input:${++inputSerial}`; };
  const chooseLane = () => {
    const occupied = new Set(enemies.map(enemy => enemy.lane));
    const sample = Number(random());
    const start = Math.floor((Number.isFinite(sample) ? Math.min(Math.max(sample, 0), 0.999999999999) : 0) * 3);
    for (let offset = 0; offset < 3; offset++) {
      const lane = (start + offset) % 3;
      if (!occupied.has(lane)) return lane;
    }
    return null;
  };
  const spawnOne = () => {
    const encounter = nextEncounter();
    if (!active || phase !== 'playing' || !encounter || enemies.length >= rules.maxMonsters ||
        enemies.length >= capacityFor(encounter.encounterNumber)) return false;
    const lane = chooseLane();
    if (lane === null) return false;
    encounterCursor++;
    const problemId = `${sessionId}:problem:${encounter.encounterNumber}:${encounter.content.fixtureId}`;
    const enemy = {
      enemyId: `${sessionId}:monster:${++monsterSerial}`,
      problemId,
      encounterNumber: encounter.encounterNumber,
      act: actFor(encounter.encounterNumber),
      lane,
      progress: rules.spawnProgress,
      content: encounter.content,
      monster: encounter.monster,
      wrongAttempts: 0,
    };
    enemies.push(enemy);
    spawnElapsedMs = 0;
    notify('problemPresented', problemId, {
      encounterNumber: enemy.encounterNumber,
      act: enemy.act,
      lane,
      fixtureId: enemy.content.fixtureId,
      skillId: enemy.content.skillId,
      monsterId: enemy.monster.monsterId,
    });
    return true;
  };
  const commitTerminal = (enemy, { success, reason }) => {
    if (explicitTargetId === enemy.enemyId) explicitTargetId = null;
    enemies = enemies.filter(candidate => candidate !== enemy);
    resolved++;
    if (success) {
      correct++;
      combo++;
      maxCombo = Math.max(maxCombo, combo);
      score += 100 + Math.min(Math.max(combo - 1, 0), 4) * 20 + (enemy.wrongAttempts === 0 ? 25 : 0);
    } else {
      incorrect++;
      combo = 0;
      if (reason === 'escaped') life = Math.max(0, life - 1);
    }
    const reading = enemy.content.acceptedReadings[0];
    const record = Object.freeze({
      problemId: enemy.problemId,
      fixtureId: enemy.content.fixtureId,
      prompt: enemy.content.prompt,
      reading,
      outcome: success ? 'correct' : reason,
      wrongAttempts: enemy.wrongAttempts,
    });
    practice = [...practice, record];
    lastResolution = Object.freeze({ ...record, monsterName: enemy.monster.name, lane: enemy.lane,
      progress: enemy.progress, serial: resolved });
    if (success) {
      projectiles.push({
        projectileId: `${sessionId}:projectile:${++projectileSerial}`,
        lane: enemy.lane,
        targetProgress: enemy.progress,
        remainingMs: 300,
        durationMs: 300,
      });
    }
    if (resolved === rules.totalEncounters) {
      phase = 'completed';
      explicitTargetId = null;
      inputToken = null;
      result = makeResult('defended');
    }
    return {
      type: success ? 'correct' : 'incorrect',
      problemId: enemy.problemId,
      payload: {
        encounterNumber: enemy.encounterNumber,
        fixtureId: enemy.content.fixtureId,
        skillId: enemy.content.skillId,
        monsterId: enemy.monster.monsterId,
        reason,
        wrongAttempts: enemy.wrongAttempts,
        firstTry: success && enemy.wrongAttempts === 0,
        life,
        combo,
        score,
      },
    };
  };
  const emitComplete = () => {
    if (completeEmitted || !result) return;
    completeEmitted = true;
    notify('sessionComplete', null, result);
  };
  const resolveTerminal = (enemy, resolution) => {
    if (!enemies.includes(enemy) || result) return false;
    const event = commitTerminal(enemy, resolution);
    notify(event.type, event.problemId, event.payload);
    if (result) emitComplete();
    return true;
  };
  const maybeSpawn = () => {
    const encounter = nextEncounter();
    if (!encounter || phase !== 'playing') return false;
    const needed = enemies.length === 0 ? rules.emptySpawnDelayMs : spawnDelayFor(encounter.encounterNumber, rules) / paceFactor;
    return spawnElapsedMs >= needed ? spawnOne() : false;
  };

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying) return false;
      phase = 'playing';
      renewInput();
      spawnElapsedMs = rules.emptySpawnDelayMs;
      return spawnOne();
    },
    update(dtMs) {
      if (!active || paused || !Number.isFinite(dtMs)) return;
      const dt = Math.max(0, dtMs);
      projectiles = projectiles.map(projectile => ({ ...projectile, remainingMs: projectile.remainingMs - dt }))
        .filter(projectile => projectile.remainingMs > 0);
      if (phase !== 'playing') return;
      activeElapsedMs += dt;
      spawnElapsedMs += dt;
      if (dt > 0 && enemies.length) {
        const step = Math.min(dt, rules.maxSimulationStepMs);
        const aimed = target();
        for (const enemy of enemies) {
          const factor = (enemy === aimed ? rules.targetSpeedFactor : 1) * paceFactor;
          enemy.progress = Math.min(rules.gateProgress, enemy.progress + step * speedFor(enemy.act, rules) * factor);
        }
        while (active && phase === 'playing') {
          const escaped = enemies.find(enemy => enemy.progress >= rules.gateProgress);
          if (!escaped) break;
          resolveTerminal(escaped, { success: false, reason: 'escaped' });
        }
      }
      maybeSpawn();
    },
    setPaused(value) {
      if (active) paused = !!value;
    },
    // Optional: tapping a Monster aims at it (and slows only that Monster).
    select({ sessionId: sourceSession, enemyId, problemId } = {}) {
      if (!active || paused || notifying || phase !== 'playing' || sourceSession !== sessionId) return false;
      const enemy = enemies.find(candidate => candidate.enemyId === enemyId && candidate.problemId === problemId);
      if (!enemy || explicitTargetId === enemyId) return false;
      explicitTargetId = enemyId;
      return true;
    },
    submit({ sessionId: sourceSession, token, value } = {}) {
      if (!active || paused || notifying || phase !== 'playing' || sourceSession !== sessionId ||
          !inputToken || token !== inputToken || !enemies.length) return false;
      const reading = normalizeKanjiDefenseReading(value);
      if (!reading) return false;
      renewInput(); // Consume before counters and before observer notification.
      const aimed = target();
      const matches = enemies.filter(enemy => enemy.content.acceptedReadings.includes(reading))
        .sort((a, b) => b.progress - a.progress);
      const hit = matches.includes(aimed) ? aimed : matches[0];
      if (hit) {
        lastAttempt = Object.freeze({ enemyId: hit.enemyId, problemId: hit.problemId, value: reading, correct: true, serial: inputSerial });
        return resolveTerminal(hit, { success: true, reason: 'defeated' });
      }

      aimed.wrongAttempts++;
      wrongAttempts++;
      combo = 0;
      const retryAvailable = aimed.wrongAttempts < rules.maxAttempts;
      lastAttempt = Object.freeze({
        enemyId: aimed.enemyId,
        problemId: aimed.problemId,
        prompt: aimed.content.prompt,
        value: reading,
        correct: false,
        serial: inputSerial,
        retryAvailable,
        hint: retryAvailable
          ? `${aimed.content.acceptedReadings[0][0]}…（${[...aimed.content.acceptedReadings[0]].length}文字）`
          : null,
      });
      if (retryAvailable) return true;
      return resolveTerminal(aimed, { success: false, reason: 'attemptsExhausted' });
    },
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      if (command.type === 'select') return this.select(command.payload);
      if (command.type === 'submit') return this.submit(command.payload);
      return false;
    },
    snapshot,
    exit() {
      if (!active) return;
      active = false;
      aborted = phase !== 'completed';
      explicitTargetId = null;
      inputToken = null;
      enemies = [];
      projectiles = [];
      observer = null;
    },
  };
}
