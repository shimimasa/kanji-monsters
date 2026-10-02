import { stickerSummary } from './companionStickers.js';

// がんばりの称号 (2026-10-02): titles for the child, from everything played with every companion.
// Three tracks, each counting effort that never goes down; a title once earned is kept. Nothing is random.
export const TITLE_TRACKS = Object.freeze([
  Object.freeze({ id: 'review', label: 'ふくしゅう', unit: 'こ', what: 'がんばりマーク', steps: Object.freeze([
    Object.freeze({ id: 'review-1', at: 1, name: 'ふくしゅう はじめ' }),
    Object.freeze({ id: 'review-5', at: 5, name: 'ふくしゅう名人' }),
    Object.freeze({ id: 'review-20', at: 20, name: 'ふくしゅうマスター' }),
  ]) }),
  Object.freeze({ id: 'play', label: 'あそび', unit: 'まい', what: 'シール', steps: Object.freeze([
    Object.freeze({ id: 'play-5', at: 5, name: 'ミニゲーム たんけんか' }),
    Object.freeze({ id: 'play-20', at: 20, name: 'ミニゲーム はかせ' }),
    Object.freeze({ id: 'play-60', at: 60, name: 'ミニゲーム マスター' }),
  ]) }),
  Object.freeze({ id: 'friends', label: 'なかま', unit: 'ひき', what: 'シール3まい以上の ゴトモン', steps: Object.freeze([
    Object.freeze({ id: 'friends-2', at: 2, name: 'なかよし コンビ' }),
    Object.freeze({ id: 'friends-5', at: 5, name: 'ゴトモン ともだち' }),
    Object.freeze({ id: 'friends-10', at: 10, name: 'ゴトモン だいすき' }),
  ]) }),
]);

// The counts behind the tracks, over every companion's sticker book.
export function titleCounts(companions = {}) {
  const books = Object.values(companions ?? {}).map(friend => stickerSummary(friend?.stickers));
  return Object.freeze({
    review: books.reduce((sum, b) => sum + b.review, 0),
    play: books.reduce((sum, b) => sum + b.total, 0),
    friends: books.filter(b => b.total >= 3).length,
  });
}

// Each track: the titles earned so far, the newest one, and the next to aim for.
export function titleProgress(companions = {}) {
  const counts = titleCounts(companions);
  return TITLE_TRACKS.map(track => {
    const have = counts[track.id], earned = track.steps.filter(step => have >= step.at);
    const next = track.steps.find(step => have < step.at) ?? null;
    return Object.freeze({ id: track.id, label: track.label, unit: track.unit, what: track.what, have,
      earned: Object.freeze(earned), current: earned.at(-1) ?? null, next: next && Object.freeze({ ...next, left: next.at - have }) });
  });
}

export const earnedTitleIds = companions => new Set(titleProgress(companions).flatMap(track => track.earned.map(step => step.id)));

// The titles earned since `had` (the earned ids taken before a change), by name.
export function newTitles(had, after) {
  return titleProgress(after).flatMap(track => track.earned).filter(step => !had.has(step.id)).map(step => step.name);
}
