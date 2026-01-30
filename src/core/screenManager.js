// src/core/screenManager.js
// グローバル FSM への委譲ラッパーモジュール

let canvas = null;

/**
 * <canvas> 要素を登録
 */
export function setCanvas(c) {
  canvas = c;
}

/**
 * P0-1(設計憲法A): 画面遷移の入口は setupFSM に一本化する。
 * screenManager は遷移（changeScreen）の購読や payload 解釈を持たず、
 * update/render などの画面ライフサイクル委譲のみに責務を限定する。
 */

/**
 * 毎フレーム呼び出すロジック更新
 * @param {number} dt
 */
export function update(dt) {
  if (window.fsm && typeof window.fsm.update === 'function') {
    window.fsm.update(dt);
  }
}

/**
 * 毎フレーム呼び出す描画
 * @param {Function} [battleDrawFn] battle 画面の場合のみ外部描画関数を注入
 */
export function render(battleDrawFn = null) {
  if (window.fsm && typeof window.fsm.render === 'function') {
    window.fsm.render(battleDrawFn);
  }
}
