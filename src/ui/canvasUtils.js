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
/** タブの 並び。rows=2 で 2段（スマホを たてに 持った時の 480幅の 盤面） */
export function tabGeometry(tabCount, canvasWidth, rows = 1) {
  const perRow = Math.ceil(tabCount / rows);
  return { perRow, tabW: canvasWidth / perRow, tabH: rows > 1 ? 50 : 60, height: (rows > 1 ? 50 : 60) * rows };
}

/** タブの どれを 押したか（無ければ -1） */
export function tabIndexAt(x, y, tabCount, canvasWidth, rows = 1) {
  const { perRow, tabW, tabH, height } = tabGeometry(tabCount, canvasWidth, rows);
  if (y < 0 || y > height) return -1;
  const index = Math.min(rows - 1, Math.floor(y / tabH)) * perRow + Math.floor(x / tabW);
  return index >= 0 && index < tabCount ? index : -1;
}

export function drawEnhancedTabs(ctx, tabs, selectedValue, canvasWidth, animationTime, resolvers) {
  // getProgress（任意）: { pct, isNext, locked } を返すと、タブの下に達成率の棒・「つぎ」の印・🔒を出す
  // rows（任意）: 2 で 2段に 並べる（スマホを たてに 持った時）
  const { getKey, getIcon, getSubText, isReviewTab, getProgress, rows = 1 } = resolvers;
  const tabCount = tabs.length;
  const { perRow, tabW, tabH, height } = tabGeometry(tabCount, canvasWidth, rows);

  // 背景グラデーション
  const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
  bgGradient.addColorStop(0, '#2d3748');
  bgGradient.addColorStop(1, '#1a202c');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, canvasWidth, height);

  tabs.forEach((tab, i) => {
    const x0 = (i % perRow) * tabW;
    const rowY = Math.floor(i / perRow) * tabH;
    const isSelected = (getKey(tab) === selectedValue);

    // タブの基本形状
    const cornerRadius = 8;
    const insetY = isSelected ? 0 : 8;
    const insetH = isSelected ? tabH : tabH - 8;

    ctx.save();
    ctx.translate(0, rowY); // 2段めは 下へ

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

    const progress = getProgress ? getProgress(tab) : null;
    const icon = progress?.locked ? '🔒' : getIcon(tab);
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
        ctx.font = progress ? '11px "UDデジタル教科書体", sans-serif' : '10px "UDデジタル教科書体", sans-serif';
        ctx.fillStyle = isSelected ? 'rgba(255, 255, 255, 0.85)' : 'rgba(226, 232, 240, 0.75)';
        ctx.fillText(subText, centerX, centerY + (progress ? 14 : 16));
      }
    }

    // 達成率の棒（タブの下の端）と「つぎ」の印
    if (progress && !isReviewTab(tab)) {
      const barX = x0 + 10, barW = tabW - 20, barY = insetY + insetH - 7;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(barX, barY, barW, 4);
      ctx.fillStyle = progress.pct >= 100 ? '#f6c945' : '#48bb78';
      ctx.fillRect(barX, barY, Math.round(barW * Math.max(0, Math.min(100, progress.pct)) / 100), 4);
      if (progress.isNext) {
        ctx.font = 'bold 10px "UDデジタル教科書体", sans-serif';
        const label = 'つぎ', w = ctx.measureText(label).width + 8;
        ctx.fillStyle = '#e53e3e';
        drawRoundedRect(ctx, x0 + tabW - w - 4, insetY + 2, w, 14, 6);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, x0 + tabW - w / 2 - 4, insetY + 9);
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
  ctx.fillRect(0, height, canvasWidth, 3);
  ctx.restore();
}
