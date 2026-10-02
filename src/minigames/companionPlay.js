import { growthStatus, supportPoints } from './companionGrowth.js';
import { createGameplayRun } from './gameplay/gameplayRun.js';

// What an answer event was, for the run's feedback and the playtest log: an enemy that reached
// the barrier or the gate (けいさんインベーダー・漢字防衛隊, reason 'escaped') is a time-out,
// not a wrong answer — the child gave no answer, so it gets no wrong-answer buzzer.
export const answerKind = event => event?.type === 'incorrect'
  ? (event.payload?.reason === 'escaped' ? 'timeout' : event.payload?.classification === 'partial' ? 'partial' : 'incorrect')
  : event?.type;

// Consumes committed events; never supplies answers or changes learning rules.
export function createCompanionPlay(sessionId, { gameId, growth = growthStatus(), support = 'steady', bestTimeMs = null, course = null, pace = 'normal' } = {}) {
  let seq = 0, correct = 0, combo = 0, maxCombo = 0, gauge = 0, bonus = 0, boosts = 0;
  let reaction = 'idle', remaining = 0, completed = false, revision = 0;
  let answered = 0, learningPoints = 0, recovering = false;
  gauge = growth.effects.startGauge;
  const variation=[...sessionId].reduce((sum,char)=>sum+char.charCodeAt(0),0)%3;
  const world = gameId ? createGameplayRun(gameId, growth.effects, {bestTimeMs,variation,course,pace}) : null;
  const skillPoints = () => growth.effects.skillPoints + supportPoints(support, {combo,answered,boosts,recovering});
  return {
    context(state) { world?.context(state); },
    allowCommand(command) { return world?.allow(command) ?? true; },
    act(action) { const accepted = world?.act(action); if (accepted) revision++; return !!accepted; },
    observe(event) {
      if (event.sessionId !== sessionId || !Number.isSafeInteger(event.seq) || event.seq <= seq || completed) return;
      seq = event.seq;
      if (event.type === 'correct') {
        correct++; answered++; learningPoints += 100; combo++; maxCombo = Math.max(maxCombo, combo);
        gauge = Math.min(4, gauge + growth.effects.charge);
        if (combo > 2) recovering = false;
        world?.answer(true, event.payload, combo);
        reaction = 'correct'; remaining = 800; revision++;
      } else if (event.type === 'incorrect') {
        answered++; combo = 0; recovering = true;
        learningPoints += Math.round(Math.min(1,Math.max(0,event.payload?.score || 0))*100);
        world?.answer(false, event.payload, combo);
        reaction = answerKind(event);
        remaining = 600; revision++;
      } else if (event.type === 'sessionComplete') {
        // A final answer can fill the gauge: convert it before sealing the result.
        if (gauge >= 3) { bonus += skillPoints(); boosts++; gauge -= 3; }
        world?.complete();
        completed = true; reaction = 'celebrate'; revision++;
      }
    },
    boost(paused = false) {
      if (paused || completed || gauge < 3) return false;
      gauge -= 3; bonus += skillPoints(); boosts++; recovering = false;
      world?.boost(); reaction = 'boost'; remaining = 950; revision++; return true;
    },
    update(dt) {
      world?.update(Number.isFinite(dt) ? Math.max(0,dt) : 0);
      remaining = Math.max(0, remaining - (Number.isFinite(dt) ? Math.max(0, dt) : 0));
      if (!remaining && !completed) reaction = 'idle';
    },
    snapshot() {
      const scene = world?.snapshot(), totalBonus = bonus + (scene?.bonus || 0);
      return { correct, answered, combo, maxCombo, gauge, bonus:totalBonus, boosts, reaction, revision,
        learningPoints, score:learningPoints+totalBonus, completed, growth, skillPoints:skillPoints(), world:scene };
    },
  };
}
