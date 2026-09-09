const ACTIONS = new Set(['idle', 'attack', 'hit', 'defeat']);
const finite = (v, fallback = 0) => Number.isFinite(v) ? Math.max(0, v) : fallback;
// Immutable display state. Only the host calls advance; draw/sample never does.
export function advanceMonsterTimeline(previous, input, dt = 0) {
  const identity = JSON.stringify([input.session, input.monsterId]);
  const same = previous?.identity === identity;
  const raw = ACTIONS.has(input.action) ? input.action : 'idle';
  const held = same && previous.action === 'defeat' && raw === 'idle';
  const action = held ? 'defeat' : raw;
  const remaining = finite(input.remainingMs);
  const restart = !same || previous.action !== action ||
    (action !== 'idle' && !held &&
      (remaining > previous.remainingMs + 1 || input.actionRevision !== previous.actionRevision));
  const durationMs = restart ? Math.max(1, finite(input.durationMs, remaining)) : previous.durationMs;
  const idleMs = Number.isFinite(input.elapsedMs) ? finite(input.elapsedMs) :
    (same ? previous.idleMs : 0) + Math.min(100, finite(dt));
  const progress = action === 'idle' ? (idleMs % 2000) / 2000 :
    held ? 1 : Math.max(0, Math.min(1, 1 - remaining / durationMs));
  return Object.freeze({ identity, action, progress, durationMs, remainingMs: remaining,
    idleMs, actionRevision: input.actionRevision,
    revision: (previous?.revision || 0) + (restart ? 1 : 0) });
}
