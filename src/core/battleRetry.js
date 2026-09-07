/**
 * 期限が来た戦闘内再出題を取り出す。
 * 現在の弱点候補に無いだけなら保持し、ステージ全体から消えたIDだけ破棄する。
 */
export function takeDueRetry(queue, candidatePool, stagePool) {
  if (!Array.isArray(queue)) return null;
  const candidateIds = new Set((candidatePool || []).map(item => item?.id));
  const stageIds = new Set((stagePool || []).map(item => item?.id));
  for (let index = 0; index < queue.length; index++) {
    const item = queue[index];
    if (!item || item.waitTurns > 0) continue;
    if (candidateIds.has(item.id)) {
      queue.splice(index, 1);
      return (candidatePool || []).find(candidate => candidate?.id === item.id) || null;
    }
    if (!stageIds.has(item.id)) {
      queue.splice(index, 1);
      index--;
    }
  }
  return null;
}

