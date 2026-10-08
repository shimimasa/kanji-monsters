// 実績の条件を、一覧で見分けられる8種類のバッジにまとめる。
const BADGES = {
  challenge: { mark: '星', label: 'ちょうせん', color: '#f1a574' },
  growth: { mark: '芽', label: 'せいちょう', color: '#94d7ad' },
  journey: { mark: '旅', label: 'たび', color: '#8bd2e4' },
  learning: { mark: '文', label: 'まなび', color: '#a9bdf6' },
  collection: { mark: '図', label: 'あつめる', color: '#cfafea' },
  care: { mark: '心', label: 'やさしさ', color: '#f1b2bf' },
  time: { mark: '時', label: 'つづける', color: '#f2ce83' },
  title: { mark: '冠', label: 'しょうごう', color: '#f7df91' },
};

export const ACHIEVEMENT_BADGE_KIND = Object.freeze({
  enemiesDefeated: 'challenge', bossesDefeated: 'challenge',
  weaknessHits: 'challenge', perfectStage: 'challenge',
  levelReached: 'growth', skillPointsUsed: 'growth',
  stagesCleared: 'journey', stageCleared: 'journey', regionCleared: 'journey',
  totalCorrect: 'learning', comboReached: 'learning', gradeCompleted: 'learning',
  kanjiCollected: 'collection', monstersCollected: 'collection',
  healsSuccessful: 'care', playtimeMinutes: 'time', manual: 'title',
});

function badgeFor(achievement) {
  const kind = ACHIEVEMENT_BADGE_KIND[achievement.condition?.type] || 'learning';
  return BADGES[kind];
}

export function getAchievementBadgeLabel(achievement) {
  return badgeFor(achievement).label;
}

export function drawAchievementBadge(ctx, achievement, x, y, unlocked) {
  const badge = badgeFor(achievement);
  const cx = x + 15;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, y - 17);
  ctx.lineTo(cx + 15, y - 10);
  ctx.lineTo(cx + 13, y + 8);
  ctx.lineTo(cx, y + 17);
  ctx.lineTo(cx - 13, y + 8);
  ctx.lineTo(cx - 15, y - 10);
  ctx.closePath();
  ctx.fillStyle = unlocked ? badge.color : '#3d4a59';
  ctx.strokeStyle = unlocked ? '#fff0c3' : '#8995a3';
  ctx.lineWidth = 1.5;
  ctx.fill();
  ctx.stroke();
  ctx.font = 'bold 16px "UDデジタル教科書体",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = unlocked ? '#25313a' : '#d1d9de';
  ctx.fillText(badge.mark, cx, y + 1);
  ctx.restore();
}
