// Companion XP is independent of the main adventure player's/enemy's level.
export const XP_THRESHOLDS = Object.freeze([0, 60, 140, 240, 370, 530, 730, 960, 1220, 1520]);
export const safeCount = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
export function growthStatus(record = {}) {
  const xp = Math.min(XP_THRESHOLDS[9], safeCount(record?.xp));
  const level = XP_THRESHOLDS.filter(threshold => xp >= threshold).length;
  const floor = XP_THRESHOLDS[level - 1], next = XP_THRESHOLDS[level] ?? floor;
  const tier = level === 10 ? 'MASTER' : level >= 7 ? 'SUPER' : level >= 4 ? 'POWER UP' : 'NORMAL';
  return Object.freeze({ xp, level, tier, floor, next, remaining: next - xp,
    fraction: level === 10 ? 1 : (xp - floor) / (next - floor),
    effects: Object.freeze({ skillPoints: level >= 4 ? 165 : 150, potency: level >= 4 ? 1.1 : 1,
      charge: level >= 7 ? 1.15 : 1, startGauge: level === 10 ? 1 : 0 }),
    description: level === 10 ? '開始ゲージ1・技+10%・チャージ+15%' : level >= 7 ? '技+10%・チャージ+15%' : level >= 4 ? '相棒技の効果+10%' : '正解3回で相棒技',
    nextUnlock: level < 4 ? 'Lv4で相棒技の効果+10%' : level < 7 ? 'Lv7でチャージ+15%' : level < 10 ? 'Lv10で開始ゲージ1' : '育ちきった、旅の相棒' });
}

export function friendshipTitle(friendship = 0) {
  const value = safeCount(friendship);
  if (value >= 100) return { title: 'ずっといっしょ', message: 'きみとなら、何度だって！', next: null };
  if (value >= 40) return { title: '息ぴったり', message: 'いいコンビになってきたね！', next: 100 };
  if (value >= 12) return { title: 'いつもの相棒', message: '次も、いっしょに行こう！', next: 40 };
  return { title: '旅のはじまり', message: 'きみと遊べて、うれしい！', next: 12 };
}

// Small situational trade-offs, derived from existing descriptive categories.
// Neither encounter level, rarity nor main-game attack stats confer an advantage.
export function supportStyle(category = '') {
  if (/食/.test(category)) return { id: 'warm', name: 'リカバー', description: 'ミス後の技+12pt・通常-3pt', color: '#efb365' };
  if (/自然|動物|植物|生物/.test(category)) return { id: 'flow', name: 'リズム', description: '3コンボ中の技+8pt・通常-8pt', color: '#84d0b2' };
  if (/歴史|文化|伝説|民話/.test(category)) return { id: 'finish', name: 'ラスト', description: '終盤の技+10pt・前半-4pt', color: '#baaceb' };
  if (/産業|工|建|交通/.test(category)) return { id: 'spark', name: 'スタート', description: '最初の技+10pt・以後-4pt', color: '#96c9ef' };
  return { id: 'steady', name: 'マイペース', description: 'いつでも同じ力でサポート', color: '#f4db8a' };
}
export function supportPoints(style, { combo = 0, answered = 0, boosts = 0, recovering = false } = {}) {
  return style === 'warm' ? (recovering ? 12 : -3) : style === 'flow' ? (combo >= 3 ? 8 : -8)
    : style === 'finish' ? (answered >= 7 ? 10 : -4) : style === 'spark' ? (boosts === 0 ? 10 : -4) : 0;
}

export function calculateXP({ completed, finished, correct, rank, newBest, activeElapsedMs } = {}) {
  if (!completed || !Number.isFinite(activeElapsedMs) || activeElapsedMs < 10000) return 0;
  const performance = (finished ? 10 : 0) + Math.min(12, safeCount(correct)) + (['A','S'].includes(rank) ? 5 : 0) + (newBest ? 5 : 0);
  // Up to 40 XP/minute of active play: repeated fast runs cannot outperform
  // normal play by orders of magnitude. Paused time is never counted.
  return Math.min(performance, Math.floor(activeElapsedMs / 1500));
}
