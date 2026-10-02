import test from 'node:test';
import assert from 'node:assert/strict';
import { installStorage } from '../phase-a/storage-helper.mjs';
import { getDefaultSave } from '../../src/core/saveData.js';
import { loadGameData } from '../../src/core/gameState.js';
import { createGotomonService } from '../../src/minigames/gotomonService.js';
import { titleProgress, titleCounts, earnedTitleIds, newTitles, TITLE_TRACKS } from '../../src/minigames/companionTitles.js';

const book = (n, review = 0) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`game${i}x`, { tier: 'silver', review: i < review, subjects: [], firstAt: 1, goldAt: null }]));

test('three tracks of effort: がんばり marks, stickers, and companions with three stickers or more', () => {
  assert.ok(titleProgress({}).every(track => !track.current && track.next), 'no title before any sticker');
  const companions = { a: { stickers: book(4, 2) }, b: { stickers: book(3, 3) }, c: { stickers: book(1) } };
  assert.deepEqual({ ...titleCounts(companions) }, { review: 5, play: 8, friends: 2 });
  const [review, play, friends] = titleProgress(companions);
  assert.equal(review.current.name, 'ふくしゅう名人'); assert.deepEqual({ ...review.next }, { id: 'review-20', at: 20, name: 'ふくしゅうマスター', left: 15 });
  assert.equal(play.current.name, 'ミニゲーム たんけんか'); assert.equal(play.next.left, 12);
  assert.equal(friends.current.name, 'なかよし コンビ');
  const had = earnedTitleIds({ a: { stickers: book(4, 0) } });
  assert.deepEqual(newTitles(had, companions), ['ふくしゅう はじめ', 'ふくしゅう名人', 'ミニゲーム たんけんか', 'なかよし コンビ']);
  assert.deepEqual(newTitles(earnedTitleIds(companions), companions), []);
  assert.equal(TITLE_TRACKS.flatMap(t => t.steps).length, 9);
  assert.equal(titleProgress({ a: { stickers: book(60, 20) }, ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`f${i}`, { stickers: book(3) }])) }).every(t => !t.next), true, 'everything earned');
});

test('a run and its review say which titles they earned; the summary lists every owned companion', async () => {
  const initial = getDefaultSave(); initial.player.collection.gotomonIds = ['HKD-E01', 'HKD-E02'];
  initial.player.miniGames = { games: {}, companions: { 'HKD-E01': { plays: 4, friendship: 10, xp: 40, medals: [],
    stickers: book(4) } } };
  installStorage({ krb_save: JSON.stringify(initial) }); await loadGameData();
  const service = createGotomonService({ now: () => 1000, lookup: id => ({ id, name: id, grade: 1, prefecture: '北海道', desc: 'しょうかい' }) });
  const value = { owner: service.getOwner(), sessionId: 's1', gameId: 'gotomonPush', gotomonId: 'HKD-E01', score: 300, correct: 4, maxCombo: 2,
    completed: true, finished: true, activeElapsedMs: 60000 };
  value.ticket = service.beginPlay(value);
  assert.deepEqual(service.awardGotomonPlayResult(value).reward.newTitles, ['ミニゲーム たんけんか'], 'the fifth sticker');
  const marked = service.markReviewSticker({ owner: service.getOwner(), sessionId: 's1' });
  assert.deepEqual(marked.newTitles, ['ふくしゅう はじめ'], 'the first がんばり mark');
  const cards = service.getCompanionCards();
  assert.deepEqual(cards.map(c => c.gotomon.id), ['HKD-E01', 'HKD-E02']);
  const first = cards[0];
  assert.equal(first.stickers.total, 5); assert.equal(first.stickers.review, 1); assert.equal(first.outfits, 2, 'the ribbon, and はなかんむり at なかよし 12');
  assert.equal(first.secretTotal, 2); assert.equal(first.secrets, 1);
  assert.equal(cards[1].stickers.total, 0);
  assert.equal(service.getTitles()[1].current.name, 'ミニゲーム たんけんか');
});
