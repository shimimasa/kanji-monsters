import { companionPortrait, element } from './adventureUI.js';
import { subscribe } from '../core/eventBus.js';
import { gotomonService } from '../minigames/gotomonService.js';
import { typeInfo } from '../minigames/gotomonTypes.js';
import { BTN, PREV_KANJI_PANEL_BOTTOM } from '../screens/battle/theme.js';
import { isPortraitCanvas, PORTRAIT_LAYOUT } from '../screens/battle/portraitLayout.js';

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

// Where it covers nothing: beside the battle canvas when there is room, else above it, else inside it
// on the left between the 「1つまえの漢字」 panel and the れんしゅうへ button, shrunk to fit.
// (2026-10-04: inside used to be 30% down, right over the 「1つまえの漢字」 panel and れんしゅうへ.)
function place(doc) {
  const canvas = doc.getElementById?.('gameCanvas');
  if (!layer || !canvas?.getBoundingClientRect) return;
  const box = canvas.getBoundingClientRect();
  if (!box.width) return;
  setFaceSize(72);
  const height = layer.offsetHeight || 110;
  if (isPortraitCanvas(canvas)) {
    // スマホを たてに 持った時: 出題の 漢字の 右の 空き（portraitLayout.js）
    const scale = box.width / canvas.width, spot = PORTRAIT_LAYOUT.companion;
    setFaceSize(Math.max(40, Math.min(72, Math.floor(120 * scale) - 24)));
    layer.style.left = `${Math.round(box.left + spot.x * scale)}px`;
    layer.style.top = `${Math.round(box.top + spot.y * scale)}px`;
    return;
  }
  if (box.left >= 100) {
    layer.style.left = `${Math.round(box.left - 92)}px`;
    layer.style.top = `${Math.round(box.top + box.height * 0.5)}px`;
    return;
  }
  layer.style.left = `${Math.round(box.left + 8)}px`;
  if (box.top >= height + 8) {
    layer.style.top = `${Math.round(box.top - height - 4)}px`;
    return;
  }
  const scale = box.width / (canvas.width || 800);
  const top = PREV_KANJI_PANEL_BOTTOM + 8;
  const practiceTop = BTN.practice.y > top ? BTN.practice.y : (canvas.height || 600) - 150;
  const room = (practiceTop - 6 - top) * scale;
  // 吹き出しと名前のぶん（height - 72）を引いた残りに 顔を収める（小さくても 32px）
  setFaceSize(Math.max(32, Math.min(72, Math.floor(room - (height - 72)))));
  layer.style.top = `${Math.round(box.top + top * scale)}px`;
}

function setFaceSize(px) {
  const portrait = layer?._portrait;
  if (!portrait || portrait.style.width === `${px}px`) return;
  portrait.style.width = `${px}px`; portrait.style.height = `${px}px`;
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
