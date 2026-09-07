export const MAX_LOGIC_DELTA_MS = 100;
export const BACKGROUND_GAP_MS = 1000;

export function createFrameClock(initialNow = 0) {
  let previous = Number(initialNow) || 0;
  return {
    tick(now, hidden = false) {
      const current = Number(now) || previous;
      const raw = Math.max(0, current - previous);
      previous = current;
      if (hidden) return { logicDeltaMs: 0, playtimeDeltaMs: 0 };
      return {
        logicDeltaMs: Math.min(raw, MAX_LOGIC_DELTA_MS),
        playtimeDeltaMs: raw > BACKGROUND_GAP_MS ? 0 : raw,
      };
    },
  };
}

export function advanceTimer(timerMs, deltaMs) {
  return Math.max(0, (Number(timerMs) || 0) - Math.max(0, Number(deltaMs) || 0));
}
