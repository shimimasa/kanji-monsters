// src/gameState.js
//
// すべての一時データを 1 か所に集約し、他モジュールは「読む／書く」だけ。
// これ以上の入れ子は作らず、必要に応じてプロパティを追加していく方針。
export const battleState = {
  turn: 'player', // 'player' または 'enemy'
  inputEnabled: true,
  message: '',
  comboCount: 0,
  timeRemaining: 60,
  recentKanjiIds: [], // 漢字の重複出題防止用（念のため復活）
  currentKanjiIndex: 0,  // 現在の問題インデックス
  mistakesThisStage: 0,  // ステージごとのミス回数
  
  // コンボタイマー関連のプロパティを追加
  comboTimer: 0,         // コンボの残り時間（フレーム数）
  COMBO_TIMER_MAX: 300,  // コンボの最大持続時間（5秒 = 300フレーム）
  
  // 最後に選択したコマンドモード（攻撃、回復、ヒント）
  lastCommandMode: 'attack', // デフォルトは攻撃
};

export const gameState = {
    /* 画面遷移 ------------------------------------------------------------- */
            // 'title' | 'menu' | 'battle' | 'stageClear' ...
    currentStageId: null,
    // ★★★ 練習モードを追加 ★★★
    gameMode: 'challenge', // 'jikkuri', 'challenge', 'practice'
  
    /* プレイヤー ----------------------------------------------------------- */
    playerName: '',
    playerStats: {
      hp: 100, maxHp: 100,
      level: 1, exp: 0,
      attack: 10,
      healCount: 3,
      nextLevelExp: 100,
      skillPoints: 0,  // スキルポイントを追加
      enemiesDefeated: 0,  // 倒した敵の数
      stagesCleared: 0,    // クリアしたステージ数
      // 実績システム用の統計データ
      totalCorrect: 0,     // 正解した問題の総数
      totalIncorrect: 0,   // 間違えた問題の総数
      comboCount: 0,       // 連続正解数（バトルごとにリセット）
      weaknessHits: 0,     // 弱点を突いた回数
      healsSuccessful: 0,  // 成功した回復回数
      skillPointsUsed: 0,  // 使用したスキルポイント数
      bossesDefeated: 0,   // 倒したボスの数
      playtimeSeconds: 0,  // プレイ時間（秒）
    },
  
    /* バトル --------------------------------------------------------------- */
    enemies: [],                   // ステージ開始時にセット
    currentEnemyIndex: 0,
    currentEnemy: null,            // enemies[currentEnemyIndex]
  
    kanjiPool: [],                 // ステージ開始時にセット
    currentKanji: { text: '', readings: [], meaning: '' },
    showHint: false,
    correctKanjiList: [],   // 正解した漢字をためる
    wrongKanjiList: [],     // 間違えた漢字をためる

    /* 実績システム --------------------------------------------------------- */
    unlockedAchievements: new Set(),  // 解除した実績のIDを保存

    /* ★★★ 練習モード用の進捗管理 ★★★ */
    practiceProgress: {
      // stageId: { allMastered: boolean, lastPracticed: timestamp }
    },

    /* ★★★ 漢字マスター状況管理 ★★★ */
    kanjiReadProgress: {
      // kanjiId: { onyomi: Set, kunyomi: Set, mastered: boolean }
    },
};
  
  export function updatePlayerStats(changes) {
    Object.assign(gameState.playerStats, changes);
    // 統計データが変更された場合はセーブ
    saveGameData();
  }
  
  export function setCurrentEnemy(enemy) {
    gameState.currentEnemy = enemy;
  }

  /**
   * 敵を倒した時に呼び出す統計更新関数
   */
  export function recordEnemyDefeated() {
    gameState.playerStats.enemiesDefeated++;
    saveGameData();
    console.log(`📊 倒した敵の数: ${gameState.playerStats.enemiesDefeated}`);
  }

  /**
   * ステージクリア時に呼び出す統計更新関数
   */
  export function recordStageCleared() {
    gameState.playerStats.stagesCleared++;
    saveGameData();
    console.log(`📊 クリアしたステージ数: ${gameState.playerStats.stagesCleared}`);
  }

  /**
   * 実績を解除する関数
   * @param {string} achievementId 実績のID
   */
  export function unlockAchievement(achievementId) {
    if (!gameState.unlockedAchievements.has(achievementId)) {
      gameState.unlockedAchievements.add(achievementId);
      saveGameData();
      console.log(`🏆 実績解除: ${achievementId}`);
      // 実績解除の通知イベントを発行（後で実装）
      // publish('achievementUnlocked', achievementId);
    }
  }

  /**
   * 実績が解除済みかどうかを確認する関数
   * @param {string} achievementId 実績のID
   * @returns {boolean} 解除済みならtrue
   */
  export function isAchievementUnlocked(achievementId) {
    return gameState.unlockedAchievements.has(achievementId);
  }
  
  /**
   * プレイヤーに経験値を追加し、レベルアップ判定を行う
   * @param {number} exp 追加する経験値
   * @returns {Object} レベルアップ結果のオブジェクト
   */
  export function addPlayerExp(exp) {
    gameState.playerStats.exp += exp;
    // レベルアップ判定を行い、その結果を返す
    const result = checkLevelUp();
    // 統計データが変更されたのでセーブ
    saveGameData();
    
    // ▼▼▼ 追加：Firestoreにも保存 ▼▼▼
    // Firebaseサービスが利用可能な場合はFirestoreにも保存
    import('../services/firebase/firebaseController.js').then(firebase => {
      firebase.savePlayerData({
        name: gameState.playerName,
        level: gameState.playerStats.level,
        exp: gameState.playerStats.exp,
        maxHp: gameState.playerStats.maxHp,
        attack: gameState.playerStats.attack,
        nextLevelExp: gameState.playerStats.nextLevelExp
      }).catch(error => {
        console.warn('Firestoreへのプレイヤーデータ保存に失敗:', error);
      });
    }).catch(error => {
      console.warn('Firebase controller読み込み失敗:', error);
    });
    // ▲▲▲ 追加終了 ▲▲▲
    
    return result;
  }

  /**
   * レベルアップ判定を行う
   * @returns {Object} レベルアップ結果 { leveledUp: boolean, oldLevel?: number, newLevel?: number }
   */
  function checkLevelUp() {
    const stats = gameState.playerStats;
    
    if (stats.exp >= stats.nextLevelExp) {
      // レベルアップ前の情報を保存
      const oldLevel = stats.level;
      
      // 経験値とレベルの更新
      stats.exp -= stats.nextLevelExp;
      stats.level++;
      
      // スキルポイントを1増加
      stats.skillPoints += 1;
      
      // レベルアップ時のステータス上昇
      stats.maxHp += 10; // 仕様書通り
      stats.hp = stats.maxHp; // 全回復（必須）
      stats.attack += 2; // 仕様書通り
      
      // 次のレベルに必要な経験値を設定 (指数関数的)
      stats.nextLevelExp = Math.floor(stats.nextLevelExp * 1.2) + 20; // 緩やかな指数+固定値で調整
      
      // 他のボーナス（例：回復回数リセットなど）
      stats.healCount = 3;
  
      // レベルアップしたことを通知するイベントを発行しても良い
      // publish('playerLeveledUp', stats.level);
      
      // レベルアップ情報を返す
      return {
        leveledUp: true,
        oldLevel: oldLevel,
        newLevel: stats.level
      };
    }
    
    // レベルアップしなかった場合
    return {
      leveledUp: false
    };
  }

  /**
   * ゲームデータをlocalStorageに保存する
   */
  export function saveGameData() {
    try {
      const saveData = {
        playerName: gameState.playerName,
        playerStats: gameState.playerStats,
        unlockedAchievements: Array.from(gameState.unlockedAchievements),
        // ★★★ 練習進捗とマスター状況も保存 ★★★
        practiceProgress: gameState.practiceProgress,
        kanjiReadProgress: gameState.kanjiReadProgress
      };
      
      localStorage.setItem('kanjiGameSave', JSON.stringify(saveData));
      console.log('💾 ゲームデータを保存しました');
      
      // ▼▼▼ 追加：Firestoreにも保存 ▼▼▼
      // Firebaseサービスが利用可能な場合はFirestoreにも保存
      import('../services/firebase/firebaseController.js').then(firebase => {
        firebase.savePlayerData({
          name: gameState.playerName,
          level: gameState.playerStats.level,
          exp: gameState.playerStats.exp,
          maxHp: gameState.playerStats.maxHp,
          attack: gameState.playerStats.attack,
          nextLevelExp: gameState.playerStats.nextLevelExp
        }).catch(error => {
          console.warn('Firestoreへのプレイヤーデータ保存に失敗:', error);
        });
      }).catch(error => {
        console.warn('Firebase controller読み込み失敗:', error);
      });
      // ▲▲▲ 追加終了 ▲▲▲
      
    } catch (error) {
      console.error('❌ ゲームデータの保存に失敗しました:', error);
    }
  }

  /**
   * ゲームデータをlocalStorageから読み込む
   */
  export function loadGameData() {
    try {
      const saveDataStr = localStorage.getItem('kanjiGameSave');
      if (!saveDataStr) {
        console.log('💾 セーブデータが見つかりません。新規ゲームを開始します。');
        return false;
      }

      const saveData = JSON.parse(saveDataStr);
      
      // プレイヤー名を復元
      if (saveData.playerName) {
        gameState.playerName = saveData.playerName;
      }

      // プレイヤー統計を復元
      if (saveData.playerStats) {
        Object.assign(gameState.playerStats, saveData.playerStats);
      }

      // 実績データを復元（ArrayからSetに変換）
      if (saveData.unlockedAchievements && Array.isArray(saveData.unlockedAchievements)) {
        gameState.unlockedAchievements = new Set(saveData.unlockedAchievements);
      }

      // ★★★ 練習進捗とマスター状況を復元 ★★★
      if (saveData.practiceProgress) {
        gameState.practiceProgress = saveData.practiceProgress;
      }

      if (saveData.kanjiReadProgress) {
        gameState.kanjiReadProgress = saveData.kanjiReadProgress;
      }

      console.log('💾 ゲームデータを読み込みました');
      console.log(`📊 レベル: ${gameState.playerStats.level}, 倒した敵: ${gameState.playerStats.enemiesDefeated}, クリアしたステージ: ${gameState.playerStats.stagesCleared}`);
      console.log(`🏆 解除済み実績数: ${gameState.unlockedAchievements.size}`);
      return true;
    } catch (error) {
      console.error('❌ ゲームデータの読み込みに失敗しました:', error);
      return false;
    }
  }

  /**
   * セーブデータを削除する（デバッグ用）
   */
  export function clearSaveData() {
    localStorage.removeItem('kanjiGameSave');
    console.log('💾 セーブデータを削除しました');
  }

  /* ---- 🔧 ラッパ関数（必要最低限だけ用意） ----------------------------- */
  
  export function updatePlayerName(newName) {
    gameState.playerName = newName.trim();
    saveGameData(); // プレイヤー名変更時もセーブ
  }
  
  export function resetStageProgress(stageId) {
    gameState.currentStageId     = stageId;
    gameState.currentEnemyIndex  = 0;
    gameState.currentEnemy       = null;
    gameState.enemies            = [];
    gameState.kanjiPool          = [];
  }

// ゲーム開始時にセーブデータを自動読み込み
loadGameData();