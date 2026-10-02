// すがた (ゴトモン拡張の第4弾, 2026-10-02): 色ちがい and かがやき, no new pictures.
// 色ちがい opens with this Gotomon's own 10 gold stickers and shifts its picture's colours by a hue fixed
// for that Gotomon (not random). かがやき opens at Lv10 and adds light around it. Both are read from
// records that never go down (gold stays gold, XP never drops), so once open they stay open.
// The child turns each on or off in the sticker book; the choice is saved as companions[id].look.
import { stickerSummary } from './companionStickers.js';
import { growthStatus } from './companionGrowth.js';

export const SHINY_GOLD = 10;
export const GLOW_LEVEL = 10;
const HUES = Object.freeze([110, 150, 190, 230, 270]);

// The same hue every time for the same Gotomon.
export function shinyHue(id = '') {
  let sum = 0;
  for (const char of String(id)) sum = (sum * 31 + char.charCodeAt(0)) % 9973;
  return HUES[sum % HUES.length];
}

export function lookProgress(friend) {
  const gold = stickerSummary(friend?.stickers).gold, level = growthStatus(friend).level;
  return Object.freeze({
    shiny: Object.freeze({ unlocked: gold >= SHINY_GOLD, have: Math.min(gold, SHINY_GOLD), need: SHINY_GOLD }),
    glow: Object.freeze({ unlocked: level >= GLOW_LEVEL, have: level, need: GLOW_LEVEL }),
  });
}

// What it shows now: only what is both chosen and open.
export function wornLook(friend, id) {
  const open = lookProgress(friend), look = friend?.look ?? {};
  return Object.freeze({ shiny: !!look.shiny && open.shiny.unlocked, glow: !!look.glow && open.glow.unlocked, hue: shinyHue(id) });
}

// Which looks a run opened (for the result screen).
export const openedLooks = (before, after) => ['shiny', 'glow'].filter(key => after[key].unlocked && !before[key].unlocked);
export const LOOK_NAMES = Object.freeze({ shiny: '色ちがい', glow: 'かがやき' });

export function validateCompanionLook(look) {
  if (!look || typeof look !== 'object' || Array.isArray(look) ||
      Object.entries(look).some(([key, value]) => !['shiny', 'glow'].includes(key) || typeof value !== 'boolean')) throw new Error('Invalid companion look');
}
