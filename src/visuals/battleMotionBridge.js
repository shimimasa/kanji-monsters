// Battle-only display bridge. No game-state imports, image loader, clocks or callbacks to Core.
import { drawMonsterImage } from './motion/monsterRenderer.js';
export function createBattleMotionBridge({ session, durations,
  loadHost = () => import('./motion/monsterMotionHost.js') } = {}) {
  let disposed = false, failed = false, loading = false, factory = null;
  let host = null, image = null, latest = null, identity = null, generation = 0;
  let elapsedMs = 0, actionRevision = 0, drawFailed = false;
  const release = () => { host?.dispose(); host = null; image = null; latest = null; };
  const fail = () => { failed = true; release(); };
  const install = () => {
    if (disposed || failed || !factory || !latest?.image || host) return;
    if (latest.image.complete === false || !(latest.image.naturalWidth > 0) ||
        !(latest.image.naturalHeight > 0)) return;
    try {
      image = latest.image;
      host = factory({ session, imagePromise: image, draw(...args) {
        // The standalone host retries neutral on exceptions. Battle must instead return
        // to its original Legacy path, including for a transient first draw failure.
        if (drawFailed) throw new Error('Motion draw unavailable');
        try { return drawMonsterImage(...args); } catch (error) { drawFailed = true; throw error; }
      } });
      host.update(latest.view);
    } catch { fail(); }
  };
  return {
    // A display event serial, independent of question token and controller duration.
    actionStarted() { if (!disposed) actionRevision++; },
    update({ stageId, mode, monsterId, enemyKey, image: nextImage, action, remainingMs,
      reducedMotion = false } = {}, dt = 0) {
      if (disposed) return;
      const eligible = stageId === 'hokkaido_area1' && mode === 'normal' && monsterId === 'HKD-E01';
      const nextIdentity = eligible ? JSON.stringify([monsterId, enemyKey]) : null;
      if (identity !== nextIdentity) {
        generation++; release(); identity = nextIdentity; elapsedMs = 0;
      }
      if (!eligible || failed) return;
      elapsedMs += Math.min(100, Math.max(0, Number.isFinite(dt) ? dt : 0));
      const mapped = action === 'damage' ? 'hit' : ['attack', 'defeat'].includes(action) ? action : 'idle';
      if (host && image !== nextImage) release();
      latest = { image: nextImage, view: { session, monsterId, action: mapped,
        remainingMs, durationMs: durations?.[action] ?? 2000,
        elapsedMs, actionRevision, reducedMotion } };
      if (!factory && !loading) {
        loading = true;
        // Native module promise only; completion never renders or advances a game timer.
        Promise.resolve().then(loadHost).then(module => {
          loading = false;
          if (disposed) return;
          if (typeof module?.createMonsterMotionHost !== 'function') { fail(); return; }
          factory = module.createMonsterMotionHost;
          install();
        }, () => { loading = false; if (!disposed) fail(); });
      }
      install();
      try { host?.update(latest.view); } catch { fail(); }
    },
    // Called inside the unchanged legacy clip/transform. Undo only that local transform;
    // the parent canvas transform and existing backing/frame/shield remain unchanged.
    present(ctx, layout, legacy) {
      if (disposed || failed || !host || !identity) return false;
      let saved = false;
      try {
        if (![legacy?.x, legacy?.y, legacy?.rotation].every(Number.isFinite)) return false;
        ctx.save(); saved = true;
        ctx.rotate(-legacy.rotation); ctx.translate(-legacy.x, -legacy.y);
        ctx.globalAlpha = 1;
        drawFailed = false;
        const drawn = host.present(ctx, layout);
        if (drawFailed) { fail(); return false; }
        return drawn;
      } catch { fail(); return false; }
      finally { if (saved) ctx.restore(); }
    },
    inspect() {
      const state = host?.state();
      return { disposed, failed, loading: !disposed && loading, generation,
        activeSession: disposed ? null : session, identity,
        hostCount: host ? 1 : 0, imageReference: !!image, timeline: state?.timeline ?? null,
        imageState: state?.imageState ?? 'absent', scheduledCallback: 0, raf: 0, timer: 0, listener: 0 };
    },
    dispose() {
      if (disposed) return;
      disposed = true; generation++; release(); identity = null; factory = null;
    },
  };
}
