// js/playerNameInputScreen.js
import { publish } from '../core/eventBus.js';
import { images } from '../loaders/assetsLoader.js';
import { drawButton, isMouseOverRect } from '../ui/uiRenderer.js';
import { gameState, updatePlayerName } from '../core/gameState.js';
import { getCurrentUser, initializeNewPlayerData } from '../services/firebase/firebaseController.js';
import { getGameCoordinates, isValidCoordinates, gameToScreenCoordinates } from '../utils/coordinateUtils.js';

const playerNameInputState = {
  /** 画面表示時の初期化 */
  enter(canvas) {
    // canvas が未渡しの場合は DOM から取得
    this.canvas = canvas || document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    const cx = this.canvas.width / 2;
    this.confirmButton = { x: cx - 100, y: 400, width: 200, height: 50, text: 'けってい' };
    this.validationMessage = '';

    // HTML入力欄をセットアップ（存在しなければ動的に生成する）
    this.nameInputElement = document.getElementById('playerNameInputField');
    if (!this.nameInputElement) {
      this.nameInputElement = document.createElement('input');
      this.nameInputElement.id = 'playerNameInputField';
      this.nameInputElement.type = 'text';
      this.nameInputElement.autocomplete = 'off';
      this.nameInputElement.setAttribute('autocapitalize', 'off');
      this.nameInputElement.setAttribute('autocorrect', 'off');
      this.nameInputElement.spellcheck = false;
      this.nameInputElement.placeholder = 'なまえ';
      this.nameInputElement.style.position = 'absolute';
      this.nameInputElement.style.textAlign = 'center';
      this.nameInputElement.style.zIndex = '1001';
      document.body.appendChild(this.nameInputElement);
    }
    this.nameInputElement.style.display = 'block';
    this.nameInputElement.value = "";
    this.nameInputElement.maxLength = 5;

    // 描画している枠（ゲーム座標: 中央x, y=280, 300x40）に重ねて配置
    this._positionInputElement();
    this._resizeHandler = () => this._positionInputElement();
    window.addEventListener('resize', this._resizeHandler);

    this.nameInputElement.focus();

    this.registerHandlers();
  },

  /** 入力欄をCanvas上の枠位置に合わせて配置する */
  _positionInputElement() {
    if (!this.nameInputElement || !this.canvas) return;
    const cx = this.canvas.width / 2;
    const frame = { x: cx - 150, y: 280, w: 300, h: 40 };
    const topLeft = gameToScreenCoordinates(frame.x, frame.y, this.canvas);
    const scale = topLeft.scale;
    this.nameInputElement.style.left = `${topLeft.x + 4 * scale}px`;
    this.nameInputElement.style.top = `${topLeft.y + 4 * scale}px`;
    this.nameInputElement.style.width = `${(frame.w - 8) * scale}px`;
    this.nameInputElement.style.height = `${(frame.h - 8) * scale}px`;
    this.nameInputElement.style.fontSize = `${Math.max(14, Math.round(22 * scale))}px`;
  },

  /** 毎フレーム呼び出し（描画） */
  update(dt) {
    const cw = this.canvas.width, ch = this.canvas.height;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, cw, ch);

    // 背景
    ctx.fillStyle = '#1e3c72';
    ctx.fillRect(0, 0, cw, ch);

    // タイトル
    ctx.fillStyle = 'white';
    ctx.font = '32px "UDデジタル教科書体",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('なまえを にゅうりょく してください', cw / 2, 150);
    
    ctx.font = '20px "UDデジタル教科書体",sans-serif';
    ctx.fillText('(5もじまで)', cw / 2, 200);

    // 入力欄の枠（HTMLの入力欄が見えるように透明な枠を描画）
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(cw / 2 - 150, 280, 300, 40);

    // 入力チェックのメッセージ（alertの代わりにゲーム内で表示）
    if (this.validationMessage) {
      ctx.fillStyle = '#FFD98E';
      ctx.font = '18px "UDデジタル教科書体",sans-serif';
      ctx.fillText(this.validationMessage, cw / 2, 355);
    }

    // 決定ボタン
    if (images.buttonNormal) {
      ctx.drawImage(images.buttonNormal,
        this.confirmButton.x, this.confirmButton.y, this.confirmButton.width, this.confirmButton.height
      );
    }
    drawButton(ctx, this.confirmButton.x, this.confirmButton.y, this.confirmButton.width, this.confirmButton.height, this.confirmButton.text);
  },

  /** 画面離脱時のクリーンアップ */
  exit() {
    this.unregisterHandlers();
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }
    if (this.nameInputElement) {
      this.nameInputElement.style.display = 'none';
      this.nameInputElement.onkeydown = null;
    }
    this.canvas = null;
    this.ctx = null;
  },

  /** イベントリスナー登録 */
  registerHandlers() {
    this._clickHandler = this.handleClick.bind(this);
    this._keyHandler = this.handleKeydown.bind(this);
    
    this.canvas.addEventListener('click', this._clickHandler);
    this.canvas.addEventListener('touchstart', this._clickHandler);
    
    if (this.nameInputElement) {
      this.nameInputElement.onkeydown = this._keyHandler;
    }
  },

  /** イベントリスナー解除 */
  unregisterHandlers() {
    this.canvas.removeEventListener('click', this._clickHandler);
    this.canvas.removeEventListener('touchstart', this._clickHandler);
  },

  /** Enterキー処理 */
  handleKeydown(event) {
    if (event.key === 'Enter') {
      this.submitNameAndSave();
      event.preventDefault();
    }
  },

  /** クリック処理 */
  handleClick(e) {
    // モバイルの二重発火ガード
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (e.type === 'touchstart') {
      this._lastTouchTime = now;
      if (e.cancelable) e.preventDefault();
    } else if (e.type === 'click') {
      if (this._lastTouchTime && (now - this._lastTouchTime) < 700) return;
    }
e.preventDefault(); // ダブルタップによる画面拡大などを防ぐ

    const coords = getGameCoordinates(e, this.canvas);
    if (!isValidCoordinates(coords)) {
      return false; // 黒帯エリアのクリックは無視
    }
    
    const x = coords.x;
    const y = coords.y;


    if (isMouseOverRect(x, y, this.confirmButton)) {
      publish('playSE', 'decide');
      this.submitNameAndSave();
    }
  },

  /** 名前送信と保存処理 */
  async submitNameAndSave() {
    if (!this.nameInputElement) return;
    
    const trimmedName = this.nameInputElement.value.trim();

    // 入力値の検証（alertではなく画面内メッセージで知らせる）
    if (
      trimmedName === "" ||
      trimmedName.length > 5 ||                     // ← 5文字超は不可
      trimmedName === "ななしのごんべえ" ||
      trimmedName === "ゲスト" ||
      trimmedName === "新規プレイヤー"
    ) {
      this.validationMessage = 'なまえを 1〜5もじで いれてね';
      this.nameInputElement.value = "";
      this.nameInputElement.focus();
      return;
    }
    this.validationMessage = '';

    // プレイヤー名を更新
    updatePlayerName(trimmedName);
    
    // Firebase保存処理
    const user = getCurrentUser();
    if (user && user.uid) {
      try {
        const newPlayerData = await initializeNewPlayerData(user.uid, trimmedName);
        if (newPlayerData) {
          console.log("New player profile created/updated in Firestore:", newPlayerData);
        }
      } catch (error) {
        console.error("Firebase保存エラー:", error);
      }
    }

    // ゲームモードを設定
    if (gameState.pendingGameMode) {
      gameState.gameMode = gameState.pendingGameMode;
      gameState.pendingGameMode = null;
    }

    // 通常フローと同じくコース選択画面へ遷移
    gameState.currentGrade = 0;
    publish('changeScreen', 'courseSelect');
  },

  render() {
    this.update(0);
  }
};

export default playerNameInputState;