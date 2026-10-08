// src/screens/achievementsScreen.js
// 実績一覧画面
import { publish } from '../core/eventBus.js';
import { gameState, isAchievementUnlocked } from '../core/gameState.js';
import { drawButton, isMouseOverRect } from '../ui/uiRenderer.js';
import { drawAchievementBadge, getAchievementBadgeLabel } from '../ui/achievementBadges.js';
import { loadDex as loadKanjiDex } from '../models/kanjiDex.js';
import { loadDex as loadMonsterDex } from '../models/monsterDex.js';
import { getGameCoordinates, isValidCoordinates } from '../utils/coordinateUtils.js';
import { syncPortraitCanvas, restoreLandscapeCanvas, isPortraitCanvas } from './battle/portraitLayout.js';

// 並び。スマホを たてに 持った時（480×680）は 1列を 横いっぱいに、ボタンは 下に（2026-10-04）
const LIST_WIDE = { x: 50, w: 680, iconX: 60, textX: 95, rightX: 720, startY: 110, lineHeight: 45, itemHeight: 40, perPage: 8, pageY: 525 };
const LIST_TALL = { x: 10, w: 460, iconX: 20, textX: 55, rightX: null, startY: 112, lineHeight: 54, itemHeight: 48, perPage: 9, pageY: 600 };
function layoutButtons(portrait) {
  if (portrait) {
    Object.assign(BTN.back, { x: 10, y: 10, w: 130, h: 44 });
    Object.assign(BTN.prevPage, { x: 10, y: 620, w: 150, h: 48 });
    Object.assign(BTN.nextPage, { x: 320, y: 620, w: 150, h: 48 });
  } else {
    Object.assign(BTN.back, { x: 20, y: 20, w: 100, h: 30 });
    Object.assign(BTN.prevPage, { x: 580, y: 500, w: 100, h: 40 });
    Object.assign(BTN.nextPage, { x: 690, y: 500, w: 100, h: 40 });
  }
}

const BTN = {
  back: { x: 20, y: 20, w: 100, h: 30, label: 'メニューへ' },
  prevPage: { x: 580, y: 500, w: 100, h: 40, label: '前のページ' },
  nextPage: { x: 690, y: 500, w: 100, h: 40, label: '次のページ' }
};

const achievementsScreen = {
  canvas: null,
  ctx: null,
  achievements: [],     // 全実績データ
  scroll: 0,           // 表示開始インデックス
  itemsPerPage: 8,     // 1ページあたりの表示数
  _clickHandler: null,
  _keyHandler: null,

  /** enter：画面表示時の初期化 */
  async enter(arg) {
    // canvas 引数が HTMLCanvasElement ならそれを使い、そうでなければ DOM から取得
    this.canvas = (arg && typeof arg.getContext === 'function')
      ? arg
      : document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    
    // 実績データを読み込み
    await this.loadAchievements();
    
    this.scroll = 0;
    
    // イベント登録
    this._clickHandler = e => {
      // 画面の 座標を 盤面の 座標に（以前は そのまま 比べていて、800×600 で 表示されて いない 時は ボタンが ずれた）
      const coords = getGameCoordinates(e, this.canvas);
      if (!isValidCoordinates(coords)) return;
      const x = coords.x, y = coords.y;
      
      // 戻るボタン（プロフィール画面から入るのが正規動線）
      if (isMouseOverRect(x, y, BTN.back)) {
        publish('playSE', 'decide');
        publish('changeScreen', 'profile');
        return;
      }
      
      // 前のページボタン
      if (isMouseOverRect(x, y, BTN.prevPage)) {
        this.scroll = Math.max(0, this.scroll - this.itemsPerPage);
        publish('playSE', 'decide');
        return;
      }
      
      // 次のページボタン
      if (isMouseOverRect(x, y, BTN.nextPage)) {
        const maxScroll = Math.max(0, this.achievements.length - this.itemsPerPage);
        this.scroll = Math.min(maxScroll, this.scroll + this.itemsPerPage);
        publish('playSE', 'decide');
        return;
      }
    };
    this.canvas.addEventListener('click', this._clickHandler);
    
    this._keyHandler = e => {
      if (e.key === 'ArrowUp') {
        this.scroll = Math.max(0, this.scroll - this.itemsPerPage);
      } else if (e.key === 'ArrowDown') {
        const maxScroll = Math.max(0, this.achievements.length - this.itemsPerPage);
        this.scroll = Math.min(maxScroll, this.scroll + this.itemsPerPage);
      }
    };
    window.addEventListener('keydown', this._keyHandler);
  },

   /** 実績データを読み込む */
   async loadAchievements() {
    try {
      const response = await fetch('/data/achievements.json');
      if (!response.ok) {
        throw new Error(`実績データの読み込みに失敗: ${response.statusText}`);
      }
      this.achievements = await response.json();
      console.log(`📋 実績データを読み込みました: ${this.achievements.length}件`);
    } catch (error) {
      console.error('❌ 実績データの読み込みエラー:', error);
      this.achievements = [];
    }
  },

  /** update：毎フレーム描画 */
  update(dt) {
    // スマホを たてに 持った時は 盤面を 480×680 に（screens/battle/portraitLayout.js）
    syncPortraitCanvas(this.canvas);
    const portrait = isPortraitCanvas(this.canvas);
    layoutButtons(portrait);
    this.itemsPerPage = (portrait ? LIST_TALL : LIST_WIDE).perPage;
    const { ctx, canvas } = this;
    
    // 背景
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 戻るボタン描画
    drawButton(ctx, BTN.back.x, BTN.back.y, BTN.back.w, BTN.back.h, BTN.back.label);

    // ページ送りボタン描画（必要な場合のみ）
    if (this.achievements.length > this.itemsPerPage) {
      drawButton(ctx, BTN.prevPage.x, BTN.prevPage.y, BTN.prevPage.w, BTN.prevPage.h, BTN.prevPage.label);
      drawButton(ctx, BTN.nextPage.x, BTN.nextPage.y, BTN.nextPage.w, BTN.nextPage.h, BTN.nextPage.label);
    }

    // タイトル
    ctx.fillStyle = 'white';
    ctx.font = '28px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('実績一覧', canvas.width / 2, 70);

    // 実績の統計情報
    const unlockedCount = gameState.unlockedAchievements.size;
    const totalCount = this.achievements.length;
    const percentage = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;
    
    ctx.font = '18px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FFD700';
    ctx.fillText(`バッジ ${unlockedCount}/${totalCount} (${percentage}%)`, canvas.width - 20, 40);

    // 実績リスト描画
    this.drawAchievementsList();

    // ページ情報表示
    if (this.achievements.length > this.itemsPerPage) {
      const currentPage = Math.floor(this.scroll / this.itemsPerPage) + 1;
      const totalPages = Math.ceil(this.achievements.length / this.itemsPerPage);
      ctx.fillStyle = 'white';
      ctx.font = '16px "UDデジタル教科書体", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${currentPage} / ${totalPages}`, canvas.width / 2, (portrait ? LIST_TALL : LIST_WIDE).pageY);
    }
  },

  /** 実績リストを描画 */
  drawAchievementsList() {
    const { ctx } = this;
    const L = isPortraitCanvas(this.canvas) ? LIST_TALL : LIST_WIDE;
    this._list = L;
    const startY = L.startY;
    const lineHeight = L.lineHeight;
    const itemWidth = L.w;
    const itemHeight = L.itemHeight;
    
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < this.itemsPerPage; i++) {
      const idx = this.scroll + i;
      if (idx >= this.achievements.length) break;
      
      const achievement = this.achievements[idx];
      const y = startY + i * lineHeight;
      const isUnlocked = isAchievementUnlocked(achievement.id);
      
      // アイテム背景
      if (isUnlocked) {
        // 解除済み：輝く背景
        const gradient = ctx.createLinearGradient(L.x, y - itemHeight/2, L.x + itemWidth, y + itemHeight/2);
        gradient.addColorStop(0, 'rgba(255, 215, 0, 0.1)');
        gradient.addColorStop(0.5, 'rgba(255, 215, 0, 0.2)');
        gradient.addColorStop(1, 'rgba(255, 215, 0, 0.1)');
        ctx.fillStyle = gradient;
      } else {
        // 未解除：暗い背景
        ctx.fillStyle = 'rgba(148, 168, 187, 0.12)';
      }
      ctx.fillRect(L.x, y - itemHeight/2, itemWidth, itemHeight);
      
      // 枠線
      ctx.strokeStyle = isUnlocked ? '#FFD700' : '#6d7c8b';
      ctx.lineWidth = 1;
      ctx.strokeRect(L.x, y - itemHeight/2, itemWidth, itemHeight);

      if (isUnlocked) {
        // 解除済み実績の表示
        this.drawUnlockedAchievement(achievement, y);
      } else {
        // 未解除実績の表示
        this.drawLockedAchievement(achievement, y);
      }
    }
  },

  /** 解除済み実績を描画 */
  drawUnlockedAchievement(achievement, y) {
    const { ctx } = this;
    
    const L = this._list || LIST_WIDE;
    drawAchievementBadge(ctx, achievement, L.iconX, y, true);
    
    // タイトル
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 18px "UDデジタル教科書体", sans-serif';
    ctx.fillText(achievement.title, L.textX, y - 8);
    
    // 説明
    ctx.fillStyle = 'white';
    ctx.font = '14px "UDデジタル教科書体", sans-serif';
    ctx.fillText(achievement.description, L.textX, y + 12);
    
    // 解除済みマーク（たての 画面は 右に 場所が ないので 出さない。金色の タイトルで わかる）
    if (L.rightX) {
      ctx.fillStyle = '#00FF00';
      ctx.font = '12px "UDデジタル教科書体", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('✓ できた！', L.rightX, y);
      ctx.textAlign = 'left';
    }
  },

  /** 未解除実績を描画 */
  drawLockedAchievement(achievement, y) {
    const { ctx } = this;
    
    const L = this._list || LIST_WIDE;
    drawAchievementBadge(ctx, achievement, L.iconX, y, false);
    
    // 隠されたタイトル
    ctx.fillStyle = '#d5dceb';
    ctx.font = '18px "UDデジタル教科書体", sans-serif';
    ctx.fillText(`${getAchievementBadgeLabel(achievement)}の バッジ`, L.textX, y - 8);
    
    // 隠された説明
    ctx.fillStyle = '#bfcbd9';
    ctx.font = '14px "UDデジタル教科書体", sans-serif';
    // たての 画面は 右に 場所が ないので、ヒントが あれば 説明の 行に 出す
    const hint = this.shouldShowHint(achievement) ? this.getConditionHint(achievement) : '';
    ctx.fillText(!L.rightX && hint ? hint : 'あそびながら 見つけよう', L.textX, y + 12);
    
    // 条件のヒント（オプション）
    if (L.rightX && this.shouldShowHint(achievement)) {
      ctx.fillStyle = '#c1cbd8';
      ctx.font = '12px "UDデジタル教科書体", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(this.getConditionHint(achievement), L.rightX, y);
      ctx.textAlign = 'left';
    }
  },

   /** ヒントを表示するかどうかの判定 */
   shouldShowHint(achievement) {
    const { condition } = achievement;
    const playerStats = gameState.playerStats;
    
    switch (condition.type) {
      case 'enemiesDefeated':   return playerStats.enemiesDefeated > 0;
      case 'levelReached':      return playerStats.level > 1;
      case 'stagesCleared':     return playerStats.stagesCleared > 0;
      case 'stageCleared':      return true;
      case 'comboReached':      return playerStats.comboCount > 0;
      case 'totalCorrect':      return playerStats.totalCorrect > 0;
      case 'skillPointsUsed':   return playerStats.skillPointsUsed > 0;
      case 'bossesDefeated':    return playerStats.bossesDefeated > 0;
      case 'playtimeMinutes':   return playerStats.playtimeSeconds > 0;
      case 'weaknessHits':      return playerStats.weaknessHits > 0;
      case 'healsSuccessful':   return playerStats.healsSuccessful > 0;
      default:
        return false;
    }
  },
  /** 条件のヒントテキストを生成 */
  getConditionHint(achievement) {
    const { condition } = achievement;
    const playerStats = gameState.playerStats;
    
    switch (condition.type) {
      case 'enemiesDefeated':
        return `敵撃破 ${playerStats.enemiesDefeated}/${condition.value}`;
      case 'levelReached':
        return `レベル ${playerStats.level}/${condition.value}`;
      case 'stagesCleared':
        return `ステージ ${playerStats.stagesCleared}/${condition.value}`;
      case 'stageCleared':
        return `対象: ${condition.value}`;
      case 'comboReached':
        return `コンボ ${playerStats.comboCount}/${condition.value}`;
      case 'kanjiCollected': {
        const kanjiCount = loadKanjiDex().size;
        return `漢字 ${kanjiCount}/${condition.value}`;
      }
      case 'monstersCollected': {
        const monsterCount = loadMonsterDex().size;
        return `モンスター ${monsterCount}/${condition.value}`;
      }
      case 'totalCorrect':
        return `正解 ${playerStats.totalCorrect}/${condition.value}`;
      case 'skillPointsUsed':
        return `SP使用 ${playerStats.skillPointsUsed}/${condition.value}`;
      case 'bossesDefeated':
        return `ボス ${playerStats.bossesDefeated}/${condition.value}`;
      case 'playtimeMinutes':
        return `プレイ ${Math.floor(playerStats.playtimeSeconds / 60)}/${condition.value}分`;
      case 'weaknessHits':
        return `弱点 ${playerStats.weaknessHits}/${condition.value}`;
      case 'healsSuccessful':
        return `回復 ${playerStats.healsSuccessful}/${condition.value}`;
      default:
        return '条件を満たすと解除';
    }
  },

  /** exit：画面離脱時のクリーンアップ */
  exit() {
    restoreLandscapeCanvas(this.canvas); // ほかの 画面は 800×600 で 描く
    layoutButtons(false);
    // イベント解除
    if (this.canvas && this._clickHandler) {
      this.canvas.removeEventListener('click', this._clickHandler);
    }
    if (this._keyHandler) {
      window.removeEventListener('keydown', this._keyHandler);
    }
    this.canvas = this.ctx = null;
    this.achievements = [];
  }
};

export default achievementsScreen;

// 追加: FSM 一貫化のため描画エントリポイントを alias
achievementsScreen.render = function() {
  this.update(0);
}; 