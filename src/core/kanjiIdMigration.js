// Catalog 1 contained nine IDs shared by distinct characters. Never infer ownership.
export const CATALOG_VERSION = 2;
export const RETIRED_KANJI_IDS = Object.freeze({
  'g5-041': '許均', 'g5-043': '禁句', 'g6-134': '潮賃',
  'g7-062': '凶叫', 'g8-046': '犠菊', 'g9-053': '拒享',
  'g9-302': '愉諭', 'g10-121': '爪鶴', 'g10-165': '弥喩'
});
export function validateKanjiCatalog(entries) {
  if (!Array.isArray(entries) || entries.length === 0) throw new Error('Empty kanji catalog');
  const ids = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry.id !== 'string' || !entry.id || RETIRED_KANJI_IDS[entry.id] || ids.has(entry.id)) {
      throw new Error('Incompatible kanji catalog; reload the current data');
    }
    ids.add(entry.id);
  }
  return entries;
}
export function resolveKanjiId(id, evidence) {
  const chars = RETIRED_KANJI_IDS[id];
  if (!chars) return id;
  if (evidence?.kanji !== undefined && evidence?.text !== undefined && evidence.kanji !== evidence.text) return null;
  const char = evidence?.kanji ?? evidence?.text;
  return typeof char === 'string' && [...chars].includes(char)
    ? `${id}-${char.codePointAt(0).toString(16)}` : null;
}

export function migrateKanjiIds(save) {
  const study = save.player.study;
  const archive = study.legacyAmbiguousKanji || {};
  const preserve = (path, value) => {
    const entries = archive[path] || (archive[path] = []);
    if (!entries.some(v => JSON.stringify(v) === JSON.stringify(value))) entries.push(value);
  };
  for (const field of ['answers', 'kanjiReadProgress']) {
    const map = study[field] || {};
    for (const [id, value] of Object.entries(map)) {
      if (!RETIRED_KANJI_IDS[id]) continue;
      const next = resolveKanjiId(id, value);
      if (next && !Object.hasOwn(map, next)) map[next] = value;
      else preserve(`${field}.${id}`, value);
      delete map[id];
    }
  }
  const list = (values, path) => (values || []).flatMap(value => {
    const id = typeof value === 'object' ? value.id : value;
    const next = resolveKanjiId(id, value);
    if (!next) { preserve(path, value); return []; }
    return [typeof value === 'object' ? { ...value, id: next } : next];
  });
  study.reviewQueue = list(study.reviewQueue, 'reviewQueue');
  if (study.reviewQueueDetail) {
    study.reviewQueueDetail = list(study.reviewQueueDetail, 'reviewQueueDetail');
    study.reviewQueue = study.reviewQueueDetail.map(e => e.id);
  }
  if (save.player.collection.kanjiIds) save.player.collection.kanjiIds = list(save.player.collection.kanjiIds, 'kanjiIds');
  if (study.quickReviewBuffer?.ids) study.quickReviewBuffer.ids = list(study.quickReviewBuffer.ids, 'quickReviewBuffer.ids');
  if (Array.isArray(study.wrongKanji)) study.wrongKanji = list(study.wrongKanji, 'wrongKanji');
  if (Object.keys(archive).length) study.legacyAmbiguousKanji = archive;
  save.meta.catalogVersion = CATALOG_VERSION;
  return save;
}
