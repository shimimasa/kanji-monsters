const TARGETS = Object.freeze({ normal: [650,1050,1600], kanjiDefense: [1000,1800,2700] });
export function scoreRank(gameId, score, correct, total = gameId === 'kanjiDefense' ? 12 : 10) {
  const targets = TARGETS[gameId] ?? TARGETS.normal;
  const accuracy = Math.max(0, Math.min(1, correct / total));
  const ranks = ['C','B','A','S'], floors = [0,0,.6,.8];
  let index = 0;
  for (let i = 1; i <= 3; i++) if (score >= targets[i - 1] && accuracy >= floors[i]) index = i;
  const next = ranks[index + 1] ?? null, points = next ? Math.max(0, targets[index] - score) : 0;
  const neededCorrect = next ? Math.max(0, Math.ceil(total * floors[index + 1]) - correct) : 0;
  return { rank: ranks[index], next, points, neededCorrect,
    goal: next ? (neededCorrect ? `あと${neededCorrect}問正解${points ? `と${points}pt` : ''}で${next}ランク` : `あと${points}ptで${next}ランク`) : 'Sランク！次は自分の記録をこえよう' };
}
export const betterRank = (a, b) => ['C','B','A','S'].indexOf(a) > ['C','B','A','S'].indexOf(b) ? a : b;
