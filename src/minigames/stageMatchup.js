import { gotomonService } from './gotomonService.js';
import { matchup, typeOf, typeInfo } from './gotomonTypes.js';
import { getEnemiesByStageId } from '../loaders/dataLoader.js';

// ゴトモン拡張を ステージ選択にも (2026-10-03): the stage tooltip says which types the stage's Gotomon
// mostly are and how many of them the companion (chosen in the mini-game square) is strong against.
// Display only: the battle itself applies the matchup (battleMatchup.js) after a right answer.
export function stageTypeLines(stageId, { getEnemies = getEnemiesByStageId, getCompanion = () => gotomonService.getSelectedGotomon() } = {}) {
  try {
    const enemies = (getEnemies(stageId) ?? []).filter(Boolean);
    if (!enemies.length) return [];
    const counts = new Map();
    for (const enemy of enemies) { const type = typeOf(enemy); counts.set(type, (counts.get(type) ?? 0) + 1); }
    const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([type]) => typeInfo(type).name);
    const lines = [{ text: `多いタイプ: ${top.join('・')}`, color: '#ffe9a8' }];
    const companion = getCompanion();
    if (companion) {
      const strong = enemies.filter(enemy => matchup(companion.type, typeOf(enemy)) > 1).length;
      lines.push(strong
        ? { text: `あいぼうが つよい敵: ${strong}ひき`, color: '#7dffb0' }
        : { text: 'あいぼうの タイプは ふつう', color: '#cfd8dc' });
    }
    return lines;
  } catch {
    return [];
  }
}
