import { gotomonService } from './gotomonService.js';
import { matchup, typeOf, typeInfo } from './gotomonTypes.js';

// The main battle's one hook for type matchups: called only after a right answer, with that
// answer's damage. A companion (the Gotomon chosen in the mini-game square) whose type beats the
// enemy's makes the attack 1.5 times as strong. A wrong answer, the record and the question are untouched.
export function companionMatchup(damage, enemy, log, { getCompanion = () => gotomonService.getSelectedGotomon() } = {}) {
  try {
    const companion = getCompanion();
    if (!companion || !enemy || !Number.isFinite(damage)) return damage;
    const factor = matchup(companion.type, typeOf(enemy));
    if (factor === 1) return damage;
    log?.push?.(`相棒の${companion.name}（${typeInfo(companion.type).name}）が ${typeInfo(typeOf(enemy)).name}に つよい！ ${factor}ばい！`);
    return Math.round(damage * factor);
  } catch {
    return damage;
  }
}
