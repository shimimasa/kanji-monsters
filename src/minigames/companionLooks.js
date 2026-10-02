// すがた (ゴトモン拡張の第4弾, 2026-10-02): 色ちがい and かがやき, no new pictures.
// 色ちがい opens with this Gotomon's own 10 gold stickers and shifts its picture's colours by a hue fixed
// for that Gotomon (not random). かがやき opens at Lv10 and adds light around it. Both are read from
// records that never go down (gold stays gold, XP never drops), so once open they stay open.
// The child turns each on or off in the sticker book; the choice is saved as companions[id].look.
import { stickerSummary } from './companionStickers.js';
import { growthStatus } from './companionGrowth.js';
import { EVOLVED_IDS } from './evolvedIds.js';

export const SHINY_GOLD = 10;
export const GLOW_LEVEL = 10;
// しんか (第5弾): a new picture made with Codex, for the Gotomon that have one, from Lv5. Turned on and off
// like the others, so the child can always go back to the first look.
export const EVOLVE_LEVEL = 5;
const EVOLVED = new Set(EVOLVED_IDS);
export const canEvolve = id => EVOLVED.has(id);
export const evolvedImageUrl = id => `/assets/images/monsters/evo/${id}.webp`;
const HUES = Object.freeze([110, 150, 190, 230, 270]);

// The same hue every time for the same Gotomon.
export function shinyHue(id = '') {
  let sum = 0;
  for (const char of String(id)) sum = (sum * 31 + char.charCodeAt(0)) % 9973;
  return HUES[sum % HUES.length];
}

export function lookProgress(friend, id = null) {
  const gold = stickerSummary(friend?.stickers).gold, level = growthStatus(friend).level;
  return Object.freeze({
    // null when this Gotomon has no evolved picture (nothing to show or open).
    evolve: canEvolve(id) ? Object.freeze({ unlocked: level >= EVOLVE_LEVEL, have: level, need: EVOLVE_LEVEL }) : null,
    shiny: Object.freeze({ unlocked: gold >= SHINY_GOLD, have: Math.min(gold, SHINY_GOLD), need: SHINY_GOLD }),
    glow: Object.freeze({ unlocked: level >= GLOW_LEVEL, have: level, need: GLOW_LEVEL }),
  });
}

// What it shows now: only what is both chosen and open.
export function wornLook(friend, id) {
  const open = lookProgress(friend, id), look = friend?.look ?? {};
  return Object.freeze({ shiny: !!look.shiny && open.shiny.unlocked, glow: !!look.glow && open.glow.unlocked,
    evolve: !!look.evolve && !!open.evolve?.unlocked, hue: shinyHue(id) });
}

// Which looks a run opened (for the result screen).
export const LOOK_KEYS = Object.freeze(['evolve', 'shiny', 'glow']);
export const openedLooks = (before, after) => LOOK_KEYS.filter(key => after[key]?.unlocked && !before[key]?.unlocked);
export const LOOK_NAMES = Object.freeze({ evolve: 'しんか', shiny: '色ちがい', glow: 'かがやき' });

export function validateCompanionLook(look) {
  if (!look || typeof look !== 'object' || Array.isArray(look) ||
      Object.entries(look).some(([key, value]) => !LOOK_KEYS.includes(key) || typeof value !== 'boolean')) throw new Error('Invalid companion look');
}
