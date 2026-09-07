import { publish } from '../core/eventBus.js';
import ReviewQueue   from '../models/reviewQueue.js';
import { getKanjiById } from '../loaders/dataLoader.js';
import { beginQuestion, saveGameData } from '../core/gameState.js';
import { drawButton, isMouseOverRect } from '../ui/uiRenderer.js';
import { getReadings, getNearMissLines } from '../utils/readings.js';
import { bindInputSubmission, classifyReadingAnswer } from '../core/answerSubmission.js';
import { commitLearningOutcome } from '../core/learningOutcome.js';
import { createScreenLifecycle } from '../core/screenLifecycle.js';
import { getGameCoordinates } from '../utils/coordinateUtils.js';
import { getLearningControls, drawLearningButton, placeLearningInput } from '../ui/learningControls.js';

// 読みの正規化・取得は共通実装を使用（配列/文字列データ両対応）

const reviewStage = {
  canvas: null,
  ctx:    null,
  inputEl: null,
  _keydownHandler: null,
  _clickHandler:  null,
  kanjiIds:    [],
  currentIndex: 0,
  currentKanji: null,
  message:     '',
  emptyMessage: null,   // きょうの分が無い時に出すひと言
  _emptyTimer:  null,
  _lifecycle: createScreenLifecycle(),
  _answerSubmission: null,
  nearMissCount: 0,
  getControls() { return getLearningControls(this.canvas); },

  /** enter: 初期化 */
  enter(arg) {
    this._lifecycle.activate();
    // canvas 引数が渡されない場合は DOM から取得
    this.canvas = (arg && typeof arg.getContext === 'function')
      ? arg
      : document.getElementById('gameCanvas');
    this.ctx    = this.canvas.getContext('2d');

    // 前回の空振り案内を持ち越さない
    this.emptyMessage = null;
    if (this._emptyTimer) { clearTimeout(this._emptyTimer); this._emptyTimer = null; }

    // 1) 復習対象を取り出す（キューからは消さない）
    //    popBatch() は splice で項目を消してから ID を返すため、直後の
    //    updateReview() が items.find に失敗して黙って return し、SM-2 の
    //    間隔延長も「読めなかった字を翌日に再出題」も一度も動いていなかった。
    //    間隔の管理は updateReview に任せ、ここでは due な先頭5件を見るだけにする。
    this.kanjiIds = ReviewQueue.getDueReviews()
      .slice(0, 5)
      .map(e => e.id)
      // null, undefined な ID を除外
      .filter(id => id != null);

    if (this.kanjiIds.length === 0) {
      this.inputEl = document.getElementById('kanjiInput');
      if (this.inputEl) this.inputEl.style.display = 'none';
      // 無言で戻ると「押しても何も起きない」ように見える。
      // 初回の復習予定を翌朝にしたので、ここに来る子は今後もっと増える。
      this.emptyMessage = ['きょうの ぶんは ぜんぶ おわったよ！', 'また あした ここで まってるね'];
      this._emptyTimer = this._lifecycle.setTimeout(() => {
        this._emptyTimer = null;
        publish('changeScreen', 'stageSelect');
      }, 1800);
      return;
    }

    // 2) DOM入力欄を表示＆クリア
    this.inputEl = document.getElementById('kanjiInput');
    if (this.inputEl) {
      this.inputEl.style.display = 'block';
      this.inputEl.value = '';
    }

    // 3) 最初の漢字をロード
    this.currentIndex = 0;
    this._loadCurrent();

    // 4) キーダウン登録 (Enter判定)
    this._answerSubmission = bindInputSubmission(this.inputEl, value => this._submitAnswer(value));

    // 5) クリック登録 (ステージ選択へ戻るボタン用)
    this._clickHandler = e => {
      const { x, y } = getGameCoordinates(e, this.canvas);
      const controls = this.getControls();
      // 左上「ステージ選択」ボタン
      if (isMouseOverRect(x, y, controls.back)) {
        publish('playSE', 'decide');
        publish('changeScreen', 'stageSelect');
      }
      if (isMouseOverRect(x, y, controls.submit)) this._answerSubmission.submit(this.inputEl.value, e);
    };
    this.canvas.addEventListener('click', this._clickHandler);
  },

  /** _loadCurrent: currentKanji とメッセージをセット */
  _loadCurrent() {
    const id = this.kanjiIds[this.currentIndex++];
    const data = getKanjiById(id);
    // 読み候補もセット
    this.currentKanji = { _recordQuestion: beginQuestion('review'), ...data, readings: getReadings(data) };
    this.message = `「${data.kanji}」をよもう！`;
    this.nearMissCount = 0;
    this._answerSubmission?.unlock?.();
  },

  /** キー処理: Enter で読み判定 */
  _onKeydown(e) {
    return this._answerSubmission?.handleKeydown(e, this.inputEl?.value ?? '');
  },

  _submitAnswer(raw) {
    if (!this.currentKanji) return false;

    const assessment = classifyReadingAnswer(raw, this.currentKanji.readings);
    if (assessment.kind === 'blank') return false;
    if (assessment.kind === 'near-miss') {
      this.nearMissCount++;
      this.message = getNearMissLines(assessment.nearMiss, this.nearMissCount).join('  ');
      if (this.inputEl) this.inputEl.value = '';
      return false;
    }
    const answer = assessment.normalized;
    const ok = assessment.kind === 'correct';

    // 学習記録（正史）へ加算。ここが抜けていたため、復習だけやった日は
    // 「こんしゅうのがんばり」が 0回 のままだった
    const outcome = commitLearningOutcome(this.currentKanji.id, ok, { question: this.currentKanji._recordQuestion, source:'review', reading: answer, hintLevel: 0, answerRevealed: this.nearMissCount >= 2 });
    if (!outcome.ok) { this.message = 'ほぞんできませんでした。もう一度こたえてね。'; return false; }

    if (ok) {
      publish('playSE', 'correct');
      this.message = '前に復習へ入れた字を、今回は正解入力できたよ！';
    } else {
      // 「今日の復習」は過去に間違えた漢字と向き合う場面。ここで誤答音を重ねると
      // 追い打ちになるため鳴らさない（ゲームオーバー画面を無音にしたのと同じ理由）
      // 正しい読みをその場で示す
      this.message = `おしい！ こたえは「${this.currentKanji.readings.join('、')}」`;
    }

    // 次の漢字へ or 終了
    this._lifecycle.setTimeout(() => {
      if (this.currentIndex < this.kanjiIds.length) {
        this.inputEl.value = '';
        this._loadCurrent();
      } else {
        this.inputEl.style.display = 'none';
        publish('changeScreen', 'stageSelect');
      }
    }, 1000);
    return true;
  },

  /** 毎フレーム描画 */
  update(dt) {
    const { ctx, canvas } = this;
    // きょうの分が無い時は、ひと言だけ出してから戻る
    if (this.emptyMessage) {
      ctx.fillStyle = '#1e3c72';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'white';
      ctx.font = '22px "UDデジタル教科書体",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      this.emptyMessage.forEach((line, i) => {
        ctx.fillText(line, canvas.width / 2, canvas.height / 2 - 16 + i * 34);
      });
      ctx.textAlign = 'left';
      return;
    }
    // currentKanji が未設定であればスキップ
    if (!this.currentKanji) return;

    // 背景
    ctx.fillStyle = '#1e3c72';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // タイトル
    ctx.fillStyle = 'white';
    ctx.font      = '24px "UDデジタル教科書体",sans-serif';
    ctx.fillText('復習モード', 540, 60);

    // ステージ選択ボタン
    const controls = this.getControls();
    drawLearningButton(ctx, controls.back, controls.scale);
    drawLearningButton(ctx, controls.submit, controls.scale);
    placeLearningInput(canvas, this.inputEl, controls);

    // 漢字ボックス
    const x = canvas.width/2, y = controls.compact ? 205 : 220;
    const w = 180, h = 180;
    ctx.strokeStyle = 'white';
    ctx.lineWidth   = 2;
    ctx.strokeRect(x - w/2, y - h/2, w, h);

    // 漢字本体
    ctx.fillStyle = 'white';
    ctx.font      = '100px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.currentKanji.kanji, x, y);

    // メッセージ
    ctx.font      = `${Math.max(20,16/controls.scale)}px "UDデジタル教科書体",sans-serif`;
    ctx.textBaseline = 'top';
    const lines = this.message.match(/.{1,20}/gu) || [];
    lines.forEach((line,i)=>ctx.fillText(line, x, y+h/2+10+i*36));
  },

  /** exit: クリーンアップ */
  exit() {
    this._lifecycle.deactivate();
    // 空振り案内のタイマーが、片付けた後に遷移を起こさないようにする
    if (this._emptyTimer) { clearTimeout(this._emptyTimer); this._emptyTimer = null; }
    this.emptyMessage = null;
    // 復習でためた学習記録を確定させる（力だめしと同じ理由。
    // recordKanjiAnswer はメモリ上を増やすだけで、保存契機が無いと消える）
    try { saveGameData(); } catch {}
    // 入力欄イベント解除
    this._answerSubmission?.dispose?.();
    this._answerSubmission = null;
    this.inputEl?.removeEventListener('keydown', this._keydownHandler);
    if (this.inputEl) this.inputEl.style.display = 'none';
    // キャンバスクリック解除
    if (this.canvas && this._clickHandler) {
      this.canvas.removeEventListener('click', this._clickHandler);
    }
    this.canvas = this.ctx = this.inputEl = null;
  }
};

export default reviewStage;

// 追加: FSM 一貫化のため描画エントリポイントを alias
reviewStage.render = function() {
  this.update(0);
};
