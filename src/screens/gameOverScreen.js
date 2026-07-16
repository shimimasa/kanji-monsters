// src/screens/gameOverScreen.js
// プレイヤー敗北時の画面（Game Over Screen）
// トーン方針: 敗北を「失敗」ではなく「旅の休憩」として描く。
// 絶望的な演出（嵐・ひび割れ・灰）は使わず、夕暮れの休憩所で次の出発に備えるイメージ。

import { publish } from '../core/eventBus.js';
import { drawButton, isMouseOverRect } from '../ui/uiRenderer.js';
import { gameState } from '../core/gameState.js';
import { calcFailXP } from '../core/bonusManager.js';
import { addPlayerExp } from '../core/gameState.js';
import { getGameCoordinates, isValidCoordinates } from '../utils/coordinateUtils.js';

const retryButton = {
  x: 200,  // 左側
  y: 420,
  width: 140,
  height: 50,
  text: 'もういちど！'
};

const stageSelectButton = {
  x: 340,  // 中央
  y: 420,
  width: 140,
  height: 50,
  text: 'ちずにもどる'
};

const titleButton = {
  x: 480,  // 右側
  y: 420,
  width: 140,
  height: 50,
  text: 'タイトルへ'
};

const gameOverState = {
  canvas: null,
  ctx: null,
  _clickHandler: null,
  _mousemoveHandler: null,
  mouseX: 0,
  mouseY: 0,
  animationTime: 0, // アニメーション用タイマー

  /** 画面表示時の初期化 */
  enter() {
    // ゲームオーバー画面に入ったらBGMを変更
    publish('playBGM', 'gameover');

    // キャンバスを取得
    this.canvas = document.getElementById('gameCanvas');
    if (!this.canvas) {
      console.error('キャンバス要素が見つかりません');
      return;
    }

    this.ctx = this.canvas.getContext('2d');

    // 画面切替のSEを再生
    publish('playSE', 'gameover');

    // アニメーションタイマーを初期化
    this.animationTime = 0;

    // イベントハンドラ登録
    this.registerHandlers();

    const stageId = (gameState.currentStageId || '');
    const m = /^bonus_g(\d+)$/i.exec(stageId);
    if (m) {
      const grade = parseInt(m[1], 10);
      const clearedFights = Math.max(0, gameState.currentEnemyIndex); // 倒した数
      // 途中敗退報酬によるEXP付与は廃止（モンスター撃破時のみ付与）
      // const failXP = calcFailXP(grade, clearedFights);
      // if (failXP > 0) { addPlayerExp(failXP); }
    }
  },

  /** 毎フレーム呼び出し（描画） */
  update(dt) {
    if (!this.ctx || !this.canvas) return;

    const { ctx, canvas } = this;
    this.animationTime += 16; // 約60FPSでアニメーション

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. 夕暮れの休憩所の背景を描画
    this.drawSunsetBackground(ctx, canvas.width, canvas.height);

    // 2. 「今回はここまで！」タイトルを描画
    this.drawRestTitle(ctx, canvas.width / 2, 120);

    // 3. 旅のきろくパネル
    this.drawTravelLogPanel(ctx, canvas.width / 2 - 150, 220, 300, 160);

    // 4. ボタン群
    const isRetryHovered = isMouseOverRect(this.mouseX, this.mouseY, retryButton);
    const isStageSelectHovered = isMouseOverRect(this.mouseX, this.mouseY, stageSelectButton);
    const isTitleHovered = isMouseOverRect(this.mouseX, this.mouseY, titleButton);

    this.drawJourneyButton(ctx, retryButton, isRetryHovered, 'retry');
    this.drawJourneyButton(ctx, stageSelectButton, isStageSelectHovered, 'stageSelect');
    this.drawJourneyButton(ctx, titleButton, isTitleHovered, 'title');

    // 5. 穏やかな夕暮れの装飾要素
    this.drawEveningEffects(ctx, canvas.width, canvas.height);
  },

  /**
   * 夕暮れの空と休憩所の背景を描画
   */
  drawSunsetBackground(ctx, width, height) {
    ctx.save();

    // 夕暮れの空グラデーション
    const skyGradient = ctx.createLinearGradient(0, 0, 0, height);
    skyGradient.addColorStop(0, '#2E3A67');   // 宵の藍色
    skyGradient.addColorStop(0.45, '#7A5C99'); // 薄紫
    skyGradient.addColorStop(0.75, '#E8927C'); // やわらかい茜色
    skyGradient.addColorStop(1, '#F4C27A');    // 地平線の琥珀色

    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, width, height);

    // 沈む夕日（やわらかい光）
    const sunX = width * 0.72;
    const sunY = height * 0.60;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 90);
    sunGlow.addColorStop(0, 'rgba(255, 236, 179, 0.9)');
    sunGlow.addColorStop(0.4, 'rgba(255, 200, 120, 0.5)');
    sunGlow.addColorStop(1, 'rgba(255, 180, 100, 0)');
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 90, 0, Math.PI * 2);
    ctx.fill();

    // ゆっくり流れる夕焼け雲
    const cloudOffset = (this.animationTime * 0.0006) % (width + 200);
    ctx.fillStyle = 'rgba(255, 220, 190, 0.22)';
    for (let i = 0; i < 5; i++) {
      const x = (cloudOffset + i * 200 - 100) % (width + 200) - 100;
      const y = 60 + i * 28;
      const radius = 40 + i * 10;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.arc(x + 30, y, radius * 0.8, 0, Math.PI * 2);
      ctx.arc(x + 60, y, radius * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // 空にまたたく一番星たち（位置は固定・明るさだけ揺らす）
    for (let i = 0; i < 12; i++) {
      const x = ((i * 173 + 60) % (width - 80)) + 40;
      const y = ((i * 97 + 20) % (height * 0.35)) + 15;
      const twinkle = 0.4 + 0.35 * Math.sin(this.animationTime * 0.002 + i * 1.7);
      ctx.fillStyle = `rgba(255, 245, 210, ${twinkle})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // 遠くの山なみ（シルエット・2層）
    ctx.fillStyle = '#4A3A5E';
    ctx.beginPath();
    ctx.moveTo(0, height * 0.78);
    for (let x = 0; x <= width; x += 20) {
      const y = height * 0.78 - Math.sin(x * 0.008) * 28 - Math.sin(x * 0.021 + 2) * 12;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#352A47';
    ctx.beginPath();
    ctx.moveTo(0, height * 0.88);
    for (let x = 0; x <= width; x += 20) {
      const y = height * 0.88 - Math.sin(x * 0.011 + 5) * 20 - Math.sin(x * 0.03) * 8;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    // 縁の装飾（あたたかい色の枠）
    ctx.strokeStyle = 'rgba(244, 194, 122, 0.4)';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, width - 16, height - 16);

    ctx.strokeStyle = 'rgba(255, 228, 181, 0.25)';
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 12, width - 24, height - 24);

    ctx.restore();
  },

  /**
   * 「今回はここまで！」タイトルを描画
   */
  drawRestTitle(ctx, centerX, centerY) {
    ctx.save();

    // タイトルのやわらかい影
    ctx.font = 'bold 48px "UDデジタル教科書体", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(60, 40, 20, 0.45)';
    ctx.fillText('今回はここまで！', centerX + 3, centerY + 3);

    // メインタイトル（あたたかい琥珀色のグラデーション）
    const titleGradient = ctx.createLinearGradient(centerX - 180, centerY - 25, centerX + 180, centerY + 25);
    titleGradient.addColorStop(0, '#FFD98E');  // 淡い金色
    titleGradient.addColorStop(0.5, '#FFB25E'); // 夕焼けのオレンジ
    titleGradient.addColorStop(1, '#FF9A6B');   // やわらかい茜

    ctx.fillStyle = titleGradient;
    ctx.fillText('今回はここまで！', centerX, centerY);

    // タイトルの縁取り
    ctx.strokeStyle = '#7A4A2B';
    ctx.lineWidth = 2;
    ctx.strokeText('今回はここまで！', centerX, centerY);

    // サブタイトル
    ctx.font = '24px "UDデジタル教科書体", sans-serif';
    ctx.fillStyle = '#FFE9C9';
    ctx.fillText('やすんで、つぎの旅にそなえよう', centerX, centerY + 50);

    ctx.restore();
  },

  /**
   * 旅のきろくパネル（木の立て看板風）を描画
   */
  drawTravelLogPanel(ctx, x, y, width, height) {
    ctx.save();

    // パネルのやわらかい影
    ctx.fillStyle = 'rgba(50, 30, 20, 0.4)';
    ctx.fillRect(x + 5, y + 5, width, height);

    // 木の看板風の背景
    const woodGradient = ctx.createLinearGradient(x, y, x, y + height);
    woodGradient.addColorStop(0, '#8B5A2B');  // 明るい木肌
    woodGradient.addColorStop(0.5, '#7A4E26');
    woodGradient.addColorStop(1, '#6B4423');  // 濃い木肌

    ctx.fillStyle = woodGradient;
    ctx.fillRect(x, y, width, height);

    // 看板の縁取り
    ctx.strokeStyle = '#4A2F1B';
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, width, height);

    // 内側の装飾線
    ctx.strokeStyle = 'rgba(255, 235, 205, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 8, y + 8, width - 16, height - 16);

    // パネルタイトル
    ctx.font = 'bold 22px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFF3DC';
    ctx.fillText('たびのきろく', x + width/2, y + 35);

    // 結果データ（間違い数の突きつけはせず、出会いとして数える）
    const results = [
      `読めた漢字: ${gameState.correctKanjiList.length}個`,
      `出会った漢字: ${gameState.wrongKanjiList.length}個`,
      `いまのレベル: ${gameState.playerStats.level}`
    ];

    ctx.font = '16px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFE9C9';

    results.forEach((text, index) => {
      ctx.fillText(text, x + 20, y + 70 + index * 24);
    });

    // 再出発メッセージ
    ctx.font = '14px "UDデジタル教科書体", sans-serif';
    ctx.fillStyle = '#FFDFA8';
    ctx.textAlign = 'center';
    ctx.fillText('またここから しゅっぱつしよう！', x + width/2, y + height - 15);

    ctx.restore();
  },

  /**
   * 旅の雰囲気に合わせたボタンを描画
   */
  drawJourneyButton(ctx, button, isHovered, type) {
    ctx.save();

    const { x, y, width, height, text } = button;
    const scale = isHovered ? 1.05 : 1.0;

    // ホバー時のスケール調整
    const scaledWidth = width * scale;
    const scaledHeight = height * scale;
    const scaledX = x + (width - scaledWidth) / 2;
    const scaledY = y + (height - scaledHeight) / 2;

    // ボタンの影
    ctx.fillStyle = 'rgba(50, 30, 20, 0.5)';
    ctx.fillRect(scaledX + 4, scaledY + 4, scaledWidth, scaledHeight);

    // ボタン背景のグラデーション
    const buttonGradient = ctx.createLinearGradient(scaledX, scaledY, scaledX, scaledY + scaledHeight);

    if (type === 'retry') {
      // もういちどボタン（元気の出るオレンジ系）
      if (isHovered) {
        buttonGradient.addColorStop(0, '#FFB25E');
        buttonGradient.addColorStop(0.5, '#F09040');
        buttonGradient.addColorStop(1, '#D9762B');
      } else {
        buttonGradient.addColorStop(0, '#F09040');
        buttonGradient.addColorStop(0.5, '#D9762B');
        buttonGradient.addColorStop(1, '#B85E1F');
      }
    } else if (type === 'stageSelect') {
      // ちずにもどるボタン（緑系）
      if (isHovered) {
        buttonGradient.addColorStop(0, '#5CB85C');
        buttonGradient.addColorStop(0.5, '#3E8E41');
        buttonGradient.addColorStop(1, '#2E6B31');
      } else {
        buttonGradient.addColorStop(0, '#3E8E41');
        buttonGradient.addColorStop(0.5, '#2E6B31');
        buttonGradient.addColorStop(1, '#1F4A22');
      }
    } else { // タイトルボタン（落ち着いた青系）
      if (isHovered) {
        buttonGradient.addColorStop(0, '#5B9BD5');
        buttonGradient.addColorStop(0.5, '#3D6FA5');
        buttonGradient.addColorStop(1, '#2C5282');
      } else {
        buttonGradient.addColorStop(0, '#3D6FA5');
        buttonGradient.addColorStop(0.5, '#2C5282');
        buttonGradient.addColorStop(1, '#1F3A5F');
      }
    }

    ctx.fillStyle = buttonGradient;
    ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);

    // ボタンの縁取り
    ctx.strokeStyle = isHovered ? '#FFE9C9' : 'rgba(60, 40, 20, 0.6)';
    ctx.lineWidth = isHovered ? 3 : 2;
    ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);

    // ハイライト効果（控えめ）
    const highlightGradient = ctx.createLinearGradient(scaledX, scaledY, scaledX, scaledY + scaledHeight * 0.3);
    highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = highlightGradient;
    ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight * 0.3);

    // ボタンテキスト
    ctx.font = 'bold 18px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // テキストの影
    ctx.fillStyle = 'rgba(60, 40, 20, 0.6)';
    ctx.fillText(text, scaledX + scaledWidth/2 + 2, scaledY + scaledHeight/2 + 2);

    // テキスト本体
    ctx.fillStyle = '#FFF8E7';
    ctx.fillText(text, scaledX + scaledWidth/2, scaledY + scaledHeight/2);

    ctx.restore();
  },

  /**
   * 穏やかな夕暮れの装飾要素を描画
   */
  drawEveningEffects(ctx, width, height) {
    ctx.save();

    // ゆっくり舞い上がるほたるの光
    for (let i = 0; i < 14; i++) {
      const baseX = (i * 61 + 30) % width;
      const sway = Math.sin(this.animationTime * 0.0012 + i * 2.1) * 24;
      const x = baseX + sway;
      const y = height - ((this.animationTime * 0.018 + i * 47) % (height * 0.9));
      const glow = 0.25 + 0.25 * Math.sin(this.animationTime * 0.003 + i);
      const size = 1.5 + (i % 3);

      ctx.fillStyle = `rgba(255, 230, 150, ${glow})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 画面のふちをやさしく落ち着かせるビネット
    const vignetteGradient = ctx.createRadialGradient(
      width/2, height/2, 0,
      width/2, height/2, Math.max(width, height) * 0.75
    );
    vignetteGradient.addColorStop(0, 'rgba(40, 25, 50, 0)');
    vignetteGradient.addColorStop(1, 'rgba(40, 25, 50, 0.25)');

    ctx.fillStyle = vignetteGradient;
    ctx.fillRect(0, 0, width, height);

    ctx.restore();
  },

  /** 画面離脱時のクリーンアップ */
  exit() {
    if (this.canvas) {
      this.unregisterHandlers();
    }
    this.canvas = null;
    this.ctx = null;
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
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    this.mouseX = (e.clientX - rect.left) * scaleX;
    this.mouseY = (e.clientY - rect.top) * scaleY;
  },



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

    // 統一された座標変換を使用
    const coords = getGameCoordinates(e, this.canvas);
    if (!isValidCoordinates(coords)) {
      return false; // 黒帯エリアのクリックは無視
    }

    const x = coords.x;
    const y = coords.y;

        // リトライボタン
        if (isMouseOverRect(x, y, retryButton)) {
          publish('playSE', 'decide');
          // 次のバトル画面がBGMを再生するので一旦停止（軽くフェード）
          publish('stopBGM', 0.2);
          // 同じステージを再挑戦
          publish('changeScreen', gameState.currentStageId);
        }

        // タイトルへボタン
        if (isMouseOverRect(x, y, titleButton)) {
          publish('playSE', 'decide');
          // 画面遷移前にメニューBGMへ切替
          publish('playBGM', 'title');
          // タイトル画面へ戻る
          publish('changeScreen', 'title');
        }

        // ステージ選択へボタン
        if (isMouseOverRect(x, y, stageSelectButton)) {
          publish('playSE', 'decide');
          // 画面遷移前にメニューBGMへ切替
          publish('playBGM', 'title');
          // previousScreenに基づいて適切な画面に戻る
          const targetScreen = gameState.previousScreen === 'worldStageSelect' ?
            'worldStageSelect' : 'stageSelect';
          publish('changeScreen', targetScreen);
        }
  },

  render() {
    this.update(0);
  }
};

export default gameOverState;
