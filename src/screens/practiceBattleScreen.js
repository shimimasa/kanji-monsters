// 練習バトル画面 - 修正版

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
    
    // ★★★ 最初に練習モード用のハンドラを設定 ★★★
    this._setupPracticeHandlers();
    
    // 通常のバトル画面初期化を実行
    battleScreenState.enter.call(this, canvasEl);
    
    // 敵関連のみを無効化
    this._disableEnemyElements();
    
    // 未マスター漢字リストを構築
    this._buildUnmasteredKanjiList();
    
    // 最初の未マスター漢字を出題
    this._pickNextUnmasteredKanji();
    
    console.log('📚 練習モードを開始しました');
    console.log('🔧 入力設定状況:', {
      inputEl: !!this.inputEl,
      turn: battleState.turn,
      inputEnabled: battleState.inputEnabled
    });
  },

  /**
   * 練習モード専用のハンドラを設定
   */
  _setupPracticeHandlers() {
    console.log('🔧 練習モード用ハンドラを設定中...');
    
    // ★★★ 元のメソッドを保存してから置き換え ★★★
    this._originalHandleAttack = this.handleAttack;
    this._originalHandleHeal = this.handleHeal;
    this._originalHandleHint = this.handleHint;
    
    // ★★★ 練習モード用のメソッドで置き換え ★★★
    this.handleAttack = () => {
      console.log('🎯 練習モード handleAttack が呼ばれました');
      this.handlePracticeAttack();
    };
    
    this.handleHeal = () => {
      console.log('💚 練習モード handleHeal が呼ばれました');
      this.handlePracticeHeal();
    };
    
    this.handleHint = () => {
      console.log('💡 練習モード handleHint が呼ばれました');
      this.handlePracticeHint();
    };
    
    // ★★★ Enterキー用のハンドラも設定 ★★★
    this._setupPracticeKeyHandler();
    
    console.log('✅ 練習モード用ハンドラ設定完了');
  },

  /**
   * 練習モード専用のキーボードハンドラを設定
   */
  _setupPracticeKeyHandler() {
    // 既存のキーハンドラを保存
    this._originalKeydownHandler = this._keydownHandler;
    
    // 練習モード専用のキーハンドラを作成
    this._practiceKeydownHandler = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        console.log('⌨️ 練習モードでEnterキーが押されました');
        
        if (battleState.turn === 'player' && battleState.inputEnabled) {
          const mode = battleState.lastCommandMode || 'attack';
          console.log(`⌨️ 実行モード: ${mode}`);
          
          // 直接練習モードのメソッドを呼び出し
          setTimeout(() => {
            try {
              if (mode === 'attack') {
                console.log('⌨️ 攻撃モード実行');
                this.handlePracticeAttack();
              } else if (mode === 'heal') {
                console.log('⌨️ 回復モード実行');
                this.handlePracticeHeal();
              } else if (mode === 'hint') {
                console.log('⌨️ ヒントモード実行');
                this.handlePracticeHint();
              }
            } catch (error) {
              console.error('練習モード処理中にエラーが発生:', error);
              battleState.inputEnabled = true;
              if (this.inputEl) {
                this.inputEl.value = '';
              }
            }
          }, 0);
        } else {
          console.log('⌨️ 入力条件不適合:', {
            turn: battleState.turn,
            inputEnabled: battleState.inputEnabled
          });
        }
      }
    };
    
    // 入力欄にキーハンドラを設定
    if (this.inputEl) {
      this.inputEl.removeEventListener('keydown', this._keydownHandler);
      this.inputEl.addEventListener('keydown', this._practiceKeydownHandler);
      console.log('🔧 練習モード用キーハンドラを設定しました');
    }
  },

  /**
   * 敵関連の要素のみを無効化
   */
  _disableEnemyElements() {
    // 敵情報を削除
    gameState.currentEnemy = null;
    gameState.enemies = [];
    gameState.currentEnemyIndex = 0;
    
    // プレイヤーのHPは満タンを維持
    gameState.playerStats.hp = gameState.playerStats.maxHp;
    
    // 常にプレイヤーターンで入力許可
    battleState.turn = 'player';
    battleState.inputEnabled = true;
    battleState.comboCount = 0;
    
    // 練習統計をリセット
    this.practiceStats = {
      totalPracticed: 0,
      correctCount: 0,
      incorrectCount: 0
    };
    
    console.log('🚫 敵要素を無効化しました');
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
    
    // 読み情報を処理
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
    
    // ヒントレベルをリセット
    gameState.hintLevel = 0;
    
    // ログメッセージを追加
    if (!Array.isArray(battleState.log)) battleState.log = [];
    const logMessage = `「${selectedKanji.kanji}」を読もう！`;
    battleState.log.push(logMessage);
    
    // showLogBlockメソッドが利用可能なら使用
    if (this.showLogBlock) {
      this.showLogBlock([
        'あたらしい もんだい！',
        logMessage
      ]);
    }
    
    console.log(`📝 新しい問題: ${selectedKanji.kanji} (ID: ${selectedKanji.id})`);
  },

  /**
   * 練習モード専用攻撃処理
   */
  handlePracticeAttack() {
    console.log('🎯 練習モード攻撃処理開始');
    
    // 基本的な状態チェック
    if (battleState.turn !== 'player' || !battleState.inputEnabled) {
      console.log('❌ 攻撃条件不適合:', { 
        turn: battleState.turn, 
        inputEnabled: battleState.inputEnabled 
      });
      // 強制的に状態を修正
      battleState.turn = 'player';
      battleState.inputEnabled = true;
      console.log('🔧 状態を修正しました');
    }
    
    const inputEl = this.inputEl;
    if (!inputEl) {
      console.log('❌ 入力欄が見つかりません');
      return;
    }
    
    const raw = inputEl.value.trim();
    if (!raw) {
      console.log('❌ 入力が空です');
      return;
    }
    
    console.log('📝 入力値:', raw);
    
    // 入力を一時的に無効化
    battleState.inputEnabled = false;
    battleState.lastCommandMode = 'attack';
    
    const answer = this._toHiragana(raw);
    console.log('📝 変換後の答え:', answer);
    
    // 現在の漢字の確認
    if (!gameState.currentKanji) {
      console.log('❌ 現在の漢字が設定されていません');
      battleState.inputEnabled = true;
      return;
    }
    
    // 正解判定
    const correctReadings = this._getReadings(gameState.currentKanji);
    const isCorrect = correctReadings.includes(answer);
    
    console.log('📚 正解の読み:', correctReadings);
    console.log('🎯 判定結果:', isCorrect ? '✅正解' : '❌不正解');
    
    // 統計更新
    this.practiceStats.totalPracticed++;
    
    // 入力欄をクリア
    inputEl.value = '';
    
    if (isCorrect) {
      this._handlePracticeCorrect(answer);
    } else {
      this._handlePracticeIncorrect(answer);
    }
  },

  /**
   * 練習モード専用回復処理
   */
  handlePracticeHeal() {
    console.log('💚 練習モード回復処理開始');
    
    if (battleState.turn !== 'player' || !battleState.inputEnabled) {
      console.log('❌ 回復条件不適合');
      battleState.turn = 'player';
      battleState.inputEnabled = true;
    }
    
    const inputEl = this.inputEl;
    if (!inputEl) return;
    
    const raw = inputEl.value.trim();
    if (!raw) return;
    
    battleState.inputEnabled = false;
    battleState.lastCommandMode = 'heal';
    
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
  },

  /**
   * 練習モード専用ヒント処理
   */
  handlePracticeHint() {
    console.log('💡 練習モードヒント処理開始');
    
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
    
    if (this.showLogBlock) {
      this.showLogBlock([hintMessage]);
    }
  },

  /**
   * 練習での正解処理
   */
  _handlePracticeCorrect(answer, actionType = 'attack') {
    console.log('✅ 正解処理開始');
    
    this.practiceStats.correctCount++;
    
    // ★★★ 漢字パネルへの攻撃エフェクト（石版攻撃） ★★★
    if (actionType === 'attack') {
      // 緑色の成功エフェクト
      if (this.startKanjiBoxEffect) {
        this.startKanjiBoxEffect('rgba(46, 204, 113, 0.8)', 20);
        console.log('✨ 漢字ボックス成功エフェクト開始');
      }
      
      // 石版攻撃エフェクトも発動
      if (this.startStoneAttackEffect && this.canvas) {
        const kanjiX = this.canvas.width / 2;
        const kanjiY = 200;
        const kanjiBoxW = 180;
        const kanjiBoxH = 160;
        this.startStoneAttackEffect(kanjiX, kanjiY, kanjiBoxW, kanjiBoxH);
        console.log('💥 石版攻撃エフェクト開始');
      }
    }
    
    // 正解SE
    publish('playSE', 'correct');
    
    // マスター進捗を更新
    this._updateKanjiMasteryAfterCorrect(gameState.currentKanji, answer);
    
    // 正解メッセージ
    const onyomiStr = (gameState.currentKanji.onyomi || []).join('、');
    const kunyomiStr = (gameState.currentKanji.kunyomi || []).join('、');
    const readingMsg = `正しい読み: 音「${onyomiStr}」訓「${kunyomiStr}」`;
    
    const actionMsg = actionType === 'heal' ? 'かいふくせいこう！' : 'せいかい！';
    this._addToPracticeLog(`${actionMsg} ${readingMsg}`);
    
    if (this.showLogBlock) {
      this.showLogBlock([
        actionMsg,
        readingMsg,
        actionType === 'attack' ? '漢字パネルを攻撃した！' : 'HPが回復した！'
      ]);
    }
    
    console.log(`✅ 正解: ${gameState.currentKanji.text} = ${answer}`);
    
    // 次の問題へ（1.5秒後）
    setTimeout(() => {
      console.log('⏰ 次の問題に進みます');
      this._pickNextUnmasteredKanji();
      battleState.turn = 'player';
      battleState.inputEnabled = true;
    }, 1500);
  },

  /**
   * 練習での不正解処理
   */
  _handlePracticeIncorrect(answer, actionType = 'attack') {
    console.log('❌ 不正解処理開始');
    
    this.practiceStats.incorrectCount++;
    
    // 不正解SE
    publish('playSE', 'wrong');
    
    // 不正解メッセージ
    const onyomiStr = (gameState.currentKanji.onyomi || []).join('、');
    const kunyomiStr = (gameState.currentKanji.kunyomi || []).join('、');
    const readingMsg = `正しい読み: 音「${onyomiStr}」訓「${kunyomiStr}」`;
    
    const actionMsg = actionType === 'heal' ? 'かいふくしっぱい！' : 'こうげきしっぱい！';
    this._addToPracticeLog(`${actionMsg} ${readingMsg}`);
    this._addToPracticeLog('もう一度挑戦しよう！');
    
    if (this.showLogBlock) {
      this.showLogBlock([
        actionMsg,
        readingMsg,
        'もう一度挑戦しよう！'
      ]);
    }
    
    console.log(`❌ 不正解: ${gameState.currentKanji.text} ≠ ${answer}`);
    
    // 同じ問題を継続（1.5秒後）
    setTimeout(() => {
      console.log('⏰ 同じ問題を継続します');
      battleState.turn = 'player';
      battleState.inputEnabled = true;
    }, 1500);
  },

  /**
   * 練習ログにメッセージを追加
   */
  _addToPracticeLog(message) {
    if (!Array.isArray(battleState.log)) battleState.log = [];
    battleState.log.push(message);
    
    // タイプライター効果があれば開始
    if (this.startTypewriterEffect) {
      this.startTypewriterEffect(message);
    }
  },

  /**
   * 全漢字マスター完了メッセージ
   */
  _showAllMasteredMessage() {
    this._addToPracticeLog('このステージの漢字は全てマスター済みです！');
    this._addToPracticeLog('素晴らしい！完璧です！');
    
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
    
    this._addToPracticeLog('練習完了！お疲れさまでした！');
    this._addToPracticeLog(`統計: ${totalPracticed}問中 ${correctCount}問正解 (正答率${accuracy}%)`);
    
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
    
    const before = !!prog.mastered;
    const allKunOk = (currentKanji.kunyomi || []).every(r => prog.kunyomi.has(r));
    const allOnOk = (currentKanji.onyomi || []).every(r => prog.onyomi.has(r));
    prog.mastered = allKunOk && allOnOk;
    
    // 初めてマスターになった場合
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
    console.log('🎯 練習バトル画面を終了します');
    
    // ★★★ 元のメソッドを復元 ★★★
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
    
    // 元のexitメソッドを呼び出し
    if (battleScreenState.exit) {
      battleScreenState.exit.call(this);
    }
    
    // 練習モード固有のクリーンアップ
    this.practiceMode = false;
    this.onPracticeComplete = null;
    this.unmasteredKanji = [];
    
    // ゲームモードをリセット
    gameState.gameMode = 'normal';
    
    console.log('🎯 練習バトル画面を終了しました');
  },

  /**
   * マウスクリック処理（練習モード専用に完全オーバーライド）
   */
  handleClick(e) {
    console.log('🖱️ 練習モードのクリック処理開始');

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

    console.log('🖱️ クリック座標:', x, y);

    // ボタンの定義（battleScreen.jsからコピー）
    const BTN = {
      back:   { x: 20,  y: 20,  w: 100, h: 30,  label: 'タイトルへ' },
      stage:  { x: 140, y: 20,  w: 120, h: 30,  label: 'ステージ選択' },
      attack: { x: 230, y: 380, w: 110, h: 50,  label: 'こうげき' },
      heal:   { x: 350, y: 380, w: 110, h: 50,  label: 'かいふく' },
      hint:   { x: 470, y: 380, w: 110, h: 50,  label: 'ヒント' },
    };

    // 当たり判定のヘルパー関数
    const isMouseOverRect = (mx, my, rect) => {
      return mx >= rect.x && mx <= rect.x + rect.w && 
             my >= rect.y && my <= rect.y + rect.h;
    };

    // 「タイトルへ」ボタン
    if (isMouseOverRect(x, y, BTN.back)) {
      console.log('🏠 「タイトルへ」ボタンがクリックされました');
      publish('changeScreen', 'title');
      return true;
    }

    // 「ステージ選択」ボタン
    if (isMouseOverRect(x, y, BTN.stage)) {
      console.log('🗺️ 「ステージ選択」ボタンがクリックされました');
      publish('changeScreen', 'stageSelect');
      return true;
    }

    // 「こうげき」ボタン - 練習モード専用処理
    if (isMouseOverRect(x, y, BTN.attack)) {
      console.log('🎯 練習モード「こうげき」ボタンがクリックされました');
      battleState.lastCommandMode = 'attack';
      this.handlePracticeAttack(); // ★ 練習モード専用メソッドを直接呼び出し
      return true;
    }

    // 「かいふく」ボタン - 練習モード専用処理
    if (isMouseOverRect(x, y, BTN.heal)) {
      console.log('💚 練習モード「かいふく」ボタンがクリックされました');
      battleState.lastCommandMode = 'heal';
      this.handlePracticeHeal(); // ★ 練習モード専用メソッドを直接呼び出し
      return true;
    }

    // 「ヒント」ボタン - 練習モード専用処理
    if (isMouseOverRect(x, y, BTN.hint)) {
      console.log('💡 練習モード「ヒント」ボタンがクリックされました');
      battleState.lastCommandMode = 'hint';
      this.handlePracticeHint(); // ★ 練習モード専用メソッドを直接呼び出し
      return true;
    }

    console.log('🖱️ どのボタンにもヒットしませんでした');
    return false;
  },

  /**
   * キーボード入力処理（Enterキーでの攻撃/回復/ヒント実行）
   */
  handleKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (battleState.turn === 'player' && battleState.inputEnabled) {
        const mode = battleState.lastCommandMode || 'attack';
        
        console.log(`⌨️ Enterキー押下: ${mode}モード実行`);
        
        setTimeout(() => {
          try {
            if (mode === 'attack') {
              this.handlePracticeAttack();
            } else if (mode === 'heal') {
              this.handlePracticeHeal();
            } else if (mode === 'hint') {
              this.handlePracticeHint();
            }
          } catch (error) {
            console.error('練習モード処理中にエラーが発生:', error);
            battleState.inputEnabled = true;
            if (this.inputEl) {
              this.inputEl.value = '';
            }
          }
        }, 0);
      }
    }
  }
};

export default practiceBattleScreenState;