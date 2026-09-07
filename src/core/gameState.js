// src/gameState.js
//
// すべての一時データを 1 か所に集約し、他モジュールは「読む／書く」だけ。
// これ以上の入れ子は作らず、必要に応じてプロパティを追加していく方針。
import { loadSave, saveNow, captureSaveContext, isSaveContextCurrent, readSaveState, clearSave, confirmedSaveKey, hasLegacySave } from './saveData.js';
import { saveProjection, collectCompatibilityEntries } from './saveProjection.js';
import { writeStorageTransaction } from './storageTransaction.js';
let loadedContext = null;
export function isSaveSessionReady() {
  return loadedContext !== null && isSaveContextCurrent(loadedContext);
}
let recordingSession = 0;
let recordedQuestions = new WeakSet();
let recordedClears = new WeakSet();
let pendingRecordSave = false;
let pendingCloudSync = false;
function scheduleCloudSync() {
  if (pendingCloudSync || typeof window === 'undefined') return;
  pendingCloudSync = true;
  const session = recordingSession;
  queueMicrotask(async () => {
    pendingCloudSync = false;
    if (session !== recordingSession || !isSaveContextCurrent(loadedContext)) return;
    try {
      const { syncAllCaches } = await import('../services/firebase/firebaseController.js');
      if (session === recordingSession && isSaveContextCurrent(loadedContext)) {
        const result = await syncAllCaches();
        if (!result.ok && !result.offline) console.warn('Cloud sync paused; local save is retained', result.error);
      }
    } catch (error) { console.warn('Cloud sync unavailable; local save is retained', error); }
  });
}
export function beginQuestion(source) {
  return { id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`, source, session: recordingSession };
}
function scheduleRecordSave() {
  if (pendingRecordSave) return;
  pendingRecordSave = true;
  const session = recordingSession;
  queueMicrotask(() => {
    pendingRecordSave = false;
    if (session === recordingSession) saveGameData();
  });
}

export const battleState = {
  turn: 'player', // 'player' または 'enemy'
  inputEnabled: true,
  message: '',
  comboCount: 0,
  timeRemaining: 60,
  recentKanjiIds: [], // 漢字の重複出題防止用（念のため復活）
  currentKanjiIndex: 0,  // 現在の問題インデックス
  mistakesThisStage: 0,  // ステージごとのミス回数

  // 「読めてはいるが書き方だけずれた入力」を、この問題で何回したか。
  // 罰にはせず、2回目からは正しい書き方を見せるための回数。問題ごとに 0 に戻す。
  nearMissCount: 0,

  // 「さっき読めなかった字」を数問あとにもう一度出すための予約。
  // 翌日以降のSM-2（reviewQueue）とは別に、その場での取り返しの機会を作る。
  // [{ id, waitTurns }]。ステージを始めるたびに空にする。
  retryQueue: [],
  
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
    // 現在のバトル文脈を表す一時値。'practice' は練習・復習中を意味する。
    // 永続する設定（じっくり/チャレンジ）は localStorage の 'gameMode' が正史で、
    // saveData の既定・loadGameData のフォールバック・設定画面の既定はいずれも 'jikkuri'。
    // ここだけ 'challenge' だったため、起動直後は設定と無関係に罰ありで始まっていた。
    gameMode: 'jikkuri', // 'jikkuri' | 'challenge' | 'practice'
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
  export function recordStageCleared(run = battleState.stageRun) {
    if (!run || run.session !== recordingSession || recordedClears.has(run)) return false;
    recordedClears.add(run);
    gameState.playerStats.stagesCleared++;
    saveGameData();
    console.log(`📊 クリアしたステージ数: ${gameState.playerStats.stagesCleared}`);
    return true;
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
   * 同じ問題の確定を一度記録し、現在の同期処理が終わる時点で保存する。
   * @param {string|number} kanjiId
   * @param {boolean} isCorrect
   */
  export function recordKanjiAnswer(kanjiId, isCorrect, context = {}) {
    if (kanjiId === null || kanjiId === undefined || kanjiId === '') return false;
    const question = context.question;
    if (question && (question.session !== recordingSession || recordedQuestions.has(question))) return false;
    if (question) recordedQuestions.add(question);
    if (!gameState.kanjiAnswerStats) gameState.kanjiAnswerStats = {};
    const key = String(kanjiId);
    const stats = gameState.kanjiAnswerStats[key] || (gameState.kanjiAnswerStats[key] = { correct: 0, incorrect: 0 });
    if (isCorrect) stats.correct++;
    else stats.incorrect++;
    if (['attack','heal'].includes(context.source)) gameState.playerStats[isCorrect ? 'totalCorrect' : 'totalIncorrect']++;
    const support = context.answerRevealed === true || context.hintLevel === 4 ? 'revealed'
      : Number.isInteger(context.hintLevel) && context.hintLevel >= 0 && context.hintLevel <= 3
        ? ['independent','hint1','hint2','hint3'][context.hintLevel] : 'unknown';
    const observe = target => {
      const measured = target.observed || (target.observed = { version: 1, correct: {}, incorrect: 0 });
      if (isCorrect) measured.correct[support] = (measured.correct[support] || 0) + 1;
      else measured.incorrect++;
    };
    observe(stats);
    stats.lastObservation = { questionId: question?.id || null, source: context.source || question?.source || 'unknown',
      reading: typeof context.reading === 'string' ? context.reading : null, support, correct: !!isCorrect };
    if (isCorrect && typeof context.reading === 'string') {
      const progress = gameState.kanjiReadProgress[key] || (gameState.kanjiReadProgress[key] = { onyomi: new Set(), kunyomi: new Set(), mastered: false });
      const readings = progress.observedReadings || (progress.observedReadings = {});
      const values = readings[support] || (readings[support] = []);
      if (!values.includes(context.reading)) values.push(context.reading);
    }

    // 日別カウンタ（週次の成長表示用）
    if (!gameState.dailyAnswerStats) gameState.dailyAnswerStats = {};
    const dayKey = localDateKey();
    const day = gameState.dailyAnswerStats[dayKey] || (gameState.dailyAnswerStats[dayKey] = { correct: 0, total: 0 });
    day.total++;
    if (isCorrect) day.correct++;
    observe(day);

    // 古い日別記録は60日で間引く（肥大化防止）
    const keys = Object.keys(gameState.dailyAnswerStats);
    if (keys.length > 60) {
      keys.sort();
      for (const k of keys.slice(0, keys.length - 60)) {
        delete gameState.dailyAnswerStats[k];
      }
    }
    if (!context.deferSave) scheduleRecordSave();
    return true;
  }

  // commitLearningOutcome が保存に失敗した時だけ、同じ問題を安全に再試行できるように戻す。
  export function releaseRecordedQuestion(question) {
    if (question) recordedQuestions.delete(question);
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
    out[id] = { ...prog, onyomi: ony, kunyomi: kun, mastered: !!prog?.mastered };
  }
  return out;
}
function deserializeKanjiReadProgress(raw) {
  const out = {};
  for (const [id, prog] of Object.entries(raw || {})) {
    const onyArr = Array.isArray(prog?.onyomi) ? prog.onyomi : [];
    const kunArr = Array.isArray(prog?.kunyomi) ? prog.kunyomi : [];
    out[id] = { ...prog, onyomi: new Set(onyArr), kunyomi: new Set(kunArr), mastered: !!prog?.mastered };
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
  export function saveGameData(updateSnapshot) {
    try {
        if (!loadedContext || !isSaveContextCurrent(loadedContext)) return { ok: false, error: new Error('Save session changed or is not ready') };
      // セーブのベースを取得
        const base = loadSave();
        if (!base) return { ok: false, error: new Error('Save is not readable') };

        // 現在のレビューキュー/図鑑などはローカルキーからスナップショット
        const gotomonIds = JSON.parse(localStorage.getItem('krb_monster_dex') || '[]');
        // NOTE: reviewQueue は id 配列としてしか保存しておらず、しかも読み戻す処理が
        // どこにも無かったため、ファイル経由のバックアップで「今日の復習」が空になっていた。
        // 互換のため id 配列（reviewQueue）はそのまま残し、SM-2 の間隔まで含めた
        // 全項目を reviewQueueDetail として併せて保存する。
        const reviewDetail = JSON.parse(localStorage.getItem('krb_review_queue') || '[]');
        const reviewIds = reviewDetail.map(e => e.id);

        // ボーナスの称号カウント（bonus_{grade}_clearCount / _firstClear）も
        // localStorage にしかなく、バックアップで失われていた。
        const bonusCounters = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          const match = /^bonus_(\d+)_(clearCount|firstClear)$/.exec(key);
          if (!match) continue;
          const value = bonusCounters[match[1]] || (bonusCounters[match[1]] = {});
          value[match[2]] = match[2] === 'firstClear' ? localStorage.getItem(key) === '1' : Number(localStorage.getItem(key));
        }
        const cleared = new Set(Object.entries(gameState.stageProgress || {}).filter(([, p]) => p.cleared).map(([id]) => id));
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
                // 弱点の読み系統だけを正解にするか（既定は OFF。2026-09-05 変更。readingScope.js と揃える）
                const weaknessScope = (localStorage.getItem('weaknessScope') ?? `${base.settings?.weaknessScope === true ? '1' : '0'}`) === '1';
                // 例文の中で読ませるモード（既定は OFF）
                const exampleMode = (localStorage.getItem('exampleMode') ?? `${base.settings?.exampleMode ? '1' : '0'}`) === '1';
                // 画面の漢字にふりがなを振るか（既定は OFF）
                const rubyMode = (localStorage.getItem('rubyMode') ?? `${base.settings?.rubyMode ? '1' : '0'}`) === '1';
        
                // 新スキーマを更新
                const save = base;
                save.player = save.player || {};
                save.player.name = gameState.playerName || save.player.name || '';
                save.player.coreStats = Object.assign({}, save.player.coreStats || {}, gameState.playerStats || {});
                save.player.progress = Object.assign({}, save.player.progress || {}, {
                  currentStage: gameState.currentStageId,
                  checkpoints: Object.fromEntries(Object.entries(gameState.stageProgress || {}).filter(([, p]) => !p.cleared && p.checkpoint !== undefined).map(([id, p]) => [id, p.checkpoint])),
                  clearedStages: Array.from(cleared),
                  bonusCounters,
                  stageBestTimes: Object.assign({}, save.player?.progress?.stageBestTimes, gameState.stageBestTimes || {})
                });
                save.player.collection = Object.assign({}, save.player.collection || {}, {
                  gotomonIds,
                  kanjiIds: JSON.parse(localStorage.getItem('krb_kanji_dex') || '[]'),
                  seenMonsterIds: JSON.parse(localStorage.getItem('krb_seen_monsters') || '[]'),
                  favoriteMonsterIds: JSON.parse(localStorage.getItem('krb_monster_favorites') || '[]')
                });
                save.player.study = Object.assign({}, save.player.study || {}, {
                  practiceProgress: gameState.practiceProgress || {},
                  kanjiReadProgress: serializeKanjiReadProgress(gameState.kanjiReadProgress || {}),
                  reviewQueue: reviewIds,
                  reviewQueueDetail: reviewDetail,
                  quickReviewBuffer: JSON.parse(localStorage.getItem('quickReviewBuffer') || 'null'),
                  wrongKanji: JSON.parse(localStorage.getItem('krb_wrong_kanji') || 'null'),
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
                  bigFont,
                  weaknessScope,
                  exampleMode,
                  rubyMode
                });
        
        // 実績（v1）を保存
        save.flags = Object.assign({}, save.flags || {}, {
          achievementsUnlocked: Array.from(gameState.unlockedAchievements)
        });
        
        if (typeof updateSnapshot === 'function') updateSnapshot(save);
        save.meta.recordingVersion = 1;
        save.meta.compatibilityEntries = collectCompatibilityEntries();
        const result = saveNow(save);
        if (result.ok) { loadedContext = captureSaveContext(); scheduleCloudSync(); }

        // P0-2 StepA: 旧フォーマット（kanjiGameSave）への新規書き込みを停止（読み取り互換は saveData 側のマイグレーションで維持）
        if (!result.ok) console.warn('ゲームデータの保存に失敗しました', result.error);
        return result;
    } catch (error) {
      console.error('❌ ゲームデータの保存に失敗しました:', error);
      return { ok: false, error };
    }
  }

  export async function loadGameData() {
    try {
      loadedContext = null;
      recordingSession++;
      recordedQuestions = new WeakSet();
      recordedClears = new WeakSet();
      let save = loadSave();
      if (!save) return false;
      const state = readSaveState();
      const old = state.raw && JSON.parse(state.raw);
      const legacy = state.status === 'missing' && hasLegacySave();
      const migrationNeeded = legacy || (old && JSON.stringify(old) !== JSON.stringify(save));
      const entries = saveProjection(save);
      if (state.raw !== null) entries[confirmedSaveKey()] = state.raw;
      const projected = migrationNeeded ? saveNow(save) : writeStorageTransaction(entries);
      if (!projected.ok) return false;
      if (projected.save) save = projected.save;
      const { player } = save;
      gameState.playerName = player.name;
      gameState.playerStats = { ...player.coreStats };
      gameState.practiceProgress = player.study.practiceProgress || {};
      gameState.kanjiReadProgress = deserializeKanjiReadProgress(player.study.kanjiReadProgress || {});
      gameState.kanjiAnswerStats = player.study.answers || {};
      gameState.dailyAnswerStats = player.study.dailyAnswerStats || {};
      gameState.stageReviewUnlocked = player.study.stageReviewUnlocked || {};
      gameState.stageBestTimes = player.progress.stageBestTimes || {};
      gameState.currentStageId = player.progress.currentStage;
      gameState.stageProgress = {};
      for (const [id, checkpoint] of Object.entries(player.progress.checkpoints || {})) gameState.stageProgress[id] = { checkpoint };
      for (const id of player.progress.clearedStages) gameState.stageProgress[id] = { cleared: true };
      gameState.unlockedAchievements = new Set(save.flags.achievementsUnlocked || []);
      gameState.quickReviewTargets = player.study.quickReviewBuffer || null;
      gameState.wrongKanjiList = [];
      gameState.correctKanjiList = [];
      loadedContext = captureSaveContext();
      if (typeof window !== 'undefined') {
        import('../ui/textScale.js').then(m => m.refresh()).catch(() => {});
        import('../ui/palette.js').then(m => m.refresh()).catch(() => {});
        import('./readingScope.js').then(m => m.refresh()).catch(() => {});
        import('./exampleMode.js').then(m => m.refresh()).catch(() => {});
        import('../ui/ruby.js').then(m => m.refresh()).catch(() => {});
      }
      return true;
    } catch (error) { console.warn('Save hydration failed', error); return false; }
  }

  export function clearSaveData() {
    const result = clearSave();
    if (result.ok) loadedContext = null;
    return result;
  }


  /* ---- 🔧 ラッパ関数（必要最低限だけ用意） ----------------------------- */
  
  export function updatePlayerName(newName) {
    const previous = gameState.playerName;
    gameState.playerName = newName.trim();
    const result = saveGameData();
    if (!result.ok) gameState.playerName = previous;
    return result;
  }
  
  export function resetStageProgress(stageId) {
    gameState.currentStageId     = stageId;
    gameState.currentEnemyIndex  = 0;
    gameState.currentEnemy       = null;
    gameState.enemies            = [];
    gameState.kanjiPool          = [];
  }
