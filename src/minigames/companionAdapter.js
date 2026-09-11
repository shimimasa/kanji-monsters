import { createMonsterMotionHost } from '../visuals/motion/monsterMotionHost.js';

export function createCompanionAdapter({ sessionId, ownedMonsterIds, loadImage,
  createHost = createMonsterMotionHost }) {
  let disposed = false, host = null, action = 'idle', remainingMs = 0, elapsedMs = 0, revision = 0, seq = 0;
  const selected = ownedMonsterIds.includes('HKD-E01') ? 'HKD-E01' : null;
  if (selected) {
    // A synchronous loader error is the same display-only failure as a rejection.
    const imagePromise = Promise.resolve().then(() => disposed ? null : loadImage());
    host = createHost({ session: sessionId, imagePromise });
  }
  return {
    observe(event) {
      if (disposed || !host || event.sessionId !== sessionId || event.seq <= seq) return;
      seq = event.seq;
      action = event.type === 'correct' ? 'attack' : 'idle';
      remainingMs = action === 'attack' ? 750 : 0; revision++;
    },
    update(dtMs, reducedMotion = false) {
      if (disposed || !host) return;
      const dt = Number.isFinite(dtMs) ? Math.max(0, dtMs) : 0;
      elapsedMs += dt; remainingMs = Math.max(0, remainingMs - dt);
      if (!remainingMs) action = 'idle';
      host.update({ session: sessionId, monsterId: selected, action, remainingMs,
        durationMs: action === 'attack' ? 750 : 2000, elapsedMs, actionRevision: revision, reducedMotion }, dt);
    },
    present(ctx, layout) { return !disposed && !!host?.present(ctx, layout); },
    inspect() { return Object.freeze({ selected: disposed ? null : selected, disposed,
      hostCount: host ? 1 : 0, action, remainingMs, motion: host?.state() ?? null }); },
    dispose() { if (disposed) return; disposed = true; host?.dispose(); host = null; },
  };
}
