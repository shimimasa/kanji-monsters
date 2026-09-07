// src/core/saveData.js
// LocalStorage ベースのセーブ機構（形式v2、カタログ版は別管理）
// - 将来の IndexedDB 拡張に備え、APIは純粋関数で分離
// - マイグレーション: 旧 'kanjiGameSave' や個別キー（bgmVolume/seVolume/krb_review_queue 等）を吸収

import { validateSave } from './saveValidation.js';
import { migrateKanjiIds, CATALOG_VERSION } from './kanjiIdMigration.js';
import { saveProjection, collectCompatibilityEntries } from './saveProjection.js';
import { writeStorageTransaction, recoverStorageTransaction } from './storageTransaction.js';

const STORAGE_KEY = 'krb_save';
export const CURRENT_VERSION = 2;
export const confirmedSaveKey = (slot = localStorage.getItem('yomitabi_slot') || '1') => `yomitabi_confirmed_${slot}`;
export function captureSaveContext() {
  return JSON.stringify([localStorage.getItem('yomitabi_slot') || '1', localStorage.getItem('yomitabi_storage_epoch'), localStorage.getItem(STORAGE_KEY)]);
}
export function isSaveContextCurrent(context) {
  try { return context === captureSaveContext(); } catch { return false; }
}
export function hasLegacySave() {
  if (localStorage.getItem('kanjiGameSave') !== null) return true;
  for (const key of ['krb_review_queue','krb_kanji_dex','krb_monster_dex','quickReviewBuffer','krb_wrong_kanji']) {
    const raw = localStorage.getItem(key);
    if (raw !== null && !['[]','null',''].includes(raw.trim())) return true;
  }
  return Object.entries(collectCompatibilityEntries()).some(([key, value]) => /^(clear_|stage_clear_)/.test(key) && Number(value) > 0);
}
export function preserveLocalOriginal() {
  const slot = localStorage.getItem('yomitabi_slot') || '1';
  const key = `yomitabi_preserved_${slot}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const entries = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (/^(krb_|clear_|stage_clear_|stage_first_clear_at_|bonus_|tutorial_seen_)/.test(k) ||
        ['kanjiGameSave','quickReviewBuffer','playerStats','unlockedStages','kanjiBattleScores','dailyPracticeStats','bs_blockHistory'].includes(k)) entries[k] = localStorage.getItem(k);
  }
  entries[confirmedSaveKey()] = localStorage.getItem(confirmedSaveKey());
  const raw = localStorage.getItem(STORAGE_KEY);
  const data = JSON.stringify(entries);
  localStorage.setItem(`${key}_entries`, data);
  if (localStorage.getItem(`${key}_entries`) !== data) throw new Error('Could not preserve legacy entries');
  if (raw !== null) {
    localStorage.setItem(key, raw);
    if (localStorage.getItem(key) !== raw) throw new Error('Could not preserve original save');
  }
}

export function getDefaultSave() {
  return {
    meta: { version: CURRENT_VERSION, catalogVersion: CATALOG_VERSION, lastSavedAt: 0 },
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
        answers: {},       // { [kanjiId]: { correct, incorrect } }
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
  const state = readSaveState();
  if (state.status === 'valid') return state.save;
  if (state.status === 'missing') {
    try { return migrateFromLegacyOrEmpty(); } catch { return null; }
  }
  return null;
}

export function readSaveState() {
  try {
    const recovery = recoverStorageTransaction();
    if (!recovery.ok) return { status: 'unavailable', error: recovery.error };
    const raw = localStorage.getItem(STORAGE_KEY);
    const slot = localStorage.getItem('yomitabi_slot');
    if (slot !== null && !/^[1-3]$/.test(slot)) return { status: 'unavailable', raw, error: new Error('Invalid save slot') };
    const confirmed = localStorage.getItem(confirmedSaveKey());
    if (confirmed !== null && raw !== confirmed) return { status: 'conflict', raw, error: new Error('Save changed outside this version; both copies have been preserved') };
    if (raw === null) return { status: 'missing', raw: null };
    try {
      const parsed = JSON.parse(raw);
      const save = migrateSave(parsed);
      // Only the active pre-v2 save may absorb missing legacy mirrors. Imports are pure.
      if ((parsed.meta?.version || 0) < 2) {
        if (!parsed.meta?.legacyStageProgressMerged) mergeLegacyStageProgressKeys(save);
        save.meta.compatibilityEntries = collectCompatibilityEntries();
        readLegacyStudyMirrors(save, parsed);
        migrateKanjiIds(save);
      }
      validateSave(save, CURRENT_VERSION);
      return { status: 'valid', raw, save };
    }
    catch (error) { return { status: error.code === 'UNSUPPORTED_VERSION' ? 'unsupported' : 'corrupt', raw, error }; }
  } catch (error) { return { status: 'unavailable', error }; }
}

export function migrateSave(save) {
  validateSave(save, CURRENT_VERSION);
  save = JSON.parse(JSON.stringify(save));
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
    // Import is independent of this device's current child and legacy mirrors.
    wrapped.meta.version = CURRENT_VERSION;
    wrapped.meta.lastSavedAt = Date.now();
    return migrateKanjiIds(wrapped);
  }

  // 既に v1 だが欠損があればデフォルトで埋める
  if (save.meta.version <= CURRENT_VERSION) {
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

    // Ambient legacy keys are read only by the active local migration, never by imports.
    save.meta.version = CURRENT_VERSION;
    return migrateKanjiIds(save);
  }

  throw new Error('Unsupported save migration');
}

export function saveNow(save, { replace = false, extraEntries = {} } = {}) {
  try {
    const recovery = recoverStorageTransaction();
    if (!recovery.ok) return recovery;
    const state = readSaveState();
    if (state.status === 'unavailable' || state.status === 'unsupported' ||
        (['corrupt','conflict'].includes(state.status) && !replace)) return { ok: false, error: state.error };
    const candidate = migrateSave(save);
    candidate.meta.version = CURRENT_VERSION;
    candidate.meta.lastSavedAt = Date.now();
    candidate.meta.legacyStageProgressMerged = true;
    validateSave(candidate, CURRENT_VERSION);
    const entries = { ...extraEntries, [STORAGE_KEY]: JSON.stringify(candidate), ...saveProjection(candidate) };
    entries[confirmedSaveKey()] = entries[STORAGE_KEY];
    if (replace) entries.yomitabi_storage_epoch = `${Date.now()}-${Math.random()}`;
    const oldMeta = state.status === 'valid' ? JSON.parse(state.raw).meta : null;
    const needsMigration = state.status === 'valid' &&
      (oldMeta?.version !== CURRENT_VERSION || oldMeta?.catalogVersion !== CATALOG_VERSION ||
       JSON.stringify(JSON.parse(state.raw).player?.study?.legacyAmbiguousKanji) !== JSON.stringify(state.save.player.study.legacyAmbiguousKanji));
    if (replace || needsMigration || state.status === 'missing') preserveLocalOriginal();
    const result = writeStorageTransaction(entries);
    return result.ok ? { ok: true, save: candidate } : result;
  } catch (error) { return { ok: false, error }; }
}

export function clearSave() {
  try {
    preserveLocalOriginal();
    return writeStorageTransaction({ [STORAGE_KEY]: null, kanjiGameSave: null, [confirmedSaveKey()]: null, yomitabi_storage_epoch: `${Date.now()}-${Math.random()}` });
  } catch (error) { return { ok: false, error }; }
}

// ---------- StepB-1: 読み取り入口の集約（SSoT=krb_save 優先） ----------
//
// 目的: clear_* / stage_clear_* / stage_first_clear_at_* の読み取りを 1箇所に集約する。
// - 新しい保存キー/スキーマは作らない（read-only）
// - 既存挙動は fallback(localStorage) で維持する
// - loadSave/migrateSave are read-only; persistence is explicit in saveNow/loadGameData.

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

  // StepB-1: クリア回数は現状 krb_save 正史に保持されていないため、legacy(localStorage) のみを参照する（read-only）
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

  // StepB-1: 初回クリア日時は現状 krb_save 正史に保持されていないため、legacy(localStorage) のみを参照する（read-only）
  try {
    const raw = localStorage.getItem(`stage_first_clear_at_${id}`);
    const n = parseInt(raw || '', 10);
    return Number.isFinite(n) ? n : null;
  } catch {}
  return null;
}

// ---------- 内部: レガシー取り込み ----------

function migrateFromLegacyOrEmpty() {
  let d = getDefaultSave();

  // 旧メインセーブ
    const legacyRaw = localStorage.getItem('kanjiGameSave');
    if (legacyRaw !== null) {
      const legacy = JSON.parse(legacyRaw);
      d = migrateSave(legacy);
      if (legacy?.playerName) d.player.name = legacy.playerName;
      if (legacy?.playerStats) Object.assign(d.player.coreStats, legacy.playerStats);
      if (legacy?.practiceProgress) d.player.study.practiceProgress = legacy.practiceProgress || {};
      if (legacy?.kanjiReadProgress) d.player.study.kanjiReadProgress = legacy.kanjiReadProgress || {};
      if (Array.isArray(legacy?.unlockedAchievements)) {
        d.flags.achievementsUnlocked = legacy.unlockedAchievements.slice();
      }
    }

  mergeAmbientKeys(d);
  d.meta.compatibilityEntries = collectCompatibilityEntries();
  readLegacyStudyMirrors(d, {});
  migrateKanjiIds(d);
  validateSave(d, CURRENT_VERSION);
  d.meta.lastSavedAt = Date.now();
  return d;
}

function readLegacyStudyMirrors(save, original) {
  const read = (key, fallback) => {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  };
  const study = save.player.study, collection = save.player.collection;
  if (!original.player?.study?.reviewQueueDetail && localStorage.getItem('krb_review_queue') !== null) {
    study.reviewQueueDetail = read('krb_review_queue', []);
    if (!Array.isArray(study.reviewQueueDetail)) throw new Error('Invalid legacy review queue');
    study.reviewQueue = study.reviewQueueDetail.map(e => e.id);
  }
  if (!original.player?.collection?.kanjiIds && localStorage.getItem('krb_kanji_dex') !== null) collection.kanjiIds = read('krb_kanji_dex', []);
  collection.seenMonsterIds ??= read('krb_seen_monsters', []);
  collection.favoriteMonsterIds ??= read('krb_monster_favorites', []);
  study.quickReviewBuffer ??= read('quickReviewBuffer', null);
  study.wrongKanji ??= read('krb_wrong_kanji', null);
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
  mergeLegacyStageProgressKeys(saveObj);

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

function mergeLegacyStageProgressKeys(saveObj) {
  try {
    const cleared = new Set(Array.isArray(saveObj.player?.progress?.clearedStages) ? saveObj.player.progress.clearedStages : []);
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
    if (!saveObj.player) saveObj.player = getDefaultSave().player;
    if (!saveObj.player.progress) saveObj.player.progress = getDefaultSave().player.progress;
    saveObj.player.progress.clearedStages = Array.from(cleared);
    return true;
  } catch {
    return false;
  }
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

export function hardResetAllLocalData() {
  try {
    preserveLocalOriginal();
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
    return writeStorageTransaction({ ...Object.fromEntries(toDelete.map(k => [k, null])), [confirmedSaveKey()]: null, yomitabi_storage_epoch: `${Date.now()}-${Math.random()}` });
  } catch (e) {
    console.error('hardResetAllLocalData failed:', e);
    return { ok: false, error: e };
  }
}
