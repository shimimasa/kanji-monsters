import { gameState, saveGameData } from '../core/gameState.js';
import { drawButton, isMouseOverRect } from '../ui/uiRenderer.js';
import { publish } from '../core/eventBus.js';
import { images } from '../loaders/assetsLoader.js';
import { checkAchievements } from '../core/achievementManager.js';
import { getGameCoordinates, isValidCoordinates } from '../utils/coordinateUtils.js';
import { syncPortraitCanvas, restoreLandscapeCanvas, isPortraitCanvas } from './battle/portraitLayout.js';

const statusScreenState = {
  canvas: null,
  ctx: null,
  _clickHandler: null,
  hpUpgradeButton: null,
  attackUpgradeButton: null,
  backButton: null,
  companionImage: null,

  /** 画面表示時の初期化 */
  enter(arg) {
    const entry = this._entry = (this._entry || 0) + 1;
    this.companionImage = null;
    // canvas が渡されなければ DOM から取得
    this.canvas = (arg && typeof arg.getContext === 'function')
      ? arg
      : document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    // 広場と同じあいぼうの絵を、ここを開いた時だけ読み込む。
    import('../minigames/gotomonService.js').then(({ gotomonService }) => {
      if (this._entry !== entry) return;
      const url = gotomonService.getSelectedGotomon()?.imageUrl;
      if (!url) return;
      const image = new Image();
      image.onload = () => { if (this._entry === entry) this.companionImage = image; };
      image.src = url;
    }).catch(() => {});

    // ボタン設定
    const cx = this.canvas.width / 2;
    this.hpUpgradeButton = { 
      x: cx - 180, y: 300, width: 160, height: 50, 
      text: 'HP+10 (SP:1)', 
      cost: 1, 
      stat: 'maxHp', 
      increase: 10 
    };
    this.attackUpgradeButton = { 
      x: cx + 20, y: 300, width: 160, height: 50, 
      text: '攻撃+2 (SP:1)', 
      cost: 1, 
      stat: 'attack', 
      increase: 2 
    };
    this.backButton = { 
      x: cx - 100, y: 400, width: 200, height: 50, 
      text: 'メニューに戻る' 
    };

    this._layout();

    // クリックイベント登録
    this.registerHandlers();
  },

  /** ボタンの 位置。スマホを たてに 持った時（480×680）は 大きく（2026-10-04） */
  _layout() {
    if (!this.canvas || !this.backButton) return;
    const cx = this.canvas.width / 2;
    if (isPortraitCanvas(this.canvas)) {
      Object.assign(this.hpUpgradeButton, { x: cx - 200, y: 340, width: 190, height: 60 });
      Object.assign(this.attackUpgradeButton, { x: cx + 10, y: 340, width: 190, height: 60 });
      Object.assign(this.backButton, { x: cx - 150, y: 440, width: 300, height: 60 });
    } else {
      Object.assign(this.hpUpgradeButton, { x: cx - 180, y: 300, width: 160, height: 50 });
      Object.assign(this.attackUpgradeButton, { x: cx + 20, y: 300, width: 160, height: 50 });
      Object.assign(this.backButton, { x: cx - 100, y: 400, width: 200, height: 50 });
    }
  },

  /** 毎フレームの描画更新 */
  update(dt) {
    // スマホを たてに 持った時は 盤面を 480×680 に（screens/battle/portraitLayout.js）
    if (syncPortraitCanvas(this.canvas)) this._layout();
    const { ctx, canvas } = this;
    const player = gameState.playerStats;

    // 背景
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const background = ctx.createLinearGradient(0, 0, 0, canvas.height);
    background.addColorStop(0, '#15384d');
    background.addColorStop(1, '#0a1d30');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(154, 226, 215, .4)';
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);
    const panelWidth = Math.min(canvas.width - 56, 540);
    ctx.fillStyle = 'rgba(255, 255, 255, .08)';
    ctx.fillRect((canvas.width - panelWidth) / 2, 138, panelWidth, 146);
    if (this.companionImage) {
      const size = isPortraitCanvas(canvas) ? 95 : 116;
      const x = canvas.width / 2 + (isPortraitCanvas(canvas) ? 112 : 148);
      ctx.fillStyle = 'rgba(255, 223, 147, .18)';
      ctx.beginPath();
      ctx.arc(x + size / 2, 208, size / 2 + 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.drawImage(this.companionImage, x, 208 - size / 2, size, size);
    }

    // タイトル
    ctx.fillStyle = 'white';
    ctx.font = '36px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('プレイヤーステータス', canvas.width / 2, 80);

    // プレイヤー名
    if (gameState.playerName) {
      ctx.font = '24px "UDデジタル教科書体", sans-serif';
      ctx.fillText(`${gameState.playerName}`, canvas.width / 2, 120);
    }

    // ステータス表示
    ctx.font = '20px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'left';
    const statusX = canvas.width / 2 - 120;
    const statusY = 160;
    const lineHeight = 30;

    ctx.fillText(`レベル: ${player.level}`, statusX, statusY);
    ctx.fillText(`HP: ${player.hp} / ${player.maxHp}`, statusX, statusY + lineHeight);
    ctx.fillText(`攻撃力: ${player.attack}`, statusX, statusY + lineHeight * 2);
    
    // スキルポイント表示（目立たせる）
    ctx.fillStyle = player.skillPoints > 0 ? '#FFD700' : 'white';
    ctx.font = '22px "UDデジタル教科書体", sans-serif';
    ctx.fillText(`スキルポイント: ${player.skillPoints}`, statusX, statusY + lineHeight * 3);

    // スキルポイントがない場合の説明
    if (player.skillPoints === 0) {
      ctx.fillStyle = '#cde4ed';
      ctx.font = '16px "UDデジタル教科書体", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('レベルアップでスキルポイントを獲得できます', canvas.width / 2,
        isPortraitCanvas(canvas) ? 310 : 470);
    }

    // アップグレードボタンの描画
    this.drawUpgradeButton(this.hpUpgradeButton, player.skillPoints >= this.hpUpgradeButton.cost);
    this.drawUpgradeButton(this.attackUpgradeButton, player.skillPoints >= this.attackUpgradeButton.cost);

    // 戻るボタン
    ctx.fillStyle = 'white';
    drawButton(ctx, this.backButton.x, this.backButton.y, this.backButton.width, this.backButton.height, this.backButton.text, '#34495e', 'white');
  },

  /** アップグレードボタンの描画 */
  drawUpgradeButton(button, isEnabled) {
    const { ctx } = this;
    
    // ボタンの色を決定
    const bgColor = isEnabled ? '#27ae60' : '#95a5a6';
    const textColor = isEnabled ? 'white' : '#7f8c8d';
    
    // ボタン背景
    if (images.buttonNormal && isEnabled) {
      ctx.drawImage(images.buttonNormal, button.x, button.y, button.width, button.height);
    }
    
    // ボタン描画
    drawButton(ctx, button.x, button.y, button.width, button.height, button.text, bgColor, textColor);
    
    // 無効な場合はオーバーレイ
    if (!isEnabled) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(button.x, button.y, button.width, button.height);
    }
  },

  /** 画面離脱時のクリーンアップ */
  exit() {
    this._entry++;
    this.companionImage = null;
    restoreLandscapeCanvas(this.canvas); // ほかの 画面は 800×600 で 描く
    this.unregisterHandlers();
    this.canvas = null;
    this.ctx = null;
  },

  /** クリックイベントリスナ登録 */
  registerHandlers() {
    this._clickHandler = this.handleClick.bind(this);
    this.canvas.addEventListener('click', this._clickHandler);
  },

  /** クリックイベントリスナ解除 */
  unregisterHandlers() {
    if (this.canvas && this._clickHandler) {
      this.canvas.removeEventListener('click', this._clickHandler);
    }
  },

  /** クリック処理 */
  handleClick(e) {
    this._layout();
    const coords = getGameCoordinates(e, this.canvas);
    if (!isValidCoordinates(coords)) {
      return false; // 黒帯エリアのクリックは無視
    }
    
    const x = coords.x;
    const y = coords.y;

    const player = gameState.playerStats;

    // HP アップグレードボタン
    if (isMouseOverRect(x, y, this.hpUpgradeButton) && player.skillPoints >= this.hpUpgradeButton.cost) {
      this.upgradeStatus(this.hpUpgradeButton);
      publish('playSE', 'correct'); // 成功音
      return;
    }

    // 攻撃力アップグレードボタン
    if (isMouseOverRect(x, y, this.attackUpgradeButton) && player.skillPoints >= this.attackUpgradeButton.cost) {
      this.upgradeStatus(this.attackUpgradeButton);
      publish('playSE', 'correct'); // 成功音
      return;
    }

    // 戻るボタン（プロフィール画面から入るのが正規動線）
    if (isMouseOverRect(x, y, this.backButton)) {
      publish('changeScreen', 'profile');
      return;
    }
  },

  /** ステータスアップグレード処理 */
  upgradeStatus(button) {
    const player = gameState.playerStats;
    
    // スキルポイントを消費
    player.skillPoints -= button.cost;
    
    // スキルポイント使用統計の更新
    player.skillPointsUsed += button.cost;
    
    // ステータスを上昇
    player[button.stat] += button.increase;
    
    // HPの場合は現在HPも回復
    if (button.stat === 'maxHp') {
      player.hp += button.increase;
    }
    
    // NOTE: SPの消費とステータス上昇は gameState 上の変更だけで、保存契機が
    // 無かった（実績が新規解除された時に間接的に保存されるのみ）。
    // 振り直しの利かない操作なので、ここで確定させる。
    try { saveGameData(); } catch {}

    // スキルポイント振り分け直後に実績チェック
    checkAchievements().catch(error => {
      console.error('実績チェック中にエラーが発生しました:', error);
    });
    
    console.log(`${button.stat} を ${button.increase} 上昇させました。残りSP: ${player.skillPoints}`);
  }
};

export default statusScreenState; 