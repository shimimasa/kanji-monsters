import { isCompatibilityKey } from './saveProjection.js';
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function requireRecord(value, label) {
  if (!record(value)) throw new Error(`Invalid save object: ${label}`);
}

export function validateSave(save, currentVersion) {
  const inspectKeys = value => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Unsafe object key');
      inspectKeys(child);
    }
  };
  inspectKeys(save);
  if (save?.meta?.recordingVersion !== undefined && save.meta.recordingVersion !== 1) {
    const error = new Error('Unsupported recording version'); error.code = 'UNSUPPORTED_VERSION'; throw error;
  }
  if (save?.meta?.catalogVersion !== undefined &&
      (!Number.isInteger(save.meta.catalogVersion) || save.meta.catalogVersion < 1 || save.meta.catalogVersion > 2)) {
    const error = new Error('Unsupported kanji catalog version'); error.code = 'UNSUPPORTED_VERSION'; throw error;
  }
  requireRecord(save, 'root');
  if (!save.meta) {
    if (!(typeof save.playerName === 'string' || record(save.playerStats))) {
      throw new Error('Not a recognized legacy save');
    }
    if (save.playerStats !== undefined) requireRecord(save.playerStats, 'playerStats');
    if (save.playerName !== undefined && typeof save.playerName !== 'string') throw new Error('Invalid name');
    return;
  }
  requireRecord(save.meta, 'meta');
  if (save.meta.compatibilityEntries !== undefined) {
    requireRecord(save.meta.compatibilityEntries,'compatibility entries');
    if (Object.entries(save.meta.compatibilityEntries).some(([key,value]) => !isCompatibilityKey(key) || typeof value !== 'string')) throw new Error('Invalid compatibility key');
  }
  if (!Number.isInteger(save.meta.version) || save.meta.version < 1 || save.meta.version > currentVersion) {
    const error = new Error('Unsupported save version'); error.code = 'UNSUPPORTED_VERSION'; throw error;
  }
  requireRecord(save.player, 'player');
  requireRecord(save.player.coreStats, 'coreStats');
  if (!Number.isInteger(save.player.coreStats.level) || save.player.coreStats.level < 1 ||
      !Number.isFinite(save.player.coreStats.exp) || save.player.coreStats.exp < 0) throw new Error('Missing or invalid core progress');
  if (save.player.name !== undefined && typeof save.player.name !== 'string') throw new Error('Invalid name');
  for (const key of ['progress', 'collection', 'study']) {
    if (save.player[key] !== undefined) requireRecord(save.player[key], key);
  }
  for (const key of ['settings', 'flags']) if (save[key] !== undefined) requireRecord(save[key], key);
  for (const [key, value] of Object.entries(save.player.coreStats)) {
    if (typeof value === 'number' && (!Number.isFinite(value) || value < 0)) throw new Error(`Invalid stat: ${key}`);
    if (['hp','maxHp','level','exp','attack','nextLevelExp','stagesCleared','totalCorrect','totalIncorrect'].includes(key) &&
        (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) throw new Error(`Invalid stat: ${key}`);
  }
  const study = save.player.study || {}, progress = save.player.progress || {}, collection = save.player.collection || {};
  const ids = (value, label) => {
    if (value !== undefined && (!Array.isArray(value) || value.some(id => typeof id !== 'string' || !id))) throw new Error(`Invalid IDs: ${label}`);
  };
  for (const [key, value] of Object.entries({clearedStages:progress.clearedStages, gotomonIds:collection.gotomonIds, kanjiIds:collection.kanjiIds,
    seenMonsterIds:collection.seenMonsterIds, favoriteMonsterIds:collection.favoriteMonsterIds, reviewQueue:study.reviewQueue, achievements:save.flags?.achievementsUnlocked})) ids(value,key);
  for (const key of ['currentStage','currentRegion']) if (progress[key] !== undefined && progress[key] !== null && typeof progress[key] !== 'string') throw new Error('Invalid stage');
  for (const value of Object.values(progress.checkpoints || {})) if (!Number.isInteger(value) || value < 0) throw new Error('Invalid checkpoint');
  for (const value of Object.values(study.kanjiReadProgress || {})) {
    requireRecord(value,'reading progress');
    ids(value.onyomi,'onyomi'); ids(value.kunyomi,'kunyomi');
    if (value.mastered !== undefined && typeof value.mastered !== 'boolean') throw new Error('Invalid mastery');
    if (value.observedReadings !== undefined) {
      requireRecord(value.observedReadings,'observed readings');
      for (const readings of Object.values(value.observedReadings)) ids(readings,'observed readings');
    }
  }
  for (const value of Object.values(study.dailyAnswerStats || {})) {
    requireRecord(value,'daily stats');
    if (!Number.isInteger(value.correct) || !Number.isInteger(value.total) || value.correct < 0 || value.total < value.correct) throw new Error('Invalid daily count');
  }
  if (study.legacyAmbiguousKanji !== undefined) {
    requireRecord(study.legacyAmbiguousKanji,'ambiguous archive');
    if (Object.values(study.legacyAmbiguousKanji).some(v => !Array.isArray(v))) throw new Error('Invalid ambiguous archive');
  }
  if (study.quickReviewBuffer != null) { requireRecord(study.quickReviewBuffer,'quick review'); ids(study.quickReviewBuffer.ids,'quick review ids'); ids(study.quickReviewBuffer.texts,'quick review texts'); }
  if (study.wrongKanji != null && !Array.isArray(study.wrongKanji)) throw new Error('Invalid wrong kanji');
  for (const key of ['cbMode','bigFont','weaknessScope','exampleMode','rubyMode','showTimer','autosaveEnabled']) {
    if (save.settings?.[key] !== undefined && typeof save.settings[key] !== 'boolean') throw new Error('Invalid setting');
  }
  for (const [label, value] of Object.entries({ clearedStages: progress.clearedStages, gotomonIds: collection.gotomonIds,
    kanjiIds: collection.kanjiIds, reviewQueue: study.reviewQueue, reviewQueueDetail: study.reviewQueueDetail })) {
    if (value !== undefined && !Array.isArray(value)) throw new Error(`Invalid array: ${label}`);
  }
  for (const [label, value] of Object.entries({ answers: study.answers, practiceProgress: study.practiceProgress,
    kanjiReadProgress: study.kanjiReadProgress, dailyAnswerStats: study.dailyAnswerStats,
    stageReviewUnlocked: study.stageReviewUnlocked, checkpoints: progress.checkpoints })) {
    if (value !== undefined) requireRecord(value, label);
  }
  for (const stats of Object.values(study.answers || {})) {
    requireRecord(stats, 'answer stats');
    for (const key of ['correct', 'incorrect']) {
      if (!Number.isInteger(stats[key]) || stats[key] < 0) throw new Error('Invalid answer count');
    }
    if (stats.observed !== undefined) {
      requireRecord(stats.observed,'observed'); requireRecord(stats.observed.correct,'observed correct');
      if (stats.observed.version !== 1) throw new Error('Invalid observation version');
      for (const n of [...Object.values(stats.observed.correct),stats.observed.incorrect]) if (!Number.isInteger(n) || n < 0) throw new Error('Invalid observation count');
    }
  }
  for (const entry of study.reviewQueueDetail || []) {
    requireRecord(entry, 'review entry');
    if (typeof entry.id !== 'string' || !entry.id) throw new Error('Invalid review id');
    for (const key of ['nextReviewAt','interval','repetition','eFactor']) {
      if (entry[key] !== undefined && (!Number.isFinite(entry[key]) || entry[key] < 0)) throw new Error('Invalid review schedule');
    }
  }
}
