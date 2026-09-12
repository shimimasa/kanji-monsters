// Small, self-authored probe fixture. This is not a canonical curriculum dataset.
const RAW_FIXTURE = [
  ['spring', '春に関係するものをすべて選ぼう', [['sakura', '桜', 1], ['entrance', '入学式', 1], ['horsetail', 'つくし', 1], ['snowman', '雪だるま', 0], ['autumnLeaves', '紅葉', 0]], 'general.seasons'],
  ['mammals', 'ほ乳類をすべて選ぼう', [['dog', '犬', 1], ['cat', '猫', 1], ['dolphin', 'イルカ', 1], ['frog', 'カエル', 0], ['sparrow', 'スズメ', 0]], 'science.animals'],
  ['kanto', '関東地方の都県をすべて選ぼう', [['tokyo', '東京都', 1], ['kanagawa', '神奈川県', 1], ['chiba', '千葉県', 1], ['osaka', '大阪府', 0], ['miyagi', '宮城県', 0]], 'social.prefectures'],
  ['verbs', '動詞をすべて選ぼう', [['run', '走る', 1], ['read', '読む', 1], ['eat', '食べる', 1], ['blue', '青い', 0], ['quiet', '静かだ', 0]], 'japanese.grammar'],
  ['summer', '夏に関係するものをすべて選ぼう', [['sunflower', 'ひまわり', 1], ['cicada', 'せみ', 1], ['swimming', '海水浴', 1], ['snow', '雪', 0], ['acorn', 'どんぐり', 0]], 'general.seasons'],
  ['birds', '鳥の仲間をすべて選ぼう', [['swallow', 'ツバメ', 1], ['penguin', 'ペンギン', 1], ['owl', 'フクロウ', 1], ['bat', 'コウモリ', 0], ['lizard', 'トカゲ', 0]], 'science.animals'],
  ['kyushu', '九州地方の県をすべて選ぼう', [['fukuoka', '福岡県', 1], ['nagasaki', '長崎県', 1], ['kagoshima', '鹿児島県', 1], ['ehime', '愛媛県', 0], ['shiga', '滋賀県', 0]], 'social.prefectures'],
  ['adjectives', '形容詞をすべて選ぼう', [['red', '赤い', 1], ['fun', '楽しい', 1], ['long', '長い', 1], ['walk', '歩く', 0], ['quietNoun', '静かだ', 0]], 'japanese.grammar'],
  ['insects', '昆虫をすべて選ぼう', [['butterfly', 'チョウ', 1], ['beetle', 'カブトムシ', 1], ['dragonfly', 'トンボ', 1], ['spider', 'クモ', 0], ['centipede', 'ムカデ', 0]], 'science.animals'],
  ['solids', '常温で固体のものをすべて選ぼう', [['iron', '鉄', 1], ['salt', '食塩', 1], ['glass', 'ガラス', 1], ['water', '水', 0], ['oxygen', '酸素', 0]], 'science.matter'],
  ['chubu', '中部地方の県をすべて選ぼう', [['niigata', '新潟県', 1], ['aichi', '愛知県', 1], ['nagano', '長野県', 1], ['okayama', '岡山県', 0], ['iwate', '岩手県', 0]], 'social.prefectures'],
  ['nouns', '名詞をすべて選ぼう', [['school', '学校', 1], ['friend', '友達', 1], ['sky', '空', 1], ['write', '書く', 0], ['bright', '明るい', 0]], 'japanese.grammar'],
  ['autumn', '秋に関係するものをすべて選ぼう', [['moonViewing', '月見', 1], ['chestnut', 'くり', 1], ['riceHarvest', '稲刈り', 1], ['cherry', '桜', 0], ['newYear', '正月', 0]], 'general.seasons'],
  ['fish', '魚の仲間をすべて選ぼう', [['tuna', 'マグロ', 1], ['salmon', 'サケ', 1], ['seahorse', 'タツノオトシゴ', 1], ['whale', 'クジラ', 0], ['octopus', 'タコ', 0]], 'science.animals'],
  ['shikoku', '四国地方の県をすべて選ぼう', [['kagawa', '香川県', 1], ['tokushima', '徳島県', 1], ['kochi', '高知県', 1], ['hyogo', '兵庫県', 0], ['oita', '大分県', 0]], 'social.prefectures'],
  ['winter', '冬に関係するものをすべて選ぼう', [['snowmanWinter', '雪だるま', 1], ['newYearWinter', '正月', 1], ['heating', '暖房', 1], ['swimmingWinter', '海水浴', 0], ['cicadaWinter', 'せみ', 0]], 'general.seasons'],
  ['planets', '太陽のまわりを回る惑星をすべて選ぼう', [['earth', '地球', 1], ['mars', '火星', 1], ['jupiter', '木星', 1], ['moon', '月', 0], ['sun', '太陽', 0]], 'science.space'],
  ['kinki', '近畿地方の府県をすべて選ぼう', [['kyoto', '京都府', 1], ['nara', '奈良県', 1], ['wakayama', '和歌山県', 1], ['yamaguchi', '山口県', 0], ['akita', '秋田県', 0]], 'social.prefectures'],
  ['pastTense', '英語の過去形をすべて選ぼう', [['went', 'went', 1], ['played', 'played', 1], ['saw', 'saw', 1], ['go', 'go', 0], ['playing', 'playing', 0]], 'english.grammar'],
  ['renewable', 'くり返し利用できる自然エネルギーをすべて選ぼう', [['solar', '太陽光', 1], ['wind', '風力', 1], ['hydro', '水力', 1], ['coal', '石炭', 0], ['oil', '石油', 0]], 'science.energy'],
];

export const MULTI_SELECT_FIXTURE = Object.freeze(RAW_FIXTURE.map(([fixtureId, prompt, rawChoices, skillId]) => {
  const choices = Object.freeze(rawChoices.map(([choiceId, text]) => Object.freeze({ choiceId: `${fixtureId}:${choiceId}`, text })));
  const correctChoiceIds = Object.freeze(rawChoices.filter(([, , correct]) => correct).map(([choiceId]) => `${fixtureId}:${choiceId}`));
  return Object.freeze({ fixtureId, prompt, choices, correctChoiceIds, skillId });
}));

function takeRandom(random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new TypeError('random must return a finite value in [0, 1)');
  return value;
}

function shuffled(items, random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const target = Math.floor(takeRandom(random) * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

export function generateMultiSelectQuestions({ sessionId, random = Math.random } = {}) {
  if (typeof sessionId !== 'string' || !sessionId) throw new TypeError('sessionId is required');
  if (typeof random !== 'function') throw new TypeError('random must be a function');
  return Object.freeze(shuffled(MULTI_SELECT_FIXTURE, random).slice(0, 10).map((entry, index) => Object.freeze({
    fixtureId: entry.fixtureId,
    problemId: `${sessionId}:multi-select:${index + 1}:${entry.fixtureId}`,
    prompt: entry.prompt,
    choices: Object.freeze(shuffled(entry.choices, random).map(choice => choice)),
    correctChoiceIds: entry.correctChoiceIds,
    skillId: entry.skillId,
  })));
}
