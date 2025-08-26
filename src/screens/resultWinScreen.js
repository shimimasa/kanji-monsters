// src/resultWinScreen.js
// ステージクリア後の画面（Victory Screen）

import { publish } from '../core/eventBus.js';
import { drawButton, isMouseOverRect } from '../ui/uiRenderer.js';
import { gameState, battleState, recordStageCleared } from '../core/gameState.js';
import { checkAchievements } from '../core/achievementManager.js';
import { calcBonusReward, isFirstClear, markBonusFirstClear } from '../core/bonusManager.js';
import { getGameCoordinates, isValidCoordinates } from '../utils/coordinateUtils.js';

const nextStageButton = {
  x: 300,
  y: 480,
  width: 200,
  height: 50,
  text: 'ステージ選択へ'
};

const resultWinState = {
  canvas: null,
  ctx: null,
  _clickHandler: null,
  _mousemoveHandler: null,
  mouseX: 0,
  mouseY: 0,
  animationTime: 0, // アニメーション用タイマー
  resultData: null, // 結果データを保存
  bonusSummary: null, // 学年ボーナスの結果データを保持

  /** 画面表示時の初期化 */
  async enter(canvas, resultData) {
    // 結果データを保存
    this.resultData = resultData || {
      correct: gameState.correctKanjiList || [],
      wrong: gameState.wrongKanjiList || [],
      time: battleState.timeRemaining || 0,
      playerHp: gameState.playerStats.hp || 0
    };

    // ★ 追加: ここでステージクリアを確実に反映
    const stageId = this.resultData.stageId || gameState.currentStageId;
    if (stageId) {
      try {
        localStorage.setItem(`clear_${stageId}`, '1');
        if (!gameState.stageProgress) gameState.stageProgress = {};
        gameState.stageProgress[stageId] = { cleared: true };
      } catch (e) {
        console.warn('ステージクリア反映に失敗:', e);
      }
    }

    // 実績チェックを最初に実行
    try {
      await checkAchievements();
    } catch (error) {
      console.error('実績チェック中にエラーが発生しました:', error);
    }

    // クリア画面に入ったらクリアBGMを再生
    publish('playBGM', 'victory');
    
    // ステージクリアの統計データを更新
    recordStageCleared();
    gameState.playerStats.stagesCleared++;
    
    // パーフェクトクリア判定
    if (battleState.mistakesThisStage === 0) {
      gameState.justClearedPerfectly = true;
      console.log('🏆 パーフェクトクリア達成！');
    } else {
      gameState.justClearedPerfectly = false;
    }
    
    // キャンバスを取得
    this.canvas = canvas || document.getElementById('gameCanvas');
    if (!this.canvas) {
      console.error('キャンバス要素が見つかりません');
      return;
    }
    
    this.ctx = this.canvas.getContext('2d');
    
    // 勝利SEを再生
    publish('playSE', 'victory');
    
    // アニメーションタイマーを初期化
    this.animationTime = 0;

    this.bonusSummary = null;

    const bonusCheckId = stageId || gameState.currentStageId || '';
    const m = /^bonus_g(\d+)$/i.exec(bonusCheckId);
    if (m) {
      const grade = parseInt(m[1], 10);
      const fights = gameState.enemies?.length || 0;
      const cleared = fights; // クリア済み連戦数（勝利なので=fights）
      const total = (this.resultData.correct?.length || 0) + (this.resultData.wrong?.length || 0);
      const accuracyPct = total > 0 ? Math.floor((this.resultData.correct.length / total) * 100) : 100;
      const remHpPct = Math.floor((gameState.playerStats.hp / gameState.playerStats.maxHp) * 100);
      const firstClear = isFirstClear(grade);

      const result = calcBonusReward({ grade, fights, cleared, accuracyPct, remHpPct, firstClear });

      // 一括で経験値付与
      const { addPlayerExp } = await import('../core/gameState.js');
      addPlayerExp(result.xp);

      // 初回フラグ保存
      if (firstClear) markBonusFirstClear(grade);

      this.bonusSummary = { grade, fights, accuracyPct, remHpPct, ...result };
    }
    
    // イベントハンドラ登録
    this.registerHandlers();
  },

  /** 毎フレーム呼び出し（描画） */
  update(dt) {
    if (!this.ctx || !this.canvas) return;
    
    const { ctx, canvas } = this;
    this.animationTime += 16; // 約60FPSでアニメーション
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. 和紙風背景を描画
    this.drawParchmentBackground(ctx, canvas.width, canvas.height);

    // 2. 装飾的なタイトルを描画
    this.drawDecorativeTitle(ctx, canvas.width / 2, 120);

    // 3. パーフェクトクリア演出
    if (gameState.justClearedPerfectly) {
      this.drawPerfectClearCrown(ctx, canvas.width / 2 + 200, 80);
    }

        // 4. 結果表示パネル
        if (this.bonusSummary) {
          // 学年ボーナス専用のパネルのみ描画（通常パネルはスキップ）
          this.drawBonusResultPanel(ctx, canvas.width / 2 - 180, 200, 360, 210);
        } else {
          this.drawResultPanel(ctx, canvas.width / 2 - 150, 200, 300, 180);
        }
    
        // 5. リッチなボタン
        const isHovered = isMouseOverRect(this.mouseX, this.mouseY, nextStageButton);
        this.drawRichButton(ctx, nextStageButton, isHovered);
    
        // 6. 間違えた漢字の巻物風表示
        if (gameState.wrongKanjiList && gameState.wrongKanjiList.length > 0) {
          this.drawMistakeScrollPanel(ctx, 50, 420, 250, 150);
        }

   
  },

  /**
   * 和紙風の背景を描画
   */
  drawParchmentBackground(ctx, width, height) {
    ctx.save();
    
    // ベースの背景グラデーション
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, '#F5DEB3'); // クリーム色
    bgGradient.addColorStop(0.3, '#F0E68C'); // 明るいカーキ
    bgGradient.addColorStop(0.7, '#DDD8B8'); // ベージュ
    bgGradient.addColorStop(1, '#D2B48C'); // より濃いベージュ
    
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);
    
    // 和紙のテクスチャ効果（ランダムな点）
    ctx.fillStyle = 'rgba(139, 69, 19, 0.05)';
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const size = Math.random() * 3 + 1;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // 古い紙の汚れ効果
    ctx.fillStyle = 'rgba(160, 82, 45, 0.08)';
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const radius = Math.random() * 20 + 10;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // 縁の装飾（古文書風の境界線）
    ctx.strokeStyle = 'rgba(139, 69, 19, 0.3)';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, width - 20, height - 20);
    
    ctx.strokeStyle = 'rgba(160, 82, 45, 0.2)';
    ctx.lineWidth = 4;
    ctx.strokeRect(15, 15, width - 30, height - 30);
    
    ctx.restore();
  },

  /**
   * 装飾的なタイトルを描画
   */
  drawDecorativeTitle(ctx, centerX, centerY) {
    ctx.save();
    
    // リボン風の背景
    const ribbonWidth = 400;
    const ribbonHeight = 60;
    
    // リボンのグラデーション
    const ribbonGradient = ctx.createLinearGradient(
      centerX - ribbonWidth/2, centerY - ribbonHeight/2,
      centerX + ribbonWidth/2, centerY + ribbonHeight/2
    );
    ribbonGradient.addColorStop(0, '#DAA520'); // ゴールデンロッド
    ribbonGradient.addColorStop(0.5, '#FFD700'); // 金色
    ribbonGradient.addColorStop(1, '#B8860B'); // ダークゴールデンロッド
    
    // リボンの影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(centerX - ribbonWidth/2 + 5, centerY - ribbonHeight/2 + 5, ribbonWidth, ribbonHeight);
    
    // リボン本体
    ctx.fillStyle = ribbonGradient;
    ctx.fillRect(centerX - ribbonWidth/2, centerY - ribbonHeight/2, ribbonWidth, ribbonHeight);
    
    // リボンの縁取り
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 3;
    ctx.strokeRect(centerX - ribbonWidth/2, centerY - ribbonHeight/2, ribbonWidth, ribbonHeight);
    
    // タイトルテキスト
    ctx.font = 'bold 42px "UDデジタル教科書体", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // テキストの影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillText('ステージクリア！', centerX + 3, centerY + 3);
    
    // テキスト本体（金色のグラデーション）
    const textGradient = ctx.createLinearGradient(centerX, centerY - 20, centerX, centerY + 20);
    textGradient.addColorStop(0, '#FFFACD'); // レモンシフォン
    textGradient.addColorStop(0.5, '#FFD700'); // 金色
    textGradient.addColorStop(1, '#DAA520'); // ゴールデンロッド
    
    ctx.fillStyle = textGradient;
    ctx.fillText('ステージクリア！', centerX, centerY);
    
    // テキストの縁取り
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2;
    ctx.strokeText('ステージクリア！', centerX, centerY);
    
    // サブタイトル
    ctx.font = '24px "UDデジタル教科書体", sans-serif';
    ctx.fillStyle = '#8B4513';
    ctx.fillText('おめでとうございます！', centerX, centerY + 50);
    
    ctx.restore();
  },

  /**
   * パーフェクトクリア時の王冠を描画
   */
  drawPerfectClearCrown(ctx, x, y) {
    ctx.save();
    
    // 王冠のアニメーション（回転と脈動）
    const pulse = 1 + 0.1 * Math.sin(this.animationTime * 0.005);
    const rotation = this.animationTime * 0.002;
    
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale(pulse, pulse);
    
    // 王冠の影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.moveTo(2, 12);
    ctx.lineTo(-18, -8);
    ctx.lineTo(-8, -18);
    ctx.lineTo(2, -8);
    ctx.lineTo(12, -18);
    ctx.lineTo(22, -8);
    ctx.closePath();
    ctx.fill();
    
    // 王冠本体のグラデーション
    const crownGradient = ctx.createLinearGradient(0, -20, 0, 10);
    crownGradient.addColorStop(0, '#FFD700'); // 金色
    crownGradient.addColorStop(0.5, '#FFA500'); // オレンジ
    crownGradient.addColorStop(1, '#DAA520'); // ゴールデンロッド
    
    // 王冠の形
    ctx.fillStyle = crownGradient;
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.lineTo(-20, -10);
    ctx.lineTo(-10, -20);
    ctx.lineTo(0, -10);
    ctx.lineTo(10, -20);
    ctx.lineTo(20, -10);
    ctx.closePath();
    ctx.fill();
    
    // 王冠の縁取り
    ctx.strokeStyle = '#B8860B';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // 宝石（中央）
    ctx.fillStyle = '#FF1493'; // ディープピンク
    ctx.beginPath();
    ctx.arc(0, -5, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // 光る効果
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(-1, -7, 2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
    
    // 「PERFECT!」テキスト
    ctx.save();
    ctx.font = 'bold 20px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FF6347'; // トマト色
    ctx.fillText('PERFECT!', x, y + 40);
    ctx.restore();
  },

  /**
   * 結果表示パネルを描画
   */
  drawResultPanel(ctx, x, y, width, height) {
    ctx.save();
    
    // パネルの影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(x + 5, y + 5, width, height);
    
    // パネル背景（木目調）
    const panelGradient = ctx.createLinearGradient(x, y, x, y + height);
    panelGradient.addColorStop(0, '#DEB887'); // バーリーウッド
    panelGradient.addColorStop(0.5, '#D2B48C'); // タン
    panelGradient.addColorStop(1, '#BC9A6A'); // より暗いタン
    
    ctx.fillStyle = panelGradient;
    ctx.fillRect(x, y, width, height);
    
    // パネルの縁取り
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, width, height);
    
    // 内側の装飾線
    ctx.strokeStyle = '#A0522D';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 5, y + 5, width - 10, height - 10);
    
    // パネルタイトル
    ctx.font = 'bold 24px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8B4513';
    ctx.fillText('戦績', x + width/2, y + 30);
    
    // 結果データ
    const results = [
      `正解数: ${gameState.correctKanjiList ? gameState.correctKanjiList.length : 0}`,
      `間違い: ${gameState.wrongKanjiList ? gameState.wrongKanjiList.length : 0}`,
      `現在レベル: ${gameState.playerStats.level}`,
      `総ステージクリア: ${gameState.playerStats.stagesCleared}`
    ];
    
    ctx.font = '18px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#654321';
    
    results.forEach((text, index) => {
      ctx.fillText(text, x + 20, y + 70 + index * 25);
    });
    
    // パーフェクトクリアの場合の特別表示
    if (gameState.justClearedPerfectly) {
      ctx.font = 'bold 16px "UDデジタル教科書体", sans-serif';
      ctx.fillStyle = '#FF6347';
      ctx.textAlign = 'center';
      ctx.fillText('✨ パーフェクトクリア ✨', x + width/2, y + height - 15);
    }
    
    ctx.restore();
  },

// 追加: 学年ボーナス専用の結果パネル
drawBonusResultPanel(ctx, x, y, width, height) {
  if (!this.bonusSummary) return;
  const s = this.bonusSummary;

  ctx.save();

  // 影
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(x + 5, y + 5, width, height);

  // 背景（木目調を流用）
  const panelGradient = ctx.createLinearGradient(x, y, x, y + height);
  panelGradient.addColorStop(0, '#DEB887');
  panelGradient.addColorStop(0.5, '#D2B48C');
  panelGradient.addColorStop(1, '#BC9A6A');
  ctx.fillStyle = panelGradient;
  ctx.fillRect(x, y, width, height);

  // 枠
  ctx.strokeStyle = '#8B4513';
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, width, height);
  ctx.strokeStyle = '#A0522D';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 5, y + 5, width - 10, height - 10);

  // タイトル
  ctx.font = 'bold 24px "UDデジタル教科書体", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#8B4513';
  ctx.fillText('戦績', x + width/2, y + 30);

  // セクション見出し
  ctx.font = '22px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('学年ボーナス結果', x + width/2, y + 65);

  // 本文
  const lines = [
    `連戦数: ${s.fights}`,
    `正答率: ${s.accuracyPct}% / 残HP: ${s.remHpPct}%`,
    `ランク: ${s.rank}（倍率 x${s.multiplier}）`,
    `獲得EXP: ${s.xp}（内訳: base ${s.baseXP} / 初回 ${s.firstClearBonus}）`,
  ];
  const tp = s.titleProgress;
  if (tp?.gained) {
    const nextText = tp.nextThreshold ? `次の称号まで ${tp.nextThreshold - tp.count} 回` : '称号コンプリート！';
    lines.push(`称号進捗: クリア ${tp.count} 回（${nextText}）`);
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = '#654321';
  ctx.font = '18px "UDデジタル教科書体", sans-serif';
  let yy = y + 95;
  for (const t of lines) {
    ctx.fillText(t, x + 20, yy);
    yy += 24;
  }

  ctx.restore();
},


  /**
   * リッチなボタンを描画
   */
  drawRichButton(ctx, button, isHovered) {
    ctx.save();
    
    const { x, y, width, height, text } = button;
    const scale = isHovered ? 1.05 : 1.0;
    
    // ホバー時のスケール調整
    const scaledWidth = width * scale;
    const scaledHeight = height * scale;
    const scaledX = x + (width - scaledWidth) / 2;
    const scaledY = y + (height - scaledHeight) / 2;
    
    // ボタンの影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(scaledX + 4, scaledY + 4, scaledWidth, scaledHeight);
    
    // ボタン背景のグラデーション
    const buttonGradient = ctx.createLinearGradient(scaledX, scaledY, scaledX, scaledY + scaledHeight);
    if (isHovered) {
      buttonGradient.addColorStop(0, '#32CD32'); // ライムグリーン
      buttonGradient.addColorStop(0.5, '#228B22'); // フォレストグリーン
      buttonGradient.addColorStop(1, '#006400'); // ダークグリーン
    } else {
      buttonGradient.addColorStop(0, '#228B22'); // フォレストグリーン
      buttonGradient.addColorStop(0.5, '#006400'); // ダークグリーン
      buttonGradient.addColorStop(1, '#004000'); // より暗いグリーン
    }
    
    ctx.fillStyle = buttonGradient;
    ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
    
    // ボタンの縁取り
    ctx.strokeStyle = isHovered ? '#FFD700' : '#8B4513';
    ctx.lineWidth = isHovered ? 3 : 2;
    ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);
    
    // ハイライト効果
    const highlightGradient = ctx.createLinearGradient(scaledX, scaledY, scaledX, scaledY + scaledHeight * 0.3);
    highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = highlightGradient;
    ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight * 0.3);
    
    // ボタンテキスト
    ctx.font = 'bold 20px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // テキストの影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillText(text, scaledX + scaledWidth/2 + 2, scaledY + scaledHeight/2 + 2);
    
    // テキスト本体
    ctx.fillStyle = isHovered ? '#FFFACD' : 'white';
    ctx.fillText(text, scaledX + scaledWidth/2, scaledY + scaledHeight/2);
    
    ctx.restore();
  },

  /**
   * 間違えた漢字の巻物風パネルを描画
   */
  drawMistakeScrollPanel(ctx, x, y, width, height) {
    if (!gameState.wrongKanjiList || gameState.wrongKanjiList.length === 0) return;
    
    ctx.save();
    
    // 巻物の影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(x + 3, y + 3, width, height);
    
    // 巻物背景（古い紙色）
    const scrollGradient = ctx.createLinearGradient(x, y, x + width, y);
    scrollGradient.addColorStop(0, '#F5E6D3'); // 古い紙色
    scrollGradient.addColorStop(0.5, '#E6D3C1'); // より暗い紙色
    scrollGradient.addColorStop(1, '#D3C1A8'); // さらに暗い紙色
    
    ctx.fillStyle = scrollGradient;
    ctx.fillRect(x, y, width, height);
    
    // 巻物の縁取り
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    
    // 巻物の装飾（上下の巻き部分）
    ctx.fillStyle = '#A0522D';
    ctx.fillRect(x, y, width, 8);
    ctx.fillRect(x, y + height - 8, width, 8);
    
    // タイトル
    ctx.font = 'bold 16px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#8B4513';
    ctx.fillText('復習が必要な漢字:', x + 10, y + 25);
    
    // 間違えた漢字リスト
    ctx.font = '14px "UDデジタル教科書体", sans-serif';
    ctx.fillStyle = '#654321';
    
    const maxDisplay = Math.min(gameState.wrongKanjiList.length, 4); // 最大4個まで表示
    for (let i = 0; i < maxDisplay; i++) {
      const kanji = gameState.wrongKanjiList[i];
      const text = `${kanji.text || kanji}（${kanji.meaning || ''}）`;
      ctx.fillText(text, x + 15, y + 50 + i * 20);
    }
    
    // 表示しきれない場合の省略表示
    if (gameState.wrongKanjiList.length > 4) {
      ctx.fillStyle = '#A0522D';
      ctx.fillText(`...他${gameState.wrongKanjiList.length - 4}個`, x + 15, y + 130);
    }
    
    ctx.restore();
  },

  /** 画面離脱時のクリーンアップ */
  exit() {
    this.unregisterHandlers();
    this.canvas = null;
    this.ctx = null;
    this.resultData = null;
    this.bonusSummary = null;
  },

  /** イベントハンドラ登録 */
  registerHandlers() {
    if (!this.canvas) return;
    
    this._clickHandler = this.handleClick.bind(this);
    this._mousemoveHandler = this.handleMouseMove.bind(this);
    
    this.canvas.addEventListener('click', this._clickHandler);
    this.canvas.addEventListener('touchstart', this._clickHandler);
    this.canvas.addEventListener('mousemove', this._mousemoveHandler);
  },

  /** イベントハンドラ解除 */
  unregisterHandlers() {
    if (!this.canvas) return;
    
    if (this._clickHandler) {
      this.canvas.removeEventListener('click', this._clickHandler);
      this.canvas.removeEventListener('touchstart', this._clickHandler);
    }
    if (this._mousemoveHandler) {
      this.canvas.removeEventListener('mousemove', this._mousemoveHandler);
    }
    
    this._clickHandler = null;
    this._mousemoveHandler = null;
  },

  /** マウス移動処理 */
  handleMouseMove(e) {
    if (!this.canvas) return;
    
    const rect = this.canvas.getBoundingClientRect();
    if (!rect) return; // getBoundingClientRectがnullの場合は処理しない
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    
    this.mouseX = (e.clientX - rect.left) * scaleX;
    this.mouseY = (e.clientY - rect.top) * scaleY;
  },

  /** クリック処理 */
  handleClick(e) {
    const coords = getGameCoordinates(e, this.canvas);
    if (!isValidCoordinates(coords)) {
      return false; // 黒帯エリアのクリックは無視
    }
    
    const x = coords.x;
    const y = coords.y;

    if (isMouseOverRect(x, y, nextStageButton)) {
      publish('playSE', 'decide');
      const targetScreen = gameState.previousScreen || 'stageSelect';
      publish('changeScreen', targetScreen);
    }
  }
};

export default resultWinState;

// 追加: FSM 一貫化のため描画エントリポイントを alias
resultWinState.render = function() {
  this.update(0);
};

