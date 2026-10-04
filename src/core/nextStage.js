// src/core/nextStage.js
// ステージクリアの画面の「つぎのステージへ」が どこへ行くかを決める。
//
// - 同じ学年（世界編は同じ級）の通常ステージを、ステージ選択と同じ並び（stageData の順）で見て、いまの次。
// - いまが その学年の 最後の通常ステージなら、学年まとめ（ボーナス）の鍵が開いていれば それへ。
//   開いていなければ「つぎ」は無い（ボタンを出さない）。学年をまたいで勝手に 地方を変えない。
// - 学年まとめ（ボーナス）を クリアしたあとも「つぎ」は無い。
const isBonusId = (id) => /^bonus_/i.test(String(id || '')) || /_bonus$/i.test(String(id || ''));

/**
 * @param {Array<{stageId:string, grade:number, name?:string}>} stages stageData
 * @param {string} currentId いまクリアしたステージ
 * @param {(grade:number)=>boolean} isBonusUnlocked
 * @returns {{stageId:string, grade:number, name?:string}|null}
 */
export function findNextStage(stages, currentId, isBonusUnlocked) {
  if (!Array.isArray(stages) || !currentId || isBonusId(currentId)) return null;
  const current = stages.find(s => s && s.stageId === currentId);
  if (!current) return null;
  const sameGrade = stages.filter(s => s && s.grade === current.grade);
  const normal = sameGrade.filter(s => !isBonusId(s.stageId));
  const index = normal.findIndex(s => s.stageId === currentId);
  if (index >= 0 && index < normal.length - 1) return normal[index + 1];
  const bonus = sameGrade.find(s => isBonusId(s.stageId));
  if (bonus && typeof isBonusUnlocked === 'function' && isBonusUnlocked(current.grade)) return bonus;
  return null;
}
