import { growthStatus } from './companionGrowth.js';
import { stickerSummary } from './companionStickers.js';

// きせかえ (2026-10-02): things a companion can wear, opened by its own sticker book, level and
// なかよし. Unlocks are worked out from records that only ever grow, so nothing once opened closes
// again. One item per place; the child puts it on and takes it off. Nothing is random.
export const OUTFIT_SLOTS = Object.freeze(['head', 'face', 'aura', 'back']);
export const SLOT_NAMES = Object.freeze({ head: 'あたま', face: 'かお', aura: 'まわり', back: 'せなか' });
const item = (id, slot, icon, name, need, hint) => Object.freeze({ id, slot, icon, name, need: Object.freeze(need), hint });
export const OUTFIT_ITEMS = Object.freeze([
  item('ribbon', 'head', '🎀', 'リボン', { stickers: 1 }, 'シール 1まい'),
  item('flowers', 'head', '🌼', 'はなかんむり', { friendship: 12 }, 'なかよし 12'),
  item('hat', 'head', '🧢', 'たんけんぼうし', { stickers: 8 }, 'シール 8まい'),
  item('scholar', 'head', '🎓', 'はかせぼうし', { math: 3 }, '算数で遊んだ シール 3まい'),
  item('crown', 'head', '👑', 'おうかん', { levelOrAll: 10 }, 'Lv10 か、シールを ぜんぶ'),
  item('glasses', 'face', '👓', 'めがね', { kanji: 3 }, '漢字で遊んだ シール 3まい'),
  item('headphones', 'face', '🎧', 'ヘッドホン', { english: 3 }, '英語で遊んだ シール 3まい'),
  item('sparkle', 'aura', '✨', 'きらきら', { gold: 5 }, '金シール 5まい'),
  item('rainbow', 'aura', '🌈', 'にじのわ', { review: 3 }, 'がんばりマーク 3こ'),
  item('cape', 'back', '🦸', 'マント', { level: 7 }, 'Lv7'),
]);
const byId = Object.fromEntries(OUTFIT_ITEMS.map(entry => [entry.id, entry]));

// How far a companion is toward each item: { have, need, unlocked } per item id.
export function outfitProgress(friend = {}, { gameCount = 41 } = {}) {
  const stickers = friend?.stickers ?? {}, sum = stickerSummary(stickers);
  const bySubject = subject => Object.values(stickers).filter(s => s.subjects?.includes(subject)).length;
  const level = growthStatus(friend).level, friendship = Number.isSafeInteger(friend?.friendship) ? friend.friendship : 0;
  const measure = need => need.stickers ? [sum.total, need.stickers] : need.friendship ? [friendship, need.friendship]
    : need.gold ? [sum.gold, need.gold] : need.review ? [sum.review, need.review] : need.level ? [level, need.level]
    : need.levelOrAll ? (level >= need.levelOrAll ? [1, 1] : [sum.total, gameCount])
    : need.math ? [bySubject('math'), need.math] : need.kanji ? [bySubject('kanji'), need.kanji] : need.english ? [bySubject('english'), need.english] : [0, 1];
  return Object.fromEntries(OUTFIT_ITEMS.map(entry => {
    const [have, need] = measure(entry.need);
    return [entry.id, Object.freeze({ have: Math.min(have, need), need, unlocked: have >= need })];
  }));
}

// What the companion wears now: the chosen items that are open, one per place, in place order.
export function wornItems(friend = {}, options) {
  const progress = outfitProgress(friend, options), outfit = friend?.outfit ?? {};
  return OUTFIT_SLOTS.map(slot => byId[outfit[slot]]).filter(entry => entry && progress[entry.id].unlocked);
}

export const outfitItem = id => byId[id] ?? null;

export function validateCompanionOutfit(outfit) {
  if (!outfit || typeof outfit !== 'object' || Array.isArray(outfit)) throw new Error('Invalid companion outfit');
  for (const [slot, id] of Object.entries(outfit)) {
    if (!OUTFIT_SLOTS.includes(slot) || (id !== null && byId[id]?.slot !== slot)) throw new Error('Invalid companion outfit');
  }
}
