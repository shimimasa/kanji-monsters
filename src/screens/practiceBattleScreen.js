// src/screens/practiceBattleScreen.js
// 練習バトル画面 - 通常のバトル画面から敵要素のみを除外

import battleScreenState from './battleScreen.js';
import { gameState, battleState } from '../core/gameState.js';
import { getKanjiByStageId, isKanjiMastered } from '../loaders/dataLoader.js';
import { publish } from '../core/eventBus.js';

// ★★★ battleScreenStateを継承し、敵のみを無効化 ★★★
const practiceBattleScreenState = {
  // 既存のbattleScreenStateの全機能を継承
  ...battleScreenState,
  
  // 練習モード専用のプロパティ
  practiceMode: true,
  onPracticeComplete: null,
  unmasteredKanji: [],
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
    
    this.onPracticeComplete = onComplete;
    gameState.gameMode = 'practice';
    
    // 通常のバトル画面初期化を実行
    battleScreenState.enter.call(this, canvasEl);
    
    // 敵関連のみを無効化
    this._disableEnemyElements();
    
    // 未マスター漢字リストを構築
    this._buildUnmasteredKanjiList();
    
    // 最初の未マスター漢字を出題
    this._pickNextUnmasteredKanji();
    
    console.log('📚 練習モードを開始しました');
  },

  /**
   * 敵関連の要素のみを無効化
   */
  _disableEnemyElements() {
    // 敵情報を削除
    gameState.currentEnemy = null;
    gameState.enemies = [];
    
    // プレイヤーのHPは減らない
    gameState.playerStats.hp = gameState.playerStats.maxHp;
    
    // 常にプレイヤーターン
    battleState.turn = 'player';
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
   * 未マスターの漢字リストを構築
   */
  _buildUnmasteredKanjiList() {
    const stageKanji = getKanjiByStageId(gameState.currentStageId);
    this.unmasteredKanji = stageKanji.filter(kanji => !isKanjiMastered(kanji.id));
    
    console.log(`📚 未マスター漢字: ${this.unmasteredKanji.length}件 / 全${stageKanji.length}件`);
    
    if (this.unmasteredKanji.length === 0) {
      this._showAllMasteredMessage();
    }
  },

  /**
   * 次の未マスター漢字を出題
   */
  _pickNextUnmasteredKanji() {
    // 未マスターリストを再構築（リアルタイムでマスター状況を反映）
    this._buildUnmasteredKanjiList();
    
    if (this.unmasteredKanji.length === 0) {
      this._completePractice();
      return;
    }
    
    // ランダムに1つ選択
    const randomIndex = Math.floor(Math.random() * this.unmasteredKanji.length);
    const selectedKanji = this.unmasteredKanji[randomIndex];
    
    // battleScreenの漢字設定ロジックを流用
    const processReadings = (readings) => {
      if (!readings) return [];
      if (Array.isArray(readings)) {
        return readings.map(r => this._toHiragana(r.trim())).filter(Boolean);
      } else if (typeof readings === 'string') {
        return readings.split(' ').map(r => this._toHiragana(r.trim())).filter(Boolean);
      }
      return [];
    };

    gameState.currentKanji = {
      id: selectedKanji.id,
      text: selectedKanji.kanji,
      kunyomi: processReadings(selectedKanji.kunyomi),
      onyomi: processReadings(selectedKanji.onyomi),
      meaning: selectedKanji.meaning,
      strokes: selectedKanji.strokes,
    };
    
    // ログメッセージを追加
    if (!Array.isArray(battleState.log)) battleState.log = [];
    battleState.log.push(`「${selectedKanji.kanji}」を読もう！`);
  },

  /**
   * 攻撃処理（練習用の正解判定）
   */
  handleAttack() {
    if (battleState.turn !== 'player' || !battleState.inputEnabled) return;
    
    const inputEl = this.inputEl;
    if (!inputEl) {
      battleState.inputEnabled = true;
      return;
    }
    
    battleState.inputEnabled = false;
    const raw = inputEl.value.trim();
    const answer = this._toHiragana(raw);
    
    // 正解判定
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
   */
  _handlePracticeCorrect(answer) {
    this.practiceStats.correctCount++;
    
    // エフェクト
    if (this.startKanjiBoxEffect) {
      this.startKanjiBoxEffect('rgba(46, 204, 113, 0.8)', 20);
    }
    
    // 正解SE
    publish('playSE', 'correct');
    
    // マスター進捗を更新
    this._updateKanjiMasteryAfterCorrect(gameState.currentKanji, answer);
    
    // 正解メッセージ
    const onyomiStr = (gameState.currentKanji.onyomi || []).join('、');
    const kunyomiStr = (gameState.currentKanji.kunyomi || []).join('、');
    const readingMsg = `正しい読み: 音「${onyomiStr}」訓「${kunyomiStr}」`;
    
    battleState.log.push(`正解！ ${readingMsg}`);
    
    console.log(`✅ 正解: ${gameState.currentKanji.text} = ${answer}`);
    
    // 次の問題へ（1.5秒後）
    setTimeout(() => {
      this._pickNextUnmasteredKanji();
      battleState.inputEnabled = true;
    }, 1500);
  },

  /**
   * 練習での不正解処理
   */
  _handlePracticeIncorrect(answer) {
    this.practiceStats.incorrectCount++;
    
    // 不正解SE
    publish('playSE', 'wrong');
    
    // 不正解メッセージ
    const onyomiStr = (gameState.currentKanji.onyomi || []).join('、');
    const kunyomiStr = (gameState.currentKanji.kunyomi || []).join('、');
    const readingMsg = `正しい読み: 音「${onyomiStr}」訓「${kunyomiStr}」`;
    
    battleState.log.push(`不正解。${readingMsg}`);
    battleState.log.push('もう一度挑戦しよう！');
    
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
   * 画面の描画更新（敵の描画部分のみスキップ）
   */
  update(dt) {
    // 通常のバトル画面描画を実行（敵は既にnullなので描画されない）
    if (battleScreenState.update) {
      battleScreenState.update.call(this, dt);
    }
    
    // 練習モード専用の情報を追加描画
    this._drawPracticeInfo();
  },

  /**
   * 練習モード専用情報の描画
   */
  _drawPracticeInfo() {
    if (!this.ctx) return;
    
    this.ctx.save();
    
    // 練習モードバッジ（左上）
    this.ctx.fillStyle = 'rgba(76, 175, 80, 0.9)';
    this.ctx.fillRect(10, 50, 120, 30);
    this.ctx.fillStyle = 'white';
    this.ctx.font = 'bold 16px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('練習モード', 70, 65);
    
    // 進捗情報（右上、敵ステータスパネルがあった場所）
    const stageKanji = getKanjiByStageId(gameState.currentStageId);
    const totalKanji = stageKanji.length;
    const masteredCount = totalKanji - this.unmasteredKanji.length;
    
    const panelX = this.canvas.width - 280;
    const panelY = 10;
    const panelW = 260;
    const panelH = 80;
    
    // 進捗パネル背景
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(panelX, panelY, panelW, panelH);
    this.ctx.strokeStyle = '#4caf50';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(panelX, panelY, panelW, panelH);
    
    // 進捗テキスト
    this.ctx.fillStyle = 'white';
    this.ctx.font = 'bold 18px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('マスター進捗', panelX + panelW/2, panelY + 20);
    
    this.ctx.font = '16px sans-serif';
    this.ctx.fillText(`${masteredCount} / ${totalKanji}`, panelX + panelW/2, panelY + 40);
    
    const progressPercent = Math.round((masteredCount / totalKanji) * 100);
    this.ctx.fillText(`(${progressPercent}%)`, panelX + panelW/2, panelY + 60);
    
    // 練習統計（画面下部）
    if (this.practiceStats.totalPracticed > 0) {
      const { totalPracticed, correctCount } = this.practiceStats;
      const accuracy = Math.round((correctCount / totalPracticed) * 100);
      
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      this.ctx.fillRect(10, this.canvas.height - 50, 300, 30);
      this.ctx.strokeStyle = '#2196f3';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(10, this.canvas.height - 50, 300, 30);
      
      this.ctx.fillStyle = 'white';
      this.ctx.font = '14px sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.fillText(`練習統計: ${totalPracticed}問 正答率${accuracy}%`, 20, this.canvas.height - 30);
    }
    
    this.ctx.restore();
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