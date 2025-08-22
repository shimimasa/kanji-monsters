// 練習バトル画面 - 最終最適化版（ログ削除＆読み表示）

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

  // 📐 最適化されたレイアウト設定（ログエリア削除後）
  panelConfig: {
    // 前回の漢字パネル（読み表示付きで少し拡大）
    previous: { x: 20, y: 70, w: 180, h: 200 },
    // 現在学習中漢字パネル（少し拡大）
    current: { x: 20, y: 280, w: 180, h: 160 },
    // 練習モードバッジ（下に移動）
    modeBadge: { x: 20, y: 450, w: 140, h: 35 },
    // 拡張マスター進捗パネル（少し拡大）
    progress: { x: 480, y: 10, w: 300, h: 180 },
    // 簡易統計バー（上部に移動）
    quickStats: { x: 300, y: 20, w: 160, h: 30 }
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
      
      // ログは最小限に（練習開始時のみ）
      if (!Array.isArray(battleState.log)) battleState.log = [];
      
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
        return; // ヒント上限に達した場合は何もしない
      }
      
      const level = current + 1;
      gameState.hintLevel = level;
      
      // ヒントは内部処理のみ（ログには出力しない）
      console.log(`💡 ヒントレベル${level}を表示`);
      
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
      
      // 前回の答えを保存（正確な読み情報付き）
      battleState.lastAnswered = { 
        ...gameState.currentKanji,
        correctAnswer: answer // 実際に正解した読みを記録
      };
      
      // 不正解記録をクリア
      this.lastIncorrectAnswer = null;
      
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
      
      console.log(`✅ 正解: ${gameState.currentKanji.text} = ${answer}`);
      
      setTimeout(() => {
        this._pickNextUnmasteredKanji();
        battleState.turn = 'player';
        battleState.inputEnabled = true;
      }, 1000); // 少し短縮
      
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
      // 前回の答えを保存（不正解の場合でも読み情報は保存）
      battleState.lastAnswered = { 
        ...gameState.currentKanji,
        incorrectAnswer: answer // 間違えた読みを記録
      };
      
      publish('playSE', 'wrong');
      
      console.log(`❌ 不正解: ${gameState.currentKanji.text} ≠ ${answer}`);
      
      // 同じ問題を継続（短縮）
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
   * 画面の描画更新（ログエリアなし版）
   */
  update(dt) {
    try {
      const originalEnemy = gameState.currentEnemy;
      const originalEnemies = gameState.enemies;
      
      gameState.currentEnemy = null;
      gameState.enemies = [];
      
      // 通常描画（ログ部分をスキップ）
      this._drawMinimalBattleUI(dt);
      
      // 🎨 最適化されたUIを描画
      this._hideEnemyAndPlayerUIAreas();
      this._drawOptimizedPracticeUI();
      
      gameState.currentEnemy = originalEnemy;
      gameState.enemies = originalEnemies;
      
    } catch (error) {
      console.error('❌ 描画更新エラー:', error);
    }
  },

  /**
   * 最小限のバトルUI描画（ログなし）
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

    // ② 上部ボタン描画
    const BTN = {
      back:   { x: 20,  y: 20,  w: 100, h: 30,  label: 'タイトルへ' },
      stage:  { x: 140, y: 20,  w: 120, h: 30,  label: 'ステージ選択' },
    };

    [BTN.back, BTN.stage].forEach(b => {
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
    const kanjiX = this.canvas.width / 2;
    const kanjiY = 200;
    const kanjiBoxW = 180, kanjiBoxH = 160;
    
    let offsetX = 0, offsetY = 0, alpha = 1;
    if (this.shakeEffect && this.shakeEffect.active) {
      const intensity = this.shakeEffect.intensity * (this.shakeEffect.timer / this.shakeEffect.duration);
      offsetX = (Math.random() * 2 - 1) * intensity;
      offsetY = (Math.random() * 2 - 1) * intensity;
    }

    const adjustedX = kanjiX - (kanjiBoxW / 2) + offsetX;
    const adjustedY = kanjiY - (kanjiBoxH / 2) + offsetY;

    // 石版パネル描画
    if (typeof drawStonePanel === 'function') {
      drawStonePanel(this.ctx, adjustedX, adjustedY, kanjiBoxW, kanjiBoxH);
    } else {
      this.ctx.fillStyle = 'rgba(50, 50, 60, 0.85)';
      this.ctx.fillRect(adjustedX, adjustedY, kanjiBoxW, kanjiBoxH);
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(adjustedX, adjustedY, kanjiBoxW, kanjiBoxH);
    }

    // 漢字表示
    if (gameState.currentKanji) {
      this.ctx.font = '80px serif';
      this.ctx.fillStyle = 'white';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      this.ctx.shadowBlur = 5;
      this.ctx.shadowOffsetX = 3;
      this.ctx.shadowOffsetY = 3;
      this.ctx.fillText(gameState.currentKanji.text, adjustedX + kanjiBoxW / 2, adjustedY + kanjiBoxH / 2);
      this.ctx.shadowColor = 'transparent';
      this.ctx.shadowBlur = 0;
      this.ctx.shadowOffsetX = 0;
      this.ctx.shadowOffsetY = 0;
    }

    // ④ 石版攻撃エフェクト
    if (this.stoneAttackEffect && this.stoneAttackEffect.active) {
      this.drawStoneAttackEffect(adjustedX, adjustedY, kanjiBoxW, kanjiBoxH);
    }

    // ⑤ アクションボタン描画
    const actionBTN = {
      attack: { x: 230, y: 380, w: 110, h: 50, label: "こうげき" },
      heal:   { x: 350, y: 380, w: 110, h: 50, label: "かいふく" },
      hint:   { x: 470, y: 380, w: 110, h: 50, label: "ヒント" },
    };

    const mode = battleState.lastCommandMode || 'attack';
    
    Object.entries(actionBTN).forEach(([key, btn]) => {
      const isSelected = (mode === key);
      const isHovered = this.mouseX && this.mouseY ? 
        (this.mouseX >= btn.x && this.mouseX <= btn.x + btn.w && this.mouseY >= btn.y && this.mouseY <= btn.y + btn.h) : false;
      
      this.ctx.fillStyle = isSelected ? '#e74c3c' : (isHovered ? '#4e6d8c' : '#2980b9');
      this.ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
      
      this.ctx.fillStyle = 'white';
      this.ctx.font = 'bold 16px "UDデジタル教科書体", sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(btn.label, btn.x + btn.w/2, btn.y + btn.h/2);
      
      this.ctx.strokeStyle = 'white';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);
    });

    // ⑥ エフェクト更新
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
        this.ctx.drawImage(this.stageBgImage, 20, 500, 280, 100, 20, 500, 280, 100);
      } else {
        this.ctx.fillStyle = bgGradient;
        this.ctx.fillRect(20, 500, 280, 100); // プレイヤーステータスパネル
      }
      
      this.ctx.restore();
      
    } catch (error) {
      console.error('❌ UIエリア隠しエラー:', error);
    }
  },

  /**
   * 🎨 最適化されたUIを描画（ログなし版）
   */
  _drawOptimizedPracticeUI() {
    try {
      this._drawPreviousKanjiPanelWithReadings();  // 前回漢字（読み付き）
      this._drawCurrentKanjiDetailPanel();         // 現在漢字詳細
      this._drawEnhancedProgressPanel();           // 拡張進捗パネル
      this._drawPracticeModeBadge();               // 練習モードバッジ
      this._drawQuickStatsBar();                   // 簡易統計バー
    } catch (error) {
      console.error('❌ 最適化UI描画エラー:', error);
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
      
      // 画数と意味
      this.ctx.fillText(`画数: ${battleState.lastAnswered.strokes}画`, x + 10, infoY);
      infoY += 16;
      
      if (battleState.lastAnswered.meaning) {
        const meaning = battleState.lastAnswered.meaning.length > 14 
          ? battleState.lastAnswered.meaning.substring(0, 14) + '...'
          : battleState.lastAnswered.meaning;
        this.ctx.fillText(`意味: ${meaning}`, x + 10, infoY);
        infoY += 16;
      }

      // 🆕 正確な読み表示
      this.ctx.fillStyle = '#e8f5e8';
      this.ctx.fillText('正しい読み:', x + 10, infoY);
      infoY += 16;

      // 音読み表示
      const onyomiArr = battleState.lastAnswered.onyomi || [];
      if (onyomiArr.length > 0) {
        this.ctx.fillStyle = '#f39c12';
        this.ctx.fillText(`音: ${onyomiArr.join('、')}`, x + 15, infoY);
        infoY += 16;
      }

      // 訓読み表示
      const kunyomiArr = battleState.lastAnswered.kunyomi || [];
      if (kunyomiArr.length > 0) {
        this.ctx.fillStyle = '#2ecc71';
        this.ctx.fillText(`訓: ${kunyomiArr.join('、')}`, x + 15, infoY);
        infoY += 16;
      }

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
      const prog = gameState.kanjiReadProgress && gameState.kanjiReadProgress[battleState.lastAnswered.id];
      if (prog && prog.mastered) {
        this._drawMasterBadge(this.ctx, x + w - 8, y + 8);
      }
      
    } catch (error) {
      console.error('❌ 前回漢字パネル描画エラー:', error);
    }
  },

  /**
   * 📚 現在学習中漢字の詳細パネル（読みなし・拡大版）
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

      // 詳細情報（読みは表示しない）
      this.ctx.font = '12px "UDデジタル教科書体",sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.fillStyle = 'white';
      
      let infoY = y + 85;
      
      // 画数
      this.ctx.fillText(`画数: ${gameState.currentKanji.strokes}画`, x + 12, infoY);
      infoY += 16;
      
      // 意味（詳細表示）
      if (gameState.currentKanji.meaning) {
        const meaning = gameState.currentKanji.meaning.length > 16 
          ? gameState.currentKanji.meaning.substring(0, 16) + '...'
          : gameState.currentKanji.meaning;
        this.ctx.fillText(`意味: ${meaning}`, x + 12, infoY);
        infoY += 16;
      }
      
      // 部首（あれば）
      if (gameState.currentKanji.radical) {
        this.ctx.fillText(`部首: ${gameState.currentKanji.radical}`, x + 12, infoY);
        infoY += 16;
      }
      
      // JLPTレベル（あれば）
      if (gameState.currentKanji.jlpt) {
        this.ctx.fillText(`JLPT: ${gameState.currentKanji.jlpt}`, x + 12, infoY);
        infoY += 16;
      }

      // 学習進捗ゲージ（拡大版）
      const prog = gameState.kanjiReadProgress && gameState.kanjiReadProgress[gameState.currentKanji.id];
      if (prog) {
        const gaugeY = y + h - 35;
        const gaugeW = w - 24;
        const gaugeH = 10;
        
        // 全体のゲージ背景
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        this.ctx.fillRect(x + 12, gaugeY, gaugeW, gaugeH);
        
        // 進捗計算
        const totalReadings = (gameState.currentKanji.onyomi || []).length + (gameState.currentKanji.kunyomi || []).length;
        const masteredReadings = (prog.onyomi ? prog.onyomi.size : 0) + (prog.kunyomi ? prog.kunyomi.size : 0);
        const progressRatio = totalReadings > 0 ? masteredReadings / totalReadings : 0;
        
        // 進捗バー
        this.ctx.fillStyle = progressRatio >= 1 ? '#2ecc71' : '#3498db';
        this.ctx.fillRect(x + 12, gaugeY, gaugeW * progressRatio, gaugeH);
        
        // 枠線
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x + 12, gaugeY, gaugeW, gaugeH);
        
        // 進捗テキスト
        this.ctx.font = '10px "UDデジタル教科書体",sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = 'white';
        this.ctx.fillText(`習得: ${masteredReadings}/${totalReadings}`, x + w/2, gaugeY + 22);
      }
      
    } catch (error) {
      console.error('❌ 現在漢字パネル描画エラー:', error);
    }
  },

  /**
   * 📈 拡張マスター進捗パネル（拡大版）
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
      this.ctx.font = 'bold 20px "UDデジタル教科書体", sans-serif';
      this.ctx.fillText('📊 学習進捗ダッシュボード', x + 18, y + 28);

      // 基本統計
      const stageKanji = getKanjiByStageId(gameState.currentStageId);
      const totalKanji = stageKanji.length;
      const masteredCount = totalKanji - this.unmasteredKanji.length;
      const progressPercent = Math.round((masteredCount / totalKanji) * 100);

      // 左側：マスター進捗
      this.ctx.font = 'bold 16px "UDデジタル教科書体", sans-serif';
      this.ctx.fillText('マスター進捗', x + 18, y + 55);
      
      this.ctx.font = 'bold 32px "UDデジタル教科書体", sans-serif';
      this.ctx.fillStyle = '#4caf50';
      this.ctx.fillText(`${masteredCount}`, x + 18, y + 85);
      
      this.ctx.font = 'bold 18px "UDデジタル教科書体", sans-serif';
      this.ctx.fillStyle = 'white';
      this.ctx.fillText(`/ ${totalKanji} (${progressPercent}%)`, x + 75, y + 85);

      // プログレスバー（大）
      const barX = x + 18;
      const barY = y + 95;
      const barW = w - 36;
      const barH = 14;
      
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
      const rightX = x + w/2 + 15;
      
      this.ctx.font = 'bold 16px "UDデジタル教科書体", sans-serif';
      this.ctx.fillStyle = 'white';
      this.ctx.fillText('本日の学習', rightX, y + 55);
      
      // 統計項目
      this.ctx.font = '13px "UDデジタル教科書体", sans-serif';
      let statY = y + 75;
      
      this.ctx.fillText(`練習回数: ${this.practiceStats.todaysPracticeCount}問`, rightX, statY);
      statY += 18;
      
      this.ctx.fillText(`連続正答: ${this.practiceStats.sessionStreak}問`, rightX, statY);
      statY += 18;
      
      const sessionTotal = this.practiceStats.totalPracticed;
      const sessionCorrect = this.practiceStats.correctCount;
      const sessionAccuracy = sessionTotal > 0 ? Math.round((sessionCorrect / sessionTotal) * 100) : 0;
      this.ctx.fillText(`セッション正答率: ${sessionAccuracy}%`, rightX, statY);
      statY += 18;

      const sessionTime = Math.floor((Date.now() - this.practiceStats.startTime) / 1000 / 60);
      this.ctx.fillText(`学習時間: ${sessionTime}分`, rightX, statY);

      // 下部：クイック統計
      const bottomY = y + h - 30;
      this.ctx.font = '12px "UDデジタル教科書体", sans-serif';
      this.ctx.fillStyle = '#bdc3c7';
      
      const quickStats = [
        `残り未マスター: ${this.unmasteredKanji.length}件`,
        `今回: ${sessionCorrect}/${sessionTotal}問正解`,
        sessionTotal > 0 ? `平均応答時間: ${Math.round(sessionTime * 60 / sessionTotal)}秒` : '応答時間: 計測中'
      ].join(' | ');
      
      this.ctx.textAlign = 'center';
      this.ctx.fillText(quickStats, x + w/2, bottomY);
      
    } catch (error) {
      console.error('❌ 拡張進捗パネル描画エラー:', error);
    }
  },

  /**
   * 🎯 練習モードバッジ（拡大版）
   */
  _drawPracticeModeBadge() {
    if (!this.ctx) return;
    
    try {
      const { x, y, w, h } = this.panelConfig.modeBadge;
      
      // バッジ背景
      this.ctx.fillStyle = 'rgba(76, 175, 80, 0.95)';
      this.ctx.fillRect(x, y, w, h);
      
      this.ctx.strokeStyle = 'rgba(56, 142, 60, 1)';
      this.ctx.lineWidth = 3;
      this.ctx.strokeRect(x, y, w, h);
      
      // アイコンとテキスト
      this.ctx.fillStyle = 'white';
      this.ctx.font = 'bold 18px "UDデジタル教科書体", sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('📚 練習モード', x + w/2, y + h/2);
      
    } catch (error) {
      console.error('❌ 練習モードバッジ描画エラー:', error);
    }
  },

  /**
   * 📊 簡易統計バー（上部配置）
   */
  _drawQuickStatsBar() {
    if (!this.ctx || this.practiceStats.totalPracticed === 0) return;
    
    try {
      const { x, y, w, h } = this.panelConfig.quickStats;
      
      // バー背景
      this.ctx.fillStyle = 'rgba(52, 73, 94, 0.9)';
      this.ctx.fillRect(x, y, w, h);
      
      this.ctx.strokeStyle = '#34495e';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(x, y, w, h);
      
      // 統計テキスト
      const { totalPracticed, correctCount, sessionStreak } = this.practiceStats;
      const accuracy = Math.round((correctCount / totalPracticed) * 100);
      
      this.ctx.fillStyle = 'white';
      this.ctx.font = 'bold 12px "UDデジタル教科書体", sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      
      const statsText = `🎯 ${totalPracticed}問 | ✅${accuracy}% | 🔥${sessionStreak}連続`;
      this.ctx.fillText(statsText, x + w/2, y + h/2);
      
    } catch (error) {
      console.error('❌ 簡易統計バー描画エラー:', error);
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
      const { totalPracticed, correctCount } = this.practiceStats;
      const accuracy = totalPracticed > 0 ? Math.round((correctCount / totalPracticed) * 100) : 0;
      const sessionTime = Math.floor((Date.now() - this.practiceStats.startTime) / 1000 / 60);
      
      console.log('🎯 練習完了:', {
        totalPracticed,
        correctCount, 
        accuracy: `${accuracy}%`,
        sessionTime: `${sessionTime}分`
      });
      
      publish('playSE', 'stageClear');
      
      setTimeout(() => {
        if (this.onPracticeComplete) {
          this.onPracticeComplete();
        } else {
          publish('changeScreen', 'stageSelect');
        }
      }, 2000);
      
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