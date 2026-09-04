// src/ui/palette.js
//
// 「色だけで意味を伝えている場所」の色を1箇所にまとめる。
//
// なぜ要るか:
//   HPバーの 緑→橙→赤 や、かいふくの残り回数の 緑／赤 は、赤と緑の
//   区別がつきにくい子には同じに見える。数字は横に出ているので全部が
//   伝わらなくなるわけではないが、ひと目で分かる情報が減る。
//   保存の器（krb_save の settings.cbMode）は前からあったが、
//   切り替える場所も効き目も無かった。
//
// どこまでやるか:
//   画面じゅうの色を塗り替えるのではなく、「色が状態そのものを指している」
//   ところだけを通す。装飾の色（ボタンの選択中の赤、コンボの色など）は
//   意味を担っていないのでそのまま。
//
// 色の選び方:
//   色覚特性があっても見分けやすいことが確かめられている配色（Okabe-Ito）から、
//   空色・橙・赤紫の3色を使う。緑と赤のように「同じ明るさで色相だけ違う」組を避ける。

const STORAGE_KEY = 'cbMode';

// NOTE: 描画のたびに参照するので localStorage は読みに行かない
//       （textScale.js で同じ作りにした時、毎フレームの同期読み取りで
//        ページが固まったため）。
let cbCache = null;

function readFromStorage() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** 見分けやすい配色になっているか */
export function isColorBlindMode() {
  if (cbCache === null) cbCache = readFromStorage();
  return cbCache;
}

/** 外から localStorage を書き換えた時（セーブの読み込みなど）に呼ぶ */
export function refresh() {
  cbCache = readFromStorage();
}

export function setColorBlindMode(on) {
  try { localStorage.setItem(STORAGE_KEY, on ? '1' : '0'); } catch {}
  cbCache = !!on;
}

const DEFAULT_PALETTE = {
  good: '#2ecc71',   // 緑
  warn: '#f39c12',   // 橙
  danger: '#e74c3c'  // 赤
};

const COLORBLIND_PALETTE = {
  good: '#56B4E9',   // 空色
  warn: '#E69F00',   // 橙
  danger: '#CC79A7'  // 赤紫
};

function palette() {
  return isColorBlindMode() ? COLORBLIND_PALETTE : DEFAULT_PALETTE;
}

/**
 * 残量（0〜1）を表す色。HPバー・タイマーバーなど。
 * @param {number} ratio 0〜1
 * @param {number} [warnAt=0.5] ここを下回ると「注意」の色
 * @param {number} [dangerAt=0.2] ここを下回ると「あぶない」の色
 */
export function gaugeColor(ratio, warnAt = 0.5, dangerAt = 0.2) {
  const p = palette();
  if (ratio > warnAt) return p.good;
  if (ratio > dangerAt) return p.warn;
  return p.danger;
}

/** 「まだある／もう無い」の2値を表す色。かいふくの残り回数など。 */
export function availabilityColor(available) {
  const p = palette();
  return available ? p.good : p.danger;
}

export default { isColorBlindMode, setColorBlindMode, refresh, gaugeColor, availabilityColor };
