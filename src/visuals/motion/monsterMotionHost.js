import { sampleMonsterPose, NEUTRAL_POSE } from './motionProfile.js';
import { advanceMonsterTimeline } from './motionTimeline.js';
import { drawMonsterImage } from './monsterRenderer.js';
import { HKD_E01_MOTION } from './monsterMotionManifest.js';

// Display lifetime only. Loader, scheduler, existing fallback and game logic belong to host.
// Async completion only changes image ownership; it never invokes a gameplay callback.
export function createMonsterMotionHost({ session, imagePromise, visual = HKD_E01_MOTION,
  draw = drawMonsterImage } = {}) {
  let disposed = false, image = null, imageState = 'pending', timeline = null, reducedMotion = false;
  const settled = Promise.resolve(imagePromise).then(value => {
    if (disposed) return false;
    if (!value || value.complete === false || !(value.naturalWidth > 0) || !(value.naturalHeight > 0)) {
      imageState = 'failed'; return false;
    }
    image = value; imageState = 'ready'; return true;
  }, () => {
    if (!disposed) imageState = 'failed';
    return false;
  });
  return {
    settled,
    update(view, dt = 0) {
      if (disposed || view.session !== session || view.monsterId !== visual.monsterId) return false;
      timeline = advanceMonsterTimeline(timeline, view, dt);
      reducedMotion = !!view.reducedMotion;
      return true;
    },
    present(ctx, layout) {
      if (disposed || imageState !== 'ready' || !timeline) return false;
      const pose = sampleMonsterPose({ profile: visual.motionProfile, action: timeline.action,
        progress: timeline.progress, layout: layout?.imageRect, reducedMotion });
      if (!pose) return false;
      try { return draw(ctx, image, layout, pose); }
      catch {
        // Restore is guaranteed by the renderer. Attempt the same image without motion.
        try { return draw(ctx, image, layout, NEUTRAL_POSE); } catch { return false; }
      }
    },
    state: () => Object.freeze({ disposed, imageState, timeline }),
    dispose() {
      if (disposed) return;
      disposed = true; image = null; timeline = null; imageState = 'disposed';
    },
  };
}
