import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installStorage } from '../phase-a/storage-helper.mjs';
import { getDefaultSave, loadSave } from '../../src/core/saveData.js';
import { loadGameData } from '../../src/core/gameState.js';
import { validateSave } from '../../src/core/saveValidation.js';
import { createGotomonService } from '../../src/minigames/gotomonService.js';
import { contextReading, buildPhotoRally, PHOTO_SHOTS } from '../../src/minigames/photoRally/photoRallyContent.js';
import { createPhotoRallyGame } from '../../src/minigames/photoRally/photoRallyGame.js';
import { createQuizWorld } from '../../src/minigames/gameplay/quizWorlds.js';
import { growthStatus } from '../../src/minigames/companionGrowth.js';

const json = path => JSON.parse(readFileSync(new URL(`../../public/data/${path}`, import.meta.url), 'utf8'));
const kanjiByGrade = {}, kanji = {};
for (let grade = 1; grade <= 6; grade++) { kanjiByGrade[grade] = json(`kanji_g${grade}_proto.json`); for (const item of kanjiByGrade[grade]) kanji[item.id] = item; }
const monsters = Object.fromEntries(json('enemies_proto.json').map(item => [item.id, item]));
const stages = json('stages_proto.json').filter(stage => stage.grade <= 6);
const rallyFor = (stage, extra = {}) => buildPhotoRally({ sessionId: 'rally', stage, random: () => .42,
  stageKanji: stage.kanjiPoolIdList.map(id => kanji[id]).filter(Boolean), gradeKanji: kanjiByGrade[stage.grade],
  monsters: stage.enemyIdList.map(id => monsters[id]).filter(Boolean), ...extra });
const toHira = text => text.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));

test('context readings come from the sentence, match the kanji, and skip unclear or slipped data', () => {
  assert.deepEqual({ ...contextReading({ kanji: '引', onyomi: ['イン'], kunyomi: ['ひ'], exampleSentence: 'ひもを引（ひ）く。' }) },
    { reading: 'ひ', katakana: false, before: 'ひもを', after: 'く。' });
  // The reading after a compound could belong to the whole word: skipped.
  assert.equal(contextReading({ kanji: '円', onyomi: ['エン'], kunyomi: ['まる'], exampleSentence: '百円（エン）だま。' }), null);
  // A reading not listed for the kanji is a data slip: skipped.
  assert.equal(contextReading({ kanji: '午', onyomi: ['ゴ'], kunyomi: [], exampleSentence: '午（ひる）ごはん。' }), null);
  // 十（とお）ぽん is read じっぽん: native number readings only before つ.
  assert.equal(contextReading({ kanji: '十', onyomi: ['ジュウ'], kunyomi: ['とお'], exampleSentence: 'ゆびは十（とお）ぽん ある。' }), null);
  assert.equal(contextReading({ kanji: '五', onyomi: ['ゴ'], kunyomi: ['いつ'], exampleSentence: 'ゆびは五（いつ）つ ある。' }).reading, 'いつ');
  // Other readings in the sentence are hidden so the question never shows its answer.
  assert.equal(contextReading(kanji['g3-006']).before.includes('（'), false);
});

test('every elementary stage yields ten shots with four same-script choices and one monster each', () => {
  assert.equal(stages.length, 36);
  for (const stage of stages) {
    const rally = rallyFor(stage);
    assert.equal(rally.shots.length, PHOTO_SHOTS, stage.stageId);
    assert.equal(new Set(rally.shots.map(shot => shot.monsterId)).size, PHOTO_SHOTS, stage.stageId);
    for (const shot of rally.shots) {
      assert.equal(shot.choices.length, 4, `${stage.stageId} ${shot.kanji}`);
      assert.equal(new Set(shot.choices.map(choice => toHira(choice.text))).size, 4, `${stage.stageId} ${shot.kanji}`);
      assert.ok(shot.choices.every(choice => /^[ァ-ヶー]+$/.test(choice.text) === /^[ァ-ヶー]+$/.test(shot.reading)), shot.kanji);
      assert.equal(shot.choices.find(choice => choice.choiceId === shot.correctChoiceId).text, shot.reading);
      assert.equal(`${shot.before}${shot.kanji}${shot.after}`.includes('（'), false);
    }
  }
});

test('the child\'s focus kanji from the stage come first', () => {
  const stage = stages.find(item => item.stageId === 'hokkaido_area1');
  const usable = stage.kanjiPoolIdList.filter(id => contextReading(kanji[id]));
  const focus = usable.slice(-3);
  const rally = rallyFor(stage, { focusKanjiIds: focus });
  assert.deepEqual(new Set(rally.shots.slice(0, 3).map(shot => shot.contentId)), new Set(focus));
});

test('Core runs ten shots with identity gates, a result, and missed readings for review', () => {
  const content = rallyFor(stages[0]); const events = [];
  const game = createPhotoRallyGame({ sessionId: 'rally', content, onEvent: event => events.push(event.type) });
  assert.equal(game.enter(), true);
  for (let index = 0; index < PHOTO_SHOTS; index++) {
    const state = game.snapshot(), problem = state.problem;
    const identity = { sessionId: 'rally', problemId: problem.problemId, attemptId: state.attemptId };
    const wrong = problem.choices.find(choice => choice.choiceId !== problem.correctChoiceId);
    assert.equal(game.dispatch({ type: 'answer', payload: { ...identity, attemptId: 'old', choiceId: problem.correctChoiceId } }), false);
    if (index === 0) { game.setPaused(true); assert.equal(game.dispatch({ type: 'answer', payload: { ...identity, choiceId: problem.correctChoiceId } }), false); game.setPaused(false); }
    assert.equal(game.dispatch({ type: 'answer', payload: { ...identity, choiceId: index === 2 ? wrong.choiceId : problem.correctChoiceId } }), true);
    assert.equal(game.dispatch({ type: 'answer', payload: { ...identity, choiceId: problem.correctChoiceId } }), false);
    if (index < PHOTO_SHOTS - 1) assert.equal(game.dispatch({ type: 'next', payload: { sessionId: 'rally', problemId: problem.problemId } }), true);
  }
  assert.deepEqual({ ...game.snapshot().result }, { answered: 10, correct: 9, incorrect: 1, accuracy: .9 });
  assert.equal(game.snapshot().missed.length, 1); assert.equal(events.filter(type => type === 'sessionComplete').length, 1);
  game.exit(); assert.equal(game.snapshot().aborted, false);
});

test('photo stars follow how early the shot was taken; a miss takes no photo', () => {
  const effects = growthStatus().effects;
  const shoot = (wait, success = true) => {
    const world = createQuizWorld('photo', effects); world.context({ phase: 'answering', problem: { problemId: 'p' } });
    world.update(wait); world.answer(success, { monsterId: 'HKD-E01' }, 1); return world.snapshot();
  };
  assert.equal(shoot(500).photos[0].stars, 3); assert.equal(shoot(3500).photos[0].stars, 2); assert.equal(shoot(60000).photos[0].stars, 1);
  assert.deepEqual(shoot(500, false).photos, []); assert.equal(shoot(500).bestShots, 1);
});

async function albumFixture() {
  const snapshot = getDefaultSave(); snapshot.player.name = 'アルバムQA'; snapshot.player.collection.gotomonIds = ['HKD-E01'];
  snapshot.player.progress.clearedStages = ['kanto_area1'];
  snapshot.player.study.answers = { 'g1-010': { correct: 1, incorrect: 2 }, 'g1-011': { correct: 3, incorrect: 1 } };
  installStorage({ krb_save: JSON.stringify(snapshot) }); await loadGameData();
  return createGotomonService({ lookup: id => ({ id, name: id, grade: 1, category: '食文化' }) });
}
const award = (service, sessionId, photos) => {
  const args = { owner: service.getOwner(), sessionId, gameId: 'photoRally', gotomonId: 'HKD-E01', score: 1500, correct: 9, maxCombo: 5,
    completed: true, finished: true, activeElapsedMs: 60000, photos };
  args.ticket = service.beginPlay(args); return service.awardGotomonPlayResult(args);
};

test('album keeps the best photo per monster, counts shots, and never doubles a result', async () => {
  const service = await albumFixture();
  assert.deepEqual(service.getVisitedStageIds(), ['hokkaido_area1', 'kanto_area1']);
  assert.deepEqual(service.getFocusKanjiIds(), ['g1-010']);
  const first = award(service, 'one', [{ monsterId: 'HKD-E02', stars: 2 }, { monsterId: 'HKD-E03', stars: 3 }]);
  assert.deepEqual(first.reward.newPhotos, ['HKD-E02', 'HKD-E03']);
  const second = award(service, 'two', [{ monsterId: 'HKD-E02', stars: 3 }, { monsterId: 'HKD-E03', stars: 1 }]);
  assert.deepEqual(second.reward.newPhotos, []);
  const album = service.getAlbum();
  assert.equal(album['HKD-E02'].stars, 3); assert.equal(album['HKD-E03'].stars, 3); assert.equal(album['HKD-E02'].shots, 2);
  // Other games cannot write photos.
  const other = { owner: service.getOwner(), sessionId: 'three', gameId: 'englishChoice', gotomonId: 'HKD-E01', score: 1500, correct: 9,
    maxCombo: 5, completed: true, finished: true, activeElapsedMs: 60000, photos: [{ monsterId: 'HKD-E09', stars: 3 }] };
  other.ticket = service.beginPlay(other); service.awardGotomonPlayResult(other);
  assert.equal(service.getAlbum()['HKD-E09'], undefined);
  assert.deepEqual(Object.keys(loadSave().player.miniGames.album).sort(), ['HKD-E02', 'HKD-E03']);
});

test('save validation accepts a real album and nine started games, and rejects broken photos', () => {
  const save = getDefaultSave();
  save.player.miniGames = { version: 1, games: {}, companions: {}, album: { 'HKD-E01': { stars: 3, shots: 2, firstAt: 1 } },
    hubActivity: { version: 1, lastGameId: 'photoRally', startedGames: ['mathSprint', 'mathInvader', 'englishChoice', 'sentenceOrder',
      'timedChoice', 'multiSelect', 'asyncChoice', 'kanjiDefense', 'photoRally'] } };
  assert.doesNotThrow(() => validateSave(save, save.meta.version));
  for (const photo of [{ stars: 4, shots: 1, firstAt: 1 }, { stars: 0, shots: 1, firstAt: 1 }, { stars: 2, shots: 0, firstAt: 1 }, 'x']) {
    const broken = structuredClone(save); broken.player.miniGames.album = { 'HKD-E01': photo };
    assert.throws(() => validateSave(broken, save.meta.version), /album/i);
  }
});
