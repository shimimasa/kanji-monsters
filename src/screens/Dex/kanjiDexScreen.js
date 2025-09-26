// src/kanjiDexScreen.js
// 漢字図鑑画面：コレクションされた漢字をスクロール表示

import { publish } from '../../core/eventBus.js';
import { loadDex } from '../../models/kanjiDex.js';
import { getKanjiById, kanjiData, getKanjiByGrade } from '../../loaders/dataLoader.js';
import { gameState } from '../../core/gameState.js';
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

    this.container.append(header, statsDiv, overview, collection, titles);
    document.body.appendChild(this.container);
    
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
    const collectionRate = Math.round((this.dexSet.size / this.allList.length) * 100);
    statsText.textContent = `漢字収集率: ${this.dexSet.size}/${this.allList.length} (${collectionRate}%)`;
    
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
      width: `${collectionRate}%`,
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
      
      // ホバーエフェクト
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
  
    const sortByGradeBtn = createSortButton('📊 学年順', 'grade', this.sortMode === 'grade');
    const sortByStrokesBtn = createSortButton('✏️ 画数順', 'strokes', this.sortMode === 'strokes');
    const sortByMasteryBtn = createSortButton('⭐ 習熟度順', 'mastery', this.sortMode === 'mastery');
  
    centerControls.appendChild(sortByGradeBtn);
    centerControls.appendChild(sortByStrokesBtn);
    centerControls.appendChild(sortByMasteryBtn);
  
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
      const collected = this.dexSet.has(kanjiData.id);
      const prog = (gameState && gameState.kanjiReadProgress && gameState.kanjiReadProgress[kanjiData.id]) || null;
      const isMastered = !!(prog && prog.mastered);
      
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
      
      // 習熟度
      const masteryEl = document.createElement('div');
      masteryEl.className = 'kanji-mastery';
      
      const correctCount = kanjiData.correctCount || 0;
      const incorrectCount = kanjiData.incorrectCount || 0;
      const totalAttempts = correctCount + incorrectCount;
      
      if (totalAttempts > 0) {
        const accuracy = correctCount / totalAttempts;
        const accuracyPercent = Math.round(accuracy * 100);
        
        // 星の数を決定
        let starCount = 1;
        if (accuracy >= 0.9) starCount = 3;
        else if (accuracy >= 0.7) starCount = 2;
        
        // 星アイコンを追加
        for (let i = 0; i < starCount; i++) {
          const star = document.createElement('span');
          star.className = 'mastery-star';
          star.textContent = '⭐';
          masteryEl.appendChild(star);
        }
        
        // 正答率
        const accuracyEl = document.createElement('span');
        accuracyEl.className = 'mastery-accuracy';
        accuracyEl.textContent = `${accuracyPercent}%`;
        masteryEl.appendChild(accuracyEl);
      } else {
        masteryEl.textContent = '未挑戦';
      }
      
      infoContainer.appendChild(masteryEl);
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

    // まずは骨格だけを同期で表示（体感を速く）
    const progressSection = document.createElement('div');
    progressSection.className = 'kanji-reading-progress';
    progressSection.style.margin = '8px 0 12px';
    progressSection.textContent = '読みの進捗を読み込み中…';
    modalContent.appendChild(progressSection);

    const infoSection = document.createElement('div');
    infoSection.className = 'kanji-detail-info';
    modalContent.appendChild(infoSection);

    modalContainer.appendChild(modalContent);
   frag.appendChild(modalContainer);
   document.body.appendChild(frag); // 一括追加でレイアウト1回

        // 重い部分は次フレームに分割して描画（カクつき防止）
        requestAnimationFrame(() => {
          const toArray = v => Array.isArray(v) ? v : (typeof v === 'string' ? v.split(' ').filter(Boolean) : []);
          const prog = (gameState && gameState.kanjiReadProgress && gameState.kanjiReadProgress[k.id]) || null;
          const kunSet = prog?.kunyomi || new Set();
          const onSet  = prog?.onyomi  || new Set();
    
          // 追加: 比較用のひらがな正規化
          const hiraShift = ch => String.fromCharCode(ch.charCodeAt(0) - 0x60);
          const toHiragana = (s) => String(s || '').replace(/[\u30a1-\u30f6]/g, hiraShift);
    
          const makeRow = (label, list, masteredSet) => {
            const row = document.createElement('div');
            row.style.margin = '6px 0';
    
            const header = document.createElement('strong');
            const total = list.length;
            let masteredCount = 0;
            header.textContent = `${label}（${total}）`;
            row.appendChild(header);
    
            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.flexWrap = 'wrap';
            wrap.style.gap = '6px';
            wrap.style.marginTop = '4px';
    
            list.forEach((r) => {
              const chip = document.createElement('span');
              const mastered = masteredSet && masteredSet.has && masteredSet.has(toHiragana(r));
              if (mastered) masteredCount++;
    
              chip.textContent = mastered ? `✓ ${r}` : `○ ${r}`;
              chip.style.display = 'inline-block';
              chip.style.padding = '4px 8px';
              chip.style.borderRadius = '999px';
              chip.style.fontSize = '13px';
    
              if (mastered) {
                chip.style.border = '1px solid #1f4f8d';
                chip.style.background = '#2d6cdf';
                chip.style.color = '#fff';
              } else {
                chip.style.border = '1px dashed rgba(255,255,255,0.6)';
                chip.style.background = 'rgba(255,255,255,0.15)';
                chip.style.color = '#fff';
              }
    
              chip.title = mastered ? '読めた' : '未読';
              wrap.appendChild(chip);
            });
    
            header.textContent = `${label}（${masteredCount}/${total}）`;
            row.appendChild(wrap);
            return row;
          };
    
          progressSection.textContent = '';
    
          const legend = document.createElement('div');
      legend.style.display = 'flex';
      legend.style.gap = '12px';
      legend.style.alignItems = 'center';
      legend.style.margin = '4px 0 8px';
      const mkLegendChip = (text, mastered) => {
        const s = document.createElement('span');
        s.textContent = text;
        s.style.display = 'inline-block';
        s.style.padding = '2px 8px';
        s.style.borderRadius = '999px';
        s.style.fontSize = '12px';
        if (mastered) {
          s.style.background = '#2d6cdf'; s.style.color = '#fff'; s.style.border = '1px solid #1f4f8d';
        } else {
          s.style.background = 'rgba(255,255,255,0.08)'; s.style.color = '#ddd'; s.style.border = '1px solid rgba(255,255,255,0.25)';
        }
        return s;
      };
      legend.appendChild(mkLegendChip('✓ 読めた', true));
      legend.appendChild(mkLegendChip('未読', false));
      progressSection.appendChild(legend);

      progressSection.appendChild(makeRow('音読み', toArray(k.onyomi  || []), onSet));
      progressSection.appendChild(makeRow('訓読み', toArray(k.kunyomi || []), kunSet));
    });
      // 既存の詳細ブロックはここで構築（必要分のみ）
      // 例: 学年/画数/意味など…（既存の infoSection 生成コードをここに移してOK）
    
    //modalContent.appendChild(progressSection);
    
    // 漢字情報
    //const infoSection = document.createElement('div');
    //infoSection.className = 'kanji-detail-info';
    
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
    
    // 学習記録セクション
    const statsSection = document.createElement('div');
    statsSection.className = 'kanji-stats-section';
    
    const statsTitle = document.createElement('h3');
    statsTitle.textContent = '学習記録';
    statsSection.appendChild(statsTitle);
    
    const correctCount = kanjiData.correctCount || 0;
    const incorrectCount = kanjiData.incorrectCount || 0;
    const total = correctCount + incorrectCount;
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    
    // 習熟度レベル
    let masteryLevel = '初心者';
    let masteryColor = '#8B4513';
    if (accuracy >= 90) {
      masteryLevel = 'マスター';
      masteryColor = '#DAA520';
    } else if (accuracy >= 70) {
      masteryLevel = '上級者';
      masteryColor = '#CD853F';
    } else if (accuracy >= 50) {
      masteryLevel = '中級者';
      masteryColor = '#D2B48C';
    }
    
    const masteryEl = document.createElement('p');
    masteryEl.className = 'mastery-level';
    masteryEl.innerHTML = `<strong>習熟度:</strong> <span style="color:${masteryColor}">${masteryLevel}</span>`;
    statsSection.appendChild(masteryEl);
    
    if (total > 0) {
      // 統計情報
      const statsEl = document.createElement('div');
      statsEl.className = 'stats-details';
      
      const attemptsEl = document.createElement('p');
      attemptsEl.innerHTML = `<strong>挑戦回数:</strong> ${total}回`;
      statsEl.appendChild(attemptsEl);
      
      const accuracyEl = document.createElement('p');
      accuracyEl.innerHTML = `<strong>正答率:</strong> ${accuracy}%`;
      statsEl.appendChild(accuracyEl);
      
      // グラフ
      const graphContainer = document.createElement('div');
      graphContainer.className = 'accuracy-graph-container';
      
      const graphEl = document.createElement('div');
      graphEl.className = 'accuracy-graph';
      
      const correctBar = document.createElement('div');
      correctBar.className = 'correct-bar';
      correctBar.style.width = `${accuracy}%`;
      correctBar.textContent = `正解: ${correctCount}`;
      graphEl.appendChild(correctBar);
      
      const incorrectBar = document.createElement('div');
      incorrectBar.className = 'incorrect-bar';
      incorrectBar.style.width = `${100 - accuracy}%`;
      incorrectBar.textContent = `不正解: ${incorrectCount}`;
      graphEl.appendChild(incorrectBar);
      
      graphContainer.appendChild(graphEl);
      statsEl.appendChild(graphContainer);
      
      statsSection.appendChild(statsEl);
    } else {
      const noStatsEl = document.createElement('p');
      noStatsEl.textContent = 'まだ挑戦記録がありません';
      statsSection.appendChild(noStatsEl);
    }
    
    infoSection.appendChild(statsSection);
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
    const collectionRate = Math.round((this.dexSet.size / this.allList.length) * 100);
    if (this.showCollectedOnly) {
      statsText.textContent = `表示中: ${this.filteredList.length} / 収集済: ${this.dexSet.size} (${collectionRate}%)`;
    } else {
      statsText.textContent = `漢字収集率: ${this.dexSet.size}/${this.allList.length} (${collectionRate}%)`;
    }
    progressFill.style.width = `${collectionRate}%`;
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
    publish('stopBGM', 0.2);
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
          const kanjiA = getKanjiById(a);
          const kanjiB = getKanjiById(b);
          
          const correctA = kanjiA.correctCount || 0;
          const incorrectA = kanjiA.incorrectCount || 0;
          const totalA = correctA + incorrectA;
          const accuracyA = totalA > 0 ? correctA / totalA : 0;
          
          const correctB = kanjiB.correctCount || 0;
          const incorrectB = kanjiB.incorrectCount || 0;
          const totalB = correctB + incorrectB;
          const accuracyB = totalB > 0 ? correctB / totalB : 0;
          
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
      this.filteredList = this.allList.filter(id => this.dexSet.has(id));
    } else {
      this.filteredList = [...this.allList];
    }
    // ← 追加: 学年フィルタ
    if (this.gradeFilter !== 'all') {
      this.filteredList = this.filteredList.filter(id => {
        const k = getKanjiById(id);
        return k && k.grade === this.gradeFilter;
      });
    }
  },
  /** フィルタリング状態を切り替え */
  toggleFilter() {
    this.showCollectedOnly = !this.showCollectedOnly;
    this.scroll = 0;
    this.updateFilteredList();
  }
};

export default kanjiDexScreen;

// FSM 一貫化のため描画エントリポイントを alias
kanjiDexScreen.render = function() {
  this.update(0);
};

