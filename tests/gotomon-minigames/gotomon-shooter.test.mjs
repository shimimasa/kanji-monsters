import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildShooterWaves, SHOOTER_WAVES, SHOOTER_FORMATION } from '../../src/minigames/gotomonShooter/shooterContent.js';
import { createShooterGame, SHOOTER_RULES as R } from '../../src/minigames/gotomonShooter/shooterGame.js';
import { createQuizWorld } from '../../src/minigames/gameplay/quizWorlds.js';
import { growthStatus } from '../../src/minigames/companionGrowth.js';

const json = path => JSON.parse(readFileSync(new URL(`../../public/data/${path}`, import.meta.url), 'utf8'));
const kanjiByGrade = {}, kanji = {};
for (let grade = 1; grade <= 6; grade++) { kanjiByGrade[grade] = json(`kanji_g${grade}_proto.json`); for (const item of kanjiByGrade[grade]) kanji[item.id] = item; }
const stages = json('stages_proto.json').filter(stage => stage.grade <= 6);
const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const toHira = text => String(text).replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
const readingsOf = k => new Set([...(k.onyomi || []), ...(k.kunyomi || [])].map(r => toHira(r).split(/[.・-]/)[0]));
const listsFor = stage => ({ stageKanji: stage.kanjiPoolIdList.map(id => kanji[id]).filter(Boolean), gradeKanji: kanjiByGrade[stage.grade] });

function newShooter({ seed = 3, mode = 'english', pace = 'normal' } = {}) {
  const events = [], sessionId = `shoot${seed}`;
  const waves = buildShooterWaves({ sessionId, random: seeded(seed), mode, ...(mode === 'kanji' ? listsFor(stages[seed % stages.length]) : {}) });
  const game = createShooterGame({ sessionId, pace, onEvent: event => events.push(event), content: { mode, waves } });
  assert.equal(game.enter(), true);
  const act = (type, extra = {}) => game.dispatch({ type, payload: { sessionId, attemptId: game.snapshot().attemptId, ...extra } });
  const next = () => game.dispatch({ type: 'next', payload: { sessionId } });
  const run = ms => { for (let t = 0; t < ms && game.snapshot().phase === 'answering'; t += 16) game.update(16); };
  // Flies under a Gotomon and fires until a beam reaches the formation.
  const shootAt = enemyId => {
    for (let tries = 0; tries < 40 && game.snapshot().phase === 'answering'; tries++) {
      const enemy = game.snapshot().enemies.find(item => item.enemyId === enemyId);
      act('aimFire', { x: enemy.x }); run(120);
    }
  };
  return { game, events, sessionId, act, next, run, shootAt };
}

test('both modes make waves of four plates with one answer', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const english = buildShooterWaves({ sessionId: 's', random: seeded(seed), mode: 'english' });
    assert.equal(english.length, SHOOTER_WAVES);
    for (const stage of stages) {
      const waves = buildShooterWaves({ sessionId: 's', random: seeded(seed), mode: 'kanji', ...listsFor(stage) });
      assert.equal(waves?.length, SHOOTER_WAVES, stage.stageId);
      for (const wave of waves) {
        assert.equal(wave.plates.length, SHOOTER_FORMATION);
        assert.equal(new Set(wave.plates.map(plate => plate.text)).size, SHOOTER_FORMATION);
        // Only the answer's plate is a reading of the kanji shown.
        const readings = readingsOf(kanji[wave.contentId]);
        const fits = wave.plates.filter(plate => readings.has(toHira(plate.text)));
        assert.deepEqual(fits.map(plate => plate.contentId), [wave.contentId], `${wave.prompt}: ${wave.plates.map(p => p.text)}`);
      }
    }
  }
});

test('the ship glides to a tap and fires; beams fly up; the formation drifts down and loops', () => {
  const { game, act, run } = newShooter();
  assert.equal(act('aimFire', { x: 0.2 }), true);
  run(100);
  assert.ok(game.snapshot().ship.x < 0.5);
  run(600);
  assert.ok(Math.abs(game.snapshot().ship.x - 0.2) < 1e-9 || game.snapshot().phase === 'feedback');
  const slow = newShooter({ pace: 'slow' }), normal = newShooter();
  const y0 = normal.game.snapshot().enemies[0].y;
  normal.run(3000); slow.run(3000);
  assert.ok(normal.game.snapshot().enemies[0].y > slow.game.snapshot().enemies[0].y);
  assert.ok(normal.game.snapshot().enemies[0].y > y0);
  // Left alone for a long time, the formation never reaches the ship.
  const idle = newShooter({ seed: 5 });
  for (let t = 0; t < 60000; t += 50) { idle.game.update(50); assert.ok(idle.game.snapshot().enemies.every(enemy => enemy.y <= R.loopY + 1e-9)); }
  // Steering stays inside the field; dragging does not fire.
  const s = newShooter({ seed: 6 });
  assert.equal(s.act('steer', { x: 5 }), true); s.run(2000);
  assert.equal(s.game.snapshot().ship.x, R.maxX); assert.equal(s.game.snapshot().beams.length, 0);
});

test('a beam on the answer makes friends and brings the next wave; twelve end the run', () => {
  const { game, events, next, shootAt } = newShooter({ seed: 7 });
  let guard = 0;
  while (game.snapshot().phase !== 'completed' && guard++ < 60) {
    const state = game.snapshot();
    shootAt(state.problem.correctChoiceId);
    assert.equal(game.snapshot().lastAnswer.correct, true);
    next();
  }
  const { result } = game.snapshot();
  assert.equal(result.friends, SHOOTER_WAVES); assert.equal(result.correct, SHOOTER_WAVES);
  assert.equal(events.filter(event => event.type === 'sessionComplete').length, 1);
});

test('a beam on another Gotomon is one learning result; it leaves and the answer glows', () => {
  for (const mode of ['english', 'kanji']) {
    const { game, events, next, shootAt } = newShooter({ seed: 8, mode });
    const state = game.snapshot(), want = state.problem.correctChoiceId;
    const wrong = state.enemies.find(enemy => enemy.enemyId !== want);
    shootAt(wrong.enemyId);
    const answer = game.snapshot().lastAnswer;
    assert.equal(answer.correct, false); assert.equal(answer.plate.contentId, wrong.plate.contentId);
    assert.equal(events.at(-1).type, 'incorrect');
    next();
    const retry = game.snapshot();
    assert.equal(retry.enemies.length, SHOOTER_FORMATION - 1);
    assert.equal(retry.hintId, want);
    assert.notEqual(retry.problem.problemId, state.problem.problemId);
    shootAt(want);
    assert.equal(events.at(-1).type, 'befriended');
    assert.equal(events.filter(event => ['correct', 'incorrect'].includes(event.type)).length, 1);
  }
});

test('old attempts, paused commands and missing content are refused', () => {
  const { game, sessionId, act } = newShooter({ seed: 9 });
  const { attemptId } = game.snapshot();
  game.setPaused(true); assert.equal(act('fire'), false); assert.equal(act('steer', { x: 0.3 }), false); game.setPaused(false);
  assert.equal(act('steer', { x: Number.NaN }), false);
  assert.equal(game.dispatch({ type: 'fire', payload: { sessionId, attemptId: 'old' } }), false);
  assert.equal(act('fire'), true); assert.equal(act('fire'), false); // cooldown
  assert.equal(createShooterGame({ sessionId: 'x', content: { waves: null } }).enter(), false);
  assert.ok(attemptId);
});

test('the shooter world counts new friends', () => {
  const world = createQuizWorld('shooter', growthStatus().effects);
  world.context({ mode: 'shooter', phase: 'answering', problem: { problemId: 'p' } });
  world.answer(true, {}, 1); world.answer(false, {}, 0);
  assert.match(world.snapshot().summary, /2ひきと なかよくなった · 1回でなかまにした 1ひき/);
});
