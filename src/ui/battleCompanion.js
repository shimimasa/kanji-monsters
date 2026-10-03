import { companionPortrait, element } from './adventureUI.js';
import { subscribe } from '../core/eventBus.js';
import { gotomonService } from '../minigames/gotomonService.js';
import { typeInfo } from '../minigames/gotomonTypes.js';

// ゴトモン拡張を 本編バトルにも (2026-10-03): the companion chosen in the mini-game square watches the
// battle from a corner, wearing its しんか / 色ちがい / かがやき / きせかえ. When the type matchup makes a
// right answer stronger (battleMatchup.js publishes 'battle:companionCheer'), it lights up and cheers.
// Display only: it is a layer over the canvas that takes no clicks; the battle screen is untouched.
let layer = null, cheerTimer = null, placeTimer = null;

export function showBattleCompanion(doc = globalThis.document) {
  hideBattleCompanion();
  let companion = null;
  try { companion = gotomonService.getSelectedGotomon(); } catch { companion = null; }
  if (!companion || !doc?.body) return null;
  layer = element(doc, 'div', 'yt-battle-companion');
  layer.setAttribute('aria-hidden', 'true');
  Object.assign(layer.style, { position: 'fixed', left: '10px', top: '40%', width: '84px', zIndex: '50',
    pointerEvents: 'none', display: 'grid', justifyItems: 'center', gap: '2px', transition: 'transform .2s' });
  const portrait = companionPortrait(doc, companion, 'yt-battle-companion-face');
  Object.assign(portrait.style, { position: 'relative', left: 'auto', bottom: 'auto', width: '72px', height: '72px',
    display: 'inline-flex', filter: 'drop-shadow(0 3px 0 #0006)' });
  const bubble = element(doc, 'span', 'yt-battle-companion-cheer');
  Object.assign(bubble.style, { visibility: 'hidden', background: '#fff8d6', color: '#5a3b00', border: '2px solid #ffc93c',
    borderRadius: '10px', padding: '1px 6px', fontSize: '12px', fontWeight: '700', whiteSpace: 'nowrap' });
  const name = element(doc, 'span', '', companion.name);
  Object.assign(name.style, { fontSize: '11px', color: '#fff', textShadow: '0 1px 2px #000', maxWidth: '84px',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
  layer.append(bubble, portrait, name);
  layer.dataset.type = companion.type ?? 'odd';
  layer._bubble = bubble; layer._portrait = portrait;
  doc.body.append(layer);
  place(doc);
  placeTimer = setInterval(() => place(doc), 500); // follows the canvas when the window is resized or rotated
  return layer;
}

// Beside the battle canvas when there is room (it covers nothing), else inside it on the left of the
// scenery, below the もどる button and above the player's box and the answer area.
function place(doc) {
  const canvas = doc.getElementById?.('gameCanvas');
  if (!layer || !canvas?.getBoundingClientRect) return;
  const box = canvas.getBoundingClientRect();
  if (!box.width) return;
  const outside = box.left >= 100;
  layer.style.left = `${Math.round(outside ? box.left - 92 : box.left + 8)}px`;
  layer.style.top = `${Math.round(box.top + box.height * (outside ? 0.5 : 0.3))}px`;
}

export function hideBattleCompanion() {
  clearTimeout(cheerTimer); cheerTimer = null; clearInterval(placeTimer); placeTimer = null;
  layer?.remove(); layer = null;
}

function cheer({ factor } = {}) {
  if (!layer) return;
  const bubble = layer._bubble, portrait = layer._portrait;
  bubble.textContent = `${typeInfo(layer.dataset.type).name}パワー！ ×${factor}`;
  bubble.style.visibility = 'visible';
  layer.style.transform = 'translateY(-8px) scale(1.08)';
  portrait.style.filter = 'drop-shadow(0 0 6px #ffe066) drop-shadow(0 0 12px #ffb000)';
  clearTimeout(cheerTimer);
  cheerTimer = setTimeout(() => {
    if (!layer) return;
    bubble.style.visibility = 'hidden'; layer.style.transform = ''; portrait.style.filter = 'drop-shadow(0 3px 0 #0006)';
  }, 1400);
}
subscribe('battle:companionCheer', cheer);
