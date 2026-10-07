import { scoreRank } from './scoreRank.js';
import { NEW_GAME_CONTENT } from './balancedEight/content.js';

// The eight six-question games have a complete run of six answers. Their rank
// must not ask for an eighth correct answer, regardless of companion bonuses.
export function gameRank(gameId, score, correct) {
  const total = NEW_GAME_CONTENT[gameId]?.rounds.length;
  if (!total) return scoreRank(gameId, score, correct);
  const answered = Math.max(0, Math.min(total, Number(correct) || 0));
  const steps = [0, Math.ceil(total / 3), Math.ceil(total * 2 / 3), total];
  const ranks = ['C', 'B', 'A', 'S'];
  let index = 0;
  for (let i = 1; i < steps.length; i++) if (answered >= steps[i]) index = i;
  const next = ranks[index + 1] ?? null;
  return {
    rank: ranks[index], next, points: 0,
    neededCorrect: next ? steps[index + 1] - answered : 0,
    goal: next ? `つぎは ${steps[index + 1]}つの お題を たしかめよう` : '6つの お題を たしかめたね！',
  };
}
