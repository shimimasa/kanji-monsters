import { publish } from '../core/eventBus.js';
import ReviewQueue from '../models/reviewQueue.js';
import { getKanjiByGrade, getKanjiById } from '../loaders/dataLoader.js';
import { gameState } from '../core/gameState.js';
import { drawButton, isMouseOverRect } from '../ui/uiRenderer.js';

// 文字正規化（reviewStage と同仕様）
function hiraShift(ch) { return String.fromCharCode(ch.charCodeAt(0) - 0x60); }
function toHiragana(input) {
  return (input || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[\u30a1-\u30f6]/g, hiraShift);
}
function getReadings(kanji) {
  const set = new Set();
  if (kanji?.kunyomi) kanji.kunyomi.split(' ').forEach(r => r && set.add(toHiragana(r.trim())));
  if (kanji?.onyomi)  kanji.onyomi.split(' ').forEach(r => r && set.add(toHiragana(r.trim())));
  return [...set];
}

const BTN = {
  back:   { x: 20, y: 20, w: 120, h: 36, label: 'ステージ選択' },
  again:  { x: 200, y: 480, w: 120, h: 40, label: 'もう一度' },
  review: { x: 340, y: 480, w: 120, h: 40, label: '復習に挑戦' },
  select: { x: 480, y: 480, w: 140, h: 40, label: 'ステージ選択へ' },
};

const gradeQuizScreen = {
  canvas: null,
  ctx: null,
  inputEl: null,
  _keydownHandler: null,
  _clickHandler: null,

  // パラメータ
  grade: 0,
  numQuestions: 10,

  // 進行状態
  pool: [],
  order: [],
  index: 0,
  current: null,
  feedback: '',
  feedbackColor: 'white',
  phase: 'quiz', // 'quiz' | 'result'
  stats: {
    correct: 0,
    wrong: 0,
    answers: [], // { id, ok, userAnswer, correctReadings }
  },

  enter(arg) {
    // Canvas 取得（引数 or DOM）
    const isCanvasArg = arg && typeof arg.getContext === 'function';
    this.canvas = isCanvasArg ? arg : document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    // パラメータ（props）を解釈
    const props = (!isCanvasArg && arg && typeof arg === 'object') ? arg : {};
    this.grade = Number(props.grade ?? gameState.currentGrade ?? 0);
    this.numQuestions = Number(props.numQuestions ?? 10);

    // プール作成
    this.pool = getKanjiByGrade(this.grade) || [];
    if (!this.pool || this.pool.length < 3) {
      // 学年データが極端に少ない場合は中止して戻る
      publish('changeScreen', 'stageSelect');
      return;
    }

    // 出題順をランダムに（重複なし）
    const shuffled = [...this.pool].sort(() => Math.random() - 0.5);
    this.order = shuffled.slice(0, Math.min(this.numQuestions, shuffled.length)).map(k => k.id);
    this.index = 0;
    this.stats = { correct: 0, wrong: 0, answers: [] };
    this.phase = 'quiz';
    this._loadCurrent();

    // 入力欄
    this.inputEl = document.getElementById('kanjiInput');
    if (this.inputEl) {
      this.inputEl.style.display = 'block';
      this.inputEl.value = '';
      this._keydownHandler = e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        this._checkAnswer(this.inputEl.value);
      };
      this.inputEl.addEventListener('keydown', this._keydownHandler);
    }

    // クリック（戻る/リザルト操作）
    this._clickHandler = e => {
      const r = this.canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (isMouseOverRect(x, y, BTN.back)) {
        publish('changeScreen', 'stageSelect');
        return;
      }
      if (this.phase === 'result') {
        if (isMouseOverRect(x, y, BTN.again)) {
          publish('changeScreen', 'gradeQuiz', { grade: this.grade, numQuestions: this.numQuestions });
          return;
        }
        if (isMouseOverRect(x, y, BTN.review)) {
          // 復習へ（キューが作成済み想定）
          publish('changeScreen', 'reviewStage');
          return;
        }
        if (isMouseOverRect(x, y, BTN.select)) {
          publish('changeScreen', 'stageSelect');
          return;
        }
      }
    };
    this.canvas.addEventListener('click', this._clickHandler);
  },

  _loadCurrent() {
    const id = this.order[this.index];
    const data = getKanjiById(id);
    this.current = data ? { ...data, readings: getReadings(data) } : null;
    this.feedback = '';
    this.feedbackColor = 'white';
  },

  _checkAnswer(raw) {
    if (!this.current) return;
    const user = toHiragana(raw);
    const ok = this.current.readings.includes(user);

    // フィードバック・記録
    this.feedback = ok ? '正解！' : `不正解… 正答: ${this.current.readings.join('、')}`;
    this.feedbackColor = ok ? '#2ecc71' : '#e74c3c';
    this.stats[ok ? 'correct' : 'wrong']++;
    this.stats.answers.push({
      id: this.current.id,
      ok,
      userAnswer: user,
      correctReadings: this.current.readings,
    });
    // 不正解は復習キューへ
    if (!ok) ReviewQueue.add(this.current.id);

    // 次の問題へ
    this.index++;
    if (this.index >= this.order.length) {
      // 終了
      this.phase = 'result';
      // 入力欄は隠す
      if (this.inputEl) this.inputEl.style.display = 'none';
      return;
    }
    if (this.inputEl) this.inputEl.value = '';
    this._loadCurrent();
  },

  update(dt) {
    const { ctx, canvas } = this;
    if (!ctx) return;
    // 背景
    ctx.fillStyle = '#1e3c72';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // タイトル
    ctx.fillStyle = 'white';
    ctx.font = '24px "UDデジタル教科書体",sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`学年まとめテスト（${this.grade}年）`, 20, 70);

    // 戻るボタン
    drawButton(ctx, BTN.back.x, BTN.back.y, BTN.back.w, BTN.back.h, BTN.back.label);

    if (this.phase === 'quiz') {
      // 進捗
      ctx.fillStyle = 'white';
      ctx.font = '18px "UDデジタル教科書体",sans-serif';
      ctx.fillText(`Q ${Math.min(this.index + 1, this.order.length)} / ${this.order.length}`, 20, 110);

      // 中央の漢字ボックス
      const x = canvas.width / 2, y = canvas.height / 2;
      const w = 200, h = 200;
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - w / 2, y - h / 2, w, h);

      // 漢字本体
      ctx.fillStyle = 'white';
      ctx.font = '110px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.current?.kanji || '？', x, y);

      // フィードバック
      if (this.feedback) {
        ctx.fillStyle = this.feedbackColor;
        ctx.font = '20px "UDデジタル教科書体",sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(this.feedback, x, y + h / 2 + 16);
      }
    } else {
      // リザルト画面
      const centerX = canvas.width / 2;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'white';
      ctx.font = '24px "UDデジタル教科書体",sans-serif';
      ctx.fillText('テスト結果', centerX, 120);

      const total = this.order.length;
      const correct = this.stats.correct;
      const pass = correct >= Math.ceil(total * 0.8);
      ctx.font = '18px "UDデジタル教科書体",sans-serif';
      ctx.fillStyle = pass ? '#2ecc71' : '#f1c40f';
      ctx.fillText(`正解: ${correct} / ${total}（${pass ? '合格' : '再挑戦推奨'}）`, centerX, 160);

      ctx.fillStyle = 'white';
      ctx.font = '16px "UDデジタル教科書体",sans-serif';
      ctx.fillText('不正解は復習キューに追加されました', centerX, 190);

      // ボタン
      drawButton(ctx, BTN.again.x, BTN.again.y, BTN.again.w, BTN.again.h, BTN.again.label);
      drawButton(ctx, BTN.review.x, BTN.review.y, BTN.review.w, BTN.review.h, BTN.review.label);
      drawButton(ctx, BTN.select.x, BTN.select.y, BTN.select.w, BTN.select.h, BTN.select.label);
    }
  },

  exit() {
    if (this.inputEl && this._keydownHandler) {
      this.inputEl.removeEventListener('keydown', this._keydownHandler);
      this.inputEl.style.display = 'none';
    }
    if (this.canvas && this._clickHandler) {
      this.canvas.removeEventListener('click', this._clickHandler);
    }
    // 参照クリア
    this.canvas = this.ctx = this.inputEl = null;
    this._keydownHandler = this._clickHandler = null;
  },
};

export default gradeQuizScreen;
