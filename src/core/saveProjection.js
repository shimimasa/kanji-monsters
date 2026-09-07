// Compatibility keys are projections of a confirmed snapshot, not another save.
export const CHILD_SETTINGS = ['cbMode', 'bigFont', 'weaknessScope', 'exampleMode', 'rubyMode'];
export const isCompatibilityKey = key => /^(clear_|stage_clear_|stage_first_clear_at_|bonus_|tutorial_seen_)/.test(key) ||
  ['krb_monsterDex_prefs_v1','playerStats','unlockedStages','kanjiBattleScores','dailyPracticeStats','bs_blockHistory'].includes(key);
export function collectCompatibilityEntries() {
  const entries = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (isCompatibilityKey(key)) entries[key] = localStorage.getItem(key);
  }
  return entries;
}
export function reviewDetails(save) {
  const study = save.player.study;
  return study.reviewQueueDetail ?? study.reviewQueue.map(id => ({
    id, repetition: 0, interval: 0, eFactor: 2.5, nextReviewAt: 0
  }));
}
export function saveProjection(save) {
  const { study, collection, progress } = save.player;
  const kanjiIds = collection.kanjiIds ?? Object.entries(study.kanjiReadProgress || {})
    .filter(([, p]) => p.mastered || p.onyomi?.length || p.kunyomi?.length).map(([id]) => id);
  const entries = {
    ...Object.fromEntries(Object.keys(collectCompatibilityEntries()).map(key => [key, null])),
    ...(save.meta.compatibilityEntries || {}),
    krb_review_queue: JSON.stringify(reviewDetails(save)),
    krb_kanji_dex: JSON.stringify(kanjiIds),
    krb_monster_dex: JSON.stringify(collection.gotomonIds),
    krb_seen_monsters: JSON.stringify(collection.seenMonsterIds || []),
    krb_monster_favorites: JSON.stringify(collection.favoriteMonsterIds || []),
    quickReviewBuffer: study.quickReviewBuffer ? JSON.stringify(study.quickReviewBuffer) : null,
    krb_wrong_kanji: study.wrongKanji ? JSON.stringify(study.wrongKanji) : null,
    lastPlayedStage: progress.currentStage || null
  };
  for (const key of CHILD_SETTINGS) entries[key] = save.settings[key] ? '1' : '0';
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (/^bonus_\d+_(clearCount|firstClear)$/.test(key)) entries[key] = null;
  }
  for (const [grade, value] of Object.entries(progress.bonusCounters || {})) {
    if (value.clearCount !== undefined) entries[`bonus_${grade}_clearCount`] = String(value.clearCount);
    if (value.firstClear) entries[`bonus_${grade}_firstClear`] = '1';
  }
  return entries;
}
