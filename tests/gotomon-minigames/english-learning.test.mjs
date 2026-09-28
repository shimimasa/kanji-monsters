import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { installStorage, quota } from '../phase-a/storage-helper.mjs';
import { getDefaultSave, loadSave } from '../../src/core/saveData.js';
import { loadGameData, saveGameData } from '../../src/core/gameState.js';
import { switchToSlot } from '../../src/core/saveSlots.js';
import { validateSave } from '../../src/core/saveValidation.js';
import { createEnglishLearningService } from '../../src/minigames/englishChoice/englishLearningService.js';
import { generateEnglishChoiceQuestions, ENGLISH_CHOICE_FIXTURE } from '../../src/minigames/englishChoice/englishChoiceQuestions.js';
import { createEnglishChoiceGame } from '../../src/minigames/englishChoice/englishChoiceGame.js';

async function fixture() {
  const initial = getDefaultSave(); initial.player.name = '復習QA';
  const storage = installStorage({ krb_save: JSON.stringify(initial) });
  await loadGameData();
  saveGameData(); // Normalize the same compatibility projections as ordinary saves.
  return { storage, service: createEnglishLearningService({ now: () => 1000 }) };
}
const event = (sessionId, id, correct = false, attemptId = `${sessionId}:${id}`) => ({
  sessionId, type: correct ? 'correct' : 'incorrect', payload: { contentId: id, attemptId },
});

test('normal sampling mixes up to three misses, unseen and older words without duplicates', () => {
  const history = Object.fromEntries(ENGLISH_CHOICE_FIXTURE.slice(0, 10).map((entry, index) => [entry.id,
    { correct: 0, incorrect: 1, lastCorrect: index > 4, lastAnsweredAt: index + 1 }]));
  const questions = generateEnglishChoiceQuestions({ sessionId: 'mix', random: () => .4, history });
  assert.equal(questions.length, 10);
  assert.equal(new Set(questions.map(q => q.contentId)).size, 10);
  assert.equal(questions.filter(q => history[q.contentId]?.lastCorrect === false).length, 3);
  assert.equal(questions.filter(q => !history[q.contentId]).length, 5);
  assert.equal(questions.filter(q => history[q.contentId]?.lastCorrect === true).length, 2);
});
test('all-missed bank still supplies ten unique questions, empty history keeps legacy sampling', () => {
  const history = Object.fromEntries(ENGLISH_CHOICE_FIXTURE.map(entry => [entry.id, { lastCorrect: false, lastAnsweredAt: 1 }]));
  const questions = generateEnglishChoiceQuestions({ sessionId: 'all', history, random: () => 0 });
  assert.equal(questions.length, 10); assert.equal(new Set(questions.map(q => q.contentId)).size, 10);
  assert.deepEqual(generateEnglishChoiceQuestions({ sessionId: 'x', random: () => 0 }),
    generateEnglishChoiceQuestions({ sessionId: 'x', random: () => 0, history: {} }));
});
test('short review completes once and grades actual choices; invalid IDs cannot make an empty run', () => {
  const events = [], game = createEnglishChoiceGame({ sessionId: 'short', reviewContentIds: ['apple', 'book', 'apple', 'unknown'], onEvent: e => events.push(e) });
  game.enter(); assert.equal(game.snapshot().totalQuestions, 2);
  for (let i = 0; i < 2; i++) {
    const state = game.snapshot(), payload = { sessionId: state.sessionId, problemId: state.problem.problemId,
      attemptId: state.attemptId, choiceId: state.problem.correctChoiceId };
    assert.equal(game.answer(payload), true); assert.equal(game.answer(payload), false);
    game.next(payload);
  }
  assert.equal(game.snapshot().mode, 'review'); assert.equal(game.snapshot().result.accuracy, 1);
  assert.equal(events.filter(e => e.type === 'sessionComplete').length, 1);
  assert.deepEqual(new Set(events.filter(e => e.type === 'correct').map(e => e.payload.contentId)), new Set(['apple', 'book']));
  const fallback = createEnglishChoiceGame({ sessionId: 'bad', reviewContentIds: ['unknown'] });
  assert.equal(fallback.snapshot().totalQuestions, 10); assert.equal(fallback.snapshot().mode, 'tenQuestions');
});
test('answers persist exactly once across reload and autosave without changing kanji or growth', async () => {
  const { service } = await fixture(), before = loadSave();
  const run = service.beginRun('one'), answer = event('one', 'apple');
  run.observe(answer); run.observe(answer); assert.equal(run.flush().ok, true);
  run.observe(event('one', 'unknown')); assert.equal(run.flush().ok, true);
  saveGameData(); await loadGameData();
  assert.deepEqual(service.getReviewIds(), ['apple']); assert.equal(service.getHistory().apple.incorrect, 1);
  const duplicate = service.beginRun('one'); duplicate.observe(answer); duplicate.flush();
  assert.equal(service.getHistory().apple.incorrect, 1);
  const review = service.beginRun('two'); review.observe(event('two', 'apple', true)); review.flush();
  assert.deepEqual(service.getReviewIds(), []);
  const after = loadSave(); assert.deepEqual(after.player.study, before.player.study);
  assert.deepEqual(after.player.coreStats, before.player.coreStats);
  assert.deepEqual(after.player.miniGames.companions, {});
});
test('quota failure leaves canonical save unchanged and retry records every pending answer once', async () => {
  const { service, storage } = await fixture(), before = storage.getItem('krb_save');
  const run = service.beginRun('quota'); run.observe(event('quota', 'apple'));
  assert.equal(run.pendingCount(), 1);
  storage.fail = (op, key) => { if (op === 'set' && key === 'krb_save') throw quota(); };
  assert.equal(run.flush().ok, false); assert.equal(storage.getItem('krb_save'), before);
  assert.equal(run.pendingCount(), 1);
  run.observe(event('quota', 'book', true)); storage.fail = null;
  assert.equal(run.flush().ok, true); run.flush();
  assert.equal(run.pendingCount(), 0);
  assert.equal(service.getHistory().apple.incorrect, 1); assert.equal(service.getHistory().book.correct, 1);
});
test('slot switch, stale run and closed run cannot write to another child', async () => {
  const { service } = await fixture(); const old = service.beginRun('old'); old.observe(event('old', 'apple'));
  assert.equal(switchToSlot(2), true); await loadGameData();
  assert.equal(old.flush().ok, false); assert.deepEqual(service.getHistory(), {});
  assert.equal(switchToSlot(1), true); await loadGameData(); assert.equal(old.flush().ok, false);
  const next = service.beginRun('next'); next.observe(event('next', 'book')); next.close();
  assert.equal(next.flush().ok, false); assert.deepEqual(service.getHistory(), {});
});
test('save validator rejects corrupt learning records and allows legacy saves', () => {
  const save = getDefaultSave(); assert.doesNotThrow(() => validateSave(save, 2));
  save.player.miniGames = { englishLearning: { version: 1, items: { apple: { correct: -1, incorrect: 0, lastAnsweredAt: 0, lastCorrect: false } }, recentAttempts: [] } };
  assert.throws(() => validateSave(save, 2), /English/);
});
test('learning features preserve other five cores/views, reward formulas, kanji save and logger', () => {
  // Sprint, Invader and Defense were later rebuilt as arcade games on purpose; their
  // behaviour is covered by their own suites instead of this byte freeze.
  const games = ['multiSelect', 'asyncChoice'];
  const files = games.flatMap(id => [`src/minigames/${id}/${id}Game.js`, `src/minigames/${id}/${id}View.js`]);
  // Companion play can select a course; grading and growth formulas remain frozen.
  files.push('src/minigames/companionGrowth.js', 'src/minigames/scoreRank.js',
    'src/playtest/developmentLogger.js', 'src/core/saveData.js', 'src/core/learningOutcome.js', 'src/audio/audioManager.js');
  for (const file of files) assert.equal(readFileSync(file, 'utf8').replaceAll('\r\n', '\n'),
    execFileSync('git', ['show', `2c5c501:${file}`], { encoding: 'utf8' }).replaceAll('\r\n', '\n'), file);
});
