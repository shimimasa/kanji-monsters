import { publish } from '../core/eventBus.js';
import { images } from '../loaders/assetsLoader.js';
import { drawButton, isMouseOverRect, drawText } from '../ui/uiRenderer.js';

const courseSelectScreen = {
  /** 画面表示時の初期化 */
  enter(canvas) {
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
    
    // イベントハンドラを登録
    this.registerHandlers();
  },

  /** 毎フレーム呼び出し（描画） */
  update(dt) {
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
    ctx.fillText('学習コース選択', cw / 2, 50);
    
    // 左側エリア（日本編）
    this._drawCourseArea(
      ctx,
      this.japanButton,
      '小学生の漢字（日本編）',
      images.japanMap
    );
    
    // 右側エリア（世界編）
    this._drawCourseArea(
      ctx,
      this.worldButton,
      '中学生の漢字（世界編）',
      images.worldMap
    );
    
    // 戻るボタン
    ctx.fillStyle = '#7f8c8d';
    ctx.font = '16px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('※ 画面をタップして選択してください', cw / 2, ch - 30);
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
      const imgWidth = Math.min(area.width - 40, image.width);
      const imgHeight = Math.min(area.height - 100, image.height);
      const imgX = area.x + (area.width - imgWidth) / 2;
      const imgY = area.y + 70;
      
      ctx.drawImage(image, imgX, imgY, imgWidth, imgHeight);
    }
  },

  /** 画面離脱時のクリーンアップ */
  exit() {
    this.unregisterHandlers();
    this.canvas = null;
    this.ctx = null;
  },

  /** クリックイベント登録 */
  registerHandlers() {
    this._clickHandler = this.handleClick.bind(this);
    this.canvas.addEventListener('click', this._clickHandler);
    this.canvas.addEventListener('touchstart', this._clickHandler);
  },

  /** クリックイベント解除 */
  unregisterHandlers() {
    this.canvas.removeEventListener('click', this._clickHandler);
    this.canvas.removeEventListener('touchstart', this._clickHandler);
  },

  /** クリック処理 */
  handleClick(e) {
    e.preventDefault(); // ダブルタップによる画面拡大などを防ぐ

    let eventX, eventY;
    // e.changedTouchesが存在すればタッチイベント、なければマウスイベントと判定
    if (e.changedTouches) {
      eventX = e.changedTouches[0].clientX;
      eventY = e.changedTouches[0].clientY;
    } else {
      eventX = e.clientX;
      eventY = e.clientY;
    }

    const rect = this.canvas.getBoundingClientRect();
    
    // Canvasの実際の表示サイズと内部解像度の比率を計算
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    
    // 実際のタッチ/クリック座標を、ゲーム内座標に変換
    const x = (eventX - rect.left) * scaleX;
    const y = (eventY - rect.top) * scaleY;

    // 日本編（小学生）エリアがクリックされた場合
    if (isMouseOverRect(x, y, this.japanButton)) {
      publish('playSE', 'decide');
      publish('changeScreen', 'regionSelect');
      return;
    }

    // 世界編（中学生）エリアがクリックされた場合
    if (isMouseOverRect(x, y, this.worldButton)) {
      publish('playSE', 'decide');
      publish('changeScreen', 'continentSelect');
      return;
    }
  },

  render() {
    this.update(0);
  }
};

export default courseSelectScreen;
