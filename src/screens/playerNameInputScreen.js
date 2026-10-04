// js/playerNameInputScreen.js
import { publish } from '../core/eventBus.js';
import { images } from '../loaders/assetsLoader.js';
import { drawButton, isMouseOverRect } from '../ui/uiRenderer.js';
import { gameState, updatePlayerName } from '../core/gameState.js';
import { getGameCoordinates, isValidCoordinates, gameToScreenCoordinates } from '../utils/coordinateUtils.js';
import { bindInputSubmission } from '../core/answerSubmission.js';
import { syncPortraitCanvas, restoreLandscapeCanvas, isPortraitCanvas } from './battle/portraitLayout.js';

// 並び。スマホを たてに 持った時（480×680）は 文字と ボタンを 大きく（2026-10-04）
function nameLayout(canvas) {
  const cx = canvas.width / 2;
  return isPortraitCanvas(canvas)
    ? { titleY: 190, noteY: 236, frame: { x: cx - 180, y: 300, w: 360, h: 48 }, msgY: 392, button: { x: cx - 140, y: 440, width: 280, height: 64 } }
    : { titleY: 150, noteY: 200, frame: { x: cx - 150, y: 280, w: 300, h: 40 }, msgY: 355, button: { x: cx - 100, y: 400, width: 200, height: 50 } };
}

const playerNameInputState = {
  /** 画面表示時の初期化 */
  enter(canvas) {
    // canvas が未渡しの場合は DOM から取得
    this.canvas = canvas || document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    syncPortraitCanvas(this.canvas);
    this.confirmButton = { ...nameLayout(this.canvas).button, text: 'けってい' };
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

    this._answerSubmission?.dispose?.();
    this._answerSubmission = bindInputSubmission(this.nameInputElement, () => this.submitNameAndSave(), { allowBlank: true });

    this.registerHandlers();
  },

  /** 入力欄をCanvas上の枠位置に合わせて配置する */
  _positionInputElement() {
    if (!this.nameInputElement || !this.canvas) return;
    const cx = this.canvas.width / 2;
    const frame = nameLayout(this.canvas).frame;
    const topLeft = gameToScreenCoordinates(frame.x, frame.y, this.canvas);
    const center = gameToScreenCoordinates(cx, frame.y + frame.h / 2, this.canvas);
    const scale = topLeft.scale;
    const width = Math.min(window.innerWidth - 32, Math.max(240, (frame.w - 8) * scale));
    const height = 48;
    this.nameInputElement.style.left = `${center.x - width / 2}px`;
    this.nameInputElement.style.top = `${center.y - height / 2}px`;
    this.nameInputElement.style.width = `${width}px`;
    this.nameInputElement.style.height = `${height}px`;
    this.nameInputElement.style.fontSize = '18px';
  },

  /** 毎フレーム呼び出し（描画） */
  update(dt) {
    // スマホの 向きが かわったら 盤面と 入力欄を 合わせなおす
    if (syncPortraitCanvas(this.canvas)) {
      Object.assign(this.confirmButton, nameLayout(this.canvas).button);
      this._positionInputElement();
    }
    const L = nameLayout(this.canvas);
    const portrait = isPortraitCanvas(this.canvas);
    const cw = this.canvas.width, ch = this.canvas.height;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, cw, ch);

    // 背景
    const bg = ctx.createLinearGradient(0, 0, cw, ch);
    bg.addColorStop(0, '#2c1810');
    bg.addColorStop(1, '#3d2414');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cw, ch);

    // タイトル
    ctx.fillStyle = 'white';
    ctx.font = '32px "UDデジタル教科書体",sans-serif';
    ctx.textAlign = 'center';
    if (portrait) {
      // たての 画面は 1行に 入らないので 2行に
      ctx.fillText('なまえを', cw / 2, L.titleY - 40);
      ctx.fillText('にゅうりょく してください', cw / 2, L.titleY);
    } else {
      ctx.fillText('なまえを にゅうりょく してください', cw / 2, L.titleY);
    }
    
    ctx.font = '20px "UDデジタル教科書体",sans-serif';
    ctx.fillText('(5もじまで)', cw / 2, L.noteY);

    // 入力欄の枠（HTMLの入力欄が見えるように透明な枠を描画）
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(L.frame.x, L.frame.y, L.frame.w, L.frame.h);

    // 入力チェックのメッセージ（alertの代わりにゲーム内で表示）
    if (this.validationMessage) {
      ctx.fillStyle = '#FFD98E';
      ctx.font = '18px "UDデジタル教科書体",sans-serif';
      ctx.fillText(this.validationMessage, cw / 2, L.msgY);
    }

    // 決定ボタン
    if (images.buttonNormal) {
      ctx.drawImage(images.buttonNormal,
        this.confirmButton.x, this.confirmButton.y, this.confirmButton.width, this.confirmButton.height
      );
    }
    drawButton(ctx, this.confirmButton.x, this.confirmButton.y, this.confirmButton.width, this.confirmButton.height, this.confirmButton.text, '#8B4513');
  },

  /** 画面離脱時のクリーンアップ */
  exit() {
    restoreLandscapeCanvas(this.canvas); // ほかの 画面は 800×600 で 描く
    this.unregisterHandlers();
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }
    if (this.nameInputElement) {
      this.nameInputElement.style.display = 'none';
      this.nameInputElement.onkeydown = null;
    }
    this._answerSubmission?.dispose?.();
    this._answerSubmission = null;
    this.canvas = null;
    this.ctx = null;
  },

  /** イベントリスナー登録 */
  registerHandlers() {
    this._clickHandler = this.handleClick.bind(this);
    this._keyHandler = this.handleKeydown.bind(this);
    
    this.canvas.addEventListener('click', this._clickHandler);
    this.canvas.addEventListener('touchstart', this._clickHandler);
    
  },

  /** イベントリスナー解除 */
  unregisterHandlers() {
    this.canvas.removeEventListener('click', this._clickHandler);
    this.canvas.removeEventListener('touchstart', this._clickHandler);
  },

  /** Enterキー処理 */
  handleKeydown(event) {
    return this._answerSubmission?.handleKeydown(event, this.nameInputElement?.value ?? '');
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
      this._answerSubmission?.submit(this.nameInputElement?.value ?? '');
    }
  },

  /** 名前送信と保存処理 */
  async submitNameAndSave() {
    if (!this.nameInputElement) return false;
    
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
      return false;
    }
    this.validationMessage = '';

    // プレイヤー名を更新
    const saved = updatePlayerName(trimmedName);
    if (!saved.ok) { this.validationMessage = '名前を保存できませんでした。もう一度ためしてください'; return false; }
    
    // updatePlayerName のローカル保存がクラウド同期も予約する。
    // 通信完了を待つ画面処理を残さず、確定した名前で先へ進む。

    // ゲームモードを設定
    if (gameState.pendingGameMode) {
      gameState.gameMode = gameState.pendingGameMode;
      gameState.pendingGameMode = null;
    }

    // 通常フローと同じくコース選択画面へ遷移
    gameState.currentGrade = 0;
    publish('changeScreen', 'courseSelect');
    return true;
  },

  render() {
    this.update(0);
  }
};

export default playerNameInputState;
