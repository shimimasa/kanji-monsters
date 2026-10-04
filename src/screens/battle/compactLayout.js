// src/screens/battle/compactLayout.js
// バトル画面の「せまい画面（compact）」の置き場所と、読みちがいの「こたえ」札。
//
// 直したこと:
// 1. Chromebook や iPad の横向きでは 50音パッドのぶん盤面が 0.6倍ほどに縮み、ボタンが下の端に
//    並ぶ。そこには会話ログと自分のHPパネルがあり、ログは完全に、HPは半分隠れていた。
//    → ボタンと入力欄を右側（HPパネルの横）にまとめ、ログは石版の下・入力欄の左上の空きへ置く。
// 2. 読みちがいの時の正しい読みはログにしか出ず、1.3秒で敵のこうげきの文に置きかわっていた。
//    → 石版のすぐ下に大きな札で出し、次の問題が出るまで消さない。
import { gameState } from '../../core/gameState.js';
import { getReadingsOf } from '../../utils/readings.js';
import { getContainedRect } from '../../ui/viewportLayout.js';
import { drawRoundedRect } from '../../ui/canvasUtils.js';
import { BTN, COMPACT_BATTLE_AREA } from './theme.js';

const TOGGLE_ID = 'kanaPadToggle'; // ui/kanaPad.js の「たんまつで書く」ボタン

function contentOf(canvas) {
  const rect = canvas?.getBoundingClientRect?.();
  return rect && rect.width ? getContainedRect(rect, canvas.width, canvas.height) : null;
}

/** 画面の要素の位置を、盤面（800×600）の座標にする */
function toGame(content, r) {
  if (!content || !r || !r.width) return null;
  return { x: (r.left - content.left) / content.scale, y: (r.top - content.top) / content.scale,
    w: r.width / content.scale, h: r.height / content.scale };
}

/** 入力欄を、こうげき・かいふく・ヒントの上（右側）に置く。真ん中だとHPパネルに重なる */
export function placeCompactBattleInput(canvas, input) {
  const content = contentOf(canvas);
  if (!content || !input) return;
  const { left, right } = COMPACT_BATTLE_AREA;
  const width = Math.min(320, (right - left) * content.scale - 8);
  const centerX = content.left + ((left + right) / 2) * content.scale;
  input.style.width = `${Math.round(width)}px`;
  input.style.left = `${Math.round(centerX - width / 2)}px`;
}

/**
 * せまい画面のログの枠: 石版の下・入力欄の上・「たんまつで書く」（入力欄の右上）の左。
 * 左はHPパネルと同じ x=20。上は石版の下端より上にしない（3行の時だけ少し詰まる）。
 * @returns {{x:number, y:number, w:number}}
 */
export function compactLogBox(screen, height) {
  const canvas = screen.canvas;
  const content = contentOf(canvas);
  const inputBox = toGame(content, screen.inputEl?.getBoundingClientRect?.());
  const toggleEl = document.getElementById(TOGGLE_ID);
  const toggleBox = toggleEl && !toggleEl.hidden ? toGame(content, toggleEl.getBoundingClientRect()) : null;
  const { centerY, height: kanjiH } = screen.getKanjiBoxMetrics();
  const bottom = (inputBox ? inputBox.y : BTN.attack.y) - 8;
  const y = Math.max(centerY + kanjiH / 2, bottom - height);
  const right = toggleBox && toggleBox.y + toggleBox.h > y ? toggleBox.x - 10 : canvas.width - 12;
  return { x: 20, y, w: Math.max(300, right - 20) };
}

export function showAnswerReveal(screen, kanji) {
  if (!kanji) { clearAnswerReveal(screen); return; }
  screen.answerReveal = {
    kanjiId: kanji.id,
    onyomi: getReadingsOf(kanji, 'onyomi'),
    kunyomi: getReadingsOf(kanji, 'kunyomi'),
  };
}

export function clearAnswerReveal(screen) {
  if (!screen) return;
  screen.answerReveal = null;
  const toggleEl = document.getElementById(TOGGLE_ID);
  if (toggleEl) toggleEl.style.visibility = '';
}

/** 「こたえ　音 きゅう　訓 やす」の札。石版の下端に少しかけて置く（ログより上に重ねる） */
export function drawAnswerReveal(screen, ctx, controls) {
  const reveal = screen.answerReveal;
  const toggleEl = document.getElementById(TOGGLE_ID);
  const visible = !!(reveal && gameState.currentKanji && gameState.currentKanji.id === reveal.kanjiId);
  // 「たんまつで書く」は石版の下に重なる場所にある。札を出している間は（入力もできないので）隠す
  if (toggleEl) toggleEl.style.visibility = visible ? 'hidden' : '';
  if (!visible) return;

  const parts = [
    { label: '音', text: reveal.onyomi.join('・'), color: '#c0392b' },
    { label: '訓', text: reveal.kunyomi.join('・'), color: '#1f6fb2' },
  ].filter(p => p.text);
  if (!parts.length) return;

  const canvas = screen.canvas;
  const { centerX, centerY, height: kh } = screen.getKanjiBoxMetrics();
  const maxW = canvas.width - 40;
  const titleText = 'こたえ';
  const font = (size) => `bold ${size}px "UDデジタル教科書体", sans-serif`;
  let fs = controls.compact ? Math.round(Math.max(26, 20 / controls.scale)) : 28;
  let layout;
  for (;; fs -= 2) {
    ctx.font = font(Math.round(fs * 0.7));
    const titleW = ctx.measureText(titleText).width;
    ctx.font = font(fs);
    const chip = fs * 1.15;
    const items = parts.map(p => ({ ...p, w: chip + fs * 0.3 + ctx.measureText(p.text).width }));
    const gap = fs * 0.9;
    const contentW = titleW + gap + items.reduce((s, it) => s + it.w, 0) + gap * (items.length - 1);
    layout = { titleW, chip, items, gap, contentW };
    if (contentW + fs * 1.2 <= maxW || fs <= 16) break;
  }
  const padX = fs * 0.6;
  const w = Math.min(maxW, layout.contentW + padX * 2);
  const h = fs + 22;
  const x = Math.max(20, Math.min(canvas.width - 20 - w, centerX - w / 2));
  const y = centerY + kh / 2 - 22;

  ctx.save();
  drawRoundedRect(ctx, x, y, w, h, 12);
  ctx.fillStyle = 'rgba(255, 248, 225, 0.97)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#f0ad4e';
  ctx.stroke();
  ctx.clip(); // 読みがとても多い字は 16px でも はみ出すので、札の中で切る

  const midY = y + h / 2;
  let cx = x + padX;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = font(Math.round(fs * 0.7));
  ctx.fillStyle = '#8a5a00';
  ctx.fillText(titleText, cx, midY);
  cx += layout.titleW + layout.gap;
  layout.items.forEach((it, i) => {
    const r = layout.chip / 2;
    ctx.beginPath();
    ctx.arc(cx + r, midY, r, 0, Math.PI * 2);
    ctx.fillStyle = it.color;
    ctx.fill();
    ctx.font = font(Math.round(fs * 0.7));
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(it.label, cx + r, midY + 1);
    ctx.font = font(fs);
    ctx.fillStyle = '#3b2a12';
    ctx.textAlign = 'left';
    ctx.fillText(it.text, cx + layout.chip + fs * 0.3, midY + 1);
    cx += it.w + (i < layout.items.length - 1 ? layout.gap : 0);
  });
  ctx.restore();
}
