import test from 'node:test';
import assert from 'node:assert/strict';
import { createTimedChoiceGame } from '../../src/minigames/timedChoice/timedChoiceGame.js';
import { createTimedLearningService } from '../../src/minigames/timedChoice/timedLearningService.js';
import { createEnglishLearningService } from '../../src/minigames/englishChoice/englishLearningService.js';
import { hubRecommendations } from '../../src/minigames/hubRecommendations.js';
import { installStorage, quota } from '../phase-a/storage-helper.mjs';
import { getDefaultSave, loadSave } from '../../src/core/saveData.js';
import { loadGameData } from '../../src/core/gameState.js';
import { switchToSlot } from '../../src/core/saveSlots.js';
import { validateSave } from '../../src/core/saveValidation.js';
const payload = state => ({ sessionId: state.sessionId, problemId: state.problem.problemId, attemptId: state.attemptId, choiceId: state.problem.correctChoiceId });
async function fixture() {
  const storage = installStorage({ krb_save: JSON.stringify(getDefaultSave()) }); await loadGameData();
  return { storage, service: createTimedLearningService({ now: () => 1000 }) };
}
test('normal keeps five seconds; review remains answerable after a whole day of updates', () => {
  const normal = createTimedChoiceGame({ sessionId: 'normal' }); normal.enter(); normal.update(5000);
  assert.equal(normal.snapshot().timedOut, 1);
  const review = createTimedChoiceGame({ sessionId: 'review', reviewContentIds: ['anzen', 'kibou', 'anzen'] }); review.enter(); review.update(86400000);
  assert.equal(review.snapshot().mode, 'review'); assert.equal(review.snapshot().totalQuestions, 2);
  assert.equal(review.snapshot().remainingMs, null); assert.equal(review.snapshot().deadlineMs, null);
  assert.equal(review.snapshot().phase, 'answering'); assert.equal(review.snapshot().timedOut, 0);
  let p = payload(review.snapshot()); review.setPaused(true); assert.equal(review.answer(p), false); review.setPaused(false);
  assert.equal(review.answer(p), true); assert.equal(review.answer(p), false); review.next(p);
  assert.equal(review.answer(payload(review.snapshot())), true); assert.equal(review.snapshot().result.accuracy, 1);
});
test('unknown review IDs safely fall back to a normal ten-question game', () => {
  const game = createTimedChoiceGame({ sessionId: 'fallback', reviewContentIds: ['unknown'] }); game.enter();
  assert.equal(game.snapshot().mode, 'deadlineProbe'); assert.equal(game.snapshot().totalQuestions, 10);
});
test('actual core timeouts and wrong choices save separately; duplicate events count once', async () => {
  const { service } = await fixture(), run = service.beginRun('history');
  const game = createTimedChoiceGame({ sessionId: 'history', onEvent: e => { run.observe(e); run.observe(e); } }); game.enter();
  const first = game.snapshot().problem.fixtureId; game.update(5000); run.flush();
  assert.deepEqual(service.getHistory()[first], { correct: 0, incorrect: 0, timedOut: 1, lastReason: 'timeout', lastAnsweredAt: 1000, lastCorrect: false });
  game.next(payload(game.snapshot())); const s = game.snapshot(), second = s.problem.fixtureId;
  game.answer({ ...payload(s), choiceId: s.problem.choices.find(c => c.choiceId !== s.problem.correctChoiceId).choiceId }); run.flush();
  assert.equal(service.getHistory()[second].incorrect, 1); assert.equal(service.getHistory()[second].timedOut, 0);
  await loadGameData(); assert.equal(service.getReviewIds().length, 2);
  const reviewRun = service.beginRun('fix'), review = createTimedChoiceGame({ sessionId: 'fix', reviewContentIds: [first], onEvent: reviewRun.observe });
  review.enter(); review.answer(payload(review.snapshot())); reviewRun.flush();
  assert.deepEqual(service.getReviewIds(), [second]); assert.equal(service.getHistory()[first].timedOut, 1);
  assert.deepEqual(createEnglishLearningService().getHistory(), {});
});
test('timed history quota retry and stale slot protection use the confirmed save', async () => {
  const { storage, service } = await fixture(), run = service.beginRun('quota');
  run.observe({ sessionId: 'quota', gameId: 'timedChoice', type: 'incorrect', payload: { contentId: 'anzen', attemptId: 'one', reason: 'timeout' } });
  const before = storage.getItem('krb_save');
  storage.fail = (op, key) => { if (op === 'set' && key === 'krb_save') throw quota(); };
  assert.equal(run.flush().ok, false); assert.equal(storage.getItem('krb_save'), before);
  storage.fail = null; assert.equal(run.flush().ok, true); assert.equal(service.getHistory().anzen.timedOut, 1);
  const old = service.beginRun('old'); switchToSlot(2); await loadGameData(); assert.equal(old.flush().ok, false);
  assert.deepEqual(service.getHistory(), {}); switchToSlot(1); await loadGameData(); assert.equal(service.getHistory().anzen.timedOut, 1);
});
test('two review banks fit within three distinct recommendations', () => {
  const result = hubRecommendations({ gameIds: ['englishChoice', 'timedChoice', 'mathSprint', 'sentenceOrder'],
    reviewCount: 2, timedReviewCount: 3, progress: { hubActivity: { lastGameId: 'mathSprint', startedGames: ['mathSprint'] } } });
  assert.equal(result.length, 3); assert.equal(new Set(result.map(item => item.gameId)).size, 3);
  assert.equal(result[1].gameId, 'timedChoice'); assert.equal(result[1].review, true);
});
test('malformed timed history is rejected without requiring it in old saves', async () => {
  await fixture(); const save = loadSave(); validateSave(save, 2);
  save.player.miniGames = { timedLearning: { version: 1, recentAttempts: [], items: { anzen: { correct: 0, incorrect: 0, timedOut: -1, lastAnsweredAt: 0, lastCorrect: false, lastReason: 'timeout' } } } };
  assert.throws(() => validateSave(save, 2), /Timed/);
});
