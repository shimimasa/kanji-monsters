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
    // ★★★ マスターモードを追加 ★★★
    gameMode: 'challenge', // 'jikkuri', 'challenge', 'practice'
    previousScreen: null, // 遷移元の画面を保存
  
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

    /* ★★★ マスターモード用の進捗管理 ★★★ */
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

  // Helper: serialize/deserialize kanjiReadProgress
function serializeKanjiReadProgress(progress) {
  const out = {};
  for (const [id, prog] of Object.entries(progress || {})) {
    const ony = prog?.onyomi instanceof Set ? Array.from(prog.onyomi) : Array.isArray(prog?.onyomi) ? prog.onyomi : [];
    const kun = prog?.kunyomi instanceof Set ? Array.from(prog.kunyomi) : Array.isArray(prog?.kunyomi) ? prog.kunyomi : [];
    out[id] = { onyomi: ony, kunyomi: kun, mastered: !!prog?.mastered };
  }
  return out;
}
function deserializeKanjiReadProgress(raw) {
  const out = {};
  for (const [id, prog] of Object.entries(raw || {})) {
    const onyArr = Array.isArray(prog?.onyomi) ? prog.onyomi : [];
    const kunArr = Array.isArray(prog?.kunyomi) ? prog.kunyomi : [];
    out[id] = { onyomi: new Set(onyArr), kunyomi: new Set(kunArr), mastered: !!prog?.mastered };
  }
  return out;
}

function getStageClearCount(stageId) {
  const key = `stage_clear_${stageId}`;
  return parseInt(localStorage.getItem(key) || '0');
}

function incrementStageClearCount(stageId) {
  const key = `stage_clear_${stageId}`;
  const current = getStageClearCount(stageId);
  localStorage.setItem(key, String(current + 1));
}
  /**
   * ゲームデータをlocalStorageに保存する
   */
  export function saveGameData() {
    try {
      // セーブのベースを取得
      import('./saveData.js').then(mod => {
        const { getDefaultSave, loadSave, saveNow } = mod;
        const base = loadSave ? loadSave() : getDefaultSave();

        // 現在のレビューキュー/図鑑などはローカルキーからスナップショット
        let gotomonIds = [];
        try {
          const dex = JSON.parse(localStorage.getItem('krb_monster_dex') || '[]');
          if (Array.isArray(dex)) gotomonIds = dex.filter(x => typeof x === 'string');
        } catch {}
        let reviewIds = [];
        try {
          const rq = JSON.parse(localStorage.getItem('krb_review_queue') || '[]');
          if (Array.isArray(rq)) reviewIds = rq.map(e => e?.id).filter(Boolean);
        } catch {}

        // ステージクリアの統合
        const cleared = new Set(base?.player?.progress?.clearedStages || []);
        if (typeof window !== 'undefined' && window.gameState?.stageProgress) {
          Object.entries(window.gameState.stageProgress).forEach(([sid, v]) => {
            if (v && v.cleared) cleared.add(sid);
          });
        }
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          if (k.startsWith('clear_') && localStorage.getItem(k) === '1') cleared.add(k.replace(/^clear_/, ''));
          if (k.startsWith('stage_clear_')) {
            const sid = k.replace(/^stage_clear_/, '');
            const v = parseInt(localStorage.getItem(k) || '0', 10);
            if (v > 0) cleared.add(sid);
          }
        }

        // 音量・設定
        const bgm = parseFloat(localStorage.getItem('bgmVolume') || `${base.settings?.bgmVolume ?? 0.7}`);
        const se  = parseFloat(localStorage.getItem('seVolume')  || `${base.settings?.seVolume  ?? 0.8}`);
        const gameMode = localStorage.getItem('gameMode') || base.settings?.gameMode || 'jikkuri';
        const maxHealCount = parseInt(localStorage.getItem('maxHealCount') || `${base.settings?.maxHealCount ?? 3}`, 10);
        const enemyAttackMode = localStorage.getItem('enemyAttackMode') || base.settings?.enemyAttackMode || 'onMistakeOnly';

        // 新スキーマを更新
        const save = base || getDefaultSave();
        save.player = save.player || {};
        save.player.name = gameState.playerName || save.player.name || '';
        save.player.coreStats = Object.assign({}, save.player.coreStats || {}, gameState.playerStats || {});
        save.player.progress = Object.assign({}, save.player.progress || {}, {
          currentStage: gameState.currentStageId || save.player?.progress?.currentStage || null,
          clearedStages: Array.from(cleared)
        });
        save.player.collection = Object.assign({}, save.player.collection || {}, {
          gotomonIds
        });
        save.player.study = Object.assign({}, save.player.study || {}, {
          practiceProgress: gameState.practiceProgress || {},
          kanjiReadProgress: serializeKanjiReadProgress(gameState.kanjiReadProgress || {}),
          reviewQueue: reviewIds
          // answers は別イベントで追記想定（今は触らない）
        });
        save.settings = Object.assign({}, save.settings || {}, {
          bgmVolume: Number.isFinite(bgm) ? Math.max(0, Math.min(1, bgm)) : 0.7,
          seVolume:  Number.isFinite(se)  ? Math.max(0, Math.min(1, se )) : 0.8,
          lang: save.settings?.lang || 'ja',
          gameMode,
          maxHealCount: Number.isFinite(maxHealCount) ? Math.max(1, Math.min(5, maxHealCount)) : 3,
          enemyAttackMode
        });

        saveNow(save);

        // 旧フォーマットも当面残しておく（後方互換）
        localStorage.setItem('kanjiGameSave', JSON.stringify({
          playerName: gameState.playerName,
          playerStats: gameState.playerStats,
          unlockedAchievements: Array.from(gameState.unlockedAchievements),
          practiceProgress: gameState.practiceProgress,
          kanjiReadProgress: serializeKanjiReadProgress(gameState.kanjiReadProgress)
        }));
        console.log('💾 ゲームデータを保存しました');
      }).catch(e => console.warn('saveData import failed:', e));
    } catch (error) {
      console.error('❌ ゲームデータの保存に失敗しました:', error);
    }
  }

  export function loadGameData() {
    try {
      import('./saveData.js').then(mod => {
        const save = mod.loadSave();
        if (!save) return false;

        // 反映
        if (save.player?.name) gameState.playerName = save.player.name;
        if (save.player?.coreStats) Object.assign(gameState.playerStats, save.player.coreStats);

        if (save.player?.study?.practiceProgress) {
          gameState.practiceProgress = save.player.study.practiceProgress || {};
        }
        if (save.player?.study?.kanjiReadProgress) {
          gameState.kanjiReadProgress = deserializeKanjiReadProgress(save.player.study.kanjiReadProgress || {});
        }

        // ステージ進捗（軽量反映）
        if (Array.isArray(save.player?.progress?.clearedStages)) {
          gameState.stageProgress = gameState.stageProgress || {};
          save.player.progress.clearedStages.forEach(id => {
            gameState.stageProgress[id] = { cleared: true };
            try { localStorage.setItem(`clear_${id}`, '1'); } catch {}
          });
        }
        if (save.player?.progress?.currentStage) {
          gameState.currentStageId = save.player.progress.currentStage;
          try { localStorage.setItem('lastPlayedStage', gameState.currentStageId); } catch {}
        }

        // 音量等は AudioManager が localStorage から起動時読込するためここでは保存のみ（整合性確保）
        if (save.settings) {
          try {
            if (typeof save.settings.bgmVolume === 'number') localStorage.setItem('bgmVolume', `${save.settings.bgmVolume}`);
            if (typeof save.settings.seVolume  === 'number') localStorage.setItem('seVolume',  `${save.settings.seVolume}`);
            if (save.settings.gameMode)      localStorage.setItem('gameMode', save.settings.gameMode);
            if (save.settings.maxHealCount)  localStorage.setItem('maxHealCount', `${save.settings.maxHealCount}`);
            if (save.settings.enemyAttackMode) localStorage.setItem('enemyAttackMode', save.settings.enemyAttackMode);
          } catch {}
        }

        console.log('💾 ゲームデータを読み込みました');
        return true;
      }).catch(e => {
        console.warn('load saveData failed:', e);
        return false;
      });
    } catch (error) {
      console.error('❌ ゲームデータの読み込みに失敗しました:', error);
      return false;
    }
  }

  export function clearSaveData() {
    try {
      import('./saveData.js').then(mod => mod.clearSave && mod.clearSave());
      localStorage.removeItem('kanjiGameSave'); // 旧フォーマットも削除
      console.log('💾 セーブデータを削除しました');
    } catch {}
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