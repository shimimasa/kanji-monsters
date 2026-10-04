// src/core/japanStart.js
// 冒険先の選択で「日本編」を押した時、ステージ選択のどの学年（＝地方）のタブを開くか。
//
// 以前は 日本編 → 地方の地図（番号の丸を選ぶ画面）→ ステージ選択 だった。ステージ選択の上には
// 学年のタブがあり 地方の地図と同じことができるので、地図を飛ばして ステージ選択へ直接行く（2026-10-04）。
//
// 1. 前に遊んだステージが日本編（1〜6年・小学生・全漢字）なら、その学年
// 2. なければ、地方の地図の「NEXT!」と同じく、1〜6年で まだ全部クリアしていない最初の学年
// 3. 全部クリアしていれば 1年
const JAPAN_GRADES = [1, 2, 3, 4, 5, 6, 11, 12];
const isNormalStage = (s) => !/^bonus_|_bonus$/i.test(String(s?.stageId || ''));

/**
 * @param {Array<{stageId:string, grade:number}>} stages stageData
 * @param {(stageId:string)=>boolean} isCleared
 * @param {string|null} lastPlayedId localStorage の lastPlayedStage
 * @param {(grade:number)=>boolean} [isUnlocked] 小学生（11）・全漢字（12）の鍵
 */
export function pickJapanGrade(stages, isCleared, lastPlayedId, isUnlocked = () => true) {
  const list = Array.isArray(stages) ? stages : [];
  const last = lastPlayedId ? list.find(s => s && s.stageId === lastPlayedId) : null;
  if (last && JAPAN_GRADES.includes(last.grade) && isUnlocked(last.grade)) return last.grade;
  for (let grade = 1; grade <= 6; grade++) {
    const normal = list.filter(s => s && s.grade === grade && isNormalStage(s));
    if (normal.length && !normal.every(s => isCleared(s.stageId))) return grade;
  }
  return 1;
}

// 世界編も 同じ考え方（2026-10-04）: 大陸の地図を 飛ばして 世界編の ステージ選択へ。
// 1. 前に遊んだ ステージが 世界編（7〜10＝漢検4級〜2級）なら、その級
// 2. なければ 7〜10 で まだ 全部 クリアしていない 最初の級
// 3. 全部 クリアしていれば 4級（7）
export const WORLD_LEVEL_BY_GRADE = Object.freeze({ 7: '4', 8: '3', 9: '準2', 10: '2' });

export function pickWorldGrade(stages, isCleared, lastPlayedId) {
  const list = Array.isArray(stages) ? stages : [];
  const last = lastPlayedId ? list.find(s => s && s.stageId === lastPlayedId) : null;
  if (last && WORLD_LEVEL_BY_GRADE[last.grade]) return last.grade;
  for (let grade = 7; grade <= 10; grade++) {
    const normal = list.filter(s => s && s.grade === grade && isNormalStage(s));
    if (normal.length && !normal.every(s => isCleared(s.stageId))) return grade;
  }
  return 7;
}
