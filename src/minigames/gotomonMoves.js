// わざ と パーティ (ゴトモン拡張の第2弾, 2026-10-02 ユーザーと決めた案).
// わざ: each type has a move learned at Lv1 and a stronger one at Lv7 (7 × 2 = 14). It fires with the
// companion's skill (the gauge filled by right answers) and adds only points or gauge — never an
// answer, a judgement or a learning record. Each move is a fixed rule (no luck).
// パーティ: up to two supporters ride along. Each gives its type's small effect and gets half the XP.
import { typeInfo } from './gotomonTypes.js';

export const MOVE_LEVEL = 7;
export const MAX_SUPPORTERS = 2;

// kind: feast = the next 3 right answers add points; refill = points and gauge back after the move;
// power = the move's points × mult; combo = per combo; chronicle = per right answer so far;
// first = more on the first move; steady = the same every time.
export const MOVES = Object.freeze({
  food: [{ name: 'ほくほくパワー', kind: 'feast', value: 15, text: 'つぎの3問 正解ごとに +15pt' },
    { name: 'ごちそうパワー', kind: 'feast', value: 25, text: 'つぎの3問 正解ごとに +25pt' }],
  nature: [{ name: 'はっぱのめぐみ', kind: 'refill', value: 0.5, points: 40, text: 'わざ +40pt・ゲージが 0.5 もどる' },
    { name: 'もりのめぐみ', kind: 'refill', value: 1, text: 'わざのあと ゲージが 1 もどる' }],
  legend: [{ name: 'むかしばなしの力', kind: 'power', value: 1.2, text: 'わざの とくてん 1.2ばい' },
    { name: 'でんせつの力', kind: 'power', value: 1.4, text: 'わざの とくてん 1.4ばい' }],
  fest: [{ name: 'おまつりダンス', kind: 'combo', value: 15, cap: 75, text: 'コンボ1つにつき +15pt（75まで）' },
    { name: 'おおまつりダンス', kind: 'combo', value: 25, cap: 125, text: 'コンボ1つにつき +25pt（125まで）' }],
  history: [{ name: 'れきしのまきもの', kind: 'chronicle', value: 5, cap: 60, text: 'それまでの正解1つにつき +5pt（60まで）' },
    { name: 'でんしょうのまきもの', kind: 'chronicle', value: 8, cap: 96, text: 'それまでの正解1つにつき +8pt（96まで）' }],
  craft: [{ name: 'くみたてハンマー', kind: 'first', value: 50, after: 10, text: 'さいしょの わざ +50pt・つぎから +10pt' },
    { name: 'からくりハンマー', kind: 'first', value: 90, after: 30, text: 'さいしょの わざ +90pt・つぎから +30pt' }],
  odd: [{ name: 'ふしぎなひかり', kind: 'steady', value: 25, text: 'いつでも +25pt' },
    { name: 'ふしぎなオーラ', kind: 'steady', value: 45, text: 'いつでも +45pt' }],
});

// The move a companion uses now: the Lv7 one once it reached Lv7.
export function moveFor(type, level = 1) {
  const pair = MOVES[type] ?? MOVES.odd;
  return Object.freeze({ ...pair[level >= MOVE_LEVEL ? 1 : 0], type: MOVES[type] ? type : 'odd', learned: level >= MOVE_LEVEL ? 2 : 1 });
}
// Both moves of a type, with whether each is learned (for the picker and the sticker book).
export const movesOf = (type, level = 1) => (MOVES[type] ?? MOVES.odd).map((move, i) => Object.freeze({ ...move, level: i ? MOVE_LEVEL : 1, learned: i === 0 || level >= MOVE_LEVEL }));

// What one use of the move adds. base = the skill's own points; boosts = moves used before this one.
export function moveEffect(move, { base = 0, combo = 0, correct = 0, boosts = 0 } = {}) {
  const none = { points: 0, refill: 0, feast: 0 };
  if (!move) return none;
  switch (move.kind) {
    case 'feast': return { ...none, feast: move.value };
    case 'refill': return { ...none, points: move.points ?? 0, refill: move.value };
    case 'power': return { ...none, points: Math.round(base * (move.value - 1)) };
    case 'combo': return { ...none, points: Math.min(move.cap, combo * move.value) };
    case 'chronicle': return { ...none, points: Math.min(move.cap, correct * move.value) };
    case 'first': return { ...none, points: boosts === 0 ? move.value : move.after };
    case 'steady': return { ...none, points: move.value };
    default: return none;
  }
}

// A supporter's small effect, by its type.
export const SUPPORT_EFFECTS = Object.freeze({
  food: Object.freeze({ name: 'げんきごはん', text: 'まちがえた あとの 正解で ゲージ +0.5' }),
  nature: Object.freeze({ name: 'おひさま', text: 'ゲージが 1.1ばい たまる' }),
  legend: Object.freeze({ name: 'まもりのいのり', text: 'わざ +15pt' }),
  fest: Object.freeze({ name: 'おうえんだいこ', text: '3コンボごとに +10pt' }),
  history: Object.freeze({ name: 'きろくがかり', text: 'おわりに 正解1つにつき +3pt' }),
  craft: Object.freeze({ name: 'じゅんびばんたん', text: 'さいしょの ゲージ +1' }),
  odd: Object.freeze({ name: 'ふしぎなおまもり', text: 'わざ +10pt' }),
});
export const supportEffectOf = type => SUPPORT_EFFECTS[type] ?? SUPPORT_EFFECTS.odd;

// The party's effects added together (two of a type both count).
export function partyEffects(types = []) {
  const effects = { startGauge: 0, charge: 1, skillPlus: 0, comboPlus: 0, recoverGauge: 0, finishPerCorrect: 0 };
  for (const type of types.slice(0, MAX_SUPPORTERS)) {
    if (type === 'food') effects.recoverGauge += 0.5;
    else if (type === 'nature') effects.charge *= 1.1;
    else if (type === 'legend') effects.skillPlus += 15;
    else if (type === 'fest') effects.comboPlus += 10;
    else if (type === 'history') effects.finishPerCorrect += 3;
    else if (type === 'craft') effects.startGauge += 1;
    else effects.skillPlus += 10;
  }
  return Object.freeze(effects);
}

// The supporters' share: half the companion's XP, rounded down.
export const supporterXP = earnedXP => Math.floor(Math.max(0, Number(earnedXP) || 0) / 2);

// Saved party: up to two owned ids, none of them twice.
export function validateParty(party) {
  if (!Array.isArray(party) || party.length > MAX_SUPPORTERS || new Set(party).size !== party.length ||
      party.some(id => typeof id !== 'string' || !id)) throw new Error('Invalid party');
}

export const moveLabel = move => `${move.name}（${typeInfo(move.type).name}）`;
