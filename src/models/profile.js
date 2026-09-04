import { gameState, getWeeklyAnswerSummary } from '../core/gameState.js';
import { loadDex as loadKanjiDex } from './kanjiDex.js';
import { loadDex as loadMonsterDex } from './monsterDex.js';
import { getUnlockedAchievements, getAchievementProgress } from '../core/achievementManager.js';

function getMasteredKanjiCount() {
  try {
    const prog = gameState.kanjiReadProgress || {};
    let mastered = 0;
    for (const id in prog) {
      if (prog[id]?.mastered) mastered++;
    }
    return mastered;
  } catch {
    return 0;
  }
}

export function loadProfileSummary() {
  const ps = gameState.playerStats || {};
  const name = gameState.playerName || '(ななし)';
  const level = ps.level ?? 1;
  const exp = ps.exp ?? 0;
  const next = ps.nextLevelExp ?? 100;

  const enemiesDefeated = ps.enemiesDefeated ?? 0;
  const bossesDefeated = ps.bossesDefeated ?? 0;
  const totalCorrect = ps.totalCorrect ?? 0;
  const weaknessHits = ps.weaknessHits ?? 0;
  const healsSuccessful = ps.healsSuccessful ?? 0;
  const playtimeSeconds = ps.playtimeSeconds ?? 0;

  const kanjiDex = loadKanjiDex();
  const monsterDex = loadMonsterDex();

  return {
    player: { name, level, exp, next },
    stats: { enemiesDefeated, bossesDefeated, totalCorrect, weaknessHits, healsSuccessful, playtimeSeconds },
    collection: {
      kanjiCount: kanjiDex.size,
      masteredCount: getMasteredKanjiCount(),
      monsterCount: monsterDex.size
    },
    weekly: getWeeklyAnswerSummary()
  };
}

export async function loadAchievementsSummary() {
  const [unlocked, progress] = await Promise.all([
    getUnlockedAchievements().catch(() => []),
    getAchievementProgress().catch(() => ({ unlocked: 0, total: 0, percentage: 0 }))
  ]);
  return { unlocked, progress };
}
