// 練習バトル画面 - エラー修正版

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
    incorrectCount: 0
  },

  /**
   * 練習バトル画面への入場処理
   */
  enter(canvasEl, onComplete) {
    console.log('🎯 練習バトル開始:', gameState.currentStageId);
    
    try {
      this.onPracticeComplete = onComplete;
      gameState.gameMode = 'practice';
      
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
      // エラー時はステージ選択に戻る
      setTimeout(() => {
        publish('changeScreen', 'stageSelect');
      }, 100);
    }
  },

  /**
   * 練習モード専用のハンドラを設定
   */
  _setupPracticeHandlers() {
    console.log('🔧 練習モード用ハンドラを設定中...');
    
    try {
      // 元のメソッドを保存
      this._originalHandleAttack = this.handleAttack;
      this._originalHandleHeal = this.handleHeal;
      this._originalHandleHint = this.handleHint;
      
      // 練習モード用のメソッドで置き換え
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
      
      // 練習モード専用のキーハンドラを作成
      this._practiceKeydownHandler = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          console.log('⌨️ Enterキー押下');
          
          // 状態を強制的に修正
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
      
      // 既存のハンドラを削除してから新しいハンドラを追加
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
      
      this.practiceStats = {
        totalPracticed: 0,
        correctCount: 0,
        incorrectCount: 0
      };
      
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
          return true; // エラー時は未マスターとして扱う
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
      
      // 読み情報を安全に処理
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
      // 状態チェックと修正
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
      inputEl.value = '';
      
      if (isCorrect) {
        this._handlePracticeCorrect(answer);
      } else {
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
      
      if (isCorrect) {
        this._handlePracticeCorrect(answer, 'heal');
      } else {
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
      
      // 前回の答えを保存
      battleState.lastAnswered = { ...gameState.currentKanji };
      
      // 攻撃エフェクト
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
      
      // マスター進捗を更新
      const wasAlreadyMastered = this._isKanjiMastered(gameState.currentKanji.id);
      this._updateKanjiMasteryAfterCorrect(gameState.currentKanji, answer);
      const isNowMastered = this._isKanjiMastered(gameState.currentKanji.id);
      
      // 新しくマスターした場合、未マスターリストから削除
      if (!wasAlreadyMastered && isNowMastered) {
        this.unmasteredKanji = this.unmasteredKanji.filter(k => k.id !== gameState.currentKanji.id);
        console.log(`🎉 漢字「${gameState.currentKanji.text}」が新しくマスターされました！`);
        console.log(`📚 残り未マスター漢字: ${this.unmasteredKanji.length}件`);
      }
      
      // メッセージ
      const onyomiStr = (gameState.currentKanji.onyomi || []).join('、');
      const kunyomiStr = (gameState.currentKanji.kunyomi || []).join('、');
      const readingMsg = `正しい読み: 音「${onyomiStr}」訓「${kunyomiStr}」`;
      
      const actionMsg = actionType === 'heal' ? 'かいふくせいこう！' : 'せいかい！';
      this._addToPracticeLog(`${actionMsg} ${readingMsg}`);
      
      console.log(`✅ 正解: ${gameState.currentKanji.text} = ${answer}`);
      
      // 次の問題へ
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
      
      // 同じ問題を継続
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

      // ボタン定義
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

      // ボタン判定
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
      // 敵を一時的に無効化
      const originalEnemy = gameState.currentEnemy;
      const originalEnemies = gameState.enemies;
      
      gameState.currentEnemy = null;
      gameState.enemies = [];
      
      // 通常描画
      if (battleScreenState.update) {
        battleScreenState.update.call(this, dt);
      }
      
      // 敵UIエリアを隠す
      this._hideEnemyUIArea();
      
      // プレイヤーUIエリアも隠す（練習モードでは不要）
      this._hidePlayerUIArea();
      
      // 1つまえの漢字パネル（大きいサイズ）
      this._drawPreviousKanjiPanel();
      
      // 練習モード情報
      this._drawPracticeInfo();
      
      // 元に戻す
      gameState.currentEnemy = originalEnemy;
      gameState.enemies = originalEnemies;
      
    } catch (error) {
      console.error('❌ 描画更新エラー:', error);
    }
  },

  /**
   * 敵UIエリアを隠す
   */
  _hideEnemyUIArea() {
    if (!this.ctx) return;
    
    try {
      this.ctx.save();
      
      // モンスター表示エリア
      const enemyAreaX = 480, enemyAreaY = 80, enemyAreaW = 280, enemyAreaH = 200;
      
      if (this.stageBgImage) {
        this.ctx.drawImage(
          this.stageBgImage,
          enemyAreaX, enemyAreaY, enemyAreaW, enemyAreaH,
          enemyAreaX, enemyAreaY, enemyAreaW, enemyAreaH
        );
      } else {
        const bgGradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        bgGradient.addColorStop(0, '#1e3c72');
        bgGradient.addColorStop(1, '#2a5298');
        this.ctx.fillStyle = bgGradient;
        this.ctx.fillRect(enemyAreaX, enemyAreaY, enemyAreaW, enemyAreaH);
      }
      
      // 敵ステータスパネル
      const panelX = this.canvas.width - 300, panelY = 10, panelW = 280, panelH = 120;
      
      if (this.stageBgImage) {
        this.ctx.drawImage(
          this.stageBgImage,
          panelX, panelY, panelW, panelH,
          panelX, panelY, panelW, panelH
        );
      } else {
        const panelGradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        panelGradient.addColorStop(0, '#1e3c72');
        panelGradient.addColorStop(1, '#2a5298');
        this.ctx.fillStyle = panelGradient;
        this.ctx.fillRect(panelX, panelY, panelW, panelH);
      }
      
      this.ctx.restore();
      
    } catch (error) {
      console.error('❌ 敵UIエリア隠しエラー:', error);
    }
  },

  /**
   * プレイヤーUIエリアを隠す（練習モードでは不要）
   */
  _hidePlayerUIArea() {
    if (!this.ctx) return;
    
    try {
      this.ctx.save();
      
      // プレイヤーステータスパネルエリア
      const playerPanelX = 20;
      const playerPanelY = this.canvas.height - 150;
      const playerPanelW = 280;
      const playerPanelH = 130;
      
      if (this.stageBgImage) {
        this.ctx.drawImage(
          this.stageBgImage,
          playerPanelX, playerPanelY, playerPanelW, playerPanelH,
          playerPanelX, playerPanelY, playerPanelW, playerPanelH
        );
      } else {
        const bgGradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        bgGradient.addColorStop(0, '#1e3c72');
        bgGradient.addColorStop(1, '#2a5298');
        this.ctx.fillStyle = bgGradient;
        this.ctx.fillRect(playerPanelX, playerPanelY, playerPanelW, playerPanelH);
      }
      
      this.ctx.restore();
      
    } catch (error) {
      console.error('❌ プレイヤーUIエリア隠しエラー:', error);
    }
  },

  /**
   * 1つまえの漢字パネルを描画（練習モード用大きいサイズ）
   */
  _drawPreviousKanjiPanel() {
    if (!this.ctx || !battleState.lastAnswered) return;
    
    try {
      // サイズを大きくする
      const bx = 20, by = 70, bw = 200, bh = 220;
      
      // パネル背景
      this._drawPanelBackground(this.ctx, bx, by, bw, bh, 'stone');

      this.ctx.fillStyle = 'white';
      this.ctx.textAlign = 'center';
      
      // タイトル
      this.ctx.font = 'bold 16px "UDデジタル教科書体",sans-serif';
      this.ctx.fillText('1つまえの漢字', bx + bw/2, by + 20);
      
      // 漢字本体（大きくする）
      this.ctx.font = '60px serif';
      this.ctx.fillText(battleState.lastAnswered.text, bx + bw/2, by + 80);

      // 読み進捗
      const prog = (gameState.kanjiReadProgress && gameState.kanjiReadProgress[battleState.lastAnswered.id]) || null;
      const progKun = prog ? prog.kunyomi : null;
      const progOn  = prog ? prog.onyomi  : null;

      // 読み表示（詳細版）
      let y = by + 120;
      
      // 音読み
      this.ctx.font = '14px "UDデジタル教科書体",sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.fillStyle = 'white';
      this.ctx.fillText('音読み:', bx + 15, y);
      
      const onyomiArr = battleState.lastAnswered.onyomi || [];
      let onyomiY = y + 20;
      onyomiArr.forEach((reading, index) => {
        const isMastered = progOn && progOn.has(reading);
        this.ctx.fillStyle = isMastered ? '#3498db' : 'white';
        this.ctx.fillText(`・${reading}`, bx + 20, onyomiY);
        onyomiY += 18;
      });

      // 訓読み
      const kunyomiStartY = Math.max(onyomiY + 10, y + 60);
      this.ctx.fillStyle = 'white';
      this.ctx.fillText('訓読み:', bx + 15, kunyomiStartY);
      
      const kunyomiArr = battleState.lastAnswered.kunyomi || [];
      let kunyomiY = kunyomiStartY + 20;
      kunyomiArr.forEach((reading, index) => {
        const isMastered = progKun && progKun.has(reading);
        this.ctx.fillStyle = isMastered ? '#3498db' : 'white';
        this.ctx.fillText(`・${reading}`, bx + 20, kunyomiY);
        kunyomiY += 18;
      });

      // 画数
      const strokesY = Math.max(kunyomiY + 10, kunyomiStartY + 60);
      this.ctx.fillStyle = 'white';
      this.ctx.fillText(`画数: ${battleState.lastAnswered.strokes}画`, bx + 15, strokesY);

      // 間違った答え
      if (this.lastIncorrectAnswer) {
        const errorY = strokesY + 25;
        this.ctx.fillStyle = 'rgba(231, 76, 60, 0.2)';
        this.ctx.fillRect(bx + 15, errorY, bw - 30, 25);
        this.ctx.strokeStyle = 'rgba(231, 76, 60, 0.8)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(bx + 15, errorY, bw - 30, 25);
        this.ctx.fillStyle = '#e74c3c';
        this.ctx.font = 'bold 13px "UDデジタル教科書体",sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`あなたの答え: ${this.lastIncorrectAnswer}`, bx + bw/2, errorY + 16);
      }

      // MASTERバッジ
      const isPrevMastered = !!(prog && prog.mastered);
      if (isPrevMastered) {
        this._drawMasterBadge(this.ctx, bx + bw - 8, by + 8);
      }
      
    } catch (error) {
      console.error('❌ 前回漢字パネル描画エラー:', error);
    }
  },

  /**
   * 練習モード専用情報の描画
   */
  _drawPracticeInfo() {
    if (!this.ctx) return;
    
    try {
      this.ctx.save();
      
      // 練習モードバッジ
      this.ctx.fillStyle = 'rgba(76, 175, 80, 0.9)';
      this.ctx.fillRect(10, 85, 120, 30);
      this.ctx.strokeStyle = 'rgba(56, 142, 60, 1)';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(10, 85, 120, 30);
      this.ctx.fillStyle = 'white';
      this.ctx.font = 'bold 16px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('練習モード', 70, 100);
      
      // 進捗情報（リアルタイム更新）
      const stageKanji = getKanjiByStageId(gameState.currentStageId);
      const totalKanji = stageKanji.length;
      // 現在の未マスターリストの長さを使用してリアルタイム計算
      const masteredCount = totalKanji - this.unmasteredKanji.length;
      
      const panelX = this.canvas.width - 280;
      const panelY = 10;
      const panelW = 260;
      const panelH = 100;
      
      // 進捗パネル背景
      this.ctx.fillStyle = 'rgba(30, 60, 114, 0.9)';
      this.ctx.fillRect(panelX, panelY, panelW, panelH);
      this.ctx.strokeStyle = '#4caf50';
      this.ctx.lineWidth = 3;
      this.ctx.strokeRect(panelX, panelY, panelW, panelH);
      
      // 進捗テキスト
      this.ctx.fillStyle = 'white';
      this.ctx.font = 'bold 18px "UDデジタル教科書体", sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('マスター進捗', panelX + panelW/2, panelY + 25);
      
      this.ctx.font = 'bold 24px "UDデジタル教科書体", sans-serif';
      this.ctx.fillStyle = '#4caf50';
      this.ctx.fillText(`${masteredCount} / ${totalKanji}`, panelX + panelW/2, panelY + 50);
      
      const progressPercent = Math.round((masteredCount / totalKanji) * 100);
      this.ctx.font = '16px "UDデジタル教科書体", sans-serif';
      this.ctx.fillStyle = 'white';
      this.ctx.fillText(`(${progressPercent}%)`, panelX + panelW/2, panelY + 75);
      
      // プログレスバー
      const barX = panelX + 20;
      const barY = panelY + 85;
      const barW = panelW - 40;
      const barH = 8;
      
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      this.ctx.fillRect(barX, barY, barW, barH);
      
      const progress = masteredCount / totalKanji;
      this.ctx.fillStyle = '#4caf50';
      this.ctx.fillRect(barX, barY, barW * progress, barH);
      
      this.ctx.strokeStyle = 'white';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(barX, barY, barW, barH);
      
      // 練習統計
      if (this.practiceStats.totalPracticed > 0) {
        const { totalPracticed, correctCount } = this.practiceStats;
        const accuracy = Math.round((correctCount / totalPracticed) * 100);
        
        this.ctx.fillStyle = 'rgba(30, 60, 114, 0.9)';
        this.ctx.fillRect(10, this.canvas.height - 50, 350, 30);
        this.ctx.strokeStyle = '#2196f3';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(10, this.canvas.height - 50, 350, 30);
        
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 14px "UDデジタル教科書体", sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(
          `練習統計: ${totalPracticed}問練習 正答率${accuracy}% (${correctCount}正解/${totalPracticed - correctCount}不正解)`, 
          20, this.canvas.height - 30
        );
      }
      
      this.ctx.restore();
      
    } catch (error) {
      console.error('❌ 練習モード情報描画エラー:', error);
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
        bgColor = 'rgba(50, 50, 60, 0.8)';
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
      ctx.font = 'bold 11px "UDデジタル教科書体",sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#3498db';
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 2;

      const label = 'MASTER';
      const padX = 6, padY = 3;
      const w = ctx.measureText(label).width + padX * 2;
      const h = 18;
      const rx = 5;
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
      
      this._addToPracticeLog('練習完了！お疲れさまでした！');
      this._addToPracticeLog(`統計: ${totalPracticed}問中 ${correctCount}問正解 (正答率${accuracy}%)`);
      
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
      
      // 正解した読みを進捗に追加
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
      
      // マスター判定
      const before = !!prog.mastered;
      const allKunOk = (currentKanji.kunyomi || []).every(r => prog.kunyomi.has(r));
      const allOnOk = (currentKanji.onyomi || []).every(r => prog.onyomi.has(r));
      prog.mastered = allKunOk && allOnOk;
      
      // 新しくマスターした場合
      if (!before && prog.mastered) {
        console.log(`🎉 漢字「${currentKanji.text}」をマスターしました！`);
        this._addToPracticeLog(`「${currentKanji.text}」をマスターしました！`);
        
        // マスター達成エフェクト
        if (this.masteryFlash) {
          this.masteryFlash = { 
            active: true, 
            timer: 30, 
            kanjiId: currentKanji.id 
          };
        }
        
        // マスター達成SE
        publish('playSE', 'levelUp');
      }
      
    } catch (error) {
      console.error('❌ マスター進捗更新エラー:', error);
    }
  },

  /**
   * 漢字がマスター済みかどうかを判定するヘルパーメソッド
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
      // 元のメソッドを復元
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
      
      // キーハンドラも復元
      if (this.inputEl && this._practiceKeydownHandler) {
        this.inputEl.removeEventListener('keydown', this._practiceKeydownHandler);
        this._practiceKeydownHandler = null;
      }
      
      // 元のexitメソッドを呼び出し
      if (battleScreenState.exit) {
        battleScreenState.exit.call(this);
      }
      
      // 練習モード固有のクリーンアップ
      this.practiceMode = false;
      this.onPracticeComplete = null;
      this.unmasteredKanji = [];
      this.lastIncorrectAnswer = null;
      
      // ゲームモードをリセット
      gameState.gameMode = 'normal';
      
      console.log('🎯 練習バトル画面を終了しました');
      
    } catch (error) {
      console.error('❌ 終了処理エラー:', error);
    }
  }
};

export default practiceBattleScreenState;