import { publish } from '../core/eventBus.js';
import ReviewQueue from '../models/reviewQueue.js';
import { getKanjiByGrade, getKanjiById, getEnemiesByGrade, stageData } from '../loaders/dataLoader.js';
import { loadMonsterImage, loadBgImage } from '../loaders/assetsLoader.js';
import { gameState, recordKanjiAnswer, saveGameData } from '../core/gameState.js';
import { drawStoneButton, drawGauge, isMouseOverRect } from '../ui/uiRenderer.js';
import { drawRoundedRect } from '../ui/canvasUtils.js';
import { toHiragana, getReadings, findNearMiss, getNearMissLines } from '../utils/readings.js';
import { getGameCoordinates, isValidCoordinates, gameToScreenCoordinates } from '../utils/coordinateUtils.js';

// 読みの正規化・取得は共通実装を使用（配列/文字列データ両対応）

const BTN = {
  back:   { x: 20, y: 20, w: 120, h: 36, label: 'ステージ選択' },
  again:  { x: 200, y: 480, w: 120, h: 40, label: 'もう一度' },
  review: { x: 340, y: 480, w: 120, h: 40, label: '復習に挑戦' },
  select: { x: 480, y: 480, w: 140, h: 40, label: 'ステージ選択へ' },
};

// モンスターパネル（画面右側。漢字パネルとは canvasUtils.drawRoundedRect で角丸に揃える）
const MONSTER_PANEL = { x: 560, y: 90, w: 220, h: 170 };
// 漢字パネル（中央）。他のバトル画面と違い出題は1体固定なので、位置は固定値でよい
const KANJI_BOX = { centerX: 380, centerY: 300, w: 200, h: 200 };

const gradeQuizScreen = {
  canvas: null,
  ctx: null,
  inputEl: null,
  _keydownHandler: null,
  _clickHandler: null,
  _resizeHandler: null,
  _kanapadLayoutHandler: null,

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
  locked: false,        // フィードバック表示中は次の解答を受け付けない
  _advanceTimer: null,
  phase: 'quiz', // 'quiz' | 'result'
  stats: {
    correct: 0,
    wrong: 0,
    answers: [], // { id, ok, userAnswer, correctReadings }
  },

  // 見た目だけの「モンスター」。実際の攻撃判定やダメージ計算はせず、
  // 残り問題数に応じてHPゲージが減っていく進捗演出として使う。
  enemy: null,
  enemyImg: null,
  // 単色の背景だと寂しいので、学年のステージからランダムに1枚借りる
  stageBgImage: null,

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
    this.locked = false;
    if (this._advanceTimer) { clearTimeout(this._advanceTimer); this._advanceTimer = null; }
    this._loadCurrent();

    // モンスターは見た目の演出用に1体だけ選ぶ（学年に敵がいなければ表示しない）
    this.enemy = null;
    this.enemyImg = null;
    try {
      const enemyPool = getEnemiesByGrade(this.grade);
      if (enemyPool.length > 0) {
        this.enemy = enemyPool[Math.floor(Math.random() * enemyPool.length)];
        loadMonsterImage(this.enemy).then(img => { this.enemyImg = img; }).catch(() => {});
      }
    } catch {}

    // 背景も単色だと寂しいので、学年のステージ背景から1枚ランダムに借りる。
    // ステージ選択とは無関係な演出用途なので、選んだステージ自体は覚えておかない
    this.stageBgImage = null;
    try {
      const stageCandidates = stageData.filter(s => s && s.grade === this.grade && !/^bonus_/i.test(String(s.stageId || '')));
      if (stageCandidates.length > 0) {
        const pickedStage = stageCandidates[Math.floor(Math.random() * stageCandidates.length)];
        loadBgImage(pickedStage.stageId).then(img => { this.stageBgImage = img; }).catch(() => {});
      }
    } catch {}

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

    // 画面固定（vh-lock）を有効化。canvas がパッドの高さぶん縮む仕組み
    // （index.html の #gameCanvas.vh-lock）は他のバトル画面と共通で使う。
    // これが無いと、他の画面と違って canvas がアスペクト比を保たず伸び縮みし、
    // 入力欄も静的な座標に取り残されて画面が崩れて見える。
    requestAnimationFrame(() => {
      document.documentElement.classList.add('vh-lock');
      document.body.classList.add('vh-lock');
      if (this.canvas) this.canvas.classList.add('vh-lock');
      this._adjustInputPosition();
    });
    this._resizeHandler = () => this._adjustInputPosition();
    window.addEventListener('resize', this._resizeHandler);
    // 50音パッドの出し入れで canvas の高さが変わった時も、入力欄を追従させる
    this._kanapadLayoutHandler = () => this._adjustInputPosition();
    window.addEventListener('kanapad:layout', this._kanapadLayoutHandler);

    // クリック（戻る/リザルト操作）
    // 座標変換は他のバトル画面と同じ共通実装（object-fit:contain の黒帯を除いて計算する）を使う
    this._clickHandler = e => {
      const coords = getGameCoordinates(e, this.canvas);
      if (!isValidCoordinates(coords)) return; // 黒帯エリアのクリックは無視
      const { x, y } = coords;
      if (isMouseOverRect(x, y, BTN.back)) {
        publish('changeScreen', 'stageSelect');
        return;
      }
      if (this.phase === 'result') {
        if (isMouseOverRect(x, y, BTN.again)) {
          // NOTE: publish(event, payload) は第3引数を捨てるため、以前は grade も
          // numQuestions も渡らず、enter() が gameState.currentGrade（多くの場合 0）に
          // フォールバックして、そのまま ステージ選択へ戻されていた。
          // changeScreen の正規化が対応している [name, props] 形式で渡す。
          publish('changeScreen', ['gradeQuiz', { grade: this.grade, numQuestions: this.numQuestions }]);
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

  /**
   * 入力欄を漢字パネルの直下に、canvas の実表示サイズに合わせて配置する。
   * 他のバトル画面（battleScreen.js の _adjustInputPosition）と同じ考え方の簡易版。
   * canvas の内部解像度は 800x600 固定で、CSS 表示サイズは vh-lock と
   * 50音パッドの開閉で変わるため、都度 getBoundingClientRect() から計算し直す。
   */
  _adjustInputPosition() {
    if (!this.canvas || !this.inputEl) return;
    // 結果画面では入力欄そのものを隠すので、ここで !important の display:block を
    // 立て直してしまわないよう抜ける（resize や 50音パッドの開閉はどの phase でも起こる）
    if (this.phase !== 'quiz') return;
    try {
      const rect = this.canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const boxBottom = KANJI_BOX.centerY + KANJI_BOX.h / 2;
      // フィードバック文言（漢字パネル直下、+16の位置）と重ならないよう、
      // 入力欄はその下に離して置く
      // object-fit:contain の黒帯を除いた実コンテンツ位置に合わせる（他のバトル画面と共通の変換）
      const { x: cssX, y: cssY } = gameToScreenCoordinates(KANJI_BOX.centerX, boxBottom + 70, this.canvas);

      const el = this.inputEl;
      const s = el.style;
      s.setProperty('display', 'block', 'important');
      s.setProperty('position', 'fixed', 'important');
      s.setProperty('left', `${cssX}px`, 'important');
      s.setProperty('top', `${cssY}px`, 'important');
      s.setProperty('transform', 'translateX(-50%)', 'important');
      s.setProperty('z-index', '2147483647', 'important');
      const isTablet = window.innerWidth <= 1024;
      s.width = isTablet ? 'min(80vw, 320px)' : '280px';
      s.fontSize = isTablet ? '18px' : '20px';
      s.padding = '8px 12px';
      s.textAlign = 'center';
      s.backgroundColor = 'white';
      s.border = '2px solid #ccc';
      s.borderRadius = '5px';
      s.boxSizing = 'border-box';
      s.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
    } catch {}
  },

  _loadCurrent() {
    const id = this.order[this.index];
    const data = getKanjiById(id);
    this.current = data ? { ...data, readings: getReadings(data) } : null;
    this.feedback = '';
    this.feedbackColor = 'white';
    this.nearMissCount = 0; // 「おしい」の回数は問題ごとに数え直す
  },

  _checkAnswer(raw) {
    if (!this.current || this.locked) return;
    const user = toHiragana(raw);
    const ok = this.current.readings.includes(user);

    // 読めているのに書き方だけずれた入力は、力だめしでも「よめなかった」に数えない。
    // 記録も残さず、同じ問題のまま書き直させる。
    if (!ok) {
      const nearMiss = findNearMiss(user, this.current.readings);
      if (nearMiss) {
        this.nearMissCount = (this.nearMissCount || 0) + 1;
        this.feedback = getNearMissLines(nearMiss, this.nearMissCount).join('  ');
        this.feedbackColor = '#5bc0de'; // 読みちがいの琥珀とは分ける
        if (this.inputEl) this.inputEl.value = '';
        return;
      }
    }

    // フィードバック・記録
    this.feedback = ok ? 'せいかい！' : `おしい！ こたえは「${this.current.readings.join('、')}」`;
    // 読みちがいは責めない中立色（琥珀）。赤 #e74c3c は使わない
    this.feedbackColor = ok ? '#2ecc71' : '#f1c40f';
    this.stats[ok ? 'correct' : 'wrong']++;
    this.stats.answers.push({
      id: this.current.id,
      ok,
      userAnswer: user,
      correctReadings: this.current.readings,
    });
    // 学習記録（正史）へ加算し、不正解は復習キューへ
    recordKanjiAnswer(this.current.id, ok);
    if (!ok) ReviewQueue.add(this.current.id);

    // フィードバックを1秒見せてから次へ進む。
    // 以前はここで同期的に _loadCurrent() を呼んでいたため、直前に入れた
    // this.feedback が1フレームも描画されず、答えても無反応に見えていた。
    this.locked = true;
    if (this.inputEl) this.inputEl.value = '';
    this._advanceTimer = setTimeout(() => {
      this._advanceTimer = null;
      this.locked = false;
      this.index++;
      if (this.index >= this.order.length) {
        // 終了
        this.phase = 'result';
        // 入力欄は隠す（_adjustInputPosition が !important で block を立てているため、
        // 同じ強さで上書きしないと隠れない）
        if (this.inputEl) this.inputEl.style.setProperty('display', 'none', 'important');
        // NOTE: recordKanjiAnswer はメモリ上の学習記録を増やすだけで、保存は
        // 既存のセーブ契機に相乗りする設計。力だめしにはその契機が無く、
        // 結果画面で閉じると1回分まるごと消えていたのでここで確定させる。
        try { saveGameData(); } catch {}
        return;
      }
      this._loadCurrent();
    }, 1000);
  },

  update(dt) {
    const { ctx, canvas } = this;
    if (!ctx) return;
    // 背景。単色だと寂しいので学年のステージ画像を敷き、白文字が沈まないよう
    // 元の紺色を半透明で重ねる（パネル類は元々この紺色を前提にした薄いデザインのため）
    if (this.stageBgImage) {
      ctx.drawImage(this.stageBgImage, 0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(30, 60, 114, 0.55)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = '#1e3c72';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // タイトル
    ctx.fillStyle = 'white';
    ctx.font = '24px "UDデジタル教科書体",sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`学年まとめテスト（${this.grade}年）`, 20, 70);

    // 戻るボタン
    drawStoneButton(ctx, BTN.back.x, BTN.back.y, BTN.back.w, BTN.back.h, BTN.back.label);

    if (this.phase === 'quiz') {
      // 進捗
      ctx.fillStyle = 'white';
      ctx.font = '18px "UDデジタル教科書体",sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`Q ${Math.min(this.index + 1, this.order.length)} / ${this.order.length}`, 20, 110);

      this._drawMonster(ctx);

      // 中央の漢字パネル
      const { centerX: x, centerY: y, w, h } = KANJI_BOX;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      drawRoundedRect(ctx, x - w / 2, y - h / 2, w, h, 12);
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, x - w / 2, y - h / 2, w, h, 12);
      ctx.stroke();

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
      // 合否ではなく到達度で伝える。届いていない時も「あと何問で届くか」と
      // 上向きに数え、「不合格」に相当する表示は出さない
      const need = Math.ceil(total * 0.8);
      const reached = correct >= need;
      ctx.font = '18px "UDデジタル教科書体",sans-serif';
      ctx.fillStyle = reached ? '#2ecc71' : '#f1c40f';
      ctx.fillText(`よめた: ${correct} / ${total}`, centerX, 160);

      ctx.font = '16px "UDデジタル教科書体",sans-serif';
      ctx.fillText(reached ? 'この学年は バッチリ！' : `あと ${need - correct} もんで バッチリ！`, centerX, 188);

      ctx.fillStyle = 'white';
      ctx.fillText('まちがえた漢字は「きょうのふくしゅう」に いれておいたよ', centerX, 216);

      // ボタン
      drawStoneButton(ctx, BTN.again.x, BTN.again.y, BTN.again.w, BTN.again.h, BTN.again.label);
      drawStoneButton(ctx, BTN.review.x, BTN.review.y, BTN.review.w, BTN.review.h, BTN.review.label);
      drawStoneButton(ctx, BTN.select.x, BTN.select.y, BTN.select.w, BTN.select.h, BTN.select.label);
    }
  },

  /**
   * 見た目だけのモンスターパネル。実際に攻撃コマンドは無く、
   * 「あと何問か」を HP ゲージとして重ねているだけの進捗演出。
   */
  _drawMonster(ctx) {
    const { x, y, w, h } = MONSTER_PANEL;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    drawRoundedRect(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, x, y, w, h, 10);
    ctx.stroke();

    ctx.fillStyle = 'white';
    ctx.font = '15px "UDデジタル教科書体",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(this.enemy?.name || 'モンスター', x + w / 2, y + 8);

    // 残り問題数をHPゲージとして見せる（0問なら空、開始時は満タン）
    const remaining = Math.max(0, this.order.length - this.index);
    const hpRatio = this.order.length > 0 ? remaining / this.order.length : 0;
    drawGauge(ctx, x + 14, y + 32, w - 28, 14, hpRatio, '#e74c3c');

    if (this.enemyImg) {
      const imgW = 150, imgH = 108;
      ctx.drawImage(this.enemyImg, x + (w - imgW) / 2, y + 54, imgW, imgH);
    }
  },

  exit() {
    // 画面を離れた後にタイマーが発火して、片付け済みの参照を触らないようにする
    if (this._advanceTimer) { clearTimeout(this._advanceTimer); this._advanceTimer = null; }
    this.locked = false;
    // 途中でやめた場合も、そこまでの学習記録を残す
    try { saveGameData(); } catch {}
    if (this.inputEl && this._keydownHandler) {
      this.inputEl.removeEventListener('keydown', this._keydownHandler);
      this.inputEl.style.setProperty('display', 'none', 'important');
    }
    if (this.canvas && this._clickHandler) {
      this.canvas.removeEventListener('click', this._clickHandler);
    }
    if (this._resizeHandler) { window.removeEventListener('resize', this._resizeHandler); this._resizeHandler = null; }
    if (this._kanapadLayoutHandler) { window.removeEventListener('kanapad:layout', this._kanapadLayoutHandler); this._kanapadLayoutHandler = null; }

    // 画面固定（vh-lock）を無効化（1フレーム遅延で安全に解除。他画面と同じ作法）
    const cvs = this.canvas;
    requestAnimationFrame(() => {
      document.documentElement.classList.remove('vh-lock');
      document.body.classList.remove('vh-lock');
      if (cvs) cvs.classList.remove('vh-lock');
    });

    // 参照クリア
    this.canvas = this.ctx = this.inputEl = null;
    this._keydownHandler = this._clickHandler = null;
    this.enemy = null;
    this.enemyImg = null;
  },
};

export default gradeQuizScreen;
