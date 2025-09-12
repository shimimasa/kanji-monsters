// js/stageSelectScreen.js
import { gameState, resetStageProgress } from '../core/gameState.js';
import { drawButton, isMouseOverRect } from '../ui/uiRenderer.js';
import { publish } from '../core/eventBus.js';
import { images } from '../loaders/assetsLoader.js';
import reviewQueue from '../models/reviewQueue.js';
import { stageData } from '../loaders/dataLoader.js';
import { calcBonusReward, isFirstClear, markBonusFirstClear, isBonusUnlocked } from '../core/bonusManager.js';
import { getGameCoordinates, isValidCoordinates } from '../utils/coordinateUtils.js';

/** 角丸矩形を描画するヘルパー関数 */
function drawRoundedRect(ctx, x, y, width, height, radius) {
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

/** 学年に応じたアイコンを返す */
function getGradeIcon(grade) {
  const icons = {
    1: '🌱', // 芽
    2: '🌿', // 葉
    3: '🌸', // 桜
    4: '🏔️', // 山
    5: '🏛️', // 神殿
    6: '🗾', // 日本地図
    0: '🔄'  // 復習
  };
  return icons[grade] || '📚';
}

/** 学年に応じた地方名を返す */
function getGradeRegion(grade) {
  const regions = {
    1: '北海道',
    2: '東北',
    3: '関東',
    4: '中部',
    5: '近畿',
    6: '中国',
    0: ''
  };
  return regions[grade] || '';
}

/** 改善されたタブを描画する関数 */
function drawEnhancedTabs(ctx, tabs, selectedValue, canvasWidth, animationTime, mode = 'grade') {
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
    const isSelected = (mode === 'grade') ? 
      (tab.grade === selectedValue) : 
      (tab.kanken_level === selectedValue);
    
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
    
    // アイコン（学年モード）
    const icon = getGradeIcon(tab.grade);
    const mainText = tab.label;
    const subText = getGradeRegion(tab.grade);
    
    // アイコンの描画
    if (icon && tab.grade !== 0) {
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
    
    if (tab.grade === 0) {
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


// uiRoot の安全な取得に修正
const getUiRoot = () => {
  let uiRoot = document.getElementById('uiOverlay');
  if (!uiRoot) {
    // uiOverlay要素が存在しない場合は作成
    uiRoot = document.createElement('div');
    uiRoot.id = 'uiOverlay';
    uiRoot.style.position = 'absolute';
    uiRoot.style.top = '0';
    uiRoot.style.left = '0';
    uiRoot.style.pointerEvents = 'none'; // キャンバスのクリックを妨げない
    document.body.appendChild(uiRoot);
  }
  return uiRoot;
};

// フッターボタンを画面下部に水平一列に配置
const BUTTON_CONFIG = {
  width: 140,  // 幅を少し縮小（5ボタン対応）
  height: 40,
  gap: 15,     // 間隔を少し縮小
  y: 540
};

// 合計幅を計算（5ボタンに変更）
const totalWidth = (BUTTON_CONFIG.width * 5) + (BUTTON_CONFIG.gap * 4);
// 開始X座標を計算（中央揃え）
const startX = (800 - totalWidth) / 2; // キャンバス幅800pxを想定

// 各ボタンのx座標を計算
const backButton = { 
  x: startX, 
  y: BUTTON_CONFIG.y, 
  width: BUTTON_CONFIG.width, 
  height: BUTTON_CONFIG.height, 
  text: 'もどる',
  icon: '⬅️'
};

// ★★★ 練習ボタンを追加 ★★★
const practiceButton = { 
  x: startX + (BUTTON_CONFIG.width + BUTTON_CONFIG.gap) * 1, 
  y: BUTTON_CONFIG.y, 
  width: BUTTON_CONFIG.width, 
  height: BUTTON_CONFIG.height, 
  text: 'マスター',
  icon: '📝'
};

const dexButton = { 
  x: startX + (BUTTON_CONFIG.width + BUTTON_CONFIG.gap) * 2, 
  y: BUTTON_CONFIG.y, 
  width: BUTTON_CONFIG.width, 
  height: BUTTON_CONFIG.height, 
  text: '漢字図鑑',
  icon: '📚'
};

const monsterButton = { 
  x: startX + (BUTTON_CONFIG.width + BUTTON_CONFIG.gap) * 3, 
  y: BUTTON_CONFIG.y, 
  width: BUTTON_CONFIG.width, 
  height: BUTTON_CONFIG.height, 
  text: '全国ゴトモン',
  icon: '👾'
};

const profileButton = { 
  x: startX + (BUTTON_CONFIG.width + BUTTON_CONFIG.gap) * 4, 
  y: BUTTON_CONFIG.y, 
  width: BUTTON_CONFIG.width, 
  height: BUTTON_CONFIG.height, 
  text: 'プロフィール',
  icon: '🏆'
};

// マーカー半径
const MARKER_SIZE = 32;

// 追加：学年タブ定義（1～6年＋総復習）
const tabs = [
  { label: '1年',   grade: 1 },
  { label: '2年',   grade: 2 },
  { label: '3年',   grade: 3 },
  { label: '4年',   grade: 4 },
  { label: '5年',   grade: 5 },
  { label: '6年',   grade: 6 },
  { label: '総復習', grade: 0 },
];

// 選択中のステージを追跡するプロパティを追加（89行目付近）
const stageSelectScreenState = {
  canvas: null,
  ctx: null,
  stages: [],
  stageButtons: [],
  _clickHandler: null,
  _mousemoveHandler: null,
  cbToggle: null,
  fontToggle: null,
  mouseX: 0,
  mouseY: 0,
  hoveredStage: null,
  selectedStage: null, // 選択中のステージを追跡
  animationTime: 0, // アニメーション用のタイマー
  
  // クロスフェード用の状態
  crossfadeState: {
    active: false,
    timer: 0,
    duration: 30, // 30フレーム（約0.5秒）
    oldImage: null,
    newImage: null,
    oldGrade: null,
    newGrade: null
  },

  // 総復習用の大きなボタン
  reviewChallengeButton: {
    x: 50,
    y: 200,
    width: 300,
    height: 80,
    text: '今日の復習に挑戦！'
  },

  /** 画面表示時の初期化 */
  enter(arg) {
    // BGM 再生 & canvas 取得
    // publish('playBGM', 'title');
    this.canvas = (arg && typeof arg.getContext === 'function')
      ? arg
      : document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    // 未設定時は総復習(0)に
    if (gameState.currentGrade == null) {
      gameState.currentGrade = 0;
    }

    // ステージデータ初期化（現在の学年に応じたフィルタリング）
    this.updateStageList();

    // イベント登録
    this._clickHandler = this.handleClick.bind(this);
    this._mousemoveHandler = this.handleMouseMove.bind(this);
    this.canvas.addEventListener('click', this._clickHandler);
    this.canvas.addEventListener('touchstart', this._clickHandler);
    this.canvas.addEventListener('mousemove', this._mousemoveHandler);

    // 復習ボタン（ヘッダー側）は使用しないため非表示
    const btnReview = document.getElementById('btnReview');
    if (btnReview) {
      btnReview.style.display = 'none';
      btnReview.onclick = null;
    }

    // uiRootを安全に取得
    const uiRoot = getUiRoot();

    // 追加: 画面先頭の定数群の近くに
    const SHOW_STAGE_DEBUG_TOGGLES = false;

    if (SHOW_STAGE_DEBUG_TOGGLES) {
      // --- ① 色弱モード切替トグル ------------------
      const cbToggle = document.createElement('label');
      cbToggle.innerHTML = `
        <input type="checkbox" id="cbMode">
        <span></span>
      `;
      uiRoot.appendChild(cbToggle);
      this.cbToggle = cbToggle;

      // --- ② フォント+20% トグル ---------------------
      const fontToggle = document.createElement('label');
      fontToggle.innerHTML = `
        <input type="checkbox" id="bigFont">
        <span>文字サイズ +20%</span>
      `;
      uiRoot.appendChild(fontToggle);
      this.fontToggle = fontToggle;
    } else {
      // 念のため既存が残っていれば除去（他画面から戻った時の安全策）
      ['bigFont','cbMode'].forEach(id => {
        const input = document.getElementById(id);
        if (input && input.parentElement) input.parentElement.remove();
      });
      this.cbToggle = null;
      this.fontToggle = null;
    }

    // 選択中のステージをクリア
    this.selectedStage = null;
  },

  /** ステージリストを更新する（学年切り替え時に呼ばれる） */
  updateStageList() {
    // 選択中のステージをクリア
    this.selectedStage = null;

    // 既存のフィルタリング処理
    this.stages = (gameState.currentGrade === 0)
      ? stageData
      : stageData.filter(s => s.grade === gameState.currentGrade);

    // 総復習モードの場合はステージボタンを作成しない
    if (gameState.currentGrade === 0) {
      this.stageButtons = [];
      return;
    }
    
    // --- この部分を新しいロジックに置き換え ---
    const stageCount = this.stages.length;

    // キャンバス/パネルの幾何
    const cw = this.canvas?.width || 800;
    const ch = this.canvas?.height || 600;
    const panelY = 60;
    const panelH = ch - 140;
    const leftPanelWidth = cw / 2;

    // リスト領域（上端と下端）- 見出し分のスペースを確保
    const listStartY = 130;                   // 見出し分を考慮して下に移動（80→120）
    const listBottom = panelY + panelH - 12;  // 下端はパネル内に収める

    // 空き高さからボタン高さを自動算出
    let buttonMargin = 6;
    let buttonHeight = 50;
    if (stageCount > 0) {
      const totalAvail = Math.max(0, listBottom - listStartY);
      const fitted = Math.floor((totalAvail - (stageCount - 1) * buttonMargin) / stageCount);
      buttonHeight = Math.max(28, Math.min(50, fitted)); // 28〜50の範囲でフィット
      if (buttonHeight <= 32) buttonMargin = 4;          // かなり詰まる場合は余白も縮小
    }

    // フォントサイズも高さに追従
    const fontSize = Math.max(12, Math.min(20, Math.floor(buttonHeight * 0.42)));

    const buttonWidth = leftPanelWidth - 60;

    this.stageButtons = this.stages.map((stage, index) => {
      return {
        id: stage.stageId,
        text: stage.name,
        x: 30,
        y: listStartY + index * (buttonHeight + buttonMargin),
        width: buttonWidth,
        height: buttonHeight,
        fontSize: fontSize,
        stage: stage,
      };
    });
  },

  /** ステージのクリア状況を確認 */
  isStageCleared(stageId) {
    const localStorageCleared = localStorage.getItem(`clear_${stageId}`);
    const gameStateCleared = gameState.stageProgress && gameState.stageProgress[stageId]?.cleared;
    return localStorageCleared || gameStateCleared;
  },

  /** 次に挑戦すべきステージを取得 */
  getNextStage() {
    for (const stage of this.stages) {
      if (!this.isStageCleared(stage.stageId)) {
        return stage;
      }
    }
    return null; // 全てクリア済み
  },

  /** 総復習用の推奨ステージを選択 */
  selectReviewStage() {
    // 1. 未クリアのステージを優先
    const unclearedStages = stageData.filter(stage => !this.isStageCleared(stage.stageId));
    if (unclearedStages.length > 0) {
      // 未クリアステージの中から学年の低いものを優先
      unclearedStages.sort((a, b) => a.grade - b.grade);
      return unclearedStages[0];
    }

    // 2. 全てクリア済みの場合は、復習キューにあるステージを選択
    if (reviewQueue.size() > 0) {
      // 復習キューから漢字を取得し、その漢字が含まれるステージを探す
      const reviewKanjiIds = Array.from(reviewQueue.getAll());
      for (const stage of stageData) {
        if (stage.kanjiPoolIdList && stage.kanjiPoolIdList.some(id => reviewKanjiIds.includes(id))) {
          return stage;
        }
      }
    }

    // 3. 最後の手段として、ランダムにステージを選択
    const randomIndex = Math.floor(Math.random() * stageData.length);
    return stageData[randomIndex];
  },

  /** クロスフェードアニメーションを開始 */
  startCrossfade(oldGrade, newGrade) {
    const oldKey = oldGrade === 0 ? 'stageSelect0' : `stageSelect${oldGrade}`;
    const newKey = newGrade === 0 ? 'stageSelect0' : `stageSelect${newGrade}`;
    
    this.crossfadeState.active = true;
    this.crossfadeState.timer = 0;
    this.crossfadeState.oldImage = images[oldKey] || images.stageSelect0;
    this.crossfadeState.newImage = images[newKey] || images.stageSelect0;
    this.crossfadeState.oldGrade = oldGrade;
    this.crossfadeState.newGrade = newGrade;
  },

  /** マウス移動ハンドラー */
  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    
    this.mouseX = (e.clientX - rect.left) * scaleX;
    this.mouseY = (e.clientY - rect.top) * scaleY;

    // ホバー中のステージを検出
    this.hoveredStage = null;

    // 総復習モードの場合は通常のホバー判定をスキップ
    if (gameState.currentGrade === 0) {
      return;
    }

    // ステージボタンのホバー判定
    if (this.stageButtons) {
      for (const button of this.stageButtons) {
        if (isMouseOverRect(this.mouseX, this.mouseY, button)) {
          this.hoveredStage = button.stage;
          return;
        }
      }
    }

    // マップマーカーのホバー判定
    if (gameState.currentGrade !== 0) {
      for (const stage of this.stages) {
        if (!stage.pos) continue;
        const { x, y } = stage.pos;
        if (this.mouseX >= x && this.mouseX <= x + MARKER_SIZE && 
            this.mouseY >= y && this.mouseY <= y + MARKER_SIZE) {
          this.hoveredStage = stage;
          return;
        }
      }
    }
  },

  /** ツールチップを描画 */
  drawTooltip(stage) {
    if (!stage) return;

    const ctx = this.ctx;
    const tooltipX = this.mouseX + 20;
    const tooltipY = this.mouseY - 80;
    const tooltipWidth = 200;
    const tooltipHeight = 90;

    // 背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);

    // テキスト
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    let yOffset = 10;
    ctx.fillText(`ステージ: ${stage.name}`, tooltipX + 10, tooltipY + yOffset);
    yOffset += 20;
    
    if (stage.recommendedLevel) {
      ctx.fillText(`推奨Lv: ${stage.recommendedLevel}`, tooltipX + 10, tooltipY + yOffset);
      yOffset += 20;
    }
    
    ctx.fillText(`地方: ${stage.region}`, tooltipX + 10, tooltipY + yOffset);
    yOffset += 20;
    
    const isCleared = this.isStageCleared(stage.stageId);
    ctx.fillStyle = isCleared ? '#4CAF50' : '#FFC107';
    ctx.fillText(isCleared ? 'クリア済み' : '未クリア', tooltipX + 10, tooltipY + yOffset);

    // 学年ボーナスの未解放メッセージ
    const m2 = /^bonus_g(\d+)$/i.exec(stage.stageId);
    if (m2) {
      const g = parseInt(m2[1], 10);
      if (!isBonusUnlocked(g)) {
        ctx.fillStyle = '#ffb74d';
        ctx.fillText('この学年の通常ステージをすべてクリアで解放', tooltipX + 10, tooltipY + yOffset + 20);
      }
    }
  },

  /** 総復習用の統計情報を描画 */
  drawReviewStats(ctx) {
    const panelX = 50;
    const panelY = 320;
    const panelW = 300;
    const panelH = 120;

    // 統計パネルの背景
    this.drawPanelBackground(ctx, panelX, panelY, panelW, panelH, 'paper');

    // 統計情報の計算
    const totalStages = stageData.length;
    const clearedStages = stageData.filter(stage => this.isStageCleared(stage.stageId)).length;
    const clearRate = Math.round((clearedStages / totalStages) * 100);
    const reviewCount = reviewQueue.size();

    // テキスト描画
    ctx.fillStyle = '#333';
    ctx.font = '16px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    let yOffset = 15;
    ctx.fillText('📊 学習状況', panelX + 15, panelY + yOffset);
    yOffset += 25;

    ctx.font = '14px "UDデジタル教科書体", sans-serif';
    ctx.fillText(`ステージクリア率: ${clearRate}% (${clearedStages}/${totalStages})`, panelX + 15, panelY + yOffset);
    yOffset += 20;

    ctx.fillText(`復習待ち漢字: ${reviewCount}個`, panelX + 15, panelY + yOffset);
    yOffset += 20;

    // プログレスバー
    const barX = panelX + 15;
    const barY = panelY + yOffset;
    const barW = panelW - 30;
    const barH = 10;

    // 背景
    ctx.fillStyle = '#ddd';
    ctx.fillRect(barX, barY, barW, barH);

    // 進捗
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(barX, barY, barW * (clearRate / 100), barH);

    // 枠線
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
  },

  /** リッチなボタンを描画するメソッド（battleScreenから移植） */
  drawRichButton(ctx, x, y, width, height, label, baseColor = '#2980b9', isHovered = false) {
    ctx.save();
    
    // ホバー時のスケールとカラー調整
    const scale = isHovered ? 1.05 : 1.0;
    const hoverColor = isHovered ? this.lightenColor(baseColor, 15) : baseColor;
    
    // ホバー時はボタンを中央基準で拡大
    if (isHovered) {
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      const scaledWidth = width * scale;
      const scaledHeight = height * scale;
      x = centerX - scaledWidth / 2;
      y = centerY - scaledHeight / 2;
      width = scaledWidth;
      height = scaledHeight;
    }
    
    // 影を描画（少し下と右にオフセット）
    const shadowOffset = isHovered ? 4 : 3;
    const shadowOpacity = isHovered ? 0.4 : 0.3;
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowOpacity})`;
    ctx.fillRect(x + shadowOffset, y + shadowOffset, width, height);
    
    // グラデーション背景を作成
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, this.lightenColor(hoverColor, 20));
    gradient.addColorStop(1, this.darkenColor(hoverColor, 20));
    
    // ボタン本体を描画
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);
    
    // 枠線を描画
    ctx.strokeStyle = this.darkenColor(hoverColor, 30);
    ctx.lineWidth = isHovered ? 3 : 2;
    ctx.strokeRect(x, y, width, height);
    
    // 上部のハイライト（立体感を演出）
    const highlightGradient = ctx.createLinearGradient(x, y, x, y + height * 0.3);
    const highlightOpacity = isHovered ? 0.4 : 0.3;
    highlightGradient.addColorStop(0, `rgba(255, 255, 255, ${highlightOpacity})`);
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = highlightGradient;
    ctx.fillRect(x, y, width, height * 0.3);
    
    // ホバー時の光るエフェクト
    if (isHovered) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
    }
    
    // テキストを描画
    ctx.fillStyle = 'white';
    ctx.font = '18px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + width / 2, y + height / 2);
    
    ctx.restore();
  },

  /** パネル背景を描画するメソッド（battleScreenから移植） */
  drawPanelBackground(ctx, x, y, width, height, style = 'default') {
    ctx.save();
    
    // 基本的な背景（半透明の暗い色）
    let bgColor = 'rgba(0, 0, 0, 0.7)';
    
    if (style === 'stone') {
      // 石のような質感の背景
      bgColor = 'rgba(50, 50, 60, 0.8)';
    } else if (style === 'paper') {
      // 紙のような質感の背景
      bgColor = 'rgba(245, 235, 215, 0.9)';
    }
    
    // 背景を描画
    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y, width, height);
    
    // 枠線を描画
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    
    // スタイルに応じた追加装飾
    if (style === 'stone') {
      // 石の質感を表現する細かな線
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      
      // 横線
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x, y + height * i / 3);
        ctx.lineTo(x + width, y + height * i / 3);
        ctx.stroke();
      }
    }
    
    ctx.restore();
  },

  /** 色を明るくするヘルパーメソッド */
  lightenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
  },

  /** 色を暗くするヘルパーメソッド */
  darkenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = (num >> 8 & 0x00FF) - amt;
    const B = (num & 0x0000FF) - amt;
    return '#' + (0x1000000 + (R > 255 ? 255 : R < 0 ? 0 : R) * 0x10000 +
      (G > 255 ? 255 : G < 0 ? 0 : G) * 0x100 +
      (B > 255 ? 255 : B < 0 ? 0 : B)).toString(16).slice(1);
  },

// stageSelectScreen.js の update メソッド内の修正部分

/** 毎フレーム描画・更新 */
update(dt) {
  const { ctx, canvas, stages } = this;
  const cw = canvas.width, ch = canvas.height;
  ctx.clearRect(0, 0, cw, ch);

  // アニメーション時間を更新
  this.animationTime += dt || 16;

  // クロスフェードアニメーションの更新
  if (this.crossfadeState.active) {
    this.crossfadeState.timer++;
    if (this.crossfadeState.timer >= this.crossfadeState.duration) {
      this.crossfadeState.active = false;
    }
  }

  // 背景画像をキャンバスの右半分に描画（クロスフェード対応）
  const imageX = cw / 2;
  
  if (this.crossfadeState.active) {
    // クロスフェード中
    const progress = this.crossfadeState.timer / this.crossfadeState.duration;
    const oldAlpha = 1 - progress;
    const newAlpha = progress;
    
    if (this.crossfadeState.oldImage) {
      ctx.save();
      ctx.globalAlpha = oldAlpha;
      ctx.drawImage(this.crossfadeState.oldImage, imageX, 0, cw / 2, ch);
      ctx.restore();
    }
    
    if (this.crossfadeState.newImage) {
      ctx.save();
      ctx.globalAlpha = newAlpha;
      ctx.drawImage(this.crossfadeState.newImage, imageX, 0, cw / 2, ch);
      ctx.restore();
    }
  } else {
    // 通常表示
    const grade = gameState.currentGrade ?? 0;
    const key = grade === 0 ? 'stageSelect0' : `stageSelect${grade}`;
    const bgImg = images[key] || images.stageSelect0;
    if (bgImg) {
      ctx.drawImage(bgImg, imageX, 0, cw / 2, ch);
    }
  }

  // 左側のステージリスト背景パネル
  const panelX = 10;
  const panelY = 70;
  const panelW = cw / 2 - 20;
  const panelH = ch - 150;
  this.drawPanelBackground(ctx, panelX, panelY, panelW, panelH, 'stone');

  drawEnhancedTabs(ctx, tabs, gameState.currentGrade, cw, this.animationTime, 'grade');


  // === 地方名と学年の見出し追加 ===
  if (gameState.currentGrade !== 0) {
    // 学年に対応する地方名を取得
    const getRegionByGrade = (grade) => {
      switch(grade) {
        case 1: return '北海道';
        case 2: return '東北地方';
        case 3: return '関東地方';
        case 4: return '中部地方';
        case 5: return '近畿地方';
        case 6: return '中国地方';
        default: return '';
      }
    };

    const regionName = getRegionByGrade(gameState.currentGrade);
    const gradeText = `${gameState.currentGrade}年`;
    const headerText = `${regionName}（${gradeText}）`;

    // 見出しの背景とテキストを描画
    ctx.fillStyle = 'white';
    ctx.font = 'bold 24px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // テキストの幅を測定して背景を描画
    const textWidth = ctx.measureText(headerText).width;
    const textBgPadding = 12;
    const textBgX = panelX + panelW / 2 - textWidth / 2 - textBgPadding;
    const textBgY = panelY + 10;
    const textBgWidth = textWidth + textBgPadding * 2;
    const textBgHeight = 34;

    // 背景（半透明の黒）
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(textBgX, textBgY, textBgWidth, textBgHeight);
    
    // 枠線
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(textBgX, textBgY, textBgWidth, textBgHeight);

    // テキスト（影付き）
    ctx.fillStyle = 'white';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillText(headerText, panelX + panelW / 2, panelY + 15);
    
    // 影をリセット
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  // 総復習モードと通常モードで分岐
  if (gameState.currentGrade === 0) {
    // 総復習モード専用UI
    
    // タイトル
    ctx.fillStyle = 'white';
    ctx.font = '24px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('総復習モード', panelX + panelW / 2, panelY + 20);

    // 説明文
    ctx.font = '14px "UDデジタル教科書体", sans-serif';
    ctx.fillStyle = '#ccc';
    ctx.fillText('あなたに最適なステージを自動選択します', panelX + panelW / 2, panelY + 55);

    // メインの復習ボタン
    const button = this.reviewChallengeButton;
    const isHovered = isMouseOverRect(this.mouseX, this.mouseY, button);
    
    // 点滅エフェクト
    const pulse = Math.sin(this.animationTime * 0.003) * 0.2 + 0.8;
    const buttonColor = `hsl(${120 + Math.sin(this.animationTime * 0.002) * 30}, 70%, ${50 + pulse * 10}%)`;
    
    this.drawRichButton(ctx, button.x, button.y, button.width, button.height, button.text, buttonColor, isHovered);

    // アイコン追加
    ctx.fillStyle = 'white';
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🎯', button.x + 30, button.y + button.height / 2);

    // 統計情報パネル
    this.drawReviewStats(ctx);

  } else {
    // 通常モード（学年別ステージ選択）
    
    // ステージボタンの描画（リッチなデザイン版）
    if (this.stageButtons) {
      this.stageButtons.forEach(button => {
        const stage = button.stage;
        const isCleared = this.isStageCleared(stage.stageId);
        const isNext = false; // 自動点滅を無効化
        const isHovered = this.hoveredStage && this.hoveredStage.stageId === stage.stageId;

        // ボタンの色を決定
        let buttonColor = '#2980b9'; // デフォルト青
        if (isCleared) {
          buttonColor = '#27ae60'; // クリア済みは緑
        } else if (isNext) {
          buttonColor = '#e74c3c'; // 次に挑戦すべきは赤
        }

        // 選択中のボタンは目立つ色に変更
        const isSelected = this.selectedStage && this.selectedStage.stageId === stage.stageId;
        if (isSelected) {
          buttonColor = '#FF8C00'; // 選択中は鮮やかなオレンジ色
        }

        // リッチなボタンを描画
        this.drawRichButton(ctx, button.x, button.y, button.width, button.height, button.text, buttonColor, isHovered);

        // 追加情報の描画
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = '12px sans-serif';

        // 選択中のボタンには特別なマーク（チェックマーク）を表示
        if (isSelected) {
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '16px sans-serif';
          ctx.fillText('✓', button.x + 10, button.y + 5);
        }

        // クリア状況（星アイコン）
        if (isCleared) {
          ctx.fillStyle = '#FFD700';
          ctx.font = '16px sans-serif';
          ctx.fillText('⭐', button.x + button.width - 25, button.y + 5);
        }

        // 推奨レベル
        if (stage.recommendedLevel) {
          ctx.fillStyle = '#fff';
          ctx.font = '10px sans-serif';
          ctx.fillText(`推奨Lv.${stage.recommendedLevel}`, button.x + 5, button.y + button.height - 15);
        }

        // 次に挑戦すべきステージの表示
        if (isNext) {
          ctx.fillStyle = '#FFD700';
          ctx.font = '10px sans-serif';
          ctx.fillText('NEXT!', button.x + button.width - 50, button.y + button.height - 15);
        }

        // 学年ボーナスのロック表示（鍵＋半透明）
        const mBonus = /^bonus_g(\d+)$/i.exec(stage.stageId);
        if (mBonus) {
          const g = parseInt(mBonus[1], 10);
          const unlocked = isBonusUnlocked(g);
          if (!unlocked) {
            ctx.save();
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.fillRect(button.x, button.y, button.width, button.height);
            ctx.fillStyle = '#FFD700';
            ctx.font = `${Math.max(12, Math.floor(button.height * 0.4))}px sans-serif`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText('🔒', button.x + 10, button.y + button.height / 2);
            ctx.restore();
          }
        }
      });
    }

    // 各ステージのマーカーを動的に描画（ステータス別表示）
    if (gameState.currentGrade !== 0) {
      const nextStage = this.getNextStage();
      
      stages.forEach(stage => {
        if (!stage.pos) return;
        const { x, y } = stage.pos;
        const isCleared = this.isStageCleared(stage.stageId);
        const isNext = false; // 自動点滅を無効化
        const isSelected = this.selectedStage && this.selectedStage.stageId === stage.stageId;
        
        let markerImage = images.markerPref;
        let scale = 1;
        let alpha = 1;

        // ステータス別の表示
        if (isSelected) {
          // 選択中のステージ: より強い点滅アニメーション
          const pulse = Math.sin(this.animationTime * 0.01) * 0.5 + 0.5;
          scale = 1 + pulse * 0.3;
          alpha = 0.8 + pulse * 0.2;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.filter = 'hue-rotate(120deg) saturate(2) brightness(1.3)';
        } else if (isCleared) {
          // クリア済み: 金色のマーカー
          markerImage = images.markerCleared || images.markerPref;
          ctx.save();
          ctx.globalAlpha = 1;
          ctx.filter = 'hue-rotate(45deg) saturate(1.5) brightness(1.2)';
        } else if (isNext) {
          // 次に挑戦すべきステージ: 点滅アニメーション
          const pulse = Math.sin(this.animationTime * 0.005) * 0.3 + 0.7;
          scale = 1 + pulse * 0.2;
          alpha = pulse;
          ctx.save();
          ctx.globalAlpha = alpha;
        } else {
          // 未挑戦: 通常表示
          ctx.save();
          ctx.globalAlpha = 0.7;
        }

        if (markerImage) {
          const drawSize = MARKER_SIZE * scale;
          const offsetX = (drawSize - MARKER_SIZE) / 2;
          const offsetY = (drawSize - MARKER_SIZE) / 2;
          ctx.drawImage(markerImage, x - offsetX, y - offsetY, drawSize, drawSize);
        } else {
          ctx.fillStyle = isCleared ? '#FFD700' : (isNext ? '#FF6B35' : '#f00');
          const drawSize = MARKER_SIZE * scale;
          const offsetX = (drawSize - MARKER_SIZE) / 2;
          const offsetY = (drawSize - MARKER_SIZE) / 2;
          ctx.fillRect(x - offsetX, y - offsetY, drawSize, drawSize);
        }

        ctx.restore();
      });
    }
  }

  // フッターバーの描画
  this._drawFooterBar(ctx, cw, ch);

  // ツールチップの描画（総復習モード以外）
  if (gameState.currentGrade !== 0) {
    this.drawTooltip(this.hoveredStage);
  }
},

  /** フッターバーとボタンの描画 */
  _drawFooterBar(ctx, canvasWidth, canvasHeight) {
    // フッターバーの背景を描画
    const footerBarX = startX - 10;
    const footerBarY = BUTTON_CONFIG.y - 10;
    const footerBarWidth = totalWidth + 20;
    const footerBarHeight = BUTTON_CONFIG.height + 20;
    
    // 半透明の背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(footerBarX, footerBarY, footerBarWidth, footerBarHeight);
    
    // 枠線
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(footerBarX, footerBarY, footerBarWidth, footerBarHeight);
    
    // 上部のハイライト（立体感）
    const gradientHeight = 15;
    const gradient = ctx.createLinearGradient(footerBarX, footerBarY, footerBarX, footerBarY + gradientHeight);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(footerBarX, footerBarY, footerBarWidth, gradientHeight);

    // ★★★ ホバー判定に練習ボタンを追加 ★★★
    const isBackHovered = isMouseOverRect(this.mouseX, this.mouseY, backButton);
    const isPracticeHovered = isMouseOverRect(this.mouseX, this.mouseY, practiceButton);
    const isDexHovered = isMouseOverRect(this.mouseX, this.mouseY, dexButton);
    const isMonsterHovered = isMouseOverRect(this.mouseX, this.mouseY, monsterButton);
    const isProfileHovered = isMouseOverRect(this.mouseX, this.mouseY, profileButton);

    // リッチボタンで描画
    this._drawRichFooterButton(ctx, backButton, '#808080', isBackHovered); // グレー系
    this._drawRichFooterButton(ctx, practiceButton, '#4CAF50', isPracticeHovered); // 緑系（練習用）
    this._drawRichFooterButton(ctx, dexButton, '#2980b9', isDexHovered);   // 青系
    this._drawRichFooterButton(ctx, monsterButton, '#2980b9', isMonsterHovered); // 青系
    this._drawRichFooterButton(ctx, profileButton, '#2980b9', isProfileHovered); // 青系
  },

  /** フッター専用のリッチボタン描画（アイコン付き） */
  _drawRichFooterButton(ctx, button, baseColor, isHovered) {
    ctx.save();
    
    // ホバー時のスケールとカラー調整
    const scale = isHovered ? 1.02 : 1.0; // フッターボタンは控えめなスケール
    const hoverColor = isHovered ? this.lightenColor(baseColor, 15) : baseColor;
    
    let { x, y, width, height } = button;
    
    // ホバー時はボタンを中央基準で拡大
    if (isHovered) {
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      const scaledWidth = width * scale;
      const scaledHeight = height * scale;
      x = centerX - scaledWidth / 2;
      y = centerY - scaledHeight / 2;
      width = scaledWidth;
      height = scaledHeight;
    }
    
    // 影を描画（少し下と右にオフセット）
    const shadowOffset = isHovered ? 3 : 2;
    const shadowOpacity = isHovered ? 0.4 : 0.3;
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowOpacity})`;
    ctx.fillRect(x + shadowOffset, y + shadowOffset, width, height);
    
    // グラデーション背景を作成
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, this.lightenColor(hoverColor, 20));
    gradient.addColorStop(1, this.darkenColor(hoverColor, 20));
    
    // ボタン本体を描画
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);
    
    // 枠線を描画
    ctx.strokeStyle = this.darkenColor(hoverColor, 30);
    ctx.lineWidth = isHovered ? 2 : 1;
    ctx.strokeRect(x, y, width, height);
    
    // 上部のハイライト（立体感を演出）
    const highlightGradient = ctx.createLinearGradient(x, y, x, y + height * 0.3);
    const highlightOpacity = isHovered ? 0.4 : 0.3;
    highlightGradient.addColorStop(0, `rgba(255, 255, 255, ${highlightOpacity})`);
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = highlightGradient;
    ctx.fillRect(x, y, width * 0.8, height * 0.3);
    
    // ホバー時の光るエフェクト
    if (isHovered) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
    }
    
    // アイコンとテキストを描画
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // アイコンを左側に描画
    if (button.icon) {
      ctx.font = '16px sans-serif';
      ctx.fillText(button.icon, x + width * 0.25, y + height / 2);
    }
    
    // テキストを右側に描画
    ctx.font = '14px "UDデジタル教科書体", sans-serif';
    const textX = button.icon ? x + width * 0.65 : x + width / 2;
    ctx.fillText(button.text, textX, y + height / 2);
    
    ctx.restore();
  },

  /** 画面離脱時のクリーンアップ */
  exit() {
    this.unregisterHandlers();
    // スライダー削除
    const bgmSlider = document.getElementById('bgmVolumeSlider');
    if (bgmSlider) bgmSlider.remove();
    const seSlider = document.getElementById('seVolumeSlider');
    if (seSlider) seSlider.remove();

    // 追加: トグル要素を削除
    if (this.cbToggle) {
      this.cbToggle.remove();
      this.cbToggle = null;
    }
    if (this.fontToggle) {
      this.fontToggle.remove();
      this.fontToggle = null;
    }

    this.canvas      = null;
    this.ctx         = null;
    this.backButton  = null;
    this.resetButton = null;
  },

  /** クリックイベント登録 */
  registerHandlers() {
    this._clickHandler = this.handleClick.bind(this);
    this._mousemoveHandler = this.handleMouseMove.bind(this);
    this.canvas.addEventListener('click', this._clickHandler);
    this.canvas.addEventListener('touchstart', this._clickHandler);
    this.canvas.addEventListener('mousemove', this._mousemoveHandler);
  },

  /** クリックイベント解除 */
  unregisterHandlers() {
    this.canvas.removeEventListener('click', this._clickHandler);
    this.canvas.removeEventListener('touchstart', this._clickHandler);
    this.canvas.removeEventListener('mousemove', this._mousemoveHandler);
  },

  /** クリック処理 */
  handleClick(e) {
    // 統一された座標変換を使用
    const coords = getGameCoordinates(e, this.canvas);
    if (!isValidCoordinates(coords)) {
      return false; // 黒帯エリアのクリックは無視
    }
    
    const x = coords.x;
    const y = coords.y;

    // タブクリック判定
    const tabCount = tabs.length;
    const tabW = this.canvas.width / tabCount;
    const tabH = 60;
    if (y >= 0 && y <= tabH) {
      const idx = Math.floor(x / tabW);
      const tab = tabs[idx];
      if (tab) {
        const oldGrade = gameState.currentGrade;
        gameState.currentGrade = tab.grade;
        
        // クロスフェードアニメーションを開始
        this.startCrossfade(oldGrade, tab.grade);
        
        this.updateStageList(); // ここでボタンリストも更新される
        publish('playSE', 'decide');
      }
      return;
    }

    // 総復習モードの場合の特別処理
    if (gameState.currentGrade === 0) {
      // 「今日の復習に挑戦！」ボタンのクリック判定
      const button = this.reviewChallengeButton;
      if (isMouseOverRect(x, y, button)) {
        publish('playSE','decide');
        if (reviewQueue.size() > 0) {
          publish('changeScreen','reviewStage');
        } else {
          // 推奨ステージから学年だけ借用して学年ボーナスへ
          const selectedStage = this.selectReviewStage();
          const g = selectedStage?.grade ?? 1;
          const bonusId = `bonus_g${g}`;
          gameState.currentStageId = bonusId;
          resetStageProgress(bonusId);
          publish('changeScreen', 'stageLoading');
        }
        return;
      }
    } else {
      // 通常モード（学年別）の処理
      
      for (const button of this.stageButtons) {
        if (isMouseOverRect(x, y, button)) {
          publish('playSE', 'decide');
          
          // すでに選択中のステージをクリックした場合は遷移
          if (this.selectedStage && this.selectedStage.stageId === button.stage.stageId) {
            const targetId = button.id;
            const mBonus = /^bonus_g(\d+)$/i.exec(targetId);
            if (mBonus) {
              const g = parseInt(mBonus[1], 10);
              if (!isBonusUnlocked(g)) {
                publish('playSE', 'wrong');
                alert('この学年ボーナスはまだ解放されていません。\n通常ステージをすべてクリアすると解放されます。');
                return;
              }
            }
            gameState.currentStageId = targetId;
            resetStageProgress(targetId);
            publish('changeScreen', 'stageLoading');
          } else {
            // 1回目のクリック: ステージを選択状態にする
            this.selectedStage = button.stage;
          }
          return;
        }
      }

      // 各ステージマーカーのクリック判定（1回目は選択、2回目で遷移）
      if (gameState.currentGrade !== 0) {
        for (const stage of this.stages) {
          if (stage.pos) {
            const { x: markerX, y: markerY } = stage.pos;
            if (x >= markerX - MARKER_SIZE/2 && x <= markerX + MARKER_SIZE/2 && 
                y >= markerY - MARKER_SIZE/2 && y <= markerY + MARKER_SIZE/2) {
              publish('playSE', 'decide');
              if (this.selectedStage && this.selectedStage.stageId === stage.stageId) {
                const targetId = stage.stageId;
                const mBonus = /^bonus_g(\d+)$/i.exec(targetId);
                if (mBonus) {
                  const g = parseInt(mBonus[1], 10);
                  if (!isBonusUnlocked(g)) {
                    publish('playSE', 'wrong');
                    alert('この学年ボーナスはまだ解放されていません。\n通常ステージをすべてクリアすると解放されます。');
                    return;
                  }
                }
                gameState.currentStageId = targetId;
                resetStageProgress(targetId);
                publish('changeScreen', 'stageLoading');
              } else {
                this.selectedStage = stage;
              }
              return;
            }
          }
        }
      }
    }

    // 「もどる」ボタン
    if (isMouseOverRect(x, y, backButton)) {
      publish('playSE', 'decide');
      // titleではなく、regionSelectに戻るように修正
      publish('changeScreen', 'regionSelect');
      return;
    }

    // ★★★ 練習ボタンのクリック処理を追加 ★★★
    if (isMouseOverRect(x, y, practiceButton)) {
      publish('playSE', 'decide');
      this._startPracticeMode();
      return;
    }

    // 漢字図鑑ボタン
    if (isMouseOverRect(x, y, dexButton)) {
      publish('playSE', 'decide');
      publish('changeScreen', 'kanjiDex');
      return;
    }

    // モンスターデックスボタン
    if (isMouseOverRect(x, y, monsterButton)) {
      publish('playSE', 'decide');
      publish('changeScreen', 'monsterDex');
      return;
    }

    // プロフィール/称号ボタン
    if (isMouseOverRect(x, y, profileButton)) {
      publish('playSE', 'decide');
      publish('changeScreen', 'profile');
      return;
    }
  },

  // ★★★ マスターモード開始処理を追加 ★★★
  /**
   * マスターモードを開始する
   */
  _startPracticeMode() {
    // 選択されたステージがある場合はそのステージで練習
    if (this.selectedStage) {
      console.log('🎯 マスターモード開始:', this.selectedStage.stageId);
      gameState.currentStageId = this.selectedStage.stageId;
      gameState.gameMode = 'practice';
      publish('changeScreen', 'practiceBattle');
    } 
    // 総復習モードの場合は推奨ステージで練習
    else if (gameState.currentGrade === 0) {
      const recommendedStage = this.selectReviewStage();
      if (recommendedStage) {
        console.log('🎯 総復習モード練習開始:', recommendedStage.stageId);
        gameState.currentStageId = recommendedStage.stageId;
        gameState.gameMode = 'practice';
        publish('changeScreen', 'practiceBattle');
      } else {
        alert('マスターできるステージがありません。');
      }
    }
    // ステージが選択されていない場合
    else {
      alert('マスターしたいステージを先に選択してください。');
    }
  },
  
  render() {
    this.update(0);
  }
};

export default stageSelectScreenState;

// 追加: FSM 一貫化のため描画エントリポイントを alias
stageSelectScreenState.render = function() {
  this.update(0);
};

