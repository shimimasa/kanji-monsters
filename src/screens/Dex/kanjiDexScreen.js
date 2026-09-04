// src/kanjiDexScreen.js
// 漢字図鑑画面：コレクションされた漢字をスクロール表示
import { publish } from '../../core/eventBus.js';
import { loadDex } from '../../models/kanjiDex.js';
import { getKanjiById, kanjiData, getKanjiByGrade, isKanjiMastered } from '../../loaders/dataLoader.js';
import { gameState, getKanjiAnswerStats } from '../../core/gameState.js';
import { drawButton, isMouseOverRect } from '../../ui/uiRenderer.js';

const BTN = {
  back: { x: 20, y: 20, w: 100, h: 30, label: 'ステージ選択へ' },
  prevPage: { x: 580, y: 500, w: 100, h: 40, label: '前のページ' },
  nextPage: { x: 690, y: 500, w: 100, h: 40, label: '次のページ' },
  closeModal: { x: 550, y: 80, w: 80, h: 30, label: '閉じる' },  // モーダル用閉じるボタン
  
  // ソートボタンを拡張
  sortByGrade: { x: 150, y: 20, w: 70, h: 30, label: '学年順' },
  sortByStrokes: { x: 230, y: 20, w: 70, h: 30, label: '画数順' },
  sortByMastery: { x: 310, y: 20, w: 70, h: 30, label: '習熟度順' },
  toggleFilter: { x: 390, y: 20, w: 120, h: 30, label: '収集済のみ' }
};

const kanjiDexScreen = {
  canvas: null,
  ctx:    null,
  dexSet: null,
  allList: [],
  scroll: 0,
  selectedKanjiId: null,
  _clickHandler: null,
  _keyHandler:   null,

    // 新しいプロパティ
    sortMode: 'default',
    showCollectedOnly: false,
    // ← 追加: 誤読のみ表示フラグ
    showWrongOnly: false,
    filteredList: [],
    // ← 追加: 学年フィルタ（'all' | 1..10）
    gradeFilter: 'all',

  // DOM要素の参照
  container: null,
  cardGrid: null,
  cardsPerPage: 20,

  /** enter：画面表示時の初期化 */
  enter(arg) {
    // 最新の収集状況を反映
    this.dexSet = loadDex();
    
    // canvas 引数が HTMLCanvasElement ならそれを使い、そうでなければ DOM から取得
    this.canvas = (arg && typeof arg.getContext === 'function')
    ? arg
    : document.getElementById('gameCanvas');
  this.ctx    = this.canvas.getContext('2d');

  // 画面専用BGMを再生
  publish('playBGM', 'bgm_kanjiDex');

  // 背面のキャンバスを不可視化（前画面の斜線などが透けないように）
    this._canvasRef = this.canvas || null;
    if (this._canvasRef) {
      this._prevCanvasVisibility = this._canvasRef.style.visibility;
      this._prevCanvasPointer    = this._canvasRef.style.pointerEvents;
      this._canvasRef.style.visibility   = 'hidden';
      this._canvasRef.style.pointerEvents = 'none';
    }
    
    // localStorageから収集済みデータを取得し、全漢字IDリストを生成
    this.allList = kanjiData.map(k => k.id);

    // 中学生の漢字データも追加
    for (let grade = 7; grade <= 10; grade++) {
      const gradeKanji = getKanjiByGrade(grade);
      if (gradeKanji && gradeKanji.length > 0) {
        // 既に存在するIDは追加しない
        const newIds = gradeKanji
          .map(k => k.id)
          .filter(id => !this.allList.includes(id));
        
        this.allList.push(...newIds);
        console.log(`【漢字図鑑】${grade}年生相当の漢字を追加: ${newIds.length}件`);
      }
    }
    this.scroll  = 0;
    this.selectedKanjiId = null;

    // 初期化処理
    this.sortMode = 'default';
    this.showCollectedOnly = false;
    this._autofixDexFromProgress();   // ← 追加（mastered を dex に補完）
    this.updateFilteredList();
    // DOMヘッダーを作成
    this.createDOMHeader();
    
    // DOMコンテンツ（カードグリッド）を作成
    this.createDOMContent();
    
    // カードを描画
    this.renderKanjiCards();
    
    // キーボードイベントの登録
    this._keyHandler = e => {
      // モーダルが開いている場合はEscキーで閉じる
      if (this.selectedKanjiId && e.key === 'Escape') {
        this.selectedKanjiId = null;
        this.closeModal();
        return;
      }
      
      // ページ移動
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        this.prevPage();
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        this.nextPage();
      }
    };
    window.addEventListener('keydown', this._keyHandler);
    import('../../tutorial/TutorialManager.js').then(m => m.default.startIfNeeded('kanjiDex', { canvas: this.canvas }));
  },

  createDOMHeader() {
    // 既存のコンテナがあれば削除
    if (this.container) {
      this.container.remove();
    }
  
    // メインコンテナを作成
    this.container = document.createElement('div');
    this.container.id = 'kanjiDexContainer';
    this.container.className = 'kanji-dex-container';
    Object.assign(this.container.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '100vw',
      height: '100vh',
      zIndex: '100000',
      background: '#2c1810', // 図鑑の背景色
      overflowY: 'auto',
      border: 'none',
      outline: 'none'
    });
  
    // === 統計エリア（ネイビーブルー系） ===
    const statsDiv = document.createElement('div');
    statsDiv.className = 'kanji-collection-stats';
    Object.assign(statsDiv.style, {
      background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.7), rgba(59, 130, 246, 0.4))',
      border: '1px solid rgba(59, 130, 246, 0.3)',
      borderRadius: '12px',
      padding: '16px',
      margin: '16px',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 2px 8px rgba(30, 58, 138, 0.2)'
    });
    
    const statsText = document.createElement('div');
    statsText.className = 'kanji-stats-text';
    Object.assign(statsText.style, {
      color: '#ffffff',
      fontSize: '18px',
      fontWeight: '600',
      marginBottom: '8px'
    });
    const collectedCount = this._effectiveCollectedCount(); // ← 変更
    const collectionRate = Math.floor((collectedCount / this.allList.length) * 100); // ← 変更
    statsText.textContent = `漢字収集率: ${collectedCount}/${this.allList.length} (${collectionRate}%)`;
    
    const progressBar = document.createElement('div');
    progressBar.className = 'kanji-progress-bar';
    Object.assign(progressBar.style, {
      background: 'rgba(255, 255, 255, 0.1)',
      borderRadius: '10px',
      height: '12px',
      overflow: 'hidden',
      border: '1px solid rgba(255, 255, 255, 0.2)'
    });
    
    const progressFill = document.createElement('div');
    progressFill.className = 'kanji-progress-fill';
    Object.assign(progressFill.style, {
      background: 'linear-gradient(90deg, #28a745, #20c997)',
      height: '100%',
      width: `${collectionRate}%`,            // ← 実効収集率で幅を更新
      transition: 'width 0.6s ease',
      borderRadius: '10px'
    });
    
    progressBar.appendChild(progressFill);
    statsDiv.appendChild(statsText);
    statsDiv.appendChild(progressBar);
  
    // === ナビゲーションエリア（メインのネイビーブルー） ===
    const navDiv = document.createElement('div');
    navDiv.className = 'kanji-dex-navigation';
    Object.assign(navDiv.style, {
      background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.85), rgba(59, 130, 246, 0.6))',
      border: '1px solid rgba(59, 130, 246, 0.4)',
      borderRadius: '12px',
      padding: '16px',
      margin: '16px',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 4px 12px rgba(30, 58, 138, 0.3)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '12px'
    });
  
    // === 左側コントロール ===
    const leftControls = document.createElement('div');
    leftControls.className = 'nav-controls-left';
    Object.assign(leftControls.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    });
  
    // 戻るボタン
    const backButton = document.createElement('button');
    backButton.className = 'btn-back';
    backButton.textContent = '📚 ステージ選択へ';
    Object.assign(backButton.style, {
      background: 'linear-gradient(135deg, #6c757d, #5a6268)',
      color: 'white',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '8px',
      padding: '8px 16px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '500',
      transition: 'all 0.3s ease',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
    });
    
    // ホバーエフェクト
    backButton.addEventListener('mouseenter', () => {
      Object.assign(backButton.style, {
        background: 'linear-gradient(135deg, #5a6268, #495057)',
        transform: 'translateY(-2px)',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)'
      });
    });
    
    backButton.addEventListener('mouseleave', () => {
      Object.assign(backButton.style, {
        background: 'linear-gradient(135deg, #6c757d, #5a6268)',
        transform: 'translateY(0)',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
      });
    });
  
    backButton.addEventListener('click', () => {
      publish('playSE', 'decide');
      publish('playBGM', 'title');
      const targetScreen = (gameState.previousScreen === 'worldStageSelect')
        ? 'worldStageSelect'
        : 'stageSelect';
      publish('changeScreen', targetScreen);
    });
    leftControls.appendChild(backButton);

    // ことわざ図鑑へ
    // 400件の ことわざ（読み・意味・例文つき）が用意されていたのに、
    // これまで src から一度も参照されていなかった。図鑑の隣に読み物として置く。
    const proverbButton = document.createElement('button');
    proverbButton.className = 'btn-proverb';
    proverbButton.textContent = '🗣 ことわざ図鑑';
    Object.assign(proverbButton.style, {
      background: 'linear-gradient(135deg, #8d6e63, #6d4c41)',
      color: 'white',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '8px',
      padding: '8px 16px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '500',
      transition: 'all 0.3s ease',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
    });
    proverbButton.addEventListener('mouseenter', () => {
      Object.assign(proverbButton.style, {
        background: 'linear-gradient(135deg, #6d4c41, #5d4037)',
        transform: 'translateY(-2px)',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)'
      });
    });
    proverbButton.addEventListener('mouseleave', () => {
      Object.assign(proverbButton.style, {
        background: 'linear-gradient(135deg, #8d6e63, #6d4c41)',
        transform: 'translateY(0)',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
      });
    });
    proverbButton.addEventListener('click', () => {
      publish('playSE', 'decide');
      publish('changeScreen', 'proverbDex');
    });
    leftControls.appendChild(proverbButton);

    // 学年セレクト
    const gradeLabel = document.createElement('span');
    gradeLabel.className = 'kanji-grade-label';
    gradeLabel.textContent = '学年：';
    Object.assign(gradeLabel.style, {
      color: '#ffffff',
      fontWeight: '500',
      marginRight: '8px'
    });
  
    const gradeSelect = document.createElement('select');
    gradeSelect.className = 'kanji-grade-filter';
    Object.assign(gradeSelect.style, {
      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.05))',
      color: 'white',
      border: '1px solid rgba(255, 255, 255, 0.3)',
      borderRadius: '6px',
      padding: '6px 12px',
      fontSize: '14px',
      cursor: 'pointer',
      transition: 'all 0.3s ease'
    });
  
    const labelForGrade = (g) => {
      if (g <= 6) return `${g}年生`;
      return ({ 7: '中1', 8: '中2', 9: '中3', 10: '高校' })[g] || `${g}`;
    };
  
    let opts = '<option value="all">すべて</option>';
    for (let g = 1; g <= 10; g++) {
      opts += `<option value="${g}" style="background: rgba(30, 58, 138, 0.9); color: white;">${labelForGrade(g)}</option>`;
    }
    gradeSelect.innerHTML = opts;
    gradeSelect.value = this.gradeFilter;
    gradeSelect.addEventListener('change', (e) => {
      this.gradeFilter = e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10);
      this.scroll = 0;
      this.updateFilteredList();
      this.updateNavigationButtons();
      this.renderKanjiCards();
      publish('playSE', 'decide');
    });
  
    leftControls.appendChild(gradeLabel);
    leftControls.appendChild(gradeSelect);
  
    // === 中央コントロール（ソートボタン） ===
    const centerControls = document.createElement('div');
    centerControls.className = 'nav-controls-center';
    Object.assign(centerControls.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      justifyContent: 'center',
      flex: '1'
    });
    
        // ソートボタンを作成する関数
        const createSortButton = (text, mode, isActive) => {
          const btn = document.createElement('button');
          btn.className = `btn-sort ${isActive ? 'sort-active' : ''}`;
          btn.textContent = text;
          const baseStyle = {
            background: isActive ? 
              'linear-gradient(135deg, #f39c12, #e67e22)' : 
              'linear-gradient(135deg, #ffc107, #e0a800)',
            color: isActive ? 'white' : '#000',
            border: isActive ? '2px solid #fff' : '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.3s ease',
            boxShadow: isActive ? 
              '0 0 12px rgba(243, 156, 18, 0.5)' : 
              '0 2px 4px rgba(0, 0, 0, 0.2)'
          };
          Object.assign(btn.style, baseStyle);
          btn.addEventListener('mouseenter', () => {
            if (!isActive) {
              Object.assign(btn.style, {
                background: 'linear-gradient(135deg, #e0a800, #d39e00)',
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)'
              });
            }
          });
          btn.addEventListener('mouseleave', () => {
            if (!isActive) {
              Object.assign(btn.style, baseStyle);
            }
          });
          btn.addEventListener('click', () => {
            this.sortList(mode);
            this.updateNavigationButtons();
            this.renderKanjiCards();
            publish('playSE', 'decide');
          });
          return btn;
        };
    
        const sortByGradeBtn   = createSortButton('📊 学年順',  'grade',   this.sortMode === 'grade');
        const sortByStrokesBtn = createSortButton('✏️ 画数順', 'strokes', this.sortMode === 'strokes');
    
        // ← 追加: 誤読のみトグルボタン
        const wrongOnlyBtn = document.createElement('button');
        wrongOnlyBtn.id = 'btnWrongOnly';
        wrongOnlyBtn.textContent = '🔁 もういちど よむ漢字';
        const wrongBase = {
          background: this.showWrongOnly ? 'linear-gradient(135deg, #f39c12, #e67e22)' : 'linear-gradient(135deg, #ffc107, #e0a800)',
          color: this.showWrongOnly ? 'white' : '#000',
          border: this.showWrongOnly ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
          borderRadius: '8px',
          padding: '8px 16px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '600',
          transition: 'all 0.3s ease',
          boxShadow: this.showWrongOnly ? '0 0 12px rgba(243,156,18,0.5)' : '0 2px 4px rgba(0,0,0,0.2)'
        };
        Object.assign(wrongOnlyBtn.style, wrongBase);
        wrongOnlyBtn.addEventListener('click', () => {
          this.showWrongOnly = !this.showWrongOnly;
          publish('playSE', 'decide');
          this.scroll = 0;
          this.updateFilteredList();
          this.updateNavigationButtons();
          this.renderKanjiCards();
        });
    
        centerControls.appendChild(sortByGradeBtn);
        centerControls.appendChild(sortByStrokesBtn);
        centerControls.appendChild(wrongOnlyBtn);
  
    // === 右側コントロール ===
    const rightControls = document.createElement('div');
    rightControls.className = 'nav-controls-right';
    Object.assign(rightControls.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    });
  
    // トグルスイッチ
    const filterToggle = document.createElement('label');
    filterToggle.className = 'kanji-toggle-switch';
    Object.assign(filterToggle.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      cursor: 'pointer'
    });
  
    const filterInput = document.createElement('input');
    filterInput.type = 'checkbox';
    filterInput.checked = this.showCollectedOnly;
    Object.assign(filterInput.style, {
      appearance: 'none',
      width: '48px',
      height: '24px',
      background: this.showCollectedOnly ? 
        'linear-gradient(135deg, #28a745, #218838)' : 
        'linear-gradient(135deg, #6c757d, #5a6268)',
      borderRadius: '12px',
      position: 'relative',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      border: '1px solid rgba(255, 255, 255, 0.3)'
    });
  
    // トグルの円
    const toggleCircle = document.createElement('span');
    Object.assign(toggleCircle.style, {
      position: 'absolute',
      width: '20px',
      height: '20px',
      background: 'white',
      borderRadius: '50%',
      top: '1px',
      left: this.showCollectedOnly ? '26px' : '1px',
      transition: 'all 0.3s ease',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
      pointerEvents: 'none'
    });
  
    filterInput.style.position = 'relative';
    filterInput.appendChild(toggleCircle);
  
    filterInput.addEventListener('change', () => {
      this.toggleFilter();
      Object.assign(filterInput.style, {
        background: this.showCollectedOnly ? 
          'linear-gradient(135deg, #28a745, #218838)' : 
          'linear-gradient(135deg, #6c757d, #5a6268)'
      });
      Object.assign(toggleCircle.style, {
        left: this.showCollectedOnly ? '26px' : '1px'
      });
      this.updateNavigationButtons();
      this.renderKanjiCards();
      publish('playSE', 'decide');
    });
  
    const filterLabel = document.createElement('span');
    filterLabel.className = 'toggle-label';
    filterLabel.textContent = '収集済のみ';
    Object.assign(filterLabel.style, {
      color: '#ffffff',
      fontWeight: '500',
      userSelect: 'none'
    });
  
    filterToggle.appendChild(filterInput);
    filterToggle.appendChild(filterLabel);
  
    // ページネーションボタン
    const createPageButton = (text, action, disabled = false) => {
      const btn = document.createElement('button');
      btn.className = 'btn-pagination';
      btn.textContent = text;
      btn.disabled = disabled;
      
      const baseStyle = {
        background: disabled ? 
          'linear-gradient(135deg, #6c757d, #5a6268)' : 
          'linear-gradient(135deg, #4a90e2, #357abd)',
        color: disabled ? '#adb5bd' : 'white',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '8px',
        padding: '8px 16px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '14px',
        transition: 'all 0.3s ease',
        boxShadow: disabled ? 'none' : '0 2px 4px rgba(0, 0, 0, 0.2)'
      };
      
      Object.assign(btn.style, baseStyle);
      
      if (!disabled) {
        btn.addEventListener('mouseenter', () => {
          Object.assign(btn.style, {
            background: 'linear-gradient(135deg, #357abd, #2e6da4)',
            transform: 'translateY(-2px)',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)'
          });
        });
        
        btn.addEventListener('mouseleave', () => {
          Object.assign(btn.style, baseStyle);
        });
      }
      
      btn.addEventListener('click', action);
      return btn;
    };
  
    const prevBtn = createPageButton('⬅️ 前のページ', () => this.prevPage(), this.scroll <= 0);
    
    const pageInfo = document.createElement('span');
    pageInfo.className = 'page-info';
    Object.assign(pageInfo.style, {
      background: 'rgba(255, 255, 255, 0.15)',
      color: 'white',
      padding: '6px 12px',
      borderRadius: '6px',
      fontWeight: '600',
      border: '1px solid rgba(255, 255, 255, 0.3)',
      minWidth: '80px',
      textAlign: 'center'
    });
    
    const maxScroll = Math.max(0, this.filteredList.length - this.cardsPerPage);
    const nextBtn = createPageButton('次のページ ➡️', () => this.nextPage(), this.scroll >= maxScroll);
  
    rightControls.appendChild(filterToggle);
    rightControls.appendChild(prevBtn);
    rightControls.appendChild(pageInfo);
    rightControls.appendChild(nextBtn);
  
    // 全体を組み立て
    navDiv.appendChild(leftControls);
    navDiv.appendChild(centerControls);
    navDiv.appendChild(rightControls);
  
    // コンテナに追加
    this.container.appendChild(statsDiv);
    this.container.appendChild(navDiv);
  
    // DOMに追加
    document.body.appendChild(this.container);
    
    // ナビゲーションボタンの状態を更新
    this.updateNavigationButtons();
  },
  /** DOMコンテンツ（カードグリッド）を作成 */
  createDOMContent() {
    // カードグリッドコンテナを作成
    this.cardGrid = document.createElement('div');
    this.cardGrid.id = 'kanjiCardGrid';
    this.cardGrid.className = 'kanji-card-grid';
    this.cardGrid.style.border = 'none';
    this.cardGrid.style.outline = 'none';
    
    // コンテナに追加
    this.container.appendChild(this.cardGrid);
  },

  /** 漢字カードを描画 */
  renderKanjiCards() {
    // 既存のカードをクリア
    if (this.cardGrid) {
      this.cardGrid.innerHTML = '';
    }
    
    // 現在のページの漢字を取得
    const startIdx = this.scroll;
    const endIdx = Math.min(startIdx + this.cardsPerPage, this.filteredList.length);
    
    // 各漢字のカードを生成
    for (let i = startIdx; i < endIdx; i++) {
      const kanjiId = this.filteredList[i];
      const kanjiData = getKanjiById(kanjiId);
      const card = this._createKanjiCard(kanjiData);
      this.cardGrid.appendChild(card);
    }
  },

    /** 漢字カードを生成 */
    _createKanjiCard(kanjiData) {
      const prog = (gameState && gameState.kanjiReadProgress && gameState.kanjiReadProgress[kanjiData.id]) || null;
  
      // mastered が保存されていないバックアップでも、読み達成状況から派生判定
      const isMastered = (() => {
        if (!prog) return false;
        if (prog.mastered) return true;
  
        const hiraShift = ch => String.fromCharCode(ch.charCodeAt(0) - 0x60);
        const toHiragana = (s) => String(s || '').replace(/[\u30a1-\u30f6]/g, hiraShift);
        const toArray = v => Array.isArray(v) ? v : (typeof v === 'string' ? v.split(' ').filter(Boolean) : []);
  
        const reqOn  = toArray(kanjiData.onyomi).map(toHiragana);
        const reqKun = toArray(kanjiData.kunyomi).map(toHiragana);
  
        const progOn  = (prog.onyomi && typeof prog.onyomi.has === 'function') ? prog.onyomi : new Set(Array.isArray(prog?.onyomi) ? prog.onyomi : []);
        const progKun = (prog.kunyomi && typeof prog.kunyomi.has === 'function') ? prog.kunyomi : new Set(Array.isArray(prog?.kunyomi) ? prog.kunyomi : []);
  
        const allOn  = reqOn.length  === 0 ? true : reqOn.every(r => progOn.has(toHiragana(r)));
        const allKun = reqKun.length === 0 ? true : reqKun.every(r => progKun.has(toHiragana(r)));
        return (reqOn.length + reqKun.length) === 0 ? false : (allOn && allKun);
      })();
  
      // ▼ マスター済みは公開扱い（? を外す）
      const collected = this.dexSet.has(kanjiData.id) || isMastered;

    // カード要素を作成
    const card = document.createElement('div');
    card.className = 'kanji-card';
    if (!collected) {
      card.classList.add('locked');
    }

    // 枠線のスタイルを直接設定
    card.style.border = '1px solid #8B4513';
    card.style.boxShadow = '3px 3px 5px rgba(0, 0, 0, 0.3)';
    card.style.position = 'relative';

    if (isMastered) {
      card.style.border = '2px solid #DAA520';
      const badge = document.createElement('div');
      badge.textContent = 'MASTER';
      Object.assign(badge.style, {
        position: 'absolute',
        top: '6px',
        right: '6px',
        padding: '2px 6px',
        fontSize: '11px',
        fontWeight: '700',
        color: '#fff',
        background: 'linear-gradient(135deg, #e1b12c, #d4a017)',
        border: '1px solid rgba(0,0,0,0.3)',
        borderRadius: '6px',
        letterSpacing: '0.5px'
      });
      card.appendChild(badge);
    }
    
    // 漢字を表示
    const kanjiEl = document.createElement('h2');
    kanjiEl.className = 'kanji-character';
    kanjiEl.textContent = collected ? kanjiData.kanji : '？';
    card.appendChild(kanjiEl);
    
    // 情報コンテナ
    const infoContainer = document.createElement('div');
    infoContainer.className = 'kanji-info';
    
    // 学年
    const gradeEl = document.createElement('p');
    gradeEl.className = 'kanji-grade';
    const grade = kanjiData.grade || '?';
    gradeEl.textContent = `${grade}年生`;
    infoContainer.appendChild(gradeEl);
    
    if (collected) {
      // 読み方（収集済みのみ）
      const readingEl = document.createElement('p');
      readingEl.className = 'kanji-reading';
      
      const readings = [];
      if (kanjiData.onyomi) readings.push(`音: ${kanjiData.onyomi}`);
      if (kanjiData.kunyomi) readings.push(`訓: ${kanjiData.kunyomi}`);
      
      readingEl.textContent = readings.join(' ');
      infoContainer.appendChild(readingEl);
      
            // 画数
            const strokesEl = document.createElement('p');
            strokesEl.className = 'kanji-strokes';
            strokesEl.textContent = `${kanjiData.strokes}画`;
            infoContainer.appendChild(strokesEl);
      
            // ← 追加: 例文表示（安全に抽出）
            const example = this._getExampleSentence(kanjiData);
            if (example) {
              const exEl = document.createElement('p');
              exEl.className = 'kanji-example';
              exEl.textContent = example;
              Object.assign(exEl.style, {
                marginTop: '6px',
                padding: '6px 8px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '12px',
                lineHeight: '1.4'
              });
              infoContainer.appendChild(exEl);
            }
      
            // 学習記録UIは非表示（星/正答率などを削除）
            /* （削除）習熟度ブロック */
    } else {
      // 未収集の場合
      const lockedEl = document.createElement('p');
      lockedEl.className = 'kanji-locked-message';
      lockedEl.textContent = '未収集';
      infoContainer.appendChild(lockedEl);
    }
    
    card.appendChild(infoContainer);
    
    // クリックイベント
    if (collected) {
      card.addEventListener('click', () => {
        this.selectedKanjiId = kanjiData.id;
        this.showModal(kanjiData.id);
        publish('playSE', 'decide');
      });
    }
    
    return card;
  },

  /**
   * がくしゅうのきろくセクションを構築する
   * 音読み/訓読みごとの「よめるようになった読み」と正答記録をポジティブ表記で見せる
   */
  _buildLearningRecordSection(k) {
    const wrap = document.createElement('div');
    wrap.className = 'kanji-learning-record';
    Object.assign(wrap.style, {
      marginTop: '10px',
      padding: '10px 12px',
      background: 'rgba(255, 255, 255, 0.35)',
      border: '1px solid rgba(139, 69, 19, 0.4)',
      borderRadius: '8px'
    });

    const title = document.createElement('h3');
    title.textContent = 'がくしゅうのきろく';
    Object.assign(title.style, { margin: '0 0 6px', fontSize: '16px' });
    wrap.appendChild(title);

    const prog = gameState.kanjiReadProgress?.[k.id];
    const onyomiSet = prog?.onyomi instanceof Set ? prog.onyomi : new Set(prog?.onyomi || []);
    const kunyomiSet = prog?.kunyomi instanceof Set ? prog.kunyomi : new Set(prog?.kunyomi || []);

    // よめるようになった読みは緑チェック、これからの読みはうすい丸
    const renderReadings = (label, readings, masteredSet) => {
      const arr = Array.isArray(readings) ? readings : (readings ? [readings] : []);
      if (arr.length === 0) return null;
      const p = document.createElement('p');
      Object.assign(p.style, { margin: '2px 0', fontSize: '14px' });
      const spans = arr.map(r => {
        const done = masteredSet.has(r);
        const color = done ? '#1e8449' : '#8d6e63';
        const mark = done ? '✓' : '○';
        return `<span style="color:${color}; font-weight:${done ? '700' : '400'}">${mark}${r}</span>`;
      });
      p.innerHTML = `<strong>${label}:</strong> ${spans.join('　')}`;
      return p;
    };

    const onEl = renderReadings('音読み', k.onyomi, onyomiSet);
    if (onEl) wrap.appendChild(onEl);
    const kunEl = renderReadings('訓読み', k.kunyomi, kunyomiSet);
    if (kunEl) wrap.appendChild(kunEl);

    // 正答記録（「よめた回数」中心のポジティブ表記）
    const stats = getKanjiAnswerStats(k.id);
    const total = stats.correct + stats.incorrect;
    const statsEl = document.createElement('p');
    Object.assign(statsEl.style, { margin: '6px 0 2px', fontSize: '14px' });
    if (total > 0) {
      const pct = Math.round((stats.correct / total) * 100);
      statsEl.innerHTML = `<strong>よめた回数:</strong> ${stats.correct}回（ちょうせん ${total}回）`;
      wrap.appendChild(statsEl);

      const barWrap = document.createElement('div');
      Object.assign(barWrap.style, {
        height: '8px',
        background: 'rgba(139, 69, 19, 0.2)',
        borderRadius: '4px',
        overflow: 'hidden',
        marginTop: '4px'
      });
      const bar = document.createElement('div');
      Object.assign(bar.style, {
        width: `${pct}%`,
        height: '100%',
        background: 'linear-gradient(90deg, #2ecc71, #27ae60)'
      });
      barWrap.appendChild(bar);
      wrap.appendChild(barWrap);
    } else {
      statsEl.textContent = 'これから ちょうせんしよう！';
      wrap.appendChild(statsEl);
    }

    if (prog?.mastered) {
      const badge = document.createElement('p');
      badge.textContent = '⭐ マスターかんじ！';
      Object.assign(badge.style, { margin: '8px 0 0', color: '#b7950b', fontWeight: '700' });
      wrap.appendChild(badge);
    }

    return wrap;
  },

  showModal(kanjiId) {
        if (document.getElementById('kanjiModal')) return; // 多重起動防止
        const k = getKanjiById(kanjiId);
         if (!k) return;

        const frag = document.createDocumentFragment();
        const modalContainer = document.createElement('div');
        modalContainer.className = 'kanji-modal';
        modalContainer.id = 'kanjiModal';
        modalContainer.style.zIndex = '100001';

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => this.closeModal());
    modalContent.appendChild(closeBtn);

    const kanjiEl = document.createElement('h1');
    kanjiEl.className = 'modal-kanji';
    kanjiEl.textContent = k.kanji;
    modalContent.appendChild(kanjiEl);

    const infoSection = document.createElement('div');
    infoSection.className = 'kanji-detail-info';
    modalContent.appendChild(infoSection);

    modalContainer.appendChild(modalContent);
   frag.appendChild(modalContainer);
   document.body.appendChild(frag); // 一括追加でレイアウト1回

    // 基本情報

    const basicInfo = document.createElement('div');
    basicInfo.className = 'kanji-basic-info';
    if (k.onyomi) {
      const onyomiEl = document.createElement('p');
      onyomiEl.innerHTML = `<strong>音読み:</strong> ${k.onyomi}`;
      basicInfo.appendChild(onyomiEl);
    }
    if (k.kunyomi) {
      const kunyomiEl = document.createElement('p');
      kunyomiEl.innerHTML = `<strong>訓読み:</strong> ${k.kunyomi}`;
      basicInfo.appendChild(kunyomiEl);
    }
    if (k.meaning) {
      const meaningEl = document.createElement('p');
      meaningEl.innerHTML = `<strong>意味:</strong> ${k.meaning}`;
      basicInfo.appendChild(meaningEl);
    }
    const gradeStrokesEl = document.createElement('p');
    gradeStrokesEl.innerHTML = `<strong>学年:</strong> ${k.grade || '?'}年 <strong>画数:</strong> ${k.strokes}画`;
    basicInfo.appendChild(gradeStrokesEl);
    infoSection.appendChild(basicInfo);

    // がくしゅうのきろく（音訓別の習熟＋正答記録）
    infoSection.appendChild(this._buildLearningRecordSection(k));

    // 例文を表示（あれば）
    const example = this._getExampleSentence(k);
    if (example) {
      const exWrap = document.createElement('div');
      exWrap.className = 'kanji-example-block';
      const exTitle = document.createElement('h3');
      exTitle.textContent = '例文';
      const exP = document.createElement('p');
      exP.textContent = example;
      Object.assign(exP.style, {
        marginTop: '6px',
        padding: '8px 10px',
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: '6px',
        color: '#fff',
        fontSize: '14px',
        lineHeight: '1.5'
      });
      exWrap.appendChild(exTitle);
      exWrap.appendChild(exP);
      infoSection.appendChild(exWrap);
    }
    modalContent.appendChild(infoSection);
    

    modalContainer.appendChild(modalContent); // すでにfragでappend済み
    // モーダル外クリックで閉じる
    modalContainer.addEventListener('click', (e) => {
      if (e.target === modalContainer) {
        this.closeModal();
      }
    });
  },

  /** モーダルを閉じる */
  closeModal() {
    const modal = document.getElementById('kanjiModal');
    if (modal) {
      modal.remove();
    }
    this.selectedKanjiId = null;
    publish('playSE', 'cancel');
  },

  /** 前のページに移動 */
  prevPage() {
    if (this.scroll <= 0) return;
    
    this.scroll = Math.max(0, this.scroll - this.cardsPerPage);
    this.updateNavigationButtons();
    this.renderKanjiCards();
    publish('playSE', 'decide');
  },

  /** 次のページに移動 */
  nextPage() {
    const maxScroll = Math.max(0, this.filteredList.length - this.cardsPerPage);
    if (this.scroll >= maxScroll) return;
    
    this.scroll = Math.min(maxScroll, this.scroll + this.cardsPerPage);
    this.updateNavigationButtons();
    this.renderKanjiCards();
    publish('playSE', 'decide');
  },

  /** ナビゲーションボタンの状態を更新 */
  updateNavigationButtons() {
    if (!this.container) return;
    
    // ページ情報を更新
  const pageInfo = this.container.querySelector('.page-info');
  if (pageInfo) {
    const currentPage = Math.floor(this.scroll / this.cardsPerPage) + 1;
    const totalPages = Math.ceil(this.filteredList.length / this.cardsPerPage);
    pageInfo.textContent = `${currentPage} / ${totalPages}`;
  }
  
  // ソートボタンのアクティブ状態を更新（ビジュアル改善）
  const sortButtons = this.container.querySelectorAll('.btn-sort');
  sortButtons.forEach((btn, index) => {
    const isActive = (
      (this.sortMode === 'grade' && index === 0) ||
      (this.sortMode === 'strokes' && index === 1) ||
      (this.sortMode === 'mastery' && index === 2)
    );
    
    // アクティブ状態のスタイルを直接適用
    if (isActive) {
      Object.assign(btn.style, {
        background: 'linear-gradient(135deg, #f39c12, #e67e22)',
        color: 'white',
        border: '2px solid #fff',
        boxShadow: '0 0 12px rgba(243, 156, 18, 0.5)'
      });
    } else {
      Object.assign(btn.style, {
        background: 'linear-gradient(135deg, #ffc107, #e0a800)',
        color: '#000',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
      });
    }
  });
  
  // ページネーションボタンの状態更新
  const paginationBtns = this.container.querySelectorAll('.btn-pagination');
  const prevBtn = paginationBtns[0];
  const nextBtn = paginationBtns[1];
  
  if (prevBtn) {
    const isDisabled = this.scroll <= 0;
    prevBtn.disabled = isDisabled;
    
    Object.assign(prevBtn.style, {
      background: isDisabled ? 
        'linear-gradient(135deg, #6c757d, #5a6268)' : 
        'linear-gradient(135deg, #4a90e2, #357abd)',
      color: isDisabled ? '#adb5bd' : 'white',
      cursor: isDisabled ? 'not-allowed' : 'pointer',
      boxShadow: isDisabled ? 'none' : '0 2px 4px rgba(0, 0, 0, 0.2)'
    });
  }
  
  if (nextBtn) {
    const maxScroll = Math.max(0, this.filteredList.length - this.cardsPerPage);
    const isDisabled = this.scroll >= maxScroll;
    nextBtn.disabled = isDisabled;
    
    Object.assign(nextBtn.style, {
      background: isDisabled ? 
        'linear-gradient(135deg, #6c757d, #5a6268)' : 
        'linear-gradient(135deg, #4a90e2, #357abd)',
      color: isDisabled ? '#adb5bd' : 'white',
      cursor: isDisabled ? 'not-allowed' : 'pointer',
      boxShadow: isDisabled ? 'none' : '0 2px 4px rgba(0, 0, 0, 0.2)'
    });
  }
  
      // 収集率統計を更新
  const statsText = this.container.querySelector('.kanji-stats-text');
  const progressFill = this.container.querySelector('.kanji-progress-fill');

  if (statsText && progressFill) {
    const collectedCount = this._effectiveCollectedCount(); // ← 変更
    const collectionRate = Math.floor((collectedCount / this.allList.length) * 100); // ← 変更
    if (this.showCollectedOnly) {
      statsText.textContent = `表示中: ${this.filteredList.length} / 収集済: ${collectedCount} (${collectionRate}%)`;
    } else {
      statsText.textContent = `漢字収集率: ${collectedCount}/${this.allList.length} (${collectionRate}%)`;
    }
    progressFill.style.width = `${collectionRate}%`;
  }

  // ← 追加: 誤読のみボタンの見た目更新
  const wrongBtn = this.container.querySelector('#btnWrongOnly');
  if (wrongBtn) {
    const active = this.showWrongOnly;
    Object.assign(wrongBtn.style, {
      background: active ? 'linear-gradient(135deg, #f39c12, #e67e22)' : 'linear-gradient(135deg, #ffc107, #e0a800)',
      color: active ? 'white' : '#000',
      border: active ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
      boxShadow: active ? '0 0 12px rgba(243,156,18,0.5)' : '0 2px 4px rgba(0,0,0,0.2)'
    });
  }
},

  /** update：毎フレーム描画 */
  update(dt) {
    const { ctx, canvas } = this;
    
    // 背景（書斎風）を描画
    ctx.fillStyle = '#2c1810';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 古文書風の背景テクスチャ
    ctx.fillStyle = 'rgba(139, 69, 19, 0.1)';
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        if ((i + j) % 2 === 0) {
          ctx.fillRect(i * 80, j * 60, 40, 30);
        }
      }
    }
  },

  /** exit：画面離脱時のクリーンアップ */
  exit() {
    // DOM要素を削除
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    
    // モーダルを閉じる
    this.closeModal();
    
    // イベント解除
    if (this._keyHandler) {
      window.removeEventListener('keydown', this._keyHandler);
    }
    this.canvas = this.ctx = null;
    this.selectedKanjiId = null;

    // キャンバスの可視状態を復元
    if (this._canvasRef) {
      this._canvasRef.style.visibility   = this._prevCanvasVisibility ?? '';
      this._canvasRef.style.pointerEvents = this._prevCanvasPointer ?? '';
      this._canvasRef = null;
      this._prevCanvasVisibility = null;
      this._prevCanvasPointer = null;
    }
  },

  /** ソート機能を実装 */
  sortList(mode) {
    this.sortMode = mode;
    
    switch (mode) {
      case 'grade':
        this.allList.sort((a, b) => {
          const kanjiA = getKanjiById(a);
          const kanjiB = getKanjiById(b);
          const gradeA = kanjiA.grade || 999;
          const gradeB = kanjiB.grade || 999;
          return gradeA - gradeB;
        });
        break;
        
      case 'strokes':
        this.allList.sort((a, b) => {
          const kanjiA = getKanjiById(a);
          const kanjiB = getKanjiById(b);
          const strokesA = kanjiA.strokes || 999;
          const strokesB = kanjiB.strokes || 999;
          return strokesA - strokesB;
        });
        break;
        
      case 'mastery':
        this.allList.sort((a, b) => {
          // 学習記録の正史（gameState.kanjiAnswerStats）から正答率を算出
          const statsA = getKanjiAnswerStats(a);
          const statsB = getKanjiAnswerStats(b);

          const totalA = statsA.correct + statsA.incorrect;
          const accuracyA = totalA > 0 ? statsA.correct / totalA : 0;

          const totalB = statsB.correct + statsB.incorrect;
          const accuracyB = totalB > 0 ? statsB.correct / totalB : 0;

          return accuracyB - accuracyA;
        });
        break;
        
      default:
        this.allList = kanjiData.map(k => k.id);
        break;
    }
    
    this.scroll = 0;
    this.updateFilteredList();
  },

    /** フィルタリング機能を実装 */
    updateFilteredList() {
      if (this.showCollectedOnly) {
        this.filteredList = this.allList.filter(id => this._isCollected(id)); // ← 変更
      } else {
        this.filteredList = [...this.allList];
      }
      // ← 学年フィルタ
      if (this.gradeFilter !== 'all') {
        this.filteredList = this.filteredList.filter(id => {
          const k = getKanjiById(id);
          return k && k.grade === this.gradeFilter;
        });
      }
      // ← 追加: 誤読のみ
      if (this.showWrongOnly) {
        this.filteredList = this.filteredList.filter(id => this._isWrongEver(id));
      }
    },
  /** フィルタリング状態を切り替え */
  toggleFilter() {
    this.showCollectedOnly = !this.showCollectedOnly;
    this.scroll = 0;
    this.updateFilteredList();
  },

  
  _isCollected(id) {
    try {
      return (this.dexSet && this.dexSet.has(id)) || !!isKanjiMastered(id);
    } catch { return this.dexSet && this.dexSet.has(id); }
  },

  _effectiveCollectedCount() {
    try {
      return this.allList.reduce((n, id) => n + (this._isCollected(id) ? 1 : 0), 0);
    } catch { return this.dexSet ? this.dexSet.size : 0; }
  },

  _autofixDexFromProgress() {
    try {
      const missing = [];
      for (const id of this.allList) {
        if (!this.dexSet.has(id) && isKanjiMastered(id)) missing.push(id);
      }
      if (missing.length > 0) {
        const merged = new Set(this.dexSet);
        missing.forEach(id => merged.add(id));
        localStorage.setItem('krb_kanji_dex', JSON.stringify([...merged]));
        this.dexSet = merged;
      }
    } catch {}
  },

  // ← 追加: 誤読判定（永続化があればlocalStorageも参照）
  _isWrongEver(id) {
    try {
      if (getKanjiAnswerStats(id).incorrect > 0) return true;

      // 追加で localStorage の補助セットを参照（存在すれば）
      try {
        const raw = localStorage.getItem('krb_wrong_kanji');
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr) && arr.includes(id)) return true;
        }
      } catch {}

      // 直近セッションの誤答リストも補助的に参照
      const w = Array.isArray(gameState.wrongKanjiList) ? gameState.wrongKanjiList : [];
      if (w.some(e => (typeof e === 'object' && e && e.id === id))) return true;

      return false;
    } catch { return false; }
  },

  // ← 追加: 例文抽出（学年差分を吸収）
  _getExampleSentence(k) {
    if (!k) return '';
    if (Array.isArray(k.examples) && k.examples.length > 0) {
      const e = k.examples[0];
      return (typeof e === 'string') ? e : (e?.sentence || '');
    }
    if (typeof k.exampleSentence === 'string' && k.exampleSentence.trim()) {
      return k.exampleSentence;
    }
    return '';
  }
};

export default kanjiDexScreen;

// FSM 一貫化のため描画エントリポイントを alias
kanjiDexScreen.render = function() {
  this.update(0);
};

