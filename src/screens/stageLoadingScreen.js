import { publish } from '../core/eventBus.js';
import { gameState } from '../core/gameState.js';
import { getEnemiesByStageId } from '../loaders/dataLoader.js';
import { loadBgImage, loadMonsterImage } from '../loaders/assetsLoader.js';
import { createScreenLifecycle } from '../core/screenLifecycle.js';
import { withDeadline } from '../core/asyncDeadline.js';
import { showBootError, hideBootProgress } from '../ui/bootProgress.js';
import { getLearningControls, drawLearningButton } from '../ui/learningControls.js';
import { getGameCoordinates } from '../utils/coordinateUtils.js';
import { isMouseOverRect } from '../ui/uiRenderer.js';
import { syncPortraitCanvas } from './battle/portraitLayout.js';

const stageLoadingState = {
  canvas: null,
  ctx: null,
  progress: 0,
  stageId: null,
  previewBackground: null,
  _lifecycle: createScreenLifecycle(),

  async enter(canvas) {
    const generation = this._lifecycle.activate();
    this.loadError = null;
    try {
      console.log("🔄 stageLoadingState.enter() 実行", { canvas, stageId: gameState.currentStageId });
      
      // キャンバス要素を取得 (引数またはDOM)
      this.canvas = canvas || document.getElementById('gameCanvas');
      if (!this.canvas) {
        console.error('キャンバス要素が見つかりません。DOMから取得を試みます。');
        this.canvas = document.getElementById('gameCanvas');
      }
      
      if (!this.canvas) {
        throw new Error('キャンバス要素が見つかりません');
      }
      
      this.ctx = this.canvas.getContext('2d');
      this._clickHandler = e => {
        const {x,y} = getGameCoordinates(e,this.canvas);
        if (isMouseOverRect(x,y,getLearningControls(this.canvas).back)) publish('changeScreen','stageSelect');
      };
      this.canvas.addEventListener?.('click',this._clickHandler);
      this.progress = 0;
      this.previewBackground = null;
      this.stageId = gameState.currentStageId;

      if (!this.stageId) {
        console.error('ステージIDが未設定のため、ローディングを中止します。');
        publish('changeScreen', 'stageSelect');
        return;
      }

      // 1. このステージで必要なアセットのリストを作成
      const enemies = getEnemiesByStageId(this.stageId);
      console.log(`ステージ[${this.stageId}]の敵: ${enemies.length}体`, enemies);
      
      const loadPromises = [loadBgImage(this.stageId)];
      
      // 各敵の画像読み込みを試みる（個別にエラーハンドリング）
      for (const enemy of enemies) {
        const enemyPromise = loadMonsterImage(enemy)
          .catch(err => {
            console.warn(`敵[${enemy.id}]の画像読み込みに失敗しましたが、続行します:`, err);
            return null; // エラーが発生しても続行
          });
        loadPromises.push(enemyPromise);
      }

      // 2. プログレスバーを更新しながら、すべてのアセットを並行して読み込む
      const totalAssets = loadPromises.length;
      let loadedCount = 0;

      const progressCallback = () => {
        if (!this._lifecycle.active || this._lifecycle.generation !== generation || this.loadError) return;
        loadedCount++;
        this.progress = loadedCount / totalAssets;
        // 進捗状況を表示するために強制的に再描画
        this.update(0);
      };

      const wrappedPromises = loadPromises.map((p, index) => p.then(result => {
        // 背景の読み込みが先に終われば、その絵を準備画面にも映す。
        if (index === 0 && this._lifecycle.active && this._lifecycle.generation === generation) {
          this.previewBackground = result;
        }
        progressCallback();
        return result;
      }));

      // Promise.allSettledを使用して、一部の画像が読み込めなくても続行
      const results = await withDeadline(() => Promise.allSettled(wrappedPromises));
      if (!this._lifecycle.active || this._lifecycle.generation !== generation) return;
      
      // 結果のログ出力
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      console.log(`アセット読み込み結果: 成功=${succeeded}, 失敗=${failed}`);

      // 3. ロード完了後、バトル画面へ遷移
      console.log(`ステージ[${this.stageId}]のアセット読み込み完了。バトル画面へ遷移します。`);
      
      // 直接ステージIDに遷移せず、常にbattleスクリーンに遷移する
      gameState.currentStageId = this.stageId;
      // キャンバスとステージIDを渡す
      publish('changeScreen', ['battle', this.canvas]);

    } catch (err) {
      if (!this._lifecycle.active || this._lifecycle.generation !== generation) return;
      console.error(`[${this.stageId}]のアセット読み込み中にエラー:`, err);
      this.loadError = err;
      this._errorPanel = showBootError('ステージを準備できませんでした。もう一度ためすか、地図にもどれます。', {
        retry: () => { const canvas = this.canvas; this.exit(); this.enter(canvas); },
        back: () => publish('changeScreen','stageSelect'),
      });
    }
  },

  update(dt) {
    const { ctx, canvas } = this;
    if (!ctx) return;
    // スマホを たてに 持った時は 盤面を 480×680 に（つぎの バトルも 同じ 大きさ）。
    // 出る時に 800×600 へ 戻さないのは、バトル・ステージ選択が 自分で 合わせるから（戻すと 一瞬 小さくなる）
    syncPortraitCanvas(canvas);

    const cw = canvas.width, ch = canvas.height;
    const portrait = cw < ch;
    ctx.clearRect(0, 0, cw, ch);
    const bg = ctx.createLinearGradient(0, 0, 0, ch);
    bg.addColorStop(0, '#203d49');
    bg.addColorStop(1, '#69442c');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cw, ch);
    const image = this.previewBackground;
    if (image?.naturalWidth > 0 && image?.naturalHeight > 0) {
      const scale = Math.max(cw / image.naturalWidth, ch / image.naturalHeight);
      const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
      ctx.drawImage(image, (cw - width) / 2, (ch - height) / 2, width, height);
      ctx.fillStyle = 'rgba(13,29,35,0.64)';
      ctx.fillRect(0, 0, cw, ch);
    } else {
      ctx.fillStyle = 'rgba(255,221,157,0.15)';
      ctx.beginPath();
      ctx.arc(cw * 0.77, ch * 0.22, 72, 0, Math.PI * 2);
      ctx.fill();
    }

    const panelWidth = Math.min(620, cw - 48);
    const panelHeight = portrait ? 248 : 210;
    const panelX = (cw - panelWidth) / 2;
    const panelY = (ch - panelHeight) / 2;
    ctx.fillStyle = 'rgba(13,31,37,0.84)';
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
    ctx.strokeStyle = '#dfc58f';
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

    ctx.fillStyle = '#fff8e7';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `bold ${portrait ? 26 : 28}px "UDデジタル教科書体", sans-serif`;
    if (portrait) {
      ctx.fillText('ぼうけんの じゅんびを', cw / 2, panelY + 35);
      ctx.fillText('しているよ', cw / 2, panelY + 68);
    } else {
      ctx.fillText('ぼうけんの じゅんびを しているよ', cw / 2, panelY + 38);
    }

    const barWidth = panelWidth - 64;
    const barHeight = 26;
    const x = (cw - barWidth) / 2;
    const y = panelY + (portrait ? 115 : 88);
    const progress = Math.max(0, Math.min(1, this.progress));
    ctx.fillStyle = 'rgba(255,255,255,0.20)';
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = '#f5c266';
    ctx.fillRect(x, y, barWidth * progress, barHeight);
    ctx.strokeStyle = '#ffe5af';
    ctx.strokeRect(x, y, barWidth, barHeight);

    ctx.fillStyle = '#fff8e7';
    ctx.font = '20px "UDデジタル教科書体", sans-serif';
    ctx.fillText(`${Math.floor(progress * 100)}%`, cw / 2, y + barHeight + 10);
    ctx.font = '19px "UDデジタル教科書体", sans-serif';
    ctx.fillText('じぶんの ペースで たのしもう', cw / 2, panelY + panelHeight - 48);
    const controls = getLearningControls(canvas);
    drawLearningButton(ctx,controls.back,controls.scale);
  },

  exit() {
    this._lifecycle.deactivate();
    this.previewBackground = null;
    this.canvas?.removeEventListener?.('click',this._clickHandler);
    if (this._errorPanel) { hideBootProgress(); this._errorPanel = null; }
    console.log("🚪 stageLoadingState.exit() 実行");
    this.ctx = null;
    this.canvas = null;
  }
};

export default stageLoadingState;