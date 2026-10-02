// The sticker book: one sticker per mini-game for each companion (2026-10-02).
// Silver: the game played to the end with that companion. Gold: rank A or S (once gold, always gold).
// The がんばり mark: the 「もじを ならべて ふくしゅう」 after that game finished, an effort sign.
// Stickers only ever grow; nothing here is random and nothing is taken back.
export const STICKER_TIERS = Object.freeze(['silver', 'gold']);
export const STICKER_SUBJECTS = Object.freeze(['kanji', 'english', 'math', 'language']);
const GOLD_RANKS = Object.freeze(['A', 'S']);
const MAX_STICKERS = 64;
const GAME_ID = /^[A-Za-z][A-Za-z0-9]{1,40}$/;

// Called inside the existing reward transaction, after its duplicate-session gate, for a run
// that was completed and finished. Returns what changed for the result screen.
export function recordSticker(friend, { gameId, rank, subject = null, at }) {
  if (!GAME_ID.test(String(gameId ?? ''))) return null;
  const stickers = friend.stickers ??= {};
  const before = stickers[gameId];
  const tier = GOLD_RANKS.includes(rank) || before?.tier === 'gold' ? 'gold' : 'silver';
  const subjects = new Set(before?.subjects ?? []);
  if (STICKER_SUBJECTS.includes(subject)) subjects.add(subject);
  stickers[gameId] = { tier, review: !!before?.review, subjects: [...subjects], firstAt: before?.firstAt ?? at,
    goldAt: tier === 'gold' ? (before?.goldAt ?? at) : null };
  return { gameId, tier, isNew: !before, upgraded: !!before && before.tier !== 'gold' && tier === 'gold' };
}

// The がんばり mark, after the build-again review of a game whose sticker exists.
export function markStickerReview(friend, gameId) {
  const sticker = friend?.stickers?.[gameId];
  if (!sticker || sticker.review) return false;
  sticker.review = true;
  return true;
}

export function stickerSummary(stickers = {}) {
  const list = Object.values(stickers ?? {});
  return Object.freeze({ total: list.length, gold: list.filter(s => s.tier === 'gold').length, review: list.filter(s => s.review).length });
}

export function validateCompanionStickers(stickers) {
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const time = value => Number.isSafeInteger(value) && value >= 0;
  if (!object(stickers) || Object.keys(stickers).length > MAX_STICKERS) throw new Error('Invalid companion stickers');
  for (const [id, sticker] of Object.entries(stickers)) {
    if (!GAME_ID.test(id) || !object(sticker) || !STICKER_TIERS.includes(sticker.tier) || typeof sticker.review !== 'boolean'
        || !Array.isArray(sticker.subjects) || sticker.subjects.some(s => !STICKER_SUBJECTS.includes(s)) || !time(sticker.firstAt)
        || (sticker.tier === 'gold' ? !time(sticker.goldAt) : sticker.goldAt !== null)) throw new Error('Invalid companion sticker');
  }
}
