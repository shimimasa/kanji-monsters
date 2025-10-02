import { gameState, resetStageProgress } from '../core/gameState.js';
import { drawButton, isMouseOverRect } from '../ui/uiRenderer.js';
import { publish } from '../core/eventBus.js';
import { images } from '../loaders/assetsLoader.js';
import { stageData } from '../loaders/dataLoader.js';
import ReviewQueue from '../models/reviewQueue.js';
import { getKanjiByGrade, getKanjiById, getKanjiByStageId } from '../loaders/dataLoader.js';
import { isBonusUnlocked } from '../core/bonusManager.js';
import { getGameCoordinates, isValidCoordinates } from '../utils/coordinateUtils.js';
import { getEnemiesByStageId } from '../loaders/dataLoader.js';
import { loadDex } from '../models/monsterDex.js';
// === 1. importの後に共通関数を追加 ===

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

/** 漢検レベルに応じたアイコンを返す */
function getKankenIcon(level) {
  const icons = {
    '4': '🥉',    // 銅メダル
    '3': '🥈',    // 銀メダル
    '準2': '🏅',  // メダル
    '2': '🥇',    // 金メダル
    'review': '🔄'
  };
  return icons[level] || '📜';
}

/** 漢検レベルに応じた大陸名を返す */
function getKankenContinent(level) {
  const continents = {
    '4': 'アジア',
    '3': 'ヨーロッパ',
    '準2': 'アメリカ',
    '2': 'アフリカ',
    'review': ''
  };
  return continents[level] || '';
}

/** 改善されたタブを描画する関数（漢検版） */
function drawEnhancedTabs(ctx, tabs, selectedValue, canvasWidth, animationTime, mode = 'kanken') {
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
    const isSelected = (tab.kanken_level === selectedValue);
    
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
    
    // アイコン（漢検モード）
    const icon = getKankenIcon(tab.kanken_level);
    const mainText = tab.label;
    const subText = getKankenContinent(tab.kanken_level);
    
    // アイコンの描画
    if (icon && tab.kanken_level !== 'review') {
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
    
    if (tab.kanken_level === 'review') {
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



// 文字正規化（reviewStage と同仕様）
function hiraShift(ch) { return String.fromCharCode(ch.charCodeAt(0) - 0x60); }
function toHiragana(input) {
  return (input || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[\u30a1-\u30f6]/g, hiraShift);
}
function getReadings(kanji) {
  const set = new Set();
  if (kanji?.kunyomi) kanji.kunyomi.split(' ').forEach(r => r && set.add(toHiragana(r.trim())));
  if (kanji?.onyomi)  kanji.onyomi.split(' ').forEach(r => r && set.add(toHiragana(r.trim())));
  return [...set];
}

// ===== 学年目安バッジ（4級〜2級）ユーティリティと描画 =====
function __wss_gradeToSchoolHint(g) {
  return (g===7?'中1目安':g===8?'中2目安':g===9?'中3目安':g===10?'高1〜2目安':'');
}
function __wss_kankenTooltip(g) {
  return (g===7?'このレベルは中1相当の漢字が中心です':
          g===8?'このレベルは中2相当の漢字が中心です':
          g===9?'このレベルは中3相当の漢字が中心です':
          g===10?'このレベルは高校初級相当の漢字が中心です':'');
}
function __wss_drawBadge(ctx, text, x, y) {
  ctx.save();
  ctx.font = '12px "UDデジタル教科書体", sans-serif';
  const padX=8, padY=4, h=18, r=h/2;
  const w = Math.ceil(ctx.measureText(text).width) + padX*2;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(text, x + w/2, y + h/2);
  ctx.restore();
  return {x,y,w,h};
}

/**
 * 画面下地の描画が終わった最後に呼び出してください。
 * - 見出し付近に現在級のバッジ
 * - 各ステージボタン右肩にバッジ
 * - 簡易ツールチップ
 */
function __wss_renderSchoolHintOverlays(self, ctx) {
  try {
    const rects = [];

    // ページ見出し用（選択級）
    if (self.selectedGrade >= 7) {
      const badgeText = __wss_gradeToSchoolHint(self.selectedGrade);
      const r = __wss_drawBadge(ctx, badgeText, 20, 58);
      r.tip = __wss_kankenTooltip(self.selectedGrade);
      rects.push(r);
    }
  
    // ホバー判定とツールチップ
    if (rects.length > 0 && Number.isFinite(self.mouseX) && Number.isFinite(self.mouseY)) {
      for (const r of rects) {
        if (self.mouseX >= r.x && self.mouseX <= r.x + r.w &&
            self.mouseY >= r.y && self.mouseY <= r.y + r.h) {
          const tip = r.tip;
          if (!tip) break;
          const tx = self.mouseX + 12, ty = self.mouseY + 18;
          const tw = Math.ceil(ctx.measureText(tip).width) + 14, th = 22;
          ctx.save();
          ctx.fillStyle = 'rgba(0,0,0,0.85)';
          ctx.fillRect(tx, ty, tw, th);
          ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 1;
          ctx.strokeRect(tx, ty, tw, th);
          ctx.fillStyle = '#fff';
          ctx.font = '12px "UDデジタル教科書体", sans-serif';
          ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.fillText(tip, tx + 7, ty + th/2);
          ctx.restore();
          break;
        }
      }
    }
  } catch(e) {
    console.warn('schoolHint overlay error:', e);
  }
}
// ====== ここまで ======

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

// ★★★ フッターボタンの設定を5ボタンに修正 ★★★

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
const startX = (800 - totalWidth) / 2;

// 各ボタンのx座標を正しく計算（5ボタン配置）
const backButton = { 
  x: startX, 
  y: BUTTON_CONFIG.y, 
  width: BUTTON_CONFIG.width, 
  height: BUTTON_CONFIG.height, 
  text: 'もどる',
  icon: '⬅️'
};

// ★★★ 練習ボタンを2番目に配置 ★★★
const practiceButton = { 
  x: startX + (BUTTON_CONFIG.width + BUTTON_CONFIG.gap) * 1, 
  y: BUTTON_CONFIG.y, 
  width: BUTTON_CONFIG.width, 
  height: BUTTON_CONFIG.height, 
  text: 'マスター',
  icon: '📝'
};

// 漢字図鑑ボタンを3番目に配置
const dexButton = { 
  x: startX + (BUTTON_CONFIG.width + BUTTON_CONFIG.gap) * 2, 
  y: BUTTON_CONFIG.y, 
  width: BUTTON_CONFIG.width, 
  height: BUTTON_CONFIG.height, 
  text: '漢字図鑑',
  icon: '📚'
};

// モンスターボタンを4番目に配置
const monsterButton = { 
  x: startX + (BUTTON_CONFIG.width + BUTTON_CONFIG.gap) * 3, 
  y: BUTTON_CONFIG.y, 
  width: BUTTON_CONFIG.width, 
  height: BUTTON_CONFIG.height, 
  text: '世界ゴトモン',
  icon: '👾'
};

// プロフィール/称号ボタンを5番目に配置
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

// タブ定義（総復習タブを一番右に配置）
const tabs = [
  { label: '4級',   kanken_level: "4",  grade: 7 },
  { label: '3級',   kanken_level: "3",  grade: 8 },
  { label: '準2級', kanken_level: "準2", grade: 9 },
  { label: '2級',   kanken_level: "2",  grade: 10 },
  { label: '総復習', kanken_level: "review", grade: 0 },
];

// 選択中のステージを追跡するプロパティを追加（約85行目付近）
const worldStageSelectScreen = {
  canvas: null,
  ctx: null,
  stages: [],
  stageButtons: [],
  _clickHandler: null,
  _mousemoveHandler: null,
  mouseX: 0,
  mouseY: 0,
  hoveredStage: null,
  selectedStage: null, // 選択中のステージを追跡
  animationTime: 0, // アニメーション用のタイマー
  selectedTabLevel: 4, // デフォルトは4級
  selectedGrade: 7, // デフォルトは7（4級）
  continentInfo: null, // 選択された大陸の情報
  _inputLocked: false, // 二重発火防止の簡易ロック
  // 総復習モード用の大ボタン
  reviewChallengeButton: {
    x: 50,
    y: 200,
    width: 300,
    height: 80,
    text: '今日の復習に挑戦！'
  },
  // 現在が総復習モードかのフラグ
  isReviewMode: false,

  /** 画面表示時の初期化 */
  enter(arg) {
    // BGM 再生
    // publish('playBGM', 'title');
    // 引数が Canvas の場合と props の場合の両方に対応
    const isCanvasArg = arg && typeof arg.getContext === 'function';
    this.canvas = isCanvasArg ? arg : document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    // continentSelect からは props オブジェクトがそのまま渡ってくる
    // stageLoading 等から Canvas が来るケースでは props は空
    this.continentInfo = (!isCanvasArg && arg && typeof arg === 'object') ? arg : {};
    console.log("受け取った大陸情報:", JSON.stringify(this.continentInfo));
    
    // 初期値を設定
    this.selectedTabLevel = "4"; // デフォルトは4級
    this.selectedGrade = 7;     // デフォルトは7（4級）

// 適切な初期化箇所で
this._uncaughtCache = new Map();
this._dex = loadDex();

    // デフォルトの漢検レベルを設定（大陸情報から取得）
    if (this.continentInfo && this.continentInfo.kanken_level) {
      // 漢検レベルを文字列に統一して比較
      const receivedLevel = String(this.continentInfo.kanken_level);
      console.log(`受け取った漢検レベル: ${receivedLevel}, 型=${typeof receivedLevel}`);
      
      // 特殊ケース: 準2級の処理
      if (receivedLevel === "準2") {
        this.selectedTabLevel = "準2";
        this.selectedGrade = 9;
        console.log("準2級を選択しました");
      } 
      // 数値の漢検レベル
      else {
        for (const tab of tabs) {
          if (String(tab.kanken_level) === receivedLevel) {
            this.selectedTabLevel = tab.kanken_level;
            this.selectedGrade = tab.grade;
            console.log(`タブ選択: 漢検レベル=${this.selectedTabLevel}, grade=${this.selectedGrade}`);
            break;
          }
        }
      }
    }

    // ステージデータ初期化（選択された大陸と漢検レベルに応じたフィルタリング）
    this.updateStageList();

    // イベント登録
    this._clickHandler = this.handleClick.bind(this);
    this._mousemoveHandler = this.handleMouseMove.bind(this);
    this.canvas.addEventListener('click', this._clickHandler);
    this.canvas.addEventListener('touchstart', this._clickHandler, { passive: false });
    this.canvas.addEventListener('mousemove', this._mousemoveHandler);
    // ヘッダーUIは使用しない（stageSelect と同じフッター構成に統一）
  },

  /** ステージリストを更新する（漢検レベル切り替え時に呼ばれる） */
  updateStageList() {
    // 総復習モードの切替
    this.isReviewMode = (this.selectedTabLevel === "review" || this.selectedGrade === 0);
    if (this.isReviewMode) {
      this.stages = [];
      this.stageButtons = [];      // ← 直前の級のボタンを消す
      this.selectedStage = null;   // ← 選択状態もリセット
      this.hoveredStage = null;    // ← ホバー情報もリセット
      return;
    }
    // 選択された大陸と学年（grade）でフィルタリング
    console.log(`ステージリスト更新: grade=${this.selectedGrade}, continent=${this.continentInfo.continent}, region=${this.continentInfo.region}`);
    
    // すべてのステージをデバッグ出力
    console.log("利用可能なすべてのステージ:");
    stageData.forEach(s => {
      if (s.grade === this.selectedGrade) {
        console.log(`- ${s.stageId}: grade=${s.grade}, region=${s.region}`);
      }
    });
    
    // 各漢検級に対応するステージを表示する
    // 準2級（grade 9）の場合はアメリカ大陸のステージを表示
    if (this.selectedTabLevel === "準2") {
      console.log("準2級（アメリカ大陸）のステージをフィルタリング");
      this.stages = stageData.filter(s => 
        s.grade === this.selectedGrade && 
        s.region === "アメリカ大陸"
      );
    } 
    // 4級（grade 7）の場合はアジアのステージを表示
    else if (this.selectedTabLevel === "4") {
      console.log("4級（アジア）のステージをフィルタリング");
      this.stages = stageData.filter(s => 
        s.grade === this.selectedGrade && 
        s.region === "アジア"
      );
    }
    // 3級（grade 8）の場合はヨーロッパのステージを表示
    else if (this.selectedTabLevel === "3") {
      console.log("3級（ヨーロッパ）のステージをフィルタリング");
      this.stages = stageData.filter(s => 
        s.grade === this.selectedGrade && 
        s.region === "ヨーロッパ"
      );
    }
    // 2級（grade 10）の場合はアフリカ大陸のステージを表示（185行目付近）
    else if (this.selectedTabLevel === "2") {
      console.log("2級（アフリカ大陸）のステージをフィルタリング");
      this.stages = stageData.filter(s => 
        s.grade === this.selectedGrade && 
        s.region === "アフリカ大陸"  // "アフリカ"から"アフリカ大陸"に修正
      );
    }
    // その他の場合は選択されたgradeのすべてのステージを表示
    else {
      this.stages = stageData.filter(s => s.grade === this.selectedGrade);
    }
    
    console.log(`フィルタリング結果: ${this.stages.length}件のステージが見つかりました。`);
    this.stages.forEach(s => console.log(`- ${s.stageId}: ${s.name}, grade=${s.grade}, region=${s.region}`));
    
    // ステージが見つからない場合のデバッグ情報
    if (this.stages.length === 0) {
      console.warn(`警告: ${this.selectedGrade}年生のステージが見つかりません。`);
    }

        // --- ステージボタンの作成（パネル内に必ず収まるように自動フィット） ---
        const stageCount = this.stages.length;
        // このスコープ内で左パネルのジオメトリを再計算（update() と同じ設定）
        const cw = this.canvas ? this.canvas.width : 800;
        const ch = this.canvas ? this.canvas.height : 600;
        const panelX = 10;
        const panelY = 80;                 // 上余白
        const panelW = cw / 2 - 20;        // 左半分 - マージン
        const panelH = ch - 150;           // フッターバー分の高さを調整
        const listStartY = panelY + 50;    // タイトル分の余白
        const listBottom = panelY + panelH - 12; // パネル下端に少し余白
    
        // ← 追加: ボーナスボタン分(+1)もレイアウトに含める
        const stageCountPlusBonus = stageCount + 1;
    
        let buttonMargin = 6;
        let buttonHeight = 50;                          // 最大高さ
        if (stageCountPlusBonus > 0) {
          const totalAvail = Math.max(0, listBottom - listStartY);
          const fitted = Math.floor((totalAvail - (stageCountPlusBonus - 1) * buttonMargin) / stageCountPlusBonus);
          buttonHeight = Math.max(26, Math.min(50, fitted)); // 下限を少し下げる
          if (buttonHeight <= 30) buttonMargin = 4;
        }
        const fontSize = Math.max(12, Math.min(20, Math.floor(buttonHeight * 0.42)));
        // 横幅はパネル内に確実に収める（左右に20pxのインセット）
        const buttonX = panelX + 20;
        const buttonWidth = Math.max(100, panelW - 40);
    
        this.stageButtons = this.stages.map((stage, index) => ({
          id: stage.stageId,
          text: stage.name,
          x: buttonX,
          y: listStartY + index * (buttonHeight + buttonMargin),
          width: buttonWidth,
          height: buttonHeight,
          fontSize,
          stage,
        }));
    
        // 追加: 世界ステージにもボーナスステージを表示（日本と同仕様）
        const bonusId = `bonus_g${this.selectedGrade}`;
        const levelText = (String(this.selectedTabLevel) === '準2') ? '準2級' : `${this.selectedTabLevel}級`;
        const bonusLabel = `${levelText}ボーナス`;
        this.stageButtons.push({
          id: bonusId,
          text: bonusLabel,
          x: buttonX,
          y: listStartY + this.stageButtons.length * (buttonHeight + buttonMargin),
          width: buttonWidth,
          height: buttonHeight,
          fontSize,
          stage: { stageId: bonusId, name: bonusLabel, grade: this.selectedGrade }
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

  /** マウス移動ハンドラー */
  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    
    this.mouseX = (e.clientX - rect.left) * scaleX;
    this.mouseY = (e.clientY - rect.top) * scaleY;

    // ホバー中のステージを検出
    this.hoveredStage = null;

    // 総復習モードではステージ側のホバー判定を行わない
    if (this.isReviewMode) {
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

    // マップマーカーのホバー判定（総復習モードでは無効）
    for (const stage of (!this.isReviewMode ? this.stages : [])) {
      if (!stage?.pos) continue; // ボーナス等、posがないステージはスキップ
      const { x, y } = stage.pos;
      if (this.mouseX >= x && this.mouseX <= x + MARKER_SIZE && 
          this.mouseY >= y && this.mouseY <= y + MARKER_SIZE) {
        this.hoveredStage = stage;
        return;
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
    const tooltipHeight = 100;

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
    
    // 漢検レベルを表示
    const levelText = typeof this.selectedTabLevel === 'number' ? 
      `漢検 ${this.selectedTabLevel}級 相当` : `漢検 ${this.selectedTabLevel} 相当`;
    ctx.fillText(levelText, tooltipX + 10, tooltipY + yOffset);
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
        ctx.fillText('同じ級の通常ステージ全クリ＋該当級の漢字を全マスターで解放', tooltipX + 10, tooltipY + yOffset + 20);
      }
    }
  },

  /** リッチなボタンを描画するメソッド */
  drawRichButton(ctx, x, y, width, height, label, baseColor = '#2980b9', isHovered = false, isSelected = false) {
    ctx.save();
    
    // ホバー時のスケールとカラー調整
    const scale = isHovered ? 1.05 : 1.0;
    const hoverColor = isHovered ? this.lightenColor(baseColor, 15) : baseColor;
    
    // 選択中のボタンは輪郭を強調
    const borderWidth = isSelected ? 3 : (isHovered ? 2 : 1);
    
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
    
    // 枠線を描画（選択中は明るい色で強調）
    ctx.strokeStyle = isSelected ? '#FFFFFF' : this.darkenColor(hoverColor, 30);
    ctx.lineWidth = borderWidth;
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

  /** パネル背景を描画するメソッド */
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

  /** 毎フレーム描画・更新 */
  update(dt) {
    const { ctx, canvas, stages } = this;
    const cw = canvas.width, ch = canvas.height;
    ctx.clearRect(0, 0, cw, ch);

    // 背景（グラデーション）
    this.animationTime += dt || 16; // デフォルト16ms

    // 背景を描画（グラデーション）
    const bgGradient = ctx.createLinearGradient(0, 0, 0, ch);
    bgGradient.addColorStop(0, '#1a365d'); // 暗い青
    bgGradient.addColorStop(1, '#2c5282'); // やや明るい青
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, cw, ch);

    // ── 総復習モード専用UI ──
    if (this.isReviewMode) {
      // 右側に世界地図（既存の worldMap を使用）
      const mapX = cw / 2;
      const mapY = 60;
      const mapWidth = cw / 2;
      const mapHeight = ch - 120;
      if (images.worldMap) {
        ctx.drawImage(images.worldMap, mapX, mapY, mapWidth, mapHeight);
      } else {
        // フォールバック：背景矩形
        ctx.fillStyle = '#1a365d';
        ctx.fillRect(mapX, mapY, mapWidth, mapHeight);
      }

      // 左側パネル
      const panelX = 10;
      const panelY = 60;
      const panelW = cw / 2 - 20;
      const panelH = ch - 140;
      this.drawPanelBackground(ctx, panelX, panelY, panelW, panelH, 'stone');

      // タイトル
      ctx.fillStyle = 'white';
      ctx.font = '24px "UDデジタル教科書体", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('総復習モード', panelX + panelW / 2, panelY + 20);

      // 説明
      ctx.font = '14px "UDデジタル教科書体", sans-serif';
      ctx.fillStyle = '#ccc';
      ctx.fillText('あなたに最適なステージを自動選択します', panelX + panelW / 2, panelY + 55);

      // 大ボタン
      const btn = this.reviewChallengeButton;
      const isHovered = isMouseOverRect(this.mouseX, this.mouseY, btn);
      // 少し動きのある配色
      const pulse = Math.sin(this.animationTime * 0.003) * 0.2 + 0.8;
      const buttonColor = `hsl(${200 + Math.sin(this.animationTime * 0.002) * 30}, 70%, ${50 + pulse * 10}%)`;
      this.drawRichButton(ctx, btn.x, btn.y, btn.width, btn.height, btn.text, buttonColor, isHovered);
      // 総復習モードではステージボタン/マーカーは描画しないが、
      // この後のフッター描画処理は引き続き実行する（returnしない）
    }

    // 右側の大陸地図を描画（総復習モードではスキップ）
    if (!this.isReviewMode) {
      const mapX = cw / 2;
      const mapY = 60;
      const mapWidth = cw / 2;
      const mapHeight = ch - 120;
      
      // 選択された漢検レベルに対応する画像を表示
      let bgImage = null;
      
            // 文字列比較に修正
            switch (String(this.selectedTabLevel)) {
              case "4":
                bgImage = images.stageSelect7;   // 4級 → 7
                break;
              case "3":
                bgImage = images.stageSelect8;   // 3級 → 8
                break;
              case "準2":
                bgImage = images.stageSelect9;   // 準2級 → 9
                break;
              case "2":
                bgImage = images.stageSelect10;  // 2級 → 10
                break;
              default:
                bgImage = images.worldMap;
            }
      
      
      
      // デバッグ情報を追加
      console.log(`選択された背景画像: selectedTabLevel=${this.selectedTabLevel}, 画像=${bgImage ? '読み込み成功' : '未読み込み'}`);

      if (bgImage) {
        ctx.drawImage(bgImage, mapX, mapY, mapWidth, mapHeight);
      } else {
        // 地図画像がない場合は代替表示
        this.drawFallbackContinentMap(mapX, mapY, mapWidth, mapHeight);
      }

      // 左側のステージリスト背景パネル
      const panelX = 10;
      const panelY = 70; // 元の60から70に変更
      const panelW = cw / 2 - 20;
      const panelH = ch - 140; // フッターバー分の高さを調整
      this.drawPanelBackground(ctx, panelX, panelY, panelW, panelH, 'stone');
    }

    // 改善されたタブ描画 
    drawEnhancedTabs(ctx, tabs, this.selectedTabLevel, cw, this.animationTime, 'kanken');

    // 大陸名とレベルの見出し（総復習モードでは表示しない）
    if (!this.isReviewMode) {
      ctx.fillStyle = 'white';
      ctx.font = 'bold 26px "UDデジタル教科書体", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      // タブに合わせて大陸名を切り替え
      const displayContinent = (() => {
        switch (String(this.selectedTabLevel)) {
          case '4':   return 'アジア';
          case '3':   return 'ヨーロッパ';
          case '準2': return 'アメリカ';
          case '2':   return 'アフリカ';
          default:    return this.continentInfo.continent || '';
        }
      })();

      // 級の表示（"準2級" / "4級" など。先頭の"漢検"は付けない）
      const levelOnlyText = (String(this.selectedTabLevel) === '準2')
        ? '準2級'
        : `${this.selectedTabLevel}級`;

      const title = `${displayContinent}（${levelOnlyText}）`;

      const textWidth = ctx.measureText(title).width;
      const textBgPadding = 10;
      const textBgX = 10 + (cw / 2 - 20) / 2 - textWidth / 2 - textBgPadding;
      const textBgY = 80;
      const textBgWidth = textWidth + textBgPadding * 2;
      const textBgHeight = 36;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(textBgX, textBgY, textBgWidth, textBgHeight);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(textBgX, textBgY, textBgWidth, textBgHeight);

      ctx.fillStyle = 'white';
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.fillText(title, 10 + (cw / 2 - 20) / 2, 85);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    if (!this.isReviewMode && this.stageButtons && this.stageButtons.length > 0) {
      this.stageButtons.forEach(button => {
        const stage = button.stage;
        const isCleared = this.isStageCleared(stage.stageId);
        const isNext = false;
        const isHovered = this.hoveredStage && this.hoveredStage.stageId === stage.stageId;

        // ボタンの色
        let buttonColor = '#2980b9';
        if (isCleared) buttonColor = '#27ae60';
        else if (isNext) buttonColor = '#e74c3c';

        const isSelected = this.selectedStage && this.selectedStage.stageId === stage.stageId;
        if (isSelected) buttonColor = '#FF8C00';

        // 先にボタンを描く
        this.drawRichButton(ctx, button.x, button.y, button.width, button.height, button.text, buttonColor, isHovered, isSelected);

        // ボタンの上に未捕獲数バッジを重ねる
        const uncaught = this._getUncaughtCount(stage.stageId);
        const badgeX = button.x + button.width - 110;
        const badgeY = button.y + 5;
        this._drawUncaughtBadge(ctx, badgeX, badgeY, uncaught);

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
        this.drawRichButton(ctx, button.x, button.y, button.width, button.height, button.text, buttonColor, isHovered, isSelected);

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
        
                // レビュー解放バッジ（小バッジ）
                const reviewUnlocked = !!(gameState.stageReviewUnlocked && gameState.stageReviewUnlocked[stage.stageId]);
                if (reviewUnlocked) {
                  const bx = button.x + button.width - 62;
                  const by = button.y + 5;
                  const bw = 56;
                  const bh = 18;
                  ctx.fillStyle = 'rgba(255, 152, 0, 0.95)';
                  ctx.fillRect(bx, by, bw, bh);
                  ctx.strokeStyle = 'rgba(239, 108, 0, 1)';
                  ctx.lineWidth = 1;
                  ctx.strokeRect(bx, by, bw, bh);
                  ctx.fillStyle = '#fff';
                  ctx.font = '11px "UDデジタル教科書体", sans-serif';
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillText('レビュー', bx + bw / 2, by + bh / 2);
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
            this.ctx.save();
            this.ctx.fillStyle = 'rgba(0,0,0,0.45)';
            this.ctx.fillRect(button.x, button.y, button.width, button.height);
            this.ctx.fillStyle = '#FFD700';
            this.ctx.font = `${Math.max(12, Math.floor(button.height * 0.4))}px sans-serif`;
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('🔒', button.x + 10, button.y + button.height / 2);
            this.ctx.restore();
          }
        }
      });
    } else if (!this.isReviewMode) {
      // ステージがない場合のメッセージ
      const panelX = 10;
      const panelW = cw / 2 - 20;
      ctx.fillStyle = '#ccc';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('この大陸・級のステージはまだありません', panelX + panelW / 2, 200);
    }

    // 各ステージのマーカーを動的に描画（ステータス別表示）- 総復習モードでは表示しない
    if (!this.isReviewMode) {
      stages.forEach(stage => {
        // ステージに位置情報がある場合のみ描画
        if (stage.pos) {
          const { x: markerX, y: markerY } = stage.pos;
          const isCleared = this.isStageCleared(stage.stageId);
          const isHovered = this.hoveredStage && this.hoveredStage.stageId === stage.stageId;
          const isNext = false; // 自動点滅を無効化
          const isSelected = this.selectedStage && this.selectedStage.stageId === stage.stageId;
          
          let markerImage = images.markerPref || images.regionMarker; // ← フォールバックを追加
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
            markerImage = images.markerCleared || images.markerPref || images.regionMarker;
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
            ctx.drawImage(markerImage, markerX - offsetX, markerY - offsetY, drawSize, drawSize);
          } else {
            // 画像がどうしても無い場合のみ矩形フォールバック
            ctx.fillStyle = isCleared ? '#FFD700' : (isNext ? '#FF6B35' : '#f00');
            const drawSize = MARKER_SIZE * scale;
            const offsetX = (drawSize - MARKER_SIZE) / 2;
            const offsetY = (drawSize - MARKER_SIZE) / 2;
            ctx.fillRect(markerX - offsetX, markerY - offsetY, drawSize, drawSize);
          }

          if (markerImage) {
            const drawSize = MARKER_SIZE * scale;
            const offsetX = (drawSize - MARKER_SIZE) / 2;
            const offsetY = (drawSize - MARKER_SIZE) / 2;
            ctx.drawImage(markerImage, markerX - offsetX, markerY - offsetY, drawSize, drawSize);
          } else {
            ctx.fillStyle = isCleared ? '#FFD700' : (isNext ? '#FF6B35' : '#f00');
            const drawSize = MARKER_SIZE * scale;
            const offsetX = (drawSize - MARKER_SIZE) / 2;
            const offsetY = (drawSize - MARKER_SIZE) / 2;
            ctx.fillRect(markerX - offsetX, markerY - offsetY, drawSize, drawSize);
          }

          // ホバー時は追加エフェクトと名前表示
          if (isHovered) {
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 15;
            ctx.fillStyle = '#fff';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(stage.name, markerX, markerY - 20);
          }

          ctx.restore();
        }
      });
    }

    // フッターバーの描画
    this._drawFooterBar(ctx, cw, ch);

    // ツールチップの描画（総復習モード以外）
    if (!this.isReviewMode) {
      this.drawTooltip(this.hoveredStage);
    }
    
    // 学年目安バッジと簡易ツールチップを最後に重ねる
    __wss_renderSchoolHintOverlays(this, ctx);
  },

  /** クリックイベント処理 */
  handleClick(e) {
    // モバイルの二重発火ガード（タップ直後のclickを無視）
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (e.type === 'touchstart') {
      this._lastTouchTime = now;
      if (e.cancelable) e.preventDefault();
    } else if (e.type === 'click') {
      if (this._lastTouchTime && (now - this._lastTouchTime) < 700) return;
    }
    if (this._inputLocked) return;
    this._inputLocked = true;
    setTimeout(() => { this._inputLocked = false; }, 250);

    if (this.isZooming) return; // ズーム中はクリックを無効化
    
    const coords = getGameCoordinates(e, this.canvas);
    if (!isValidCoordinates(coords)) {
      return false; // 黒帯エリアのクリックは無視
    }
    
    const x = coords.x;
    const y = coords.y;

            // 総復習モードのクリック（大ボタン）
            const isReview = (this.selectedTabLevel === 'review' || this.selectedGrade === 0);
            if (isReview) {
              const btn = this.reviewChallengeButton;
              if (isMouseOverRect(x, y, btn)) {
                publish('playSE', 'decide');
      
                // 1) 今日の10問を作る（同日中は固定）
                const today = new Date().toISOString().slice(0,10);
                const cacheKey = `dailyReview_${today}_g${this.selectedGrade}`;
                try {
                  const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
                  if (cached && Array.isArray(cached.ids) && cached.ids.length && cached.stageId) {
                    gameState.quickReviewTargets = cached;
                  } else {
                    // 代表ステージ（左パネルに出ている最初のステージを採用）
                    const representative = (this.stages && this.stages[0]) ? this.stages[0] : null;
                    if (!representative) {
                      alert('復習できるステージが見つかりません。');
                      return;
                    }
                    const stageId = representative.stageId;
                    const stageKanji = getKanjiByStageId(stageId) || [];
                    const stageIdSet = new Set(stageKanji.map(k => String(k.id)));
      
                    // 誤答からそのステージに属するIDのみ抽出
                    const wrongRaw = Array.isArray(gameState.wrongKanjiList) ? gameState.wrongKanjiList : [];
                    const wrongIds = Array.from(new Set(
                      wrongRaw.map(w => (typeof w === 'object' && w && 'id' in w) ? String(w.id) : null)
                             .filter(id => id && stageIdSet.has(id))
                    ));
      
                    // 10件サンプル（不足はステージ内の未マスター等で補完してもOK：ここでは誤答優先で10件に丸める）
                    const pick10 = (arr) => {
                      const a = arr.slice();
                      for (let i = a.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [a[i], a[j]] = [a[j], a[i]];
                      }
                      return a.slice(0, 10);
                    };
                    let ids = pick10(wrongIds);
                    if (ids.length === 0) {
                      alert('復習対象の誤答が見つかりませんでした。');
                      return;
                    }
      
                    const pack = { stageId, ids };
                    gameState.quickReviewTargets = pack;
                    localStorage.setItem(cacheKey, JSON.stringify(pack));
                  }
                } catch {}
      
                // 2) 画面遷移（クイック復習）
                gameState.previousScreen = 'worldStageSelect';
                publish('changeScreen', 'quickReviewPractice');
                return;
              }
              // タブ／フッターはこの後も処理する。ステージボタン／マーカーは後段で無効化する。
            }

    // タブクリック判定
    const tabCount = tabs.length;
    const tabW = this.canvas.width / tabCount;
    const tabH = 60;
    
    if (y <= tabH) {
      const tabIndex = Math.floor(x / tabW);
      if (tabIndex >= 0 && tabIndex < tabs.length) {
        const tab = tabs[tabIndex];
        this.selectedTabLevel = tab.kanken_level;
        this.selectedGrade = tab.grade;
        this.updateStageList();
        publish('playSE', 'decide');
        return;
      }
    }

            // ステージボタンのクリック判定（総復習モードでは無効）
    if (!isReview) {
      for (const button of this.stageButtons) {
        if (isMouseOverRect(x, y, button)) {
          publish('playSE', 'decide');
          if (this.selectedStage && this.selectedStage.stageId === button.stage.stageId) {
            const targetId = button.id;
            // 学年ボーナスの解放判定
            const m = /^bonus_g(\d+)$/i.exec(targetId);
            if (m) {
              const g = parseInt(m[1], 10);
              if (!isBonusUnlocked(g)) {
                publish('playSE', 'wrong');
                alert('この級のボーナスはまだ解放されていません。\n同級の通常ステージをすべてクリアし、該当級の漢字を全てマスターすると解放されます。');
                return;
              }
            }
            // 戻り先を世界編に固定
            gameState.previousScreen = 'worldStageSelect';
            gameState.currentStageId = targetId;
            resetStageProgress(targetId);
            publish('changeScreen', 'stageLoading');
          } else {
            this.selectedStage = button.stage;
          }
          return;
        }
      }
    }

    // 戻るボタンのクリック処理
    if (isMouseOverRect(x, y, backButton)) {
      publish('playSE', 'decide');
      publish('changeScreen', 'continentSelect');
      return;
    }

    // ★★★ 練習ボタンのクリック処理を追加 ★★★
    if (isMouseOverRect(x, y, practiceButton)) {
      publish('playSE', 'decide');
      // 練習バトルの戻り先も世界編に
      gameState.previousScreen = 'worldStageSelect';
      this._startPracticeMode();
      return;
    }

    // 漢字図鑑ボタン
    if (isMouseOverRect(x, y, dexButton)) {
      publish('playSE', 'decide');
      gameState.previousScreen = 'worldStageSelect';
      publish('changeScreen', 'kanjiDex');
      return;
    }

        // モンスターデックスボタン
        if (isMouseOverRect(x, y, monsterButton)) {
          publish('playSE', 'decide');
          gameState.previousScreen = 'worldStageSelect';
          publish('changeScreen', 'monsterDex'); // ← 統合版へ
          return;
        }

    // プロフィール/称号ボタン
    if (isMouseOverRect(x, y, profileButton)) {
      publish('playSE', 'decide');
      gameState.previousScreen = 'worldStageSelect';
      publish('changeScreen', 'profile');
      return;
    }
  },  

  // ファイル内どこか（methods領域）
_getUncaughtCount(stageId) {
  try {
    this._uncaughtCache = this._uncaughtCache || new Map();
    if (this._uncaughtCache.has(stageId)) return this._uncaughtCache.get(stageId);
    const dex = this._dex || loadDex();
    const enemies = getEnemiesByStageId(stageId) || [];
    const ids = enemies.map(e => String(e.id));
    const cnt = ids.filter(id => !dex.has(id)).length;
    this._uncaughtCache.set(stageId, cnt);
    return cnt;
  } catch { return 0; }
},

_drawUncaughtBadge(ctx, x, y, count) {
  if (!count || count <= 0) return;
  const label = `あと ${count} たい！`;
  ctx.save();
  ctx.font = '12px "UDデジタル教科書体", sans-serif';
  const tw = Math.ceil(ctx.measureText(label).width);
  const w = tw + 16, h = 18;
  const r = h / 2;
  ctx.fillStyle = '#f39c12';
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#8e4400';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2);
  ctx.restore();
},

  // ★★★ マスターモード開始処理を追加 ★★★
  /**
   * マスターモードを開始する（worldStageSelect版）
   */
  _startPracticeMode() {
    // 選択されたステージがある場合はそのステージで練習
    if (this.selectedStage) {
      console.log('🎯 マスターモード開始（世界）:', this.selectedStage.stageId);
      gameState.currentStageId = this.selectedStage.stageId;
      gameState.gameMode = 'practice';
      publish('changeScreen', 'practiceBattle');
    } 
    // 総復習モードの場合は推奨ステージで練習
    else if (this.isReviewMode) {
      // 現在の級に応じたステージを選択
      const gradeForReview = this.selectedGrade || 7;
      const stagesForGrade = stageData.filter(s => s.grade === gradeForReview);
      
      if (stagesForGrade.length > 0) {
        const recommendedStage = stagesForGrade[0]; // 最初のステージを選択
        console.log('🎯 総復習モード練習開始（世界）:', recommendedStage.stageId);
        gameState.currentStageId = recommendedStage.stageId;
        gameState.gameMode = 'practice';
        publish('changeScreen', 'practiceBattle');
      } else {
        alert('練習できるステージがありません。');
      }
    }
    // ステージが選択されていない場合
    else {
      alert('練習したいステージを先に選択してください。');
    }
  },
  
  /** 代替大陸地図を描画 */
  drawFallbackContinentMap(x, y, width, height) {
    const ctx = this.ctx;
    
    // 背景（海）
    ctx.fillStyle = '#4682B4';
    ctx.fillRect(x, y, width, height);
    
    // 大陸名に基づいて簡易的な地図を描画
    ctx.fillStyle = '#228B22';
    ctx.strokeStyle = '#006400';
    ctx.lineWidth = 2;
    
    if (this.continentInfo.continent === 'アジア・オセアニア') {
      // アジア大陸の簡略形状
      ctx.beginPath();
      ctx.ellipse(x + width * 0.5, y + height * 0.4, width * 0.4, height * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // オーストラリア
      ctx.beginPath();
      ctx.ellipse(x + width * 0.6, y + height * 0.7, width * 0.15, height * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
    } else if (this.continentInfo.continent === 'ヨーロッパ・中東') {
      // ヨーロッパの簡略形状
      ctx.beginPath();
      ctx.ellipse(x + width * 0.4, y + height * 0.3, width * 0.3, height * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // 中東
      ctx.beginPath();
      ctx.ellipse(x + width * 0.6, y + height * 0.5, width * 0.2, height * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
    } else if (this.continentInfo.continent === 'アフリカ') {
      // アフリカ大陸の簡略形状
      ctx.beginPath();
      ctx.ellipse(x + width * 0.5, y + height * 0.5, width * 0.3, height * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
    } else if (this.continentInfo.continent === 'アメリカ大陸') {
      // 北アメリカ
      ctx.beginPath();
      ctx.ellipse(x + width * 0.4, y + height * 0.3, width * 0.25, height * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // 南アメリカ
      ctx.beginPath();
      ctx.ellipse(x + width * 0.5, y + height * 0.6, width * 0.2, height * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  },

  /** フッターバーの描画 */
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
    this._drawRichFooterButton(ctx, backButton, '#808080', isBackHovered);
    this._drawRichFooterButton(ctx, practiceButton, '#4CAF50', isPracticeHovered); // 緑系（練習用）
    this._drawRichFooterButton(ctx, dexButton, '#2980b9', isDexHovered);
    this._drawRichFooterButton(ctx, monsterButton, '#2980b9', isMonsterHovered);
    this._drawRichFooterButton(ctx, profileButton, '#2980b9', isProfileHovered);
  },

  /** フッター専用のリッチボタン描画（stageSelect と同じ） */
  _drawRichFooterButton(ctx, button, baseColor, isHovered) {
    ctx.save();
    const scale = isHovered ? 1.02 : 1.0;
    const hoverColor = isHovered ? this.lightenColor(baseColor, 15) : baseColor;
    let { x, y, width, height } = button;
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
    const shadowOffset = isHovered ? 3 : 2;
    const shadowOpacity = isHovered ? 0.4 : 0.3;
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowOpacity})`;
    ctx.fillRect(x + shadowOffset, y + shadowOffset, width, height);
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, this.lightenColor(hoverColor, 20));
    gradient.addColorStop(1, this.darkenColor(hoverColor, 20));
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = this.darkenColor(hoverColor, 30);
    ctx.lineWidth = isHovered ? 2 : 1;
    ctx.strokeRect(x, y, width, height);
    const highlightGradient = ctx.createLinearGradient(x, y, x, y + height * 0.3);
    const highlightOpacity = isHovered ? 0.4 : 0.3;
    highlightGradient.addColorStop(0, `rgba(255, 255, 255, ${highlightOpacity})`);
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = highlightGradient;
    ctx.fillRect(x, y, width * 0.8, height * 0.3);
    // アイコン＋テキスト
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (button.icon) {
      ctx.font = '16px sans-serif';
      ctx.fillText(button.icon, x + width * 0.25, y + height / 2);
    }
    ctx.font = '14px "UDデジタル教科書体", sans-serif';
    const textX = button.icon ? x + width * 0.65 : x + width / 2;
    ctx.fillText(button.text, textX, y + height / 2);
    ctx.restore();
  },

  /** 確実にリスナーを解除 */
  exit() {
    if (this.canvas) {
      this.canvas.removeEventListener('click', this._clickHandler);
      this.canvas.removeEventListener('touchstart', this._clickHandler);
      this.canvas.removeEventListener('mousemove', this._mousemoveHandler);
      this.canvas.style.cursor = 'default';
    }
    this._clickHandler = null;
    this._mousemoveHandler = null;
    this.stageButtons = [];
    this.selectedStage = null;
    this.canvas = null;
    this.ctx = null;
  },

  // 他のメソッドはそのまま使用
};

export default worldStageSelectScreen;