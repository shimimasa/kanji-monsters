import { gameState, battleState, addPlayerExp, recordEnemyDefeated } from '../core/gameState.js';
import { drawButton, isMouseOverRect, drawStoneButton } from '../ui/uiRenderer.js';
import { loadMonsterImage, loadBgImage, images, clearImageCache, drawStonePanel } from '../loaders/assetsLoader.js';
import { getEnemiesByStageId, getKanjiByStageId, kanjiData } from '../loaders/dataLoader.js';
import { publish } from '../core/eventBus.js';
import { addKanji } from '../models/kanjiDex.js';
import { addMonster } from '../models/monsterDex.js';
import { checkAchievements } from '../core/achievementManager.js';
// 1. まず、ファイル冒頭にimportを追加
import { getGameCoordinates, isValidCoordinates } from '../utils/coordinateUtils.js';

// battleStateに残り時間プロパティを追加
battleState.timeRemaining = 60;

const ENEMY_FRAME_CONFIG = {
  normal: { min: 1, max: 6 },    // 1-6体目
  elite: { min: 7, max: 9 },     // 7-9体目
  boss: { min: 10, max: Infinity } // 10体目以降
};

// プレイヤーに進行状況を示すUI追加も可能
function getProgressInfo() {
  const order = gameState.currentEnemyIndex + 1;
  if (order <= 6) return `ノーマル戦 ${order}/6`;
  if (order <= 9) return `エリート戦 ${order - 6}/3`;
  return `ボス戦`;
}

/**
 * 設定可能な枠組み判定関数
 */
function getFrameStyleByOrderConfigurable(enemyIndex, isBoss = false) {
  if (isBoss) return 'boss';
  
  const order = enemyIndex + 1;
  
  for (const [style, config] of Object.entries(ENEMY_FRAME_CONFIG)) {
    if (order >= config.min && order <= config.max) {
      return style;
    }
  }
  
  return 'boss'; // フォールバック
}

// 直近に出題された問題を避けるための設定値
const RECENT_QUESTIONS_BUFFER_SIZE = 5; // 直近5問は出題しない

const BTN = {
  back:   { x: 20,  y: 20,  w: 100, h: 30,  label: 'タイトルへ' },
  stage:  { x: 40, y: 20,  w: 220, h: 30,  label: 'ステージ選択（もどる）' },
  attack: { x: 230, y: 380, w: 110, h: 50,  label: 'こうげき' },
  heal:   { x: 350, y: 380, w: 110, h: 50,  label: 'かいふく' },
  hint:   { x: 470, y: 380, w: 110, h: 50,  label: 'ヒント' },
};


const ENEMY_DAMAGE_ANIM_DURATION = 30; // 約0.5秒（攻撃ヒット演出: 400〜600ms）
const ENEMY_ATTACK_ANIM_DURATION = 45; // 約0.75秒（敵の突進/被ダメ: 600〜800ms）
const ENEMY_DEFEAT_ANIM_DURATION = 60; // 約1.0秒（撃破演出: 800〜1000ms）
const PLAYER_HP_ANIM_SPEED = 2;
const DEBUG = false; // 高頻度ログを抑制するトグル

// タイムアウト（setTimeout）を一括管理する簡単ユーティリティ
function setManagedTimeout(fn, ms) {
  const id = setTimeout(fn, ms);
  if (!Array.isArray(battleScreenState._timeouts)) battleScreenState._timeouts = [];
  battleScreenState._timeouts.push(id);
  return id;
}
function clearManagedTimeout(id) {
  clearTimeout(id);
  const arr = battleScreenState._timeouts;
  if (Array.isArray(arr)) {
    const idx = arr.indexOf(id);
    if (idx !== -1) arr.splice(idx, 1);
  }
}

const battleScreenState = {
  canvas: null,
  ctx: null,
  inputEl: null,
  victoryCallback: null,
  stageBgImage: null,
  _keydownHandler: null,
  _clickHandler: null,
  _wheelHandler: null,
  _mousemoveHandler: null, // マウス移動ハンドラーを追加
  logOffset: 0,
  timerId: null,
  _timeouts: [],
  _focusScrollTimers: [], // フォーカス時の再補正タイマー

  // モバイルキーボード状態
  keyboardState: { open: false, bottomInset: 0 },
  // マウス座標を保存するプロパティを追加
  mouseX: 0,
  mouseY: 0,

  // 経験値アニメーション制御用のプロパティを追加
  isAnimatingExp: false,
  expAnimQueue: [],
  levelUpMessage: '',

  // ステージクリア待機フラグを追加
  stageClearPending: false,

  // 画面フラッシュ効果用のプロパティを追加
  flashEffect: {
    active: false,
    timer: 0,
    duration: 15, // フラッシュ持続フレーム数
    color: 'rgba(255, 0, 0, 0.5)' // 赤色の半透明
  },

  // 読みハイライト効果用のプロパティを追加
  readingHighlight: {
    active: false,
    timer: 0,
    duration: 60, // 1秒 = 約60フレーム
    type: null    // 'onyomi' または 'kunyomi'
  },

  // コンボ表示アニメーション用のプロパティを追加
  comboAnimation: {
    active: false,
    timer: 0,
    duration: 30, // アニメーション持続フレーム数
    scale: 1.0,   // 現在のスケール値
    comboCount: 0 // 表示するコンボ数
  },

  // 経験値アニメーション関連の新しいプロパティを追加
  playerExpDisplay: 0,    // 現在表示している経験値
  playerExpTarget: 0,     // 目標経験値
  playerExpAnimating: false, // アニメーション中かどうか
  expAnimSpeed: 1,        // 経験値バーのアニメーション速度

  // 不正解の答えを保存するプロパティを追加
  lastIncorrectAnswer: null,

  // 漢字ボックスのエフェクト用プロパティを追加
  kanjiBoxEffect: {
    active: false,
    timer: 0,
    duration: 0,
    color: 'rgba(46, 204, 113, 0.8)',
    originalSize: { width: 180, height: 180 },
    currentSize: { width: 180, height: 180 },
    maxScale: 1.1,
    pulsePhase: 0
  },

  // レベルアップ演出強化用のプロパティ
  levelUpEffect: {
    active: false,
    timer: 0,
    duration: 120, // 2秒間 (60フレーム/秒として)
    overlayOpacity: 0.5, // オーバーレイの透明度
    pulsateSpeed: 0.05 // メッセージの点滅速度
  },

  // メッセージログのタイプライター効果用プロパティ
  typewriterEffect: {
    active: false,          // アニメーション中かどうか
    targetMessage: "",      // アニメーション対象のメッセージ
    displayedChars: 0,      // 現在表示している文字数
    messageIndex: -1,       // 対象メッセージのインデックス
    charInterval: 2,        // 文字表示の間隔（フレーム数）
    charTimer: 0,           // 次の文字表示までのタイマー
    soundInterval: 3        // タイプ音の間隔（文字数）
  },

  // 経験値パーティクル用のプロパティを追加
  expParticles: {
    active: false,
    particles: [],
    maxParticles: 15,
    sourceX: 0,
    sourceY: 0,
    targetX: 0,
    targetY: 0,
    expAmount: 0
  },

  shakeEffect: {
    active: false,
    timer: 0,
    duration: 0,
    intensity: 0
  },

  // 「１つまえの漢字」パネル関連
  isPrevKanjiPanelOpen: false,
  lastAnsweredKanji: null,

    // 修正2: pressedButtonsプロパティを追加
    pressedButtons: new Set(),

    // ★★★ ここに石版攻撃エフェクト用プロパティを追加 ★★★
  stoneAttackEffect: {
    active: false,
    timer: 0,
    duration: 45, // 約0.75秒
    cracks: [], // ヒビのパス情報
    particles: [], // 破片パーティクル
    flashIntensity: 0,
    shakeIntensity: 0
  },

      // 表示モード: 'current'（最新のみ） or 'blockPaged'（ブロック履歴ページング）
  logMode: 'current',

  // ブロック表示（履歴＋現在位置）
  blockHistory: [],
  currentBlockIndex: -1,
  // showLogBlock を2行基本（必要なら3行）に
   showLogBlock(lines, maxLines = 3) {
     const block = (Array.isArray(lines) ? lines : [String(lines || '')])
       .filter(Boolean).map(String).slice(0, Math.min(maxLines, 3));
    if (!this.blockHistory) this.blockHistory = [];
    this.blockHistory.push(block);
    this.currentBlockIndex = this.blockHistory.length - 1;
    this.visibleLogBlock = block;
    this._logHintDismissed = true;
    this.logOffset = this.currentBlockIndex;

    
 },


/**
 * シールドの色を段階的に変化させる
 * @param {number} currentHp - 現在のシールドHP
 * @param {number} maxHp - 最大シールドHP
 * @returns {Object} RGB値のオブジェクト
 */
getShieldColor(currentHp, maxHp) {
  console.log('🛡️ getShieldColor実行:', currentHp, maxHp);
  
  if (!currentHp || !maxHp || maxHp === 0) {
    console.warn('⚠️ 無効なHP値:', currentHp, maxHp);
    return { r: 100, g: 180, b: 255 }; // デフォルト青色
  }
  
  const integrity = currentHp / maxHp;
  console.log('🛡️ シールド完全性:', integrity);
  
  let color;
  if (integrity > 0.66) {
    // 健全状態：青系
    color = { r: 100, g: 180, b: 255 };
    console.log(' 健全状態 - 青色');
  } else if (integrity > 0.33) {
    // 警戒状態：青紫系
    color = { r: 150, g: 120, b: 255 };
    console.log(' 警戒状態 - 青紫色');
  } else {
    // 危険状態：赤紫系
    color = { r: 200, g: 100, b: 200 };
    console.log(' 危険状態 - 赤紫色');
  }
  
  console.log(' 返す色:', color);
  return color;
},

/**
 * 敵の登場順からフレームスタイルを判定
 * @param {number} enemyIndex - 敵の登場順（0ベース）
 * @param {boolean} isBoss - ボスフラグ
 * @returns {string} フレームスタイル ('normal', 'elite', 'boss')
 */
getFrameStyleByOrder(enemyIndex, isBoss = false) {
  // ボス判定を最優先
  if (isBoss) return 'boss';
  
  // 登場順による判定（1ベースに変換）
  const order = enemyIndex + 1;
  
  if (order <= 7) {
    return 'normal';    // 1-7体目：ノーマル
  } else if (order <= 9) {
    return 'elite';     // 8-9体目：エリート
  } else {
    return 'boss';      // 10体目以降：ボス扱い
  }
},
/**
 * シールドのヒビを描画
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D コンテキスト
 * @param {number} centerX - 中心X座標
 * @param {number} centerY - 中心Y座標
 * @param {number} radius - シールドの半径
 * @param {number} crackLevel - ヒビのレベル（0-2）
 * @param {number} shieldHp - 現在のシールドHP
 */
drawShieldCracks(ctx, centerX, centerY, radius, crackLevel, shieldHp) {
  if (crackLevel === 0) return; // ヒビなし
  
  ctx.save();
  
  // ヒビの基本設定
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  
  // 時間ベースの微細な揺れ（ヒビが成長している感じ）
  const time = Date.now() * 0.001;
  const wobble = Math.sin(time * 3) * 0.02;
  
  if (crackLevel >= 1) {
    // 1段階目：小さなヒビ（上部に2-3本）
    this.drawSingleCrack(ctx, centerX, centerY, radius, -Math.PI/2 + wobble, 0.3);
    this.drawSingleCrack(ctx, centerX, centerY, radius, -Math.PI/3 + wobble, 0.25);
    this.drawSingleCrack(ctx, centerX, centerY, radius, -2*Math.PI/3 + wobble, 0.25);
  }
  
  if (crackLevel >= 2) {
    // 2段階目：大きなヒビ（全体に広がる）
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 200, 200, 0.9)';
    
    // メインのヒビ（縦に貫通）
    this.drawSingleCrack(ctx, centerX, centerY, radius, -Math.PI/2 + wobble, 0.8);
    this.drawSingleCrack(ctx, centerX, centerY, radius, Math.PI/2 + wobble, 0.7);
    
    // サブのヒビ（放射状）
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i / 6) + wobble;
      const length = 0.4 + Math.random() * 0.2;
      this.drawSingleCrack(ctx, centerX, centerY, radius, angle, length);
    }
    
    // クモの巣状のヒビ
    this.drawWebCracks(ctx, centerX, centerY, radius * 0.6);
  }
  
  ctx.restore();
},

/**
 * 単一のヒビを描画
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D コンテキスト
 * @param {number} centerX - 中心X座標
 * @param {number} centerY - 中心Y座標
 * @param {number} radius - シールドの半径
 * @param {number} angle - ヒビの角度
 * @param {number} lengthRatio - ヒビの長さ（0-1）
 */
drawSingleCrack(ctx, centerX, centerY, radius, angle, lengthRatio) {
  const startRadius = radius * 0.2;
  const endRadius = radius * lengthRatio;
  
  const startX = centerX + Math.cos(angle) * startRadius;
  const startY = centerY + Math.sin(angle) * startRadius;
  const endX = centerX + Math.cos(angle) * endRadius;
  const endY = centerY + Math.sin(angle) * endRadius;
  
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  
  // ヒビを少し曲がらせる（自然な感じに）
  const midX = (startX + endX) / 2 + Math.sin(angle + Math.PI/2) * (Math.random() - 0.5) * 10;
  const midY = (startY + endY) / 2 + Math.cos(angle + Math.PI/2) * (Math.random() - 0.5) * 10;
  
  ctx.quadraticCurveTo(midX, midY, endX, endY);
  ctx.stroke();
},

/**
 * クモの巣状のヒビを描画
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D コンテキスト
 * @param {number} centerX - 中心X座標
 * @param {number} centerY - 中心Y座標
 * @param {number} innerRadius - 内側の半径
 */
drawWebCracks(ctx, centerX, centerY, innerRadius) {
  ctx.strokeStyle = 'rgba(255, 220, 220, 0.6)';
  ctx.lineWidth = 1;
  
  // 同心円状のヒビ
  for (let r = innerRadius * 0.5; r <= innerRadius; r += innerRadius * 0.25) {
    ctx.beginPath();
    // 完全な円ではなく、部分的な弧を描画
    for (let i = 0; i < 8; i++) {
      const startAngle = (Math.PI * 2 * i / 8);
      const endAngle = startAngle + (Math.PI / 8);
      
      if (Math.random() > 0.3) { // 70%の確率でヒビを描画
        ctx.arc(centerX, centerY, r, startAngle, endAngle);
      }
    }
    ctx.stroke();
  }
},

/**
 * シールド危険状態の警告エフェクト
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D コンテキスト
 * @param {number} centerX - 中心X座標
 * @param {number} centerY - 中心Y座標
 * @param {number} radius - シールドの半径
 */
drawShieldWarningEffect(ctx, centerX, centerY, radius) {
  // 点滅する赤い警告リング
  const time = Date.now();
  const flashAlpha = (Math.sin(time * 0.01) + 1) * 0.3; // 0-0.6の範囲で点滅
  
  ctx.save();
  ctx.strokeStyle = `rgba(255, 50, 50, ${flashAlpha})`;
  ctx.lineWidth = 3;
  ctx.setLineDash([5, 5]); // 破線効果
  
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius + 5, 0, Math.PI * 2);
  ctx.stroke();
  
  // 警告パーティクル
  for (let i = 0; i < 6; i++) {
    const angle = (time * 0.005 + i * Math.PI / 3) % (Math.PI * 2);
    const particleRadius = radius + 10 + Math.sin(time * 0.01 + i) * 5;
    const particleX = centerX + Math.cos(angle) * particleRadius;
    const particleY = centerY + Math.sin(angle) * particleRadius;
    
    ctx.fillStyle = `rgba(255, 100, 100, ${flashAlpha})`;
    ctx.beginPath();
    ctx.arc(particleX, particleY, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
},

/**
 * シールド破壊時の爆発エフェクト
 * @param {number} centerX - 中心X座標
 * @param {number} centerY - 中心Y座標
 * @param {number} radius - 爆発の半径
 */
startShieldBreakEffect(centerX, centerY, radius) {
  // 爆発エフェクト用のパーティクルシステムを初期化
  this.shieldBreakEffect = {
    active: true,
    particles: [],
    centerX: centerX,
    centerY: centerY,
    timer: 60, // 1秒間のエフェクト
    maxTimer: 60
  };
  
  // パーティクルを生成
  for (let i = 0; i < 20; i++) {
    const angle = (Math.PI * 2 * i) / 20;
    const speed = 3 + Math.random() * 4;
    
    this.shieldBreakEffect.particles.push({
      x: centerX,
      y: centerY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: 40 + Math.random() * 20,
      size: 3 + Math.random() * 3,
      color: `hsl(${200 + Math.random() * 60}, 100%, ${60 + Math.random() * 30}%)`,
      alpha: 1
    });
  }
  
  // 破壊SE再生
  publish('playSE', 'shieldBreak');
},

/**
 * シールド破壊エフェクトの更新（update関数内で呼び出し）
 */
updateShieldBreakEffect() {
  if (!this.shieldBreakEffect || !this.shieldBreakEffect.active) return;
  
  const effect = this.shieldBreakEffect;
  effect.timer--;
  
  // パーティクルの更新
  for (let i = effect.particles.length - 1; i >= 0; i--) {
    const particle = effect.particles[i];
    
    particle.life++;
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vx *= 0.98; // 摩擦
    particle.vy *= 0.98;
    
    // フェードアウト
    particle.alpha = 1 - (particle.life / particle.maxLife);
    
    // パーティクル描画
    this.ctx.save();
    this.ctx.globalAlpha = particle.alpha;
    this.ctx.fillStyle = particle.color;
    this.ctx.beginPath();
    this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
    
    // 寿命切れのパーティクルを削除
    if (particle.life >= particle.maxLife) {
      effect.particles.splice(i, 1);
    }
  }
  
  // エフェクト終了判定
  if (effect.timer <= 0 && effect.particles.length === 0) {
    this.shieldBreakEffect.active = false;
  }
},
 
  /**
   * 漢字ボックスのエフェクトを開始するメソッド
   * @param {string} color - エフェクトの色
   * @param {number} duration - エフェクトの持続フレーム数
   */
  startKanjiBoxEffect(color = 'rgba(46, 204, 113, 0.8)', duration = 15) {
    this.kanjiBoxEffect.active = true;
    this.kanjiBoxEffect.timer = duration;
    this.kanjiBoxEffect.duration = duration;
    this.kanjiBoxEffect.color = color;
    this.kanjiBoxEffect.pulsePhase = 0;
    if (DEBUG) console.log('漢字ボックスエフェクト開始:', color, duration); // デバッグ用
  },


  
  /**
   * シェイクエフェクトを開始するメソッド
   * @param {number} duration - エフェクトの持続フレーム数
   * @param {number} intensity - 震えの強さ
   */
  startShakeEffect(duration = 15, intensity = 5) {
    this.shakeEffect.active = true;
    this.shakeEffect.timer = duration;
    this.shakeEffect.duration = duration;
    this.shakeEffect.intensity = intensity;
    if (DEBUG) console.log('シェイクエフェクト開始:', duration, intensity); // デバッグ用
  },

  // ★★★ ここに石版攻撃エフェクト関連メソッドを追加 ★★★
  /**
   * 石版攻撃エフェクトを開始するメソッド
   */
  startStoneAttackEffect(centerX, centerY, width, height) {
    const effect = this.stoneAttackEffect;
    effect.active = true;
    effect.timer = effect.duration;
    effect.cracks = [];
    effect.particles = [];
    effect.flashIntensity = 1.0;
    effect.shakeIntensity = 8;
    
    // ヒビのパターンを生成（放射状 + ランダム）
    this.generateCracks(centerX, centerY, width, height);
    
    // 破片パーティクルを生成
    this.generateStoneParticles(centerX, centerY, width, height);
    
    // 既存のシェイクエフェクトも併用
    this.startShakeEffect(20, 6);
    
    // 攻撃音を再生
    publish('playSE', 'correct'); // 既存のSEを使用
    
    console.log('🪨 石版攻撃エフェクト開始');
  },

  /**
   * ヒビのパターンを生成
   */
  generateCracks(centerX, centerY, width, height) {
    const cracks = this.stoneAttackEffect.cracks;
    const numMainCracks = 3 + Math.floor(Math.random() * 3); // 3-5本のメインクラック
    
    // メインクラック（中心から放射状）
    for (let i = 0; i < numMainCracks; i++) {
      const angle = (Math.PI * 2 * i / numMainCracks) + (Math.random() - 0.5) * 0.8;
      const length = (Math.min(width, height) / 2) * (0.6 + Math.random() * 0.4);
      
      const crack = {
        startX: centerX + (Math.random() - 0.5) * 20,
        startY: centerY + (Math.random() - 0.5) * 20,
        endX: centerX + Math.cos(angle) * length,
        endY: centerY + Math.sin(angle) * length,
        branches: [], // 枝分かれ
        opacity: 0.8 + Math.random() * 0.2
      };
      
      // ランダムな枝分かれを追加
      if (Math.random() > 0.4) {
        const branchAngle = angle + (Math.random() - 0.5) * 1.0;
        const branchLength = length * (0.3 + Math.random() * 0.4);
        const branchStartRatio = 0.3 + Math.random() * 0.4;
        
        crack.branches.push({
          startX: crack.startX + (crack.endX - crack.startX) * branchStartRatio,
          startY: crack.startY + (crack.endY - crack.startY) * branchStartRatio,
          endX: crack.startX + Math.cos(branchAngle) * branchLength,
          endY: crack.startY + Math.sin(branchAngle) * branchLength,
          opacity: crack.opacity * 0.7
        });
      }
      
      cracks.push(crack);
    }
  },

  /**
   * 石の破片パーティクルを生成
   */
  generateStoneParticles(centerX, centerY, width, height) {
    const particles = this.stoneAttackEffect.particles;
    const numParticles = 8 + Math.floor(Math.random() * 6); // 8-13個の破片
    
    for (let i = 0; i < numParticles; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      const size = 2 + Math.random() * 4;
      
      particles.push({
        x: centerX + (Math.random() - 0.5) * width * 0.6,
        y: centerY + (Math.random() - 0.5) * height * 0.6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1, // 重力を考慮して上向き初速
        size: size,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
        life: 0,
        maxLife: 30 + Math.random() * 15,
        color: `rgb(${180 + Math.random() * 40}, ${170 + Math.random() * 40}, ${160 + Math.random() * 30})`, // 石っぽい色
        opacity: 1.0
      });
    }
  },

  /**
   * 石版攻撃エフェクトの更新と描画
   */
  updateStoneAttackEffect() {
    const effect = this.stoneAttackEffect;
    if (!effect.active) return;
    
    effect.timer--;
    const progress = 1 - (effect.timer / effect.duration);
    
    // フラッシュ強度の減衰
    effect.flashIntensity = Math.max(0, 1 - progress * 2);
    
    // パーティクルの更新
    for (let i = effect.particles.length - 1; i >= 0; i--) {
      const particle = effect.particles[i];
      particle.life++;
      
      // 物理更新
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.2; // 重力
      particle.rotation += particle.rotationSpeed;
      
      // フェードアウト
      const lifeRatio = particle.life / particle.maxLife;
      particle.opacity = Math.max(0, 1 - lifeRatio);
      
      // 寿命チェック
      if (particle.life >= particle.maxLife) {
        effect.particles.splice(i, 1);
      }
    }
    
    // エフェクト終了判定
    if (effect.timer <= 0) {
      effect.active = false;
      effect.cracks = [];
      effect.particles = [];
    }
  },

  /**
   * 石版攻撃エフェクトの描画
   */
  drawStoneAttackEffect(kanjiBoxX, kanjiBoxY, kanjiBoxW, kanjiBoxH) {
    const effect = this.stoneAttackEffect;
    if (!effect.active) return;
    
    this.ctx.save();
    
    // クリッピング（漢字ボックス内のみに描画を制限）
    this.ctx.beginPath();
    this.ctx.rect(kanjiBoxX, kanjiBoxY, kanjiBoxW, kanjiBoxH);
    this.ctx.clip();
    
    // フラッシュエフェクト
    if (effect.flashIntensity > 0) {
      this.ctx.fillStyle = `rgba(255, 255, 255, ${effect.flashIntensity * 0.4})`;
      this.ctx.fillRect(kanjiBoxX, kanjiBoxY, kanjiBoxW, kanjiBoxH);
    }
    
    // ヒビの描画
    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';
    
    for (const crack of effect.cracks) {
      this.ctx.globalAlpha = crack.opacity;
      
      // メインクラック
      this.ctx.beginPath();
      this.ctx.moveTo(crack.startX, crack.startY);
      this.ctx.lineTo(crack.endX, crack.endY);
      this.ctx.stroke();
      
      // 枝分かれ
      for (const branch of crack.branches) {
        this.ctx.globalAlpha = branch.opacity;
        this.ctx.beginPath();
        this.ctx.moveTo(branch.startX, branch.startY);
        this.ctx.lineTo(branch.endX, branch.endY);
        this.ctx.stroke();
      }
    }
    
    this.ctx.restore();
    
    // 破片パーティクル（クリッピング外でも描画）
    for (const particle of effect.particles) {
      this.ctx.save();
      this.ctx.globalAlpha = particle.opacity;
      this.ctx.translate(particle.x, particle.y);
      this.ctx.rotate(particle.rotation);
      
      // 石の破片を四角形で描画
      this.ctx.fillStyle = particle.color;
      this.ctx.fillRect(-particle.size/2, -particle.size/2, particle.size, particle.size);
      
      // 破片の輪郭
      this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(-particle.size/2, -particle.size/2, particle.size, particle.size);
      
      this.ctx.restore();
    }
  },

  /** 画面がアクティブになったときの初期化 */
  enter(canvasEl, onVictory) {
    try {
      // デバッグ情報
      console.log("🧪 battleScreen.enter() 実行", {
        canvasEl: canvasEl,
        gameStateId: gameState.currentStageId
      });
      
      if (!gameState.currentStageId) {
        alert('ステージIDが未設定です。タイトルに戻ります。');
        publish('changeScreen', 'title');
        return;
      }
      
     // ▼▼▼ 修正：設定から回復回数上限を取得 ▼▼▼
    const maxHealCount = this.getMaxHealCountFromSettings();
    gameState.playerStats.healCount = maxHealCount;
    console.log(`🔄 回復回数をリセット: ${maxHealCount}回（設定値）`);
    // ▲▲▲ ここまで修正 ▲▲▲

      // ステージIDに基づいて適切なBGMを選択
      const bgmKey = this.getBGMKeyForStage(gameState.currentStageId);
      console.log(`🎵 ステージ ${gameState.currentStageId} のBGM: ${bgmKey}`);
      
      // 選択されたBGMを再生
      publish('playBGM', bgmKey);
      
      // バトル開始時にプレイヤー HP とターン状態を初期化
      gameState.playerStats.hp       = gameState.playerStats.maxHp;
      battleState.turn               = 'player';
      battleState.inputEnabled       = true;
      battleState.comboCount         = 0;
      battleState.message            = '';
      battleState.enemyAction        = null;
      battleState.enemyActionTimer   = 0;
      
      // 経験値アニメーション関連の初期化
      this.isAnimatingExp = false;
      this.expAnimQueue = [];
      this.levelUpMessage = '';
      
      // チャレンジモードの場合、タイマーを開始
      if (gameState.gameMode === 'challenge') {
        battleState.timeRemaining = 60;
        this.timerId = setInterval(() => {
          battleState.timeRemaining--;
          if (battleState.timeRemaining <= 0) {
            clearInterval(this.timerId);
            this.timerId = null;
            publish('changeScreen', 'gameOver');
          }
        }, 1000);
      }

      // ※※※ 重要な修正: キャンバス要素の取得 ※※※
      // 引数のcanvasElがnullまたはundefinedの場合は、DOMから取得する
      if (!canvasEl) {
        console.log("⚠️ canvasEl引数がありません。DOMから取得します。");
        canvasEl = document.getElementById('gameCanvas');
      }
      
      // 最終チェック
      if (!canvasEl) {
        throw new Error("キャンバス要素が見つかりません");
      }
      
      this.canvas = canvasEl;
      this.ctx = this.canvas.getContext('2d');
      
      if (!this.ctx) {
        throw new Error("Canvas 2Dコンテキストの取得に失敗しました");
      }
      
      // 以下、通常の初期化処理
      this.inputEl = document.getElementById('kanjiInput');
      
      if (!this.inputEl) {
        console.error('kanjiInput要素が見つかりません');
        // ここではエラーをスローせず、続行する
      } else {
        // 入力欄を確実に表示
        this.inputEl.style.display = 'block';
        this.inputEl.placeholder = 'よみを にゅうりょく';
        
        // Enter キーで最後に選択したコマンドを呼び出す
        this._keydownHandler = e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (battleState.turn === 'player' && battleState.inputEnabled) {
              const mode = battleState.lastCommandMode || 'attack';
              setTimeout(() => {
                try {
                  if (mode === 'attack') { if (typeof onAttack === 'function') onAttack(); else { console.error('onAttack関数が定義されていません'); battleState.inputEnabled = true; } }
                  else if (mode === 'heal') { if (typeof onHeal === 'function') onHeal(); else { console.error('onHeal関数が定義されていません'); battleState.inputEnabled = true; } }
                  else { if (typeof onHint === 'function') onHint(); else { console.error('onHint関数が定義されていません'); battleState.inputEnabled = true; } }
                } catch (error) {
                  console.error('処理中にエラーが発生しました:', error);
                  battleState.inputEnabled = true;
                  if (this.inputEl) { this.inputEl.value = ''; }
                }
              }, 0);
            }
          }
        };
        this.inputEl.addEventListener('keydown', this._keydownHandler);

        // モバイル入力最適化＆キーボード追従
        this.inputEl.setAttribute('inputmode', 'kana');
        this.inputEl.setAttribute('autocapitalize', 'off');
        this.inputEl.setAttribute('autocorrect', 'off');
        this.inputEl.setAttribute('spellcheck', 'false');
        this._setupMobileViewportWorkarounds();
      }

      this.victoryCallback = onVictory;

      // クリア保留フラグを毎回リセット（再入場で勝利画面に飛ばないように）
      this.stageClearPending = false;

      // 各リストを初期化
      gameState.correctKanjiList = [];
      gameState.wrongKanjiList = [];

      // 追加: バトル開始時にログを初期化（漢字切替時にはリセットしない）
      battleState.log = [];

      // 背景画像をキャッシュから取得
      try {
        this.stageBgImage = images[`bg_${gameState.currentStageId}`] || null;
        console.log(`🖼️ 背景画像取得: ${gameState.currentStageId}`, this.stageBgImage ? '成功' : '失敗');
      } catch (e) {
        console.warn('背景画像が見つかりませんでした:', e);
        this.stageBgImage = null;
      }

      // ステージデータの取得
      gameState.enemies   = getEnemiesByStageId(gameState.currentStageId).map(src => {
        // 破壊的変更の影響を避けるためクローン
        const e = { ...src };
        // 画像は後続でセット、ここでは基本ステータスを初期化
        e.hp = e.maxHp;
        if (e.isBoss) {
          const baseShield = (typeof e.shieldHp === 'number') ? e.shieldHp : 3;
          e.originalShieldHp = baseShield;
          e.shieldHp = baseShield;
        } else {
          e.originalShieldHp = undefined;
        }
        return e;
      });
      gameState.kanjiPool = getKanjiByStageId(gameState.currentStageId);
      
      if (!gameState.kanjiPool.length) {
        alert('このステージに紐づく漢字データがありません。\nステージ選択へ戻ります。');
        publish('changeScreen', 'stageSelect');
        return;
      }
      
      // 弱点別プールをステージ開始時に再計算
      const hasAny = (v) => (Array.isArray(v) && v.length > 0) || (typeof v === 'string' && v.trim().length > 0);
      battleState.kanjiPool_onyomi = gameState.kanjiPool.filter(k => hasAny(k.onyomi));
      battleState.kanjiPool_kunyomi = gameState.kanjiPool.filter(k => hasAny(k.kunyomi));

      gameState.currentEnemyIndex = 0;
      battleState.recentKanjiIds = [];
      battleState.shuffledKanjiList = [...gameState.kanjiPool].sort(() => Math.random() - 0.5);
      battleState.currentKanjiIndex = 0;

      // 敵画像をキャッシュから取得（クローン済みに対してセット）
      for (const e of gameState.enemies) {
        e.img = images[e.id] || null;
        e.hp  = e.maxHp;
        if (e.isBoss) {
          const baseShield = (typeof e.originalShieldHp === 'number')
            ? e.originalShieldHp
            : (typeof e.shieldHp === 'number' ? e.shieldHp : 3);
          e.originalShieldHp = baseShield;
          e.shieldHp = baseShield;
        } else {
          e.originalShieldHp = undefined;
        }
      }

      // 表示用HPステートを初期化
      battleState.playerHpDisplay = gameState.playerStats.hp;
      battleState.playerHpTarget = gameState.playerStats.hp;
      battleState.playerHpAnimating = false;
      battleState.lastAnswered = null;

            // 敵の生成と最初の漢字を選択
            spawnEnemy();
            pickNextKanji();
            this.logOffset = 0;
      
           // ステージ開始ごとにブロック履歴をリセット（ステージ跨ぎ持ち越し防止）
           this.blockHistory = [];
           this.currentBlockIndex = -1;
           this.visibleLogBlock = [];
           try { localStorage.removeItem('bs_blockHistory'); } catch {}
      

      // イベントハンドラの登録
      this.registerHandlers();

      // コンボアニメーション関連の初期化
      this.comboAnimation.active = false;
      this.comboAnimation.timer = 0;
      this.comboAnimation.scale = 1.0;
      this.comboAnimation.comboCount = 0;

      const player = gameState.playerStats;
            this.playerExpDisplay = player.exp;
            this.playerExpTarget = player.exp;
            this.playerExpAnimating = false;

      // ヒント初期化
      gameState.hintLevel = 0;
      this.currentHintText = '';
      // 下部ヘルプ（ピル型）初期化＆初回ガイド
      this.helpHint = { visible: true, text: 'Enterキーでこうげき', timer: 120, alpha: 1 };

      console.log("✅ battleScreen.enter() 完了");
      
    } catch (error) {
      // エラーハンドリング
      console.error("❌ battleScreen.enter() でエラー発生:", error);
      alert(`ゲーム画面の初期化に失敗しました: ${error.message}\nステージ選択に戻ります。`);
      publish('changeScreen', 'stageSelect');
    }
  },
// 2. 設定から回復回数上限を取得する新しいメソッド
/** 設定から回復回数の上限を取得 */
getMaxHealCountFromSettings() {
  try {
    const savedHealCount = localStorage.getItem('maxHealCount');
    if (savedHealCount) {
      const count = parseInt(savedHealCount, 10);
      // 1-5の範囲内で有効な値かチェック
      if (count >= 1 && count <= 5) {
        return count;
      }
    }
    // デフォルト値
    return 3;
  } catch (error) {
    console.error('回復回数設定の取得に失敗:', error);
    return 3; // エラー時のフォールバック
  }
},
  /**
     /**
   * ステージIDから適切なBGMキーを取得する
   * @param {string} stageId - ステージID
   * @returns {string} BGMのキー
   */
  getBGMKeyForStage(stageId) {
    // ボス戦の場合
    if (stageId && stageId.includes('boss')) {
      return 'boss';
    }
    // エリア付きステージは a / b をランダム
    if (/_area\d+$/i.test(stageId)) {
      const ab = Math.random() < 0.5 ? 'a' : 'b';
      return `${stageId}_${ab}`;
    }
    // その他はステージIDをそのまま使用
    return stageId;
  },

  getEnemyAttackMode() {
    try { return localStorage.getItem('enemyAttackMode') || 'onMistakeOnly'; } catch { return 'onMistakeOnly'; }
  },
  shouldEnemyAttackAfterCorrect() {
    return this.getEnemyAttackMode() !== 'onMistakeOnly';
  },
  /** 1フレームごとの描画更新 */
  update(dt) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // ① 背景描画 (画像 or グラデ)
    if (this.stageBgImage) {
      // ステージ背景画像がある場合は画像を描画
      this.ctx.drawImage(this.stageBgImage, 0, 0, this.canvas.width, this.canvas.height);
    } else {
      // 背景画像がない場合はグラデーション背景を使用
    const grad = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    grad.addColorStop(0, '#1e3c72');
    grad.addColorStop(1, '#2a5298');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

       // ② 左上に「ステージ選択」ボタンを描画（リッチなデザイン）
       [BTN.stage].forEach(b => {
        const isHovered = isMouseOverRect(this.mouseX, this.mouseY, b);
        this.ctx.fillStyle = isHovered ? '#4e6d8c' : '#34495e';
        this.ctx.fillRect(b.x, b.y, b.w, b.h);
        this.ctx.fillStyle = 'white';
        this.ctx.font = '16px "UDデジタル教科書体", sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2);
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(b.x, b.y, b.w, b.h);
      });

    /* 敵（新しいモンスター枠付き） */
const enemy = gameState.currentEnemy;
const ex = 500, ey = 120, ew = 240, eh = 120;

// アニメーション用オフセット計算
let offsetX = 0, offsetY = 0, rotateAngle = 0, alpha = 1;
if (battleState.enemyAction === 'damage' && battleState.enemyActionTimer > 0) {
  offsetX = (Math.random() - 0.5) * 20; 
  offsetY = (Math.random() - 0.5) * 10;
  battleState.enemyActionTimer--;
  if (battleState.enemyActionTimer === 0) {
    battleState.enemyAction = null;
  }
}
else if (battleState.enemyAction === 'attack' && battleState.enemyActionTimer > 0) {
  const total = ENEMY_ATTACK_ANIM_DURATION;
  const half  = total / 2;
  const t     = battleState.enemyActionTimer;
  const progress = (half - Math.abs(t - half)) / half;
  offsetX = -progress * 30;
  battleState.enemyActionTimer--;
  if (battleState.enemyActionTimer === 0) {
    battleState.enemyAction = null;
  }
}

if (battleState.enemyAction === 'defeat' && battleState.enemyActionTimer > 0) {
  const total    = ENEMY_DEFEAT_ANIM_DURATION;
  const timer    = battleState.enemyActionTimer;
  const progress = (total - timer) / total;
  rotateAngle    = progress * (Math.PI / 2);
  alpha          = 1 - progress;
  battleState.enemyActionTimer--;
  if (battleState.enemyActionTimer === 0) {
    battleState.enemyAction = null;
  }
}

// 1. モンスター枠を描画
const frameArea = drawMonsterFrame(this.ctx, ex - 10, ey - 10, ew + 20, eh + 20, enemy);

// 直近の表示領域を保存（他処理で参照するため）
this._lastMonsterFrameArea = frameArea;

// 2. 枠内でモンスター画像を描画
this.ctx.save();
this.ctx.globalAlpha = alpha;

// クリッピング（枠からはみ出さないように）
this.ctx.beginPath();
this.ctx.rect(frameArea.x, frameArea.y, frameArea.width, frameArea.height);
this.ctx.clip();

// モンスター画像の位置を枠内に調整
const imageX = frameArea.x + (frameArea.width - ew) / 2 + offsetX;
const imageY = frameArea.y + (frameArea.height - eh) / 2 + offsetY;

// 回転の中心点を調整
this.ctx.translate(imageX + ew/2, imageY + eh/2);
this.ctx.rotate(rotateAngle);

// ★★★ シールド描画を敵画像の前に配置（修正版）★★★
if (enemy && enemy.isBoss && enemy.shieldHp > 0) {
  try {
    console.log('シールド描画開始:', enemy.shieldHp);
    
    // **重要な修正**: モンスター枠のサイズを考慮してシールド半径を調整
    const frameArea = drawMonsterFrame(this.ctx, ex - 10, ey - 10, ew + 20, eh + 20, enemy);
    
    // シールド半径をモンスター枠の実際の表示エリアに基づいて計算
    const shieldRadius = Math.min(frameArea.width, frameArea.height) * 0.45; // 0.6から0.45に調整してより適切なサイズに
    const maxShieldHp = enemy.originalShieldHp || 3;
    const currentShieldHp = enemy.shieldHp;
    
    // シールドの中心をモンスター枠の表示エリアの中心に設定
    const shieldCenterX = 0; // 既に回転の中心点に変換済みのため、原点基準
    const shieldCenterY = 0;
    
    const shieldIntegrity = currentShieldHp / maxShieldHp;
    const basePulse = Math.sin(Date.now() / 300) + 1;
    
    let shieldOpacity, crackLevel;
    
    if (currentShieldHp === 3) {
      shieldOpacity = 0.3 + basePulse * 0.1;
      crackLevel = 0;
    } else if (currentShieldHp === 2) {
      shieldOpacity = 0.25 + basePulse * 0.08;
      crackLevel = 1;
    } else if (currentShieldHp === 1) {
      shieldOpacity = 0.2 + basePulse * 0.12;
      crackLevel = 2;
    }
    
    let shieldColor;
    try {
      shieldColor = this.getShieldColor(currentShieldHp, maxShieldHp);
      if (!shieldColor || typeof shieldColor.r === 'undefined') {
        throw new Error('シールドカラーが正しく取得できません');
      }
    } catch (error) {
      console.warn('シールドカラー取得エラー:', error);
      shieldColor = { r: 100, g: 180, b: 255 };
    }
    
    // シールドのグラデーション（サイズ調整済み）
    const shieldGrad = this.ctx.createRadialGradient(
      shieldCenterX, shieldCenterY, shieldRadius * 0.7, 
      shieldCenterX, shieldCenterY, shieldRadius
    );
    shieldGrad.addColorStop(0, `rgba(${shieldColor.r}, ${shieldColor.g}, ${shieldColor.b}, 0)`);
    shieldGrad.addColorStop(0.7, `rgba(${shieldColor.r}, ${shieldColor.g}, ${shieldColor.b}, ${shieldOpacity * 0.5})`);
    shieldGrad.addColorStop(1, `rgba(${shieldColor.r}, ${shieldColor.g}, ${shieldColor.b}, ${shieldOpacity})`);
    
    this.ctx.fillStyle = shieldGrad;
    this.ctx.beginPath();
    this.ctx.arc(shieldCenterX, shieldCenterY, shieldRadius, 0, Math.PI * 2);
    this.ctx.fill();
    
    const outlineAlpha = Math.min(1, shieldOpacity + 0.2);
    this.ctx.strokeStyle = `rgba(${Math.min(255, shieldColor.r + 50)}, ${Math.min(255, shieldColor.g + 50)}, ${Math.min(255, shieldColor.b + 50)}, ${outlineAlpha})`;
    this.ctx.lineWidth = 2;
    
    if (currentShieldHp < maxShieldHp) {
      this.ctx.lineWidth = 2 + Math.sin(Date.now() / 100) * 0.5;
    }
    
    this.ctx.stroke();
    
    // シールドのヒビ描画（半径をframeSizeに合わせて調整）
    try {
      if (typeof this.drawShieldCracks === 'function') {
        this.drawShieldCracks(this.ctx, shieldCenterX, shieldCenterY, shieldRadius, crackLevel, currentShieldHp);
      }
    } catch (error) {
      console.warn('シールドクラック描画エラー:', error);
    }
    
    // 危険状態の警告エフェクト（半径調整済み）
    if (currentShieldHp === 1) {
      try {
        if (typeof this.drawShieldWarningEffect === 'function') {
          this.drawShieldWarningEffect(this.ctx, shieldCenterX, shieldCenterY, shieldRadius);
        }
      } catch (error) {
        console.warn('シールド警告エフェクト描画エラー:', error);
      }
    }
    
    console.log('シールド描画完了 - 半径:', shieldRadius);
    
  } catch (error) {
    console.error('シールド描画中にエラーが発生しました:', error);
  }
}

if (enemy && enemy.img) {
  // 透過処理の問題を軽減するため、背景を少し暗くする
  this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
  this.ctx.fillRect(-ew/2 - 2, -eh/2 - 2, ew + 4, eh + 4);
  
  this.ctx.globalCompositeOperation = 'source-over';
  this.ctx.drawImage(enemy.img, -ew/2, -eh/2, ew, eh);
} else {
  // 画像がない場合は代替表示
  this.ctx.fillStyle = '#6b8e23';
  this.ctx.fillRect(-ew/2, -eh/2, ew, eh);
  this.ctx.fillStyle = 'white';
  this.ctx.font = 'bold 20px sans-serif';
  this.ctx.textAlign = 'center';
  this.ctx.fillText(enemy ? enemy.name : 'モンスター', 0, 0);
}
this.ctx.restore();

// ▼ 敵の下に「のこりバッジ」だけを描画（枠に重ならないよう下へ配置）
this.drawStageRemaining(this.ctx, frameArea);

    

    // ── 漢字 & ヒント ──
    // 問題漢字を枠付き＆拡大描画
    const kanjiX = this.canvas.width / 2;
    const kanjiY = 200;
    const kanjiBoxW = 180, kanjiBoxH = 160;
    
    // 弱点表示を「テキストメッセージ」に変更
    if (gameState.currentEnemy && gameState.currentEnemy.weakness) {
      const weaknessLabel = gameState.currentEnemy.weakness === 'onyomi' ? '音読み' : '訓読み';
      const message = `弱点は${weaknessLabel}！`;
      
      this.drawTextWithOutline(
        message,
        kanjiX, // X座標（中央寄せ）
        kanjiY - kanjiBoxH / 2 - 20, // Y座標（漢字ボックスの上）
        '#f39c12', // オレンジ色
        'black',
        'bold 20px "UDデジタル教科書体",sans-serif',
        'center',
        'bottom', // 基準点を下にすることで位置調整
        3
      );
    }
    
    
    
    // コンボ表示を描画（2コンボ以上の場合）
    // battleState.comboCountが0の場合は表示しない
    if ((battleState.comboCount >= 2 && battleState.comboCount > 0) || this.comboAnimation.active) {
      this.drawComboIndicator(this.ctx);
    }

                // ヒントを表示（ヒントレベルに応じて表示内容を変更）
                if (gameState.hintLevel > 0) {
                  let hintText = '';
                  let hintColor = 'yellow';
                  
                  switch(gameState.hintLevel) {
                    case 1:
                      hintText = `ヒント（基本）: 画数は${gameState.currentKanji.strokes}`;
                      hintColor = '#3498db'; // 青色
                      break;
                    case 2:
                      // 音読みと訓読みのどちらかをランダムに選ぶ（ただし毎回同じになるよう固定する）
                      const kanjiId = gameState.currentKanji.id;
                      const isOnyomi = (kanjiId % 2 === 0); // IDの偶数奇数で固定
                      const readings = isOnyomi ? gameState.currentKanji.onyomi : gameState.currentKanji.kunyomi;
                      
                      if (readings && readings.length > 0) {
                        const firstReading = readings[0];
                        const hintText2 = firstReading.substring(0, 1) + '○○';
                        hintText = `ヒント（読み）: ${isOnyomi ? '音読み' : '訓読み'}は「${hintText2}」から始まる`;
                      } else {
                        hintText = `ヒント（読み）: ${isOnyomi ? '訓読み' : '音読み'}で読むことが多い`;
                      }
                      hintColor = '#f39c12'; // オレンジ色
                      break;
                    case 3:
                      hintText = `ヒント（意味）: ${gameState.currentKanji.meaning}`;
                      hintColor = '#e74c3c'; // 赤色
                      break;
                    case 4:
                      // 最終ヒント：描画のみ。ここでreturn/状態変更はしない
                      hintText = `ヒント（意味）: ${gameState.currentKanji.meaning}`;
                      hintColor = '#e74c3c'; // 赤色
                      break;
                  }
                  
                  // 上部のヒントバナーで描画するため、テキストだけ保持
                  this.currentHintText = hintText;
                }

    // ← ここから追加：前回解答表示エリア（左側）
    if (battleState.lastAnswered) {
      const bx = 20, by = 70, bw = 140, bh = 180; // 高さを160から180に増加
      
      // パネル背景描画
      this.drawPanelBackground(this.ctx, bx, by, bw, bh, 'stone');

      this.ctx.fillStyle = 'white';
      this.ctx.textAlign = 'center';
      // タイトル
      this.ctx.font = 'bold 14px "UDデジタル教科書体",sans-serif';
      this.ctx.fillText('1つまえの漢字', bx + bw/2, by + 15);
      
      // 漢字本体
      this.ctx.font = '42px serif';
      this.ctx.fillText(battleState.lastAnswered.text, bx + bw/2, by + 55);

      // 読み進捗の取得（存在しない場合も考慮）
      const prog = (gameState.kanjiReadProgress && gameState.kanjiReadProgress[battleState.lastAnswered.id]) || null;
      const progKun = prog && prog.kunyomi
        ? (prog.kunyomi instanceof Set ? prog.kunyomi : new Set(prog.kunyomi))
        : null;
      const progOn  = prog && prog.onyomi
        ? (prog.onyomi instanceof Set ? prog.onyomi : new Set(prog.onyomi))
        : null;

      // 折り返しヘルパー（ラベル幅を考慮、トークン単位）
      const drawWrappedTokens = (label, tokens, y, masteredSet) => {
        this.ctx.font = '12px "UDデジタル教科書体",sans-serif';
        this.ctx.textAlign = 'left';
        const left = bx + 10;
        const maxW = bw - 20;
        const labelW = this.ctx.measureText(label).width;

        let x = left;
        let firstLine = true;
        // 先にラベル
        this.ctx.fillStyle = 'white';
        this.ctx.fillText(label, x, y);
        x += labelW;

        const pieces = [];
        tokens.forEach((t, i) => {
          pieces.push({ text: t, mastered: !!(masteredSet && masteredSet.has(t)) });
          if (i < tokens.length - 1) pieces.push({ text: '、', mastered: false });
        });

        pieces.forEach(p => {
          const w = this.ctx.measureText(p.text).width;
          if (x + w > left + maxW) {
            // 改行
            y += 18; // 行高
            firstLine = false;
            x = left + labelW; // 2行目以降はラベル分インデント
          }
          this.ctx.fillStyle = p.mastered ? '#3498db' : 'white';
          this.ctx.fillText(p.text, x, y);
          x += w;
        });

        return y + 18; // 次に描くベースYを返す
      };

      // 音読み（正解済みのみ青、折り返し）
let nextY = drawWrappedTokens('音読み: ', (battleState.lastAnswered.onyomi || []), by + 85, progOn);

// 訓読み（正解済みのみ青、折り返し）
nextY = drawWrappedTokens('訓読み: ', (battleState.lastAnswered.kunyomi || []), nextY, progKun);

// 画数（常に白色）
this.ctx.fillStyle = 'white';
this.ctx.fillText(`画数: ${battleState.lastAnswered.strokes}`, bx + 10, nextY);

      // 間違った答え表示（既存）
      if (this.lastIncorrectAnswer) {
        this.ctx.fillStyle = 'rgba(231, 76, 60, 0.2)';
        this.ctx.fillRect(bx + 10, nextY + 10, bw - 20, 22);
        this.ctx.strokeStyle = 'rgba(231, 76, 60, 0.8)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(bx + 10, nextY + 10, bw - 20, 22);
        this.ctx.fillStyle = '#e74c3c';
        this.ctx.font = 'bold 12px "UDデジタル教科書体",sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`あなたの答え: ${this.lastIncorrectAnswer}`, bx + bw/2, nextY + 21);
      }
    }
    // ← ここまで追加

        // ── 経験値アニメーション処理 ──
        if (!this.isAnimatingExp && this.expAnimQueue.length > 0) {
          this.isAnimatingExp = true;
    
          const expGained = this.expAnimQueue.shift();
    
          // EXPを加算しつつ、EXPバーの目標値も更新（アニメ有効化）
          const levelUpResult = updatePlayerExp(expGained);
    
          if (levelUpResult.leveledUp) {
            publish('playSE', 'levelUp');
            this.levelUpMessage = `レベルが ${levelUpResult.newLevel} にあがった！`;
            this.startLevelUpEffect(120);
            checkAchievements().catch(error => {
              console.error('実績チェック中にエラーが発生しました:', error);
            });
            battleState.playerHpTarget = gameState.playerStats.hp;
            battleState.playerHpAnimating = true;
          }
    
          this.isAnimatingExp = false;
        }

    // ── HPアニメーション更新 ──
    if (battleState.playerHpAnimating) {
      const disp = battleState.playerHpDisplay;
      const tgt  = battleState.playerHpTarget;
      const diff = tgt - disp;
      if (Math.abs(diff) <= PLAYER_HP_ANIM_SPEED) {
        battleState.playerHpDisplay   = tgt;
        battleState.playerHpAnimating = false;
      } else {
        battleState.playerHpDisplay += Math.sign(diff) * PLAYER_HP_ANIM_SPEED;
      }
    }

    // ── 経験値アニメーション更新 ──
    if (this.playerExpAnimating) {
      const disp = this.playerExpDisplay;
      const tgt = this.playerExpTarget;
      const diff = tgt - disp;
      
      // 差分が小さければアニメーション終了
      if (Math.abs(diff) <= this.expAnimSpeed) {
        this.playerExpDisplay = tgt;
        this.playerExpAnimating = false;
      } else {
        // 徐々に目標値に近づける
        this.playerExpDisplay += Math.sign(diff) * this.expAnimSpeed;
      }
    }

    // ── 新規：UIパネル描画 ──
    this.drawPlayerStatusPanel(this.ctx);
    this.drawEnemyStatusPanel(this.ctx);

    

        /* 入力欄 */
                this._adjustInputPosition();

  
// 旧: this.drawPanelBackground(this.ctx, msgX, msgY, msgW, msgH, 'stone');

const margin = 12;
const msgMinW = 500;
const msgMaxW = 640;
const msgW = Math.min(msgMaxW, Math.max(msgMinW, Math.floor(this.canvas.width * 0.62)));

// タイトルは背景描画後に高コントラストで描画（下方で描画）

	let N = 10; // デフォルトは行スクロール
	let len = battleState.log.length;
	let maxOffset = Math.max(0, len - N);
	this.logOffset = Math.min(Math.max(0, this.logOffset || 0), maxOffset);
	let start = Math.max(0, len - N - this.logOffset);
	let lines = battleState.log.slice(start, start + N);

		// ブロック表示 or 現在表示の選択
  	if (this.logMode === 'blockPaged' && this.blockHistory && this.blockHistory.length > 0) {
      if (typeof this.currentBlockIndex !== 'number' || this.currentBlockIndex < 0) {
        this.currentBlockIndex = this.blockHistory.length - 1;
      }
      lines = this.blockHistory[this.currentBlockIndex] || [];
      // スクロールバー用の値をブロック数に合わせて上書き
      len = this.blockHistory.length;
      N = 1;                    // 1ページ=1ブロック
      maxOffset = Math.max(0, len - 1);
      this.logOffset = this.currentBlockIndex;
  	} else if (this.logMode === 'current') {
  		// 常に最新の行動のみ（2行まで）
  		lines = (this.visibleLogBlock && this.visibleLogBlock.length)
  			? this.visibleLogBlock
  			: battleState.log.slice(-2);
  		len = 1; N = 1; maxOffset = 0; this.logOffset = 0;
    }
 
 	// 古い→新しい（上→下）
 	const newestFirst = false;
 	const renderLines = newestFirst ? [...lines].reverse() : lines;

    // ▼ lines 決定後にサイズと座標を計算（TDZ回避）
    const visibleCount   = Math.max(1, (Array.isArray(lines) ? lines.length : 1));
    const logLineHeight  = visibleCount >= 3 ? 22 : 24;
    const titleH         = 24;
    const padBottom      = 12;
  
    const msgH = titleH + padBottom + logLineHeight * visibleCount;
    const msgX = this.canvas.width  - margin - msgW;
    const msgY = this.canvas.height - margin - msgH;
    this.logRect = { x: msgX, y: msgY, w: msgW, h: msgH };
  
    // 表示準備
    const padding    = 8;
    const innerLeft  = msgX + padding;
    const innerTop   = msgY + 28;            // タイトル下
    const innerRight = msgX + msgW - padding;
    const innerBottom= msgY + msgH - 12;     // 下部余白
    const maxLinesByHeight = Math.max(1, Math.floor((innerBottom - innerTop) / logLineHeight));
    this.ctx.font = '18px "UDデジタル教科書体", sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';


// タイプライター効果の更新（ブロック表示中は無効化）
  if ((!this.blockHistory || this.blockHistory.length === 0) && this.typewriterEffect.active) {
       this.typewriterEffect.charInterval = 2; // 1→2で表示をゆっくりに
        this.typewriterEffect.charTimer--;
        if (this.typewriterEffect.charTimer <= 0) {
        this.typewriterEffect.displayedChars++;
        this.typewriterEffect.charTimer = this.typewriterEffect.charInterval;
        if (this.typewriterEffect.displayedChars % this.typewriterEffect.soundInterval === 0) {
          try { publish('playSE', 'decide', 0.1); } catch {}
        }
        if (this.typewriterEffect.displayedChars >= this.typewriterEffect.targetMessage.length) {
          this.typewriterEffect.active = false;
        }
      }
// 部分文字列に差し替え（ブロック表示時は行わない）
  if ((!this.blockHistory || this.blockHistory.length === 0) &&
      this.typewriterEffect.messageIndex >= 0 &&
     this.typewriterEffect.messageIndex < lines.length) {
        const displayedText = this.typewriterEffect.targetMessage.substring(
          0, 
          this.typewriterEffect.displayedChars
        );
        lines[this.typewriterEffect.messageIndex] = displayedText;
      }
    }

    // 省略表示ヘルパー（幅に収めて末尾に…）
    const truncateToWidth = (ctx, text, width) => {
      let t = String(text || '');
      if (ctx.measureText(t).width <= width) return t;
      let lo = 0, hi = t.length;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        const s = t.slice(0, mid) + '…';
        if (ctx.measureText(s).width <= width) lo = mid; else hi = mid - 1;
      }
      return t.slice(0, lo) + '…';
    };

        // クリップ
this.ctx.save();

// 背景と枠（視認性向上）
this.ctx.fillStyle = 'rgba(20,20,20,0.85)';
this.ctx.fillRect(msgX, msgY, msgW, msgH);
this.ctx.strokeStyle = '#B8860B';
this.ctx.lineWidth = 2;
this.ctx.strokeRect(msgX, msgY, msgW, msgH);


    const pad = 14;
    const textAreaW = msgW - pad * 2;

// タイトル（高コントラスト）
this.drawTextWithOutline(
  "▽",
  msgX + msgW/2,
  msgY + 8,
  'white',
  'black',
  'bold 20px "UDデジタル教科書体", sans-serif',
  'center',
  'top',
  2
);

// クリップ開始（タイトル領域を除外）
this.ctx.beginPath();
this.ctx.rect(msgX + 4, msgY + 24, msgW - 8, msgH - 30);
this.ctx.clip();

    // メッセージを折り返して平坦化（セグメント列をtop->down順で生成）
    const iconSize = 16;
    const iconMargin = 4;

    // 3行ブロックをそのまま表示（各行は省略で1行化）
    const linesForDraw = renderLines.slice(0, Math.min(3, renderLines.length));
    let drawY = innerTop;
    linesForDraw.forEach((l, idx) => {
      const color = this.getMessageColor(l);
      // アイコン種別
      let iconType = 'none';
      if (l.includes('ダメージ') || l.includes('こうげき')) iconType = 'attack';
      else if (l.includes('せいかい！') || l.includes('弱点にヒット') || l.includes('ボーナス')) iconType = 'check';
      else if (l.includes('かいふく')) iconType = 'heal';
      else if (l.includes('をたおした') || l.includes('あらわれた')) iconType = 'attack';
      else if (l.includes('経験値') || l.includes('レベル')) iconType = 'star';
      else if (l.includes('ヒント')) iconType = 'hint';

      const baseX = innerLeft;
      // 最新行に薄いハイライト
      const isNewestLine = idx === linesForDraw.length - 1 && !this.typewriterEffect.active;
      if (isNewestLine) {
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(255,215,0,0.08)';
        this.ctx.fillRect(msgX + 4, drawY - 2, msgW - 8, logLineHeight + 4);
        this.ctx.restore();
      }
      // アイコン描画
      let textX = baseX;
      const iconSize = 16, iconMargin = 4;
      if (iconType === 'check' || iconType === 'star') {
        this.ctx.save();
        this.ctx.fillStyle = (iconType === 'check') ? '#2ecc71' : '#f1c40f';
        this.ctx.font = `${iconSize}px sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(iconType === 'check' ? '✓' : '★', baseX + iconSize/2, drawY + 10);
        this.ctx.restore();
        textX = baseX + iconSize + iconMargin;
      } else {
        let iconImg = null;
        if (iconType === 'attack') iconImg = images.iconAttack;
        else if (iconType === 'heal') iconImg = images.iconHeal;
        else if (iconType === 'hint') iconImg = images.iconHint;
        if (iconImg) {
          this.ctx.drawImage(iconImg, baseX, drawY + 2, iconSize, iconSize);
          textX = baseX + iconSize + iconMargin;
        }
      }
      // 幅を測って省略
      const maxW = innerRight - textX;
      const text = truncateToWidth(this.ctx, l, maxW);
      this.drawTextWithOutline(
        text,
        textX,
        drawY,
        color || '#F3E9D7',
        'rgba(0,0,0,0.9)',
        '16px "UDデジタル教科書体", sans-serif',
        'left',
        'top',
        3
      );
      drawY += logLineHeight;
    });
    this.ctx.restore();
    

// 右側スクロールバー（currentモードでは非表示）
if (this.logMode === 'blockPaged') {
  const trackW = 12;
  const trackX = msgX + msgW - trackW - 6;
  const trackY = msgY + 26;
  const trackH = msgH - 34;
  const minThumbH = 24;
  const thumbH = Math.max(minThumbH, Math.floor(trackH * (N / Math.max(N, len))));
  const progress = maxOffset > 0 ? (this.logOffset || 0) / maxOffset : 0;
  const thumbY = trackY + Math.floor((trackH - thumbH) * progress);
  this.ctx.fillStyle = 'rgba(0,0,0,0.35)';
  this.ctx.fillRect(trackX, trackY, trackW, trackH);
  this.ctx.strokeStyle = '#B8860B';
  this.ctx.lineWidth = 1;
  this.ctx.strokeRect(trackX, trackY, trackW, trackH);
  this.ctx.fillStyle = '#D6A650';
  this.ctx.fillRect(trackX + 1, thumbY, trackW - 2, thumbH);
  this.ctx.strokeStyle = '#8B5A2B';
  this.ctx.lineWidth = 1;
  this.ctx.strokeRect(trackX + 1, thumbY, trackW - 2, thumbH);
  this.logScrollbar = {
    trackX, trackY, trackW, trackH,
    thumbX: trackX + 1, thumbY, thumbW: trackW - 2, thumbH,
    maxOffset
  };
  if (this.mouseX != null && this.mouseY != null) {
    const sb = this.logScrollbar;
    const overThumb = (this.mouseX >= sb.thumbX && this.mouseX <= sb.thumbX + sb.thumbW &&
                       this.mouseY >= sb.thumbY && this.mouseY <= sb.thumbY + sb.thumbH);
    const overTrack = (this.mouseX >= sb.trackX && this.mouseX <= sb.trackX + sb.trackW &&
                       this.mouseY >= sb.trackY && this.mouseY <= sb.trackY + sb.trackH);
    this.canvas.style.cursor = overThumb ? 'grab' : (overTrack ? 'ns-resize' : 'default');
  }
} else {
  this.logScrollbar = null;
}

  // スクロールヒント（blockPagedのときだけ）
  if (this.logMode === 'blockPaged' && len > N) {
    if (this._logHintDismissed !== true) {
      if (this._logHintTimer == null) this._logHintTimer = 180; // 約3秒
      if (this._logHintTimer > 0) {
        this.drawTextWithOutline(
          "↑↓ ホイール / 右のバーでスクロール",
          msgX + msgW/2,
          msgY + msgH - 18,
          `rgba(255, 255, 255, ${Math.min(0.9, this._logHintTimer / 120)})`,
          'black',
          '10px "UDデジタル教科書体", sans-serif',
          'center',
          'top',
          1
        );
        this._logHintTimer--;
      }
    }
  } else {
    this._logHintDismissed = true;
  }       

    // レベルアップメッセージの描画
    if (this.levelUpMessage) {
      // 半透明の黒いオーバーレイで背景を暗く
      if (this.levelUpEffect.active) {
        this.ctx.save();
        this.ctx.fillStyle = `rgba(0, 0, 0, ${this.levelUpEffect.overlayOpacity})`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // エフェクトタイマーを更新
        this.levelUpEffect.timer--;
        if (this.levelUpEffect.timer <= 0) {
          this.levelUpEffect.active = false;
          this.levelUpMessage = '';
        }
        
        // メッセージのサイズを脈動させる効果
        const pulsateFactor = 1 + 0.2 * Math.sin(Date.now() * this.levelUpEffect.pulsateSpeed);
        
        // ゴールド色のグラデーションで光る効果を作成
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const gradient = this.ctx.createLinearGradient(
          centerX - 200, centerY, 
          centerX + 200, centerY
        );
        gradient.addColorStop(0, '#f39c12'); // 琥珀色
        gradient.addColorStop(0.5, '#f1c40f'); // 黄色
        gradient.addColorStop(1, '#f39c12'); // 琥珀色
        
        // 黒い縁取り（外側）
        this.ctx.font = `bold ${38 * pulsateFactor}px "UDデジタル教科書体", sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.lineWidth = 6;
        this.ctx.strokeStyle = 'black';
        this.ctx.strokeText(this.levelUpMessage, centerX, centerY);
        
        // テキスト本体（内側）
        this.ctx.fillStyle = gradient;
        this.ctx.fillText(this.levelUpMessage, centerX, centerY);
        
        // 輝く光線エフェクト
        this.ctx.save();
        this.ctx.globalAlpha = 0.6 + 0.4 * Math.sin(Date.now() * 0.003);
        this.ctx.translate(centerX, centerY);
        
        // 放射状の光線
        for (let i = 0; i < 12; i++) {
          this.ctx.rotate(Math.PI / 6);
          this.ctx.beginPath();
          this.ctx.moveTo(0, -20);
          this.ctx.lineTo(0, -150 * pulsateFactor);
          this.ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
          this.ctx.lineWidth = 10;
          this.ctx.stroke();
        }
        
        this.ctx.restore();
        
        // レベルアップ演出の追加情報
        const subMessage = `攻撃力アップ！ HP最大値アップ！`;
        this.ctx.font = '20px "UDデジタル教科書体", sans-serif';
        this.ctx.fillStyle = 'white';
        this.ctx.fillText(subMessage, centerX, centerY + 60);
        
        this.ctx.restore();
      } else {
        // 従来のシンプルなメッセージ表示（フォールバック用）
      this.ctx.save();
      this.ctx.fillStyle = 'yellow';
      this.ctx.font = '32px "UDデジタル教科書体", sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.strokeStyle = 'black';
      this.ctx.lineWidth = 2;
      
      // 画面中央に目立つように表示
      const messageX = this.canvas.width / 2;
      const messageY = this.canvas.height / 2;
      
      // 文字の縁取り効果
      this.ctx.strokeText(this.levelUpMessage, messageX, messageY);
      this.ctx.fillText(this.levelUpMessage, messageX, messageY);
      
      this.ctx.restore();
      }
    }

    // チャレンジモードの時のみ、残り時間を描画（縁取り付き）
    if (gameState.gameMode === 'challenge') {
      this.drawTextWithOutline(
        `残り時間: ${battleState.timeRemaining}`,
        this.canvas.width / 2,
        30,
        'yellow',
        'black',
        '24px "UDデジタル教科書体", sans-serif',
        'center'
      );
    }

    // ── 画面フラッシュ効果の更新と描画 ──
    if (this.flashEffect.active) {
      // フラッシュタイマーを減らす
      this.flashEffect.timer--;
      
      // フラッシュ効果を描画
      const alpha = this.flashEffect.timer / this.flashEffect.duration;
      this.ctx.save();
      this.ctx.globalAlpha = alpha * 0.5; // 最大透明度を0.5に制限
      this.ctx.fillStyle = this.flashEffect.color;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.restore();
      
      // タイマーが0になったらフラッシュ終了
      if (this.flashEffect.timer <= 0) {
        this.flashEffect.active = false;
      }
    }

    // 読みハイライト効果のタイマー更新
    if (this.readingHighlight.active) {
      this.readingHighlight.timer--;
      if (this.readingHighlight.timer <= 0) {
        this.readingHighlight.active = false;
        this.readingHighlight.type = null;
      }
    }

    // ステージクリア画面遷移の実行チェック
    if (this.stageClearPending && 
        !this.isAnimatingExp && 
        this.expAnimQueue.length === 0) {
      // 全ての経験値アニメーションが完了した場合、ステージクリア画面へ遷移
      this.stageClearPending = false;
      
      // 先にexpParticlesを無効化してからvictoryCallbackを呼び出す
      this.expParticles.active = false;
      
      // 安全のためにコールバックを非同期で呼び出す
      setTimeout(() => {
        if (this.victoryCallback) {
          this.victoryCallback();
        }
      }, 0);
    }

    // コンボアニメーションの更新
    if (this.comboAnimation.active) {
      this.comboAnimation.timer--;
      
      // スケールを計算（最初は大きく、徐々に小さくなる）
      const progress = this.comboAnimation.timer / this.comboAnimation.duration;
      this.comboAnimation.scale = 1.0 + (1 - progress) * 0.5; // 最大1.5倍まで拡大
      
      if (this.comboAnimation.timer <= 0) {
        this.comboAnimation.active = false;
        this.comboAnimation.scale = 1.0;
      }
    }

    // ここに漢字ボックスエフェクトの更新処理を追加
    if (this.kanjiBoxEffect.active) {
      this.kanjiBoxEffect.timer--;
      if (this.kanjiBoxEffect.timer <= 0) {
        this.kanjiBoxEffect.active = false;
      }
    }

    if (this.shakeEffect.active) {
      this.shakeEffect.timer--;
      if (this.shakeEffect.timer <= 0) {
        this.shakeEffect.active = false;
      }
    }

    // ── 経験値パーティクルの更新と描画 ──
    if (this.expParticles.active) {
      this.updateAndDrawExpParticles();
    }

    // ★★★ ここに石版攻撃エフェクトの更新処理を追加 ★★★
  this.updateStoneAttackEffect();

    // コンボタイマーの更新処理を強化
    if (battleState.comboCount > 0 && battleState.comboTimer > 0) {
      battleState.comboTimer--;
      
      // タイマーが0になったらコンボをリセット
      if (battleState.comboTimer <= 0) {
        console.log('⏰ コンボタイマー終了：コンボがリセットされました');
        battleState.comboCount = 0;
        battleState.comboTimer = 0;
      }
    }
    
    // コンボカウントが0以下の場合は強制的に0にする
    if (battleState.comboCount < 0) {
      battleState.comboCount = 0;
    }

    // 例：異なる用途の場合は変数名を変更
    const displayKanjiX = this.canvas.width / 2 - 90;
    const displayKanjiY = 200;

    // または、ブロックスコープを使用
    {
      const kanjiX = this.canvas.width / 2 - 90;
      const kanjiY = 200;
      // この処理...
    }

    // 別の処理
    {
      const kanjiX = this.canvas.width / 2; // 異なる値でも問題なし
      const kanjiY = 180;
      // この処理...
    }

    // シェイクエフェクトの処理
    let shakeOffsetX = 0;
    let shakeOffsetY = 0;

    if (this.shakeEffect && this.shakeEffect.active) {
      this.shakeEffect.timer--;
      const intensity = this.shakeEffect.intensity * (this.shakeEffect.timer / this.shakeEffect.duration);
      shakeOffsetX = (Math.random() * 2 - 1) * intensity;
      shakeOffsetY = (Math.random() * 2 - 1) * intensity;
      
      if (this.shakeEffect.timer <= 0) {
        this.shakeEffect.active = false;
      }
    }

    // 漢字ボックスエフェクトの処理
    let boxScale = 1.0;
    let boxColor = 'rgba(0, 0, 0, 0.7)';
    let borderColor = 'rgba(255, 255, 255, 0.5)';
    let borderWidth = 2;

    if (this.kanjiBoxEffect && this.kanjiBoxEffect.active) {
      this.kanjiBoxEffect.timer--;
      this.kanjiBoxEffect.pulsePhase += 0.2;
      
      const progress = 1 - (this.kanjiBoxEffect.timer / this.kanjiBoxEffect.duration);
      const pulseValue = Math.sin(this.kanjiBoxEffect.pulsePhase) * 0.5 + 0.5;
      boxScale = 1 + (this.kanjiBoxEffect.maxScale - 1) * pulseValue * (1 - progress);
      
      borderColor = this.kanjiBoxEffect.color;
      borderWidth = 4;
      
      if (this.kanjiBoxEffect.timer <= 0) {
        this.kanjiBoxEffect.active = false;
      }
    }

    // スケールに基づいたサイズと位置の計算
    const scaledW = kanjiBoxW * boxScale;
    const scaledH = kanjiBoxH * boxScale;
    const adjustedX = kanjiX - (scaledW / 2) + shakeOffsetX; // 中央基準に修正
    const adjustedY = kanjiY - (scaledH / 2) + shakeOffsetY; // 中央基準に修正

    // ↓↓↓ここから変更↓↓↓

// 漢字ボックスの背景を石版パネルに変更
// 古い fillRect と strokeRect を drawStonePanel に置き換える
drawStonePanel(this.ctx, adjustedX, adjustedY, scaledW, scaledH);

// 漢字の表示 (フォントサイズもスケールに連動)
if (gameState.currentKanji) {
  this.ctx.font = `${80 * boxScale}px serif`; // フォントサイズを調整
  this.ctx.fillStyle = 'white';
  this.ctx.textAlign = 'center';
  this.ctx.textBaseline = 'middle';

  // 影をつけて立体感を出す
  this.ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  this.ctx.shadowBlur = 5;
  this.ctx.shadowOffsetX = 3 * boxScale;
  this.ctx.shadowOffsetY = 3 * boxScale;

  this.ctx.fillText(
    gameState.currentKanji.text,
    adjustedX + scaledW / 2,
    adjustedY + scaledH / 2
  );

  // 影をリセット
  this.ctx.shadowColor = 'transparent';
  this.ctx.shadowBlur = 0;
  this.ctx.shadowOffsetX = 0;
  this.ctx.shadowOffsetY = 0;

  // ★★★ 追加: 現在の問題がマスター済みならMASTERバッジを表示 ★★★
  const currentKanjiId = gameState.currentKanji.id;
  if (currentKanjiId && isKanjiMastered(currentKanjiId)) {
    // 漢字ボックスの右上にMASTERバッジを表示
    const badgeX = adjustedX + scaledW - 6;
    const badgeY = adjustedY + 6;
    drawMasterBadge(this.ctx, badgeX, badgeY);
    
    // オプション: マスター済み漢字の場合、枠を少し光らせる効果も追加
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(52, 152, 219, 0.6)'; // 青色の光る枠
    this.ctx.lineWidth = 3;
    this.ctx.shadowColor = 'rgba(52, 152, 219, 0.8)';
    this.ctx.shadowBlur = 8;
    this.ctx.strokeRect(adjustedX, adjustedY, scaledW, scaledH);
    this.ctx.restore();
  }
  
  // ★★★ ここに石版攻撃エフェクトの描画処理を追加 ★★★
if (this.stoneAttackEffect.active) {
  this.drawStoneAttackEffect(adjustedX, adjustedY, scaledW, scaledH);
}

}

    // ボタンの描画時に選択されているコマンドを強調表示
    const mode = battleState.lastCommandMode || 'attack';
    
    // 攻撃ボタンの描画
    this.drawRichButton(
      this.ctx, 
      BTN.attack.x, BTN.attack.y, 
      BTN.attack.w, BTN.attack.h, 
      "こうげき", 
      mode === 'attack' ? '#e74c3c' : '#2980b9', // 選択中は赤色
      isMouseOverRect(this.mouseX, this.mouseY, BTN.attack),
      false
    );
    
    // 回復ボタンの描画
    this.drawRichButton(
      this.ctx, 
      BTN.heal.x, BTN.heal.y, 
      BTN.heal.w, BTN.heal.h, 
      "かいふく", 
      mode === 'heal' ? '#e74c3c' : '#2980b9', // 選択中は赤色
      isMouseOverRect(this.mouseX, this.mouseY, BTN.heal),
      false
    );
    
    // ヒントボタンの描画
    this.drawRichButton(
      this.ctx, 
      BTN.hint.x, BTN.hint.y, 
      BTN.hint.w, BTN.hint.h, 
      "ヒント", 
      mode === 'hint' ? '#e74c3c' : '#2980b9', // 選択中は赤色
      isMouseOverRect(this.mouseX, this.mouseY, BTN.hint),
      false
    );
    
    // 画面下部のヘルプ（ピル型、一時表示＋フェード）
if (!this.helpHint) this.helpHint = { visible: false, text: '', timer: 0, alpha: 0 };
const hh = this.helpHint;
if (hh.visible) {
  const FADE = 24; // 最後の24Fでフェード
  hh.timer--;
  if (hh.timer <= 0) {
    hh.visible = false;
  } else {
    hh.alpha = (hh.timer < FADE) ? (hh.timer / FADE) : 1;

    const ctx = this.ctx;
    const fsBase = 18;
    const fs = Math.max(16, Math.min(18, Math.round(fsBase * (0.95 + 0.05 * hh.alpha))));
    ctx.save();
    ctx.font = `bold ${fs}px "UDデジタル教科書体", sans-serif`;
    const padX = 14, padY = 8;
    const textW = Math.ceil(ctx.measureText(hh.text).width);
    const w = textW + padX * 2;
    const h = fs + padY * 2;
    const x = (this.canvas.width - w) / 2;
    const y = this.canvas.height - 24 - h;

    ctx.globalAlpha = hh.alpha;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;

    // 丸角ピル
    const r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fill();

    // テキスト
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(hh.text, x + w / 2, y + h / 2);
    ctx.restore();
  }
}

        // 前回漢字パネルのオーバーレイ（バッジ/フラッシュ）
    if (battleState.lastAnswered) {
      const bx = 20, by = 70, bw = 140, bh = 180;

      const lastId = battleState.lastAnswered.id;
      const progForPrev = (gameState.kanjiReadProgress && gameState.kanjiReadProgress[lastId]) || null;
      const isPrevMastered = !!(progForPrev && progForPrev.mastered);

      // 右上にMASTERバッジ
      if (isPrevMastered) {
        drawMasterBadge(this.ctx, bx + bw - 6, by + 6);
      }

      // マスター達成のフラッシュ枠
      const prevLast = battleState.lastAnswered;
      if (battleScreenState.masteryFlash?.active && prevLast && battleScreenState.masteryFlash.kanjiId === prevLast.id) {
        const t = battleScreenState.masteryFlash.timer;
        const alpha = Math.max(0, Math.min(1, t / 30));
        this.ctx.save();
        this.ctx.strokeStyle = `rgba(241, 196, 15, ${0.6 * alpha})`;
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(bx - 2, by - 2, bw + 4, bh + 4);
        this.ctx.restore();
        battleScreenState.masteryFlash.timer--;
        if (battleScreenState.masteryFlash.timer <= 0) battleScreenState.masteryFlash.active = false;
      }
    }

        // 既存: レイアウトやボタン描画が終わったあたり

    // 1) 配置境界（ステージ選択の右〜敵HPの左）
    const leftBound  = 200;
    const rightBound = this.canvas.width - 280;
    const hintMaxW   = Math.max(160, rightBound - leftBound);

    // 2) テキストとフォントサイズ（枠幅に収まるまで縮小）
    const bannerText = (gameState.hintLevel > 0 && gameState.hintLevel < 4 && typeof this.currentHintText === 'string')
      ? this.currentHintText
      : '';
    if (bannerText) {
      const padX = 10;
      let fontSize = 18;
      const measure = (fs) => {
        this.ctx.font = `bold ${fs}px "UDデジタル教科書体", sans-serif`;
        return Math.ceil(this.ctx.measureText(bannerText).width);
      };
      let textW = measure(fontSize);
      const maxContentW = hintMaxW - padX * 2;
      while (textW > maxContentW && fontSize > 12) {
        fontSize -= 1;
        textW = measure(fontSize);
      }

      // 3) 枠サイズ（高さはフォントに追従して小さめに）
      const hintW = Math.max(160, Math.min(hintMaxW, textW + padX * 2));
      const hintH = Math.max(28, Math.min(36, Math.round(fontSize * 1.9)));
      const hintX = Math.max(leftBound, Math.min((leftBound + rightBound - hintW) / 2, rightBound - hintW));

      // 4) Y位置: 弱点表示の「上」。ヘッダーと被らないように下限を設ける
      const TOP_SAFE_Y = 100;           // ヘッダ（タイトル/ステージ選択）と確実に分離
      const GAP_ABOVE_WEAKNESS = 18;    // 弱点テキストとの間隔を広めに
      const weaknessY = 200 - 160 / 2 - 20; // kanjiY - kanjiBoxH/2 - 20 と同値
      let hintY = Math.max(TOP_SAFE_Y, weaknessY - hintH - GAP_ABOVE_WEAKNESS);

      // 5) 入力欄との重なりをチェックして必要なら退避
      const canvasRect = this.canvas?.getBoundingClientRect?.();
      const el = this.inputEl;
      if (el && canvasRect) {
        const elRect = el.getBoundingClientRect();
        const scaleX = this.canvas.width / canvasRect.width;
        const scaleY = this.canvas.height / canvasRect.height;
        const inputRect = {
          x: (elRect.left - canvasRect.left) * scaleX,
          y: (elRect.top  - canvasRect.top)  * scaleY,
          w: elRect.width  * scaleX,
          h: elRect.height * scaleY,
        };
        const overlap = !(hintX + hintW < inputRect.x ||
                          inputRect.x + inputRect.w < hintX ||
                          hintY + hintH < inputRect.y ||
                          inputRect.y + inputRect.h < hintY);
        if (overlap) {
          hintY = Math.max(TOP_SAFE_Y, inputRect.y - hintH - 12);
        }
      }

      // 6) バナー描画（フォントサイズを反映）
      drawHintBanner(this.ctx, hintX, hintY, hintW, hintH, bannerText, fontSize);
    }

    function drawHintBanner(ctx, x, y, w, h, text, fs) {
      ctx.save();
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, '#f39c12'); g.addColorStop(1, '#d35400');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#8e4400';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = 'white';
      ctx.font = `bold ${fs}px "UDデジタル教科書体", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x + w / 2, y + h / 2);
      ctx.restore();
    }

    if (this.shieldBreakEffect && this.shieldBreakEffect.active) {
      this.updateShieldBreakEffect();
    }

  },
/**
 * モバイルのキーボード可視領域に追従＆スクロール補正
 */
_setupMobileViewportWorkarounds() {
  try {
    const el = this.inputEl;
    if (!el) return;

    // Virtual Keyboard API（Chrome系）：コンテンツオーバーレイを要求＆隙間を正確取得
    try {
      if (navigator.virtualKeyboard) {
        navigator.virtualKeyboard.overlaysContent = true;
        this._vkGeometryHandler = (e) => {
          try {
            const vk = e?.target || navigator.virtualKeyboard;
            const r = vk && vk.boundingRect;
            const inset = r ? Math.max(0, window.innerHeight - r.y) : 0;
            this.keyboardState.bottomInset = inset;
            this.keyboardState.open = inset > 20;
            this._adjustInputPosition();
          } catch {}
        };
        navigator.virtualKeyboard.addEventListener('geometrychange', this._vkGeometryHandler);
      }
    } catch {}

    const setScrollPadding = (enable) => {
      const html = document.documentElement;
      const body = document.body;
      if (enable) {
        this._prevBodyStyles = this._prevBodyStyles || {
          htmlOverflowY: html.style.overflowY,
          bodyOverflowY: body.style.overflowY,
          bodyPaddingBottom: body.style.paddingBottom,
          htmlOverscroll: html.style.overscrollBehaviorY,
          bodyOverscroll: body.style.overscrollBehaviorY
        };
        html.style.overflowY = 'auto';
        body.style.overflowY = 'auto';
        html.style.overscrollBehaviorY = 'contain';
        body.style.overscrollBehaviorY = 'contain';
        const vv = window.visualViewport;
        const inset = vv ? Math.max(0, (window.innerHeight - vv.height - vv.offsetTop)) : 0;
        const pad = Math.max(220, inset + 220);
        body.style.paddingBottom = `${pad}px`;
      } else {
        const s = this._prevBodyStyles || {};
        document.documentElement.style.overflowY = s.htmlOverflowY || '';
        document.body.style.overflowY = s.bodyOverflowY || '';
        document.documentElement.style.overscrollBehaviorY = s.htmlOverscroll || '';
        document.body.style.overscrollBehaviorY = s.bodyOverscroll || '';
        document.body.style.paddingBottom = s.bodyPaddingBottom || '';
        this._prevBodyStyles = null;
      }
    };

    // 石版が見切れないように最低限のスクロール補正
    const ensureKanjiBoxVisible = () => {
      try {
        if (!this.canvas || !window.visualViewport) return;
        const vv = window.visualViewport;
        const rect = this.canvas.getBoundingClientRect();
        const safety = 16;

        const boxTopC = 200 - 80;
        const boxBottomC = 200 + 80;

        const topCss = rect.top + (boxTopC / this.canvas.height) * rect.height;
        const bottomCss = rect.top + (boxBottomC / this.canvas.height) * rect.height;

        const keyboardTop = vv.height + vv.offsetTop;

        if (bottomCss > keyboardTop - safety) {
          const delta = bottomCss - (keyboardTop - safety);
          window.scrollBy(0, Math.ceil(delta + 8));
        }
        if (topCss < safety) {
          const delta2 = topCss - safety;
          window.scrollBy(0, Math.floor(delta2 - 4));
        }
      } catch {}
    };

    const scheduleScrollCorrections = () => {
      const times = [0, 60, 120, 240, 360];
      this._focusScrollTimers = this._focusScrollTimers || [];
      times.forEach(t => {
        const id = setTimeout(() => { if (this.keyboardState.open) ensureKanjiBoxVisible(); }, t);
        this._focusScrollTimers.push(id);
      });
    };

    const applyByViewport = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      const bottomInset = Math.max(0, (window.innerHeight - vv.height - vv.offsetTop));
      this.keyboardState.bottomInset = bottomInset;
      this.keyboardState.open = bottomInset > 30; // 閾値を緩める
      if (this.keyboardState.open) {
        setScrollPadding(true);
        this._adjustInputPosition();
        ensureKanjiBoxVisible();
      }
    };

    this._vvResizeHandler = () => { applyByViewport(); };
    this._vvScrollHandler = () => { if (this.keyboardState.open) ensureKanjiBoxVisible(); };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this._vvResizeHandler);
      window.visualViewport.addEventListener('scroll', this._vvScrollHandler);
    }

    this._focusHandler = () => {
      applyByViewport();
      scheduleScrollCorrections();
    };
    this._blurHandler = () => {
      this.keyboardState.open = false;
      this.keyboardState.bottomInset = 0;
      setScrollPadding(false);
      this._adjustInputPosition();
      if (Array.isArray(this._focusScrollTimers)) {
        this._focusScrollTimers.forEach(id => { try { clearTimeout(id); } catch {} });
        this._focusScrollTimers = [];
      }
    };

    el.addEventListener('focus', this._focusHandler);
    el.addEventListener('blur', this._blurHandler);
  } catch (e) {
    console.warn('⚠️ ビューポート調整の初期化に失敗:', e);
  }
},

_adjustInputPosition() {
  if (!this.canvas) return;

  try {
    // 入力欄を再取得（なければ生成してDOMに追加）
    if (!this.inputEl) {
      this.inputEl = document.getElementById('kanjiInput');
    }
    if (!this.inputEl) {
      const el = document.createElement('input');
      el.id = 'kanjiInput';
      el.type = 'text';
      el.autocomplete = 'off';
      document.body.appendChild(el);
      this.inputEl = el;
      this.inputEl.setAttribute('inputmode', 'kana');
      this.inputEl.setAttribute('autocapitalize', 'off');
      this.inputEl.setAttribute('autocorrect', 'off');
      this.inputEl.setAttribute('spellcheck', 'false');
      this._setupMobileViewportWorkarounds?.();
    }
    // Enterキー未設定なら付与（重複防止）
    if (this.inputEl && !this._keydownHandler) {
      this._keydownHandler = e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (battleState.turn === 'player' && battleState.inputEnabled) {
            const mode = battleState.lastCommandMode || 'attack';
            setTimeout(() => {
              try {
                if (mode === 'attack') onAttack?.();
                else if (mode === 'heal') onHeal?.();
                else onHint?.();
              } catch (err) {
                console.error('処理中にエラー:', err);
                battleState.inputEnabled = true;
                if (this.inputEl) this.inputEl.value = '';
              }
            }, 0);
          }
        }
      };
      this.inputEl.addEventListener('keydown', this._keydownHandler);
    }

    // 重要: 強制表示（!important で他CSSに勝つ）
    const s = this.inputEl.style;
    s.setProperty('display', 'block', 'important');
    s.setProperty('visibility', 'visible', 'important');
    s.setProperty('opacity', '1', 'important');
    this.inputEl.removeAttribute('hidden');

    s.setProperty('position', 'fixed', 'important');
    s.setProperty('z-index', '2147483647', 'important');
    s.setProperty('transform', 'none', 'important');
    s.setProperty('pointer-events', 'auto', 'important');

    const isTablet = window.innerWidth <= 1024;
    s.width = isTablet ? 'min(80vw, 520px)' : '280px';
    s.fontSize = isTablet ? '18px' : '20px';
    s.padding = '8px 12px';
    s.textAlign = 'center';
    s.backgroundColor = 'white';
    s.border = '2px solid #ccc';
    s.borderRadius = '5px';
    s.boxSizing = 'border-box';
    s.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';

    const vv = window.visualViewport;
    const vvInset = vv ? Math.max(0, (window.innerHeight - vv.height - vv.offsetTop)) : 0;
    const vk = navigator.virtualKeyboard;
    const vkInset = (vk && vk.boundingRect) ? Math.max(0, window.innerHeight - vk.boundingRect.y) : 0;

    const insetMax = Math.max(vvInset, vkInset, this.keyboardState?.bottomInset || 0);
    const keyboardOpen = (this.keyboardState?.open) || insetMax > 30;
    const bottomInset = keyboardOpen ? insetMax : 0;

    const rect = this.canvas.getBoundingClientRect?.();
    const centerX = rect ? (rect.left + rect.width / 2) : Math.round(window.innerWidth / 2);

    const cs = getComputedStyle(this.inputEl);
    const inputW = this.inputEl.offsetWidth || parseInt(cs.width) || 280;
    const inputH = this.inputEl.offsetHeight || parseInt(cs.height) || 36;

    if (keyboardOpen) {
      s.left = `${Math.round(centerX - inputW / 2)}px`;
      s.top = 'auto';
      s.bottom = `${Math.round(bottomInset + 4)}px`;
    } else {
      // 石版に重ならない下寄せ + 画面内へクランプ
      let cssTop;
      if (rect) {
        const targetCanvasY = Math.min(this.canvas.height - 40, 460);
        cssTop = rect.top + (targetCanvasY / this.canvas.height) * rect.height - inputH / 2;
      } else {
        cssTop = window.innerHeight - inputH - 24;
      }
      // ビューポート内に収める
      cssTop = Math.max(0, Math.min(window.innerHeight - inputH - 8, cssTop));

      s.left = `${Math.round(centerX - inputW / 2)}px`;
      s.top = `${Math.round(cssTop)}px`;
      s.bottom = 'auto';
    }
  } catch (e) {
    console.error('❌ 入力欄位置調整エラー:', e);
  }
},
  /**
   * リッチなボタンを描画するメソッド
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D コンテキスト
   * @param {number} x - X座標
   * @param {number} y - Y座標
   * @param {number} width - 幅
   * @param {number} height - 高さ
   * @param {string} label - ボタンのラベル
   * @param {string} baseColor - ベース色
   * @param {boolean} isHovered - ホバー状態かどうか
   */
  drawRichButton(ctx, x, y, width, height, label, baseColor = '#2980b9', isHovered = false, isPressed = false) {
    // 押下状態の表現を追加
    const pressOffset = isPressed ? 2 : 0;
    const shadowOffset = isHovered ? 4 : (isPressed ? 1 : 3);
    
    // 押下時は少し沈み込む表現
    const adjustedY = y + pressOffset;
    const adjustedShadowY = y + shadowOffset - pressOffset;
    
    // 影の描画
    ctx.fillStyle = `rgba(0, 0, 0, ${isPressed ? 0.2 : 0.3})`;
    ctx.fillRect(x + shadowOffset, adjustedShadowY + shadowOffset, width, height);
    
    // ボタン本体（押下時は少し暗く）
    const buttonColor = isPressed ? this.darkenColor(baseColor, 10) : baseColor;
    
    ctx.save();
    
    // ホバー時のスケールとカラー調整
    const scale = isHovered ? 1.05 : 1.0;
    const hoverColor = isHovered ? this.lightenColor(baseColor, 15) : baseColor;
    
    // 元の座標を保存（テキスト描画用）
    const originalX = x;
    const originalY = y;
    const originalWidth = width;
    const originalHeight = height;
    
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
    
    // グラデーション背景を作成
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, this.lightenColor(hoverColor, 20)); // 上部を明るく
    gradient.addColorStop(1, this.darkenColor(hoverColor, 20));  // 下部を暗く
    
    // ボタン本体を描画
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);
    
    // 枠線を描画
    ctx.strokeStyle = this.darkenColor(hoverColor, 30);
    ctx.lineWidth = isHovered ? 3 : 2; // ホバー時は枠線を太く
    ctx.strokeRect(x, y, width, height);
    
    // 上部のハイライト（立体感を演出）
    const highlightGradient = ctx.createLinearGradient(x, y, x, y + height * 0.3);
    const highlightOpacity = isHovered ? 0.4 : 0.3; // ホバー時はハイライトを強く
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
    
    ctx.restore();
    
    // ▼▼▼ テキストとアイコンを追加 ▼▼▼
    
    // アイコンの描画
    let iconKey = '';
    if (label === 'こうげき') iconKey = 'iconAttack';
    else if (label === 'かいふく') iconKey = 'iconHeal';
    else if (label === 'ヒント') iconKey = 'iconHint';
    
    const icon = images[iconKey];
    if (icon) {
      const iconSize = 24;
      const iconX = originalX + 15;
      const iconY = originalY + (originalHeight - iconSize) / 2;
      ctx.drawImage(icon, iconX, iconY, iconSize, iconSize);
    }
    
    // テキストの描画
    ctx.save();
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const textX = originalX + originalWidth/2 + 10; // アイコン分右にずらす
    const textY = originalY + originalHeight/2;
    
    // 縁取り
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    ctx.strokeText(label, textX, textY);
    
    // テキスト
    ctx.fillStyle = 'white';
    ctx.fillText(label, textX, textY);
    
    ctx.restore();
  },

  /**
   * 色を明るくするヘルパーメソッド
   * @param {string} color - 16進数カラーコード
   * @param {number} percent - 明るくする割合（0-100）
   * @returns {string} 明るくした色
   */
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

  /**
   * 色を暗くするヘルパーメソッド
   * @param {string} color - 16進数カラーコード
   * @param {number} percent - 暗くする割合（0-100）
   * @returns {string} 暗くした色
   */
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

  /**
   * パネル背景を描画するメソッド
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D コンテキスト
   * @param {number} x - X座標
   * @param {number} y - Y座標
   * @param {number} width - 幅
   * @param {number} height - 高さ
   * @param {string} style - 背景スタイル ('default', 'stone', 'paper')
   */
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

  /**
   * 画面フラッシュ効果を開始するメソッド
   * @param {string} color - フラッシュの色（デフォルト: 赤）
   * @param {number} duration - フラッシュの持続フレーム数（デフォルト: 15）
   */
  startFlashEffect(color = 'rgba(255, 0, 0, 0.5)', duration = 15) {
    this.flashEffect.active = true;
    this.flashEffect.timer = duration;
    this.flashEffect.duration = duration;
    this.flashEffect.color = color;
  },

  /**
   * テキストに縁取りを付けて描画するヘルパーメソッド
   * @param {string} text - 描画するテキスト
   * @param {number} x - X座標
   * @param {number} y - Y座標
   * @param {string} fillColor - 塗りつぶし色
   * @param {string} strokeColor - 縁取り色
   * @param {string} font - フォント設定
   * @param {string} textAlign - テキスト配置（left, center, right）
   * @param {string} textBaseline - ベースライン（top, middle, bottom）
   * @param {number} lineWidth - 縁取りの太さ（デフォルト: 2）
   */
  drawTextWithOutline(text, x, y, fillColor, strokeColor, font, textAlign = 'left', textBaseline = 'top', lineWidth = 2) {
    this.ctx.save();
    this.ctx.font = font;
    this.ctx.textAlign = textAlign;
    this.ctx.textBaseline = textBaseline;
    
    // 縁取り描画
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = lineWidth;
    this.ctx.strokeText(text, x, y);
    
    // 塗りつぶし描画
    this.ctx.fillStyle = fillColor;
    this.ctx.fillText(text, x, y);
    
    this.ctx.restore();
  },

  /**
   * メッセージの内容に応じて色を決定する
   * @param {string} message - メッセージ内容
   * @returns {string} 色コード
   */
  getMessageColor(message) {
    // 肯定的なメッセージ（正解・成功系）
    if (message.includes('せいかい！') || 
        message.includes('弱点にヒット！') || 
        message.includes('大ダメージ！') || 
        message.includes('れんぞくせいかいボーナス！') || 
        message.includes('かいふくせいこう！') || 
        message.includes('シールドにヒビが入った！') || 
        message.includes('ボスの防御が崩れた！') || 
        message.includes('をたおした！') || 
        message.includes('の経験値を獲得した！')) {
      return '#2ecc71'; // 明るい緑色
    }
    
    // 特別な成功メッセージ（より目立つ色）
    if (message.includes('弱点にヒット！') || 
        message.includes('れんぞくせいかいボーナス！')) {
      return '#f1c40f'; // 黄色
    }
    
    // 否定的なメッセージ（失敗・ダメージ系）
    if (message.includes('こうげきしっぱい！') || 
        message.includes('かいふくしっぱい！') || 
        message.includes('のこうげき！') || 
        message.includes('のダメージ！')) {
      return '#ff6b9d'; // ピンク色
    }
    
    // 危険なメッセージ（HP低下など）
    if (message.includes('のダメージ！')) {
      return '#e74c3c'; // 赤色
    }
    
    // その他の通知メッセージ
    return 'white'; // 白色（デフォルト）
  },

  drawPlayerStatusPanel(ctx) {
    const panelW = 260;
    const panelH = 130;
    const panelX = 20;
    const panelY = 600 - panelH - 20;
  
    if (images.panelPlayer) {
      ctx.drawImage(images.panelPlayer, panelX, panelY, panelW, panelH);
    }
  
    // --- ▼ここからレイアウトと配色を調整▼ ---
    const horizontalPadding = 55;
    const contentX = panelX + horizontalPadding;
    const contentY = panelY + 22;
    const contentW = panelW - (horizontalPadding * 2);
  
    // プレイヤー名
    this.drawTextWithOutline(
      gameState.playerName,
      contentX, contentY,
      '#5C4033', '#F5DEB3', 'bold 16px "UDデジタル教科書体", sans-serif',
      'left', 'top', 2
    );
  
    // レベル表示
    this.drawTextWithOutline(
      `Lv.${gameState.playerStats.level}`,
      contentX + contentW, contentY,
      '#DAA520', '#654321', 'bold 16px "UDデジタル教科書体", sans-serif',
      'right', 'top', 2
    );
  
    // HP バー
    const barY = contentY + 25;
    const barH = 18;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(contentX, barY, contentW, barH);
  
    const hpRatio = gameState.playerStats.hp / gameState.playerStats.maxHp;
    ctx.fillStyle = hpRatio > 0.5 ? '#2ecc71' : (hpRatio > 0.2 ? '#f39c12' : '#e74c3c');
    ctx.fillRect(contentX, barY, contentW * hpRatio, barH);
    this.drawTextWithOutline(
      `${gameState.playerStats.hp} / ${gameState.playerStats.maxHp}`,
      contentX + contentW / 2, barY + barH / 2,
      'white', 'black', '12px "UDデジタル教科書体", sans-serif', 'center', 'middle', 2
    );
  
    // ▼ 追加: EXPバー（HPの下、ATK/回復の上） ▼
    const expBarY = barY + barH + 6;
    const expBarH = 12;
  
    const player = gameState.playerStats;

       const maxExpThisLevel = Math.max(1, player.nextLevelExp);
       const currentExpInLevel = Math.max(
         0,
         Math.min(maxExpThisLevel, this.playerExpDisplay ?? player.exp)
       );
     
        drawExpBar(ctx, contentX, expBarY, contentW, expBarH, currentExpInLevel, maxExpThisLevel);
    // 攻撃力表示（EXPバーのさらに下）
    const statsY = expBarY + expBarH + 12;
    this.drawTextWithOutline(
      `ATK: ${gameState.playerStats.attack}`,
      contentX, statsY,
      '#5C4033', '#F5DEB3', '14px "UDデジタル教科書体", sans-serif',
      'left', 'top', 2
    );
  
    // 回復回数（右寄せ、色は残回数で変化）
    const healCount = gameState.playerStats.healCount || 0;
    const maxHealCount = this.getMaxHealCountFromSettings();
    this.drawTextWithOutline(
      `回復: ${healCount}/${maxHealCount}回`,
      contentX + contentW, statsY,
      healCount > 0 ? '#2ecc71' : '#e74c3c',
      '#F5DEB3', '14px "UDデジタル教科書体", sans-serif',
      'right', 'top', 2
    );
  },

drawEnemyStatusPanel(ctx) {
  const panelW = 280;
  const panelH = 120;
  const panelX = 800 - panelW - 20;
  const panelY = 10;

  if (images.panelEnemy) {
    ctx.drawImage(images.panelEnemy, panelX, panelY, panelW, panelH);
  }

  if (!gameState.currentEnemy) return;

  // --- ▼ここからY軸の配置を調整▼ ---
  const horizontalPadding = 35;
  const contentX = panelX + horizontalPadding;
  const contentW = panelW - (horizontalPadding * 2);

  // 上段グループのY座標を少し下げて、中央に寄せる
  const topRowY = panelY + 30;

  // HPバーのY座標を上げて、中央に寄せる
  const barY = panelY + 65;
  const barH = 22;
  // --- ▲ここまでY軸の配置を調整▲ ---


  // 3. 敵の名前を左上に配置
  this.drawTextWithOutline(
    gameState.currentEnemy.name,
    contentX, topRowY,
    '#FF6347', '#000000', 'bold 18px "UDデジタル教科書体", sans-serif',
    'left', 'top', 3
  );

    // 4. HPバーを下段に配置
  // HPバー背景
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(contentX, barY, contentW, barH);
  // HPバー本体
  const hpRatio = gameState.currentEnemy.hp / gameState.currentEnemy.maxHp;
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(contentX, barY, contentW * hpRatio, barH);
  // HPテキスト
  this.drawTextWithOutline(
    `${gameState.currentEnemy.hp}/${gameState.currentEnemy.maxHp}`,
    contentX + contentW / 2, barY + barH / 2,
    'white', 'black', '14px "UDデジタル教科書体", sans-serif', 'center', 'middle', 2
  );
  },

  // ========== ステージ進捗UI（のこりバッジ + 段階バー + 道マップ） ==========
  progressUI: {
    gap: 6,
    segH: 16,
    padY: 8,
    colors: {
      normal: '#3498db',
      elite:  '#9b59b6',
      boss:   '#e74c3c',
      empty:  'rgba(255,255,255,0.15)',
      done:   'rgba(255,255,255,0.65)',
      current:'#f1c40f'
    }
  },

  drawStageProgress(ctx, frameArea) {
    if (!gameState.enemies || !gameState.enemies.length) return;

    const total = gameState.enemies.length;
    const idx   = Math.max(0, Math.min(total - 1, gameState.currentEnemyIndex || 0));
    const remain = Math.max(0, total - (gameState.currentEnemyIndex || 0)); // 現在を含めた残数

    // 配置（敵フレームの真下中央）
    const barW = Math.min(frameArea.width, 260);
    const barX = frameArea.x + Math.floor((frameArea.width - barW) / 2);
    const barY = frameArea.y + frameArea.height + this.progressUI.padY;
    const gap  = this.progressUI.gap;
    const segH = this.progressUI.segH;
    const segW = Math.max(10, Math.floor((barW - gap * (total - 1)) / total));
    const colors = this.progressUI.colors;

    // のこりバッジ
    this.drawRemainingBadge(ctx, barX + Math.floor(barW / 2), barY - 20, remain);

    // セグメント（段階色）
    for (let i = 0; i < total; i++) {
      const sx = barX + i * (segW + gap);
      const sy = barY;
      const enemy = gameState.enemies[i];
      const styleKey = this.getFrameStyleByOrder(i, !!(enemy && enemy.isBoss)); // 'normal'|'elite'|'boss'

      let fill = colors.empty;
      if (i < (gameState.currentEnemyIndex || 0)) fill = colors.done;
      else if (i === (gameState.currentEnemyIndex || 0)) fill = colors.current;
      else fill = colors[styleKey] || colors.normal;

      // 背面（薄い枠）
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(sx, sy + 2, segW, segH);

      // 本体
      ctx.fillStyle = fill;
      ctx.fillRect(sx, sy, segW, segH);

      // 枠
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx, sy, segW, segH);

      // ボス印（王冠）
      if (enemy && enemy.isBoss) {
        ctx.save();
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('👑', sx + Math.floor(segW / 2), sy - 2);
        ctx.restore();
      }
    }

    // 道マップ（足あと）
    const pathStart = barX + 2;
    const curCenter = barX + idx * (segW + gap) + Math.floor(segW / 2);
    const pathEnd   = Math.min(curCenter, barX + barW - 2);
    this.drawFootprints(ctx, pathStart, pathEnd, barY + segH + 8);

    // ゴール（お城）
    ctx.save();
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏰', barX + barW + 8, barY + Math.floor(segH / 2));
    ctx.restore();
  },

  drawRemainingBadge(ctx, cx, cy, remain) {
    const label = `あと ${remain} たい！`;
    ctx.save();
    ctx.font = 'bold 16px "UDデジタル教科書体", sans-serif';
    const tw = Math.ceil(ctx.measureText(label).width);
    const w = tw + 24;
    const h = 26;
    const x = cx - Math.floor(w / 2);
    const y = cy - Math.floor(h / 2);
    const r = Math.floor(h / 2);

    // ピル背景
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#f39c12');
    g.addColorStop(1, '#d35400');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();

    // 縁
    ctx.strokeStyle = '#8e4400';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 文字
    this.drawTextWithOutline(label, cx, cy, 'white', 'black', 'bold 16px "UDデジタル教科書体", sans-serif', 'center', 'middle', 2);
    ctx.restore();
  },
  drawFootprints(ctx, x1, x2, y) {
    if (x2 <= x1) return;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    const step = 16;
    let i = 0;
    for (let x = x1; x <= x2; x += step) {
      const offset = (i % 2 === 0) ? -4 : 4;
      const rot = (i % 2 === 0) ? -0.6 : 0.6;
      // かかと
      ctx.beginPath();
      ctx.ellipse(x, y + offset, 3, 5, rot, 0, Math.PI * 2);
      ctx.fill();
      // つま先
      ctx.beginPath();
      ctx.ellipse(x + 5, y + offset - 2, 2, 3, rot, 0, Math.PI * 2);
      ctx.fill();
      i++;
    }
    ctx.restore();
  },

  // ▼ 残数のみ表示（セグメント/足あとは表示しない）
  drawStageRemaining(ctx, frameArea) {
    if (!gameState.enemies || !gameState.enemies.length) return;

    const total  = gameState.enemies.length;
    const remain = Math.max(0, total - (gameState.currentEnemyIndex || 0)); // 現在を含めた残数

    // 敵枠の真下に余白を設けて配置（枠と重ならない）
    const marginBelowFrame = 10;   // 枠からの下マージン
    const badgeHalfH       = 13;   // drawRemainingBadgeの高さ26pxの半分
    const cx = frameArea.x + Math.floor(frameArea.width / 2);
    const cy = frameArea.y + frameArea.height + marginBelowFrame + badgeHalfH;

    this.drawRemainingBadge(ctx, cx, cy, remain);
  },
  exit() {
    // 入力欄を非表示＆キーイベント解除
    if (this.inputEl) {
      this.inputEl.style.display = 'none';
      this.inputEl.removeEventListener('keydown', this._keydownHandler);
      if (this._focusHandler) this.inputEl.removeEventListener('focus', this._focusHandler);
      if (this._blurHandler)  this.inputEl.removeEventListener('blur',  this._blurHandler);
    }
    if (this._vvResizeHandler && window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this._vvResizeHandler);
    }
    if (this._vvScrollHandler && window.visualViewport) {
      window.visualViewport.removeEventListener('scroll', this._vvScrollHandler);
    }
    if (this._vkGeometryHandler && navigator.virtualKeyboard) {
      navigator.virtualKeyboard.removeEventListener('geometrychange', this._vkGeometryHandler);
      this._vkGeometryHandler = null;
    }
    if (Array.isArray(this._focusScrollTimers)) {
      this._focusScrollTimers.forEach(id => { try { clearTimeout(id); } catch {} });
      this._focusScrollTimers = [];
    }
    // 付与したスタイルを元に戻す
      if (this._prevBodyStyles) {
        const s = this._prevBodyStyles;
        document.documentElement.style.overflowY = s.htmlOverflowY || '';
        document.body.style.overflowY = s.bodyOverflowY || '';
        document.documentElement.style.overscrollBehaviorY = s.htmlOverscroll || '';
        document.body.style.overscrollBehaviorY = s.bodyOverscroll || '';
        document.body.style.paddingBottom = s.bodyPaddingBottom || '';
        this._prevBodyStyles = null;
      } else {
        document.documentElement.style.overflowY = '';
        document.body.style.overflowY = '';
        document.documentElement.style.overscrollBehaviorY = '';
        document.body.style.overscrollBehaviorY = '';
        document.body.style.paddingBottom = '';
      }
      // クリックイベントリスナ解除
      if (this._clickHandler) {
        this.unregisterHandlers();
      }
      // タイマーの停止
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
      // クリア保留フラグもリセット
      this.stageClearPending = false;
  
      // canvas/ctx/inputEl をクリア
      this.canvas = this.ctx = this.inputEl = null;
    },

  /** クリックなどのイベントを登録 */
  registerHandlers() {
    // クリックハンドラを保存して再利用できるようにする
    this._clickHandler = e => {
      console.log('クリックイベント発生:', e.type);
      this.handleClick(e);
    };
    
    // イベントリスナーを登録
    if (this.canvas) {
      console.log('イベントリスナーを登録します');
      this.canvas.addEventListener('click', this._clickHandler);
      this.canvas.addEventListener('touchstart', this._clickHandler);
      
      this._mousemoveHandler = e => {
				// 統一された座標変換を使用
  const coords = getGameCoordinates(e, this.canvas);
  if (!isValidCoordinates(coords)) {
    return false; // 黒帯エリアのクリックは無視
  }
  
  const x = coords.x;
  const y = coords.y;
  this.mouseX = x;
  this.mouseY = y;

				// スクロールバーのドラッグ
				if (this.draggingLogThumb && this.logScrollbar && this.logScrollbar.maxOffset >= 0) {
					const { trackY, trackH, thumbH, maxOffset } = this.logScrollbar;
					const range = Math.max(1, trackH - thumbH);
					const dy = this.mouseY - (this._dragStartY || this.mouseY);
					const delta = dy / range;
					const base = this._dragStartOffset || 0;
          					const next = Math.max(0, Math.min(maxOffset, Math.round(base + delta * maxOffset)));
          					this.logOffset = next;
          					if (this.blockHistory && this.blockHistory.length > 0) this.currentBlockIndex = next;
				}
			};
      this.canvas.addEventListener('mousemove', this._mousemoveHandler);
      
      this._wheelHandler = e => {
				const rect = this.canvas.getBoundingClientRect();
				const x = e.clientX - rect.left, y = e.clientY - rect.top;
				const r = this.logRect;
				if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
					e.preventDefault();

			if (this.blockHistory && this.blockHistory.length > 0) {
				const maxIndex = this.blockHistory.length - 1;
				if (e.deltaY < 0) {
					this.currentBlockIndex = Math.max(0, (this.currentBlockIndex || 0) - 1);
				} else {
					this.currentBlockIndex = Math.min(maxIndex, (this.currentBlockIndex || 0) + 1);
				}
				this.logOffset = this.currentBlockIndex;
			} else {
				const N = 10;
				const len = battleState.log.length;
				const maxOffset = Math.max(0, len - N);
				if (e.deltaY < 0) this.logOffset = Math.min((this.logOffset || 0) + 1, maxOffset);
				else this.logOffset = Math.max(0, (this.logOffset || 0) - 1);
			}
 			this._logHintDismissed = true;
				}
			};
      this.canvas.addEventListener('wheel', this._wheelHandler);

// 追加: タッチ対応（トグルドラッグ）
this._touchStartHandler = e => {
  const t = e.changedTouches[0];
  const rect = this.canvas.getBoundingClientRect();
  const scaleX = this.canvas.width / rect.width;
  const scaleY = this.canvas.height / rect.height;
  
  this._touchStartX = (t.clientX - rect.left) * scaleX;
  this._touchStartY = (t.clientY - rect.top) * scaleY;
  
  if (this.logScrollbar) {
    const sb = this.logScrollbar;
    const inThumb = this._touchStartX >= sb.thumbX && this._touchStartX <= sb.thumbX + sb.thumbW && this._touchStartY >= sb.thumbY && this._touchStartY <= sb.thumbY + sb.thumbH;
    const inTrack = this._touchStartX >= sb.trackX && this._touchStartX <= sb.trackX + sb.trackW && this._touchStartY >= sb.trackY && this._touchStartY <= sb.trackY + sb.trackH;
    if (inThumb) {
      this.draggingLogThumb = true;
      this._dragStartY = this._touchStartY;
      this._dragStartOffset = this.logOffset || 0;
      this._logHintDismissed = true;
      e.preventDefault();
      return;
    }
      		if (inTrack && !inThumb) {
      			const rel = Math.max(0, Math.min(1, (this._touchStartY - sb.trackY - sb.thumbH / 2) / Math.max(1, sb.trackH - sb.thumbH)));
      			const next = Math.round(rel * (sb.maxOffset || 0));
      			this.logOffset = next;
      			if (this.blockHistory && this.blockHistory.length > 0) this.currentBlockIndex = next;
             this._logHintDismissed = true;
             e.preventDefault();
             return;
           }
  }
};

this._touchMoveHandler = e => {
  if (!this.draggingLogThumb || !this.logScrollbar) return;
  const t = e.changedTouches[0];
  const rect = this.canvas.getBoundingClientRect();
  const scaleY = this.canvas.height / rect.height;
  this.mouseY = (t.clientY - rect.top) * scaleY;
  const { trackH, thumbH, maxOffset } = this.logScrollbar;
  const range = Math.max(1, trackH - thumbH);
  const dy = this.mouseY - (this._dragStartY || this.mouseY);
  const base = this._dragStartOffset || 0;
	const next = Math.max(0, Math.min(maxOffset, Math.round(base + (dy / range) * maxOffset)));
	this.logOffset = next;
	if (this.blockHistory && this.blockHistory.length > 0) this.currentBlockIndex = next;
  e.preventDefault();
};

this._touchEndHandler = e => {
  if (!e.changedTouches) return;
  
  const t = e.changedTouches[0];
  const rect = this.canvas.getBoundingClientRect();
  const scaleX = this.canvas.width / rect.width;
  const scaleY = this.canvas.height / rect.height;
  
  const touchEndX = (t.clientX - rect.left) * scaleX;
  const touchEndY = (t.clientY - rect.top) * scaleY;
  
  // タッチ開始と終了が近い場合のみクリックと判定
  const moveDistance = Math.sqrt(
    Math.pow(touchEndX - this._touchStartX, 2) + 
    Math.pow(touchEndY - this._touchStartY, 2)
  );
  
  if (moveDistance < 10) { // 10ピクセル以内の移動はクリックと判定
    this.handleClick(e);
  }
  
  this.draggingLogThumb = false;
  this._dragStartY = null;
  this._dragStartOffset = null;
};

this.canvas.addEventListener('touchstart', this._touchStartHandler, { passive: false });
this.canvas.addEventListener('touchmove', this._touchMoveHandler, { passive: false });
this.canvas.addEventListener('touchend', this._touchEndHandler);
      
      // マウスダウン・アップイベントのハンドラを保存
      this._mousedownHandler = e => this.handleMouseDown(e);
      this._mouseupHandler = e => this.handleMouseUp(e);
      
      // マウスイベントハンドラを追加
      this.canvas.addEventListener('mousedown', this._mousedownHandler);
      this.canvas.addEventListener('mouseup', this._mouseupHandler);
      this.canvas.addEventListener('mouseleave', this._mouseupHandler);
    } else {
      console.error('canvas要素がnullです。イベントリスナーを登録できません。');
    }
  },

  /** イベント登録を解除 */
  unregisterHandlers() {
    if (!this.canvas) return; // canvasがnullの場合は何もしない
    
    this.canvas.removeEventListener('click', this._clickHandler);
    this.canvas.removeEventListener('touchstart', this._clickHandler);
    this.canvas.removeEventListener('mousemove', this._mousemoveHandler);
    this.canvas.removeEventListener('wheel', this._wheelHandler);
// 追加: タッチイベントリスナーを解除
this.canvas.removeEventListener('touchstart', this._touchStartHandler);
this.canvas.removeEventListener('touchmove', this._touchMoveHandler);
this.canvas.removeEventListener('touchend', this._touchEndHandler);
    
    // マウスイベントハンドラを解除
    this.canvas.removeEventListener('mousedown', this._mousedownHandler);
    this.canvas.removeEventListener('mouseup', this._mouseupHandler);
    this.canvas.removeEventListener('mouseleave', this._mouseupHandler);
  },

// 2. handleClickメソッドを以下のように修正
handleClick(e) {
// モバイルの二重発火ガード
const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
if (e.type === 'touchstart') {
  this._lastTouchTime = now;
  if (e.cancelable) e.preventDefault();
} else if (e.type === 'click') {
  if (this._lastTouchTime && (now - this._lastTouchTime) < 700) {
    return;
  }
}

  e.preventDefault();
  
  // 統一された座標変換を使用
  const coords = getGameCoordinates(e, this.canvas);
  if (!isValidCoordinates(coords)) {
    return false; // 黒帯エリアのクリックは無視
  }
  
  const x = coords.x;
  const y = coords.y;
  
  if (DEBUG) console.log('クリック座標:', x, y);
  
  // BTNオブジェクトのプロパティを確認（デバッグ用）
  if (DEBUG) console.log('BTN.back:', BTN.back);
  if (DEBUG) console.log('BTN.stage:', BTN.stage);
  if (DEBUG) console.log('BTN.attack:', BTN.attack);
  
  // ボタンの当たり判定を詳細にデバッグ
  if (DEBUG) Object.entries(BTN).forEach(([key, btn]) => {
    const isHit = isMouseOverRect(x, y, btn);
    console.log(`ボタン[${key}] 座標(${btn.x},${btn.y},${btn.w},${btn.h}) ヒット:${isHit}`);
  });
  
    // 「タイトルへ」ボタン押下時
    if (isMouseOverRect(x, y, BTN.back)) {
      console.log('「タイトルへ」ボタンがクリックされました');
    publish('playBGM', 'title'); // 先にメニューBGMへ切替
      publish('changeScreen', 'title');
      return true;
    }
  
        // 「ステージ選択」ボタン押下時
        if (isMouseOverRect(x, y, BTN.stage)) {
          console.log('「ステージ選択」ボタンがクリックされました');
          publish('playBGM', 'title'); // メニュー共通BGMへ
          const targetScreen = (gameState.previousScreen === 'worldStageSelect') ? 'worldStageSelect' : 'stageSelect';
          publish('changeScreen', targetScreen);
          return true;
        }
  
  // 「こうげき」ボタン押下時
  if (isMouseOverRect(x, y, BTN.attack)) {
    console.log('「こうげき」ボタンがクリックされました');
    battleState.lastCommandMode = 'attack';
    onAttack();
    return true;
  }
  
  // 「かいふく」ボタン押下時
  if (isMouseOverRect(x, y, BTN.heal)) {
    console.log('「かいふく」ボタンがクリックされました');
    battleState.lastCommandMode = 'heal';
    onHeal();
    return true;
  }
  
  // 「ヒント」ボタン押下時
  if (isMouseOverRect(x, y, BTN.hint)) {
    console.log('「ヒント」ボタンがクリックされました');
    battleState.lastCommandMode = 'hint';
    onHint();
    return true;
  }
  
  return false; // イベント未処理を示す
},

  // ※ 必要に応じて spawnEnemy, onAttack, onHeal, onHint, enemyTurn なども
  //   このオブジェクト内にメソッドとして整理してください。

  /**
   * 読み方ハイライト効果を開始するメソッド
   * @param {string} type - ハイライトする読み方のタイプ ('onyomi' または 'kunyomi')
   * @param {number} duration - ハイライトの持続フレーム数（デフォルト: 60 = 約1秒）
   */
  startReadingHighlight(type, duration = 60) {
    this.readingHighlight.active = true;
    this.readingHighlight.timer = duration;
    this.readingHighlight.duration = duration;
    this.readingHighlight.type = type;
  },

  /**
   * コンボインジケーターを描画する関数
   * @param {CanvasRenderingContext2D} ctx - 描画コンテキスト
   */
  drawComboIndicator(ctx) {
    const comboCount = this.comboAnimation.active 
      ? this.comboAnimation.comboCount 
      : battleState.comboCount;
    
    // デバッグログ
    if (DEBUG) console.log('🔢 コンボ表示:', {
      comboCount: comboCount,
      battleStateCombo: battleState.comboCount,
      animationActive: this.comboAnimation.active
    });
    
    if (comboCount < 2) return; // 2コンボ未満は表示しない
    
    const kanjiX = this.canvas.width / 2;
    const kanjiY = 200;
    const kanjiBoxW = 180;
    
    // コンボ表示の位置（漢字の左横に変更）
    const comboX = kanjiX - kanjiBoxW / 2 - 40;
    const comboY = kanjiY;
    
    ctx.save();
    
    // アニメーション中はスケーリング
    if (this.comboAnimation.active) {
      ctx.translate(comboX, comboY);
      ctx.scale(this.comboAnimation.scale, this.comboAnimation.scale);
      ctx.translate(-comboX, -comboY);
    }
    
    // コンボ数に応じた色を設定
    let comboColor = '#3498db'; // 青（デフォルト）
    if (comboCount >= 10) comboColor = '#e74c3c'; // 赤（10コンボ以上）
    else if (comboCount >= 5) comboColor = '#f39c12'; // オレンジ（5コンボ以上）
    else if (comboCount >= 3) comboColor = '#2ecc71'; // 緑（3コンボ以上）
    
    // 背景円を描画
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.arc(comboX, comboY, 35, 0, Math.PI * 2);
    ctx.fill();
    
    // 縁取り円を描画
    ctx.strokeStyle = comboColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(comboX, comboY, 35, 0, Math.PI * 2);
    ctx.stroke();
    
    // コンボ数テキスト
    this.drawTextWithOutline(
      `${comboCount}`,
      comboX,
      comboY - 5,
      comboColor,
      'black',
      'bold 28px "UDデジタル教科書体", sans-serif',
      'center',
      'middle'
    );
    
    // コンボテキスト
    this.drawTextWithOutline(
      'コンボ',
      comboX,
      comboY + 20,
      'white',
      'black',
      'bold 14px "UDデジタル教科書体", sans-serif',
      'center',
      'middle'
    );
    
    ctx.restore();
  },
  
  /**
   * コンボ表示のアニメーションを開始
   * @param {number} comboCount - 表示するコンボ数
   */
  startComboAnimation(comboCount) {
    this.comboAnimation.active = true;
    this.comboAnimation.timer = this.comboAnimation.duration;
    this.comboAnimation.scale = 1.5; // 最初は大きく
    this.comboAnimation.comboCount = comboCount;
  },

  // 経験値パーティクル用のメソッドを修正
  startExpParticleEffect(sourceX, sourceY, targetX, targetY, expAmount) {
    // パーティクルの初期化
    this.expParticles = {
      active: true,
      particles: [],
      maxParticles: 15,
      sourceX: sourceX,
      sourceY: sourceY,
      targetX: targetX,
      targetY: targetY,
      expAmount: expAmount
    };

    // パーティクルを生成
    for (let i = 0; i < this.expParticles.maxParticles; i++) {
      const angle = (Math.PI * 2 * i) / this.expParticles.maxParticles + Math.random() * 0.5;
      const speed = 2 + Math.random() * 3;
      const delay = i * 3; // パーティクルごとに少しずつ遅延
      
      this.expParticles.particles.push({
        x: sourceX,
        y: sourceY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 60 + Math.random() * 30, // 1-1.5秒の寿命
        size: 3 + Math.random() * 4,
        delay: delay,
        phase: 'spread', // 'spread' -> 'converge' -> 'arrived'
        alpha: 1.0,
        color: `hsl(${45 + Math.random() * 30}, 100%, ${60 + Math.random() * 20}%)` // 黄色系のランダムな色
      });
    }
  },

  

  /** レベルアップ演出を開始するメソッド */
  startLevelUpEffect(duration = 120) {
    this.levelUpEffect.active = true;
    this.levelUpEffect.timer = duration;
    this.levelUpEffect.duration = duration;
    
    // 画面シェイク効果を追加（小さな揺れで臨場感を出す）
    if (this.canvas) {
      const intensity = 5; // 揺れの強さ
      const shakeDuration = 500; // ミリ秒
      
      // キャンバス要素に一時的にシェイクエフェクトを適用
      const originalTransform = this.canvas.style.transform || '';
      
      const shake = () => {
        const dx = (Math.random() - 0.5) * intensity;
        const dy = (Math.random() - 0.5) * intensity;
        this.canvas.style.transform = `${originalTransform} translate(${dx}px, ${dy}px)`;
      };
      
      // シェイクエフェクトのアニメーション
      let elapsed = 0;
      const interval = 50; // 50ミリ秒ごとに位置を更新
      
      const shakeInterval = setInterval(() => {
        shake();
        elapsed += interval;
        
        if (elapsed >= shakeDuration) {
          clearInterval(shakeInterval);
          this.canvas.style.transform = originalTransform; // 元の位置に戻す
        }
      }, interval);
    }
  },

  /** 
   * タイプライターエフェクトを開始するメソッド
   * @param {string} message - アニメーションするメッセージ
   */
  startTypewriterEffect(message) {
    // 最新のメッセージに対してエフェクトを開始
    const logLength = battleState.log.length;
    if (logLength === 0) return;
    
    // 表示可能な最大行数
    const N = 5;
    const start = Math.max(0, logLength - N - this.logOffset);
    const relativeIndex = logLength - 1 - start;
    
    // 表示範囲内のメッセージのみアニメーション
    if (relativeIndex >= 0 && relativeIndex < N) {
      this.typewriterEffect.active = true;
      this.typewriterEffect.targetMessage = message;
      this.typewriterEffect.displayedChars = 0;
      this.typewriterEffect.messageIndex = relativeIndex;
      this.typewriterEffect.charTimer = this.typewriterEffect.charInterval;
    }
  },

  /**
   * シンプルなアイコン記号を描画するヘルパーメソッド
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D コンテキスト
   * @param {string} symbol - 描画する記号
   * @param {number} x - X座標
   * @param {number} y - Y座標
   * @param {number} size - アイコンサイズ
   * @param {string} color - アイコンの色
   */
  drawSimpleIcon(ctx, symbol, x, y, size, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `${size}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // 背景円を描画（オプション）
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(x + size/2, y + size/2, size/2 + 2, 0, Math.PI * 2);
    ctx.fill();
    
    // 記号を描画
    ctx.fillStyle = color;
    ctx.fillText(symbol, x + size/2, y + size/2);
    ctx.restore();
  },

  /** 
   * タイプライターエフェクトを開始するメソッド
   * @param {string} message - アニメーションするメッセージ
   */
  startTypewriterEffect(message) {
    // 最新のメッセージに対してエフェクトを開始
    const logLength = battleState.log.length;
    if (logLength === 0) return;
    
    // 表示可能な最大行数
    const N = 5;
    const start = Math.max(0, logLength - N - this.logOffset);
    const relativeIndex = logLength - 1 - start;
    
    // 表示範囲内のメッセージのみアニメーション
    if (relativeIndex >= 0 && relativeIndex < N) {
      this.typewriterEffect.active = true;
      this.typewriterEffect.targetMessage = message;
      this.typewriterEffect.displayedChars = 0;
      this.typewriterEffect.messageIndex = relativeIndex;
      this.typewriterEffect.charTimer = this.typewriterEffect.charInterval;
    }
  },

  // 弱点表示（アイコン化）
  drawOnyomiIcon(ctx, x, y, size) {
    this.drawSimpleIcon(ctx, '🔴', x, y, size, 'red');
  },

  // 弱点表示（アイコン化）
  drawKunyomiIcon(ctx, x, y, size) {
    this.drawSimpleIcon(ctx, '🌿', x, y, size, 'blue');
  },

  /**
   * 音読み用アイコン（音波）を描画
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D コンテキスト
   * @param {number} x - X座標
   * @param {number} y - Y座標
   * @param {number} size - アイコンサイズ
   */
  drawOnyomiIcon(ctx, x, y, size) {
    ctx.save();
    
    // 背景円（半透明の赤）
    ctx.fillStyle = 'rgba(231, 76, 60, 0.2)';
    ctx.beginPath();
    ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2);
    ctx.fill();
    
    // 音波を描画（3つの同心円弧）
    const centerX = x + size/2;
    const centerY = y + size/2;
    
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    
    // 内側の音波
    ctx.beginPath();
    ctx.arc(centerX, centerY, size * 0.15, -Math.PI/3, Math.PI/3);
    ctx.stroke();
    
    // 中間の音波
    ctx.beginPath();
    ctx.arc(centerX, centerY, size * 0.25, -Math.PI/4, Math.PI/4);
    ctx.stroke();
    
    // 外側の音波
    ctx.beginPath();
    ctx.arc(centerX, centerY, size * 0.35, -Math.PI/6, Math.PI/6);
    ctx.stroke();
    
    // 中央の発音源（小さな円）
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(centerX, centerY, size * 0.08, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  },

  /**
   * 訓読み用アイコン（葉っぱ）を描画
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D コンテキスト
   * @param {number} x - X座標
   * @param {number} y - Y座標
   * @param {number} size - アイコンサイズ
   */
  drawKunyomiIcon(ctx, x, y, size) {
    ctx.save();
    
    // 背景円（半透明の青緑）
    ctx.fillStyle = 'rgba(46, 204, 113, 0.2)';
    ctx.beginPath();
    ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2);
    ctx.fill();
    
    const centerX = x + size/2;
    const centerY = y + size/2;
    
    // 葉っぱの形を描画
    ctx.fillStyle = '#27ae60';
    ctx.beginPath();
    
    // 葉っぱの輪郭（ベジェ曲線で自然な形を作成）
    ctx.moveTo(centerX, centerY - size * 0.3); // 上端
    ctx.quadraticCurveTo(
      centerX + size * 0.25, centerY - size * 0.1, // 制御点
      centerX + size * 0.15, centerY + size * 0.2   // 右下
    );
    ctx.quadraticCurveTo(
      centerX, centerY + size * 0.3,               // 制御点（下端）
      centerX - size * 0.15, centerY + size * 0.2  // 左下
    );
    ctx.quadraticCurveTo(
      centerX - size * 0.25, centerY - size * 0.1, // 制御点
      centerX, centerY - size * 0.3                // 上端に戻る
    );
    ctx.fill();
    
    // 葉脈を描画
    ctx.strokeStyle = '#1e8449';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    
    // 中央の葉脈
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - size * 0.25);
    ctx.lineTo(centerX, centerY + size * 0.25);
    ctx.stroke();
    
    // 左右の葉脈
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - size * 0.1);
    ctx.lineTo(centerX - size * 0.12, centerY + size * 0.1);
    ctx.moveTo(centerX, centerY - size * 0.1);
    ctx.lineTo(centerX + size * 0.12, centerY + size * 0.1);
    ctx.stroke();
    
    ctx.restore();
  },

  /**
   * 経験値パーティクルの更新と描画
   */
  updateAndDrawExpParticles() {
    // コンテキストがnullの場合は処理をスキップ
    if (!this.ctx) {
      console.warn('描画コンテキストがnullです。パーティクル更新をスキップします。');
      this.expParticles.active = false;
      return;
    }
    
    const particles = this.expParticles.particles;
    let activeParticles = 0;

    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];
      
      // 遅延中はスキップ
      if (particle.delay > 0) {
        particle.delay--;
        activeParticles++;
        continue;
      }

      particle.life++;

      // フェーズ管理
      if (particle.phase === 'spread') {
        // 最初は放射状に広がる
        particle.x += particle.vx;
        particle.y += particle.vy;
        
        // 一定時間後に収束フェーズに移行
        if (particle.life > 20) {
          particle.phase = 'converge';
        }
      } else if (particle.phase === 'converge') {
        // 経験値バーに向かって収束
        const dx = this.expParticles.targetX - particle.x;
        const dy = this.expParticles.targetY - particle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 5) {
          // 到達した
          particle.phase = 'arrived';
          
          // 経験値アニメーションキューに追加
          if (!this.expAnimQueue) this.expAnimQueue = [];
          this.expAnimQueue.push(Math.floor(this.expParticles.expAmount / this.expParticles.maxParticles));
          
          // パーティクル到達時のエフェクト
          this.createExpImpactEffect(particle.x, particle.y);
          
          // パーティクルを削除
          particles.splice(i, 1);
          continue;
        } else {
          // 経験値バーに向かって移動（加速）
          const speed = Math.min(8, distance * 0.1);
          particle.vx = (dx / distance) * speed;
          particle.vy = (dy / distance) * speed;
          particle.x += particle.vx;
          particle.y += particle.vy;
        }
      }

      // 寿命チェック
      if (particle.life > particle.maxLife) {
        particles.splice(i, 1);
        continue;
      }

      // アルファ値の計算（寿命に応じてフェードアウト）
      const lifeRatio = particle.life / particle.maxLife;
      if (lifeRatio > 0.8) {
        particle.alpha = 1 - ((lifeRatio - 0.8) / 0.2);
      }

      // パーティクルを描画
      this.drawExpParticle(particle);
      activeParticles++;
    }

    // 全てのパーティクルが消えたらエフェクト終了
    if (activeParticles === 0) {
      this.expParticles.active = false;
    }
  },

  /**
   * 経験値パーティクルを描画
   * @param {Object} particle - パーティクルオブジェクト
   */
  drawExpParticle(particle) {
    // コンテキストがnullの場合は処理をスキップ
    if (!this.ctx) {
      console.warn('描画コンテキストがnullです。パーティクル描画をスキップします。');
      return;
    }
    
    this.ctx.save();
    this.ctx.globalAlpha = particle.alpha;
    
    // 光る効果のためのグラデーション
    const gradient = this.ctx.createRadialGradient(
      particle.x, particle.y, 0,
      particle.x, particle.y, particle.size * 2
    );
    gradient.addColorStop(0, particle.color);
    gradient.addColorStop(0.5, particle.color.replace(')', ', 0.5)').replace('hsl', 'hsla'));
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    // パーティクル本体
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    this.ctx.fill();
    
    // 中心の明るい点
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    this.ctx.beginPath();
    this.ctx.arc(particle.x, particle.y, particle.size * 0.3, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.ctx.restore();
  },

  /**
   * パーティクルが経験値バーに到達した時のインパクトエフェクト
   * @param {number} x - X座標
   * @param {number} y - Y座標
   */
  createExpImpactEffect(x, y) {
    // コンテキストがnullの場合は処理をスキップ
    if (!this.ctx) {
      console.warn('描画コンテキストがnullです。エフェクト描画をスキップします。');
      return;
    }
    
    // 小さな爆発エフェクト
    this.ctx.save();
    
    // 放射状の光線
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6;
      const length = 8 + Math.random() * 4;
      
      this.ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)';
      this.ctx.lineWidth = 2;
      this.ctx.lineCap = 'round';
      
      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
      this.ctx.lineTo(
        x + Math.cos(angle) * length,
        y + Math.sin(angle) * length
      );
      this.ctx.stroke();
    }
    
    // 中心の光る円
    const impactGradient = this.ctx.createRadialGradient(x, y, 0, x, y, 12);
    impactGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    impactGradient.addColorStop(0.5, 'rgba(255, 215, 0, 0.6)');
    impactGradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
    
    this.ctx.fillStyle = impactGradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, 12, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.ctx.restore();
    
    // 軽いSE再生
    publish('playSE', 'expGain', 0.3);
  },

  // 攻撃処理を行うメソッド
  handleAttack() {
    // ここに元々のonAttack関数の内容をコピー
    // または単純にonAttack()を呼び出す（関数が定義済みであることを確認）
    if (typeof onAttack === 'function') {
      onAttack();
    } else {
      console.error('onAttack関数が定義されていません');
    }
  },
  
  // 回復処理を行うメソッド
  handleHeal() {
    if (typeof onHeal === 'function') {
      onHeal();
    } else {
      console.error('onHeal関数が定義されていません');
    }
  },
  
  // ヒント処理を行うメソッド
  handleHint() {
    if (typeof onHint === 'function') {
      onHint();
    } else {
      console.error('onHint関数が定義されていません');
    }
  },

  // アイコンサイズとスペーシングの統一
  drawIconWithText(ctx, icon, text, x, y, color = 'white') {
    // アイコン描画
    if (icon) {
      ctx.drawImage(icon, x, y, this.UI_CONSTANTS.ICON_SIZE, this.UI_CONSTANTS.ICON_SIZE);
    }
    
    // テキスト描画（アイコンとの間隔を統一）
    const textX = x + this.UI_CONSTANTS.ICON_SIZE + this.UI_CONSTANTS.ICON_MARGIN;
    this.drawTextWithOutline(text, textX, y + this.UI_CONSTANTS.ICON_SIZE/2, color, 'black');
  },

  drawWeaknessIndicator(ctx, weakness, x, y) {
    const config = {
      onyomi: { icon: images.iconOnyomi },
      kunyomi: { icon: images.iconKunyomi }
    };

    const weaknessConfig = config[weakness];
    if (!weaknessConfig || !weaknessConfig.icon) return;

    const iconSize = 32;
    // アイコンが中央に来るようにX座標を調整
    ctx.drawImage(weaknessConfig.icon, x - iconSize / 2, y - iconSize / 2, iconSize, iconSize);
  },

  // 経験値バーにパーセンテージ表示を追加
  drawExpBarWithPercentage(ctx, x, y, width, height, currentExp, maxExp) {
    // 既存の経験値バー描画
    drawExpBar(ctx, x, y, width, height, currentExp, maxExp);
    
    // パーセンテージ表示
    const percentage = Math.floor((currentExp / maxExp) * 100);
    const percentText = `${percentage}%`;
    
    // バーの中央にパーセンテージを表示
    ctx.font = '10px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'center';
    
    // 背景色に応じてテキスト色を調整
    const textColor = percentage > 50 ? 'black' : 'white';
    this.drawTextWithOutline(
      percentText,
      x + width/2, y + height/2,
      textColor, textColor === 'black' ? 'white' : 'black',
      '10px "UDデジタル教科書体", sans-serif',
      'center', 'middle', 1
    );
  },

  // 画面サイズに応じたUI調整
  getResponsiveLayout() {
    const canvas = this.canvas;
    const isSmall = canvas.width < 600 || canvas.height < 400;
    const isMedium = canvas.width < 800 || canvas.height < 600;
    
    return {
      panelScale: isSmall ? 0.8 : (isMedium ? 0.9 : 1.0),
      fontSize: isSmall ? 12 : (isMedium ? 14 : 16),
      buttonSize: isSmall ? 0.8 : 1.0,
      spacing: isSmall ? 8 : 12
    };
  },

  // レスポンシブ対応のパネル描画
  drawResponsivePanel(ctx, baseX, baseY, baseW, baseH) {
    const layout = this.getResponsiveLayout();
    
    const x = baseX * layout.panelScale;
    const y = baseY * layout.panelScale;
    const w = baseW * layout.panelScale;
    const h = baseH * layout.panelScale;
    
    return { x, y, w, h };
  },

  // コンボ表示の改善（残り時間表示付き）
  drawComboIndicatorWithTimer(ctx) {
    if (battleState.comboCount < 2) return;
    
    // 既存のコンボ表示
    this.drawComboIndicator(ctx);
    
    // コンボタイマーの視覚化
    if (battleState.comboTimer > 0) {
      const kanjiX = this.canvas.width / 2;
      const kanjiY = 200;
      const kanjiBoxW = 180;
      const comboX = kanjiX - kanjiBoxW / 2 - 40; // 左側に変更
      const comboY = kanjiY;
      
      const timerRatio = battleState.comboTimer / 300; // 5秒 = 300フレーム
      const timerBarWidth = 60;
      const timerBarHeight = 4;
      
      // タイマーバー背景
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(comboX - timerBarWidth/2, comboY + 45, timerBarWidth, timerBarHeight);
      
      // タイマーバー（残り時間）
      const timerColor = timerRatio > 0.3 ? '#2ecc71' : '#e74c3c';
      ctx.fillStyle = timerColor;
      ctx.fillRect(comboX - timerBarWidth/2, comboY + 45, timerBarWidth * timerRatio, timerBarHeight);
    }
  },

  // カラーブラインド対応の色設定
  ACCESSIBLE_COLORS: {
    success: '#2ecc71',    // 緑（成功）
    warning: '#f39c12',    // オレンジ（警告）
    danger: '#e74c3c',     // 赤（危険）
    info: '#3498db',       // 青（情報）
    // パターンも併用
    successPattern: '✓',
    warningPattern: '⚠',
    dangerPattern: '✗',
    infoPattern: 'ℹ'
  },

  // 色とパターンを組み合わせた表示
  drawStatusWithPattern(ctx, status, x, y) {
    const config = this.ACCESSIBLE_COLORS[status];
    if (!config) return;
    
    // 色での表示
    ctx.fillStyle = config;
    ctx.fillRect(x, y, 20, 20);
    
    // パターンでの表示（色が識別できない場合の補助）
    ctx.fillStyle = 'white';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.ACCESSIBLE_COLORS[status + 'Pattern'], x + 10, y + 15);
  },

  // UI定数を追加
  UI_CONSTANTS: {
    ICON_SIZE: 16,
    ICON_MARGIN: 8,
    TEXT_PADDING: 12,
    SECTION_SPACING: 20
  },

  /**
   * シェイクエフェクトを開始するメソッド
   * @param {number} duration - エフェクトの持続フレーム数
   * @param {number} intensity - 震えの強さ
   */
  startShakeEffect(duration = 15, intensity = 5) {
    this.shakeEffect.active = true;
    this.shakeEffect.timer = duration;
    this.shakeEffect.duration = duration;
    this.shakeEffect.intensity = intensity;
    console.log('シェイクエフェクト開始:', duration, intensity); // デバッグ用
  },

  

  

  	// マウスダウンイベントハンドラを追加
	handleMouseDown(e) {
		const rect = this.canvas.getBoundingClientRect();
		const scaleX = this.canvas.width / rect.width;
		const scaleY = this.canvas.height / rect.height;
		const gx = (e.clientX - rect.left) * scaleX;
		const gy = (e.clientY - rect.top) * scaleY;

		// スクロールバー ヒットテスト
		if (this.logScrollbar) {
			const sb = this.logScrollbar;
			const inThumb = gx >= sb.thumbX && gx <= sb.thumbX + sb.thumbW && gy >= sb.thumbY && gy <= sb.thumbY + sb.thumbH;
			const inTrack = gx >= sb.trackX && gx <= sb.trackX + sb.trackW && gy >= sb.trackY && gy <= sb.trackY + sb.trackH;

			       			// サムをドラッグ開始
 			if (inThumb) {
        this.draggingLogThumb = true;
        this._dragStartY = gy;
				this._dragStartOffset = (this.blockHistory && this.blockHistory.length > 0)
					? (this.currentBlockIndex || 0) : (this.logOffset || 0);
        this._logHintDismissed = true;
        e.preventDefault();
        return;
      }
      // トラッククリックでジャンプ
      if (inTrack && !inThumb) {
        const rel = Math.max(0, Math.min(1, (gy - sb.trackY - sb.thumbH / 2) / Math.max(1, sb.trackH - sb.thumbH)));
				const next = Math.round(rel * (sb.maxOffset || 0));
				this.logOffset = next;
				if (this.blockHistory && this.blockHistory.length > 0) this.currentBlockIndex = next;
        this._logHintDismissed = true;
        e.preventDefault();
        return;
      }
		}

		// ボタンの押下状態を更新
		Object.entries(BTN).forEach(([key, b]) => {
			if (isMouseOverRect(gx, gy, b)) this.pressedButtons.add(key);
		});
	},

	// マウスアップイベントハンドラを追加
	handleMouseUp(e) {
		this.draggingLogThumb = false;
		this._dragStartY = null;
		this._dragStartOffset = null;
		if (this.pressedButtons) this.pressedButtons.clear();
	},

  /** 漢字カードを生成 */
  _createKanjiCard(kanjiData) {
    const collected = this.dexSet.has(kanjiData.id);

    const card = document.createElement('div');
    card.className = 'kanji-card';
    if (!collected) {
      card.classList.add('locked');
    }
    // 追加: バッジ配置のため
    card.style.position = 'relative';

    // 漢字
    const kanjiEl = document.createElement('div');
    kanjiEl.className = 'kanji-character';
    kanjiEl.textContent = collected ? kanjiData.kanji : '？';
    card.appendChild(kanjiEl);

    // 追加: マスター済みならバッジ表示（セッション内進捗参照）
    const mastered = !!(gameState.kanjiReadProgress && gameState.kanjiReadProgress[kanjiData.id]?.mastered);
    if (mastered) {
      const badge = document.createElement('div');
      badge.textContent = 'MASTER';
      badge.style.position = 'absolute';
      badge.style.top = '6px';
      badge.style.right = '6px';
      badge.style.fontSize = '12px';
      badge.style.color = '#fff';
      badge.style.background = '#3498db';
      badge.style.padding = '2px 6px';
      badge.style.borderRadius = '3px';
      badge.style.boxShadow = '0 1px 2px rgba(0,0,0,.3)';
      card.appendChild(badge);
    }
  },


};

export default battleScreenState;

// ---------- バトルロジック ----------

// 敵をスポーン（初期化）
function spawnEnemy() {
  const e = gameState.enemies[gameState.currentEnemyIndex];
  
  // 最後の敵の場合、ボスフラグを確認して必要なら設定
  if (gameState.currentEnemyIndex === gameState.enemies.length - 1 && !e.isBoss) {
    console.warn(`最後の敵 ${e.id} にisBossフラグがないため、設定します。`);
    e.isBoss = true;
  }
  
  // ボスのシールドHPを初期化（ここを追加）
  if (e.isBoss && e.shieldHp !== undefined) {
    // JSONに設定されているオリジナルのshieldHp値を保存
    if (e.originalShieldHp === undefined) {
      e.originalShieldHp = e.shieldHp;
    }
    // シールドHPを初期値に戻す
    e.shieldHp = e.originalShieldHp;
  } else if (e.isBoss && e.shieldHp === undefined) {
    // ボスなのにシールドHPが設定されていない場合、デフォルト値を設定
    e.shieldHp = 3;
    e.originalShieldHp = 3;
  }
  
  gameState.currentEnemy = e;
  updateEnemyUI(e.name, e.hp, e.maxHp);
  
  // 従来のログ初期化をaddToLogに置き換え
  // ↓ 削除
  // battleState.log = [];
  
  // ボス戦かどうかに応じてメッセージを変更
  if (e.isBoss) {
    addToLog(`ボス ${e.name} があらわれた！`);
    if (e.shieldHp > 0) addToLog(`${e.name}は防御態勢をとっている！`);
  } else {
    addToLog(`${e.name} があらわれた！`);
  }
  battleScreenState.showLogBlock([
    `${e.isBoss ? 'ボス ' : ''}${e.name} があらわれた！`,
    (e.isBoss && e.shieldHp > 0) ? 'シールドを展開している！' : ''
  ]);
  
  publish('playSE', 'appear');
  
  // ヒントレベルをリセット
  gameState.hintLevel = 0;
}

// battleScreen.js の onAttack 関数を修正
function onAttack() {
  if (DEBUG) console.log('🗡 onAttack() called — turn:', battleState.turn, 'inputEnabled:', battleState.inputEnabled);

  // 1) プレイヤーターンかつ入力許可中でなければ終了
if (battleState.turn !== 'player' || !battleState.inputEnabled) return;

// 2) 入力を取得してひらがなに変換
const inputEl = battleScreenState.inputEl;
if (!inputEl) { battleState.inputEnabled = true; return; }
battleState.inputEnabled = false;
const raw = inputEl.value.trim();
const answer = toHiragana(raw);

// ── 読みメッセージ生成 ──
const onyomiStr = (gameState.currentKanji.onyomi || []).join('、');
const kunyomiStr = (gameState.currentKanji.kunyomi || []).join('、');
const readingMsg = `正しいよみ: 音「${onyomiStr}」訓「${kunyomiStr}」`;

  const correctReadings = getReadings(gameState.currentKanji);
  const correct = correctReadings.includes(answer);

  if (correct) {
    // 正解処理
    if (DEBUG) console.log('正解！エフェクト開始'); // デバッグ用
    
    // 漢字ボックスのエフェクトを開始（黄色で光らせる）
    battleScreenState.startKanjiBoxEffect('rgba(241, 196, 15, 0.8)', 20);

    // ★★★ ここに石版攻撃エフェクトを追加 ★★★
    // 漢字ボックスの座標を取得
    const kanjiX = battleScreenState.canvas.width / 2;
    const kanjiY = 200;
    const kanjiBoxW = 180;
    const kanjiBoxH = 160;
    
    // 石版攻撃エフェクトを開始
    battleScreenState.startStoneAttackEffect(kanjiX, kanjiY, kanjiBoxW, kanjiBoxH);
    
    // 前回正解した漢字の情報を保存
    battleScreenState.lastAnsweredKanji = { ...gameState.currentKanji };
    
    // 正解時に前回の不正解をクリア
    battleScreenState.lastIncorrectAnswer = null;
    
    // 正解時の入力欄フィードバック
    inputEl.style.borderColor = 'green';
    inputEl.style.backgroundColor = 'rgba(0, 255, 0, 0.1)';
    setTimeout(() => {
      inputEl.style.borderColor = '#ccc';
      inputEl.style.backgroundColor = 'white';
    }, 500);
    
    // 正解処理
    battleState.lastAnswered = { ...gameState.currentKanji };
    gameState.correctKanjiList.push({ ...gameState.currentKanji });
    publish('playSE', 'correct');
    publish('addToKanjiDex', gameState.currentKanji.id);
    
    // 統計データの更新（正解）
    gameState.playerStats.totalCorrect++;
    gameState.playerStats.comboCount++;
    
    // ← 学習データ記録を追加（正解）
    const kanjiItem = kanjiData.find(k => k.id === gameState.currentKanji.id);
    if (kanjiItem) {
      kanjiItem.correctCount = (kanjiItem.correctCount || 0) + 1;
      if (DEBUG) console.log(`📈 漢字ID:${gameState.currentKanji.id} の正解カウント: ${kanjiItem.correctCount}`);
    }
    
    // チャレンジモードの場合、残り時間を加算
    if (gameState.gameMode === 'challenge') {
      battleState.timeRemaining += 5; // 正解ごとに5秒加算
    }
    
    // 1) 連続正解カウントアップ（既存のbattleState.comboCountは保持）
    battleState.comboCount++;
    
    // 5コンボで止める
    if (battleState.comboCount > 5) {
      battleState.comboCount = 5;
    }
    
    // コンボカウントが2以上になったらコンボアニメーションを開始
    if (battleState.comboCount >= 2) {
      battleScreenState.startComboAnimation(battleState.comboCount);
    }
    
    // 2) 基本ダメージ計算
    let baseDamage = gameState.playerStats.attack;
    
    // 追加: マスターかんじボーナス（基礎値2倍、1回消費）
    if (battleState.masteryBonusActive) {
      baseDamage = Math.floor(baseDamage * 2);
      battleState.masteryBonusActive = false;
      battleState.log.push('マスターかんじボーナス！2ばい！');
      publish('playSE', 'master'); // ← 追加
    }
    
    // ダメージに少しゆらぎ（±10%）
    let randomFactor = (Math.random() * 0.2) - 0.1;
    let dmg = Math.round(baseDamage * (1 + randomFactor));
    
    // 属性システム：敵の弱点判定
    let readingType = null;
    let isWeaknessHit = false;
    
    // プレイヤーの答えが音読みか訓読みかを正確に判定
    const kunyomiArr = Array.isArray(gameState.currentKanji.kunyomi) ? gameState.currentKanji.kunyomi : [];
    const onyomiArr  = Array.isArray(gameState.currentKanji.onyomi)  ? gameState.currentKanji.onyomi  : [];
    const isInKunyomi = kunyomiArr.includes(answer);
    const isInOnyomi  = onyomiArr.includes(answer);
    
    // 追加: 読み進捗更新・マスター判定
    updateKanjiMasteryAfterCorrect(gameState.currentKanji, answer);
    
    if (isInKunyomi && !isInOnyomi) {
      readingType = 'kunyomi';
    } else if (isInOnyomi && !isInKunyomi) {
      readingType = 'onyomi';
    } else if (isInKunyomi && isInOnyomi) {
      readingType = gameState.currentEnemy.weakness;
    }
    
        // 敵の弱点と一致するかチェック
        if (readingType && gameState.currentEnemy.weakness === readingType) {
          isWeaknessHit = true;
          dmg = Math.floor(dmg * 1.5);
          battleState.log.push('弱点にヒット！大ダメージ！');
    
          // 追加: ボスのシールドが残っているときは弱点SEを鳴らさない
          const enemy = gameState.currentEnemy;
          if (!(enemy.isBoss && enemy.shieldHp > 0)) {
            publish('playSE', 'weak');
          }
    
          // 弱点ヒット統計データの更新
          gameState.playerStats.weaknessHits++;
          if (DEBUG) console.log(`🎯 弱点ヒット! 敵の弱点: ${enemy.weakness}, プレイヤーの読み: ${readingType}`);
        }
    
    // 5連続正解ボーナス判定
    if (battleState.comboCount === 5) {
      dmg = Math.floor(dmg * 1.5);
      battleState.log.push('れんぞくせいかいボーナス！');
      battleScreenState.showLogBlock([
        'れんぞくせいかいボーナス！',
        'ダメージ1.5ばい！'
      ]);
      battleState.comboCount = 0;
    }
    
    // ====== ボス戦のシールドシステム ======
if (gameState.currentEnemy.isBoss) {
  // ボス戦の場合
  if (gameState.currentEnemy.shieldHp > 0) {
    // シールドがある場合
    if (isWeaknessHit) {
      // 弱点を突いた場合：シールドを削る
      const prevShieldHp = gameState.currentEnemy.shieldHp;
      gameState.currentEnemy.shieldHp--;
      const currentShieldHp = gameState.currentEnemy.shieldHp;
      
      battleState.log.push(`せいかい！${readingMsg}`);
      battleState.log.push('シールドにヒビが入った！');

      // ← 段階別のSEとメッセージ
      if (currentShieldHp === 2) {
        publish('playSE', 'shield1');
        battleState.log.push('シールドが不安定になってきた...');
        // シールドダメージエフェクト（軽度）
        battleScreenState.startShakeEffect(10, 3);
      } else if (currentShieldHp === 1) {
        publish('playSE', 'shield2'); 
        battleState.log.push('シールドが崩壊寸前だ！');
        // シールドダメージエフェクト（中度）
        battleScreenState.startShakeEffect(15, 5);
        battleScreenState.startFlashEffect('rgba(255, 100, 100, 0.3)', 20);
      } else if (currentShieldHp === 0) {
        publish('playSE', 'shield3');
        battleState.log.push('ボスの防御が完全に崩れた！');
        // シールド破壊エフェクト（強度）
        battleScreenState.startShakeEffect(25, 8);
        battleScreenState.startFlashEffect('rgba(255, 255, 255, 0.6)', 30);

      // **修正**: 直近のモンスター枠から中心座標と半径を取得（ex/ey/ew/eh に依存しない）
      const fa = battleScreenState._lastMonsterFrameArea;
const enemyEffectX = fa ? fa.x + fa.width / 2 : ((battleScreenState.canvas?.width || 800) / 2);
const enemyEffectY = fa ? fa.y + fa.height / 2 : ((battleScreenState.canvas?.height || 600) / 2);
const radius = fa ? Math.min(fa.width, fa.height) * 0.6 : 120;
// シールド破壊エフェクトを正確な位置で開始
battleScreenState.startShieldBreakEffect(enemyEffectX, enemyEffectY, radius);

// **追加**: シールド破壊後に漢字を切り替える
setManagedTimeout(() => {
  pickNextKanji();
  battleState.turn = 'player';
  battleState.inputEnabled = true;
}, 2500);
      }

      // 行動パック表示（段階に応じてメッセージを変更）
      const shieldMessages = [
        `せいかい！${readingMsg}`,
        '弱点にヒット！大ダメージ！',
      ];
      
      if (currentShieldHp > 0) {
        shieldMessages.push('シールドにヒビが入った！');
        if (currentShieldHp === 2) {
          shieldMessages.push('シールドが不安定になってきた...');
        } else if (currentShieldHp === 1) {
          shieldMessages.push('シールドが崩壊寸前だ！');
        }
      } else {
        shieldMessages.push('ボスの防御が完全に崩れた！');
      }
      
      battleScreenState.showLogBlock(shieldMessages);

      // シールドを削った場合は敵にダメージを与えない
      dmg = 0;

            // シールド破壊後も入力を継続できるように処理を修正
            battleState.lastCommandMode = 'attack';
            battleState.turn = 'enemy';
            battleState.inputEnabled = false;
            
            // タイミングを調整（シールド破壊エフェクトを見せるため）
            const waitTime = currentShieldHp === 0 ? 2000 : 1300; // 破壊時は2秒待機
            
            setManagedTimeout(() => {
              if (battleScreenState.shouldEnemyAttackAfterCorrect()) {
                enemyTurn();
                setManagedTimeout(() => {
                  if (currentShieldHp > 0) {
                    pickNextKanji();
                  }
                  battleState.turn = 'player';
                  battleState.inputEnabled = true;
                }, 1700);
              } else {
                if (currentShieldHp > 0) {
                  pickNextKanji();
                }
                battleState.turn = 'player';
                battleState.inputEnabled = true;
              }
            }, waitTime);
      
      // 入力欄をクリア
      inputEl.value = '';
      return; // ここで処理を終了
      
    } else {
      // 弱点を突いていない場合：ダメージを1に固定
      dmg = 1;
      battleState.log.push(`せいかい！${readingMsg}、しかし${gameState.currentEnemy.name}の防御は固い！`);
      battleScreenState.showLogBlock([
        `せいかい！${readingMsg}`,
        `${gameState.currentEnemy.name}のシールドがかたい！ダメージは1！`
      ]);
    }
  } else {
    // シールドHPが0の場合：通常通りのダメージ
    battleState.log.push(`せいかい！${readingMsg}、${gameState.currentEnemy.name}に${dmg}のダメージ！`);
  }
} else {
  // 通常の敵の場合の処理
  // 行動パック表示（ピン留め）
  battleScreenState.showLogBlock([
    `せいかい！${readingMsg}`,
    isWeaknessHit ? '弱点にヒット！大ダメージ！' : '',
    `${gameState.currentEnemy.name}に${dmg}のダメージ！`
  ]);
}
    
    // ダメージ適用（ボス戦でシールドを削った場合はdmg=0なので実質ダメージなし）
    if (dmg > 0) {
      gameState.currentEnemy.hp = Math.max(0, gameState.currentEnemy.hp - dmg);
    }
    
    battleState.enemyAction      = 'damage';
    battleState.enemyActionTimer = ENEMY_DAMAGE_ANIM_DURATION;
    updateEnemyUI(gameState.currentEnemy.name, gameState.currentEnemy.hp, gameState.currentEnemy.maxHp);
    
    // 敵撃破判定
    if (gameState.currentEnemy.hp === 0) {
      // 撃破ログ
      battleState.log.push(
        `${gameState.playerName}は${gameState.currentEnemy.name}をたおした！`
      );
      battleScreenState.showLogBlock([
        `${gameState.playerName}は${gameState.currentEnemy.name}をたおした！`
      ]);
      publish('playSE', 'defeat');
      battleState.enemyAction      = 'defeat';
      battleState.enemyActionTimer = ENEMY_DEFEAT_ANIM_DURATION;
      
      // ボス撃破統計の更新
      if (gameState.currentEnemy.isBoss) {
        gameState.playerStats.bossesDefeated++;
      }
      
      // 敵撃破の統計データを更新
      recordEnemyDefeated();
      
      // 実績チェックを実行
      checkAchievements().catch(error => {
        console.error('実績チェック中にエラーが発生しました:', error);
      });
      
      // 経験値獲得量（学年ボーナス中はリザルト一括付与のため0）
      const inBonus = /^bonus_g/i.test(String(gameState.currentStageId || ''));
      const expGained = inBonus ? 0 : (gameState.currentEnemy.exp || 30);

      if (expGained > 0) {

            // 経験値獲得メッセージを表示
            battleState.log.push(`${expGained}の経験値を獲得した！`);
        
            // パーティクル無しで即EXPへ反映（バーが右へ伸びる）
            const levelUpResult = updatePlayerExp(expGained);
            if (levelUpResult.leveledUp) {
              publish('playSE', 'levelUp');
              battleState.log.push(`レベルが ${levelUpResult.newLevel} にあがった！`);
              addToLog(`攻撃力が上がった！ HP最大値が増えた！`);
              battleScreenState.showLogBlock([
                `レベルが ${levelUpResult.newLevel} にあがった！`,
                '攻撃力が上がった！ HP最大値が増えた！'
              ]);
              battleScreenState.startLevelUpEffect(120);
            }
           }
      
             // 敵が残っていれば次の敵をスポーン、最後の敵ならステージクリア待機
             if (gameState.currentEnemyIndex < gameState.enemies.length - 1) {
                      waitForDefeatAnimationThen(() => {
                         // 敵撃破後に入力欄をクリア
                         const inputEl = battleScreenState.inputEl;
                         if (inputEl) inputEl.value = '';
                         gameState.currentEnemyIndex++;
                         spawnEnemy();
                         pickNextKanji();
                         battleState.turn = 'player';
                         battleState.inputEnabled = true;
                         
                         // 学年ボーナス連戦: バトル間 自動回復30%
                         if (/^bonus_g/i.test(String(gameState.currentStageId || ''))) {
                           const stats = gameState.playerStats;
                           const heal = Math.floor(stats.maxHp * 0.3);
                           stats.hp = Math.min(stats.maxHp, stats.hp + heal);
                           battleState.playerHpTarget = stats.hp;
                           battleState.playerHpAnimating = true;
                           battleState.log.push('連戦の合間にHPが回復した！（+30%）');
                           battleScreenState.showLogBlock([
                             '連戦の合間にHPが回復した！（+30%）'
                           ]);
                         }
                         
                         // 次の問題に進む際にヒントレベルをリセット
                         gameState.hintLevel = 0;

                      });
                    } else {// 最後の敵を倒した場合の処理を修正
                      if (gameState.currentEnemyIndex >= gameState.enemies.length - 1) {
                        waitForDefeatAnimationThen(() => {
                          // 倒したモンスターのリストを作成
                          const defeatedMonsters = gameState.enemies.map(e => ({
                            id: e.id,
                            name: e.name,
                            img: e.img
                          }));
                          // 入力欄をクリア（念のため）
                          const inputEl = battleScreenState.inputEl;
                          if (inputEl) inputEl.value = '';

                          // 捕獲画面へ遷移（勝利画面は捕獲から遷移する）
                          publish('changeScreen', 'monsterCapture', defeatedMonsters);
                        });
                      }
                    
                       // 最後の敵を倒した場合：ステージクリアを保留状態にする
                      waitForDefeatAnimationThen(() => {
                        const inputEl = battleScreenState.inputEl;
                        if (inputEl) inputEl.value = '';
                        battleScreenState.stageClearPending = true;
                      });
                     }
                     return;
    } else {
      // ← 敵を倒していない場合の処理：敵のターンに移行
      battleState.lastCommandMode = 'attack';
      battleState.turn = 'enemy';
      battleState.inputEnabled = false;
      
      setManagedTimeout(() => { // プレイヤー行動→敵ターン開始待ち: 1.3s
        if (battleScreenState.shouldEnemyAttackAfterCorrect()) {
          enemyTurn();
          setManagedTimeout(() => {
            pickNextKanji();
            battleState.turn = 'player';
            battleState.inputEnabled = true;
          }, 1700);
        } else {
          pickNextKanji();
          battleState.turn = 'player';
          battleState.inputEnabled = true;
        }
      }, 1300);
    }
    
  } else {
    // 不正解時の入力欄フィードバック
    inputEl.style.borderColor = 'red';
    inputEl.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
    setTimeout(() => {
      inputEl.style.borderColor = '#ccc';
      inputEl.style.backgroundColor = 'white';
    }, 500);
    
    // 不正解処理
    battleScreenState.lastIncorrectAnswer = answer;
    
    // 前回の漢字として記録
    battleState.lastAnswered = { ...gameState.currentKanji };
    gameState.wrongKanjiList.push({ ...gameState.currentKanji });
    publish('addToReview', gameState.currentKanji.id);
    publish('playSE', 'wrong');
    addToLog(`こうげきしっぱい！${readingMsg}`);
    battleScreenState.showLogBlock([
      'こうげきしっぱい！',
      readingMsg
    ]);
    
    // 統計データの更新（不正解）
    gameState.playerStats.totalIncorrect++;
    battleState.mistakesThisStage++;
    gameState.playerStats.comboCount = 0; // プレイヤー統計のコンボリセット
    
    // ← 学習データ記録を追加（不正解）
    const kanjiItem = kanjiData.find(k => k.id === gameState.currentKanji.id);
    if (kanjiItem) {
      kanjiItem.incorrectCount = (kanjiItem.incorrectCount || 0) + 1;
      if (DEBUG) console.log(`📉 漢字ID:${gameState.currentKanji.id} の不正解カウント: ${kanjiItem.incorrectCount}`);
    }
    
    // ★ コンボカウントを確実にリセット ★
    battleState.comboCount = 0;
    battleState.comboTimer = 0;
    if (DEBUG) console.log('❌ 不正解によりコンボがリセットされました');
    
    // 不正解時の正しい読みをハイライト表示
    const onyomiReadings = gameState.currentKanji.onyomi || [];
    const kunyomiReadings = gameState.currentKanji.kunyomi || [];
    
    let minOnyomiDistance = Infinity;
    let minKunyomiDistance = Infinity;
    
    // 音読みとの距離を計算
    for (const reading of onyomiReadings) {
      const distance = levenshteinDistance(answer, reading);
      minOnyomiDistance = Math.min(minOnyomiDistance, distance);
    }
    
    // 訓読みとの距離を計算
    for (const reading of kunyomiReadings) {
      const distance = levenshteinDistance(answer, reading);
      minKunyomiDistance = Math.min(minKunyomiDistance, distance);
    }
    
    // 入力に最も近い読み方を判定
    let correctType;
    if (minOnyomiDistance < minKunyomiDistance) {
      correctType = 'onyomi'; // 音読みが正解
    } else {
      correctType = 'kunyomi'; // 訓読みが正解
    }
    
    // ハイライト効果を開始
    battleScreenState.startReadingHighlight(correctType);
    
    // ★ 敵のターンへ移行（確実に実行） ★
    battleState.turn = 'enemy';
    battleState.inputEnabled = false;
    
    console.log('🔄 敵のターンに移行します');
    
      　      setTimeout(() => { // プレイヤー行動→敵ターン開始待ち: 1.3s
               enemyTurn();
              // 敵ターン終了→次の問題表示: 1.7s
              setTimeout(() => {
                 pickNextKanji();
                 battleState.turn = 'player';
                 battleState.inputEnabled = true;
              }, 1700);
            }, 1300);
  }
  
  // 入力欄をクリア
  inputEl.value = '';
}


// Levenshtein距離（文字列の類似度）を計算する関数
function levenshteinDistance(a, b) {
  // トリムして両方小文字に変換
  const normalizedA = a.trim().toLowerCase();
  const normalizedB = b.trim().toLowerCase();
  
  const matrix = [];
  
  // 初期化
  for (let i = 0; i <= normalizedB.length; i++) {
    matrix[i] = [i];
  }
  
  for (let i = 0; i <= normalizedA.length; i++) {
    matrix[0][i] = i;
  }
  
  // 行列を埋める
  for (let i = 1; i <= normalizedB.length; i++) {
    for (let j = 1; j <= normalizedA.length; j++) {
      if (normalizedB.charAt(i-1) === normalizedA.charAt(j-1)) {
        matrix[i][j] = matrix[i-1][j-1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i-1][j-1] + 1, // 置換
          matrix[i][j-1] + 1,   // 挿入
          matrix[i-1][j] + 1    // 削除
        );
      }
    }
  }
  
  return matrix[normalizedB.length][normalizedA.length];
}

// 回復ボタン
function onHeal() {
  if (DEBUG) console.log('💚 onHeal() called — turn:', battleState.turn, 'inputEnabled:', battleState.inputEnabled);

  // プレイヤーターンかつ入力許可中でなければ終了
  if (battleState.turn !== 'player' || !battleState.inputEnabled) return;

  // ▼▼▼ 修正：動的な回復回数チェック ▼▼▼
  const remainingHeals = gameState.playerStats.healCount || 0;
  const maxHealCount = battleScreenState.getMaxHealCountFromSettings();
  console.log(`🔍 回復回数チェック: 残り${remainingHeals}回 (上限: ${maxHealCount}回)`);
  
  if (remainingHeals <= 0) {
    alert(`このステージでの回復はもう使えません！（上限: ${maxHealCount}回）`);
    // 入力を再度有効にする
    battleState.inputEnabled = true;
    return;
  }
  // ▲▲▲ ここまで修正 ▲▲▲

  battleState.inputEnabled = false;
  battleState.lastCommandMode = 'heal';
  
  // 入力を取得してひらがなに変換
  const inputEl = battleScreenState.inputEl;
  if (!inputEl) { battleState.inputEnabled = true; return; }
  const raw    = inputEl.value.trim();
  const answer = toHiragana(raw);
  
  // 読みメッセージ生成
  const onyomiStr = (gameState.currentKanji.onyomi || []).join('、');
  const kunyomiStr = (gameState.currentKanji.kunyomi || []).join('、');
  const readingMsg = `正しいよみ: 音「${onyomiStr}」訓「${kunyomiStr}」`;

  // 正解判定
  const correctReadings = getReadings(gameState.currentKanji);
  const correct = correctReadings.includes(answer);

  if (correct) {
    // 正解処理
    
    // 正解時に前回の不正解をクリア
    battleScreenState.lastIncorrectAnswer = null;

    // ★★★ ここに石版攻撃エフェクトを追加（オプション） ★★★
    
    battleState.lastAnswered = { ...gameState.currentKanji };
    battleState.comboCount++;
    gameState.correctKanjiList.push({ ...gameState.currentKanji });
    publish('playSE', 'correct');
    publish('addToKanjiDex', gameState.currentKanji.id);

    // 統計データの更新（正解）
    gameState.playerStats.totalCorrect++;
    gameState.playerStats.comboCount++;

    // ★★★ 追加: 読み進捗更新・マスター判定 ★★★
    updateKanjiMasteryAfterCorrect(gameState.currentKanji, answer);

    // 回復前のHPを保存
    const prevHp = gameState.playerStats.hp;
    publish('playSE', 'heal');
    let healAmount = calculateHealAmount(gameState.playerStats.level);

    // 追加: 5連続正解ボーナス（回復時）
    if (battleState.comboCount === 5) {
      healAmount = Math.floor(healAmount * 1.5);
      battleState.log.push('れんぞくせいかいボーナス！');
      battleState.comboCount = 0;
    }

    // 変更: 変数を使って回復
    gameState.playerStats.hp = Math.min(
      gameState.playerStats.maxHp,
      gameState.playerStats.hp + healAmount
    );
    const healed = gameState.playerStats.hp - prevHp;
    battleState.playerHpTarget    = gameState.playerStats.hp;
    battleState.playerHpAnimating = true;
    // 回復成功ログ（新仕様）
    battleState.log.push(`かいふくせいこう！${readingMsg}`);

    // 行動パック表示（ピン留め）
    battleScreenState.showLogBlock([
      'かいふくせいこう！',
      readingMsg,
      `HPが${healed}かいふく！`
    ]);

    // 回復成功統計の更新
gameState.playerStats.healsSuccessful++;

    // ▼▼▼ 修正：回復回数を1消費（下限0）＋ログ出力 ▼▼▼
    const beforeCount = gameState.playerStats.healCount;
    gameState.playerStats.healCount = Math.max(0, (gameState.playerStats.healCount || 0) - 1);
    const afterCount = gameState.playerStats.healCount;
    console.log(`💊 回復使用: ${beforeCount}回 → ${afterCount}回`);
    
    // 残り回数が少ない場合の警告メッセージ
    if (afterCount === 1) {
      battleState.log.push('かいふくはあと1回だけ使えます');
    } else if (afterCount === 0) {
      battleState.log.push('このステージでのかいふくはもう使えません');
    }
    // ▲▲▲ ここまで修正 ▲▲▲

    // チャレンジモードの場合、残り時間を加算
    if (gameState.gameMode === 'challenge') {
      battleState.timeRemaining += 5; // 正解ごとに5秒加算
    }
  } else {
    // 不正解処理
    
    // 不正解の答えを保存
    battleScreenState.lastIncorrectAnswer = answer;
    
    battleState.lastAnswered = { ...gameState.currentKanji };
    gameState.wrongKanjiList.push({ ...gameState.currentKanji });
    publish('addToReview', gameState.currentKanji.id);
    publish('playSE', 'wrong');
    addToLog(`かいふくしっぱい！${readingMsg}`);
    battleScreenState.showLogBlock([
      'かいふくしっぱい！',
      readingMsg
    ]);

    // 統計データの更新（不正解）
    gameState.playerStats.totalIncorrect++;
    battleState.mistakesThisStage++;
    gameState.playerStats.comboCount = 0; // コンボカウントをリセット

    // チャレンジモードの時だけダメージを受ける
    if (gameState.gameMode === 'challenge') {
      const atk = gameState.currentEnemy.atk || 5;
      gameState.playerStats.hp = Math.max(0, gameState.playerStats.hp - atk);
      if (gameState.playerStats.hp === 0) {
        if (battleScreenState.timerId) { clearInterval(battleScreenState.timerId); battleScreenState.timerId = null; }
        return setManagedTimeout(() => publish('changeScreen', 'gameOver'), 1500);
      }
    }
  }

  // 入力欄をクリア
  inputEl.value = '';


      // 設定に応じて敵ターンを実行
      const healMode = localStorage.getItem('healMode') || 'noAttack'; // デフォルトは攻撃なし
      if (healMode === 'withAttack') {
        // プレイヤー行動→敵ターン開始待ち: 1.3s
        setManagedTimeout(() => {
          enemyTurn();
          // 敵ターン終了→次の問題表示: 1.7s
          setManagedTimeout(() => {
            pickNextKanji();
            // 入力再開までの待機: 0.65s
            setManagedTimeout(() => {
              battleState.turn = 'player';
              battleState.inputEnabled = true;
            }, 650);
          }, 1700);
        }, 1300);
      } else {
        // 攻撃なしモード: 直接次の問題へ
        setManagedTimeout(() => {
          pickNextKanji();
          // 入力再開までの待機: 0.65s
          setManagedTimeout(() => {
            battleState.turn = 'player';
            battleState.inputEnabled = true;
          }, 650);
        }, 1300);
      }
}
  

// ヒント切替
function onHint() {
  const current = Number(gameState.hintLevel || 0);
  if (current >= 4) {
    addToLog('ヒントはここまで！');
    return;
  }
  const level = current + 1;
  gameState.hintLevel = level;

  const k = gameState.currentKanji || {};
  const onyomi = Array.isArray(k.onyomi) ? k.onyomi : [];
  const kunyomi = Array.isArray(k.kunyomi) ? k.kunyomi : [];

  switch (level) {
    case 1: {
      const strokes = k.strokes ?? '?';
      addToLog(`ヒント（基本）: 画数は${strokes}`);
      battleScreenState.showLogBlock([`ヒント（基本）: 画数は${strokes}`]);
      break;
    }
    case 2: {
      const useOn = (onyomi.length > 0 && (Math.random() >= 0.5 || kunyomi.length === 0));
      const list = useOn ? onyomi : kunyomi;
      const first = list[0] || '';
      const masked = first ? first.substring(0, 1) + '○○' : '不明';
      addToLog(`ヒント（読み）: ${useOn ? '音読み' : '訓読み'}は「${masked}」から始まる`);
      battleScreenState.showLogBlock([`ヒント（読み）: ${useOn ? '音読み' : '訓読み'}は「${masked}」から始まる`]);
      break;
    }
    case 3: {
        addToLog(`ヒント（意味）: ${k.meaning ?? '（準備中）'}`);
        battleScreenState.showLogBlock([`ヒント（意味）: ${k.meaning ?? '（準備中）'}`]);
        break;
    }
    case 4: {
      // 最終ヒント: 読みのどちらかをフル提示
      if (onyomi.length > 0 || kunyomi.length > 0) {
        const useOn = onyomi.length > 0 ? (Math.random() >= 0.5 || kunyomi.length === 0) : false;
        const list = useOn ? onyomi : kunyomi;
        addToLog(`ヒント（決め手）: ${useOn ? '音読み' : '訓読み'}は「${list[0]}」`);
        battleScreenState.showLogBlock([`ヒント（決め手）: ${useOn ? '音読み' : '訓読み'}は「${list[0]}」`]);
      } else {
        addToLog('ヒント（決め手）: データがありません');
        battleScreenState.showLogBlock(['ヒント（決め手）: データがありません']);
      }
      break;
    }
  }
}


// 敵行動（フラッシュ効果を追加）
function enemyTurn() {
  // 敵の攻撃時に突進アニメーション開始
  battleState.enemyAction      = 'attack';
  battleState.enemyActionTimer = ENEMY_ATTACK_ANIM_DURATION;

  const atk = gameState.currentEnemy.atk || 5;
  // 敵攻撃メッセージのフォーマットを `${e.name} のこうげき！プレイヤー名に～のダメージ！` に変更
  battleState.log.push(
    `${gameState.currentEnemy.name} のこうげき！${gameState.playerName}に${atk}のダメージ！`
  );

  gameState.playerStats.hp = Math.max(0, gameState.playerStats.hp - atk);
  // ── ここから追加 ──
  battleState.playerHpTarget    = gameState.playerStats.hp;
  battleState.playerHpAnimating = true;
  
  // 被ダメージ時の画面フラッシュ効果を開始
  battleScreenState.startFlashEffect('rgba(255, 0, 0, 0.5)', 15);
  // ── ここまで追加 ──
  
  publish('playSE', 'damage');

  // 行動パック表示（ピン留め）
  battleScreenState.showLogBlock([
    `${gameState.currentEnemy.name} のこうげき！`,
    `${gameState.playerName}に${atk}のダメージ！`
  ]);

  if (gameState.playerStats.hp <= 0) {
    // タイマーがある場合は停止
    if (battleScreenState.timerId) {
      clearInterval(battleScreenState.timerId);
      battleScreenState.timerId = null;
    }
    return setTimeout(() => publish('changeScreen', 'gameOver'), 1500);
  }
}


export function pickNextKanji() {
  // ヒントレベルをリセット
  gameState.hintLevel = 0;
  // バナーも消去
  if (battleScreenState && typeof battleScreenState === 'object') {
    battleScreenState.currentHintText = '';
  }


  if (DEBUG) console.log('🎯 pickNextKanji() 開始 (属性システム対応)');

  const currentEnemy = gameState.currentEnemy;
  if (!currentEnemy || !currentEnemy.weakness) {
    console.warn('⚠️ 敵の弱点情報が見つかりません。通常の選択方法を使用します。');
    // フォールバック：通常の全体プールから選択
    return pickFromPool(gameState.kanjiPool, '全体プール');
  }

  if (DEBUG) console.log(`🎯 敵の弱点: ${currentEnemy.weakness}`);

  // 1. 敵の弱点に応じて第一候補リストを選択
  const primaryPool = currentEnemy.weakness === 'onyomi' 
    ? battleState.kanjiPool_onyomi 
    : battleState.kanjiPool_kunyomi;
  
  const fallbackPool = currentEnemy.weakness === 'onyomi' 
    ? battleState.kanjiPool_kunyomi 
    : battleState.kanjiPool_onyomi;

  console.log(`📋 第一候補プール: ${primaryPool.length}件`);
  console.log(`📋 フォールバックプール: ${fallbackPool.length}件`);

  // 2. 第一候補リストから出題可能な漢字を探す
  const primaryResult = pickFromPool(primaryPool, '第一候補');
  if (primaryResult) {
    if (DEBUG) console.log('✅ 第一候補プールから問題を選択しました');
    return primaryResult;
  }

  // 3. 第一候補が尽きた場合、フォールバックプールから選択
  if (DEBUG) console.log('⚠️ 第一候補プールが尽きました。フォールバックプールを使用します。');
  const fallbackResult = pickFromPool(fallbackPool, 'フォールバック');
  if (fallbackResult) {
    if (DEBUG) console.log('✅ フォールバックプールから問題を選択しました');
    return fallbackResult;
  }

  // 4. 両方のプールが尽きた場合の最終フォールバック
  console.warn('⚠️ 全てのプールが尽きました。全体プールから強制選択します。');

   return pickFromPool(gameState.kanjiPool, '最終フォールバック');
}

/**
 * 指定されたプールから直近出題回避ロジックを使って漢字を選択
 * @param {Array} pool 選択対象の漢字プール
 * @param {string} poolName プール名（ログ用）
 * @returns {boolean} 選択に成功したかどうか
 */
function pickFromPool(pool, poolName) {
  if (!pool || pool.length === 0) {
    console.warn(`⚠️ ${poolName}が空です`);
    return false;
  }

  // 直近出題を避けて候補を絞り込む
  let candidatePool = pool.filter(
    kanji => !battleState.recentKanjiIds.includes(kanji.id)
  );

  // 候補がいなくなったら全範囲から選ぶ
  if (candidatePool.length === 0) {
    console.warn(`⚠️ ${poolName}の全ての漢字が直近に出題済みです。全範囲から選択します。`);
    candidatePool = pool;
  }

  // ランダムに1問選択
  const selectedKanji = candidatePool[Math.floor(Math.random() * candidatePool.length)];
  
  if (!selectedKanji) {
    console.error(`❌ ${poolName}から漢字を選択できませんでした`);
    return false;
  }

  // 直近の出題履歴を更新
  battleState.recentKanjiIds.push(selectedKanji.id);
  if (battleState.recentKanjiIds.length > RECENT_QUESTIONS_BUFFER_SIZE) {
    battleState.recentKanjiIds.shift();
  }

  // 現在の問題として設定
  const processReadings = (readings) => {
    if (!readings) return [];
    if (Array.isArray(readings)) {
      return readings.map(r => toHiragana(r.trim())).filter(Boolean);
    } else if (typeof readings === 'string') {
      return readings.split(' ').map(r => toHiragana(r.trim())).filter(Boolean);
    }
    return [];
  };

  gameState.currentKanji = {
    id: selectedKanji.id,
    text: selectedKanji.kanji,
    kunyomi: processReadings(selectedKanji.kunyomi),
    onyomi: processReadings(selectedKanji.onyomi),
    weakness: selectedKanji.weakness,
    readings: getReadings(selectedKanji),
    meaning: selectedKanji.meaning,
    strokes: selectedKanji.strokes,
  };

  // 追加: マスター済み再出題なら、この出題中の1回だけ2倍ボーナスを有効化
  battleState.masteryBonusActive = isKanjiMastered(selectedKanji.id);

  gameState.showHint = false;
  addToLog(`「${gameState.currentKanji.text}」をよもう！`);
  const weakLabel =
  gameState.currentKanji.weakness === 'onyomi' ? '音読み' :
  gameState.currentKanji.weakness === 'kunyomi' ? '訓読み' : '';
battleScreenState.showLogBlock([
  'あたらしい もんだい！',
  `「${gameState.currentKanji.text}」をよもう！`,
  weakLabel ? `弱点は「${weakLabel}」！` : ''
]);
  
  if (DEBUG) console.log(`✅ ${poolName}から選択: ${selectedKanji.kanji} (ID: ${selectedKanji.id})`);
  if (DEBUG) console.log('📝 直近リスト:', battleState.recentKanjiIds);
  
  return true;
}

// HPバー・テキスト更新
function updateEnemyUI(name, hp, maxHp) {
  // battleScreenState の canvas と ctx を参照
  const ctx    = battleScreenState.ctx;
  const canvas = battleScreenState.canvas;
  if (!ctx || !canvas) return;
  // 画面上部に HP 表示＆ゲージ描画
  ctx.clearRect(0, 0, canvas.width, 50);
  ctx.fillStyle = 'white';
  ctx.font = '20px "UDデジタル教科書体",sans-serif';
  ctx.fillText(`${name} HP: ${hp}／${maxHp}`, 20, 30);

  const barW = 200;
  const rate = hp / maxHp;
  ctx.fillStyle = 'red';
  ctx.fillRect(20, 35, barW * rate, 10);
  ctx.strokeStyle = 'white';
  ctx.strokeRect(20, 35, barW, 10);
}


export function cleanup() {  
  const input = battleScreenState.inputEl;
  if (input) input.style.display = 'none';

  // チャレンジタイマー停止
  if (battleScreenState.timerId) { clearInterval(battleScreenState.timerId); battleScreenState.timerId = null; }

  // ペンディング中のタイムアウト解除
  if (Array.isArray(battleScreenState._timeouts)) {
    battleScreenState._timeouts.forEach(id => clearTimeout(id));
    battleScreenState._timeouts.length = 0;
  }

  battleScreenState.unregisterHandlers?.();
  battleScreenState.canvas = null;
  battleScreenState.ctx = null;
  battleScreenState.inputEl = null;
}

// 敵撃破アニメ（battleState.enemyAction === 'defeat'）の終了を待ってから callback を実行
function waitForDefeatAnimationThen(callback) {
  const check = () => {
    if (battleState.enemyAction === 'defeat' && battleState.enemyActionTimer > 0) {
      requestAnimationFrame(check);
    } else {
      // 念のため次フレームで実行
      requestAnimationFrame(() => callback());
    }
  };
  check();
}

/* ---------- ユーティリティ ---------- */
const hiraShift = ch => String.fromCharCode(ch.charCodeAt(0) - 0x60);
const toHira = s => s.replace(/[\u30a1-\u30f6]/g, hiraShift).trim();

// getReadings 関数を修正
function getReadings(k) {
  const set = new Set();
  
  // kunyomiの処理：配列か文字列かをチェック
  if (k.kunyomi) {
    if (Array.isArray(k.kunyomi)) {
      // 既に配列の場合
      k.kunyomi.forEach(r => {
        if (r && typeof r === 'string') {
          set.add(toHira(r.trim()));
        }
      });
    } else if (typeof k.kunyomi === 'string') {
      // 文字列の場合
      k.kunyomi.split(' ').forEach(r => {
        if (r) set.add(toHira(r.trim()));
      });
    }
  }
  
  // onyomiの処理：配列か文字列かをチェック
  if (k.onyomi) {
    if (Array.isArray(k.onyomi)) {
      // 既に配列の場合
      k.onyomi.forEach(r => {
        if (r && typeof r === 'string') {
          set.add(toHira(r.trim()));
        }
      });
    } else if (typeof k.onyomi === 'string') {
      // 文字列の場合
      k.onyomi.split(' ').forEach(r => {
        if (r) set.add(toHira(r.trim()));
      });
    }
  }
  
  return [...set].filter(Boolean); // undefined や空文字を除外
}

// battleScreen.js の normalizeReading 関数を改善
function toHiragana(input) {
  if (!input) return '';
  // 全角スペース、半角スペースをトリム
  let normalized = input.trim().replace(/\s+/g, '');
  // カタカナをひらがなに変換
  normalized = toHira(normalized);
  return normalized;
}

/**
 * 経験値バーを描画する関数（改良版）
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D コンテキスト
 * @param {number} x - バーのX座標
 * @param {number} y - バーのY座標
 * @param {number} width - バーの幅
 * @param {number} height - バーの高さ
 * @param {number} currentExp - 現在の経験値（レベル内での進行分）
 * @param {number} maxExp - 次のレベルまでに必要な経験値
 */
function drawExpBar(ctx, x, y, width, height, currentExp, maxExp) {
  // 背景（半透明の暗い色）
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(x, y, width, height);
  
  // 経験値バー（黄色グラデーション）
  if (maxExp > 0) {
    const expRatio = Math.min(currentExp / maxExp, 1);
    
    // グラデーションを作成して経験値バーをより鮮やかに
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, '#f1c40f'); // 上部は明るい黄色
    gradient.addColorStop(1, '#f39c12'); // 下部は琥珀色
    
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width * expRatio, height);
    
        // アニメーション中は光るエフェクトを追加
      if (battleScreenState.playerExpAnimating && currentExp > 0) {
      // バーの先端に光るハイライト
      const glowWidth = 5;
      const glowX = x + (width * expRatio) - glowWidth;
      
      // 光るグラデーション
      const glowGradient = ctx.createLinearGradient(glowX, y, glowX + glowWidth, y);
      glowGradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
      glowGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
      glowGradient.addColorStop(1, 'rgba(255, 255, 255, 0.1)');
      
      ctx.fillStyle = glowGradient;
      ctx.fillRect(glowX, y, glowWidth, height);
      
      // パーティクル効果（小さな光の粒）
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      for (let i = 0; i < 3; i++) {
        const particleX = x + Math.random() * (width * expRatio);
        const particleY = y + Math.random() * height;
        const particleSize = 1 + Math.random() * 2;
        ctx.fillRect(particleX, particleY, particleSize, particleSize);
      }
    }
  }
  
  // 枠線（白）
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);
  
  // 目盛り線を追加（進捗感を強化）
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.beginPath();
  for (let i = 1; i < 5; i++) {
    const markX = x + (width * i / 5);
    ctx.moveTo(markX, y);
    ctx.lineTo(markX, y + height);
  }
  ctx.stroke();
}

/**
 * 指定されたレベルに到達するために必要な経験値を計算する（再帰関数）
 * @param {number} level 計算したいレベル（1以上の整数）
 * @returns {number} そのレベルに到達するための必要経験値
 */
function calculateExpForLevel(level) {
  // 入力値の検証
  if (!Number.isInteger(level) || level < 1) {
    return 100; // エラー時のフォールバック
  }
  
  // ベースケース: レベル1の必要経験値は100
  if (level === 1) {
    return 100;
  }
  
  // 再帰ケース: レベルLからL+1になるための必要経験値
  // Math.floor(（レベルL-1の必要経験値） * 1.2) + 20
  const previousLevelExp = calculateExpForLevel(level - 1);
  return Math.floor(previousLevelExp * 1.2) + 20;
}

function updatePlayerExp(expGained) {
  // 既存の経験値加算処理
  const levelUpResult = addPlayerExp(expGained);

  // 経験値バーアニメーションの設定（レベル内EXPをそのまま使用）
  const player = gameState.playerStats;

  battleScreenState.playerExpTarget = Math.max(0, player.exp);
  battleScreenState.playerExpAnimating = true;

  return levelUpResult;
}

// メッセージをログに追加する共通関数を追加
function addToLog(message) {
  if (!Array.isArray(battleState.log)) battleState.log = []; // ガード追加
  battleState.log.push(message);
  // メッセージ追加時にタイプライター効果を開始
  battleScreenState.startTypewriterEffect(message);
}

// 以下の関数をbattleScreenStateオブジェクトの外部に定義
// これらのヘルパー関数を追加
function onAttackHandler() {
    // 下部ヘルプ: こうげき
    battleScreenState.helpHint = { visible: true, text: 'Enterキーでこうげき', timer: 120, alpha: 1 };
  // 関数内で使用する変数や関数を直接参照せず、
  // battleScreenStateのメソッドを通して安全に呼び出す
  try {
    // onAttack関数を直接呼び出す代わりに、
    // battleScreenStateのhandleAttackメソッドを呼び出す
    battleScreenState.handleAttack();
  } catch (error) {
    console.error('攻撃処理でエラーが発生しました:', error);
    battleState.inputEnabled = true;
  }
  
}


function getLevelStartExp(level) {
  // レベル開始時点の累積EXPを返す（Lv1は0）
  if (!Number.isInteger(level) || level <= 1) return 0;
  return calculateExpForLevel(level - 1);
}



function onHealHandler() {
    // 下部ヘルプ: かいふく
    battleScreenState.helpHint = { visible: true, text: 'Enterキーでかいふく', timer: 120, alpha: 1 };
  try {
    battleScreenState.handleHeal();
  } catch (error) {
    console.error('回復処理でエラーが発生しました:', error);
    battleState.inputEnabled = true;
  }
}

function onHintHandler() {
    // 下部ヘルプ: ヒント
    battleScreenState.helpHint = { visible: true, text: 'Enterキーでヒント', timer: 120, alpha: 1 };
  try {
    battleScreenState.handleHint();
  } catch (error) {
    console.error('ヒント処理でエラーが発生しました:', error);
    battleState.inputEnabled = true;
  }
}

// UIテーマの定義
const UI_THEME = {
  colors: {
    primary: '#3498db',
    secondary: '#2ecc71',
    accent: '#f39c12',
    danger: '#e74c3c',
    background: 'rgba(0, 0, 0, 0.7)',
    text: 'white',
    textSecondary: 'rgba(255, 255, 255, 0.8)'
  },
  fonts: {
    primary: '"UDデジタル教科書体", sans-serif',
    secondary: 'sans-serif'
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20
  },
  borderRadius: 4,
  shadowOpacity: 0.3
};

const threshold = 240; // 白と判定する明るさのしきい値
const colorDifferenceThreshold = 15; // R,G,B間の許容色差

// 回復量をレベルに応じて計算する関数
function calculateHealAmount(playerLevel) {
  // 基本回復量（レベル1の時）
  const baseHeal = 30;
  
  // レベルごとの増加量
  const levelBonus = Math.floor(playerLevel * 2.5);
  
  // 合計回復量（基本値 + レベルボーナス）
  return baseHeal + levelBonus;
}

// 読み進捗のエントリを確保
function ensureProgressEntry(kanjiId) {
  ensureProgressRoot();
  let prog = gameState.kanjiReadProgress[kanjiId];
  if (!prog) {
    gameState.kanjiReadProgress[kanjiId] = {
      onyomi: new Set(),
      kunyomi: new Set(),
      mastered: false,
    };
  } else {
    if (!(prog.onyomi instanceof Set)) {
      prog.onyomi = new Set(prog.onyomi || []);
    }
    if (!(prog.kunyomi instanceof Set)) {
      prog.kunyomi = new Set(prog.kunyomi || []);
    }
  }
  return gameState.kanjiReadProgress[kanjiId];
}

// 現在の問題の読み進捗を更新し、マスター済みか判定
function updateKanjiMasteryAfterCorrect(currentKanji, answer) {
  if (!currentKanji || !currentKanji.id) return;
  ensureProgressRoot();
  const id = currentKanji.id;
  const prog = ensureProgressEntry(id);

  const isKun = (currentKanji.kunyomi || []).includes(answer);
  const isOn  = (currentKanji.onyomi || []).includes(answer);

  if (!(prog.kunyomi instanceof Set)) prog.kunyomi = new Set(prog.kunyomi || []);
  if (!(prog.onyomi instanceof Set))  prog.onyomi  = new Set(prog.onyomi  || []);

  if (isKun) prog.kunyomi.add(answer);
  if (isOn)  prog.onyomi.add(answer);

  const before = !!prog.mastered;
  const allKunOk = (currentKanji.kunyomi || []).every(r => prog.kunyomi.has(r));
  const allOnOk  = (currentKanji.onyomi || []).every(r => prog.onyomi.has(r));
  prog.mastered = allKunOk && allOnOk;

  if (!before && prog.mastered) {
    battleScreenState.masteryFlash = { active: true, timer: 30, kanjiId: currentKanji.id };
    addToLog('ぜんぶよめた！マスターかんじになった！');
    battleScreenState.showLogBlock(['ぜんぶよめた！', 'マスターかんじになった！']);
  }
}

// その漢字がマスター済みか
function isKanjiMastered(kanjiId) {
  ensureProgressRoot(); // 追加
  const prog = gameState.kanjiReadProgress[kanjiId];
  return !!(prog && prog.mastered);
}

// 追加: 進捗ルートの初期化
function ensureProgressRoot() {
  if (!gameState.kanjiReadProgress) {
    gameState.kanjiReadProgress = {};
  }
}

// 音読み/訓読みありの漢字プールを初期化
const hasAny = (v) =>
  (Array.isArray(v) && v.length > 0) ||
  (typeof v === 'string' && v.trim().length > 0);

battleState.kanjiPool_onyomi = (gameState.kanjiPool || []).filter(k => hasAny(k.onyomi));
battleState.kanjiPool_kunyomi = (gameState.kanjiPool || []).filter(k => hasAny(k.kunyomi));

// MASTERバッジ描画
function drawMasterBadge(ctx, x, y) {
  ctx.save();
  ctx.font = 'bold 11px "UDデジタル教科書体",sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#3498db';
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;

  // 背景の丸角ラベル
  const label = 'MASTER';
  const padX = 6, padY = 3;
  const w = ctx.measureText(label).width + padX * 2;
  const h = 18;
  const rx = 5;
  const left = x - w, top = y;

  ctx.beginPath();
  ctx.moveTo(left + rx, top);
  ctx.lineTo(x - rx, top);
  ctx.quadraticCurveTo(x, top, x, top + rx);
  ctx.lineTo(x, top + h - rx);
  ctx.quadraticCurveTo(x, top + h, x - rx, top + h);
  ctx.lineTo(left + rx, top + h);
  ctx.quadraticCurveTo(left, top + h, left, top + h - rx);
  ctx.lineTo(left, top + rx);
  ctx.quadraticCurveTo(left, top, left + rx, top);
  ctx.closePath();

  ctx.fill();
  ctx.stroke();

  // 文字
  ctx.fillStyle = 'white';
  ctx.fillText(label, x - padX, top + 3);
  ctx.restore();
}

// 例: battleScreen.js 内のログ描画処理で使用
const LOG_STYLE = {
  bg: 'rgba(20,20,20,0.85)',
  border: '#B8860B',
  text: '#F3E9D7',
  stroke: 'rgba(0,0,0,0.9)',
  strokeW: 3,
  font: '16px "UDデジタル教科書体", sans-serif',
  lineH: 22,
  pad: 12,
};

function drawBattleLog(ctx, x, y, w, h, lines) {
  ctx.fillStyle = LOG_STYLE.bg;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = LOG_STYLE.border;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  ctx.font = LOG_STYLE.font;
  let cy = y + LOG_STYLE.pad;
  for (const raw of lines) {
    const { text, color = LOG_STYLE.text } = colorize(raw);
    ctx.lineWidth = LOG_STYLE.strokeW;
    ctx.strokeStyle = LOG_STYLE.stroke;
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';
    ctx.fillText(text, x + LOG_STYLE.pad, cy);
    ctx.strokeText(text, x + LOG_STYLE.pad, cy);
    cy += LOG_STYLE.lineH;
  }
}

function colorize(s) {
  if (s.includes('大ダメージ') || s.includes('弱点')) return { text: s, color: '#FFA94D' };     // オレンジ
  if (s.includes('回復')) return { text: s, color: '#7FE7C4' };                                 // ミント
  if (s.startsWith('★') || s.includes('ボーナス')) return { text: s, color: '#FFD700' };        // ゴールド
  if (s.includes('たおした')) return { text: s, color: '#F3E9D7' };
  return { text: s };
}

/**
 * シールド専用の枠エフェクトを描画
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D コンテキスト
 * @param {number} x - 枠のX座標
 * @param {number} y - 枠のY座標
 * @param {number} width - 枠の幅
 * @param {number} height - 枠の高さ
 * @param {Object} shieldStyle - シールドスタイル情報
 * @param {Object} currentStyle - 現在のスタイル情報
 */
function drawShieldFrameEffects(ctx, x, y, width, height, shieldStyle, currentStyle) {
  const time = Date.now() * 0.003;
  const integrity = shieldStyle.hp / shieldStyle.maxHp;
  
  ctx.save();
  
  // シールド状態に応じたエフェクト
  if (integrity <= 0.33) {
    // 危険状態：枠周りに警告エフェクト
    const dangerAlpha = (Math.sin(time * 6) + 1) * 0.3;
    ctx.strokeStyle = `rgba(255, 50, 50, ${dangerAlpha})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    drawRoundedRect(ctx, x - 5, y - 5, width + 10, height + 10, 12, true);
    ctx.setLineDash([]);
  } else if (integrity <= 0.66) {
    // 警戒状態：軽微な光る枠
    const warnAlpha = (Math.sin(time * 3) + 1) * 0.2;
    ctx.strokeStyle = `rgba(255, 165, 0, ${warnAlpha})`;
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, x - 2, y - 2, width + 4, height + 4, 10, true);
  }
  
  // シールドエネルギーの流れエフェクト
  const flowOffset = (time * 50) % 20;
  ctx.strokeStyle = currentStyle.accentColor;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.3;
  
  for (let i = 0; i < 4; i++) {
    const offset = (flowOffset + i * 5) % 20;
    ctx.setLineDash([4, 16]);
    ctx.lineDashOffset = -offset;
    drawRoundedRect(ctx, x + i, y + i, width - i * 2, height - i * 2, 8 - i, true);
  }
  
  ctx.restore();
}
/**
 * モンスター出現枠を描画する関数
 */

function drawMonsterFrame(ctx, x, y, width, height, enemy = null, style = 'normal') {
  ctx.save();
  
  // 敵のタイプに応じて枠のスタイルを決定
  let frameStyle = style;
  let shieldStyle = null;
  
  if (enemy) {
    // ★★★ 修正：battleScreenStateオブジェクトのメソッドを正しく呼び出し ★★★
    frameStyle = battleScreenState.getFrameStyleByOrder(gameState.currentEnemyIndex, enemy.isBoss);

    if (enemy.isBoss) {
      frameStyle = 'boss';
      // ★★★ シールド状態の判定を追加 ★★★
      if (enemy.shieldHp > 0) {
        shieldStyle = {
          hp: enemy.shieldHp,
          maxHp: enemy.originalShieldHp || 3
        };
      }
    }
    // ★★★ 削除：不要になった else if 分岐を削除 ★★★
    // else if (enemy.level >= 10) {
    //   frameStyle = 'elite';
    // }
  }
  
  // 枠の基本設定
  const cornerRadius = 8;
  const frameThickness = 6;
  const innerPadding = 8;
  
  // スタイル別の色設定
  const styles = {
    normal: {
      outerColor: '#4a5568',
      innerColor: '#2d3748',
      glowColor: '#63b3ed',
      bgColor: 'rgba(45, 55, 72, 0.8)',
      accentColor: '#4299e1'
    },
    elite: {
      outerColor: '#9f7aea',
      innerColor: '#553c9a',
      glowColor: '#d53f8c',
      bgColor: 'rgba(85, 60, 154, 0.8)',
      accentColor: '#b794f6'
    },
    boss: {
      outerColor: '#e53e3e',
      innerColor: '#c53030',
      glowColor: '#fc8181',
      bgColor: 'rgba(197, 48, 48, 0.8)',
      accentColor: '#feb2b2'
    }
  };
  
  let currentStyle = styles[frameStyle];
  
  // ★★★ シールドがある場合、スタイルを上書き ★★★
  if (shieldStyle) {
    const shieldIntegrity = shieldStyle.hp / shieldStyle.maxHp;
    const time = Date.now() * 0.003;
    const pulse = (Math.sin(time * 2) + 1) * 0.5; // 0-1の範囲でパルス
    
    if (shieldIntegrity > 0.66) {
      // 健全状態：青いシールド
      currentStyle = {
        outerColor: `rgba(100, 180, 255, ${0.8 + pulse * 0.2})`,
        innerColor: `rgba(70, 130, 200, ${0.6 + pulse * 0.2})`,
        glowColor: '#64b5f6',
        bgColor: 'rgba(100, 180, 255, 0.1)',
        accentColor: '#42a5f5'
      };
    } else if (shieldIntegrity > 0.33) {
      // 警戒状態：青紫のシールド
      currentStyle = {
        outerColor: `rgba(150, 120, 255, ${0.8 + pulse * 0.2})`,
        innerColor: `rgba(120, 90, 200, ${0.6 + pulse * 0.2})`,
        glowColor: '#9c27b0',
        bgColor: 'rgba(150, 120, 255, 0.1)',
        accentColor: '#ba68c8'
      };
    } else {
      // 危険状態：赤紫のシールド + 激しい点滅
      const dangerPulse = (Math.sin(time * 4) + 1) * 0.5; // より激しい点滅
      currentStyle = {
        outerColor: `rgba(200, 100, 200, ${0.7 + dangerPulse * 0.3})`,
        innerColor: `rgba(150, 70, 150, ${0.5 + dangerPulse * 0.3})`,
        glowColor: '#f06292',
        bgColor: 'rgba(200, 100, 200, 0.15)',
        accentColor: '#ec407a'
      };
    }
  }
  
  // 1. 外側の光るエフェクト（シールド状態に応じて調整）
  if (frameStyle !== 'normal' || shieldStyle) {
    const time = Date.now() * 0.003;
    const glowIntensity = shieldStyle 
      ? (Math.sin(time * 2) + 1) * 0.4 + 0.4  // シールド時はより強く光る
      : (Math.sin(time) + 1) * 0.3 + 0.4;     // 通常時
    
    ctx.shadowColor = currentStyle.glowColor;
    ctx.shadowBlur = shieldStyle ? 20 : 15; // シールド時はより大きな光
    ctx.strokeStyle = currentStyle.glowColor;
    ctx.globalAlpha = glowIntensity;
    ctx.lineWidth = shieldStyle ? 4 : 3; // シールド時はより太い線
    drawRoundedRect(ctx, x - 3, y - 3, width + 6, height + 6, cornerRadius + 3, true);
    ctx.globalAlpha = 1;
  }
  
  // 2. 背景（シールド状態に応じて調整）
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.fillStyle = currentStyle.bgColor;
  drawRoundedRect(ctx, x, y, width, height, cornerRadius);
  
  // 3. 外枠（シールド状態に応じて太さ調整）
  ctx.strokeStyle = currentStyle.outerColor;
  ctx.lineWidth = shieldStyle ? frameThickness + 2 : frameThickness; // シールド時はより太く
  drawRoundedRect(ctx, x, y, width, height, cornerRadius, true);
  
  // 4. 内側の装飾枠
  const innerX = x + frameThickness;
  const innerY = y + frameThickness;
  const innerWidth = width - frameThickness * 2;
  const innerHeight = height - frameThickness * 2;
  
  ctx.strokeStyle = currentStyle.innerColor;
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, innerX, innerY, innerWidth, innerHeight, cornerRadius - 2, true);
  
  // 5. ★★★ シールド専用エフェクト ★★★
  if (shieldStyle) {
    drawShieldFrameEffects(ctx, x, y, width, height, shieldStyle, currentStyle);
  }
  
  // 6. 角の装飾（ボス・エリート用）
  if (frameStyle !== 'normal') {
    drawCornerDecorations(ctx, x, y, width, height, currentStyle.accentColor, frameStyle);
  }
  
  // 7. 中央の表示エリア（モンスター画像用）
  const displayX = x + frameThickness + innerPadding;
  const displayY = y + frameThickness + innerPadding;
  const displayWidth = width - (frameThickness + innerPadding) * 2;
  const displayHeight = height - (frameThickness + innerPadding) * 2;
  
  ctx.restore();
  
  // 表示エリアの座標を返す
  return {
    x: displayX,
    y: displayY,
    width: displayWidth,
    height: displayHeight
  };
}

/**
 * 角の装飾を描画
 */
function drawCornerDecorations(ctx, x, y, width, height, color, frameStyle) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  
  const cornerSize = frameStyle === 'boss' ? 20 : 15;
  const offset = 3;
  
  // 四隅の装飾線
  const corners = [
    { x: x + offset, y: y + offset, dirX: 1, dirY: 1 },
    { x: x + width - offset, y: y + offset, dirX: -1, dirY: 1 },
    { x: x + offset, y: y + height - offset, dirX: 1, dirY: -1 },
    { x: x + width - offset, y: y + height - offset, dirX: -1, dirY: -1 }
  ];
  
  corners.forEach(corner => {
    ctx.beginPath();
    ctx.moveTo(corner.x, corner.y + corner.dirY * cornerSize);
    ctx.lineTo(corner.x, corner.y);
    ctx.lineTo(corner.x + corner.dirX * cornerSize, corner.y);
    ctx.stroke();
    
    if (frameStyle === 'boss') {
      ctx.beginPath();
      ctx.moveTo(corner.x + corner.dirX * 5, corner.y + corner.dirY * 10);
      ctx.lineTo(corner.x + corner.dirX * 10, corner.y + corner.dirY * 5);
      ctx.stroke();
    }
  });
}

/**
 * 角丸矩形を描画するヘルパー関数
 */
function drawRoundedRect(ctx, x, y, width, height, radius, strokeOnly = false) {
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
  
  if (strokeOnly) {
    ctx.stroke();
  } else {
    ctx.fill();
  }
}