// These are fixed teaching simulations, not measurements from physical equipment.
export const ENERGY_CAPACITY = 12;
export const VOLTAGE_LEVELS = Object.freeze({ slow: 28, middle: 56, fast: 88 });
export const SPEED_NAMES = Object.freeze({ slow: 'ゆっくり', middle: 'ふつう', fast: 'はやく' });

export function compareLamps(step) {
  const tick = Math.max(0, Math.min(6, Math.floor(step)));
  return {
    tick,
    bulb: Math.max(0, ENERGY_CAPACITY - tick * 4),
    led: Math.max(0, ENERGY_CAPACITY - tick * 2),
  };
}

export function simulateLightPlan({ store = true, lamp = 'led', rule = 'dark' } = {}) {
  let energy = store ? ENERGY_CAPACITY : 0;
  const cost = lamp === 'bulb' ? 4 : 2;
  const ticks = Array.from({ length: 7 }, (_, index) => {
    const dark = index >= 3;
    const requested = rule === 'always' || dark;
    const lit = store ? requested && energy >= cost : !dark && requested;
    if (store && lit) energy -= cost;
    return { dark, lit, energy, label: dark ? `夜${index - 2}` : `昼${index + 1}` };
  });
  return { ticks, nightLit: ticks.filter(tick => tick.dark && tick.lit).length, remaining: energy };
}

export const ELECTION_ERAS = Object.freeze([
  { year: '1889', first: '1890', headline: '満25歳以上の男性で、一定額以上の税を納めた人', short: '投票できる人は限られていた', crowd: 2 },
  { year: '1925', first: '1928', headline: '税の条件がなくなり、満25歳以上の男性', short: '男性の範囲が広がった', crowd: 5 },
  { year: '1945', first: '1946', headline: '女性にも選挙権。満20歳以上の男女', short: '女性にも選挙権が広がった', crowd: 9 },
  { year: '2015', first: '2016', headline: '満18歳以上の男女', short: '18歳から投票できるようになった', crowd: 12 },
]);

export const PROPOSALS = Object.freeze([
  { id: 'bridge', name: '橋', gotomon: 'カワワタ', icon: '🌉', image: '/assets/images/monsters/full/mini-game/MG-038.webp', place: '川', action: '川をわたってみる', need: '川向こうの友だちに会うには、遠回りが必要だね。', wish: '橋があれば、向こう岸へ行きやすくなるよ。', reason: '行き来しやすくなる' },
  { id: 'market', name: '市場', gotomon: 'オネガミ', icon: '🍎', image: '/assets/images/monsters/full/mini-game/MG-014.webp', place: '畑', action: 'りんごを届ける', need: '作ったりんごを分ける場所がなくて、運び先に迷うね。', wish: '市場があれば、作ったものをみんなで分けられるよ。', reason: '分け合いやすくなる' },
  { id: 'map', name: '案内板', gotomon: 'チズリン', icon: '🗺️', image: '/assets/images/monsters/full/mini-game/MG-048.webp', place: '分かれ道', action: '村までの道を探す', need: '初めて来た子は、分かれ道で迷ってしまうね。', wish: '案内板があれば、村へ来る道が分かるよ。', reason: '初めての子も迷いにくい' },
]);

// 匿名の架空票。最初の10通と、あとから参加する10通を固定して比較する。
export const TURNOUT_BALLOTS = Object.freeze([
  'market', 'bridge', 'map', 'market', 'map', 'market', 'bridge', 'market', 'map', 'market',
  'bridge', 'map', 'bridge', 'market', 'bridge', 'bridge', 'map', 'bridge', 'market', 'bridge',
]);

export function countTurnoutBallots(revealed) {
  const votes = { bridge: 0, market: 0, map: 0 };
  for (const choice of TURNOUT_BALLOTS.slice(0, Math.max(0, Math.min(20, revealed)))) votes[choice] += 1;
  return votes;
}

export function turnoutTally(participants) {
  if (participants === 10 || participants === 20) return countTurnoutBallots(participants);
  return null;
}

export function ballotTally(choice) {
  if (!PROPOSALS.some(proposal => proposal.id === choice)) return null;
  const votes = { bridge: 2, market: 2, map: 1 };
  votes[choice] += 1;
  return votes;
}
