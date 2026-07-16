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
      nextLevelExp: 250,
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
    newlyReadKanjiList: [], // このバトルで初めて読めた漢字（勝利画面で祝う）

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

    /* ★★★ 漢字別の正答/誤答の累計（永続化対象・学習記録の正史） ★★★ */
    kanjiAnswerStats: {
      // kanjiId: { correct: number, incorrect: number }
    },

    /* ★★★ 日別の解答数（週次の成長表示用・永続化対象） ★★★ */
    dailyAnswerStats: {
      // 'YYYY-MM-DD': { correct: number, total: number }
    },

    /* ★★★ バトルベストタイム管理 ★★★ */
    stageBestTimes: {}, // { [stageId]: number(ms) }
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

  /** ローカル日付キー（YYYY-MM-DD） */
  function localDateKey(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /**
   * 漢字1問の正誤を学習記録（正史）に加算する
   * 保存は既存のセーブ契機（ステージクリア・EXP加算等）に相乗りする
   * @param {string|number} kanjiId
   * @param {boolean} isCorrect
   */
  export function recordKanjiAnswer(kanjiId, isCorrect) {
    if (kanjiId === null || kanjiId === undefined || kanjiId === '') return;
    if (!gameState.kanjiAnswerStats) gameState.kanjiAnswerStats = {};
    const key = String(kanjiId);
    const stats = gameState.kanjiAnswerStats[key] || (gameState.kanjiAnswerStats[key] = { correct: 0, incorrect: 0 });
    if (isCorrect) stats.correct++;
    else stats.incorrect++;

    // 日別カウンタ（週次の成長表示用）
    if (!gameState.dailyAnswerStats) gameState.dailyAnswerStats = {};
    const dayKey = localDateKey();
    const day = gameState.dailyAnswerStats[dayKey] || (gameState.dailyAnswerStats[dayKey] = { correct: 0, total: 0 });
    day.total++;
    if (isCorrect) day.correct++;

    // 古い日別記録は60日で間引く（肥大化防止）
    const keys = Object.keys(gameState.dailyAnswerStats);
    if (keys.length > 60) {
      keys.sort();
      for (const k of keys.slice(0, keys.length - 60)) {
        delete gameState.dailyAnswerStats[k];
      }
    }
  }

  /**
   * 直近7日と、その前7日の「読めた回数」を集計する（週次の成長表示用）
   * @returns {{thisWeek: number, lastWeek: number, diff: number}}
   */
  export function getWeeklyAnswerSummary() {
    const stats = gameState.dailyAnswerStats || {};
    const now = new Date();
    let thisWeek = 0, lastWeek = 0;
    for (let i = 0; i < 14; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const entry = stats[localDateKey(d)];
      const c = entry?.correct || 0;
      if (i < 7) thisWeek += c;
      else lastWeek += c;
    }
    return { thisWeek, lastWeek, diff: thisWeek - lastWeek };
  }

  /**
   * 漢字1文字分の学習記録を取得する（未記録なら0埋め）
   * @param {string|number} kanjiId
   * @returns {{correct: number, incorrect: number}}
   */
  export function getKanjiAnswerStats(kanjiId) {
    const stats = gameState.kanjiAnswerStats?.[String(kanjiId)];
    return { correct: stats?.correct || 0, incorrect: stats?.incorrect || 0 };
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
    // StepD Step3-1: gameState から Firebase/Firestore を直接呼ばない（同期は別レイヤで実施）
    
    return result;
  }

  /**
   * レベルアップ判定を行う
   * @returns {Object} レベルアップ結果 { leveledUp: boolean, oldLevel?: number, newLevel?: number }
   */
  function checkLevelUp() {
    const stats = gameState.playerStats;

    // 次レベル必要EXP（新テーブル）
    function nextExpFor(level) {
      const L = Math.max(1, parseInt(level, 10));
      const k = L - 1;
      return Math.max(50, Math.round(250 + 34 * k + 1.7 * k * k));
    }

    if (stats.exp >= stats.nextLevelExp) {
      const oldLevel = stats.level;

      // 経験値とレベルの更新
      stats.exp -= stats.nextLevelExp;
      stats.level++;

      // スキルポイント・ステ上昇
      stats.skillPoints += 1;
      stats.maxHp += 10;
      stats.hp = stats.maxHp;
      stats.attack += 2;

      // 次のレベルに必要な経験値（新テーブル）
      stats.nextLevelExp = nextExpFor(stats.level);

      // 回復回数リセット
      stats.healCount = 3;

      return {
        leveledUp: true,
        oldLevel: oldLevel,
        newLevel: stats.level
      };
    }

    return { leveledUp: false };
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
  // P0-2 StepA: stage_clear_* はレガシー互換キー。正史(krb_save)以外への新規書き込みを停止する。
  // 読み取り互換（ambient merge等）は維持するため、ここでは no-op とする。
  // const current = getStageClearCount(stageId);
  // localStorage.setItem(key, String(current + 1));
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
        
                // ▼ 追加: 表示/回復後行動/オートセーブ/アクセシビリティ
                const showTimer = (localStorage.getItem('showTimer') ?? `${base.settings?.showTimer ? '1' : '0'}`) === '1';
                const healMode  = localStorage.getItem('healMode') || base.settings?.healMode || 'noAttack';
                const autosaveEnabled = (localStorage.getItem('autosaveEnabled') ?? `${base.settings?.autosaveEnabled ? '1' : '0'}`) === '1';
                const autosaveMinutes = parseInt(localStorage.getItem('autosaveMinutes') || `${base.settings?.autosaveMinutes ?? 5}`, 10);
                const cbMode = (localStorage.getItem('cbMode') ?? `${base.settings?.cbMode ? '1' : '0'}`) === '1';
                const bigFont = (localStorage.getItem('bigFont') ?? `${base.settings?.bigFont ? '1' : '0'}`) === '1';
        
                // 新スキーマを更新
                const save = base || getDefaultSave();
                save.player = save.player || {};
                save.player.name = gameState.playerName || save.player.name || '';
                save.player.coreStats = Object.assign({}, save.player.coreStats || {}, gameState.playerStats || {});
                save.player.progress = Object.assign({}, save.player.progress || {}, {
                  currentStage: gameState.currentStageId || save.player?.progress?.currentStage || null,
                  clearedStages: Array.from(cleared),
                  stageBestTimes: Object.assign({}, save.player?.progress?.stageBestTimes, gameState.stageBestTimes || {})
                });
                save.player.collection = Object.assign({}, save.player.collection || {}, {
                  gotomonIds
                });
                save.player.study = Object.assign({}, save.player.study || {}, {
                  practiceProgress: gameState.practiceProgress || {},
                  kanjiReadProgress: serializeKanjiReadProgress(gameState.kanjiReadProgress || {}),
                  reviewQueue: reviewIds,
                  // 漢字別の正答/誤答の累計（{ [kanjiId]: { correct, incorrect } }）
                  answers: gameState.kanjiAnswerStats || {},
                  // 日別の解答数（{ 'YYYY-MM-DD': { correct, total } }）
                  dailyAnswerStats: gameState.dailyAnswerStats || {},
                  // 追加: ステージのレビュー解放状況を永続化
                  stageReviewUnlocked: gameState.stageReviewUnlocked || {}
                });
                save.settings = Object.assign({}, save.settings || {}, {
                  bgmVolume: Number.isFinite(bgm) ? Math.max(0, Math.min(1, bgm)) : 0.7,
                  seVolume:  Number.isFinite(se)  ? Math.max(0, Math.min(1, se )) : 0.8,
                  lang: save.settings?.lang || 'ja',
                  gameMode,
                  maxHealCount: Number.isFinite(maxHealCount) ? Math.max(1, Math.min(5, maxHealCount)) : 3,
                  enemyAttackMode,
                  // ▼ 追加設定
                  showTimer,
                  healMode,
                  autosaveEnabled,
                  autosaveMinutes: Number.isFinite(autosaveMinutes) ? Math.max(1, autosaveMinutes) : 5,
                  cbMode,
                  bigFont
                });
        
        // 実績（v1）を保存
        save.flags = Object.assign({}, save.flags || {}, {
          achievementsUnlocked: Array.from(gameState.unlockedAchievements)
        });
        
        saveNow(save);

        // P0-2 StepA: 旧フォーマット（kanjiGameSave）への新規書き込みを停止（読み取り互換は saveData 側のマイグレーションで維持）
        console.log('💾 ゲームデータを保存しました');
      }).catch(e => console.warn('saveData import failed:', e));
    } catch (error) {
      console.error('❌ ゲームデータの保存に失敗しました:', error);
    }
  }

  export function loadGameData() {
    try {
      return import('./saveData.js').then(mod => {
        const save = mod.loadSave();
        if (!save) return false;

        // 反映
        if (save.player?.name) gameState.playerName = save.player.name;
        if (save.player?.coreStats) Object.assign(gameState.playerStats, save.player.coreStats);

        if (save.player?.study?.practiceProgress) {
          gameState.practiceProgress = save.player.study.practiceProgress || {};
        }
        // ▼ kanjiReadProgress 反映＋図鑑を復元
        const rawKRP = save.player?.study?.kanjiReadProgress || {};
        if (rawKRP) {
          gameState.kanjiReadProgress = deserializeKanjiReadProgress(rawKRP || {});
          try {
            const ids = [];
            for (const [id, prog] of Object.entries(rawKRP)) {
              const onLen  = Array.isArray(prog?.onyomi) ? prog.onyomi.length : 0;
              const kunLen = Array.isArray(prog?.kunyomi) ? prog.kunyomi.length : 0;
              if (prog?.mastered || onLen > 0 || kunLen > 0) ids.push(id);
            }
            if (ids.length > 0) localStorage.setItem('krb_kanji_dex', JSON.stringify(ids));
          } catch {}
        }
        // 追加: レビュー解放のロード
        if (save.player?.study?.stageReviewUnlocked) {
          gameState.stageReviewUnlocked = save.player.study.stageReviewUnlocked || {};
        }
        // 漢字別の正答/誤答の累計（旧スキーマの配列は捨ててマップのみ受け入れる）
        const rawAnswers = save.player?.study?.answers;
        if (rawAnswers && typeof rawAnswers === 'object' && !Array.isArray(rawAnswers)) {
          gameState.kanjiAnswerStats = rawAnswers;
        }
        // 日別の解答数
        const rawDaily = save.player?.study?.dailyAnswerStats;
        if (rawDaily && typeof rawDaily === 'object' && !Array.isArray(rawDaily)) {
          gameState.dailyAnswerStats = rawDaily;
        }
        
        if (save.player?.progress?.stageBestTimes) {
          gameState.stageBestTimes = Object.assign({}, save.player.progress.stageBestTimes);
        }

        // ▼ 追加: ゴトモン図鑑（krb_monster_dex）を localStorage に復元
        if (Array.isArray(save.player?.collection?.gotomonIds)) {
          try {
            localStorage.setItem('krb_monster_dex', JSON.stringify(save.player.collection.gotomonIds));
          } catch {}
        }

        // ステージ進捗（軽量反映）
        if (Array.isArray(save.player?.progress?.clearedStages)) {
          gameState.stageProgress = gameState.stageProgress || {};
          save.player.progress.clearedStages.forEach(id => {
            gameState.stageProgress[id] = { cleared: true };
            // P0-2 StepC-1: clear_* 互換ミラー書き込みを停止（読み取り互換は saveData.isStageCleared の legacy fallback で維持）
            // try { localStorage.setItem(`clear_${id}`, '1'); } catch {}
          });
        }
        if (save.player?.progress?.currentStage) {
          gameState.currentStageId = save.player.progress.currentStage;
          try { localStorage.setItem('lastPlayedStage', gameState.currentStageId); } catch {}
        }

        // 実績（v1）読込
        if (Array.isArray(save.flags?.achievementsUnlocked)) {
          gameState.unlockedAchievements = new Set(save.flags.achievementsUnlocked);
        }
        // 音量等は AudioManager が localStorage から起動時読込するためここでは保存のみ（整合性確保）
        if (save.settings) {
          try {
            if (typeof save.settings.bgmVolume === 'number') localStorage.setItem('bgmVolume', `${save.settings.bgmVolume}`);
            if (typeof save.settings.seVolume  === 'number') localStorage.setItem('seVolume',  `${save.settings.seVolume}`);
            if (save.settings.gameMode)      localStorage.setItem('gameMode', save.settings.gameMode);
            if (save.settings.maxHealCount)  localStorage.setItem('maxHealCount', `${save.settings.maxHealCount}`);
            if (save.settings.enemyAttackMode) localStorage.setItem('enemyAttackMode', save.settings.enemyAttackMode);
            if ('showTimer' in save.settings) localStorage.setItem('showTimer', save.settings.showTimer ? '1' : '0');
            if (save.settings.healMode) localStorage.setItem('healMode', save.settings.healMode);
            if ('autosaveEnabled' in save.settings) localStorage.setItem('autosaveEnabled', save.settings.autosaveEnabled ? '1' : '0');
            if ('autosaveMinutes' in save.settings) localStorage.setItem('autosaveMinutes', `${save.settings.autosaveMinutes}`);
            if ('cbMode' in save.settings) localStorage.setItem('cbMode', save.settings.cbMode ? '1' : '0');
            if ('bigFont' in save.settings) localStorage.setItem('bigFont', save.settings.bigFont ? '1' : '0');
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
      return Promise.resolve(false);
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