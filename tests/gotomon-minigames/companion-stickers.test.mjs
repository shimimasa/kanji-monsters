import test from 'node:test';
import assert from 'node:assert/strict';
import { installStorage } from '../phase-a/storage-helper.mjs';
import { getDefaultSave, loadSave } from '../../src/core/saveData.js';
import { loadGameData, saveGameData } from '../../src/core/gameState.js';
import { createGotomonService } from '../../src/minigames/gotomonService.js';
import { validateSave } from '../../src/core/saveValidation.js';
import { recordSticker, markStickerReview, stickerSummary, validateCompanionStickers } from '../../src/minigames/companionStickers.js';
import { subjectOf, hubSections } from '../../src/minigames/hubCatalog.js';
import { miniGameRegistry } from '../../src/minigames/registry.js';

async function fixture() {
  const initial = getDefaultSave(); initial.player.collection.gotomonIds = ['HKD-E01', 'HKD-E02'];
  initial.player.miniGames = { games: {}, companions: { 'HKD-E01': { plays: 4, friendship: 10, xp: 40, medals: [] } } };
  installStorage({ krb_save: JSON.stringify(initial) }); await loadGameData();
  let time = 1000;
  const service = createGotomonService({ now: () => time, lookup: id => ({ id, name: id, grade: 1 }) });
  return { service, setTime: value => { time = value; } };
}
function args(service, sessionId, options = {}) {
  const value = { owner: service.getOwner(), sessionId, gameId: 'gotomonPush', gotomonId: 'HKD-E01',
    score: 300, correct: 4, maxCombo: 2, completed: true, finished: true, activeElapsedMs: 60000, subject: 'kanji', ...options };
  value.ticket = service.beginPlay(value); return value;
}

test('a sticker: silver for playing to the end, gold for rank A or S, never back to silver', () => {
  const friend = {};
  assert.deepEqual(recordSticker(friend, { gameId: 'gotomonPush', rank: 'B', subject: 'kanji', at: 5 }), { gameId: 'gotomonPush', tier: 'silver', isNew: true, upgraded: false });
  assert.deepEqual(recordSticker(friend, { gameId: 'gotomonPush', rank: 'C', subject: 'math', at: 6 }), { gameId: 'gotomonPush', tier: 'silver', isNew: false, upgraded: false });
  assert.deepEqual(recordSticker(friend, { gameId: 'gotomonPush', rank: 'A', at: 7 }), { gameId: 'gotomonPush', tier: 'gold', isNew: false, upgraded: true });
  assert.equal(recordSticker(friend, { gameId: 'gotomonPush', rank: 'C', at: 8 }).tier, 'gold', 'once gold, always gold');
  assert.deepEqual(friend.stickers.gotomonPush, { tier: 'gold', review: false, subjects: ['kanji', 'math'], firstAt: 5, goldAt: 7 });
  assert.equal(recordSticker(friend, { gameId: 'gotomonSlash', rank: 'S', subject: 'nope', at: 9 }).tier, 'gold');
  assert.equal(markStickerReview(friend, 'gotomonSlash'), true);
  assert.equal(markStickerReview(friend, 'gotomonSlash'), false, 'the mark is given once');
  assert.equal(markStickerReview(friend, 'gotomonTrace'), false, 'no mark without a sticker');
  assert.deepEqual({ ...stickerSummary(friend.stickers) }, { total: 2, gold: 2, review: 1 });
  validateCompanionStickers(friend.stickers);
  for (const bad of [{ x: { tier: 'gold', review: false, subjects: [], firstAt: 1, goldAt: null } },
    { gotomonPush: { tier: 'bronze', review: false, subjects: [], firstAt: 1, goldAt: null } },
    { gotomonPush: { tier: 'silver', review: 'yes', subjects: [], firstAt: 1, goldAt: null } },
    { gotomonPush: { tier: 'silver', review: false, subjects: ['art'], firstAt: 1, goldAt: null } }]) {
    assert.throws(() => validateCompanionStickers(bad));
  }
});

test('every game counts for a subject: its own, or the one chosen at the start', () => {
  const ids = [...new Set(hubSections('all').flatMap(section => section.games))];
  assert.equal(ids.length, Object.keys(miniGameRegistry).length, 'the sticker book has a slot for every game');
  assert.equal(subjectOf('photoRally'), 'kanji'); assert.equal(subjectOf('gotomonToss'), 'math'); assert.equal(subjectOf('sentenceOrder'), 'language');
  assert.equal(subjectOf('gotomonPush', 'english'), 'english'); assert.equal(subjectOf('gotomonShooter', 'math'), null);
  assert.equal(subjectOf('gotomonPush'), null);
});

test('the reward gives a sticker only for a real run played to the end, kept in the save and its validation', async () => {
  const { service } = await fixture();
  const quit = service.awardGotomonPlayResult(args(service, 'quit', { finished: false }));
  assert.equal(quit.ok, true); assert.equal(quit.reward.sticker, null);
  assert.deepEqual(service.getStickers('HKD-E01'), {});
  const first = service.awardGotomonPlayResult(args(service, 'first'));
  assert.equal(first.reward.sticker.isNew, true);
  assert.equal(first.reward.sticker.tier, ['A', 'S'].includes(first.reward.rank.rank) ? 'gold' : 'silver');
  const again = service.awardGotomonPlayResult(args(service, 'first'));
  assert.equal(again.reward.duplicate, true, 'the same run never gives a second sticker');
  // Another companion has its own book.
  assert.deepEqual(service.getStickers('HKD-E02'), {});
  saveGameData(); await loadGameData();
  assert.equal(service.getStickers('HKD-E01').gotomonPush.subjects[0], 'kanji');
  validateSave(loadSave());
});

test('short courses grow the companion without changing full-course records or stickers', async () => {
  const { service } = await fixture();
  for (const gameId of ['gotomonPush', 'gotomonBreakout']) {
    const rankBefore = service.getProgress().companions['HKD-E01'].bestRank;
    const sessionId = `short-${gameId}`;
    const result = service.awardGotomonPlayResult(args(service, sessionId, { gameId, shortCourse: true, score: 900, correct: 5, activeElapsedMs: 5000 }));
    assert.equal(result.ok, true); assert.ok(result.reward.earnedXP >= 2);
    assert.equal(result.reward.newBest, false); assert.equal(result.reward.sticker, null); assert.equal(result.reward.memory, null);
    const saved = service.getProgress();
    assert.equal(saved.games[gameId].bestScore, 0); assert.equal(saved.games[gameId].plays, 1);
    assert.equal(saved.games[gameId].bestRank, undefined); assert.equal(saved.companions['HKD-E01'].bestRank, rankBefore);
    assert.equal(service.getStickers('HKD-E01')[gameId], undefined);
    assert.equal(service.awardGotomonPlayResult(args(service, sessionId, { gameId, shortCourse: true })).reward.duplicate, true);
    const full = service.awardGotomonPlayResult(args(service, `full-${gameId}`, { gameId, score: 300 }));
    assert.equal(full.reward.newBest, true); assert.equal(full.reward.bestScore, 300);
    assert.equal(full.reward.sticker.isNew, true);
  }
  assert.ok(service.getProgress().companions['HKD-E01'].friendship > 10);
  validateSave(loadSave());
});

test('the がんばり mark: only after the review of a run that earned its sticker, once, by the same owner', async () => {
  const { service } = await fixture();
  assert.equal(service.markReviewSticker({ owner: service.getOwner(), sessionId: 'nothing' }).ok, false);
  const run = args(service, 'review');
  service.awardGotomonPlayResult(run);
  assert.equal(service.markReviewSticker({ owner: 'someone else', sessionId: 'review' }).ok, false);
  const marked = service.markReviewSticker({ owner: service.getOwner(), sessionId: 'review' });
  assert.equal(marked.ok, true); assert.equal(marked.mark, true);
  assert.equal(service.getStickers('HKD-E01').gotomonPush.review, true);
  assert.equal(service.markReviewSticker({ owner: service.getOwner(), sessionId: 'review' }).ok, false, 'once per run');
  validateSave(loadSave());
});
