import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createKanjiDefenseGame, KANJI_DEFENSE_RULES } from '../../src/minigames/kanjiDefense/kanjiDefenseGame.js';
import { buildKanjiDefenseSession, KANJI_DEFENSE_GOLDEN_CONTENT, KANJI_DEFENSE_LIMITED_UX_CONTENT,
  KANJI_DEFENSE_LIMITED_UX_CONTENT_VERSION, KANJI_DEFENSE_LIMITED_UX_EXCLUDED_FIXTURE_IDS, KANJI_DEFENSE_MONSTERS,
  normalizeKanjiDefenseReading, validateKanjiDefenseContent } from '../../src/minigames/kanjiDefense/kanjiDefenseContent.js';

const seeded = (seed = 1) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const create = (options = {}) => createKanjiDefenseGame({ sessionId: 'kd-test', random: seeded(42), ...options });
const readingFor = enemy => KANJI_DEFENSE_GOLDEN_CONTENT.find(item => item.fixtureId === enemy.fixtureId).acceptedReadings[0];
const select = (game, enemy = game.snapshot().enemies[0]) => game.dispatch({
  type: 'select', payload: { sessionId: game.snapshot().sessionId, enemyId: enemy.enemyId, problemId: enemy.problemId },
});
const submit = (game, value) => {
  const enemy = game.snapshot().selectedEnemy;
  return game.dispatch({ type: 'submit', payload: { sessionId: game.snapshot().sessionId, enemyId: enemy?.enemyId,
    problemId: enemy?.problemId, attemptId: enemy?.attemptId, token: enemy?.token, value } });
};
const defeatCurrent = game => {
  const enemy = game.snapshot().enemies[0];
  assert.equal(select(game, enemy), true);
  assert.equal(submit(game, readingFor(enemy)), true);
};
const spawnAfterClear = game => game.update(game.snapshot().rules.emptySpawnDelayMs);

test('Grade 4 golden fixture is immutable, unique and eligible', () => {
  assert.equal(KANJI_DEFENSE_GOLDEN_CONTENT.length, 24);
  assert.equal(validateKanjiDefenseContent(), true);
  assert.equal(new Set(KANJI_DEFENSE_GOLDEN_CONTENT.map(item => item.fixtureId)).size, 24);
  for (const item of KANJI_DEFENSE_GOLDEN_CONTENT) {
    assert.ok(Object.isFrozen(item)); assert.ok(Object.isFrozen(item.acceptedReadings)); assert.ok(Object.isFrozen(item.focusKanjiIds));
    assert.ok(item.focusKanjiIds.length >= 1); assert.ok(item.acceptedReadings.length >= 1);
  }
});
test('golden focus IDs exist in current Grade 4 source', () => {
  const source = JSON.parse(fs.readFileSync('public/data/kanji_g4_proto.json', 'utf8'));
  const ids = new Set(source.map(item => item.id));
  for (const item of KANJI_DEFENSE_GOLDEN_CONTENT) for (const id of item.focusKanjiIds) assert.ok(ids.has(id), `${item.prompt}: ${id}`);
});

test('limited UX pool has exactly 21 pre-reviewed items and excludes all three known revisions', () => {
  assert.equal(KANJI_DEFENSE_LIMITED_UX_CONTENT_VERSION, 'kanji-defense-limited-ux-playtest-pre-reviewed-v1');
  assert.equal(KANJI_DEFENSE_LIMITED_UX_CONTENT.length, 21);
  assert.equal(validateKanjiDefenseContent(KANJI_DEFENSE_LIMITED_UX_CONTENT), true);
  assert.deepEqual(KANJI_DEFENSE_LIMITED_UX_EXCLUDED_FIXTURE_IDS,
    ['kd-g4-003', 'kd-g4-004', 'kd-g4-011']);
  assert.deepEqual(KANJI_DEFENSE_LIMITED_UX_CONTENT.filter(item => ['以下', '位置', '結果'].includes(item.prompt)), []);
});

test('all selected regional Monster assets exist and identities are unique', () => {
  assert.equal(KANJI_DEFENSE_MONSTERS.length, 12);
  assert.equal(new Set(KANJI_DEFENSE_MONSTERS.map(item => item.monsterId)).size, 12);
  for (const monster of KANJI_DEFENSE_MONSTERS) {
    assert.ok(Object.isFrozen(monster)); assert.ok(fs.existsSync(`public${monster.imageUrl}`), monster.imageUrl);
  }
});

test('session generation is deterministic, unique and contains 12 encounters', () => {
  const a = buildKanjiDefenseSession({ random: seeded(7) });
  const b = buildKanjiDefenseSession({ random: seeded(7) });
  assert.deepEqual(a, b); assert.equal(a.length, 12);
  assert.equal(new Set(a.map(item => item.content.fixtureId)).size, 12);
  assert.ok(a.every(item => KANJI_DEFENSE_LIMITED_UX_CONTENT.includes(item.content)));
  assert.deepEqual(a.map(item => item.encounterNumber), Array.from({ length: 12 }, (_, index) => index + 1));
});

test('normalization trims, removes spaces, applies NFKC and converts katakana', () => {
  assert.equal(normalizeKanjiDefenseReading('　エイ　ゴ　'), 'えいご');
  assert.equal(normalizeKanjiDefenseReading('キセツ'), 'きせつ');
  assert.equal(normalizeKanjiDefenseReading(''), null); assert.equal(normalizeKanjiDefenseReading(7), null);
});

test('enter starts Act 1 with one Monster in one of three lanes', () => {
  const game = create(); assert.equal(game.snapshot().phase, 'ready'); assert.equal(game.enter(), true);
  const state = game.snapshot(); assert.equal(state.phase, 'playing'); assert.equal(state.enemies.length, 1);
  assert.ok([0, 1, 2].includes(state.enemies[0].lane)); assert.equal(state.enemies[0].act, 1);
});

test('update moves only active Monsters and activeElapsedMs', () => {
  const game = create(); game.enter(); const before = game.snapshot().enemies[0].progress;
  game.update(100); const after = game.snapshot(); assert.ok(after.enemies[0].progress > before); assert.equal(after.activeElapsedMs, 100);
});

test('negative and non-finite delta do not move simulation', () => {
  const game = create(); game.enter(); const before = game.snapshot();
  game.update(-100); game.update(Number.NaN); game.update(Infinity);
  assert.equal(game.snapshot().enemies[0].progress, before.enemies[0].progress); assert.equal(game.snapshot().activeElapsedMs, 0);
});

test('huge delta is bounded for movement but counted as active session elapsed', () => {
  const game = create(); game.enter(); const before = game.snapshot().enemies[0].progress;
  game.update(10000); const state = game.snapshot();
  assert.equal(state.activeElapsedMs, 10000);
  assert.ok(state.enemies[0].progress - before <= KANJI_DEFENSE_RULES.maxSimulationStepMs * KANJI_DEFENSE_RULES.act1SpeedPerMs + 1e-12);
  assert.ok(state.enemies.length <= 1);
});

test('pause freezes movement, spawn and active elapsed then resumes in place', () => {
  const game = create(); game.enter(); game.update(100); const before = game.snapshot(); game.setPaused(true); game.update(10000);
  const paused = game.snapshot(); assert.equal(paused.paused, true); assert.equal(paused.activeElapsedMs, before.activeElapsedMs);
  assert.equal(paused.enemies[0].progress, before.enemies[0].progress); assert.equal(paused.spawned, before.spawned);
  game.setPaused(false); game.update(100); assert.ok(game.snapshot().enemies[0].progress > paused.enemies[0].progress);
});

test('select issues an attempt and selecting the same target is not accepted twice', () => {
  const game = create(); game.enter(); assert.equal(select(game), true);
  const selected = game.snapshot().selectedEnemy; assert.ok(selected.attemptId); assert.ok(selected.token);
  assert.equal(select(game, selected), false);
});

test('switching simultaneous targets invalidates the old attempt', () => {
  const game = create(); game.enter();
  for (let index = 0; index < 4; index++) { defeatCurrent(game); if (index < 3) spawnAfterClear(game); }
  spawnAfterClear(game); game.update(game.snapshot().rules.act2SpawnMs);
  const [first, second] = game.snapshot().enemies; assert.ok(second);
  assert.equal(select(game, first), true); const old = game.snapshot().selectedEnemy;
  assert.equal(select(game, second), true);
  assert.equal(game.dispatch({ type: 'submit', payload: { sessionId: 'kd-test', enemyId: old.enemyId,
    problemId: old.problemId, attemptId: old.attemptId, token: old.token, value: readingFor(first) } }), false);
});

test('a correct accepted reading defeats exactly one Monster', () => {
  const events = [], game = create({ onEvent: event => events.push(event) }); game.enter(); const enemy = game.snapshot().enemies[0];
  assert.equal(select(game, enemy), true); assert.equal(submit(game, readingFor(enemy)), true);
  const state = game.snapshot(); assert.equal(state.correct, 1); assert.equal(state.resolved, 1); assert.equal(state.enemies.length, 0);
  assert.equal(events.filter(event => event.type === 'correct').length, 1);
});

test('katakana answer is accepted through game-local normalization', () => {
  const game = create(); game.enter(); const enemy = game.snapshot().enemies[0]; select(game, enemy);
  const katakana = readingFor(enemy).replace(/[ぁ-ゖ]/g, value => String.fromCodePoint(value.codePointAt(0) + 0x60));
  assert.equal(submit(game, katakana), true); assert.equal(game.snapshot().correct, 1);
});

test('first wrong reading is a retry, emits no completion and does not cost life', () => {
  const events = [], game = create({ onEvent: event => events.push(event) }); game.enter(); select(game);
  const old = game.snapshot().selectedEnemy; assert.equal(submit(game, 'まちがい'), true); const state = game.snapshot();
  assert.equal(state.resolved, 0); assert.equal(state.incorrect, 0); assert.equal(state.wrongAttempts, 1); assert.equal(state.life, 3);
  assert.equal(state.combo, 0); assert.equal(events.filter(event => ['correct', 'incorrect'].includes(event.type)).length, 0);
  assert.notEqual(state.selectedEnemy.attemptId, old.attemptId); assert.match(state.lastAttempt.hint, /^.[…]/u);
});

test('old attempt is rejected after first wrong answer', () => {
  const game = create(); game.enter(); select(game); const old = game.snapshot().selectedEnemy; submit(game, 'まちがい');
  assert.equal(game.dispatch({ type: 'submit', payload: { sessionId: 'kd-test', enemyId: old.enemyId,
    problemId: old.problemId, attemptId: old.attemptId, token: old.token, value: readingFor(old) } }), false);
});

test('correct retry completes once and records a weak word', () => {
  const events = [], game = create({ onEvent: event => events.push(event) }); game.enter(); const enemy = game.snapshot().enemies[0]; select(game, enemy);
  submit(game, 'まちがい'); assert.equal(submit(game, readingFor(enemy)), true); const state = game.snapshot();
  assert.equal(state.correct, 1); assert.equal(state.resolved, 1); assert.equal(state.maxCombo, 1);
  assert.equal(events.filter(event => event.type === 'correct').length, 1);
});

test('second wrong answer terminally emits one incorrect without life loss', () => {
  const events = [], game = create({ onEvent: event => events.push(event) }); game.enter(); select(game); submit(game, 'まちがい');
  assert.equal(submit(game, 'まだちがう'), true); const state = game.snapshot();
  assert.equal(state.incorrect, 1); assert.equal(state.resolved, 1); assert.equal(state.life, 3); assert.equal(state.enemies.length, 0);
  const outcomes = events.filter(event => event.type === 'incorrect'); assert.equal(outcomes.length, 1); assert.equal(outcomes[0].payload.reason, 'attemptsExhausted');
});

test('double submit is rejected after terminal completion', () => {
  const game = create(); game.enter(); const enemy = game.snapshot().enemies[0]; select(game, enemy); const attempt = game.snapshot().selectedEnemy;
  const command = { type: 'submit', payload: { sessionId: 'kd-test', enemyId: attempt.enemyId, problemId: attempt.problemId,
    attemptId: attempt.attemptId, token: attempt.token, value: readingFor(enemy) } };
  assert.equal(game.dispatch(command), true); assert.equal(game.dispatch(command), false); assert.equal(game.snapshot().resolved, 1);
});

test('escape is terminal incorrect and costs one life', () => {
  const events = [], game = create({ onEvent: event => events.push(event), rules: { act1SpeedPerMs: 1 } }); game.enter(); game.update(250);
  const state = game.snapshot(); assert.equal(state.life, 2); assert.equal(state.incorrect, 1); assert.equal(state.resolved, 1);
  assert.equal(events.find(event => event.type === 'incorrect').payload.reason, 'escaped');
});

test('three escapes end the route and emit sessionComplete once', () => {
  const events = [], game = create({ onEvent: event => events.push(event), rules: { act1SpeedPerMs: 1 } }); game.enter();
  for (let index = 0; index < 3; index++) { game.update(250); if (!game.snapshot().result) spawnAfterClear(game); }
  assert.equal(game.snapshot().result.outcome, 'routeBroken'); assert.equal(game.snapshot().life, 0);
  assert.equal(events.filter(event => event.type === 'sessionComplete').length, 1);
});

test('Act 2 permits two simultaneous Monsters and never more', () => {
  const game = create(); game.enter();
  for (let index = 0; index < 4; index++) { defeatCurrent(game); if (index < 3) spawnAfterClear(game); }
  spawnAfterClear(game); assert.equal(game.snapshot().act, 2); game.update(game.snapshot().rules.act2SpawnMs);
  assert.equal(game.snapshot().enemies.length, 2); game.update(99999); assert.ok(game.snapshot().enemies.length <= 2);
});

test('Act 3 permits three simultaneous Monsters and never more', () => {
  const game = create(); game.enter();
  for (let index = 0; index < 9; index++) { defeatCurrent(game); if (index < 8) spawnAfterClear(game); }
  spawnAfterClear(game); assert.equal(game.snapshot().act, 3);
  game.update(game.snapshot().rules.act3SpawnMs); game.update(game.snapshot().rules.act3SpawnMs);
  assert.equal(game.snapshot().enemies.length, 3); game.update(99999); assert.ok(game.snapshot().enemies.length <= 3);
});

test('score rewards correctness, first try and combo but not elapsed milliseconds', () => {
  const game = create(); game.enter(); defeatCurrent(game); const first = game.snapshot().score; spawnAfterClear(game); game.update(20000);
  const before = game.snapshot().score; assert.equal(before, first); defeatCurrent(game); assert.ok(game.snapshot().score > first + 100);
});

test('wrong attempt resets an existing combo', () => {
  const game = create(); game.enter(); defeatCurrent(game); spawnAfterClear(game); assert.equal(game.snapshot().combo, 1);
  select(game); submit(game, 'まちがい'); assert.equal(game.snapshot().combo, 0);
});

test('stale session, problem, enemy, attempt and token are rejected', () => {
  const game = create(); game.enter(); const enemy = game.snapshot().enemies[0];
  assert.equal(game.dispatch({ type: 'select', payload: { sessionId: 'old', enemyId: enemy.enemyId, problemId: enemy.problemId } }), false);
  assert.equal(game.dispatch({ type: 'select', payload: { sessionId: 'kd-test', enemyId: enemy.enemyId, problemId: 'old' } }), false);
  select(game, enemy); const current = game.snapshot().selectedEnemy;
  for (const payload of [
    { ...current, sessionId: 'old', value: readingFor(enemy) },
    { ...current, problemId: 'old', value: readingFor(enemy) },
    { ...current, enemyId: 'old', value: readingFor(enemy) },
    { ...current, attemptId: 'old', value: readingFor(enemy) },
    { ...current, token: 'old', value: readingFor(enemy) },
  ]) assert.equal(game.dispatch({ type: 'submit', payload }), false);
});

test('paused Core rejects select and submit', () => {
  const game = create(); game.enter(); const enemy = game.snapshot().enemies[0]; game.setPaused(true);
  assert.equal(select(game, enemy), false); game.setPaused(false); select(game, enemy); game.setPaused(true);
  assert.equal(submit(game, readingFor(enemy)), false);
});

test('twelve correct encounters complete the three-act session', () => {
  const game = create(); game.enter();
  for (let index = 0; index < 12; index++) { defeatCurrent(game); if (index < 11) spawnAfterClear(game); }
  const state = game.snapshot(); assert.equal(state.phase, 'completed'); assert.equal(state.result.outcome, 'defended');
  assert.equal(state.result.correct, 12); assert.equal(state.result.incorrect, 0); assert.equal(state.result.resolved, 12);
  assert.equal(state.result.strongWords.length, 12); assert.equal(state.result.weakWords.length, 0);
});

test('event sequence has one presentation and one terminal completion per encounter', () => {
  const events = [], game = create({ onEvent: event => events.push(event) }); game.enter();
  for (let index = 0; index < 12; index++) { defeatCurrent(game); if (index < 11) spawnAfterClear(game); }
  assert.equal(events.filter(event => event.type === 'problemPresented').length, 12);
  assert.equal(events.filter(event => ['correct', 'incorrect'].includes(event.type)).length, 12);
  assert.equal(events.filter(event => event.type === 'sessionComplete').length, 1);
  assert.deepEqual(events.map(event => event.seq), Array.from({ length: 25 }, (_, index) => index + 1));
});

test('terminal state is committed before observer notification', () => {
  let game; game = create({ onEvent: event => {
    if (event.type === 'correct') { assert.equal(game.snapshot().resolved, 1); assert.equal(game.snapshot().enemies.length, 0); }
  } }); game.enter(); defeatCurrent(game);
});

test('observer throw cannot roll back a defeat', () => {
  const game = create({ onEvent: event => { if (event.type === 'correct') throw Error('observer'); } }); game.enter(); defeatCurrent(game);
  assert.equal(game.snapshot().resolved, 1); assert.equal(game.snapshot().correct, 1);
});

test('rejected observer Promise is isolated', async () => {
  const game = create({ onEvent: event => event.type === 'correct' ? Promise.reject(Error('observer')) : undefined }); game.enter(); defeatCurrent(game);
  await new Promise(resolve => setImmediate(resolve)); assert.equal(game.snapshot().correct, 1);
});

test('reentrant observer dispatch is rejected', () => {
  let game, accepted; game = create({ onEvent: event => {
    if (event.type === 'correct') accepted = game.dispatch({ type: 'select', payload: {} });
  } }); game.enter(); defeatCurrent(game); assert.equal(accepted, false); assert.equal(game.snapshot().resolved, 1);
});

test('result and nested word lists are immutable', () => {
  const game = create(); game.enter(); for (let index = 0; index < 12; index++) { defeatCurrent(game); if (index < 11) spawnAfterClear(game); }
  const { result } = game.snapshot(); assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.strongWords));
  assert.ok(Object.isFrozen(result.weakWords)); assert.ok(Object.isFrozen(result.wordsPracticed)); assert.ok(Object.isFrozen(result.wordsPracticed[0]));
});

test('exit is idempotent and permanently rejects old callbacks', () => {
  const game = create(); game.enter(); const enemy = game.snapshot().enemies[0]; select(game, enemy); const old = game.snapshot().selectedEnemy;
  game.exit(); game.exit(); game.update(9999); const state = game.snapshot(); assert.equal(state.active, false); assert.equal(state.aborted, true); assert.equal(state.enemies.length, 0);
  assert.equal(game.dispatch({ type: 'submit', payload: { ...old, sessionId: 'kd-test', value: readingFor(enemy) } }), false);
});

test('unknown and malformed commands are rejected', () => {
  const game = create(); game.enter(); assert.equal(game.dispatch(null), false); assert.equal(game.dispatch({}), false);
  assert.equal(game.dispatch({ type: 'next', payload: {} }), false);
});
