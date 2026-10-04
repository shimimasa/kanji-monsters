// src/resultWinScreen.js
// ステージクリア後の画面（Victory Screen）

import { publish } from '../core/eventBus.js';
import { drawButton, isMouseOverRect } from '../ui/uiRenderer.js';
import { gameState, battleState, recordStageCleared, saveGameData, resetStageProgress } from '../core/gameState.js';
import { checkAchievements } from '../core/achievementManager.js';
import { calcBonusReward, isFirstClear, markBonusFirstClear, isBonusUnlocked } from '../core/bonusManager.js';
import { stageData } from '../loaders/dataLoader.js';
import { findNextStage, gradeEndGuide } from '../core/nextStage.js';
import { isStageCleared } from '../core/saveData.js';
import { syncPortraitCanvas, restoreLandscapeCanvas, isPortraitCanvas } from './battle/portraitLayout.js';
import { getGameCoordinates, isValidCoordinates } from '../utils/coordinateUtils.js';
import { prefersReducedMotion } from '../ui/motionPreferences.js';
import { createScreenLifecycle } from '../core/screenLifecycle.js';

/** 幅 maxW に入るまで文字を小さくして書く（最小 13px） */
function fitText(ctx, text, x, y, maxW, size, weight = '') {
  let px = size;
  ctx.font = `${weight}${px}px "UDデジタル教科書体", sans-serif`;
  while (px > 13 && ctx.measureText(text).width > maxW) {
    px -= 1;
    ctx.font = `${weight}${px}px "UDデジタル教科書体", sans-serif`;
  }
  ctx.fillText(text, x, y);
}

// 位置は layoutButtons() で毎回決める（まちがえた漢字のパネルの有無・つぎのステージの有無で変わる）
const nextStageButton = {
  x: 300,
  y: 490,
  width: 200,
  height: 50,
  text: 'ステージ選択へ',
  tone: 'secondary'
};

const quickReviewButton = {
  x: 50,
  y: 480,
  width: 220,
  height: 50,
  text: 'いま おぼえちゃう！'
};

// 「つぎのステージへ」。同じ学年の次のステージを、ステージ選択を通らずに始める
// 学年の さいごで 学年まとめに 鍵が ある時の「マスターに ちょうせん ▶ ステージ名」
const masterButton = {
  x: 330,
  y: 346,
  width: 420,
  height: 48,
  text: 'マスターに ちょうせん'
};

const goNextButton = {
  x: 250,
  y: 418,
  width: 300,
  height: 58,
  text: 'つぎのステージへ'
};

// 画面のたての並び（800×600）。ボタンの下端は 450 より上に置く。
// 実績のお知らせは main.js（凍結中）が canvas の y450〜530 の真ん中に3.5秒描くので、
// 以前はクリア直後に「ステージ選択へ」がその下に隠れていた。
const RESULT_LAYOUT = {
  titleY: 66,          // 「ステージクリア！」の帯の中心（帯は ±30、「おめでとう！」は +50）
  panelY: 140,         // 「きろく」のパネル
  panelH: 166,         // 4行と パーフェクトの 1行が 入る高さ
  bonusPanelH: 206,    // 学年まとめの パネル（4行まで）
  gap: 14,
  rowA: 52,            // つぎへ
  rowB: 46,            // いま おぼえちゃう！・ステージ選択へ
  rowGap: 8,
  mistakeH: 108,       // 「つぎの たびで また 会う 字」
};

const resultWinState = {
  _lifecycle: createScreenLifecycle(),
  canvas: null,
  ctx: null,
  _clickHandler: null,
  _mousemoveHandler: null,
  mouseX: 0,
  mouseY: 0,
  animationTime: 0, // アニメーション用タイマー
  resultData: null, // 結果データを保存
  bonusSummary: null, // 学年ボーナスの結果データを保持
  _countCommitted: false, // ← 追加: カウント二重加算防止

  /** 画面表示時の初期化 */
  async enter(canvas, resultData) {
    const entryGeneration = this._lifecycle.activate();
    // 結果データを保存
    this.resultData = resultData || {
      correct: gameState.correctKanjiList || [],
      wrong: gameState.wrongKanjiList || [],
      time: battleState.timeRemaining || 0,
      playerHp: gameState.playerStats.hp || 0
    };

    // ★ 追加: ここでステージクリアを確実に反映
    const stageId = this.resultData.stageId || gameState.currentStageId;
    if (stageId) {
      try {
        // P0-2 StepC-1: clear_* 互換ミラー書き込みを停止（読み取り互換は saveData.isStageCleared の legacy fallback で維持）
        // localStorage.setItem(`clear_${stageId}`, '1');
        // NOTE: saveGameData() は gameState.stageProgress を読んで krb_save へ統合するため、
        // 必ず「クリア印を立ててから」保存する。順序を逆にすると、今クリアしたステージが
        // 保存対象に入らない（この順序ミスが実際に事故になっていた）。
        if (!gameState.stageProgress) gameState.stageProgress = {};
        gameState.stageProgress[stageId] = { cleared: true };
        try { saveGameData(); } catch {}
      } catch (e) {
        console.warn('ステージクリア反映に失敗:', e);
      }
    }

    // 実績チェックを最初に実行
    try {
      await checkAchievements();
    } catch (error) {
      console.error('実績チェック中にエラーが発生しました:', error);
    }

    // import予約より前のawaitも、開始した入場世代に所属する。
    if (!this._lifecycle.active || this._lifecycle.generation !== entryGeneration) return;

    // クリア画面に入ったらクリアBGMを再生
    publish('playBGM', 'victory');

    // ステージクリアの統計データを更新（多重防止）
if (!this._countCommitted) {
  recordStageCleared();
  this._countCommitted = true;
}
    // パーフェクトクリア判定
    if (battleState.mistakesThisStage === 0) {
      gameState.justClearedPerfectly = true;
      console.log('🏆 パーフェクトクリア達成！');
    } else {
      gameState.justClearedPerfectly = false;
    }
    
    // キャンバスを取得
    this.canvas = canvas || document.getElementById('gameCanvas');
    if (!this.canvas) {
      console.error('キャンバス要素が見つかりません');
      return;
    }
    
    this.ctx = this.canvas.getContext('2d');
    
    // 勝利画面の入場SEは鳴らさない。流用していた se_level はバトル中の
    // レベルアップ音と同一ファイルで、画面に入るたび「レベルが上がった?」と
    // 誤って覚えさせるうえ、bgm_victory と実績音に重なっていた。
    // ここは静かな勝利BGMに任せる（専用ジングルが用意できたら復活させる）
    
    // アニメーションタイマーを初期化
    this.animationTime = 0;

    this.bonusSummary = null;

    // つぎのステージ（クリアの印を立てたあとに見るので、最後のステージなら学年まとめの鍵も反映される）
    try {
      const cleared = (id) => !!(isStageCleared(id) || gameState.stageProgress?.[id]?.cleared);
      this.nextStage = findNextStage(stageData, stageId, isBonusUnlocked, cleared);
      // 「つぎ」が無い（学年の通常ステージを ぜんぶ クリア、まとめは まだ鍵）時は、鍵の 開け方を 案内する
      this.gradeEnd = this.nextStage ? null : gradeEndGuide(stageData, stageId, {
        isCleared: cleared, isBonusUnlocked,
        isMastered: (id) => !!gameState.stageReviewUnlocked?.[id],
      });
    } catch (e) {
      console.warn('つぎのステージを決められませんでした:', e);
      this.nextStage = null;
      this.gradeEnd = null;
    }

    const bonusCheckId = stageId || gameState.currentStageId || '';
    const m = /^bonus_g(\d+)$/i.exec(bonusCheckId);
    if (m) {
      const grade = parseInt(m[1], 10);
      const fights = gameState.enemies?.length || 0;
      const cleared = fights; // クリア済み連戦数（勝利なので=fights）
      const total = (this.resultData.correct?.length || 0) + (this.resultData.wrong?.length || 0);
      const accuracyPct = total > 0 ? Math.floor((this.resultData.correct.length / total) * 100) : 100;
      const remHpPct = Math.floor((gameState.playerStats.hp / gameState.playerStats.maxHp) * 100);
      const firstClear = isFirstClear(grade);

      const result = calcBonusReward({ grade, fights, cleared, accuracyPct, remHpPct, firstClear });

      // ステージクリア時のEXP付与は行わない（表示のみ）
      if (firstClear) markBonusFirstClear(grade);

      // accuracyPct はランク計算にだけ使う内部値。画面には出さず、
      // 「よめた漢字: X / Y」という数え上げで見せる
      const correctCount = this.resultData.correct?.length || 0;
      this.bonusSummary = { grade, fights, accuracyPct, remHpPct, correctCount, totalAsked: total, ...result, xp: 0 };
    }
    
    // イベントハンドラ登録
    this.registerHandlers();
    // チュートリアル（初回のみ）
    import('../tutorial/TutorialManager.js').then(this._lifecycle.guard(m => m.default.startIfNeeded('resultWin', { canvas: this.canvas })));
  },

  /** 毎フレーム呼び出し（描画） */
  update(dt) {
    if (!this.ctx || !this.canvas) return;
    
    const { ctx, canvas } = this;
    // スマホを たてに 持った時は 盤面を 480×680 に（バトルと 同じ。screens/battle/portraitLayout.js）
    syncPortraitCanvas(canvas);
    if (!prefersReducedMotion()) this.animationTime += Math.max(0, dt || 0);
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. 和紙風背景を描画
    this.drawParchmentBackground(ctx, canvas.width, canvas.height);

    // 2. 装飾的なタイトルを描画
    // 全体を上に詰めている。実績のお知らせ（main.js が y450〜530 に描く）にボタンが隠れないように
    this.drawDecorativeTitle(ctx, canvas.width / 2, RESULT_LAYOUT.titleY);

    // 3. パーフェクトクリア演出
    if (gameState.justClearedPerfectly) {
      this.drawPerfectClearCrown(ctx, canvas.width / 2 + 200, RESULT_LAYOUT.titleY - 40);
    }

        // 4. 結果表示パネル
        if (this.bonusSummary) {
          // 学年ボーナス専用のパネルのみ描画（通常パネルはスキップ）
          this.drawBonusResultPanel(ctx, canvas.width / 2 - 180, RESULT_LAYOUT.panelY, 360, RESULT_LAYOUT.bonusPanelH);
        } else {
          this.drawResultPanel(ctx, canvas.width / 2 - 180, RESULT_LAYOUT.panelY, 360, RESULT_LAYOUT.panelH);
        }
    

// 5. 下の段: 左に「つぎの旅でまた会う漢字」、右（なければ真ん中）にボタン
//    上の列: つぎのステージへ（いちばん大きく） / 下の列: いま おぼえちゃう！・ステージ選択へ
//    以前は「いま おぼえちゃう！」がステージ選択へと重なるのをよけて、戦績の枠の上に逃げていた。
const hasMistakes = !!(gameState.wrongKanjiList && gameState.wrongKanjiList.length > 0);
this.layoutButtons(hasMistakes);
if (hasMistakes) {
  // たての 画面では きろくの 下に 横いっぱい、それ以外は 左下
  if (isPortraitCanvas(canvas)) this.drawMistakeScrollPanel(ctx, 40, this.buttonTop(), 400, 96);
  else this.drawMistakeScrollPanel(ctx, 50, this.buttonTop(), 250, RESULT_LAYOUT.mistakeH);
}
if (this.nextStage) this.drawRichButton(ctx, goNextButton, isMouseOverRect(this.mouseX, this.mouseY, goNextButton));
if (this.gradeEnd) {
  // 例:「北海道の まとめは、マスターを そろえると ひらくよ（1/2）」
  const g = this.gradeEnd;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#7a4a12';
  fitText(ctx, `${g.region ? g.region + 'の ' : ''}まとめは、マスターを そろえると ひらくよ（${g.mastered}/${g.total}）`,
    masterButton.x + masterButton.width / 2, masterButton.y - 15, masterButton.width, 17, 'bold ');
  ctx.restore();
  this.drawRichButton(ctx, masterButton, isMouseOverRect(this.mouseX, this.mouseY, masterButton));
}
if (hasMistakes) this.drawRichButton(ctx, quickReviewButton, isMouseOverRect(this.mouseX, this.mouseY, quickReviewButton));
this.drawRichButton(ctx, nextStageButton, isMouseOverRect(this.mouseX, this.mouseY, nextStageButton));

   
  },

  /**
   * 和紙風の背景を描画
   */
  drawParchmentBackground(ctx, width, height) {
    ctx.save();
    
    // ベースの背景グラデーション
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, '#F5DEB3'); // クリーム色
    bgGradient.addColorStop(0.3, '#F0E68C'); // 明るいカーキ
    bgGradient.addColorStop(0.7, '#DDD8B8'); // ベージュ
    bgGradient.addColorStop(1, '#D2B48C'); // より濃いベージュ
    
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);
    
    // 和紙のテクスチャ効果（ランダムな点）
    ctx.fillStyle = 'rgba(139, 69, 19, 0.05)';
    for (let i = 0; i < 200; i++) {
      const x = (i * 137) % width;
      const y = (i * 83) % height;
      const size = (i % 3) + 1;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // 古い紙の汚れ効果
    ctx.fillStyle = 'rgba(160, 82, 45, 0.08)';
    for (let i = 0; i < 50; i++) {
      const x = (i * 181) % width;
      const y = (i * 109) % height;
      const radius = 10 + (i % 20);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // 縁の装飾（古文書風の境界線）
    ctx.strokeStyle = 'rgba(139, 69, 19, 0.3)';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, width - 20, height - 20);
    
    ctx.strokeStyle = 'rgba(160, 82, 45, 0.2)';
    ctx.lineWidth = 4;
    ctx.strokeRect(15, 15, width - 30, height - 30);
    
    ctx.restore();
  },

  /**
   * 装飾的なタイトルを描画
   */
  drawDecorativeTitle(ctx, centerX, centerY) {
    ctx.save();
    
    // リボン風の背景
    const ribbonWidth = 400;
    const ribbonHeight = 60;
    
    // リボンのグラデーション
    const ribbonGradient = ctx.createLinearGradient(
      centerX - ribbonWidth/2, centerY - ribbonHeight/2,
      centerX + ribbonWidth/2, centerY + ribbonHeight/2
    );
    ribbonGradient.addColorStop(0, '#DAA520'); // ゴールデンロッド
    ribbonGradient.addColorStop(0.5, '#FFD700'); // 金色
    ribbonGradient.addColorStop(1, '#B8860B'); // ダークゴールデンロッド
    
    // リボンの影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(centerX - ribbonWidth/2 + 5, centerY - ribbonHeight/2 + 5, ribbonWidth, ribbonHeight);
    
    // リボン本体
    ctx.fillStyle = ribbonGradient;
    ctx.fillRect(centerX - ribbonWidth/2, centerY - ribbonHeight/2, ribbonWidth, ribbonHeight);
    
    // リボンの縁取り
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 3;
    ctx.strokeRect(centerX - ribbonWidth/2, centerY - ribbonHeight/2, ribbonWidth, ribbonHeight);
    
    // タイトルテキスト
    ctx.font = 'bold 42px "UDデジタル教科書体", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // テキストの影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillText('ステージクリア！', centerX + 3, centerY + 3);
    
    // テキスト本体（金色のグラデーション）
    const textGradient = ctx.createLinearGradient(centerX, centerY - 20, centerX, centerY + 20);
    textGradient.addColorStop(0, '#FFFACD'); // レモンシフォン
    textGradient.addColorStop(0.5, '#FFD700'); // 金色
    textGradient.addColorStop(1, '#DAA520'); // ゴールデンロッド
    
    ctx.fillStyle = textGradient;
    ctx.fillText('ステージクリア！', centerX, centerY);
    
    // テキストの縁取り
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2;
    ctx.strokeText('ステージクリア！', centerX, centerY);
    
    // サブタイトル
    ctx.font = '24px "UDデジタル教科書体", sans-serif';
    ctx.fillStyle = '#8B4513';
    ctx.fillText('おめでとう！', centerX, centerY + 50);
    
    ctx.restore();
  },

  /**
   * パーフェクトクリア時の王冠を描画
   */
  drawPerfectClearCrown(ctx, x, y) {
    ctx.save();
    
    // 王冠のアニメーション（回転と脈動）
    const pulse = 1 + 0.1 * Math.sin(this.animationTime * 0.005);
    const rotation = this.animationTime * 0.002;
    
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale(pulse, pulse);
    
    // 王冠の影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.moveTo(2, 12);
    ctx.lineTo(-18, -8);
    ctx.lineTo(-8, -18);
    ctx.lineTo(2, -8);
    ctx.lineTo(12, -18);
    ctx.lineTo(22, -8);
    ctx.closePath();
    ctx.fill();
    
    // 王冠本体のグラデーション
    const crownGradient = ctx.createLinearGradient(0, -20, 0, 10);
    crownGradient.addColorStop(0, '#FFD700'); // 金色
    crownGradient.addColorStop(0.5, '#FFA500'); // オレンジ
    crownGradient.addColorStop(1, '#DAA520'); // ゴールデンロッド
    
    // 王冠の形
    ctx.fillStyle = crownGradient;
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.lineTo(-20, -10);
    ctx.lineTo(-10, -20);
    ctx.lineTo(0, -10);
    ctx.lineTo(10, -20);
    ctx.lineTo(20, -10);
    ctx.closePath();
    ctx.fill();
    
    // 王冠の縁取り
    ctx.strokeStyle = '#B8860B';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // 宝石（中央）
    ctx.fillStyle = '#FF1493'; // ディープピンク
    ctx.beginPath();
    ctx.arc(0, -5, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // 光る効果
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(-1, -7, 2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
    
    // 「PERFECT!」テキスト
    ctx.save();
    ctx.font = 'bold 20px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FF6347'; // トマト色
    ctx.fillText('PERFECT!', x, y + 40);
    ctx.restore();
  },

  /**
   * 結果表示パネルを描画
   */
  drawResultPanel(ctx, x, y, width, height) {
    ctx.save();
    
    // パネルの影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(x + 5, y + 5, width, height);
    
    // パネル背景（木目調）
    const panelGradient = ctx.createLinearGradient(x, y, x, y + height);
    panelGradient.addColorStop(0, '#DEB887'); // バーリーウッド
    panelGradient.addColorStop(0.5, '#D2B48C'); // タン
    panelGradient.addColorStop(1, '#BC9A6A'); // より暗いタン
    
    ctx.fillStyle = panelGradient;
    ctx.fillRect(x, y, width, height);
    
    // パネルの縁取り
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, width, height);
    
    // 内側の装飾線
    ctx.strokeStyle = '#A0522D';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 5, y + 5, width - 10, height - 10);
    
    // パネルタイトル
    ctx.font = 'bold 24px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8B4513';
    // 文言は 1〜2年の漢字と ひらがな だけにする（対象は漢字が苦手な子。「戦績」「現在」「総」は読めない）
    ctx.fillText('きろく', x + width/2, y + 30);

    // 結果データ（間違い数の対比表示はやめ、成長が見える並びにする）
    const newlyReadCount = gameState.newlyReadKanjiList ? gameState.newlyReadKanjiList.length : 0;
    // 同じステージを周回する子（＝伸びのゆっくりな子ほど多い）は、はじめて読めた漢字が
    // 永久に 0個 になる。0個のときは「0」を見せず、絶対に減らない累計に差し替える
    const readSoFar = Object.values(gameState.kanjiAnswerStats || {})
      .filter(v => (v?.correct || 0) > 0).length;
    const answeredExamples = [...new Set((gameState.correctKanjiList || []).map(k => k?.text || k?.kanji).filter(Boolean))].slice(0, 3);
    const newExamples = [...new Set((gameState.newlyReadKanjiList || []).map(k => k?.text || k?.kanji).filter(Boolean))].slice(0, 3);
    const results = [
      `よめた 回数: ${gameState.correctKanjiList ? gameState.correctKanjiList.length : 0}`,
      newlyReadCount > 0
        ? `はじめて よめた 字: ${newExamples.join('・')}（${newlyReadCount}字）`
        : (answeredExamples.length ? `よめた 字: ${answeredExamples.join('・')}` : `これまでに よめた 字: ${readSoFar}字`),
      `レベル: ${gameState.playerStats.level}`,
      `クリアした ステージ: ${gameState.playerStats.stagesCleared}`
    ];

    ctx.textAlign = 'left';

    results.forEach((text, index) => {
      // はじめて読めた漢字がある時は、その行をお祝い色で強調する
      const highlight = index === 1 && newlyReadCount > 0;
      ctx.fillStyle = highlight ? '#1e8449' : '#654321';
      // 枠からはみ出さないように、入りきらない行は文字を小さくする（以前は緑の行が枠の外まで出ていた）
      fitText(ctx, highlight ? `✨ ${text}` : text, x + 20, y + 70 + index * 25, width - 40, 18, highlight ? 'bold ' : '');
    });
    
    // パーフェクトクリアの場合の特別表示
    if (gameState.justClearedPerfectly) {
      ctx.font = 'bold 16px "UDデジタル教科書体", sans-serif';
      ctx.fillStyle = '#FF6347';
      ctx.textAlign = 'center';
      ctx.fillText('✨ パーフェクトクリア ✨', x + width/2, y + height - 15);
    }
    
    ctx.restore();
  },

// 追加: 学年ボーナス専用の結果パネル
drawBonusResultPanel(ctx, x, y, width, height) {
  if (!this.bonusSummary) return;
  const s = this.bonusSummary;

  ctx.save();

  // 影
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(x + 5, y + 5, width, height);

  // 背景（木目調を流用）
  const panelGradient = ctx.createLinearGradient(x, y, x, y + height);
  panelGradient.addColorStop(0, '#DEB887');
  panelGradient.addColorStop(0.5, '#D2B48C');
  panelGradient.addColorStop(1, '#BC9A6A');
  ctx.fillStyle = panelGradient;
  ctx.fillRect(x, y, width, height);

  // 枠
  ctx.strokeStyle = '#8B4513';
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, width, height);
  ctx.strokeStyle = '#A0522D';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 5, y + 5, width - 10, height - 10);

  // タイトル
  ctx.font = 'bold 24px "UDデジタル教科書体", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#8B4513';
  ctx.fillText('きろく', x + width/2, y + 30);

  // セクション見出し
  ctx.font = '22px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('学年まとめの けっか', x + width/2, y + 65);

  // 1〜2年の漢字と ひらがな だけにする（「連戦」「倍率」「付与」「称号」「進捗」は読めない）
  const lines = [
    `たたかった 回数: ${s.fights}`,
    `よめた 字: ${s.correctCount} / ${s.totalAsked} ／ のこりHP: ${s.remHpPct}%`,
    `ランク: ${s.rank}（ばいりつ x${s.multiplier}）`
  ];
  const tp = s.titleProgress;
  if (tp?.gained) {
    const nextText = tp.nextThreshold ? `つぎの しょうごうまで あと ${tp.nextThreshold - tp.count} 回` : 'しょうごう ぜんぶ ゲット！';
    lines.push(`しょうごう: クリア ${tp.count} 回（${nextText}）`);
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = '#654321';
  let yy = y + 95;
  for (const t of lines) {
    fitText(ctx, t, x + 20, yy, width - 40, 18);
    yy += 24;
  }

  ctx.restore();
},


  /**
   * リッチなボタンを描画
   */
  /** 下の段のボタンの位置を決める（描画とクリック判定の両方から呼ぶ） */
  layoutButtons(hasMistakes) {
    goNextButton.text = this.nextStage?.name ? `つぎへ ▶ ${this.nextStage.name}` : 'つぎのステージへ';
    // 「つぎへ」が無い時（学年の最後など）は、ステージ選択へ が いちばんの ボタンなので緑のまま
    nextStageButton.tone = (this.nextStage || this.gradeEnd) ? 'secondary' : 'primary';
    masterButton.text = this.gradeEnd?.stage?.name ? `マスターに ちょうせん ▶ ${this.gradeEnd.stage.name}` : 'マスターに ちょうせん';
    const L = RESULT_LAYOUT;
    if (isPortraitCanvas(this.canvas)) {
      // スマホを たてに 持った時: まちがえた字の パネルの 下に、横いっぱいで たてに 並べる
      const x = 40, w = 400, half = (w - 10) / 2;
      const top = this.buttonTop() + (hasMistakes ? 104 : 0);
      Object.assign(goNextButton, { x, y: top, width: w, height: L.rowA });
      Object.assign(masterButton, { x, y: top + 26, width: w, height: 48 });
      const rowB = this.nextStage ? top + L.rowA + L.rowGap : (this.gradeEnd ? top + 26 + 48 + 6 : top);
      if (hasMistakes) {
        Object.assign(quickReviewButton, { x, y: rowB, width: half, height: L.rowB, fontSize: 18 });
        Object.assign(nextStageButton, { x: x + half + 10, y: rowB, width: half, height: L.rowB, fontSize: 18 });
      } else {
        Object.assign(nextStageButton, { x: 120, y: rowB, width: 240, height: L.rowB, fontSize: 20 });
      }
      return;
    }
    const top = this.buttonTop();
    // 「つぎへ」が無ければ 下の列が上へ上がる
    // 学年の さいご（gradeEnd）は 1行の 案内（26）＋「マスターに ちょうせん」（48）の下に 下の列
    const rowB = this.nextStage ? top + L.rowA + L.rowGap : (this.gradeEnd ? top + 26 + 48 + 6 : top);
    const area = hasMistakes ? { x: 330, width: 420 } : { x: 220, width: 360 };
    Object.assign(masterButton, { x: area.x, y: top + 26, width: area.width, height: 48 });
    if (hasMistakes) {
      // 左に まちがえた漢字のパネル（x50〜300）。ボタンは右側 x330〜750
      Object.assign(goNextButton, { x: 330, y: top, width: 420, height: L.rowA });
      Object.assign(quickReviewButton, { x: 330, y: rowB, width: 205, height: L.rowB, fontSize: 18 });
      Object.assign(nextStageButton, { x: 545, y: rowB, width: 205, height: L.rowB, fontSize: 18 });
    } else {
      Object.assign(goNextButton, { x: 220, y: top, width: 360, height: L.rowA });
      Object.assign(nextStageButton, { x: 300, y: rowB, width: 200, height: L.rowB, fontSize: 20 });
    }
  },

  /** パネルの下の段の上端（学年まとめのパネルは少し高い） */
  buttonTop() {
    const L = RESULT_LAYOUT;
    return L.panelY + (this.bonusSummary ? L.bonusPanelH : L.panelH) + L.gap;
  },

  drawRichButton(ctx, button, isHovered) {
    ctx.save();

    const { x, y, width, height, text } = button;
    const secondary = button.tone === 'secondary';
    const scale = isHovered ? 1.05 : 1.0;
    
    // ホバー時のスケール調整
    const scaledWidth = width * scale;
    const scaledHeight = height * scale;
    const scaledX = x + (width - scaledWidth) / 2;
    const scaledY = y + (height - scaledHeight) / 2;
    
    // ボタンの影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(scaledX + 4, scaledY + 4, scaledWidth, scaledHeight);
    
    // ボタン背景のグラデーション
    const buttonGradient = ctx.createLinearGradient(scaledX, scaledY, scaledX, scaledY + scaledHeight);
    if (secondary) {
      // ステージ選択へ（もどる側）は茶色にして、「つぎのステージへ」と見分けられるように
      buttonGradient.addColorStop(0, isHovered ? '#a0703c' : '#8b5a2b');
      buttonGradient.addColorStop(1, isHovered ? '#6b4423' : '#5a3a1c');
    } else if (isHovered) {
      buttonGradient.addColorStop(0, '#32CD32'); // ライムグリーン
      buttonGradient.addColorStop(0.5, '#228B22'); // フォレストグリーン
      buttonGradient.addColorStop(1, '#006400'); // ダークグリーン
    } else {
      buttonGradient.addColorStop(0, '#228B22'); // フォレストグリーン
      buttonGradient.addColorStop(0.5, '#006400'); // ダークグリーン
      buttonGradient.addColorStop(1, '#004000'); // より暗いグリーン
    }
    
    ctx.fillStyle = buttonGradient;
    ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
    
    // ボタンの縁取り
    ctx.strokeStyle = isHovered ? '#FFD700' : '#8B4513';
    ctx.lineWidth = isHovered ? 3 : 2;
    ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);
    
    // ハイライト効果
    const highlightGradient = ctx.createLinearGradient(scaledX, scaledY, scaledX, scaledY + scaledHeight * 0.3);
    highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = highlightGradient;
    ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight * 0.3);
    
    // ボタンテキスト（ステージ名が長い時は ボタンに収まるまで小さくする）
    let fontSize = button.fontSize || 20;
    ctx.font = `bold ${fontSize}px "UDデジタル教科書体", sans-serif`;
    while (fontSize > 14 && ctx.measureText(text).width > scaledWidth - 20) {
      fontSize -= 1;
      ctx.font = `bold ${fontSize}px "UDデジタル教科書体", sans-serif`;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // テキストの影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillText(text, scaledX + scaledWidth/2 + 2, scaledY + scaledHeight/2 + 2);
    
    // テキスト本体
    ctx.fillStyle = isHovered ? '#FFFACD' : 'white';
    ctx.fillText(text, scaledX + scaledWidth/2, scaledY + scaledHeight/2);
    
    ctx.restore();
  },

  /**
   * 間違えた漢字の巻物風パネルを描画
   */
  drawMistakeScrollPanel(ctx, x, y, width, height) {
    if (!gameState.wrongKanjiList || gameState.wrongKanjiList.length === 0) return;
    
    ctx.save();
    
    // 巻物の影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(x + 3, y + 3, width, height);
    
    // 巻物背景（古い紙色）
    const scrollGradient = ctx.createLinearGradient(x, y, x + width, y);
    scrollGradient.addColorStop(0, '#F5E6D3'); // 古い紙色
    scrollGradient.addColorStop(0.5, '#E6D3C1'); // より暗い紙色
    scrollGradient.addColorStop(1, '#D3C1A8'); // さらに暗い紙色
    
    ctx.fillStyle = scrollGradient;
    ctx.fillRect(x, y, width, height);
    
    // 巻物の縁取り
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    
    // 巻物の装飾（上下の巻き部分）
    ctx.fillStyle = '#A0522D';
    ctx.fillRect(x, y, width, 8);
    ctx.fillRect(x, y + height - 8, width, 8);
    
    // タイトル
    ctx.font = 'bold 16px "UDデジタル教科書体", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#8B4513';
    ctx.fillText('つぎの たびで また 会う 字', x + 10, y + 28);

    // また会う字。同じ字が何回も入っているので まとめ、横に大きく並べる（パネルは高さ108）
    const seen = [...new Set(gameState.wrongKanjiList.map(k => `${k?.text || k?.kanji || k}`).filter(Boolean))];
    const maxDisplay = Math.min(seen.length, 6);
    ctx.font = '24px "UDデジタル教科書体", sans-serif';
    ctx.fillStyle = '#654321';
    ctx.fillText(seen.slice(0, maxDisplay).join(' '), x + 15, y + 62);

    // 表示しきれない場合の省略表示
    if (seen.length > maxDisplay) {
      ctx.font = '14px "UDデジタル教科書体", sans-serif';
      ctx.fillStyle = '#A0522D';
      ctx.fillText(`ほか ${seen.length - maxDisplay}こ`, x + 15, y + 90);
    }
    
    ctx.restore();
  },

  /** 画面離脱時のクリーンアップ */
  exit() {
    this._lifecycle.deactivate();
    this.unregisterHandlers();
    restoreLandscapeCanvas(this.canvas); // ほかの 画面は 800×600 で 描く
    this.canvas = null;
    this.ctx = null;
    this.resultData = null;
    this.bonusSummary = null;
    this.nextStage = null;
    this.gradeEnd = null;
    this._countCommitted = false; // ← 追加: 次回のためにリセット
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
    if (!rect) return; // getBoundingClientRectがnullの場合は処理しない
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    
    this.mouseX = (e.clientX - rect.left) * scaleX;
    this.mouseY = (e.clientY - rect.top) * scaleY;
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

    const hasMistakes = !!(gameState.wrongKanjiList && gameState.wrongKanjiList.length > 0);
    this.layoutButtons(hasMistakes);

    // つぎのステージへ: ステージ選択で2回押すのと同じ準備をして、すぐ始める
    if (this.nextStage && isMouseOverRect(x, y, goNextButton)) {
      publish('playSE', 'decide');
      const targetId = this.nextStage.stageId;
      gameState.currentStageId = targetId;
      resetStageProgress(targetId);
      // つぎのバトル画面がBGMを流すので、勝利BGMは止めておく（ゲームオーバーの「もういちど」と同じ）
      publish('stopBGM', 0.2);
      publish('changeScreen', 'stageLoading');
      return;
    }

    // マスターに ちょうせん: ステージ選択の「マスター」と同じ（そのステージの れんしゅう）
    if (this.gradeEnd && isMouseOverRect(x, y, masterButton)) {
      publish('playSE', 'decide');
      gameState.currentStageId = this.gradeEnd.stage.stageId;
      gameState.gameMode = 'practice';
      publish('playBGM', 'title'); // 練習モードはメニュー共通BGM
      publish('changeScreen', 'practiceBattle');
      return;
    }

    if (isMouseOverRect(x, y, nextStageButton)) {
      publish('playSE', 'decide');
      // 同画面への遷移を禁止して確実に抜ける
      let targetScreen = gameState.previousScreen;
      if (!targetScreen || targetScreen === 'resultWin' || targetScreen === 'battle') {
        targetScreen = 'stageSelect';
      }
      // 画面遷移前にメニュー系BGMへ切替
      publish('playBGM', 'title');
      publish('changeScreen', targetScreen);
    }
    
    // 描いていない時（まちがいが0）は押せない。以前は見えない当たり判定が残っていた
    if (hasMistakes && isMouseOverRect(x, y, quickReviewButton)) {
      publish('playSE', 'decide');
      const targetStageId = (this.resultData && this.resultData.stageId) || gameState.currentStageId;
      const wrongRaw = (this.resultData && this.resultData.wrong) || gameState.wrongKanjiList || [];
      const texts = Array.from(new Set(wrongRaw.map(w => (typeof w === 'string') ? w : (w?.text || w?.kanji || String(w || ''))).filter(Boolean)));
      const ids   = Array.from(new Set(wrongRaw.map(w => (typeof w === 'object' && w && 'id' in w) ? w.id : null).filter(v => v !== null && v !== undefined)));
    
      gameState.quickReviewTargets = { stageId: targetStageId, ids, texts };
    
      // ← 追加: フェールセーフとしてローカルに退避
      try {
        localStorage.setItem('quickReviewBuffer', JSON.stringify({
          stageId: targetStageId, ids, texts, ts: Date.now()
        }));
      } catch {}
    
      gameState.previousScreen = 'resultWin';
      gameState.gameMode = 'practice';
      publish('changeScreen', 'quickReviewPractice'); // 専用画面へ
    }
  }
};

export default resultWinState;

// 追加: FSM 一貫化のため描画エントリポイントを alias
resultWinState.render = function() {
  this.update(0);
};

