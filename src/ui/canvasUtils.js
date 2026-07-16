// src/ui/canvasUtils.js
// 選択画面4種＋バトル画面に散在していたCanvas描画ヘルパーの共通実装。
// （refactoring-plan Phase 4-1: 完全同一実装の抽出。挙動変化なし）

/**
 * 角丸矩形のパスを構築する（fill/stroke は呼び出し側で行う）
 */
export function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * 画面上部のタブ列を描画する（学年タブ・漢検級タブの共通実装）
 *
 * stageSelectScreen（学年）と worldStageSelectScreen（漢検級）にあった
 * 98%同一の drawEnhancedTabs を、差分だけ resolvers として注入する形に統合。
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} tabs タブ定義の配列（label と、getKey が読むキーを持つ）
 * @param {*} selectedValue 選択中タブのキー値
 * @param {number} canvasWidth
 * @param {number} animationTime パルス演出用の経過時間
 * @param {Object} resolvers 画面ごとの差分
 * @param {(tab) => *} resolvers.getKey 選択比較に使うキーを返す
 * @param {(tab) => string} resolvers.getIcon タブのアイコン文字を返す
 * @param {(tab) => string} resolvers.getSubText サブラベル（地方名/大陸名）を返す
 * @param {(tab) => boolean} resolvers.isReviewTab 総復習タブかどうか
 */
export function drawEnhancedTabs(ctx, tabs, selectedValue, canvasWidth, animationTime, resolvers) {
  const { getKey, getIcon, getSubText, isReviewTab } = resolvers;
  const tabCount = tabs.length;
  const tabW = canvasWidth / tabCount;
  const tabH = 60; // 高さを増加

  // 背景グラデーション
  const bgGradient = ctx.createLinearGradient(0, 0, 0, tabH);
  bgGradient.addColorStop(0, '#2d3748');
  bgGradient.addColorStop(1, '#1a202c');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, canvasWidth, tabH);

  tabs.forEach((tab, i) => {
    const x0 = i * tabW;
    const isSelected = (getKey(tab) === selectedValue);

    // タブの基本形状
    const cornerRadius = 8;
    const insetY = isSelected ? 0 : 8;
    const insetH = isSelected ? tabH : tabH - 8;

    ctx.save();

    // 選択中タブの背景
    if (isSelected) {
      // 光るエフェクト
      const glowGradient = ctx.createRadialGradient(
        x0 + tabW/2, tabH/2, 0,
        x0 + tabW/2, tabH/2, tabW/2
      );
      glowGradient.addColorStop(0, 'rgba(66, 153, 225, 0.3)');
      glowGradient.addColorStop(1, 'rgba(66, 153, 225, 0)');
      ctx.fillStyle = glowGradient;
      ctx.fillRect(x0, 0, tabW, tabH);

      // メインの背景グラデーション
      const selectedGradient = ctx.createLinearGradient(x0, insetY, x0, insetY + insetH);
      selectedGradient.addColorStop(0, '#4299e1');
      selectedGradient.addColorStop(0.5, '#3182ce');
      selectedGradient.addColorStop(1, '#2b6cb0');
      ctx.fillStyle = selectedGradient;
    } else {
      // 非選択タブの背景
      const unselectedGradient = ctx.createLinearGradient(x0, insetY, x0, insetY + insetH);
      unselectedGradient.addColorStop(0, '#4a5568');
      unselectedGradient.addColorStop(1, '#2d3748');
      ctx.fillStyle = unselectedGradient;
    }

    // 角丸矩形を描画
    drawRoundedRect(ctx, x0 + 2, insetY, tabW - 4, insetH, cornerRadius);
    ctx.fill();

    // 枠線
    if (isSelected) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 内側の光る枠線
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      drawRoundedRect(ctx, x0 + 3, insetY + 1, tabW - 6, insetH - 2, cornerRadius - 1);
      ctx.stroke();
    }

    // アイコンとテキスト
    const centerX = x0 + tabW / 2;
    const centerY = insetY + insetH / 2;

    const icon = getIcon(tab);
    const mainText = tab.label;
    const subText = getSubText(tab);

    // アイコンの描画
    if (icon && !isReviewTab(tab)) {
      ctx.font = isSelected ? '20px sans-serif' : '16px sans-serif';
      ctx.fillStyle = isSelected ? '#ffffff' : '#cbd5e0';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, centerX, centerY - 12);
    }

    // メインテキスト
    ctx.font = isSelected ? 'bold 16px "UDデジタル教科書体", sans-serif' : '14px "UDデジタル教科書体", sans-serif';
    ctx.fillStyle = isSelected ? '#ffffff' : '#e2e8f0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (isReviewTab(tab)) {
      // 総復習タブは特別デザイン
      ctx.fillStyle = isSelected ? '#ffd700' : '#f7fafc';
      ctx.fillText('🔄 ' + mainText, centerX, centerY);
    } else {
      ctx.fillText(mainText, centerX, centerY + 2);

      // サブテキスト
      if (subText) {
        ctx.font = '10px "UDデジタル教科書体", sans-serif';
        ctx.fillStyle = isSelected ? 'rgba(255, 255, 255, 0.8)' : 'rgba(226, 232, 240, 0.7)';
        ctx.fillText(subText, centerX, centerY + 16);
      }
    }

    // 選択中タブの下部ハイライト
    if (isSelected) {
      const highlightGradient = ctx.createLinearGradient(x0, tabH - 4, x0, tabH);
      highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
      highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
      ctx.fillStyle = highlightGradient;
      ctx.fillRect(x0 + 2, tabH - 4, tabW - 4, 4);
    }

    // アニメーション効果（パルス）
    if (isSelected) {
      const pulse = Math.sin(animationTime * 0.003) * 0.1 + 0.9;
      ctx.globalAlpha = pulse;
      const pulseGradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, tabW / 3
      );
      pulseGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
      pulseGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = pulseGradient;
      ctx.fillRect(x0, insetY, tabW, insetH);
    }

    ctx.restore();
  });

  // 全体の影
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.fillRect(0, tabH, canvasWidth, 3);
  ctx.restore();
}
