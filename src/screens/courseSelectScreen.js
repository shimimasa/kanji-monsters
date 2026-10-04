import { publish } from '../core/eventBus.js';
import { images } from '../loaders/assetsLoader.js';
import { drawButton, isMouseOverRect, drawText } from '../ui/uiRenderer.js';
import { getGameCoordinates, isValidCoordinates } from '../utils/coordinateUtils.js';
import { createScreenLifecycle } from '../core/screenLifecycle.js';
import { gameState } from '../core/gameState.js';
import { stageData } from '../loaders/dataLoader.js';
import { pickJapanGrade, pickWorldGrade, WORLD_LEVEL_BY_GRADE } from '../core/japanStart.js';
import stageSelectState from './stageSelectScreen.js';
import worldStageSelectState from './worldStageSelectScreen.js';
import { syncPortraitCanvas, restoreLandscapeCanvas, isPortraitCanvas } from './battle/portraitLayout.js';

const isJapanStageCleared = (stageId) => stageSelectState.isStageCleared(stageId);
const readLastPlayedStage = () => { try { return localStorage.getItem('lastPlayedStage'); } catch { return null; } };

const courseSelectScreen = {
  _lifecycle: createScreenLifecycle(),
  /** 画面表示時の初期化 */
  enter(canvas) {
    // Tutorial開始はこの入場世代に所属させ、再入場で旧予約を復活させない。
    this._lifecycle.activate();
    // canvas が未渡しの場合は DOM から取得
    this.canvas = canvas || document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    
        // 左右のエリアを定義
        this.japanButton = {
          x: 50,
          y: 150,
          width: cw / 2 - 75,
          height: ch - 250
        };
        
        this.worldButton = {
          x: cw / 2 + 25,
          y: 150,
          width: cw / 2 - 75,
          height: ch - 250
        };
        
        // タイトルへボタン（下部左）
        this.backButton = {
          x: 10,
          y: ch - 60,
          width: 120,
          height: 40,
          text: 'タイトルへ'
        };
    
      // イベントハンドラを登録
      this.registerHandlers();
      this._inputBlockUntil = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) + 350;
    
      // チュートリアル（ゲーム全体の説明）
      import('../tutorial/TutorialManager.js').then(this._lifecycle.guard(m =>
        m.default.startIfNeeded('courseSelect', {
          canvas: this.canvas,
          japan:  this.japanButton,
          world:  this.worldButton,
          back:   this.backButton
        })
      ));
  },

  /** 毎フレーム呼び出し（描画） */
  /** 札と ボタンの 位置。スマホを たてに 持った時（480×680）は 日本編・世界編を 上下に 並べる */
  _layout() {
    if (!this.canvas || !this.japanButton) return;
    const cw = this.canvas.width, ch = this.canvas.height;
    if (isPortraitCanvas(this.canvas)) {
      Object.assign(this.japanButton, { x: 40, y: 110, width: 400, height: 230 });
      Object.assign(this.worldButton, { x: 40, y: 360, width: 400, height: 230 });
      Object.assign(this.backButton, { x: 10, y: ch - 64, width: 150, height: 50 });
    } else {
      Object.assign(this.japanButton, { x: 50, y: 150, width: cw / 2 - 75, height: ch - 250 });
      Object.assign(this.worldButton, { x: cw / 2 + 25, y: 150, width: cw / 2 - 75, height: ch - 250 });
      Object.assign(this.backButton, { x: 10, y: ch - 60, width: 120, height: 40 });
    }
  },

  update(dt) {
    // スマホを たてに 持った時は 盤面を 480×680 に（screens/battle/portraitLayout.js）
    syncPortraitCanvas(this.canvas);
    this._layout();
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const ctx = this.ctx;
    
    // 背景をクリア
    ctx.clearRect(0, 0, cw, ch);
    
    // 背景グラデーション
    const gradient = ctx.createLinearGradient(0, 0, 0, ch);
    gradient.addColorStop(0, '#2c3e50');
    gradient.addColorStop(0.5, '#34495e');
    gradient.addColorStop(1, '#2c3e50');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, cw, ch);
    
    // タイトル
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 32px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('冒険先を選択', cw / 2, 50);
    
    // 左側エリア（日本編）
    this._drawCourseArea(
      ctx,
      this.japanButton,
      '日本編（小学生の漢字）',
      images.japanMap
    );
    
    // 右側エリア（世界編）
    this._drawCourseArea(
      ctx,
      this.worldButton,
      '世界編（漢検4級〜2級）',
      images.worldMap
    );
        // ヒントテキスト
        ctx.fillStyle = '#7f8c8d';
        ctx.font = '16px "UDデジタル教科書体", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        // たての 画面は「タイトルへ」と 重ならないよう、札と ボタンの あいだに
        ctx.fillText('※ 画面をタップして選択してください', cw / 2, isPortraitCanvas(this.canvas) ? ch - 70 : ch - 30);
    
        // タイトルへボタン（下部左）。位置は _layout()
        if (this.backButton) {
          drawButton(ctx, this.backButton.x, this.backButton.y, this.backButton.width, this.backButton.height, this.backButton.text);
        }
  },
  
  /** コースエリアを描画 */
  _drawCourseArea(ctx, area, title, image) {
    // エリアの背景
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(area.x, area.y, area.width, area.height);
    
    // エリアの枠線
    ctx.strokeStyle = '#f39c12';
    ctx.lineWidth = 3;
    ctx.strokeRect(area.x, area.y, area.width, area.height);
    
    // タイトル
    ctx.fillStyle = '#ecf0f1';
    ctx.font = 'bold 24px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(title, area.x + area.width / 2, area.y + 20);
    
    // 画像（存在する場合）
    if (image) {
      let imgWidth = Math.min(area.width - 40, image.width);
      let imgHeight = Math.min(area.height - 100, image.height);
      if (isPortraitCanvas(this.canvas) && image.width && image.height) {
        // たての 画面は 枠が 横長なので、地図の 形を くずさずに 収める
        const s = Math.min((area.width - 40) / image.width, (area.height - 80) / image.height);
        imgWidth = image.width * s;
        imgHeight = image.height * s;
      }
      const imgX = area.x + (area.width - imgWidth) / 2;
      const imgY = isPortraitCanvas(this.canvas) ? area.y + 58 : area.y + 70;
      
      ctx.drawImage(image, imgX, imgY, imgWidth, imgHeight);
    }
  },

  /** 画面離脱時のクリーンアップ */
  exit() {
    this._lifecycle.deactivate();
    this.unregisterHandlers();
    restoreLandscapeCanvas(this.canvas); // ほかの 画面は 800×600 で 描く
    this.canvas = null;
    this.ctx = null;
  },

  /** クリックイベント登録 */
  registerHandlers() {
    this._clickHandler = this.handleClick.bind(this);
    this.canvas.addEventListener('click', this._clickHandler);
    this.canvas.addEventListener('touchstart', this._clickHandler, { passive: false });
  },

  /** クリックイベント解除 */
  unregisterHandlers() {
    this.canvas.removeEventListener('click', this._clickHandler);
    this.canvas.removeEventListener('touchstart', this._clickHandler);
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
    // 画面遷移直後のクリック・タップは無視
    if (this._inputBlockUntil && now < this._inputBlockUntil) {
      if (e.cancelable) e.preventDefault();
      return;
    }
    e.preventDefault(); // ダブルタップによる画面拡大などを防ぐ

    // 新しい座標変換
  this._layout(); // 札の 位置は 盤面の 大きさで 変わる
  const coords = getGameCoordinates(e, this.canvas);
  if (!isValidCoordinates(coords)) return; // 黒帯領域のクリックは無視
  
  const x = coords.x;
  const y = coords.y;

    // 日本編（小学生）エリアがクリックされた場合
    // 地方の地図は飛ばして、ステージ選択へ直接（学年のタブで地方を選べる）。開く学年は japanStart.js
    if (isMouseOverRect(x, y, this.japanButton)) {
      publish('playSE', 'decide');
      gameState.currentGrade = pickJapanGrade(stageData, isJapanStageCleared, readLastPlayedStage(),
        grade => stageSelectState.isRegionUnlocked(grade));
      gameState.previousScreen = 'stageSelect';
      publish('changeScreen', 'stageSelect');
      return;
    }

        // 世界編（中学生）エリアがクリックされた場合
        // 大陸の地図も飛ばして、世界編のステージ選択へ直接（級のタブで選べる）。開く級は japanStart.js
        if (isMouseOverRect(x, y, this.worldButton)) {
          publish('playSE', 'decide');
          const grade = pickWorldGrade(stageData, (id) => worldStageSelectState.isStageCleared(id), readLastPlayedStage());
          gameState.previousScreen = 'worldStageSelect';
          publish('changeScreen', { name: 'worldStageSelect', props: { kanken_level: WORLD_LEVEL_BY_GRADE[grade] } });
          return;
        }
    
        // タイトルへボタン
        if (this.backButton && isMouseOverRect(x, y, this.backButton)) {
          publish('playSE', 'decide');
          publish('changeScreen', 'title');
          return;
        }
  },

  render() {
    this.update(0);
  }
};

export default courseSelectScreen;
