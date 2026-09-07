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

const stageLoadingState = {
  canvas: null,
  ctx: null,
  progress: 0,
  stageId: null,
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

      const wrappedPromises = loadPromises.map(p => p.then(result => {
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

    // ローディング画面の描画
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    bg.addColorStop(0, '#2c1810');
    bg.addColorStop(1, '#3d2414');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const barWidth = 600;
    const barHeight = 30;
    const x = (canvas.width - barWidth) / 2;
    const y = (canvas.height - barHeight) / 2;

    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = '#CD853F';
    ctx.fillRect(x, y, barWidth * this.progress, barHeight);
    ctx.strokeStyle = '#D2B48C';
    ctx.strokeRect(x, y, barWidth, barHeight);

    ctx.fillStyle = '#fff';
    ctx.font = '18px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${Math.floor(this.progress * 100)}%`, canvas.width / 2, y + barHeight + 8);
    ctx.font = 'bold 26px "UDデジタル教科書体", sans-serif';
    ctx.fillText('ステージを じゅんびしています', canvas.width / 2, y - 44);
    const controls = getLearningControls(canvas);
    drawLearningButton(ctx,controls.back,controls.scale);
  },

  exit() {
    this._lifecycle.deactivate();
    this.canvas?.removeEventListener?.('click',this._clickHandler);
    if (this._errorPanel) { hideBootProgress(); this._errorPanel = null; }
    console.log("🚪 stageLoadingState.exit() 実行");
    this.ctx = null;
    this.canvas = null;
  }
};

export default stageLoadingState;