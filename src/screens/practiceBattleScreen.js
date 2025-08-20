// src/screens/practiceBattleScreen.js
// 練習バトル画面 - 通常のバトル画面から敵要素のみを除外

import battleScreenState from './battleScreen.js';
import { gameState, battleState } from '../core/gameState.js';
import { getKanjiByStageId, isKanjiMastered } from '../loaders/dataLoader.js';
import { publish } from '../core/eventBus.js';

// ★★★ battleScreenStateを継承し、最小限の変更で練習モードを実現 ★★★
const practiceBattleScreenState = {
  // 既存のbattleScreenStateの全機能を継承
  ...battleScreenState,
  
  // 練習モード専用のプロパティ
  practiceMode: true,           // 練習モード識別フラグ
  onPracticeComplete: null,     // 練習完了時のコールバック関数
  unmasteredKanji: [],          // 未マスターの漢字リスト
  practiceStats: {              // 練習用の統計情報
    totalPracticed: 0,          // 練習した問題数
    correctCount: 0,            // 正解数
    incorrectCount: 0           // 不正解数
  },

  /**
   * 練習バトル画面への入場処理（battleScreenのenterを最小限修正）
   * @param {HTMLCanvasElement} canvasEl キャンバス要素
   * @param {Function} onComplete 練習完了時のコールバック
   */
  enter(canvasEl, onComplete) {
    console.log('🎯 練習バトル開始:', gameState.currentStageId);
    
    // 練習完了時のコールバックを保存
    this.onPracticeComplete = onComplete;
    
    // 練習モードフラグを設定
    gameState.gameMode = 'practice';
    
    // ★★★ 通常のバトル画面初期化を実行し、その後敵関連のみ無効化 ★★★
    // 元のenterメソッドを呼び出し
    battleScreenState.enter.call(this, canvasEl);
    
    // 敵関連の設定を無効化
    this._disableEnemyElements();
    
    // 練習用のデータ設定
    this._setupPracticeData();
    
    // 最初の問題を出題
    this._pickNextUnmasteredKanji();
    
    console.log('📚 練習モードを開始しました');
  },

  /**
   * 敵関連の要素を無効化
   */
  _disableEnemyElements() {
    // 敵を削除
    gameState.currentEnemy = null;
    gameState.enemies = [];
    
    // プレイヤーのHPは減らない
    gameState.playerStats.hp = gameState.playerStats.maxHp;
    
    // バトル状態を練習用に調整
    battleState.turn = 'player';  // 常にプレイヤーターン
    battleState.inputEnabled = true;
    battleState.comboCount = 0;
    
    // 練習統計をリセット
    this.practiceStats = {
      totalPracticed: 0,
      correctCount: 0,
      incorrectCount: 0
    };
  },

  /**
   * 練習用のデータ設定
   */
  _setupPracticeData() {
    // 未マスター漢字リストを構築
    this._buildUnmasteredKanjiList();
    
    // 練習開始メッセージ
    if (!Array.isArray(battleState.log)) battleState.log = [];
    battleState.log.push('練習モードを開始します！');
    battleState.log.push('すべての漢字をマスターしよう！');
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
    
    // ★★★ 元のsetCurrentKanjiメソッドを使用 ★★★
    if (battleScreenState.setCurrentKanji) {
      battleScreenState.setCurrentKanji.call(this, selectedKanji);
    } else {
      // fallback
      this._setCurrentKanji(selectedKanji);
    }
    
    // 出題メッセージ
    battleState.log.push(`「${selectedKanji.kanji}」を読もう！`);
  },

  /**
   * フォールバック用の漢字設定メソッド
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
   * 攻撃処理をオーバーライド（練習用の正解判定）
   */
  handleAttack() {
    console.log('🎯 練習モード攻撃処理開始');
    
    if (battleState.turn !== 'player' || !battleState.inputEnabled) {
      console.log('❌ 攻撃条件不適合:', { turn: battleState.turn, inputEnabled: battleState.inputEnabled });
      return;
    }
    
    const inputEl = this.inputEl;
    if (!inputEl) {
      console.log('❌ 入力欄が見つかりません');
      battleState.inputEnabled = true;
      return;
    }
    
    const raw = inputEl.value.trim();
    console.log('📝 入力値:', raw);
    
    if (!raw) {
      console.log('❌ 入力が空です');
      return;
    }
    
    battleState.inputEnabled = false;
    
    // ★★★ 元のバトル画面の正解判定ロジックを流用 ★★★
    if (battleScreenState._checkAnswer) {
      console.log('✅ battleScreen._checkAnswerを使用');
      const isCorrect = battleScreenState._checkAnswer.call(this, raw);
      this._handlePracticeResult(isCorrect, raw);
    } else if (battleScreenState.checkAnswer) {
      console.log('✅ battleScreen.checkAnswerを使用');
      const isCorrect = battleScreenState.checkAnswer.call(this, raw);
      this._handlePracticeResult(isCorrect, raw);
    } else {
      console.log('⚠️ フォールバック処理を使用');
      // フォールバック
      this._handlePracticeAttackFallback(raw);
    }
    
    // 入力欄をクリア
    inputEl.value = '';
  },

  /**
   * 練習結果の処理
   */
  _handlePracticeResult(isCorrect, answer) {
    this.practiceStats.totalPracticed++;
    
    if (isCorrect) {
      this.practiceStats.correctCount++;
      
      // ★★★ 元のバトル画面の正解エフェクトを流用 ★★★
      if (battleScreenState._handleCorrectAnswer) {
        battleScreenState._handleCorrectAnswer.call(this, answer);
      }
      
      // マスター進捗を更新
      this._updateKanjiMasteryAfterCorrect(gameState.currentKanji, answer);
      
      console.log(`✅ 正解: ${gameState.currentKanji.text} = ${answer}`);
      
      // 次の問題へ（1.5秒後）
      setTimeout(() => {
        this._pickNextUnmasteredKanji();
        battleState.inputEnabled = true;
      }, 1500);
      
    } else {
      this.practiceStats.incorrectCount++;
      
      // ★★★ 元のバトル画面の不正解エフェクトを流用 ★★★
      if (battleScreenState._handleIncorrectAnswer) {
        battleScreenState._handleIncorrectAnswer.call(this, answer);
      }
      
      console.log(`❌ 不正解: ${gameState.currentKanji.text} ≠ ${answer}`);
      
      // 同じ問題を継続（1.5秒後）
      setTimeout(() => {
        battleState.inputEnabled = true;
      }, 1500);
    }
  },

  /**
   * フォールバック用の攻撃処理
   */
  _handlePracticeAttackFallback(raw) {
    const answer = this._toHiragana(raw);
    const correctReadings = this._getReadings(gameState.currentKanji);
    const isCorrect = correctReadings.includes(answer);
    
    this._handlePracticeResult(isCorrect, answer);
  },

  /**
   * マスター進捗更新
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
      battleState.log.push(`「${currentKanji.text}」をマスターしました！`);
    }
  },

  /**
   * 全漢字マスター完了メッセージ
   */
  _showAllMasteredMessage() {
    battleState.log.push('このステージの漢字は全てマスター済みです！');
    battleState.log.push('素晴らしい！完璧です！');
    
    setTimeout(() => {
      this._completePractice();
    }, 2000);
  },

  /**
   * 練習完了処理
   */
  _completePractice() {
    const { totalPracticed, correctCount, incorrectCount } = this.practiceStats;
    const accuracy = totalPracticed > 0 ? Math.round((correctCount / totalPracticed) * 100) : 0;
    
    battleState.log.push('練習完了！お疲れさまでした！');
    battleState.log.push(`統計: ${totalPracticed}問中 ${correctCount}問正解 (正答率${accuracy}%)`);
    battleState.log.push('実戦バトルに挑戦してみよう！');
    
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
   * 画面の描画更新（battleScreenのupdateを一部修正）
   */
  update(dt) {
    // ★★★ 敵関連の要素を完全に無効化して描画 ★★★
    
    // 敵とモンスターUI関連を完全に無効化
    const originalEnemy = gameState.currentEnemy;
    const originalEnemies = gameState.enemies;
    gameState.currentEnemy = null;
    gameState.enemies = [];
    
    // 元の描画処理を実行（敵なしで）
    if (battleScreenState.update) {
      battleScreenState.update.call(this, dt);
    }
    
    // 敵のUIボックスを上書きして隠す
    this._hideEnemyUI();
    
    // 練習モード専用の情報を追加描画
    this._drawPracticeInfo();
    
    // 状態を復元（練習モードでは常にnull/空配列のまま）
    // gameState.currentEnemy = originalEnemy;  // これはコメントアウト
    // gameState.enemies = originalEnemies;     // これもコメントアウト
  },

  /**
   * 敵のUIを隠す
   */
  _hideEnemyUI() {
    if (!this.ctx) return;
    
    // モンスター表示エリアを背景色で塗りつぶし
    this.ctx.save();
    
    // ステージの背景と同じ色/パターンで上書き
    // 一般的なモンスター表示位置（画面右上）を塗りつぶし
    const monsterAreaX = this.canvas.width * 0.6;
    const monsterAreaY = 80;
    const monsterAreaW = this.canvas.width * 0.35;
    const monsterAreaH = 200;
    
    // 背景グラデーションと同じパターンで塗りつぶし
    const bgGradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    bgGradient.addColorStop(0, '#1a237e');
    bgGradient.addColorStop(1, '#3949ab');
    
    this.ctx.fillStyle = bgGradient;
    this.ctx.fillRect(monsterAreaX, monsterAreaY, monsterAreaW, monsterAreaH);
    
    this.ctx.restore();
  },

  /**
   * 練習モード専用情報の描画
   */
  _drawPracticeInfo() {
    if (!this.ctx) return;
    
    // 練習モードバッジ
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(76, 175, 80, 0.9)';
    this.ctx.fillRect(10, 10, 120, 30);
    this.ctx.fillStyle = 'white';
    this.ctx.font = 'bold 16px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('練習モード', 70, 25);
    
    // 進捗情報
    const stageKanji = getKanjiByStageId(gameState.currentStageId);
    const totalKanji = stageKanji.length;
    const masteredCount = totalKanji - this.unmasteredKanji.length;
    const progressText = `マスター: ${masteredCount}/${totalKanji}`;
    
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(this.canvas.width - 150, 10, 140, 30);
    this.ctx.fillStyle = 'white';
    this.ctx.font = '14px sans-serif';
    this.ctx.fillText(progressText, this.canvas.width - 80, 25);
    
    // 練習統計（画面下部）
    if (this.practiceStats.totalPracticed > 0) {
      const { totalPracticed, correctCount } = this.practiceStats;
      const accuracy = Math.round((correctCount / totalPracticed) * 100);
      const statsText = `練習: ${totalPracticed}問 正答率${accuracy}%`;
      
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      this.ctx.fillRect(10, this.canvas.height - 40, 250, 30);
      this.ctx.fillStyle = 'white';
      this.ctx.font = '12px sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.fillText(statsText, 20, this.canvas.height - 25);
    }
    
    // 練習専用メッセージ（モンスターエリアに表示）
    const messageX = this.canvas.width * 0.6 + 20;
    const messageY = 120;
    
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    this.ctx.fillRect(messageX, messageY, 200, 80);
    this.ctx.strokeStyle = '#4caf50';
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(messageX, messageY, 200, 80);
    
    this.ctx.fillStyle = '#2e7d32';
    this.ctx.font = 'bold 16px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('練習中', messageX + 100, messageY + 25);
    
    this.ctx.font = '14px sans-serif';
    this.ctx.fillText('漢字を読んで', messageX + 100, messageY + 45);
    this.ctx.fillText('マスターしよう！', messageX + 100, messageY + 65);
    
    this.ctx.restore();
  },

  /**
   * ユーティリティメソッド
   */
  _toHiragana(input) {
    if (!input) return '';
    let normalized = input.trim().replace(/\s+/g, '');
    return normalized.replace(/[\u30a1-\u30f6]/g, ch => 
      String.fromCharCode(ch.charCodeAt(0) - 0x60)
    );
  },

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
   * 画面離脱時のクリーンアップ
   */
  exit() {
    // 元のexitメソッドを呼び出し
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