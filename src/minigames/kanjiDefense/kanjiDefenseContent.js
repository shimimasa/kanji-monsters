const freezeItem = item => Object.freeze({
  ...item,
  acceptedReadings: Object.freeze([...item.acceptedReadings]),
  focusKanjiIds: Object.freeze([...item.focusKanjiIds]),
});

export const KANJI_DEFENSE_GOLDEN_CONTENT = Object.freeze([
  { fixtureId: 'kd-g4-001', prompt: '愛犬', acceptedReadings: ['あいけん'], focusKanjiIds: ['g4-001'], meaning: 'かわいがっている犬', hint: '大切にしている犬' },
  { fixtureId: 'kd-g4-002', prompt: '案内', acceptedReadings: ['あんない'], focusKanjiIds: ['g4-002'], meaning: '道や場所を知らせること', hint: '道を知らせる' },
  { fixtureId: 'kd-g4-003', prompt: '以下', acceptedReadings: ['いか'], focusKanjiIds: ['g4-003'], meaning: 'その数をふくんで下', hint: 'その数から下' },
  { fixtureId: 'kd-g4-004', prompt: '位置', acceptedReadings: ['いち'], focusKanjiIds: ['g4-005', 'g4-134'], meaning: 'ものがある場所', hint: 'ものの場所' },
  { fixtureId: 'kd-g4-005', prompt: '印刷', acceptedReadings: ['いんさつ'], focusKanjiIds: ['g4-007', 'g4-078'], meaning: '文字や絵を紙にうつすこと', hint: '紙にうつす' },
  { fixtureId: 'kd-g4-006', prompt: '英語', acceptedReadings: ['えいご'], focusKanjiIds: ['g4-008'], meaning: 'イギリスやアメリカなどで使う言葉', hint: '外国の言葉' },
  { fixtureId: 'kd-g4-007', prompt: '栄養', acceptedReadings: ['えいよう'], focusKanjiIds: ['g4-009', 'g4-187'], meaning: '体を育て、動かすもと', hint: '体を育てるもと' },
  { fixtureId: 'kd-g4-008', prompt: '塩分', acceptedReadings: ['えんぶん'], focusKanjiIds: ['g4-011'], meaning: '食べ物などにふくまれる塩の量', hint: '塩の量' },
  { fixtureId: 'kd-g4-009', prompt: '一億', acceptedReadings: ['いちおく'], focusKanjiIds: ['g4-013'], meaning: '一万を一万倍した数', hint: '大きな数' },
  { fixtureId: 'kd-g4-010', prompt: '加入', acceptedReadings: ['かにゅう'], focusKanjiIds: ['g4-014'], meaning: '仲間や会に入ること', hint: '仲間に入る' },
  { fixtureId: 'kd-g4-011', prompt: '結果', acceptedReadings: ['けっか'], focusKanjiIds: ['g4-059', 'g4-015'], meaning: '行ったことのあとに出たもの', hint: '行ったあとの答え' },
  { fixtureId: 'kd-g4-012', prompt: '貨物', acceptedReadings: ['かもつ'], focusKanjiIds: ['g4-016'], meaning: '運ばれる荷物', hint: '運ぶ荷物' },
  { fixtureId: 'kd-g4-013', prompt: '課題', acceptedReadings: ['かだい'], focusKanjiIds: ['g4-017'], meaning: '取り組むべき問題', hint: '取り組む問題' },
  { fixtureId: 'kd-g4-014', prompt: '改良', acceptedReadings: ['かいりょう'], focusKanjiIds: ['g4-020', 'g4-191'], meaning: 'よりよいものに直すこと', hint: 'よく直す' },
  { fixtureId: 'kd-g4-015', prompt: '機械', acceptedReadings: ['きかい'], focusKanjiIds: ['g4-038', 'g4-021'], meaning: '力を使って仕事をするしくみ', hint: '仕事をするしくみ' },
  { fixtureId: 'kd-g4-016', prompt: '害虫', acceptedReadings: ['がいちゅう'], focusKanjiIds: ['g4-022'], meaning: '人や作物に害をあたえる虫', hint: '作物をこまらせる虫' },
  { fixtureId: 'kd-g4-017', prompt: '街灯', acceptedReadings: ['がいとう'], focusKanjiIds: ['g4-023', 'g4-145'], meaning: '道を明るくする灯り', hint: '道の灯り' },
  { fixtureId: 'kd-g4-018', prompt: '各地', acceptedReadings: ['かくち'], focusKanjiIds: ['g4-024'], meaning: 'それぞれの場所', hint: 'いろいろな場所' },
  { fixtureId: 'kd-g4-019', prompt: '覚える', acceptedReadings: ['おぼえる'], focusKanjiIds: ['g4-025'], meaning: '忘れないように身につける', hint: '心にのこす' },
  { fixtureId: 'kd-g4-020', prompt: '完成', acceptedReadings: ['かんせい'], focusKanjiIds: ['g4-027', 'g4-109'], meaning: 'すっかりできあがること', hint: 'できあがる' },
  { fixtureId: 'kd-g4-021', prompt: '関係', acceptedReadings: ['かんけい'], focusKanjiIds: ['g4-030'], meaning: 'ものごとのつながり', hint: 'つながり' },
  { fixtureId: 'kd-g4-022', prompt: '観察', acceptedReadings: ['かんさつ'], focusKanjiIds: ['g4-031', 'g4-079'], meaning: 'よく見て変化や様子を調べること', hint: 'よく見て調べる' },
  { fixtureId: 'kd-g4-023', prompt: '希望', acceptedReadings: ['きぼう'], focusKanjiIds: ['g4-034', 'g4-177'], meaning: 'こうなってほしいという願い', hint: '未来への願い' },
  { fixtureId: 'kd-g4-024', prompt: '季節', acceptedReadings: ['きせつ'], focusKanjiIds: ['g4-035', 'g4-116'], meaning: '春夏秋冬のそれぞれの時期', hint: '春・夏・秋・冬' },
].map(item => freezeItem({ ...item, skillId: 'kanji-reading-g4' })));

export const KANJI_DEFENSE_MONSTERS = Object.freeze([
  ['NGT-E01', 'コシヒカリスプライト', '新潟'],
  ['NGT-E08', '長岡花火ファントマトン', '新潟'],
  ['TYM-E06', '高岡銅器ゴーレム', '富山'],
  ['ISK-E04', '輪島朝市シャドー', '石川'],
  ['HKI-E02', '若狭フグシャドー', '福井'],
  ['HKI-E09', '三国祭ライオネット', '福井'],
  ['NGN-E07', '木曾漆器アーマービートル', '長野'],
  ['GF-E05', '美濃和紙ペーパーウィスプ', '岐阜'],
  ['YMN-E03', '富士桜ウサギ', '山梨'],
  ['SZO-E01', '富士茶フェアリー', '静岡'],
  ['SZO-E08', '三保羽衣シルフ', '静岡'],
  ['AIC-E06', '犬山城ゴーストサムライ', '愛知'],
].map(([monsterId, name, region]) => Object.freeze({
  monsterId,
  name,
  region,
  imageUrl: `/assets/images/monsters/full/grade4-chuubu/${monsterId}.webp`,
})));

export function normalizeKanjiDefenseReading(value) {
  if (typeof value !== 'string') return null;
  const compact = value.normalize('NFKC').trim().replace(/[\s\u3000]+/gu, '');
  if (!compact) return null;
  return [...compact].map(character => {
    const code = character.codePointAt(0);
    return code >= 0x30a1 && code <= 0x30f6 ? String.fromCodePoint(code - 0x60) : character;
  }).join('');
}
export function validateKanjiDefenseContent(items = KANJI_DEFENSE_GOLDEN_CONTENT) {
  if (!Array.isArray(items) || items.length < 12) throw new TypeError('at least 12 content items are required');
  const fixtureIds = new Set();
  for (const item of items) {
    if (!item || typeof item !== 'object' || !/^kd-g4-\d{3}$/.test(item.fixtureId)) throw new TypeError('invalid fixtureId');
    if (fixtureIds.has(item.fixtureId)) throw new TypeError('duplicate fixtureId');
    fixtureIds.add(item.fixtureId);
    if (typeof item.prompt !== 'string' || !item.prompt.trim() || [...item.prompt].length > 12) throw new TypeError('invalid prompt');
    if (!Array.isArray(item.acceptedReadings) || item.acceptedReadings.length < 1) throw new TypeError('acceptedReadings required');
    const readings = item.acceptedReadings.map(normalizeKanjiDefenseReading);
    if (readings.some(reading => !reading || !/^[ぁ-ゖー]+$/u.test(reading)) || new Set(readings).size !== readings.length) {
      throw new TypeError('invalid acceptedReadings');
    }
    if (!Array.isArray(item.focusKanjiIds) || item.focusKanjiIds.length < 1 ||
        item.focusKanjiIds.some(id => !/^g4-\d{3}$/.test(id))) throw new TypeError('invalid focusKanjiIds');
    if (item.skillId !== 'kanji-reading-g4' || !item.meaning || !item.hint) throw new TypeError('content metadata required');
  }
  return true;
}

const shuffle = (items, random) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const sample = Number(random());
    const unit = Number.isFinite(sample) ? Math.min(Math.max(sample, 0), 0.999999999999) : 0;
    const target = Math.floor(unit * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
};

export function buildKanjiDefenseSession({ random = Math.random,
  content = KANJI_DEFENSE_GOLDEN_CONTENT, monsters = KANJI_DEFENSE_MONSTERS,
  count = 12 } = {}) {
  validateKanjiDefenseContent(content);
  if (!Array.isArray(monsters) || monsters.length < 3 || !Number.isInteger(count) || count < 1 || count > content.length) {
    throw new TypeError('invalid session source');
  }
  const prompts = shuffle(content, random).slice(0, count);
  const monsterOrder = shuffle(monsters, random);
  return Object.freeze(prompts.map((contentItem, index) => Object.freeze({
    encounterId: `encounter-${index + 1}`,
    encounterNumber: index + 1,
    content: contentItem,
    monster: monsterOrder[index % monsterOrder.length],
  })));
}
