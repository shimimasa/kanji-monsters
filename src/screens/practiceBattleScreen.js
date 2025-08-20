// src/screens/practiceBattleScreen.js
// 練習バトル画面 - 敵なしで漢字の練習ができる画面

import battleScreenState from './battleScreen.js';
import { gameState, battleState } from '../core/gameState.js';
import { getKanjiByStageId, isKanjiMastered } from '../loaders/dataLoader.js';
import { publish } from '../core/eventBus.js';

// ★★★ battleScreenStateを継承して練習モード専用の画面を作成 ★★★
const practiceBattleScreenState = {
  // 既存のbattleScreenStateの全機能を継承
  ...battleScreenState,
  
  // 練習モード専用のプロパティ
  practiceMode: true,           // 練習モード識別フラグ
  onPracticeComplete: null,     // 練習完了時のコールバック関数
  unmasteredKanji: [],          // 未マスターの漢字リスト
  currentUnmasteredIndex: 0,    // 現在の未マスター漢字インデックス
  practiceStats: {              // 練習用の統計情報
    totalPracticed: 0,          // 練習した問題数
    correctCount: 0,            // 正解数
    incorrectCount: 0           // 不正解数
  },

   /**
   * ログにメッセージを追加する（battleScreenの機能を流用）
   */
   _addToLog(message) {
    if (!Array.isArray(battleState.log)) battleState.log = [];
    battleState.log.push(message);
    console.log('📝 ログ追加:', message);
  },

  /**
   * 練習バトル画面への入場処理（battleScreenのenterをオーバーライド）
   * @param {HTMLCanvasElement} canvasEl キャンバス要素
   * @param {Function} onComplete 練習完了時のコールバック
   */
  enter(canvasEl, onComplete) {
    console.log('🎯 練習バトル開始:', gameState.currentStageId);
    
    // 練習完了時のコールバックを保存
    this.onPracticeComplete = onComplete;
    
    // 練習モードフラグを設定
    gameState.gameMode = 'practice';
    
    // 基本的な初期化は親クラス（battleScreen）の処理を活用
    // ただし、敵関連の初期化はスキップするため、部分的に初期化
    this._initializePracticeCanvas(canvasEl);
    this._initializePracticeData();
    this._initializePracticeUI();
    
    // 練習開始メッセージ
    console.log('📚 練習モードを開始しました');
  },

  /**
   * 練習用のキャンバス初期化
   * @param {HTMLCanvasElement} canvasEl キャンバス要素
   */
  _initializePracticeCanvas(canvasEl) {
    // キャンバス設定（battleScreenと同じ）
    this.canvas = canvasEl || document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    
    if (!this.ctx) {
      throw new Error("Canvas 2Dコンテキストの取得に失敗しました");
    }
    
    // 入力欄の設定
    this.inputEl = document.getElementById('kanjiInput');
    if (this.inputEl) {
      this.inputEl.style.display = 'block';
      this.inputEl.placeholder = 'よみを にゅうりょく（練習モード）';
      
      // Enterキーでの攻撃処理
      this._keydownHandler = e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (battleState.turn === 'player' && battleState.inputEnabled) {
            this.handlePracticeAttack();
          }
        }
      };
      this.inputEl.addEventListener('keydown', this._keydownHandler);
    }
  },

  /**
   * 練習用のデータ初期化
   */
  _initializePracticeData() {
    // 敵は設定しない（練習モードでは敵がいない）
    gameState.currentEnemy = null;
    gameState.enemies = [];
    
    // プレイヤーのHP設定（練習では減らない）
    gameState.playerStats.hp = gameState.playerStats.maxHp;
    
    // バトル状態の初期化
    battleState.turn = 'player';
    battleState.inputEnabled = true;
    battleState.comboCount = 0;
    battleState.message = '';
    
    // 練習統計をリセット
    this.practiceStats = {
      totalPracticed: 0,
      correctCount: 0,
      incorrectCount: 0
    };
    
    // 未マスター漢字リストを構築
    this._buildUnmasteredKanjiList();
    
    // 最初の問題を出題
    this._pickNextUnmasteredKanji();
  },

  /**
   * 練習用のUI初期化
   */
  _initializePracticeUI() {
    // ヒントレベルをリセット
    gameState.hintLevel = 0;
    
    // イベントハンドラを登録
    this.registerHandlers();

    // ★★★ _addToLogを使用 ★★★
    battleState.log = [];
    this._addToLog('練習モードを開始します！');
    this._addToLog('すべての漢字をマスターしよう！');

  },

  /**
   * 未マスターの漢字リストを構築
   */
  _buildUnmasteredKanjiList() {
    const stageKanji = getKanjiByStageId(gameState.currentStageId);
    this.unmasteredKanji = stageKanji.filter(kanji => !isKanjiMastered(kanji.id));
    
    console.log(`📚 未マスター漢字: ${this.unmasteredKanji.length}件 / 全${stageKanji.length}件`);
    
    // 全ての漢字がマスター済みの場合
    if (this.unmasteredKanji.length === 0) {
      this._showAllMasteredMessage();
      return;
    }
  },

  /**
   * 次の未マスター漢字を出題
   */
  _pickNextUnmasteredKanji() {
    // 未マスターリストを再構築（リアルタイムでマスター状況を反映）
    this._buildUnmasteredKanjiList();
    
    if (this.unmasteredKanji.length === 0) {
      // 全ての漢字をマスター完了
      this._completePractice();
      return;
    }
    
    // ランダムに1つ選択
    const randomIndex = Math.floor(Math.random() * this.unmasteredKanji.length);
    const selectedKanji = this.unmasteredKanji[randomIndex];
    
    // 現在の問題として設定
    this._setCurrentKanji(selectedKanji);
    
    // ★★★ _addToLogを使用 ★★★
    this._addToLog(`「${selectedKanji.kanji}」を読もう！`);
  },

  /**
   * 現在の漢字を設定（battleScreenの処理を流用）
   * @param {Object} kanjiData 漢字データ
   */
  _setCurrentKanji(kanjiData) {
    gameState.currentKanji = {
      id: kanjiData.id,
      text: kanjiData.kanji,
      kunyomi: Array.isArray(kanjiData.kunyomi) ? kanjiData.kunyomi : [],
      onyomi: Array.isArray(kanjiData.onyomi) ? kanjiData.onyomi : [],
      meaning: kanjiData.meaning,
      strokes: kanjiData.strokes,
    };
  },

  /**
   * 練習での攻撃処理（正解判定）
   */
  handlePracticeAttack() {
    if (battleState.turn !== 'player' || !battleState.inputEnabled) return;
    
    const inputEl = this.inputEl;
    if (!inputEl) {
      battleState.inputEnabled = true;
      return;
    }
    
    battleState.inputEnabled = false;
    const raw = inputEl.value.trim();
    const answer = this._toHiragana(raw);
    
    // 正解の読みを取得
    const correctReadings = this._getReadings(gameState.currentKanji);
    const isCorrect = correctReadings.includes(answer);
    
    // 統計更新
    this.practiceStats.totalPracticed++;
    
    if (isCorrect) {
      this._handlePracticeCorrect(answer);
    } else {
      this._handlePracticeIncorrect(answer);
    }
    
    // 入力欄をクリア
    inputEl.value = '';
  },

  /**
   * 練習での正解処理
   * @param {string} answer プレイヤーの回答
   */
  _handlePracticeCorrect(answer) {
    this.practiceStats.correctCount++;
    
    // マスター進捗を更新
    this._updateKanjiMasteryAfterCorrect(gameState.currentKanji, answer);
    
    // 正解エフェクト（battleScreenの機能を流用）
    if (this.startKanjiBoxEffect) {
      this.startKanjiBoxEffect('rgba(46, 204, 113, 0.8)', 20);
    }
    
    // 正解SE
    publish('playSE', 'correct');
    
    // 正解メッセージ
    const readingMsg = this._buildReadingMessage();
    // ★★★ _addToLogを使用 ★★★
    this._addToLog(`せいかい！ ${readingMsg}`);
    
    console.log(`✅ 正解: ${gameState.currentKanji.text} = ${answer}`);
    
    // 次の問題へ（1.5秒後）
    setTimeout(() => {
      this._pickNextUnmasteredKanji();
      battleState.inputEnabled = true;
    }, 1500);
  },

  /**
   * 練習での不正解処理
   * @param {string} answer プレイヤーの回答
   */
  _handlePracticeIncorrect(answer) {
    this.practiceStats.incorrectCount++;
    
    // 不正解SE
    publish('playSE', 'wrong');
    
    // 不正解メッセージ
    const readingMsg = this._buildReadingMessage();

    // ★★★ _addToLogを使用 ★★★
    this._addToLog(`ちがいます。${readingMsg}`);
    this._addToLog('もう一度挑戦しよう！');
    
    console.log(`❌ 不正解: ${gameState.currentKanji.text} ≠ ${answer}`);
    
    // 同じ問題を継続（1.5秒後）
    setTimeout(() => {
      battleState.inputEnabled = true;
    }, 1500);
  },

  /**
   * 全漢字マスター完了メッセージ
   */
  _showAllMasteredMessage() {
    // ★★★ _addToLogを使用 ★★★
    this._addToLog('このステージの漢字は全てマスター済みです！');
    this._addToLog('素晴らしい！完璧です！');
    
    setTimeout(() => {
      this._completePractice();
    }, 2000);
  },

  /**
   * 練習完了処理
   */
  _completePractice() {
    // 完了統計を表示
    const { totalPracticed, correctCount, incorrectCount } = this.practiceStats;
    const accuracy = totalPracticed > 0 ? Math.round((correctCount / totalPracticed) * 100) : 0;
    
    // ★★★ _addToLogを使用 ★★★
    this._addToLog('練習完了！お疲れさまでした！');
    this._addToLog(`統計: ${totalPracticed}問中 ${correctCount}問正解 (正答率${accuracy}%)`);
    this._addToLog('実戦バトルに挑戦してみよう！');
    
    console.log('🎯 練習完了:', this.practiceStats);
    
    // 完了SE
    publish('playSE', 'stageClear');
    
    // 練習進捗を更新
    this._updatePracticeProgress();
    
    // 画面遷移（2.5秒後）
    setTimeout(() => {
      if (this.onPracticeComplete) {
        this.onPracticeComplete();
      } else {
        publish('changeScreen', 'stageSelect');
      }
    }, 2500);
  },

  /**
   * 練習進捗を更新
   */
  _updatePracticeProgress() {
    if (!gameState.practiceProgress) {
      gameState.practiceProgress = {};
    }
    
    gameState.practiceProgress[gameState.currentStageId] = {
      allMastered: this.unmasteredKanji.length === 0,
      lastPracticed: Date.now(),
      stats: { ...this.practiceStats }
    };
    
    // セーブデータに保存
    try {
      const saveData = JSON.parse(localStorage.getItem('kanjiGameSave') || '{}');
      saveData.practiceProgress = gameState.practiceProgress;
      localStorage.setItem('kanjiGameSave', JSON.stringify(saveData));
    } catch (error) {
      console.warn('練習進捗の保存に失敗:', error);
    }
  },

  /**
   * 画面の描画更新（battleScreenのupdateをオーバーライド）
   */
  update(dt) {
    // 基本的な描画処理は親クラスを活用（ただし敵は描画しない）
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // 背景描画
    this._drawPracticeBackground();
    
    // 練習モードのヘッダー描画
    this._drawPracticeHeader();
    
    // 漢字表示（battleScreenの機能を流用）
    this._drawCurrentKanji();
    
    // プレイヤーステータス（HP減少なし版）
    this._drawPracticePlayerStatus();
    
    // 練習統計表示
    this._drawPracticeStats();
    
    // メッセージログ（battleScreenの機能を流用）
    if (battleState.log && battleState.log.length > 0) {
      this._drawMessageLog();
    }
    
    // ボタン類（battleScreenと同じ）
    this._drawPracticeButtons();
    
    // 入力欄の位置調整（battleScreenと同じ）
    this._adjustInputPosition();
  },

  /**
   * 練習モード用の背景描画
   */
  _drawPracticeBackground() {
    // やわらかい緑色のグラデーション（練習用の落ち着いた色合い）
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, '#e8f5e8');  // 薄い緑
    gradient.addColorStop(1, '#c8e6c9');  // 少し濃い緑
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  },

  /**
   * 練習モードのヘッダー描画
   */
  _drawPracticeHeader() {
    // 練習モードタイトル
    this.ctx.fillStyle = '#2e7d32';
    this.ctx.font = 'bold 24px "UDデジタル教科書体", sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText('練習モード', this.canvas.width / 2, 20);
    
    // 進捗表示
    const stageKanji = getKanjiByStageId(gameState.currentStageId);
    const totalKanji = stageKanji.length;
    const masteredCount = totalKanji - this.unmasteredKanji.length;
    const progressText = `マスター進捗: ${masteredCount}/${totalKanji} (${Math.round((masteredCount / totalKanji) * 100)}%)`;
    
    this.ctx.fillStyle = '#4caf50';
    this.ctx.font = '16px "UDデジタル教科書体", sans-serif';
    this.ctx.fillText(progressText, this.canvas.width / 2, 50);
    
    // プログレスバー
    const barWidth = 300;
    const barHeight = 10;
    const barX = (this.canvas.width - barWidth) / 2;
    const barY = 75;
    
    // 背景
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    this.ctx.fillRect(barX, barY, barWidth, barHeight);
    
    // 進捗
    const progress = masteredCount / totalKanji;
    this.ctx.fillStyle = '#4caf50';
    this.ctx.fillRect(barX, barY, barWidth * progress, barHeight);
    
    // 枠線
    this.ctx.strokeStyle = '#2e7d32';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(barX, barY, barWidth, barHeight);
  },

  /**
   * 練習統計の描画
   */
  _drawPracticeStats() {
    const stats = this.practiceStats;
    const accuracy = stats.totalPracticed > 0 ? 
      Math.round((stats.correctCount / stats.totalPracticed) * 100) : 0;
    
    // 統計パネル
    const panelX = 20;
    const panelY = this.canvas.height - 120;
    const panelW = 200;
    const panelH = 80;
    
    // 背景
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    this.ctx.fillRect(panelX, panelY, panelW, panelH);
    this.ctx.strokeStyle = '#4caf50';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(panelX, panelY, panelW, panelH);
    
    // 統計テキスト
    this.ctx.fillStyle = '#2e7d32';
    this.ctx.font = '14px "UDデジタル教科書体", sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    
    this.ctx.fillText('練習統計', panelX + 10, panelY + 10);
    this.ctx.fillText(`問題数: ${stats.totalPracticed}`, panelX + 10, panelY + 30);
    this.ctx.fillText(`正解: ${stats.correctCount} 不正解: ${stats.incorrectCount}`, panelX + 10, panelY + 50);
    if (stats.totalPracticed > 0) {
      this.ctx.fillText(`正答率: ${accuracy}%`, panelX + 10, panelY + 70);
    }
  },

  // ★★★ 以下、battleScreenの機能を流用するためのヘルパーメソッド ★★★

  /**
   * ひらがな変換（battleScreenから流用）
   */
  _toHiragana(input) {
    if (!input) return '';
    let normalized = input.trim().replace(/\s+/g, '');
    return normalized.replace(/[\u30a1-\u30f6]/g, ch => 
      String.fromCharCode(ch.charCodeAt(0) - 0x60)
    );
  },

  /**
   * 読み取得（battleScreenから流用）
   */
  _getReadings(kanji) {
    const set = new Set();
    if (kanji.kunyomi) {
      kanji.kunyomi.forEach(r => r && set.add(this._toHiragana(r.trim())));
    }
    if (kanji.onyomi) {
      kanji.onyomi.forEach(r => r && set.add(this._toHiragana(r.trim())));
    }
    return [...set].filter(Boolean);
  },

  /**
   * 読みメッセージ構築
   */
  _buildReadingMessage() {
    const onyomiStr = (gameState.currentKanji.onyomi || []).join('、');
    const kunyomiStr = (gameState.currentKanji.kunyomi || []).join('、');
    return `正しい読み: 音「${onyomiStr}」訓「${kunyomiStr}」`;
  },

  /**
   * マスター進捗更新（簡易版）
   */
  _updateKanjiMasteryAfterCorrect(currentKanji, answer) {
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
    if (isKun) prog.kunyomi.add(answer);
    if (isOn) prog.onyomi.add(answer);
    
    const allKunOk = (currentKanji.kunyomi || []).every(r => prog.kunyomi.has(r));
    const allOnOk = (currentKanji.onyomi || []).every(r => prog.onyomi.has(r));
    prog.mastered = allKunOk && allOnOk;
    
    if (prog.mastered) {
      console.log(`🎉 漢字「${currentKanji.text}」をマスターしました！`);
      this._addToLog(`「${currentKanji.text}」をマスターしました！`);
    }
  },

  // ★★★ 以下、描画メソッドのスタブ（必要に応じてbattleScreenから実装をコピー） ★★★
  _drawCurrentKanji() {
    // battleScreenのdrawCurrentKanjiメソッドから実装をコピー
    // 現在の漢字を画面中央に大きく表示
  },

  _drawPracticePlayerStatus() {
    // HP減少のないプレイヤーステータス表示
  },

  _drawMessageLog() {
    // battleScreenのメッセージログ描画機能を流用
  },

  _drawPracticeButtons() {
    // 攻撃、ヒントボタンのみ表示（回復は不要）
  },

  _adjustInputPosition() {
    // battleScreenの入力欄位置調整を流用
  },

  /**
   * 画面離脱時のクリーンアップ
   */
  exit() {
    // 入力欄のイベントリスナー解除
    if (this.inputEl && this._keydownHandler) {
      this.inputEl.removeEventListener('keydown', this._keydownHandler);
    }
    
    // 親クラスのクリーンアップを実行
    if (battleScreenState.exit) {
      battleScreenState.exit.call(this);
    }
    
    // 練習モード固有のクリーンアップ
    this.practiceMode = false;
    this.onPracticeComplete = null;
    this.unmasteredKanji = [];
    
    console.log('🎯 練習バトル画面を終了しました');
  }
};

export default practiceBattleScreenState;