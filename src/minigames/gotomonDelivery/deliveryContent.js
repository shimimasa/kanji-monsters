import { PREFECTURES, REGIONS, prefectureByName } from './prefectures.js';

export const DELIVERIES = 10;
export const CANDIDATES = 4;
export const HINT_MAX = 80;

// Well-known places that point to one prefecture on their own. Some prefectures are
// written in the Gotomon notes by their cities (仙台, 横浜, 名古屋, 神戸 …).
export const LANDMARKS = Object.freeze({
  宮城: ['仙台', '松島'], 千葉: ['銚子', '成田', '房総', '九十九里', '幕張'], 神奈川: ['横浜', '鎌倉', '箱根', '湘南', '横須賀', '小田原'],
  愛知: ['名古屋'], 兵庫: ['神戸', '姫路', '淡路', '明石', '有馬温泉'], 広島: ['宮島', '厳島', '尾道', '原爆ドーム', '呉市'],
});

function take(random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('random must be in [0, 1)');
  return value;
}
const shuffled = (items, random) => {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(take(random) * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
};

// The prefecture's own name (with 都・道・府・県) becomes 〇〇 so the hint never gives it away.
export const maskPrefecture = (text, name) => ['都', '道', '府', '県', ''].reduce((out, suffix) => out.split(`${name}${suffix}`).join('〇〇'), String(text ?? ''));

// A Gotomon can ask to go home when its note points to its prefecture: the note names
// the prefecture (hidden as 〇〇), or the note or its home names one of its landmarks,
// and nothing in it names another prefecture.
export function deliveryHint(monster) {
  const home = PREFECTURES.find(item => String(monster?.prefecture ?? '') === item.name);
  if (!home) return null;
  const note = String(monster.trivia ?? ''), habitat = String(monster.habitat ?? '');
  const landmarks = LANDMARKS[home.name] ?? [];
  // The note itself must point home: a hidden name in the home alone says nothing.
  const points = note.includes(home.name) || [note, habitat].some(text => landmarks.some(place => text.includes(place)));
  if (!points) return null;
  const hint = maskPrefecture(note, home.name), where = maskPrefecture(habitat, home.name);
  if (!hint || hint.length > HINT_MAX) return null;
  if (PREFECTURES.some(item => [hint, where, String(monster.name ?? '')].some(text => text.includes(item.name)))) return null;
  // Another prefecture's landmark would make two answers.
  if (Object.entries(LANDMARKS).some(([name, places]) => name !== home.name && places.some(place => hint.includes(place) || where.includes(place)))) return null;
  return Object.freeze({ prefecture: home.name, hint, habitat: where, fact: note });
}

// Ten deliveries for a run: from one region, or from all of Japan. Each has four
// prefectures to choose from, all shown on the map: in a region, four of its
// prefectures; in all of Japan, one neighbour from the same region and two from
// elsewhere. The same prefecture is never asked twice in a row.
export function buildDeliveries({ sessionId, random = Math.random, monsters = [], regionId = 'all' }) {
  const region = REGIONS.some(item => item.regionId === regionId) ? regionId : 'all';
  const pool = monsters.map(monster => ({ monster, hint: deliveryHint(monster) })).filter(item => item.hint)
    .filter(item => region === 'all' || prefectureByName(item.hint.prefecture).regionId === region);
  // All of Japan asks each prefecture once; a region asks one at most twice, never
  // twice in a row (a prefecture with many Gotomon would otherwise crowd the run).
  const cap = region === 'all' ? 1 : 2, picked = [], left = shuffled(pool, random);
  while (picked.length < DELIVERIES) {
    const last = picked.at(-1)?.hint.prefecture;
    const at = left.findIndex(item => item.hint.prefecture !== last
      && picked.filter(other => other.hint.prefecture === item.hint.prefecture).length < cap);
    if (at < 0) break;
    picked.push(...left.splice(at, 1));
  }
  if (picked.length < DELIVERIES) return null;
  return Object.freeze(picked.map((item, index) => {
    const home = prefectureByName(item.hint.prefecture);
    const same = shuffled(PREFECTURES.filter(pref => pref.regionId === home.regionId && pref !== home), random);
    const other = shuffled(PREFECTURES.filter(pref => pref.regionId !== home.regionId), random);
    const choices = region === 'all' ? [...same.slice(0, 1), ...other.slice(0, CANDIDATES - 2)] : same.slice(0, CANDIDATES - 1);
    return Object.freeze({ deliveryId: `${sessionId}:delivery:${index + 1}`, monsterId: item.monster.id, name: item.monster.name,
      prefecture: home.name, hint: item.hint.hint, habitat: item.hint.habitat, fact: item.hint.fact,
      candidates: Object.freeze(shuffled([home, ...choices], random).map(pref => pref.name)) });
  }));
}
