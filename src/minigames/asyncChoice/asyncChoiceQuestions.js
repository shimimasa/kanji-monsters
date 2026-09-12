const RAW_FIXTURE = [
  ['freeze-water', '水がこおり始める温度は？', [['zero', '0度'], ['ten', '10度'], ['fifty', '50度'], ['hundred', '100度']], 'zero', 'science.matter'],
  ['triangle', '三角形の辺はいくつ？', [['two', '2本'], ['three', '3本'], ['four', '4本'], ['five', '5本']], 'three', 'math.geometry'],
  ['pacific', '日本の東に広がる海洋は？', [['atlantic', '大西洋'], ['indian', 'インド洋'], ['pacific', '太平洋'], ['arctic', '北極海']], 'pacific', 'social.geography'],
  ['photosynthesis', '植物が光合成に使うものは？', [['light', '光'], ['sound', '音'], ['magnet', '磁石'], ['salt', '食塩']], 'light', 'science.plants'],
  ['capital-japan', '日本の首都は？', [['osaka', '大阪'], ['tokyo', '東京'], ['kyoto', '京都'], ['sapporo', '札幌']], 'tokyo', 'social.geography'],
  ['five-times-six', '5 × 6 は？', [['eleven', '11'], ['twentyFive', '25'], ['thirty', '30'], ['thirtyFive', '35']], 'thirty', 'math.multiply'],
  ['verb-read', '「読む」の品詞は？', [['noun', '名詞'], ['verb', '動詞'], ['adjective', '形容詞'], ['adverb', '副詞']], 'verb', 'japanese.grammar'],
  ['earth-satellite', '地球の衛星は？', [['sun', '太陽'], ['moon', '月'], ['mars', '火星'], ['venus', '金星']], 'moon', 'science.space'],
  ['one-kilometer', '1キロメートルは何メートル？', [['ten', '10m'], ['hundred', '100m'], ['thousand', '1000m'], ['tenThousand', '10000m']], 'thousand', 'math.measure'],
  ['rice-plant', '米がとれる植物は？', [['wheat', '小麦'], ['rice', '稲'], ['soy', '大豆'], ['corn', 'とうもろこし']], 'rice', 'science.plants'],
  ['north', '地図で通常、上が示す方角は？', [['east', '東'], ['west', '西'], ['south', '南'], ['north', '北']], 'north', 'social.maps'],
  ['fraction-half', '1/2と同じ大きさは？', [['oneFourth', '1/4'], ['twoFourths', '2/4'], ['threeFourths', '3/4'], ['fourFourths', '4/4']], 'twoFourths', 'math.fractions'],
  ['past-go', '英語「go」の過去形は？', [['goed', 'goed'], ['going', 'going'], ['went', 'went'], ['goes', 'goes']], 'went', 'english.grammar'],
  ['mammal-whale', 'ほ乳類はどれ？', [['tuna', 'マグロ'], ['frog', 'カエル'], ['whale', 'クジラ'], ['sparrow', 'スズメ']], 'whale', 'science.animals'],
  ['largest-number', '最も大きい数は？', [['nineTenths', '0.9'], ['ninetyNineHundredths', '0.99'], ['one', '1'], ['oneTenth', '0.1']], 'one', 'math.decimals'],
  ['spring-month', '日本で春にあたる月は？', [['january', '1月'], ['april', '4月'], ['august', '8月'], ['december', '12月']], 'april', 'general.seasons'],
  ['kanji-river', '「川」の音読みは？', [['kawa', 'かわ'], ['sen', 'セン'], ['yama', 'やま'], ['sui', 'スイ']], 'sen', 'japanese.kanji'],
  ['oxygen', '人が呼吸で取り入れる気体は？', [['oxygen', '酸素'], ['nitrogen', '窒素'], ['carbon', '二酸化炭素'], ['hydrogen', '水素']], 'oxygen', 'science.body'],
  ['rectangle', '長方形の角はいくつ？', [['two', '2つ'], ['three', '3つ'], ['four', '4つ'], ['six', '6つ']], 'four', 'math.geometry'],
  ['english-library', '英語「library」の意味は？', [['hospital', '病院'], ['library', '図書館'], ['station', '駅'], ['park', '公園']], 'library', 'english.vocabulary'],
];

export const ASYNC_CHOICE_FIXTURE = Object.freeze(RAW_FIXTURE.map(([fixtureId, prompt, rawChoices, correctId, skillId]) => {
  const choices = Object.freeze(rawChoices.map(([id, text]) => Object.freeze({ choiceId: `${fixtureId}:${id}`, text })));
  return Object.freeze({ fixtureId, prompt, choices, correctChoiceId: `${fixtureId}:${correctId}`, skillId });
}));

export function loadAsyncChoiceFixture({ signal } = {}) {
  return Promise.resolve().then(() => {
    if (signal?.aborted) { const error = new Error('Question load aborted'); error.name = 'AbortError'; throw error; }
    return ASYNC_CHOICE_FIXTURE;
  });
}

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

export function prepareAsyncChoiceQuestions({ fixture, sessionId, random = Math.random } = {}) {
  if (typeof sessionId !== 'string' || !sessionId) throw new TypeError('sessionId is required');
  if (typeof random !== 'function') throw new TypeError('random must be a function');
  if (!Array.isArray(fixture) || fixture.length < 10) throw new TypeError('at least ten questions are required');
  const identities = new Set();
  for (const item of fixture) {
    if (!item || typeof item.fixtureId !== 'string' || !item.fixtureId || identities.has(item.fixtureId) ||
        !item.prompt || !item.skillId || !Array.isArray(item.choices) || item.choices.length < 3 || item.choices.length > 4 ||
        new Set(item.choices.map(choice => choice.choiceId)).size !== item.choices.length ||
        !item.choices.some(choice => choice.choiceId === item.correctChoiceId)) throw new TypeError('invalid async choice fixture');
    identities.add(item.fixtureId);
  }
  return Object.freeze(shuffled(fixture, random).slice(0, 10).map((item, index) => Object.freeze({
    fixtureId: item.fixtureId, problemId: `${sessionId}:async-choice:${index + 1}:${item.fixtureId}`,
    prompt: item.prompt, choices: Object.freeze(shuffled(item.choices, random).map(choice => choice)),
    correctChoiceId: item.correctChoiceId, skillId: item.skillId,
  })));
}
