// ゴトモンのタイプと相性 (2026-10-02, ユーザーと決めた案).
// The 231 ways the data writes a category are gathered into seven types by words in it. A Gotomon
// with no telling category is read from its home and description, and else is ふしぎ. A teacher
// checks the result on the teacher-check page; a fix goes into TYPE_OVERRIDES by id.
// Matchups only make a right answer's attack stronger (the main battle) or the companion's skill
// gauge fill sooner (mini-games); they never change how an answer is judged or recorded.
export const GOTOMON_TYPES = Object.freeze([
  Object.freeze({ id: 'food', name: 'たべもの', color: '#ffcf7a' }),
  Object.freeze({ id: 'nature', name: 'しぜん', color: '#9fdc8c' }),
  Object.freeze({ id: 'legend', name: 'でんせつ', color: '#c9b5ff' }),
  Object.freeze({ id: 'fest', name: 'まつり', color: '#ffb3c7' }),
  Object.freeze({ id: 'history', name: 'れきし', color: '#d9c3a5' }),
  Object.freeze({ id: 'craft', name: 'ものづくり', color: '#a9d4f5' }),
  Object.freeze({ id: 'odd', name: 'ふしぎ', color: '#d6d6d6' }),
]);
export const typeInfo = id => GOTOMON_TYPES.find(type => type.id === id) ?? GOTOMON_TYPES.at(-1);

// The wheel: each type is strong against the next one. ふしぎ is even with every type.
export const TYPE_BEATS = Object.freeze({ nature: 'food', food: 'fest', fest: 'history', history: 'legend', legend: 'craft', craft: 'nature' });
export const MATCHUP_BONUS = 1.5;
export const matchup = (attacker, defender) => (TYPE_BEATS[attacker] === defender ? MATCHUP_BONUS : 1);

// Words that put a category into a type, tried in this order (伝説・ボス is でんせつ before anything else).
const RULES = Object.freeze([
  ['legend', /伝説|神話|幻|妖|霊|神|竜|龍|鬼|伝承|民話|守護|童話|文学|天象/],
  ['food', /食|料理|農|海産|菓|酒|茶|果|グルメ|野菜|水産/],
  ['nature', /自然|動物|植物|生物|昆虫|鳥|魚|海|山|川|花|地形|気象|湖|温泉|鉱物/],
  ['history', /歴史|城|武|戦|遺跡|宗教|寺|仏|忍者|伝統|信仰/],
  ['fest', /祭|音楽|芸能|踊|文化|行事|スポーツ|遊|民俗|玩具|人形|観光/],
  ['craft', /工芸|産業|工|建|交通|技術|発明|乗り物|科学|漁業|街並み|夜景|都市|機械/],
]);
const byRules = text => RULES.find(([, words]) => words.test(text))?.[0] ?? null;

// Fixes after the teacher's check: { 'HKD-E01': 'food' }.
export const TYPE_OVERRIDES = Object.freeze({});

export function typeOf(monster) {
  if (!monster) return 'odd';
  const fixed = TYPE_OVERRIDES[monster.id];
  if (fixed) return fixed;
  return byRules(String(monster.category ?? '')) ?? (monster.category ? 'odd' : byRules(`${monster.habitat ?? ''} ${monster.desc ?? ''}`) ?? 'odd');
}

// Each mini-game's favoured type: a companion of that type fills its skill gauge sooner.
export const GAME_TYPES = Object.freeze({
  gotomonShop: 'food', gotomonToss: 'food', gotomonPuyo: 'food', gotomonMerge: 'food', asyncChoice: 'food', gotomonBubble: 'food',
  gotomonFishing: 'nature', gotomonSeek: 'nature', gotomonHop: 'nature', gotomonJump: 'nature', gotomonLand: 'nature', photoRally: 'nature', gotomonGolf: 'nature',
  gotomonDrum: 'fest', gotomonRace: 'fest', gotomonColoring: 'fest', multiSelect: 'fest', timedChoice: 'fest', kanjiBingo: 'fest',
  proverbDetective: 'history', tripSugoroku: 'history', kanjiDefense: 'history', kanjiSort: 'history', sentenceOrder: 'history', gotomonOthello: 'history', historyBuild: 'history',
  mathInvader: 'legend', gotomonShooter: 'legend', gotomonMeteor: 'legend', gotomonSlash: 'legend', gotomonMaze: 'legend', gotomonTag: 'legend',
  gotomonParts: 'craft', gotomonPush: 'craft', gotomonBreakout: 'craft', gotomonTrace: 'craft', gotomonLink: 'craft', kanjiMemory: 'craft', mathSprint: 'craft',
  abcPost: 'odd', englishRadio: 'odd', replyCafe: 'food', englishRoom: 'craft',
  wonderLab: 'craft', lifeCycle: 'nature', mapTown: 'history', shapeMosaic: 'craft',
  gotomonDelivery: 'odd', gotomonSnake: 'odd', englishChoice: 'odd',
});
// How much sooner the gauge fills for a companion of the game's type.
export const FAVOURED_CHARGE = 1.25;
