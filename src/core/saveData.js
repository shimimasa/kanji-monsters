// src/core/saveData.js
// LocalStorage ベースのセーブ機構（v1）
// - 将来の IndexedDB 拡張に備え、APIは純粋関数で分離
// - マイグレーション: 旧 'kanjiGameSave' や個別キー（bgmVolume/seVolume/krb_review_queue 等）を吸収

const STORAGE_KEY = 'krb_save';
const CURRENT_VERSION = 1;

export function getDefaultSave() {
  return {
    meta: { version: CURRENT_VERSION, lastSavedAt: 0 },
    player: {
      name: '',
      coreStats: {
        hp: 100, maxHp: 100, level: 1, exp: 0, nextLevelExp: 100,
        attack: 10, healCount: 3, skillPoints: 0,
        enemiesDefeated: 0, stagesCleared: 0,
        totalCorrect: 0, totalIncorrect: 0, comboCount: 0,
        weaknessHits: 0, healsSuccessful: 0, skillPointsUsed: 0, bossesDefeated: 0, playtimeSeconds: 0
      },
      progress: {
        currentRegion: null,
        currentStage: null,
        clearedStages: []
      },
      collection: {
        gotomonIds: [], // krb_monster_dex
        legendaryUnlocked: {},
        phantomUnlocked: {}
      },
      study: {
        answers: [],       // {id, correct, ts}
        reviewQueue: [],   // krb_review_queue から id の配列に縮約
        practiceProgress: {}, // gameState.practiceProgress
        kanjiReadProgress: {}, // serialize された形
        masterMode: { xp: 0, level: 1, gauge: 0 }
      }
    },
    settings: {
      bgmVolume: 0.7,
      seVolume: 0.8,
      lang: 'ja',
      gameMode: 'jikkuri',
      maxHealCount: 3,
      enemyAttackMode: 'onMistakeOnly',
      // ▼ 追加: バックアップ対象に含める設定類
      showTimer: false,
      healMode: 'noAttack',
      autosaveEnabled: true,
      autosaveMinutes: 5,
      cbMode: false,
      bigFont: false
    },
    flags: {
      bonusUnlocked: {}
    }
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // 旧データから移行
      const migrated = migrateFromLegacyOrEmpty();
      saveNow(migrated);
      return migrated;
    }
    const parsed = JSON.parse(raw);
    const fixed = migrateSave(parsed);
    if (fixed !== parsed) saveNow(fixed);
    return fixed;
  } catch (e) {
    console.warn('loadSave failed, fallback to default:', e);
    const d = getDefaultSave();
    saveNow(d);
    return d;
  }
}

export function migrateSave(save) {
  // バージョン未設定（v0 扱い）を v1 へ包む
  if (!save || !save.meta || typeof save.meta.version !== 'number') {
    const wrapped = getDefaultSave();
    // 旧 'kanjiGameSave' 風の断片を合流
    if (save && (save.playerStats || save.playerName)) {
      wrapped.player.name = save.playerName || '';
      if (save.playerStats && typeof save.playerStats === 'object') {
        Object.assign(wrapped.player.coreStats, save.playerStats);
      }
      if (save.unlockedAchievements && Array.isArray(save.unlockedAchievements)) {
        wrapped.flags.achievementsUnlocked = save.unlockedAchievements.slice();
      }
      if (save.practiceProgress) wrapped.player.study.practiceProgress = save.practiceProgress || {};
      if (save.kanjiReadProgress) wrapped.player.study.kanjiReadProgress = save.kanjiReadProgress || {};
    }
    // 個別キーを取り込み
    mergeAmbientKeys(wrapped);
    wrapped.meta.version = CURRENT_VERSION;
    wrapped.meta.lastSavedAt = Date.now();
    return wrapped;
  }

  // 既に v1 だが欠損があればデフォルトで埋める
  if (save.meta.version === 1) {
    const d = getDefaultSave();
    // 浅いマージで未知キーは温存
    save.meta.lastSavedAt = save.meta.lastSavedAt || 0;
    save.player = Object.assign({}, d.player, save.player || {});
    save.player.coreStats = Object.assign({}, d.player.coreStats, save.player.coreStats || {});
    save.player.progress = Object.assign({}, d.player.progress, save.player.progress || {});
    save.player.collection = Object.assign({}, d.player.collection, save.player.collection || {});
    save.player.study = Object.assign({}, d.player.study, save.player.study || {});
    save.settings = Object.assign({}, d.settings, save.settings || {});
    save.flags = Object.assign({}, d.flags, save.flags || {});
    return save;
  }

  // 将来バージョン: 段階的に引き上げる想定（今は 1 のみ）
  // fallthrough: とりあえず最新版の型に埋め直す
  const d = getDefaultSave();
  return Object.assign(d, save);
}

export function saveNow(save) {
  try {
    save.meta = save.meta || {};
    save.meta.version = CURRENT_VERSION;
    save.meta.lastSavedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch (e) {
    console.error('saveNow failed:', e);
  }
}

export function clearSave() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

// ---------- StepB-1: 読み取り入口の集約（SSoT=krb_save 優先） ----------
//
// 目的: clear_* / stage_clear_* / stage_first_clear_at_* の読み取りを 1箇所に集約する。
// - 新しい保存キー/スキーマは作らない（read-only）
// - 既存挙動は fallback(localStorage) で維持する
// - 注意: loadSave() は migrate に伴い saveNow() を呼び得るため、ここでは「読み取り専用」で krb_save を読む。

function __readKrbSaveNoWrite() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return migrateSave(parsed);
  } catch {
    return null;
  }
}

export function isStageCleared(stageId) {
  const id = String(stageId || '');
  if (!id) return false;

  const save = __readKrbSaveNoWrite();
  const clearedStages = save?.player?.progress?.clearedStages;
  if (Array.isArray(clearedStages)) {
    return clearedStages.includes(id);
  }

  // fallback: legacy
  try { return localStorage.getItem(`clear_${id}`) === '1'; } catch {}
  return false;
}

export function getStageClearCount(stageId) {
  const id = String(stageId || '');
  if (!id) return 0;

  const save = __readKrbSaveNoWrite();
  // v1 正史には「クリア回数」フィールドが定義されていないため、存在する場合のみ参照する（新設計は禁止）
  const counts = save?.player?.progress?.stageClearCounts;
  const v = (counts && typeof counts === 'object') ? counts[id] : undefined;
  if (typeof v === 'number' && Number.isFinite(v)) return v;

  // fallback: legacy
  try {
    const raw = localStorage.getItem(`stage_clear_${id}`);
    const n = parseInt(raw || '0', 10);
    return Number.isFinite(n) ? n : 0;
  } catch {}
  return 0;
}

export function getStageFirstClearAt(stageId) {
  const id = String(stageId || '');
  if (!id) return null;

  const save = __readKrbSaveNoWrite();
  // v1 正史には「初回クリア日時」フィールドが定義されていないため、存在する場合のみ参照する（新設計は禁止）
  const map = save?.player?.progress?.stageFirstClearAt;
  const v = (map && typeof map === 'object') ? map[id] : undefined;
  if (typeof v === 'number' && Number.isFinite(v)) return v;

  // fallback: legacy
  try {
    const raw = localStorage.getItem(`stage_first_clear_at_${id}`);
    const n = parseInt(raw || '', 10);
    return Number.isFinite(n) ? n : null;
  } catch {}
  return null;
}

// ---------- 内部: レガシー取り込み ----------

function migrateFromLegacyOrEmpty() {
  const d = getDefaultSave();

  // 旧メインセーブ
  try {
    const legacyRaw = localStorage.getItem('kanjiGameSave');
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      if (legacy?.playerName) d.player.name = legacy.playerName;
      if (legacy?.playerStats) Object.assign(d.player.coreStats, legacy.playerStats);
      if (legacy?.practiceProgress) d.player.study.practiceProgress = legacy.practiceProgress || {};
      if (legacy?.kanjiReadProgress) d.player.study.kanjiReadProgress = legacy.kanjiReadProgress || {};
      if (Array.isArray(legacy?.unlockedAchievements)) {
        d.flags.achievementsUnlocked = legacy.unlockedAchievements.slice();
      }
    }
  } catch {}

  mergeAmbientKeys(d);
  d.meta.lastSavedAt = Date.now();
  return d;
}

function mergeAmbientKeys(saveObj) {
  // 音量・モード
  const bgm = parseFloat(localStorage.getItem('bgmVolume') || '');
  const se  = parseFloat(localStorage.getItem('seVolume') || '');
  if (!Number.isNaN(bgm)) saveObj.settings.bgmVolume = clamp01(bgm);
  if (!Number.isNaN(se))  saveObj.settings.seVolume  = clamp01(se);

  const gm = localStorage.getItem('gameMode');
  if (gm) saveObj.settings.gameMode = gm;
  const mh = parseInt(localStorage.getItem('maxHealCount') || '3', 10);
  if (!Number.isNaN(mh)) saveObj.settings.maxHealCount = Math.max(1, Math.min(5, mh));
  const eam = localStorage.getItem('enemyAttackMode');
  if (eam) saveObj.settings.enemyAttackMode = eam;

  // ▼ 追加: 表示・オートセーブ・アクセシビリティ
  const st = localStorage.getItem('showTimer');
  if (st !== null) saveObj.settings.showTimer = st === '1';

  const hm = localStorage.getItem('healMode');
  if (hm) saveObj.settings.healMode = hm;

  const ase = localStorage.getItem('autosaveEnabled');
  if (ase !== null) saveObj.settings.autosaveEnabled = ase === '1';

  const asm = parseInt(localStorage.getItem('autosaveMinutes') || '', 10);
  if (!Number.isNaN(asm)) saveObj.settings.autosaveMinutes = Math.max(1, asm);

  const cb = localStorage.getItem('cbMode');
  if (cb !== null) saveObj.settings.cbMode = cb === '1';

  const bf = localStorage.getItem('bigFont');
  if (bf !== null) saveObj.settings.bigFont = bf === '1';

  // 最終プレイステージ
  const last = localStorage.getItem('lastPlayedStage');
  if (last) saveObj.player.progress.currentStage = last;

  // ステージクリア（clear_*, stage_clear_* 両対応）
  const cleared = new Set(Array.isArray(saveObj.player.progress.clearedStages) ? saveObj.player.progress.clearedStages : []);
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (k.startsWith('clear_') && localStorage.getItem(k) === '1') {
      cleared.add(k.replace(/^clear_/, ''));
    }
    if (k.startsWith('stage_clear_')) {
      const id = k.replace(/^stage_clear_/, '');
      const v = parseInt(localStorage.getItem(k) || '0', 10);
      if (v > 0) cleared.add(id);
    }
  }
  saveObj.player.progress.clearedStages = Array.from(cleared);

  // 図鑑
  try {
    const dex = JSON.parse(localStorage.getItem('krb_monster_dex') || '[]');
    if (Array.isArray(dex)) saveObj.player.collection.gotomonIds = dex.filter(x => typeof x === 'string');
  } catch {}

  // レビューキュー（id だけのスナップショット）
  try {
    const rq = JSON.parse(localStorage.getItem('krb_review_queue') || '[]');
    if (Array.isArray(rq)) saveObj.player.study.reviewQueue = rq.map(e => e?.id).filter(Boolean);
  } catch {}
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

export function hardResetAllLocalData() {
  try {
    const targets = new Set([
      'krb_save', 'kanjiGameSave',
      'bgmVolume','seVolume','gameMode','maxHealCount','enemyAttackMode',
      'showTimer','healMode','autosaveEnabled','autosaveMinutes',
      'cbMode','bigFont','lastPlayedStage','playerStats','unlockedStages',
      'kanjiBattleScores','quickReviewBuffer','dailyPracticeStats','bs_blockHistory'
    ]);
    const toDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (
        targets.has(k) ||
        k.startsWith('krb_') ||
        k.startsWith('clear_') ||
        k.startsWith('stage_clear_')
      ) {
        toDelete.push(k);
      }
    }
    toDelete.forEach(k => { try { localStorage.removeItem(k); } catch {} });
    console.log(`LocalStorage hard reset: ${toDelete.length} keys removed`);
  } catch (e) {
    console.error('hardResetAllLocalData failed:', e);
  }
}