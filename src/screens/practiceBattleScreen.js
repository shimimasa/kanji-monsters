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
    
    // 練習モード専用の攻撃処理を設定
    this._setupPracticeAttackHandler();
    
    console.log('📚 練習モードを開始しました');
  },

  /**
   * 練習モード専用の攻撃処理を設定
   */
  _setupPracticeAttackHandler() {
    // グローバルなonAttack関数を練習モード用にオーバーライド
    if (typeof window !== 'undefined') {
      window.practiceOnAttack = () => {
        console.log('🎯 練習モード専用攻撃処理が呼ばれました');
        this.handleAttack();
      };
      
      // 既存のonAttack関数を保存して置き換え
      this._originalOnAttack = window.onAttack;
      window.onAttack = window.practiceOnAttack;
    }
    
    // battleScreenStateのhandleAttackも一時的に置き換え
    this._originalBattleHandleAttack = battleScreenState.handleAttack;
    battleScreenState.handleAttack = () => {
      console.log('🎯 battleScreenState.handleAttackから練習モードへリダイレクト');
      this.handleAttack();
    };
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
    
    // 背景画像を確実に取得
    this.stageBgImage = battleScreenState.stageBgImage;
    console.log('🖼️ 背景画像状態:', this.stageBgImage ? '利用可能' : '未取得');
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
    console.log('🎯 練習モード攻撃処理開始');
    console.log('📊 現在の状態:', {
      turn: battleState.turn,
      inputEnabled: battleState.inputEnabled,
      practiceMode: this.practiceMode
    });
    
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
    
    // 入力を無効化
    battleState.inputEnabled = false;
    console.log('🔒 入力を無効化しました');
    
    const answer = this._toHiragana(raw);
    console.log('📝 変換後:', answer);
    
    // 現在の漢字の確認
    if (!gameState.currentKanji) {
      console.log('❌ 現在の漢字が設定されていません');
      battleState.inputEnabled = true;
      return;
    }
    
    console.log('📚 現在の漢字:', gameState.currentKanji);
    
    // 正解判定
    const correctReadings = this._getReadings(gameState.currentKanji);
    console.log('📚 正解の読み:', correctReadings);
    
    const isCorrect = correctReadings.includes(answer);
    console.log('🎯 判定結果:', isCorrect ? '正解' : '不正解');
    
    // 統計更新
    this.practiceStats.totalPracticed++;
    console.log('📊 統計更新:', this.practiceStats);
    
    // 結果処理
    if (isCorrect) {
      this._handlePracticeCorrect(answer);
    } else {
      this._handlePracticeIncorrect(answer);
    }
    
    // 入力欄をクリア
    inputEl.value = '';
    console.log('🧹 入力欄をクリアしました');
  },

  /**
   * 練習での正解処理
   */
  _handlePracticeCorrect(answer) {
    console.log('✅ 正解処理開始');
    
    this.practiceStats.correctCount++;
    
    // エフェクト
    if (this.startKanjiBoxEffect) {
      this.startKanjiBoxEffect('rgba(46, 204, 113, 0.8)', 20);
      console.log('✨ 漢字ボックスエフェクト開始');
    }
    
    // 正解SE
    publish('playSE', 'correct');
    
    // マスター進捗を更新
    this._updateKanjiMasteryAfterCorrect(gameState.currentKanji, answer);
    
    // 正解メッセージ
    const onyomiStr = (gameState.currentKanji.onyomi || []).join('、');
    const kunyomiStr = (gameState.currentKanji.kunyomi || []).join('、');
    const readingMsg = `正しい読み: 音「${onyomiStr}」訓「${kunyomiStr}」`;
    
    if (!Array.isArray(battleState.log)) battleState.log = [];
    battleState.log.push(`正解！ ${readingMsg}`);
    
    console.log(`✅ 正解: ${gameState.currentKanji.text} = ${answer}`);
    console.log('📝 ログに追加:', `正解！ ${readingMsg}`);
    
    // 次の問題へ（1.5秒後）
    setTimeout(() => {
      console.log('⏰ 次の問題に進みます');
      this._pickNextUnmasteredKanji();
      battleState.inputEnabled = true;
      console.log('🔓 入力を再有効化しました');
    }, 1500);
  },

  /**
   * 練習での不正解処理
   */
  _handlePracticeIncorrect(answer) {
    console.log('❌ 不正解処理開始');
    
    this.practiceStats.incorrectCount++;
    
    // 不正解SE
    publish('playSE', 'wrong');
    
    // 不正解メッセージ
    const onyomiStr = (gameState.currentKanji.onyomi || []).join('、');
    const kunyomiStr = (gameState.currentKanji.kunyomi || []).join('、');
    const readingMsg = `正しい読み: 音「${onyomiStr}」訓「${kunyomiStr}」`;
    
    if (!Array.isArray(battleState.log)) battleState.log = [];
    battleState.log.push(`不正解。${readingMsg}`);
    battleState.log.push('もう一度挑戦しよう！');
    
    console.log(`❌ 不正解: ${gameState.currentKanji.text} ≠ ${answer}`);
    console.log('📝 ログに追加:', `不正解。${readingMsg}`);
    
    // 同じ問題を継続（1.5秒後）
    setTimeout(() => {
      console.log('⏰ 同じ問題を継続します');
      battleState.inputEnabled = true;
      console.log('🔓 入力を再有効化しました');
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
    // 敵を一時的にnullに設定して通常描画を実行
    const originalEnemy = gameState.currentEnemy;
    const originalEnemies = gameState.enemies;
    
    gameState.currentEnemy = null;
    gameState.enemies = [];
    
    // 通常のバトル画面描画を実行
    if (battleScreenState.update) {
      battleScreenState.update.call(this, dt);
    }
    
    // 敵UIエリアを背景で塗りつぶし
    this._hideEnemyUIArea();
    
    // 練習モード専用の情報を追加描画
    this._drawPracticeInfo();
    
    // 元の状態に戻す（ただし練習モードでは常にnull）
    gameState.currentEnemy = originalEnemy;
    gameState.enemies = originalEnemies;
  },

  /**
   * 敵UIエリアを背景で隠す
   */
  _hideEnemyUIArea() {
    if (!this.ctx) return;
    
    this.ctx.save();
    
    // モンスター表示エリア（画面右側）を背景と同じ色で塗りつぶし
    const enemyAreaX = 480;
    const enemyAreaY = 80;
    const enemyAreaW = 280;
    const enemyAreaH = 200;
    
    // ステージ背景と同じグラデーションで塗りつぶし
    if (this.stageBgImage) {
      // 背景画像がある場合は、その部分を再描画
      this.ctx.drawImage(
        this.stageBgImage,
        enemyAreaX, enemyAreaY, enemyAreaW, enemyAreaH, // ソース領域
        enemyAreaX, enemyAreaY, enemyAreaW, enemyAreaH  // 描画領域
      );
    } else {
      // 背景画像がない場合はグラデーションで塗りつぶし
      const bgGradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
      bgGradient.addColorStop(0, '#1e3c72');
      bgGradient.addColorStop(1, '#2a5298');
      this.ctx.fillStyle = bgGradient;
      this.ctx.fillRect(enemyAreaX, enemyAreaY, enemyAreaW, enemyAreaH);
    }
    
    // 敵ステータスパネルエリアも塗りつぶし
    const panelX = this.canvas.width - 300;
    const panelY = 10;
    const panelW = 280;
    const panelH = 120;
    
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
  },

  /**
   * 練習モード専用情報の描画
   */
  _drawPracticeInfo() {
    if (!this.ctx) return;
    
    this.ctx.save();
    
    // 練習モードバッジ（左上、既存ボタンの下に配置）
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
    
    // 進捗情報（右上、敵ステータスパネルがあった場所）
    const stageKanji = getKanjiByStageId(gameState.currentStageId);
    const totalKanji = stageKanji.length;
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
    
    // プログレスバーを追加
    const barX = panelX + 20;
    const barY = panelY + 85;
    const barW = panelW - 40;
    const barH = 8;
    
    // バー背景
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    this.ctx.fillRect(barX, barY, barW, barH);
    
    // バー進捗
    const progress = masteredCount / totalKanji;
    this.ctx.fillStyle = '#4caf50';
    this.ctx.fillRect(barX, barY, barW * progress, barH);
    
    // バー枠線
    this.ctx.strokeStyle = 'white';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(barX, barY, barW, barH);
    
    // 練習統計（画面下部）
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
      this.ctx.fillText(`練習統計: ${totalPracticed}問練習 正答率${accuracy}% (${correctCount}正解/${totalPracticed - correctCount}不正解)`, 20, this.canvas.height - 30);
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