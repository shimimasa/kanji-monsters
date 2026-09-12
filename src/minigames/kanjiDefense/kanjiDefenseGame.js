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
  act1SpeedPerMs: 0.000005,
  act2SpeedPerMs: 0.000006,
  act3SpeedPerMs: 0.000007,
  selectedSpeedFactor: 0.35,
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
    'maxSimulationStepMs', 'maxAttempts'];
  for (const key of positive) if (!Number.isFinite(rules[key]) || rules[key] <= 0) throw new TypeError(`invalid rule: ${key}`);
  if (rules.totalEncounters !== 12 || rules.maxMonsters !== 3 || rules.startingLife !== 3 ||
      rules.maxAttempts !== 2 || rules.spawnProgress < 0 || rules.gateProgress <= rules.spawnProgress ||
      rules.selectedSpeedFactor < 0 || rules.selectedSpeedFactor > 1) throw new TypeError('invalid MVP rules');
}

export function createKanjiDefenseGame({ sessionId, random = Math.random, onEvent = () => {},
  content, monsters, rules: ruleOverrides = {} } = {}) {
  if (typeof sessionId !== 'string' || !sessionId) throw new TypeError('sessionId is required');
  const rules = Object.freeze({ ...KANJI_DEFENSE_RULES, ...ruleOverrides });
  validateRules(rules);
  const encounters = buildKanjiDefenseSession({ random, content, monsters, count: rules.totalEncounters });
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', seq = 0, activeElapsedMs = 0, spawnElapsedMs = 0;
  let encounterCursor = 0, monsterSerial = 0, attemptSerial = 0, projectileSerial = 0;
  let enemies = [], projectiles = [], selectedEnemyId = null;
  let life = rules.startingLife, correct = 0, incorrect = 0, resolved = 0, wrongAttempts = 0;
  let combo = 0, maxCombo = 0, score = 0, result = null, aborted = false, completeEmitted = false;
  let lastAttempt = null, lastResolution = null, practice = [];

  const selectedEnemy = () => enemies.find(enemy => enemy.enemyId === selectedEnemyId) ?? null;
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
    attemptId: enemy.attemptId,
    token: enemy.token,
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
    const target = enemySnapshots.find(enemy => enemy.enemyId === selectedEnemyId) ?? null;
    const currentAct = encounterCursor === 0 ? 1 : actFor(Math.min(encounterCursor, rules.totalEncounters));
    return Object.freeze({
      gameId: 'kanjiDefense', mode: 'grade4GoldenMvp', sessionId, phase, paused, active, aborted,
      seq, activeElapsedMs, act: currentAct, waveLabel: `第${currentAct}波`,
      life, correct, incorrect, resolved, wrongAttempts, combo, maxCombo, score,
      spawned: encounterCursor, remaining: rules.totalEncounters - encounterCursor,
      selectedEnemyId, selectedEnemy: target,
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
  const issueAttempt = enemy => {
    const attemptId = `${sessionId}:${enemy.enemyId}:attempt:${++attemptSerial}`;
    enemy.attemptId = attemptId;
    enemy.token = `${attemptId}:token`;
  };
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
      attemptId: null,
      token: null,
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
  const finishIfReady = outcome => {
    if (result) return;
    if (life > 0 && resolved < rules.totalEncounters) return;
    phase = 'completed';
    selectedEnemyId = null;
    result = makeResult(outcome);
  };
  const commitTerminal = (enemy, { success, reason }) => {
    enemy.attemptId = null;
    enemy.token = null;
    if (selectedEnemyId === enemy.enemyId) selectedEnemyId = null;
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
    lastResolution = Object.freeze({ ...record, monsterName: enemy.monster.name, lane: enemy.lane });
    if (success) {
      projectiles.push({
        projectileId: `${sessionId}:projectile:${++projectileSerial}`,
        lane: enemy.lane,
        targetProgress: enemy.progress,
        remainingMs: 360,
        durationMs: 360,
      });
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
    const events = [commitTerminal(enemy, resolution)];
    if (life === 0) {
      for (const remaining of [...enemies]) events.push(commitTerminal(remaining, { success: false, reason: 'routeBroken' }));
      finishIfReady('routeBroken');
    } else if (resolved === rules.totalEncounters) {
      finishIfReady('defended');
    }
    for (const event of events) notify(event.type, event.problemId, event.payload);
    if (result) emitComplete();
    return true;
  };
  const maybeSpawn = () => {
    const encounter = nextEncounter();
    if (!encounter || phase !== 'playing') return false;
    const needed = enemies.length === 0 ? rules.emptySpawnDelayMs : spawnDelayFor(encounter.encounterNumber, rules);
    return spawnElapsedMs >= needed ? spawnOne() : false;
  };

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying) return false;
      phase = 'playing';
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
        const factor = selectedEnemyId ? rules.selectedSpeedFactor : 1;
        for (const enemy of enemies) enemy.progress = Math.min(rules.gateProgress, enemy.progress + step * speedFor(enemy.act, rules) * factor);
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
    select({ sessionId: sourceSession, enemyId, problemId } = {}) {
      if (!active || paused || notifying || phase !== 'playing' || sourceSession !== sessionId) return false;
      const enemy = enemies.find(candidate => candidate.enemyId === enemyId && candidate.problemId === problemId);
      if (!enemy) return false;
      if (selectedEnemyId === enemyId && enemy.attemptId && enemy.token) return false;
      const previous = selectedEnemy();
      if (previous) {
        previous.attemptId = null;
        previous.token = null;
      }
      selectedEnemyId = enemyId;
      issueAttempt(enemy);
      return true;
    },
    submit({ sessionId: sourceSession, enemyId, problemId, attemptId, token, value } = {}) {
      if (!active || paused || notifying || phase !== 'playing' || sourceSession !== sessionId || selectedEnemyId !== enemyId) return false;
      const enemy = selectedEnemy();
      if (!enemy || enemy.problemId !== problemId || enemy.attemptId !== attemptId || enemy.token !== token) return false;
      const reading = normalizeKanjiDefenseReading(value);
      if (!reading) return false;

      const committedAttempt = enemy.attemptId;
      enemy.attemptId = null;
      enemy.token = null;
      const isCorrect = enemy.content.acceptedReadings.includes(reading);
      if (isCorrect) {
        lastAttempt = Object.freeze({ enemyId, problemId, attemptId: committedAttempt, value: reading, correct: true });
        return resolveTerminal(enemy, { success: true, reason: 'defeated' });
      }

      enemy.wrongAttempts++;
      wrongAttempts++;
      combo = 0;
      lastAttempt = Object.freeze({
        enemyId,
        problemId,
        attemptId: committedAttempt,
        value: reading,
        correct: false,
        retryAvailable: enemy.wrongAttempts < rules.maxAttempts,
        hint: enemy.wrongAttempts < rules.maxAttempts
          ? `${enemy.content.acceptedReadings[0][0]}…（${[...enemy.content.acceptedReadings[0]].length}文字）`
          : null,
      });
      if (enemy.wrongAttempts < rules.maxAttempts) {
        issueAttempt(enemy);
        return true;
      }
      return resolveTerminal(enemy, { success: false, reason: 'attemptsExhausted' });
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
      selectedEnemyId = null;
      for (const enemy of enemies) {
        enemy.attemptId = null;
        enemy.token = null;
      }
      enemies = [];
      projectiles = [];
      observer = null;
    },
  };
}
