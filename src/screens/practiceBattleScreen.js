// 練習バトル画面 - UIレイアウト最適化版

import battleScreenState from './battleScreen.js';
import { gameState, battleState } from '../core/gameState.js';
import { getKanjiByStageId, isKanjiMastered } from '../loaders/dataLoader.js';
import { publish } from '../core/eventBus.js';

// 練習バトル画面状態
const practiceBattleScreenState = {
  // 既存のbattleScreenStateの全機能を継承
  ...battleScreenState,
  
  // 練習モード専用のプロパティ
  practiceMode: true,
  onPracticeComplete: null,
  unmasteredKanji: [],
  lastIncorrectAnswer: null,
  practiceStats: {
    totalPracticed: 0,
    correctCount: 0,
    incorrectCount: 0,
    startTime: Date.now(),
    sessionStreak: 0, // 連続正答数
    todaysPracticeCount: 0
  },

  // 📐 新しいレイアウト設定
  panelConfig: {
    // 前回の漢字パネル（サイズ縮小）
    previous: { x: 20, y: 70, w: 160, h: 160 },
    // 現在学習中漢字パネル（新規追加）
    current: { x: 20, y: 240, w: 160, h: 140 },
    // 練習モードバッジ
    modeBadge: { x: 10, y: 390, w: 120, h: 30 },
    // 拡張マスター進捗パネル
    progress: { x: 480, y: 10, w: 300, h: 160 },
    // 詳細統計パネル
    stats: { x: 10, y: 430, w: 350, h: 40 }
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
      this.practiceStats.todaysPracticeCount = this._getTodaysPracticeCount();
      
      // 練習モード専用のハンドラを先に設定
      this._setupPracticeHandlers();
      
      // 通常のバトル画面初期化を実行
      battleScreenState.enter.call(this, canvasEl);
      
      // 練習モード専用のキーハンドラを設定
      this._setupPracticeKeyHandler();
      
      // 敵関連のみを無効化
      this._disableEnemyElements();
      
      // 未マスター漢字リストを構築
      this._buildUnmasteredKanjiList();
      
      // 最初の未マスター漢字を出題
      this._pickNextUnmasteredKanji();
      
      console.log('📚 練習モードを開始しました');
      
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
   * 練習モード専用のハンドラを設定
   */
  _setupPracticeHandlers() {
    console.log('🔧 練習モード用ハンドラを設定中...');
    
    try {
      this._originalHandleAttack = this.handleAttack;
      this._originalHandleHeal = this.handleHeal;
      this._originalHandleHint = this.handleHint;
      
      this.handleAttack = () => {
        console.log('🎯 練習モード handleAttack');
        this.handlePracticeAttack();
      };
      
      this.handleHeal = () => {
        console.log('💚 練習モード handleHeal');
        this.handlePracticeHeal();
      };
      
      this.handleHint = () => {
        console.log('💡 練習モード handleHint');
        this.handlePracticeHint();
      };
      
      console.log('✅ 練習モード用ハンドラ設定完了');
      
    } catch (error) {
      console.error('❌ ハンドラ設定エラー:', error);
    }
  },

  /**
   * 練習モード専用のキーボードハンドラを設定
   */
  _setupPracticeKeyHandler() {
    console.log('🔧 練習モード専用キーハンドラを設定中...');
    
    try {
      if (!this.inputEl) {
        console.warn('⚠️ 入力欄が見つかりません');
        return;
      }
      
      this._practiceKeydownHandler = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          console.log('⌨️ Enterキー押下');
          
          battleState.turn = 'player';
          battleState.inputEnabled = true;
          
          const inputValue = this.inputEl.value.trim();
          if (!inputValue) {
            console.log('❌ 入力が空');
            return;
          }
          
          const mode = battleState.lastCommandMode || 'attack';
          console.log(`⌨️ 実行モード: ${mode}`);
          
          try {
            if (mode === 'attack') {
              this.handlePracticeAttack();
            } else if (mode === 'heal') {
              this.handlePracticeHeal();
            } else if (mode === 'hint') {
              this.handlePracticeHint();
            }
          } catch (error) {
            console.error('⌨️ 処理エラー:', error);
            battleState.inputEnabled = true;
          }
        }
      };
      
      if (this._keydownHandler) {
        this.inputEl.removeEventListener('keydown', this._keydownHandler);
      }
      this.inputEl.addEventListener('keydown', this._practiceKeydownHandler);
      
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
   * 未マスターの漢字リストを構築
   */
  _buildUnmasteredKanjiList() {
    try {
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
      this._buildUnmasteredKanjiList();
      
      if (this.unmasteredKanji.length === 0) {
        this._completePractice();
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
        radical: selectedKanji.radical || '', // 部首情報があれば追加
        jlpt: selectedKanji.jlpt || '', // JLPTレベル情報があれば追加
      };
      
      gameState.hintLevel = 0;
      
      if (!Array.isArray(battleState.log)) battleState.log = [];
      const logMessage = `「${selectedKanji.kanji}」を読もう！`;
      battleState.log.push(logMessage);
      
      console.log(`📝 新しい問題: ${selectedKanji.kanji} (ID: ${selectedKanji.id})`);
      
    } catch (error) {
      console.error('❌ 漢字選択エラー:', error);
      this._completePractice();
    }
  },

  /**
   * 練習モード専用攻撃処理
   */
  handlePracticeAttack() {
    console.log('🎯 練習モード攻撃処理開始');
    
    try {
      if (battleState.turn !== 'player') {
        battleState.turn = 'player';
      }
      if (!battleState.inputEnabled) {
        battleState.inputEnabled = true;
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
      battleState.lastCommandMode = 'attack';
      
      const answer = this._toHiragana(raw);
      console.log('📝 変換後:', answer);
      
      if (!gameState.currentKanji) {
        console.log('❌ 現在の漢字なし');
        battleState.inputEnabled = true;
        return;
      }
      
      const correctReadings = this._getReadings(gameState.currentKanji);
      const isCorrect = correctReadings.includes(answer);
      
      console.log('📚 正解読み:', correctReadings);
      console.log('🎯 判定:', isCorrect ? '✅正解' : '❌不正解');
      
      this.practiceStats.totalPracticed++;
      this._updateTodaysPracticeCount();
      inputEl.value = '';
      
      if (isCorrect) {
        this.practiceStats.sessionStreak++;
        this._handlePracticeCorrect(answer);
      } else {
        this.practiceStats.sessionStreak = 0; // 連続正答リセット
        this._handlePracticeIncorrect(answer);
      }
      
    } catch (error) {
      console.error('❌ 攻撃処理エラー:', error);
      battleState.inputEnabled = true;
      if (this.inputEl) this.inputEl.value = '';
    }
  },

  /**
   * 練習モード専用回復処理
   */
  handlePracticeHeal() {
    console.log('💚 練習モード回復処理開始');
    
    try {
      battleState.turn = 'player';
      battleState.inputEnabled = false;
      battleState.lastCommandMode = 'heal';
      
      const inputEl = this.inputEl;
      if (!inputEl) return;
      
      const raw = inputEl.value.trim();
      if (!raw) {
        battleState.inputEnabled = true;
        return;
      }
      
      const answer = this._toHiragana(raw);
      const correctReadings = this._getReadings(gameState.currentKanji);
      const isCorrect = correctReadings.includes(answer);
      
      inputEl.value = '';
      this.practiceStats.totalPracticed++;
      this._updateTodaysPracticeCount();
      
      if (isCorrect) {
        this.practiceStats.sessionStreak++;
        this._handlePracticeCorrect(answer, 'heal');
      } else {
        this.practiceStats.sessionStreak = 0;
        this._handlePracticeIncorrect(answer, 'heal');
      }
      
    } catch (error) {
      console.error('❌ 回復処理エラー:', error);
      battleState.inputEnabled = true;
    }
  },

  /**
   * 練習モード専用ヒント処理
   */
  handlePracticeHint() {
    console.log('💡 練習モードヒント処理開始');
    
    try {
      if (!gameState.currentKanji) return;
      
      const current = Number(gameState.hintLevel || 0);
      if (current >= 4) {
        this._addToPracticeLog('ヒントはここまで！');
        return;
      }
      
      const level = current + 1;
      gameState.hintLevel = level;
      
      const k = gameState.currentKanji;
      const onyomi = Array.isArray(k.onyomi) ? k.onyomi : [];
      const kunyomi = Array.isArray(k.kunyomi) ? k.kunyomi : [];
      
      let hintMessage = '';
      
      switch (level) {
        case 1:
          hintMessage = `ヒント（基本）: 画数は${k.strokes || '?'}`;
          break;
        case 2:
          const useOn = (onyomi.length > 0 && (Math.random() >= 0.5 || kunyomi.length === 0));
          const list = useOn ? onyomi : kunyomi;
          const first = list[0] || '';
          const masked = first ? first.substring(0, 1) + '○○' : '不明';
          hintMessage = `ヒント（読み）: ${useOn ? '音読み' : '訓読み'}は「${masked}」から始まる`;
          break;
        case 3:
          hintMessage = `ヒント（意味）: ${k.meaning || '（準備中）'}`;
          break;
        case 4:
          if (onyomi.length > 0 || kunyomi.length > 0) {
            const useOn = onyomi.length > 0 ? (Math.random() >= 0.5 || kunyomi.length === 0) : false;
            const list = useOn ? onyomi : kunyomi;
            hintMessage = `ヒント（決め手）: ${useOn ? '音読み' : '訓読み'}は「${list[0]}」`;
          } else {
            hintMessage = 'ヒント（決め手）: データがありません';
          }
          break;
      }
      
      this._addToPracticeLog(hintMessage);
      
    } catch (error) {
      console.error('❌ ヒント処理エラー:', error);
    }
  },

  /**
   * 練習での正解処理
   */
  _handlePracticeCorrect(answer, actionType = 'attack') {
    console.log('✅ 正解処理開始');
    
    try {
      this.practiceStats.correctCount++;
      
      battleState.lastAnswered = { ...gameState.currentKanji };
      
      if (actionType === 'attack') {
        if (this.startKanjiBoxEffect) {
          this.startKanjiBoxEffect('rgba(46, 204, 113, 0.8)', 20);
        }
        
        if (this.startStoneAttackEffect && this.canvas) {
          const kanjiX = this.canvas.width / 2;
          const kanjiY = 200;
          this.startStoneAttackEffect(kanjiX, kanjiY, 180, 160);
        }
      }
      
      publish('playSE', 'correct');
      
      const wasAlreadyMastered = this._isKanjiMastered(gameState.currentKanji.id);
      this._updateKanjiMasteryAfterCorrect(gameState.currentKanji, answer);
      const isNowMastered = this._isKanjiMastered(gameState.currentKanji.id);
      
      if (!wasAlreadyMastered && isNowMastered) {
        this.unmasteredKanji = this.unmasteredKanji.filter(k => k.id !== gameState.currentKanji.id);
        console.log(`🎉 漢字「${gameState.currentKanji.text}」が新しくマスターされました！`);
        console.log(`📚 残り未マスター漢字: ${this.unmasteredKanji.length}件`);
      }
      
      const onyomiStr = (gameState.currentKanji.onyomi || []).join('、');
      const kunyomiStr = (gameState.currentKanji.kunyomi || []).join('、');
      const readingMsg = `正しい読み: 音「${onyomiStr}」訓「${kunyomiStr}」`;
      
      const actionMsg = actionType === 'heal' ? 'かいふくせいこう！' : 'せいかい！';
      this._addToPracticeLog(`${actionMsg} ${readingMsg}`);
      
      console.log(`✅ 正解: ${gameState.currentKanji.text} = ${answer}`);
      
      setTimeout(() => {
        this._pickNextUnmasteredKanji();
        battleState.turn = 'player';
        battleState.inputEnabled = true;
      }, 1500);
      
    } catch (error) {
      console.error('❌ 正解処理エラー:', error);
      battleState.inputEnabled = true;
    }
  },

  /**
   * 練習での不正解処理
   */
  _handlePracticeIncorrect(answer, actionType = 'attack') {
    console.log('❌ 不正解処理開始');
    
    try {
      this.practiceStats.incorrectCount++;
      
      this.lastIncorrectAnswer = answer;
      battleState.lastAnswered = { ...gameState.currentKanji };
      
      publish('playSE', 'wrong');
      
      const onyomiStr = (gameState.currentKanji.onyomi || []).join('、');
      const kunyomiStr = (gameState.currentKanji.kunyomi || []).join('、');
      const readingMsg = `正しい読み: 音「${onyomiStr}」訓「${kunyomiStr}」`;
      
      const actionMsg = actionType === 'heal' ? 'かいふくしっぱい！' : 'こうげきしっぱい！';
      this._addToPracticeLog(`${actionMsg} ${readingMsg}`);
      this._addToPracticeLog('もう一度挑戦しよう！');
      
      console.log(`❌ 不正解: ${gameState.currentKanji.text} ≠ ${answer}`);
      
      setTimeout(() => {
        battleState.turn = 'player';
        battleState.inputEnabled = true;
      }, 1500);
      
    } catch (error) {
      console.error('❌ 不正解処理エラー:', error);
      battleState.inputEnabled = true;
    }
  },

  /**
   * マウスクリック処理（練習モード専用にオーバーライド）
   */
  handleClick(e) {
    console.log('🖱️ 練習モードクリック処理');

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
        back:   { x: 20,  y: 20,  w: 100, h: 30 },
        stage:  { x: 140, y: 20,  w: 120, h: 30 },
        attack: { x: 230, y: 380, w: 110, h: 50 },
        heal:   { x: 350, y: 380, w: 110, h: 50 },
        hint:   { x: 470, y: 380, w: 110, h: 50 },
      };

      const isMouseOverRect = (mx, my, rect) => {
        return mx >= rect.x && mx <= rect.x + rect.w && 
               my >= rect.y && my <= rect.y + rect.h;
      };

      if (isMouseOverRect(x, y, BTN.back)) {
        console.log('🏠 タイトルへ');
        publish('changeScreen', 'title');
        return true;
      }

      if (isMouseOverRect(x, y, BTN.stage)) {
        console.log('🗺️ ステージ選択へ');
        publish('changeScreen', 'stageSelect');
        return true;
      }

      if (isMouseOverRect(x, y, BTN.attack)) {
        console.log('🎯 攻撃ボタン');
        battleState.lastCommandMode = 'attack';
        this.handlePracticeAttack();
        return true;
      }

      if (isMouseOverRect(x, y, BTN.heal)) {
        console.log('💚 回復ボタン');
        battleState.lastCommandMode = 'heal';
        this.handlePracticeHeal();
        return true;
      }

      if (isMouseOverRect(x, y, BTN.hint)) {
        console.log('💡 ヒントボタン');
        battleState.lastCommandMode = 'hint';
        this.handlePracticeHint();
        return true;
      }

      return false;
      
    } catch (error) {
      console.error('❌ クリック処理エラー:', error);
      return false;
    }
  },

  /**
   * 画面の描画更新
   */
  update(dt) {
    try {
      const originalEnemy = gameState.currentEnemy;
      const originalEnemies = gameState.enemies;
      
      gameState.currentEnemy = null;
      gameState.enemies = [];
      
      if (battleScreenState.update) {
        battleScreenState.update.call(this, dt);
      }
      
      // 🎨 新しいレイアウトで描画
      this._hideEnemyAndPlayerUIAreas();
      this._drawOptimizedPracticeUI();
      
      gameState.currentEnemy = originalEnemy;
      gameState.enemies = originalEnemies;
      
    } catch (error) {
      console.error('❌ 描画更新エラー:', error);
    }
  },

  /**
   * 敵・プレイヤーUIエリアを隠す
   */
  _hideEnemyAndPlayerUIAreas() {
    if (!this.ctx) return;
    
    try {
      this.ctx.save();
      
      const bgGradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
      bgGradient.addColorStop(0, '#1e3c72');
      bgGradient.addColorStop(1, '#2a5298');
      
      // 敵エリア
      if (this.stageBgImage) {
        this.ctx.drawImage(this.stageBgImage, 480, 80, 280, 200, 480, 80, 280, 200);
        this.ctx.drawImage(this.stageBgImage, 500, 10, 280, 120, 500, 10, 280, 120);
      } else {
        this.ctx.fillStyle = bgGradient;
        this.ctx.fillRect(480, 80, 280, 200); // 敵表示エリア
        this.ctx.fillRect(500, 10, 280, 120);  // 敵ステータスパネル
      }
      
      // プレイヤーエリア
      if (this.stageBgImage) {
        this.ctx.drawImage(this.stageBgImage, 20, 450, 280, 130, 20, 450, 280, 130);
      } else {
        this.ctx.fillStyle = bgGradient;
        this.ctx.fillRect(20, 450, 280, 130); // プレイヤーステータスパネル
      }
      
      this.ctx.restore();
      
    } catch (error) {
      console.error('❌ UIエリア隠しエラー:', error);
    }
  },

  /**
   * 🎨 最適化されたUIを描画
   */
  _drawOptimizedPracticeUI() {
    try {
      this._drawCompactPreviousKanjiPanel();      // 前回漢字（コンパクト）
      this._drawCurrentKanjiDetailPanel();        // 現在漢字詳細（読みなし）
      this._drawEnhancedProgressPanel();          // 拡張進捗パネル
      this._drawPracticeModeBadge();              // 練習モードバッジ
      this._drawDetailedStatsPanel();             // 詳細統計パネル
    } catch (error) {
      console.error('❌ 最適化UI描画エラー:', error);
    }
  },

  /**
   * 📦 コンパクトな前回漢字パネル
   */
  _drawCompactPreviousKanjiPanel() {
    if (!this.ctx || !battleState.lastAnswered) return;
    
    try {
      const { x, y, w, h } = this.panelConfig.previous;
      
      this._drawPanelBackground(this.ctx, x, y, w, h, 'stone');

      this.ctx.fillStyle = 'white';
      this.ctx.textAlign = 'center';
      
      // タイトル（小さく）
      this.ctx.font = 'bold 12px "UDデジタル教科書体",sans-serif';
      this.ctx.fillText('前回の漢字', x + w/2, y + 15);
      
      // 漢字本体（中サイズ）
      this.ctx.font = '40px serif';
      this.ctx.fillText(battleState.lastAnswered.text, x + w/2, y + 60);

      // 基本情報（コンパクト）
      this.ctx.font = '11px "UDデジタル教科書体",sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.fillStyle = 'white';
      
      const infoY = y + 85;
      this.ctx.fillText(`画数: ${battleState.lastAnswered.strokes}画`, x + 10, infoY);
      
      if (battleState.lastAnswered.meaning) {
        this.ctx.fillText(`意味: ${battleState.lastAnswered.meaning.substring(0, 8)}...`, x + 10, infoY + 15);
      }

      // 間違った答え（あれば）
      if (this.lastIncorrectAnswer) {
        const errorY = y + h - 25;
        this.ctx.fillStyle = 'rgba(231, 76, 60, 0.3)';
        this.ctx.fillRect(x + 5, errorY, w - 10, 20);
        this.ctx.strokeStyle = '#e74c3c';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x + 5, errorY, w - 10, 20);
        
        this.ctx.fillStyle = '#e74c3c';
        this.ctx.font = 'bold 10px "UDデジタル教科書体",sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`あなた: ${this.lastIncorrectAnswer}`, x + w/2, errorY + 13);
      }

      // MASTERバッジ
      const prog = gameState.kanjiReadProgress && gameState.kanjiReadProgress[battleState.lastAnswered.id];
      if (prog && prog.mastered) {
        this._drawMasterBadge(this.ctx, x + w - 6, y + 6);
      }
      
    } catch (error) {
      console.error('❌ 前回漢字パネル描画エラー:', error);
    }
  },

  /**
   * 📚 現在学習中漢字の詳細パネル（読みなし）
   */
  _drawCurrentKanjiDetailPanel() {
    if (!this.ctx || !gameState.currentKanji) return;
    
    try {
      const { x, y, w, h } = this.panelConfig.current;
      
      this._drawPanelBackground(this.ctx, x, y, w, h, 'stone');

      this.ctx.fillStyle = 'white';
      this.ctx.textAlign = 'center';
      
      // タイトル
      this.ctx.font = 'bold 12px "UDデジタル教科書体",sans-serif';
      this.ctx.fillText('学習中の漢字', x + w/2, y + 15);
      
      // 漢字本体（小さめ）
      this.ctx.font = '32px serif';
      this.ctx.fillText(gameState.currentKanji.text, x + w/2, y + 50);

      // 詳細情報（読みは表示しない）
      this.ctx.font = '11px "UDデジタル教科書体",sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.fillStyle = 'white';
      
      let infoY = y + 70;
      
      // 画数
      this.ctx.fillText(`画数: ${gameState.currentKanji.strokes}画`, x + 10, infoY);
      infoY += 15;
      
      // 意味（短縮表示）
      if (gameState.currentKanji.meaning) {
        const meaning = gameState.currentKanji.meaning.length > 12 
          ? gameState.currentKanji.meaning.substring(0, 12) + '...'
          : gameState.currentKanji.meaning;
        this.ctx.fillText(`意味: ${meaning}`, x + 10, infoY);
        infoY += 15;
      }
      
      // 部首（あれば）
      if (gameState.currentKanji.radical) {
        this.ctx.fillText(`部首: ${gameState.currentKanji.radical}`, x + 10, infoY);
        infoY += 15;
      }
      
      // JLPTレベル（あれば）
      if (gameState.currentKanji.jlpt) {
        this.ctx.fillText(`JLPT: ${gameState.currentKanji.jlpt}`, x + 10, infoY);
      }

      // 学習進捗ゲージ
      const prog = gameState.kanjiReadProgress && gameState.kanjiReadProgress[gameState.currentKanji.id];
      if (prog) {
        const gaugeY = y + h - 25;
        const gaugeW = w - 20;
        const gaugeH = 8;
        
        // 全体のゲージ背景
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.fillRect(x + 10, gaugeY, gaugeW, gaugeH);
        
        // 進捗計算（音読み + 訓読みの習得率）
        const totalReadings = (gameState.currentKanji.onyomi || []).length + (gameState.currentKanji.kunyomi || []).length;
        const masteredReadings = (prog.onyomi ? prog.onyomi.size : 0) + (prog.kunyomi ? prog.kunyomi.size : 0);
        const progressRatio = totalReadings > 0 ? masteredReadings / totalReadings : 0;
        
        // 進捗バー
        this.ctx.fillStyle = progressRatio >= 1 ? '#2ecc71' : '#3498db';
        this.ctx.fillRect(x + 10, gaugeY, gaugeW * progressRatio, gaugeH);
        
        // 枠線
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x + 10, gaugeY, gaugeW, gaugeH);
        
        // 進捗テキスト
        this.ctx.font = '9px "UDデジタル教科書体",sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = 'white';
        this.ctx.fillText(`${masteredReadings}/${totalReadings} 習得`, x + w/2, gaugeY + 20);
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
      
      // パネル背景（グラデーション）
      const gradient = this.ctx.createLinearGradient(x, y, x, y + h);
      gradient.addColorStop(0, 'rgba(30, 60, 114, 0.95)');
      gradient.addColorStop(1, 'rgba(20, 40, 80, 0.95)');
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(x, y, w, h);
      
      this.ctx.strokeStyle = '#4caf50';
      this.ctx.lineWidth = 3;
      this.ctx.strokeRect(x, y, w, h);

      this.ctx.fillStyle = 'white';
      this.ctx.textAlign = 'left';
      
      // タイトル
      this.ctx.font = 'bold 18px "UDデジタル教科書体", sans-serif';
      this.ctx.fillText('📊 学習進捗ダッシュボード', x + 15, y + 25);

      // 基本統計
      const stageKanji = getKanjiByStageId(gameState.currentStageId);
      const totalKanji = stageKanji.length;
      const masteredCount = totalKanji - this.unmasteredKanji.length;
      const progressPercent = Math.round((masteredCount / totalKanji) * 100);

      // 左側：マスター進捗
      this.ctx.font = 'bold 14px "UDデジタル教科書体", sans-serif';
      this.ctx.fillText('マスター進捗', x + 15, y + 50);
      
      this.ctx.font = 'bold 28px "UDデジタル教科書体", sans-serif';
      this.ctx.fillStyle = '#4caf50';
      this.ctx.fillText(`${masteredCount}`, x + 15, y + 75);
      
      this.ctx.font = 'bold 16px "UDデジタル教科書体", sans-serif';
      this.ctx.fillStyle = 'white';
      this.ctx.fillText(`/ ${totalKanji} (${progressPercent}%)`, x + 65, y + 75);

      // プログレスバー（大）
      const barX = x + 15;
      const barY = y + 85;
      const barW = w - 30;
      const barH = 12;
      
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      this.ctx.fillRect(barX, barY, barW, barH);
      
      const progress = masteredCount / totalKanji;
      const progressGradient = this.ctx.createLinearGradient(barX, barY, barX + barW, barY);
      progressGradient.addColorStop(0, '#2ecc71');
      progressGradient.addColorStop(1, '#27ae60');
      this.ctx.fillStyle = progressGradient;
      this.ctx.fillRect(barX, barY, barW * progress, barH);
      
      this.ctx.strokeStyle = 'white';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(barX, barY, barW, barH);

      // 右側：セッション統計
      const rightX = x + w/2 + 10;
      
      this.ctx.font = 'bold 14px "UDデジタル教科書体", sans-serif';
      this.ctx.fillStyle = 'white';
      this.ctx.fillText('本日の学習', rightX, y + 50);
      
      // 今日の練習回数
      this.ctx.font = '12px "UDデジタル教科書体", sans-serif';
      this.ctx.fillText(`練習回数: ${this.practiceStats.todaysPracticeCount}問`, rightX, y + 70);
      
      // 連続正答数
      this.ctx.fillText(`連続正答: ${this.practiceStats.sessionStreak}問`, rightX, y + 85);
      
      // セッション正答率
      const sessionTotal = this.practiceStats.totalPracticed;
      const sessionCorrect = this.practiceStats.correctCount;
      const sessionAccuracy = sessionTotal > 0 ? Math.round((sessionCorrect / sessionTotal) * 100) : 0;
      this.ctx.fillText(`セッション正答率: ${sessionAccuracy}%`, rightX, y + 100);

      // 学習時間
      const sessionTime = Math.floor((Date.now() - this.practiceStats.startTime) / 1000 / 60);
      this.ctx.fillText(`学習時間: ${sessionTime}分`, rightX, y + 115);

      // 下部：クイック統計
      const bottomY = y + h - 25;
      this.ctx.font = '11px "UDデジタル教科書体", sans-serif';
      this.ctx.fillStyle = '#bdc3c7';
      
      const quickStats = [
        `残り未マスター: ${this.unmasteredKanji.length}件`,
        `今回正解: ${sessionCorrect}/${sessionTotal}問`,
        sessionTotal > 0 ? `平均応答時間: ${Math.round(sessionTime * 60 / sessionTotal)}秒` : '応答時間: -'
      ].join(' | ');
      
      this.ctx.textAlign = 'center';
      this.ctx.fillText(quickStats, x + w/2, bottomY);
      
    } catch (error) {
      console.error('❌ 拡張進捗パネル描画エラー:', error);
    }
  },

  /**
   * 🎯 練習モードバッジ
   */
  _drawPracticeModeBadge() {
    if (!this.ctx) return;
    
    try {
      const { x, y, w, h } = this.panelConfig.modeBadge;
      
      // バッジ背景
      this.ctx.fillStyle = 'rgba(76, 175, 80, 0.95)';
      this.ctx.fillRect(x, y, w, h);
      
      this.ctx.strokeStyle = 'rgba(56, 142, 60, 1)';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(x, y, w, h);
      
      // アイコンとテキスト
      this.ctx.fillStyle = 'white';
      this.ctx.font = 'bold 16px "UDデジタル教科書体", sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('📚 練習モード', x + w/2, y + h/2);
      
    } catch (error) {
      console.error('❌ 練習モードバッジ描画エラー:', error);
    }
  },

  /**
   * 📋 詳細統計パネル
   */
  _drawDetailedStatsPanel() {
    if (!this.ctx || this.practiceStats.totalPracticed === 0) return;
    
    try {
      const { x, y, w, h } = this.panelConfig.stats;
      
      // パネル背景
      this.ctx.fillStyle = 'rgba(30, 60, 114, 0.9)';
      this.ctx.fillRect(x, y, w, h);
      
      this.ctx.strokeStyle = '#2196f3';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(x, y, w, h);
      
      // 統計テキスト
      const { totalPracticed, correctCount, sessionStreak } = this.practiceStats;
      const accuracy = Math.round((correctCount / totalPracticed) * 100);
      
      this.ctx.fillStyle = 'white';
      this.ctx.font = 'bold 14px "UDデジタル教科書体", sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'middle';
      
      const statsText = `📈 セッション統計: ${totalPracticed}問練習 | 正答率${accuracy}% | 連続正答${sessionStreak}問 | ${correctCount}正解/${totalPracticed - correctCount}不正解`;
      this.ctx.fillText(statsText, x + 15, y + h/2);
      
    } catch (error) {
      console.error('❌ 詳細統計パネル描画エラー:', error);
    }
  },

  /**
   * パネル背景を描画
   */
  _drawPanelBackground(ctx, x, y, width, height, style = 'default') {
    try {
      ctx.save();
      
      let bgColor = 'rgba(0, 0, 0, 0.7)';
      if (style === 'stone') {
        bgColor = 'rgba(50, 50, 60, 0.85)';
      }
      
      ctx.fillStyle = bgColor;
      ctx.fillRect(x, y, width, height);
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);
      
      if (style === 'stone') {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
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
      ctx.font = 'bold 9px "UDデジタル教科書体",sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#3498db';
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;

      const label = 'MASTER';
      const padX = 4, padY = 2;
      const w = ctx.measureText(label).width + padX * 2;
      const h = 14;
      const rx = 3;
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
      ctx.fillText(label, x - padX, top + 2);
      ctx.restore();
      
    } catch (error) {
      console.error('❌ MASTERバッジ描画エラー:', error);
    }
  },

  /**
   * 練習ログにメッセージを追加
   */
  _addToPracticeLog(message) {
    try {
      if (!Array.isArray(battleState.log)) battleState.log = [];
      battleState.log.push(message);
      
      if (this.startTypewriterEffect) {
        this.startTypewriterEffect(message);
      }
      
    } catch (error) {
      console.error('❌ ログ追加エラー:', error);
    }
  },

  /**
   * 全漢字マスター完了メッセージ
   */
  _showAllMasteredMessage() {
    try {
      this._addToPracticeLog('このステージの漢字は全てマスター済みです！');
      this._addToPracticeLog('素晴らしい！完璧です！');
      
      setTimeout(() => {
        this._completePractice();
      }, 2000);
      
    } catch (error) {
      console.error('❌ 全マスターメッセージエラー:', error);
    }
  },

  /**
   * 練習完了処理
   */
  _completePractice() {
    try {
      const { totalPracticed, correctCount } = this.practiceStats;
      const accuracy = totalPracticed > 0 ? Math.round((correctCount / totalPracticed) * 100) : 0;
      const sessionTime = Math.floor((Date.now() - this.practiceStats.startTime) / 1000 / 60);
      
      this._addToPracticeLog('練習完了！お疲れさまでした！');
      this._addToPracticeLog(`統計: ${totalPracticed}問中 ${correctCount}問正解 (正答率${accuracy}%) 学習時間${sessionTime}分`);
      
      console.log('🎯 練習完了:', this.practiceStats);
      
      publish('playSE', 'stageClear');
      
      setTimeout(() => {
        if (this.onPracticeComplete) {
          this.onPracticeComplete();
        } else {
          publish('changeScreen', 'stageSelect');
        }
      }, 2500);
      
    } catch (error) {
      console.error('❌ 練習完了処理エラー:', error);
      publish('changeScreen', 'stageSelect');
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
        this._addToPracticeLog(`「${currentKanji.text}」をマスターしました！`);
        
        if (this.masteryFlash) {
          this.masteryFlash = { 
            active: true, 
            timer: 30, 
            kanjiId: currentKanji.id 
          };
        }
        
        publish('playSE', 'levelUp');
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
      
      gameState.gameMode = 'normal';
      
      console.log('🎯 練習バトル画面を終了しました');
      
    } catch (error) {
      console.error('❌ 終了処理エラー:', error);
    }
  }
};

export default practiceBattleScreenState;