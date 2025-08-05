// src/uiRenderer.js
//
// ボタン／テキスト／ゲージなど「Canvas UI を描くだけ」のユーティリティ。
// クリック判定に必要な矩形は「呼び出し元が管理する」のが基本方針。

/* ------------------------------------------------------------------ */
/*  ボタン                                                             */
/* ------------------------------------------------------------------ */

/**
 * 矩形ボタンを描画する
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {string} label
 * @param {string} [fill='#2980b9']
 */
export function drawButton(ctx, x, y, width, height, label, fill = '#2980b9') {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, width, height);

  ctx.fillStyle = 'white';
  ctx.font = '18px "UDデジタル教科書体", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + width / 2, y + height / 2);
}

/**
 * マウス座標が矩形内かどうか  
 * rect = { x, y, width, height } でも { x, y, w, h } でも OK
 */
export function isMouseOverRect(mouseX, mouseY, rect) {
  if (!rect) return false;
  const w = rect.width ?? rect.w;
  const h = rect.height ?? rect.h;
  return mouseX >= rect.x && mouseX <= rect.x + w &&
         mouseY >= rect.y && mouseY <= rect.y + h;
}

/* ------------------------------------------------------------------ */
/*  汎用テキスト                                                       */
/* ------------------------------------------------------------------ */

export function drawText(ctx, text, x, y, font = '20px sans-serif', color = 'white', align = 'left') {
  ctx.font = font.replace(/(\d+px)\s+.+$/, `$1 "UDデジタル教科書体", sans-serif`);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillText(text, x, y);
}

/* ------------------------------------------------------------------ */
/*  ゲージ（HP など簡易版）                                            */
/* ------------------------------------------------------------------ */

/**
 * シンプルな横ゲージ
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} value - 0〜1 の割合
 * @param {string} [fill='#27ae60']
 */
export function drawGauge(ctx, x, y, w, h, value, fill = '#27ae60') {
  ctx.fillStyle = '#555';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, value)), h);
}

/**
 * 石のようなテクスチャのボタンを描画する
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {string} label
 * @param {boolean} isHovered
 * @param {boolean} isPressed
 */
export function drawStoneButton(ctx, x, y, width, height, label, isHovered = false, isPressed = false) {
  // 押下状態の表現を追加
  const pressOffset = isPressed ? 2 : 0;
  const shadowOffset = isHovered ? 4 : (isPressed ? 1 : 3);
  
  // 押下時は少し沈み込む表現
  const adjustedY = y + pressOffset;
  
  // 影の描画
  ctx.fillStyle = `rgba(0, 0, 0, ${isPressed ? 0.2 : 0.3})`;
  ctx.fillRect(x + shadowOffset, adjustedY + shadowOffset, width, height);
  
  // ボタン本体の色（押下時は少し暗く）
  const baseColor = '#6d6d6d';
  const buttonColor = isPressed ? darkenColor(baseColor, 10) : baseColor;
  
  // ホバー時のカラー調整
  const hoverColor = isHovered ? lightenColor(baseColor, 15) : buttonColor;
  
  // グラデーション背景を作成
  const gradient = ctx.createLinearGradient(x, adjustedY, x, adjustedY + height);
  gradient.addColorStop(0, lightenColor(hoverColor, 20)); // 上部を明るく
  gradient.addColorStop(1, darkenColor(hoverColor, 20));  // 下部を暗く
  
  // ボタン本体を描画
  ctx.fillStyle = gradient;
  ctx.fillRect(x, adjustedY, width, height);
  
  // 枠線を描画
  ctx.strokeStyle = darkenColor(hoverColor, 30);
  ctx.lineWidth = isHovered ? 3 : 2; // ホバー時は枠線を太く
  ctx.strokeRect(x, adjustedY, width, height);
  
  // テキストを描画
  ctx.fillStyle = 'white';
  ctx.font = '18px "UDデジタル教科書体", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + width / 2, adjustedY + height / 2);
}

/**
 * 色を明るくするヘルパー関数
 */
function lightenColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

/**
 * 色を暗くするヘルパー関数
 */
function darkenColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) - amt;
  const G = (num >> 8 & 0x00FF) - amt;
  const B = (num & 0x0000FF) - amt;
  return '#' + (0x1000000 + (R > 255 ? 255 : R < 0 ? 0 : R) * 0x10000 +
    (G > 255 ? 255 : G < 0 ? 0 : G) * 0x100 +
    (B > 255 ? 255 : B < 0 ? 0 : B)).toString(16).slice(1);
}

/* ------------------------------------------------------------------ */
/*  パネル背景                                                         */
/* ------------------------------------------------------------------ */

/**
 * テーマ性のある背景を描画する
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 */
export function drawThemeBackground(ctx, width, height) {
  // グラデーション背景
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#2c3e50');
  gradient.addColorStop(0.5, '#34495e');
  gradient.addColorStop(1, '#2c3e50');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  // 装飾的なパターンを追加
  ctx.fillStyle = 'rgba(52, 152, 219, 0.1)';
  for (let i = 0; i < width; i += 50) {
    for (let j = 0; j < height; j += 50) {
      ctx.fillRect(i, j, 2, 2);
    }
  }
}

/**
 * 設定パネルの背景を描画する
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {string} [title='']
 */
export function drawPanelBackground(ctx, x, y, width, height, title = '') {
  // パネルの影
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(x + 5, y + 5, width, height);
  
  // パネルの背景
  const gradient = ctx.createLinearGradient(x, y, x, y + height);
  gradient.addColorStop(0, 'rgba(241, 196, 15, 0.9)');
  gradient.addColorStop(1, 'rgba(230, 126, 34, 0.8)');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);
  
  // パネルの枠線
  ctx.strokeStyle = '#8B4513';
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, width, height);
  
  // タイトルがある場合は描画
  if (title) {
    ctx.fillStyle = '#2c3e50';
    ctx.font = '24px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(title, x + width / 2, y + 15);
  }
}
