// 練習バトル画面 - UI改善版（ボタンレス・統計強化・フィードバック改善）

import battleScreenState from './battleScreen.js';
import { gameState, battleState } from '../core/gameState.js';
import { getKanjiByStageId, isKanjiMastered } from '../loaders/dataLoader.js';
import { publish } from '../core/eventBus.js';
import { images, loadBgImage } from '../loaders/assetsLoader.js';
// 練習バトル画面状態
const practiceBattleScreenState = {
  // 既存のbattleScreenStateの全機能を継承
  ...battleScreenState,
  
  // マスターモード専用のプロパティ
  practiceMode: true,
  onPracticeComplete: null,
  unmasteredKanji: [],
  lastIncorrectAnswer: null,
  recentHistory: [], // 最近の学習履歴（最大10件）
  reviewMode: false,
  reviewTargetReading: null,
  practiceStats: {
    totalPracticed: 0,
    correctCount: 0,
    incorrectCount: 0,
    startTime: Date.now(),
    sessionStreak: 0,
    maxStreak: 0, // セッション中の最高連続正答数
    todaysPracticeCount: 0,
    correctStreak: 0, // 現在の連続正答数
    timePerQuestion: [], // 各問題の解答時間
    lastQuestionTime: Date.now()
  },

    // 成功パーティクル用のプロパティ
    successParticles: {
      active: false,
      particles: [],
      duration: 60
    },
  
        // 進捗バーのアニメーション状態
        progressState: { current: 0, target: 0 },

        // モバイルキーボード状態
        keyboardState: { open: false, bottomInset: 0 },


  // 📐 最適化されたレイアウト設定（ボタンエリア削除後）
  panelConfig: {
    // 前回の漢字パネル（読み表示付きで少し拡大）
    previous: { x: 20, y: 70, w: 260, h: 200 },
        // 現在学習中漢字パネル（右上に移動）
    current: { x: 520, y: 70, w: 260, h: 200 },
    // マスターモードバッジ（上に移動）
    modeBadge: { x: 320, y: 40, w: 160, h: 40 },
    // 拡張マスター進捗パネル（よみ入力の下に配置）
    progress: { x: 100, y: 460, w: 350, h: 70 },
    // 学習履歴パネル（未使用・非表示）
    history: { x: 480, y: 200, w: 300, h: 120 },
    // 操作ガイド（下部中央）
    guide: { x: 230, y: 380, w: 350, h: 50 },

  },

  /**
   * 練習バトル画面への入場処理
   */
  enter(canvasEl, onComplete) {
    console.log('🎯 練習バトル開始:', gameState.currentStageId);
    
    try {
      this.onPracticeComplete = onComplete;
      gameState.gameMode = 'practice';
      
      // 練習統計の初期化
      this.practiceStats.startTime = Date.now();
      this.practiceStats.lastQuestionTime = Date.now();
      this.practiceStats.todaysPracticeCount = this._getTodaysPracticeCount();
      this.recentHistory = []; // 履歴をクリア
      
            // マスターモード専用のハンドラを先に設定
      this._setupPracticeHandlers();
      
      // 通常のバトル画面初期化を実行
      battleScreenState.enter.call(this, canvasEl);

      // 背景画像を必ずステージのものに
      try {
        this.stageBgImage = (images && images[`bg_${gameState.currentStageId}`]) || this.stageBgImage || null;
        if (!this.stageBgImage) {
          loadBgImage(gameState.currentStageId).then(img => { this.stageBgImage = img; });
        }
      } catch {}

      // マスターモード専用のキーハンドラを設定
      this._setupPracticeKeyHandler();
      // 敵関連のみを無効化
      this._disableEnemyElements();
      
            // 未マスター漢字リストを構築
            this._buildUnmasteredKanjiList();

            // 進捗バー初期値
            {
              const stageKanji = getKanjiByStageId(gameState.currentStageId);
              const total = Math.max(1, stageKanji.length);
              this.progressState.current = this.progressState.target = (total - this.unmasteredKanji.length) / total;
            }
      // 最初の未マスター漢字を出題
      this._pickNextUnmasteredKanji();
      
      console.log('📚 マスターモードを開始しました');
      
    } catch (error) {
      console.error('❌ 練習バトル画面の初期化に失敗:', error);
      setTimeout(() => {
        publish('changeScreen', 'stageSelect');
      }, 100);
    }
  },

  /**
   * 今日の練習回数を取得
   */
  _getTodaysPracticeCount() {
    try {
      const today = new Date().toDateString();
      const savedData = JSON.parse(localStorage.getItem('dailyPracticeStats') || '{}');
      return savedData[today] || 0;
    } catch (error) {
      console.warn('今日の練習回数取得エラー:', error);
      return 0;
    }
  },

  /**
   * 今日の練習回数を更新
   */
  _updateTodaysPracticeCount() {
    try {
      const today = new Date().toDateString();
      const savedData = JSON.parse(localStorage.getItem('dailyPracticeStats') || '{}');
      savedData[today] = (savedData[today] || 0) + 1;
      localStorage.setItem('dailyPracticeStats', JSON.stringify(savedData));
      this.practiceStats.todaysPracticeCount = savedData[today];
    } catch (error) {
      console.warn('今日の練習回数更新エラー:', error);
    }
  },

  /**
   * マスターモード専用のハンドラを設定
   */
  _setupPracticeHandlers() {
    console.log('🔧 マスターモード用ハンドラを設定中...');
    
    try {
      this._originalHandleAttack = this.handleAttack;
      this._originalHandleHeal = this.handleHeal;
      this._originalHandleHint = this.handleHint;
      
      this.handleAttack = () => {
        console.log('🎯 マスターモード handleAttack');
        this.handlePracticeAnswer();
      };
      
      this.handleHeal = () => {
        console.log('💚 マスターモード handleHeal - 同じ処理');
        this.handlePracticeAnswer();
      };
      
      this.handleHint = () => {
        console.log('💡 マスターモード handleHint');
        this.handlePracticeHint();
      };
      
      console.log('✅ マスターモード用ハンドラ設定完了');
      
    } catch (error) {
      console.error('❌ ハンドラ設定エラー:', error);
    }
  },

  /**
   * マスターモード専用のキーボードハンドラを設定
   */
  _setupPracticeKeyHandler() {
    console.log('🔧 マスターモード専用キーハンドラを設定中...');
    
    try {
      if (!this.inputEl) {
        console.warn('⚠️ 入力欄が見つかりません');
        return;
      }
      
      this._practiceKeydownHandler = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          console.log('⌨️ Enterキー押下 - 解答実行');
          this.handlePracticeAnswer();
        } else if (e.key === ' ') {
          e.preventDefault();
          console.log('⌨️ スペースキー押下 - ヒント表示');
          this.handlePracticeHint();
        }
      };
      
      if (this._keydownHandler) {
        this.inputEl.removeEventListener('keydown', this._keydownHandler);
      }
      this.inputEl.addEventListener('keydown', this._practiceKeydownHandler);

      // モバイル入力最適化（iOS向け）
      this.inputEl.setAttribute('inputmode', 'kana');
      this.inputEl.setAttribute('autocapitalize', 'off');
      this.inputEl.setAttribute('autocorrect', 'off');
      this.inputEl.setAttribute('spellcheck', 'false');

      // キーボード追従とスクロール抑止をセットアップ
      this._setupMobileViewportWorkarounds();
      
      console.log('✅ キーハンドラ設定完了');
      
    } catch (error) {
      console.error('❌ キーハンドラ設定エラー:', error);
    }
  },

  /**
   * 敵関連の要素のみを無効化
   */
  _disableEnemyElements() {
    try {
      gameState.currentEnemy = null;
      gameState.enemies = [];
      gameState.currentEnemyIndex = 0;
      
      gameState.playerStats.hp = gameState.playerStats.maxHp;
      
      battleState.turn = 'player';
      battleState.inputEnabled = true;
      battleState.comboCount = 0;
      
      console.log('🚫 敵要素を無効化しました');
      
    } catch (error) {
      console.error('❌ 敵要素無効化エラー:', error);
    }
  },

     /**
   * モバイルのキーボード可視領域に追従＆スクロール抑止
   */
     _setupMobileViewportWorkarounds() {
      try {
        const el = this.inputEl;
        if (!el) return;
  
        // Virtual Keyboard API を優先（Chrome/Android/一部Chrome系）
        try {
          if (navigator.virtualKeyboard) {
            navigator.virtualKeyboard.overlaysContent = true;
            this._vkGeometryHandler = (e) => {
              try {
                const vk = e?.target || navigator.virtualKeyboard;
                const r = vk && vk.boundingRect;
                // 高さベースに修正（非表示時は0）
                const inset = r ? Math.max(0, r.height) : 0;
                this.keyboardState.bottomInset = inset;
                this.keyboardState.open = inset > 30;
                this._adjustInputPosition();
              } catch {}
            };
            navigator.virtualKeyboard.addEventListener('geometrychange', this._vkGeometryHandler);
          }
        } catch {}
  
        const setScrollPadding = (enable) => {
          const html = document.documentElement;
          const body = document.body;
          if (enable) {
            this._prevBodyStyles = this._prevBodyStyles || {
              htmlOverflowY: html.style.overflowY,
              bodyOverflowY: body.style.overflowY,
              bodyPaddingBottom: body.style.paddingBottom,
              htmlOverscroll: html.style.overscrollBehaviorY,
              bodyOverscroll: body.style.overscrollBehaviorY
            };
            html.style.overflowY = 'auto';
            body.style.overflowY = 'auto';
            html.style.overscrollBehaviorY = 'contain';
            body.style.overscrollBehaviorY = 'contain';
            const vv = window.visualViewport;
            const inset = vv ? Math.max(0, (window.innerHeight - vv.height - vv.offsetTop)) : 0;
            const pad = Math.max(220, inset + 220);
            body.style.paddingBottom = `${pad}px`;
          } else {
            const s = this._prevBodyStyles || {};
            document.documentElement.style.overflowY = s.htmlOverflowY || '';
            document.body.style.overflowY = s.bodyOverflowY || '';
            document.documentElement.style.overscrollBehaviorY = s.htmlOverscroll || '';
            document.body.style.overscrollBehaviorY = s.bodyOverscroll || '';
            document.body.style.paddingBottom = s.bodyPaddingBottom || '';
            this._prevBodyStyles = null;
          }
        };
  
        const scrollCanvasTopIntoView = () => {
          try {
            const r = this.canvas && this.canvas.getBoundingClientRect && this.canvas.getBoundingClientRect();
            if (!r) return;
            const base = (window.pageYOffset || document.documentElement.scrollTop || 0);
            const y = Math.max(0, base + r.top - 12);
            window.scrollTo(0, y);
          } catch {}
        };
  
        const scheduleScrollCorrections = () => {
          const times = [0, 60, 120, 240, 360];
          this._focusScrollTimers = this._focusScrollTimers || [];
          times.forEach(t => {
            const id = setTimeout(() => { if (this.keyboardState.open) scrollCanvasTopIntoView(); }, t);
            this._focusScrollTimers.push(id);
          });
        };
  
        const applyByViewport = () => {
          const vv = window.visualViewport;
          if (!vv) return;
          const bottomInset = Math.max(0, (window.innerHeight - vv.height - vv.offsetTop));
          this.keyboardState.bottomInset = bottomInset;
          this.keyboardState.open = bottomInset > 30;
          if (this.keyboardState.open) {
            setScrollPadding(true);
            this._adjustInputPosition();
            scrollCanvasTopIntoView();
          }
        };
  
        this._vvResizeHandler = () => { applyByViewport(); };
        this._vvScrollHandler = () => { if (this.keyboardState.open) scrollCanvasTopIntoView(); };
        if (window.visualViewport) {
          window.visualViewport.addEventListener('resize', this._vvResizeHandler);
          window.visualViewport.addEventListener('scroll', this._vvScrollHandler);
        }
  
        this._focusHandler = () => {
          applyByViewport();
          scheduleScrollCorrections();
        };
        this._blurHandler = () => {
          this.keyboardState.open = false;
          this.keyboardState.bottomInset = 0;
          setScrollPadding(false);
          this._adjustInputPosition();
          if (Array.isArray(this._focusScrollTimers)) {
            this._focusScrollTimers.forEach(id => { try { clearTimeout(id); } catch {} });
            this._focusScrollTimers = [];
          }
        };
  
        el.addEventListener('focus', this._focusHandler);
        el.addEventListener('blur', this._blurHandler);
      } catch (e) {
        console.warn('⚠️ ビューポート調整の初期化に失敗:', e);
      }
    },

    /**
   * 未マスターの漢字リストを構築
   */
    _buildUnmasteredKanjiList() {
      try {
        const stageId = gameState.currentStageId;
        if (gameState.stageReviewUnlocked && gameState.stageReviewUnlocked[stageId]) {
          this.unmasteredKanji = [];
          console.log('🔓 このステージはレビュー解放済みとして未マスター0件で扱います');
          return;
        }
  
        const stageKanji = getKanjiByStageId(gameState.currentStageId);
        this.unmasteredKanji = stageKanji.filter(kanji => {
          try {
            return !isKanjiMastered(kanji.id);
          } catch (error) {
            console.warn('⚠️ マスター判定エラー:', kanji.id, error);
            return true;
          }
        });
        
        console.log(`📚 未マスター漢字: ${this.unmasteredKanji.length}件 / 全${stageKanji.length}件`);
        
        if (this.unmasteredKanji.length === 0) {
          this._showAllMasteredMessage();
        }
        
      } catch (error) {
        console.error('❌ 未マスターリスト構築エラー:', error);
        this.unmasteredKanji = [];
      }
    },

  /**
   * 次の未マスター漢字を出題
   */
  _pickNextUnmasteredKanji() {
    try {
      // ここで未マスターリストを再構築しない（進捗が0に戻るのを防止）
      if (this.unmasteredKanji.length === 0) {
        // 全マスター後はレビューモードへ移行し、以降は○で隠した読みのみを出題
        if (!this.reviewMode) {
          this._enterReviewMode();
        } else {
          this._pickNextReviewQuestion();
        }
        return;
      }
      
      const randomIndex = Math.floor(Math.random() * this.unmasteredKanji.length);
      const selectedKanji = this.unmasteredKanji[randomIndex];
      
      const processReadings = (readings) => {
        try {
          if (!readings) return [];
          if (Array.isArray(readings)) {
            return readings.map(r => this._toHiragana(String(r).trim())).filter(Boolean);
          } else if (typeof readings === 'string') {
            return readings.split(' ').map(r => this._toHiragana(r.trim())).filter(Boolean);
          }
          return [];
        } catch (error) {
          console.warn('⚠️ 読み処理エラー:', error);
          return [];
        }
      };

      gameState.currentKanji = {
        id: selectedKanji.id,
        text: selectedKanji.kanji,
        kunyomi: processReadings(selectedKanji.kunyomi),
        onyomi: processReadings(selectedKanji.onyomi),
        meaning: selectedKanji.meaning || '',
        strokes: selectedKanji.strokes || 0,
        radical: selectedKanji.radical || '',
        jlpt: selectedKanji.jlpt || '',
      };
      
      gameState.hintLevel = 0;
      
      // 問題開始時間を記録
      this.practiceStats.lastQuestionTime = Date.now();
      
      if (!Array.isArray(battleState.log)) battleState.log = [];
      
      console.log(`📝 新しい問題: ${selectedKanji.kanji} (ID: ${selectedKanji.id})`);
      
    } catch (error) {
      console.error('❌ 漢字選択エラー:', error);
      // エラー時もレビューモードへ退避
      if (!this.reviewMode) this._enterReviewMode();
    }
  },

    /**
   * 全マスター後のレビューモード開始
   * 以降は常にどれか1つの読みを○で隠して出題する
   */
    _enterReviewMode() {
      try {
        this.reviewMode = true;
        if (!gameState.stageReviewUnlocked) gameState.stageReviewUnlocked = {};
        gameState.stageReviewUnlocked[gameState.currentStageId] = true;
        console.log('🔁 レビューモードに移行（○で隠した読みを1つだけ出題）');
        this._pickNextReviewQuestion();
      } catch (error) {
        console.error('❌ レビューモード移行エラー:', error);
      }
    },
  
    /**
     * レビューモード用の次問題選択
     */
    _pickNextReviewQuestion() {
      try {
        const stageKanji = getKanjiByStageId(gameState.currentStageId) || [];
        if (stageKanji.length === 0) {
          console.warn('⚠️ このステージに漢字がありません');
          return;
        }
  
        // ランダムに漢字選択
        const selectedKanji = stageKanji[Math.floor(Math.random() * stageKanji.length)];
  
        const normalizeReadings = (readings) => {
          try {
            if (!readings) return [];
            if (Array.isArray(readings)) {

              return readings.map(r => this._toHiragana(String(r).trim())).filter(Boolean);
            } else if (typeof readings === 'string') {
              return readings.split(' ').map(r => this._toHiragana(r.trim())).filter(Boolean);
            }
            return [];
          } catch (e) {
            return [];
          }
        };
  
        
        gameState.currentKanji = {
          id: selectedKanji.id,
          text: selectedKanji.kanji,
          kunyomi: normalizeReadings(selectedKanji.kunyomi),
          onyomi: normalizeReadings(selectedKanji.onyomi),
          meaning: selectedKanji.meaning || '',
          strokes: selectedKanji.strokes || 0,
          radical: selectedKanji.radical || '',
          jlpt: selectedKanji.jlpt || '',
        };
  
        // マスク対象の読みを1つ決定
        const allReadings = this._getReadings(gameState.currentKanji);
        if (allReadings.length === 0) {
          console.warn('⚠️ 読みが存在しない漢字のためスキップ');
          return this._pickNextReviewQuestion();
        }
        this.reviewTargetReading = allReadings[Math.floor(Math.random() * allReadings.length)];
  
        gameState.hintLevel = 0;
        this.practiceStats.lastQuestionTime = Date.now();
  
        console.log(`📝 レビュー問題: ${gameState.currentKanji.text}（隠し読み: ${this.reviewTargetReading}）`);
      } catch (error) {
        console.error('❌ レビュー問題選択エラー:', error);
      }
    },
  /**
   * マスターモード専用解答処理（統合）
   */
  handlePracticeAnswer() {
    console.log('🎯 マスターモード解答処理開始');
    
    try {
      if (battleState.turn !== 'player' || !battleState.inputEnabled) {
        return;
      }
      
      const inputEl = this.inputEl;
      if (!inputEl) {
        console.log('❌ 入力欄なし');
        return;
      }
      
      const raw = inputEl.value.trim();
      if (!raw) {
        console.log('❌ 入力が空');
        return;
      }
      
      console.log('📝 入力値:', raw);
      
      battleState.inputEnabled = false;
      
      const answer = this._toHiragana(raw);
      console.log('📝 変換後:', answer);
      
      if (!gameState.currentKanji) {
        console.log('❌ 現在の漢字なし');
        battleState.inputEnabled = true;
        return;
      }
      
      // 解答時間を計算
      const answerTime = Date.now() - this.practiceStats.lastQuestionTime;
      this.practiceStats.timePerQuestion.push(answerTime);
      
      const correctReadings = this._getReadings(gameState.currentKanji);
        const isCorrect = this.reviewMode
          ? (answer === this.reviewTargetReading)
          : correctReadings.includes(answer);
      
      console.log('📚 正解読み:', correctReadings);
      console.log('🎯 判定:', isCorrect ? '✅正解' : '❌不正解');
      
      this.practiceStats.totalPracticed++;
      this._updateTodaysPracticeCount();
      inputEl.value = '';
      
      // 履歴に追加
      this._addToHistory(gameState.currentKanji, answer, isCorrect, answerTime);
      
      if (isCorrect) {
        this.practiceStats.correctStreak++;
        this.practiceStats.maxStreak = Math.max(this.practiceStats.maxStreak, this.practiceStats.correctStreak);
        this._handlePracticeCorrect(answer);
      } else {
        this.practiceStats.correctStreak = 0;
        this._handlePracticeIncorrect(answer);
      }
      
    } catch (error) {
      console.error('❌ 解答処理エラー:', error);
      battleState.inputEnabled = true;
      if (this.inputEl) this.inputEl.value = '';
    }
  },

  /**
   * 学習履歴に追加
   */
  _addToHistory(kanji, answer, isCorrect, answerTime) {
    const historyItem = {
      kanji: kanji.text,
      kanjiId: kanji.id,
      answer: answer,
      isCorrect: isCorrect,
      answerTime: answerTime,
      timestamp: Date.now()
    };
    
    this.recentHistory.unshift(historyItem);
    
    // 最大10件まで保持
    if (this.recentHistory.length > 10) {
      this.recentHistory.pop();
    }
  },

  /**
   * マスターモード専用ヒント処理
   */
  handlePracticeHint() {
    console.log('💡 マスターモードヒント処理開始');
    
    try {
      if (!gameState.currentKanji) return;
      
      const current = Number(gameState.hintLevel || 0);
      if (current >= 4) {
        return;
      }
      
      const level = current + 1;
      gameState.hintLevel = level;
      
      console.log(`💡 ヒントレベル${level}を表示`);
      
    } catch (error) {
      console.error('❌ ヒント処理エラー:', error);
    }
  },

  /**
   * 練習での正解処理
   */
  _handlePracticeCorrect(answer) {
    console.log('✅ 正解処理開始');
    
    try {
      this.practiceStats.correctCount++;
      
      // 前回の答えを保存
      battleState.lastAnswered = { 
        ...gameState.currentKanji,
        correctAnswer: answer
      };
      
      // 不正解記録をクリア
      this.lastIncorrectAnswer = null;
      
      // 強化されたエフェクト
      if (this.startKanjiBoxEffect) {
        this.startKanjiBoxEffect('rgba(46, 204, 113, 0.9)', 30);
      }
      
      // 成功パーティクルエフェクト開始
      this.startSuccessParticles();
      
            // 石版攻撃エフェクト
            if (this.startStoneAttackEffect && this.canvas) {
              const { centerX, centerY, width, height } = this.getKanjiBoxMetrics ? this.getKanjiBoxMetrics() : { centerX: this.canvas.width/2, centerY: (this.keyboardState?.open ? 120 : 200), width: (this.keyboardState?.open ? 160 : 180), height: (this.keyboardState?.open ? 140 : 160) };
              this.startStoneAttackEffect(centerX, centerY, width, height);
            }
            
            publish('playSE', 'correct');
            // ← 追加: 正解時に図鑑へ登録（重複は内部で無視される）
            publish('addToKanjiDex', gameState.currentKanji.id);
            
            
      
      const wasAlreadyMastered = this._isKanjiMastered(gameState.currentKanji.id);
      this._updateKanjiMasteryAfterCorrect(gameState.currentKanji, answer);
      const isNowMastered = this._isKanjiMastered(gameState.currentKanji.id);
      
      if (!wasAlreadyMastered && isNowMastered) {
        this.unmasteredKanji = this.unmasteredKanji.filter(k => k.id !== gameState.currentKanji.id);
        console.log(`🎉 漢字「${gameState.currentKanji.text}」が新しくマスターされました！`);
        console.log(`📚 残り未マスター漢字: ${this.unmasteredKanji.length}件`);

        // 進捗バーの目標値を更新（即時反映はアニメーションで）
        const stageKanjiAll = getKanjiByStageId(gameState.currentStageId);
        const total = Math.max(1, stageKanjiAll.length);
        this.progressState.target = (total - this.unmasteredKanji.length) / total;
      }
      
      console.log(`✅ 正解: ${gameState.currentKanji.text} = ${answer}`);
      
      setTimeout(() => {
        this._pickNextUnmasteredKanji();
        battleState.turn = 'player';
        battleState.inputEnabled = true;
      }, 1000);
      
    } catch (error) {
      console.error('❌ 正解処理エラー:', error);
      battleState.inputEnabled = true;
    }
  },

  /**
   * 練習での不正解処理
   */
  _handlePracticeIncorrect(answer) {
    console.log('❌ 不正解処理開始');
    
    try {
      this.practiceStats.incorrectCount++;
      
      this.lastIncorrectAnswer = answer;
      battleState.lastAnswered = { 
        ...gameState.currentKanji,
        incorrectAnswer: answer
      };
      
      publish('playSE', 'wrong');
      
      console.log(`❌ 不正解: ${gameState.currentKanji.text} ≠ ${answer}`);
      
      setTimeout(() => {
        battleState.turn = 'player';
        battleState.inputEnabled = true;
      }, 1000);
      
    } catch (error) {
      console.error('❌ 不正解処理エラー:', error);
      battleState.inputEnabled = true;
    }
  },

  /**
   * 成功パーティクルエフェクトを開始
   */
  startSuccessParticles() {
    this.successParticles.active = true;
    this.successParticles.particles = [];
    
    const centerX = this.canvas.width / 2;
    const centerY = 200;
    
    // パーティクルを生成
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      const speed = 3 + Math.random() * 2;
      
      this.successParticles.particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 40 + Math.random() * 20,
        size: 3 + Math.random() * 3,
        color: `hsl(${120 + Math.random() * 60}, 100%, ${60 + Math.random() * 30}%)`,
        alpha: 1
      });
    }
  },

  /**
   * マウスクリック処理（マスターモード専用にオーバーライド）
   */
  handleClick(e) {
    console.log('🖱️ マスターモードクリック処理');

    try {
      e.preventDefault();

      let eventX, eventY;
      if (e.changedTouches) {
        eventX = e.changedTouches[0].clientX;
        eventY = e.changedTouches[0].clientY;
      } else {
        eventX = e.clientX;
        eventY = e.clientY;
      }

      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const x = (eventX - rect.left) * scaleX;
      const y = (eventY - rect.top) * scaleY;

      const BTN = {
        stage:  { x: 140, y: 20,  w: 120, h: 30 },
      };

      const isMouseOverRect = (mx, my, rect) => {
        return mx >= rect.x && mx <= rect.x + rect.w && 
               my >= rect.y && my <= rect.y + rect.h;
      };

      if (isMouseOverRect(x, y, BTN.stage)) {
        console.log('🗺️ ステージ選択へ');
        publish('playBGM', 'title');
        const targetScreen = (gameState.previousScreen === 'worldStageSelect') ? 'worldStageSelect' : 'stageSelect';
        publish('changeScreen', targetScreen);
        return true;
      }

      return false;
      
    } catch (error) {
      console.error('❌ クリック処理エラー:', error);
      return false;
    }
  },

  /**
   * 画面の描画更新（ボタンなし版）
   */
  update(dt) {
    try {
      const originalEnemy = gameState.currentEnemy;
      const originalEnemies = gameState.enemies;
      
      gameState.currentEnemy = null;
      gameState.enemies = [];
      
      // 最小限のバトルUI描画
      this._drawMinimalBattleUI(dt);
      
      // 🎨 改善されたUIを描画
      this._hideEnemyAndPlayerUIAreas();
      this._drawImprovedPracticeUI();
      
      gameState.currentEnemy = originalEnemy;
      gameState.enemies = originalEnemies;
      
    } catch (error) {
      console.error('❌ 描画更新エラー:', error);
    }
  },

  /**
   * 最小限のバトルUI描画（ボタンなし）
   */
  _drawMinimalBattleUI(dt) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // ① 背景描画
    if (this.stageBgImage) {
      this.ctx.drawImage(this.stageBgImage, 0, 0, this.canvas.width, this.canvas.height);
    } else {
      const grad = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
      grad.addColorStop(0, '#1e3c72');
      grad.addColorStop(1, '#2a5298');
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

        // ② 上部ボタン描画（ステージ選択のみ）
        const BTN = {
          stage:  { x: 40, y: 20,  w: 220, h: 30,  label: 'ステージ選択（もどる）' },
        };
        [BTN.stage].forEach(b => {
          const isHovered = this.mouseX && this.mouseY ? 
            (this.mouseX >= b.x && this.mouseX <= b.x + b.w && this.mouseY >= b.y && this.mouseY <= b.y + b.h) : false;
          this.ctx.fillStyle = isHovered ? '#4e6d8c' : '#34495e';
          this.ctx.fillRect(b.x, b.y, b.w, b.h);
          this.ctx.fillStyle = 'white';
          this.ctx.font = '16px "UDデジタル教科書体", sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'middle';
          this.ctx.fillText(b.label, b.x + b.w/2, b.y + b.h/2);
          this.ctx.strokeStyle = 'white';
          this.ctx.lineWidth = 2;
          this.ctx.strokeRect(b.x, b.y, b.w, b.h);
        });

    // ③ 漢字ボックス描画
    this._drawKanjiBoxWithEffects();

    // ④ エフェクト更新
    this._updateEffects();

    // ⑤ 成功パーティクルの更新と描画
    if (this.successParticles.active) {
      this._updateSuccessParticles();
    }
  },

  /**
   * 漢字ボックスをエフェクト付きで描画
   */
  _drawKanjiBoxWithEffects() {
    const isKbOpen = !!(this.keyboardState && this.keyboardState.open);
    const kanjiX = this.canvas.width / 2;

    //　入力中は上に寄せて少し縮小
    const kanjiY = isKbOpen ? 120 : 200;
    const baseW = isKbOpen ? 160 : 180;
    const baseH = isKbOpen ? 140 : 160;
    
    let offsetX = 0, offsetY = 0, alpha = 1;
    let boxScale = 1.0;
    let borderColor = 'rgba(255, 255, 255, 0.5)';
    let borderWidth = 2;

    // シェイクエフェクトの処理
    if (this.shakeEffect && this.shakeEffect.active) {
      const intensity = this.shakeEffect.intensity * (this.shakeEffect.timer / this.shakeEffect.duration);
      offsetX = (Math.random() * 2 - 1) * intensity;
      offsetY = (Math.random() * 2 - 1) * intensity;
    }

    // 漢字ボックスエフェクトの処理
    if (this.kanjiBoxEffect && this.kanjiBoxEffect.active) {
      this.kanjiBoxEffect.pulsePhase += 0.2;
      
      const progress = 1 - (this.kanjiBoxEffect.timer / this.kanjiBoxEffect.duration);
      const pulseValue = Math.sin(this.kanjiBoxEffect.pulsePhase) * 0.5 + 0.5;
      boxScale = 1 + (this.kanjiBoxEffect.maxScale - 1) * pulseValue * (1 - progress);
      
      borderColor = this.kanjiBoxEffect.color;
      borderWidth = 4;
    }

    const kanjiBoxW = baseW;
    const kanjiBoxH = baseH;
    const scaledW = kanjiBoxW * boxScale;
    const scaledH = kanjiBoxH * boxScale;
    const adjustedX = kanjiX - (scaledW / 2) + offsetX;
    const adjustedY = kanjiY - (scaledH / 2) + offsetY;

    // 石版パネル描画
    if (typeof drawStonePanel === 'function') {
      drawStonePanel(this.ctx, adjustedX, adjustedY, scaledW, scaledH);
    } else {
      this.ctx.fillStyle = 'rgba(50, 50, 60, 0.85)';
      this.ctx.fillRect(adjustedX, adjustedY, scaledW, scaledH);
      this.ctx.strokeStyle = borderColor;
      this.ctx.lineWidth = borderWidth;
      this.ctx.strokeRect(adjustedX, adjustedY, scaledW, scaledH);
    }

    // 漢字表示
    if (gameState.currentKanji) {
      this.ctx.font = `${80 * boxScale}px serif`;
      this.ctx.fillStyle = 'white';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      this.ctx.shadowBlur = 5;
      this.ctx.shadowOffsetX = 3 * boxScale;
      this.ctx.shadowOffsetY = 3 * boxScale;
      this.ctx.fillText(gameState.currentKanji.text, adjustedX + scaledW / 2, adjustedY + scaledH / 2);
      this.ctx.shadowColor = 'transparent';
      this.ctx.shadowBlur = 0;
      this.ctx.shadowOffsetX = 0;
      this.ctx.shadowOffsetY = 0;
    }

    // 石版攻撃エフェクト
    if (this.stoneAttackEffect && this.stoneAttackEffect.active) {
      this.drawStoneAttackEffect(adjustedX, adjustedY, scaledW, scaledH);
    }
  },

  /**
   * エフェクトの更新
   */
  _updateEffects() {
    if (this.kanjiBoxEffect && this.kanjiBoxEffect.active) {
      this.kanjiBoxEffect.timer--;
      if (this.kanjiBoxEffect.timer <= 0) {
        this.kanjiBoxEffect.active = false;
      }
    }

    if (this.shakeEffect && this.shakeEffect.active) {
      this.shakeEffect.timer--;
      if (this.shakeEffect.timer <= 0) {
        this.shakeEffect.active = false;
      }
    }

    if (this.stoneAttackEffect && this.stoneAttackEffect.active) {
      this.updateStoneAttackEffect();
    }

    // 進捗バーのイージング更新（描画でも追従するが、ここでも補助）
    if (this.progressState) {
      this.progressState.current += (this.progressState.target - this.progressState.current) * 0.06;
    }
  },

  /**
   * 成功パーティクルの更新
   */
  _updateSuccessParticles() {
    if (!this.successParticles.active) return;

    let activeCount = 0;
    
    for (let i = this.successParticles.particles.length - 1; i >= 0; i--) {
      const particle = this.successParticles.particles[i];
      
      particle.life++;
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.1; // 重力
      
      // フェードアウト
      const lifeRatio = particle.life / particle.maxLife;
      particle.alpha = Math.max(0, 1 - lifeRatio);
      
      // パーティクル描画
      this.ctx.save();
      this.ctx.globalAlpha = particle.alpha;
      this.ctx.fillStyle = particle.color;
      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
      
      // 寿命チェック
      if (particle.life >= particle.maxLife) {
        this.successParticles.particles.splice(i, 1);
      } else {
        activeCount++;
      }
    }
    
    // 全パーティクルが消えたらエフェクト終了
    if (activeCount === 0) {
      this.successParticles.active = false;
    }
  },

  /**
   * 敵・プレイヤーUIエリアを隠す
   */
  _hideEnemyAndPlayerUIAreas() {
    if (!this.ctx) return;
    
    try {
      this.ctx.save();

      const fillArea = (x, y, w, h) => {
        // 背景全体を一度描画済みなので、同じ比率で背景の該当箇所を切り出す
        if (this.stageBgImage) {
          const img = this.stageBgImage;
          const sx = img.width  * (x / this.canvas.width);
          const sy = img.height * (y / this.canvas.height);
          const sw = img.width  * (w / this.canvas.width);
          const sh = img.height * (h / this.canvas.height);
          this.ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
        } else {
          const bgGradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
          bgGradient.addColorStop(0, '#1e3c72');
          bgGradient.addColorStop(1, '#2a5298');
          this.ctx.fillStyle = bgGradient;
          this.ctx.fillRect(x, y, w, h);
        }
      };

      // 敵エリアとプレイヤーエリアを背景で"埋め戻し"して歪みを防ぐ
      fillArea(480, 80, 280, 200);
      fillArea(500, 10, 280, 120);
      fillArea(20, 500, 280, 100);

      this.ctx.restore();
      
    } catch (error) {
      console.error('❌ UIエリア隠しエラー:', error);
    }
  },

  /**
   * 🎨 改善されたUIを描画
   */
  _drawImprovedPracticeUI() {
    try {
      this._drawPreviousKanjiPanelWithReadings();  // 前回漢字（読み付き）
      this._drawCurrentKanjiDetailPanel();         // 現在漢字詳細
      this._drawEnhancedProgressPanel();           // 進捗パネル（簡素）
      if (this.reviewMode) {
        this._drawReviewModeBadge();               // レビューモードバッジ（オレンジ）
      } else {
        this._drawPracticeModeBadge();             // マスターモードバッジ（緑）
      }
      this._drawOperationGuide();                  // 操作ガイド（ボタンの代替）
      // this._drawLearningHistoryPanel();          // 学習履歴パネル（非表示）
      this._drawDetailedStats();                 // 詳細統計（必要に応じて）
    } catch (error) {
      console.error('❌ 改善UI描画エラー:', error);
    }
  },

  /**
   * 📖 前回漢字パネル（正確な読み表示付き）
   */
  _drawPreviousKanjiPanelWithReadings() {
    if (!this.ctx || !battleState.lastAnswered) return;
    
    try {
      const { x, y, w, h } = this.panelConfig.previous;
      
      this._drawPanelBackground(this.ctx, x, y, w, h, 'stone');

      this.ctx.fillStyle = 'white';
      this.ctx.textAlign = 'center';
      
      // タイトル
      this.ctx.font = 'bold 14px "UDデジタル教科書体",sans-serif';
      this.ctx.fillText('前回の漢字', x + w/2, y + 18);
      
      // 漢字本体
      this.ctx.font = '48px serif';
      this.ctx.fillText(battleState.lastAnswered.text, x + w/2, y + 70);

      // 基本情報
      this.ctx.font = '12px "UDデジタル教科書体",sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.fillStyle = 'white';
      
      let infoY = y + 100;
      
      // 画数
      this.ctx.fillText(`画数: ${battleState.lastAnswered.strokes}画`, x + 10, infoY);
      infoY += 16;
      
      

       // 正確な読み表示
      this.ctx.fillStyle = '#e8f5e8';
      this.ctx.fillText('正しい読み:', x + 10, infoY);
      infoY += 16;

            // 読みを色分けして描画（読了=鮮色、未読=グレー）
            const rawProg = gameState.kanjiReadProgress && gameState.kanjiReadProgress[battleState.lastAnswered.id];
            const prog = rawProg || {};
            const onySet = (prog.onyomi instanceof Set) ? prog.onyomi : new Set((prog.onyomi || []));
            const kunSet = (prog.kunyomi instanceof Set) ? prog.kunyomi : new Set((prog.kunyomi || []));
      
            const drawColoredList = (label, arr, learnedSet, learnedColor, unlearnedColor) => {
              if (!arr || arr.length === 0) return;
              this.ctx.textAlign = 'left';
              this.ctx.fillStyle = '#e0e0e0';
              this.ctx.fillText(label, x + 10, infoY);
              let tx = x + 35;
              for (let i = 0; i < arr.length; i++) {
                const r = arr[i];
                const learned = learnedSet && learnedSet.has(r);
                this.ctx.fillStyle = learned ? learnedColor : '#95a5a6';
                const text = i < arr.length - 1 ? `${r}、` : r;
                this.ctx.fillText(text, tx, infoY);
                tx += this.ctx.measureText(text).width + 2;
              }
              infoY += 16;
            };
      
            drawColoredList('音:', (battleState.lastAnswered.onyomi || []), onySet, '#f1c40f', '#95a5a6');
            drawColoredList('訓:', (battleState.lastAnswered.kunyomi || []), kunSet, '#2ecc71', '#95a5a6');
      // あなたの答え表示
      if (battleState.lastAnswered.correctAnswer) {
        // 正解した場合
        this.ctx.fillStyle = 'rgba(46, 204, 113, 0.3)';
        this.ctx.fillRect(x + 8, y + h - 30, w - 16, 22);
        this.ctx.strokeStyle = '#2ecc71';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x + 8, y + h - 30, w - 16, 22);
        
        this.ctx.fillStyle = '#2ecc71';
        this.ctx.font = 'bold 11px "UDデジタル教科書体",sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`あなたの答え: ${battleState.lastAnswered.correctAnswer}`, x + w/2, y + h - 16);
      } else if (this.lastIncorrectAnswer) {
        // 不正解した場合
        this.ctx.fillStyle = 'rgba(231, 76, 60, 0.3)';
        this.ctx.fillRect(x + 8, y + h - 30, w - 16, 22);
        this.ctx.strokeStyle = '#e74c3c';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x + 8, y + h - 30, w - 16, 22);
        
        this.ctx.fillStyle = '#e74c3c';
        this.ctx.font = 'bold 11px "UDデジタル教科書体",sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`あなたの答え: ${this.lastIncorrectAnswer}`, x + w/2, y + h - 16);
      }


      // MASTERバッジ
      const badgeProg = gameState.kanjiReadProgress && gameState.kanjiReadProgress[battleState.lastAnswered.id];
      if (badgeProg && badgeProg.mastered) {
        this._drawMasterBadge(this.ctx, x + w - 8, y + 8);
      }
      
    } catch (error) {
      console.error('❌ 前回漢字パネル描画エラー:', error);
    }
  },

  /**
   * 📚 現在学習中漢字の詳細パネル
   */
  _drawCurrentKanjiDetailPanel() {
    if (!this.ctx || !gameState.currentKanji) return;
    
    try {
      const { x, y, w, h } = this.panelConfig.current;
      
      this._drawPanelBackground(this.ctx, x, y, w, h, 'stone');

      this.ctx.fillStyle = 'white';
      this.ctx.textAlign = 'center';
      
      // タイトル
      this.ctx.font = 'bold 14px "UDデジタル教科書体",sans-serif';
      this.ctx.fillText('学習中の漢字', x + w/2, y + 18);
      
      // 漢字本体
      this.ctx.font = '38px serif';
      this.ctx.fillText(gameState.currentKanji.text, x + w/2, y + 60);

      // 詳細情報
      this.ctx.font = '12px "UDデジタル教科書体",sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.fillStyle = 'white';
      
      let infoY = y + 85;
      
      // 画数
      this.ctx.fillText(`画数: ${gameState.currentKanji.strokes}画`, x + 12, infoY);
      infoY += 16;
      
      
      
      // 部首
      if (gameState.currentKanji.radical) {
        this.ctx.fillText(`部首: ${gameState.currentKanji.radical}`, x + 12, infoY);
        infoY += 16;
      }
      
            // JLPTレベル
            if (gameState.currentKanji.jlpt) {
              this.ctx.fillText(`JLPT: ${gameState.currentKanji.jlpt}`, x + 12, infoY);
              infoY += 16;
            }
      
            // 読み（既習は表示、未習は○で隠す）
            const rawProg = gameState.kanjiReadProgress && gameState.kanjiReadProgress[gameState.currentKanji.id];
            const prog = rawProg || {};
            const onySet = (prog.onyomi instanceof Set) ? prog.onyomi : new Set((prog.onyomi || []));
            const kunSet = (prog.kunyomi instanceof Set) ? prog.kunyomi : new Set((prog.kunyomi || []));
      
            const mask = (s) => {
              const len = (String(s || '')).length;
              return len > 0 ? '○'.repeat(len) : '○';
            };
      
            const drawMaskedList = (label, arr, learnedSet, color) => {
              if (!arr || arr.length === 0) return;
              this.ctx.textAlign = 'left';
              this.ctx.fillStyle = '#e0e0e0';
              this.ctx.fillText(label, x + 12, infoY);
              let tx = x + 35;
              this.ctx.fillStyle = 'white';
              for (let i = 0; i < arr.length; i++) {
                const r = arr[i];
                const isTargetMask = this.reviewMode && this.reviewTargetReading === r;
                const isKnown = learnedSet.has(r) && !isTargetMask;
                const text = isKnown ? r : mask(r);
                this.ctx.fillStyle = isKnown ? color : '#bdc3c7';
                const disp = i < arr.length - 1 ? `${text}、` : text;
                this.ctx.fillText(disp, tx, infoY);
                tx += this.ctx.measureText(disp).width + 2;
              }
              infoY += 16;
            };
      
            drawMaskedList('音:', (gameState.currentKanji.onyomi || []), onySet, '#f1c40f');
            drawMaskedList('訓:', (gameState.currentKanji.kunyomi || []), kunSet, '#2ecc71');
      
            // 学習進捗ゲージ
            if (prog) {
              const gaugeY = y + h - 35;
              const gaugeW = w - 24;
              const gaugeH = 10;
      
              this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
              this.ctx.fillRect(x + 12, gaugeY, gaugeW, gaugeH);
      
              const totalReadings = (gameState.currentKanji.onyomi || []).length + (gameState.currentKanji.kunyomi || []).length;
              const masteredReadings = (onySet.size) + (kunSet.size);
              const progressRatio = totalReadings > 0 ? masteredReadings / totalReadings : 0;
      
              this.ctx.fillStyle = progressRatio >= 1 ? '#2ecc71' : '#3498db';
              this.ctx.fillRect(x + 12, gaugeY, gaugeW * progressRatio, gaugeH);
      
              this.ctx.strokeStyle = 'white';
              this.ctx.lineWidth = 1;
              this.ctx.strokeRect(x + 12, gaugeY, gaugeW, gaugeH);
      
              this.ctx.font = '10px \"UDデジタル教科書体\",sans-serif';
              this.ctx.textAlign = 'center';
              this.ctx.fillStyle = 'white';
              this.ctx.fillText(`習得: ${masteredReadings}/${totalReadings}`, x + w/2, gaugeY + 22);
            }
      
    } catch (error) {
      console.error('❌ 現在漢字パネル描画エラー:', error);
    }
  },

  /**
   * 📈 拡張マスター進捗パネル
   */
  _drawEnhancedProgressPanel() {
    if (!this.ctx) return;
    
    try {
      const { x, y, w, h } = this.panelConfig.progress;

      // 背景
      const gradient = this.ctx.createLinearGradient(x, y, x, y + h);
      gradient.addColorStop(0, 'rgba(30, 60, 114, 0.95)');
      gradient.addColorStop(1, 'rgba(20, 40, 80, 0.95)');
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(x, y, w, h);
      this.ctx.strokeStyle = '#4caf50';
      this.ctx.lineWidth = 3;
      this.ctx.strokeRect(x, y, w, h);

            // タイトル
            this.ctx.fillStyle = 'white';
            this.ctx.textAlign = 'left';
            this.ctx.font = 'bold 18px "UDデジタル教科書体", sans-serif';
            this.ctx.fillText('📊 マスター進捗', x + 18, y + 24);

                        // 進捗値（ターゲットを毎フレーム追従）
                        const stageKanji = getKanjiByStageId(gameState.currentStageId);
                        const totalKanji = Math.max(1, stageKanji.length);
                        const unlocked = !!(gameState.stageReviewUnlocked && gameState.stageReviewUnlocked[gameState.currentStageId]);
                        const masteredCount = unlocked ? totalKanji : (totalKanji - this.unmasteredKanji.length);
                        const targetRatio = unlocked ? 1 : (masteredCount / totalKanji);
                        this.progressState.target = targetRatio;
                  
                        // アニメーション（イージング）
                        this.progressState.current += (this.progressState.target - this.progressState.current) * 0.12;
                  
                        // 右上に数値（バーの上）
                        const progressLabel = `${masteredCount} / ${totalKanji} (${Math.round(this.progressState.current * 100)}%)`;
                        this.ctx.font = 'bold 16px "UDデジタル教科書体", sans-serif';
                        this.ctx.textAlign = 'right';
                        this.ctx.fillStyle = 'white';
                        this.ctx.fillText(progressLabel, x + w - 18, y + 24);

            const barX = x + 18;
            const barY = y + h - 24;
            const barW = w - 36;
            const barH = 12;
      
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            this.ctx.fillRect(barX, barY, barW, barH);
      
            const progressGradient = this.ctx.createLinearGradient(barX, barY, barX + barW, barY);
            progressGradient.addColorStop(0, '#2ecc71');
            progressGradient.addColorStop(1, '#27ae60');
            this.ctx.fillStyle = progressGradient;
            this.ctx.fillRect(barX, barY, barW * this.progressState.current, barH);
      
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(barX, barY, barW, barH);
    } catch (error) {
      console.error('❌ 拡張進捗パネル描画エラー:', error);
    }
  },

  /**
   * 🎯 マスターモードバッジ
   */
  _drawPracticeModeBadge() {
    if (!this.ctx) return;
    
    try {
      const { x, y, w, h } = this.panelConfig.modeBadge;
      
      this.ctx.fillStyle = 'rgba(76, 175, 80, 0.95)';
      this.ctx.fillRect(x, y, w, h);
      
      this.ctx.strokeStyle = 'rgba(56, 142, 60, 1)';
      this.ctx.lineWidth = 3;
      this.ctx.strokeRect(x, y, w, h);
      
      this.ctx.fillStyle = 'white';
      this.ctx.font = 'bold 18px "UDデジタル教科書体", sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('📚 マスターモード', x + w/2, y + h/2);
      
    } catch (error) {
      console.error('❌ マスターモードバッジ描画エラー:', error);
    }
  },


    /**
   * 🧪 レビューモードバッジ（オレンジ）
   */
    _drawReviewModeBadge() {
      if (!this.ctx) return;
      
      try {
        const { x, y, w, h } = this.panelConfig.modeBadge;
        
        this.ctx.fillStyle = 'rgba(255, 152, 0, 0.95)';
        this.ctx.fillRect(x, y, w, h);
        
        this.ctx.strokeStyle = 'rgba(239, 108, 0, 1)';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(x, y, w, h);
        
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 18px "UDデジタル教科書体", sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('📚 レビューモード', x + w/2, y + h/2);
        
      } catch (error) {
        console.error('❌ レビューモードバッジ描画エラー:', error);
      }
    },
  /**
   * 🎮 操作ガイド（ボタンの代替）
   */
  _drawOperationGuide() {
    if (!this.ctx) return;
    
    try {
      const { x, y, w, h } = this.panelConfig.guide;
      
      // 背景
      this.ctx.fillStyle = 'rgba(52, 73, 94, 0.9)';
      this.ctx.fillRect(x, y, w, h);
      
      this.ctx.strokeStyle = '#34495e';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(x, y, w, h);
      
      // メインテキスト
      this.ctx.fillStyle = 'white';
      this.ctx.font = 'bold 18px "UDデジタル教科書体", sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      const guideMain = this.reviewMode ? '○の読みを入力してEnterキー' : '読みを入力してEnterキー';
      this.ctx.fillText(guideMain, x + w/2, y + h/2 - 8);
      // サブテキスト
      this.ctx.font = '14px "UDデジタル教科書体", sans-serif';
      this.ctx.fillStyle = '#bdc3c7';
      this.ctx.fillText('ヒント: スペースキー', x + w/2, y + h/2 + 12);
      
    } catch (error) {
      console.error('❌ 操作ガイド描画エラー:', error);
    }
  },

  /**
   * 📚 学習履歴パネル
   */
  _drawLearningHistoryPanel() {
    if (!this.ctx) return;
    
    try {
      const { x, y, w, h } = this.panelConfig.history;
      
      this._drawPanelBackground(this.ctx, x, y, w, h, 'paper');
      
      this.ctx.fillStyle = '#2c3e50';
      this.ctx.textAlign = 'center';
      
      // タイトル
      this.ctx.font = 'bold 16px "UDデジタル教科書体", sans-serif';
      this.ctx.fillText('📖 最近の学習履歴', x + w/2, y + 20);
      
      // 履歴表示
      if (this.recentHistory.length === 0) {
        this.ctx.font = '14px "UDデジタル教科書体", sans-serif';
        this.ctx.fillStyle = '#7f8c8d';
        this.ctx.fillText('まだ学習履歴がありません', x + w/2, y + h/2);
      } else {
        const startY = y + 40;
        const itemHeight = 16;
        const maxItems = Math.floor((h - 50) / itemHeight);
        
        this.ctx.textAlign = 'left';
        this.ctx.font = '12px "UDデジタル教科書体", sans-serif';
        
        for (let i = 0; i < Math.min(maxItems, this.recentHistory.length); i++) {
          const item = this.recentHistory[i];
          const itemY = startY + i * itemHeight;
          
          // 正解/不正解のアイコン
          this.ctx.fillStyle = item.isCorrect ? '#2ecc71' : '#e74c3c';
          this.ctx.fillText(item.isCorrect ? '✓' : '✗', x + 10, itemY);
          
          // 漢字
          this.ctx.fillStyle = '#2c3e50';
          this.ctx.fillText(item.kanji, x + 25, itemY);
          
          // 解答
          this.ctx.fillStyle = '#7f8c8d';
          this.ctx.fillText(`→ ${item.answer}`, x + 45, itemY);
          
          // 時間
          const timeStr = `${Math.round(item.answerTime / 1000)}s`;
          this.ctx.textAlign = 'right';
          this.ctx.fillText(timeStr, x + w - 10, itemY);
          this.ctx.textAlign = 'left';
        }
      }
      
    } catch (error) {
      console.error('❌ 学習履歴パネル描画エラー:', error);
    }
  },

  

  /**
   * 📊 詳細統計表示
   */
  _drawDetailedStats() {
    // 常に表示（0件でも）
    if (!this.ctx) return;
    
    try {
      // 画面右下に配置（キャンバスサイズに追従）
      const w = 230;
      const h = 90;
      const x = this.canvas.width - w - 20;
      const y = this.canvas.height - h - 20;
      
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      this.ctx.fillRect(x, y, w, h);
      
      this.ctx.strokeStyle = '#3498db';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(x, y, w, h);
      
      this.ctx.fillStyle = 'white';
      this.ctx.font = 'bold 14px "UDデジタル教科書体", sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.fillText('📈 セッション統計', x + 10, y + 18);
      
      this.ctx.font = '12px "UDデジタル教科書体", sans-serif';
      let statY = y + 35;
      
      const { totalPracticed, correctCount, correctStreak, maxStreak } = this.practiceStats;
      const accuracy = totalPracticed > 0 ? Math.round((correctCount / totalPracticed) * 100) : 0;
      
      this.ctx.fillText(`正答率: ${accuracy}% (${correctCount}/${totalPracticed})`, x + 10, statY);
      statY += 15;
      this.ctx.fillText(`現在の連続: ${correctStreak}問`, x + 10, statY);
      statY += 15;
      this.ctx.fillText(`最高連続: ${maxStreak}問`, x + 10, statY);
      
      if (this.practiceStats.timePerQuestion.length > 0) {
        const avgTime = Math.round(
          this.practiceStats.timePerQuestion.reduce((a, b) => a + b, 0) /
          this.practiceStats.timePerQuestion.length / 1000
        );
        this.ctx.textAlign = 'right';
        this.ctx.fillText(`平均: ${avgTime}秒`, x + w - 10, statY);
      }
      
    } catch (error) {
      console.error('❌ 詳細統計描画エラー:', error);
    }
  },
 
  _adjustInputPosition() {
    if (!this.canvas) return;
    
    try {
      // 入力欄が無ければ取得/生成して初期化
      if (!this.inputEl) {
        this.inputEl = document.getElementById('kanjiInput');
      }
      if (!this.inputEl) {
        const el = document.createElement('input');
        el.id = 'kanjiInput';
        el.type = 'text';
        el.autocomplete = 'off';
        document.body.appendChild(el);
        this.inputEl = el;
        // practice用のEnter/Spaceハンドラ等を付与
        this._setupPracticeKeyHandler?.();
      }

      // 強制表示（他CSSに勝つ）
      const s = this.inputEl.style;
      s.setProperty('display', 'block', 'important');
      s.setProperty('visibility', 'visible', 'important');
      s.setProperty('opacity', '1', 'important');
      this.inputEl.removeAttribute('hidden');

      s.setProperty('position', 'fixed', 'important');
      s.setProperty('z-index', '2147483647', 'important');
      s.setProperty('transform', 'none', 'important');
      s.setProperty('pointer-events', 'auto', 'important');

      // スタイル
      const isTablet = window.innerWidth <= 1024;
      s.width = isTablet ? 'min(80vw, 520px)' : '280px';
      s.fontSize = isTablet ? '18px' : '20px';
      s.padding = '10px 15px';
      s.textAlign = 'center';
      s.backgroundColor = 'white';
      s.border = '3px solid #3498db';
      s.borderRadius = '8px';
      s.boxSizing = 'border-box';
      s.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';

      // インセット算出（heightベース）
      const vv = window.visualViewport;
      const vvInset = vv ? Math.max(0, (window.innerHeight - vv.height - vv.offsetTop)) : 0;
      const vk = navigator.virtualKeyboard;
      const vkRect = (vk && vk.boundingRect) ? vk.boundingRect : null;
      const vkInset = vkRect ? Math.max(0, vkRect.height) : 0;

      // 既存: vvInset / vkRect.height を計算済みとする
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      this._baseVH = this._baseVH || window.innerHeight; // 初回記録
      const vvH = vv ? vv.height : window.innerHeight;
      const focusDiff = Math.max(0, this._baseVH - vvH);

      // 通常推定
      let insetMax = Math.max(vvInset, vkInset, this.keyboardState?.bottomInset || 0);

      // iOS対策: 差分0でもフォーカス中は下限値を採用
      if (isIOS && document.activeElement === this.inputEl) {
        const MIN_IOS_KB = 320;             // 端末により 300〜360 で調整可
        insetMax = Math.max(insetMax, focusDiff, MIN_IOS_KB);
      }

      const keyboardOpen = insetMax > 30;
      const bottomInset = keyboardOpen ? insetMax : 0;

      // 位置計算
      const rect = this.canvas.getBoundingClientRect?.();
      const centerX = rect ? (rect.left + rect.width / 2) : Math.round(window.innerWidth / 2);

      const cs = getComputedStyle(this.inputEl);
      const inputW = this.inputEl.offsetWidth || parseInt(cs.width) || 280;
      const inputH = this.inputEl.offsetHeight || parseInt(cs.height) || 40;

      if (keyboardOpen) {
        s.left = `${Math.round(centerX - inputW / 2)}px`;
        s.top = 'auto';
        s.bottom = `${Math.round(bottomInset + 4)}px`;
      } else {
        // 石版に重ならない下寄せ + 画面内へクランプ
        let cssTop;
        if (rect) {
          const targetCanvasY = Math.min(this.canvas.height - 40, 460);
          const cssTopRaw = rect.top + (targetCanvasY / this.canvas.height) * rect.height - inputH / 2;
          cssTop = Math.max(0, Math.min(window.innerHeight - inputH - 8, cssTopRaw));
        } else {
          cssTop = window.innerHeight - inputH - 24;
        }
        s.left = `${Math.round(centerX - inputW / 2)}px`;
        s.top = `${Math.round(cssTop)}px`;
        s.bottom = 'auto';
      }
      
    } catch (error) {
      console.error('❌ 入力欄位置調整エラー:', error);
    }
  },

  /**
   * 画面の描画更新をオーバーライド（入力欄位置調整を含む）
   */
  update(dt) {
    try {
      // 親クラスのupdate処理を実行
      const originalEnemy = gameState.currentEnemy;
      const originalEnemies = gameState.enemies;
      
      gameState.currentEnemy = null;
      gameState.enemies = [];
      
      // 最小限のバトルUI描画
      this._drawMinimalBattleUI(dt);
      
      // 🎨 改善されたUIを描画
      this._hideEnemyAndPlayerUIAreas();
      this._drawImprovedPracticeUI();
      
      // 入力欄の位置を調整
      this._adjustInputPosition();
      
      gameState.currentEnemy = originalEnemy;
      gameState.enemies = originalEnemies;
      
    } catch (error) {
      console.error('❌ 描画更新エラー:', error);
    }
  },

  /**
   * 全漢字マスター完了メッセージ
   */
  _showAllMasteredMessage() {
    try {
      console.log('🎉 全ての漢字をマスターしました！');
      
      setTimeout(() => {
        this._completePractice();
      }, 1000);
      
    } catch (error) {
      console.error('❌ 全マスターメッセージエラー:', error);
    }
  },

  /**
   * 練習完了処理
   */
  _completePractice() {
    try {
      const { totalPracticed, correctCount, maxStreak } = this.practiceStats;
      const accuracy = totalPracticed > 0 ? Math.round((correctCount / totalPracticed) * 100) : 0;
      const sessionTime = Math.floor((Date.now() - this.practiceStats.startTime) / 1000 / 60);

      console.log('🎯 練習完了:', {
        totalPracticed,
        correctCount, 
        accuracy: `${accuracy}%`,
        sessionTime: `${sessionTime}分`,
        maxStreak: `${maxStreak}問連続`
      });

      // アンロックを記録（画面遷移後も継続）
      if (!gameState.stageReviewUnlocked) gameState.stageReviewUnlocked = {};
      gameState.stageReviewUnlocked[gameState.currentStageId] = true;

      // クリア後は強制遷移せず、レビューモードに移行して継続
      this.reviewMode = true;
      this._pickNextReviewQuestion();
    } catch (error) {
      console.error('❌ 練習完了処理エラー:', error);
      // 何もしない（画面は維持）
    }
  },

  /**
   * マスター進捗更新
   */
  _updateKanjiMasteryAfterCorrect(currentKanji, answer) {
    try {
      if (!gameState.kanjiReadProgress) {
        gameState.kanjiReadProgress = {};
      }
      
      const id = currentKanji.id;
      if (!gameState.kanjiReadProgress[id]) {
        gameState.kanjiReadProgress[id] = {
          onyomi: new Set(),
          kunyomi: new Set(),
          mastered: false
        };
      }
      
      const prog = gameState.kanjiReadProgress[id];
      
      const isKun = (currentKanji.kunyomi || []).includes(answer);
      const isOn = (currentKanji.onyomi || []).includes(answer);
      
      if (isKun) {
        prog.kunyomi.add(answer);
        console.log(`📖 訓読み「${answer}」を習得しました`);
      }
      if (isOn) {
        prog.onyomi.add(answer);
        console.log(`📖 音読み「${answer}」を習得しました`);
      }
      
      const before = !!prog.mastered;
      const allKunOk = (currentKanji.kunyomi || []).every(r => prog.kunyomi.has(r));
      const allOnOk = (currentKanji.onyomi || []).every(r => prog.onyomi.has(r));
      prog.mastered = allKunOk && allOnOk;
      
      if (!before && prog.mastered) {
        console.log(`🎉 漢字「${currentKanji.text}」をマスターしました！`);
        
        if (this.masteryFlash) {
          this.masteryFlash = { 
            active: true, 
            timer: 30, 
            kanjiId: currentKanji.id 
          };
        }
        
        publish('playSE', 'master');
      }
      
    } catch (error) {
      console.error('❌ マスター進捗更新エラー:', error);
    }
  },

  /**
   * 漢字がマスター済みかどうかを判定
   */
  _isKanjiMastered(kanjiId) {
    try {
      const prog = gameState.kanjiReadProgress && gameState.kanjiReadProgress[kanjiId];
      return !!(prog && prog.mastered);
    } catch (error) {
      console.error('❌ マスター判定エラー:', error);
      return false;
    }
  },

  /**
   * パネル背景を描画
   */
  _drawPanelBackground(ctx, x, y, width, height, style = 'default') {
    try {
      ctx.save();
      
      let bgColor = 'rgba(0, 0, 0, 0.75)';
      if (style === 'stone') {
        bgColor = 'rgba(50, 50, 60, 0.85)';
      } else if (style === 'paper') {
        bgColor = 'rgba(245, 235, 215, 0.9)';
      }
      
      ctx.fillStyle = bgColor;
      ctx.fillRect(x, y, width, height);
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);
      
      if (style === 'stone') {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1;
        
        for (let i = 1; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(x, y + height * i / 3);
          ctx.lineTo(x + width, y + height * i / 3);
          ctx.stroke();
        }
      }
      
      ctx.restore();
      
    } catch (error) {
      console.error('❌ パネル背景描画エラー:', error);
    }
  },

  
  /**
   * MASTERバッジ描画
   */
  _drawMasterBadge(ctx, x, y) {
    try {
      ctx.save();
      ctx.font = 'bold 10px "UDデジタル教科書体",sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#3498db';
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;

      const label = 'MASTER';
      const padX = 5, padY = 3;
      const w = ctx.measureText(label).width + padX * 2;
      const h = 16;
      const rx = 4;
      const left = x - w, top = y;

      ctx.beginPath();
      ctx.moveTo(left + rx, top);
      ctx.lineTo(x - rx, top);
      ctx.quadraticCurveTo(x, top, x, top + rx);
      ctx.lineTo(x, top + h - rx);
      ctx.quadraticCurveTo(x, top + h, x - rx, top + h);
      ctx.lineTo(left + rx, top + h);
      ctx.quadraticCurveTo(left, top + h, left, top + h - rx);
      ctx.lineTo(left, top + rx);
      ctx.quadraticCurveTo(left, top, left + rx, top);
      ctx.closePath();

      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'white';
      ctx.fillText(label, x - padX, top + 3);
      ctx.restore();
      
    } catch (error) {
      console.error('❌ MASTERバッジ描画エラー:', error);
    }
  },

  /**
   * ユーティリティメソッド
   */
  _toHiragana(input) {
    try {
      if (!input) return '';
      let normalized = input.trim().replace(/\s+/g, '');
      return normalized.replace(/[\u30a1-\u30f6]/g, ch => 
        String.fromCharCode(ch.charCodeAt(0) - 0x60)
      );
    } catch (error) {
      console.error('❌ ひらがな変換エラー:', error);
      return input || '';
    }
  },

  _getReadings(kanji) {
    try {
      const set = new Set();
      if (kanji.kunyomi) {
        kanji.kunyomi.forEach(r => {
          if (r) set.add(this._toHiragana(String(r).trim()));
        });
      }
      if (kanji.onyomi) {
        kanji.onyomi.forEach(r => {
          if (r) set.add(this._toHiragana(String(r).trim()));
        });
      }
      return [...set].filter(Boolean);
    } catch (error) {
      console.error('❌ 読み取得エラー:', error);
      return [];
    }
  },

  /**
   * 画面離脱時のクリーンアップ
   */
  exit() {
    console.log('🎯 練習バトル画面を終了します');
    
    try {
      if (this._originalHandleAttack) {
        this.handleAttack = this._originalHandleAttack;
        this._originalHandleAttack = null;
      }
      
      if (this._originalHandleHeal) {
        this.handleHeal = this._originalHandleHeal;
        this._originalHandleHeal = null;
      }
      
      if (this._originalHandleHint) {
        this.handleHint = this._originalHandleHint;
        this._originalHandleHint = null;
      }
      
      if (this.inputEl && this._practiceKeydownHandler) {
        this.inputEl.removeEventListener('keydown', this._practiceKeydownHandler);
        this._practiceKeydownHandler = null;
      }
      
      if (battleScreenState.exit) {
        battleScreenState.exit.call(this);
      }
      
         this.practiceMode = false;
    this.onPracticeComplete = null;
    this.unmasteredKanji = [];
    this.lastIncorrectAnswer = null;
    this.recentHistory = [];
    this.reviewMode = false;
    this.reviewTargetReading = null;
    
          // リスナー解除とスタイル復元
      // リスナー解除とスタイル復元
      try {
        if (this.inputEl && this._focusHandler) {
          this.inputEl.removeEventListener('focus', this._focusHandler);
          this._focusHandler = null;
        }
        if (this.inputEl && this._blurHandler) {
          this.inputEl.removeEventListener('blur', this._blurHandler);
          this._blurHandler = null;
        }
        if (this._vvResizeHandler && window.visualViewport) {
          window.visualViewport.removeEventListener('resize', this._vvResizeHandler);
          this._vvResizeHandler = null;
        }
        if (this._vvScrollHandler && window.visualViewport) {
          window.visualViewport.removeEventListener('scroll', this._vvScrollHandler);
          this._vvScrollHandler = null;
        }
        if (this._vkGeometryHandler && navigator.virtualKeyboard) {
          navigator.virtualKeyboard.removeEventListener('geometrychange', this._vkGeometryHandler);
          this._vkGeometryHandler = null;
        }
        if (Array.isArray(this._focusScrollTimers)) {
          this._focusScrollTimers.forEach(id => { try { clearTimeout(id); } catch {} });
          this._focusScrollTimers = [];
        }
        // 付与したスタイルを元に戻す
        if (this._prevBodyStyles) {
          const s = this._prevBodyStyles;
          document.documentElement.style.overflowY = s.htmlOverflowY || '';
          document.body.style.overflowY = s.bodyOverflowY || '';
          document.documentElement.style.overscrollBehaviorY = s.htmlOverscroll || '';
          document.body.style.overscrollBehaviorY = s.bodyOverscroll || '';
          document.body.style.paddingBottom = s.bodyPaddingBottom || '';
          this._prevBodyStyles = null;
        } else {
          document.documentElement.style.overflowY = '';
          document.body.style.overflowY = '';
          document.documentElement.style.overscrollBehaviorY = '';
          document.body.style.overscrollBehaviorY = '';
          document.body.style.paddingBottom = '';
        }
    } catch {}
      

      // 成功パーティクルをクリア
      this.successParticles.active = false;
      this.successParticles.particles = [];
      
      gameState.gameMode = 'normal';
      
      console.log('🎯 練習バトル画面を終了しました');
      
    } catch (error) {
      console.error('❌ 終了処理エラー:', error);
    }
  }
};

export default practiceBattleScreenState;