// src/core/nextStage.js
// ステージクリアの画面の「つぎのステージへ」が どこへ行くかを決める。
//
// - 同じ学年（世界編は同じ級）の通常ステージを、ステージ選択と同じ並び（stageData の順）で見て、いまの次。
// - いまが その学年の 最後の通常ステージなら、学年まとめ（ボーナス）の鍵が開いていれば それへ。
//   開いていなければ、同じ学年で まだクリアしていない 通常ステージ（あれば）。学年をまたいで勝手に 地方を変えない。
// - それも無ければ「つぎ」は無い。その時は gradeEndGuide() が「マスター」への 案内を作る。
// - 学年まとめ（ボーナス）を クリアしたあとも「つぎ」は無い。
const isBonusId = (id) => /^bonus_/i.test(String(id || '')) || /_bonus$/i.test(String(id || ''));

/**
 * @param {Array<{stageId:string, grade:number, name?:string}>} stages stageData
 * @param {string} currentId いまクリアしたステージ
 * @param {(grade:number)=>boolean} isBonusUnlocked
 * @param {(stageId:string)=>boolean} [isCleared] 省略時は ぜんぶ クリア済みとみなす
 * @returns {{stageId:string, grade:number, name?:string}|null}
 */
export function findNextStage(stages, currentId, isBonusUnlocked, isCleared = () => true) {
  if (!Array.isArray(stages) || !currentId || isBonusId(currentId)) return null;
  const current = stages.find(s => s && s.stageId === currentId);
  if (!current) return null;
  const sameGrade = stages.filter(s => s && s.grade === current.grade);
  const normal = sameGrade.filter(s => !isBonusId(s.stageId));
  const index = normal.findIndex(s => s.stageId === currentId);
  if (index >= 0 && index < normal.length - 1) return normal[index + 1];
  const bonus = sameGrade.find(s => isBonusId(s.stageId));
  if (bonus && typeof isBonusUnlocked === 'function' && isBonusUnlocked(current.grade)) return bonus;
  return normal.find(s => s.stageId !== currentId && !isCleared(s.stageId)) || null;
}

/**
 * 学年の 通常ステージを ぜんぶ クリアしたのに 学年まとめの 鍵が まだの時の 案内。
 * 鍵は「ぜんぶ クリア」と「どのステージも マスター（れんしゅうで 字を ぜんぶ おぼえた）」で 開く。
 * @returns {{region:string, mastered:number, total:number, stage:object}|null}
 *   stage は まだ マスターしていない 最初の ステージ（「マスターに ちょうせん」で 始める）
 */
export function gradeEndGuide(stages, currentId, { isCleared, isMastered, isBonusUnlocked }) {
  if (!Array.isArray(stages) || !currentId || isBonusId(currentId)) return null;
  const current = stages.find(s => s && s.stageId === currentId);
  if (!current) return null;
  const sameGrade = stages.filter(s => s && s.grade === current.grade);
  const normal = sameGrade.filter(s => !isBonusId(s.stageId));
  if (!sameGrade.some(s => isBonusId(s.stageId)) || isBonusUnlocked(current.grade)) return null;
  if (!normal.length || !normal.every(s => isCleared(s.stageId))) return null;
  const notMastered = normal.filter(s => !isMastered(s.stageId));
  if (!notMastered.length) return null;
  return { region: current.region || '', mastered: normal.length - notMastered.length, total: normal.length, stage: notMastered[0] };
}
