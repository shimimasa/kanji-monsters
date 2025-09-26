// TutorialManager.js
import { getStepsFor } from './tutorialData.js';
import { createGuide } from './TutorialGuide.js';

const TutorialManager = {
  guide: null,

  startIfNeeded(screenId, ctx) {
    try {
      const enabled = (localStorage.getItem('tutorialEnabled') ?? '1') === '1';
      if (!enabled) return;
      const seenKey = `tutorial_seen_${screenId}`;
      if (localStorage.getItem(seenKey) === '1') return;

      const steps = getStepsFor(screenId, ctx);
      if (!Array.isArray(steps) || steps.length === 0) return;

      this._start(screenId, steps);
    } catch {}
  },

  forceStart(screenId, ctx) {
    const steps = getStepsFor(screenId, ctx);
    if (!steps || steps.length === 0) return;
    this._start(screenId, steps);
  },

  _start(screenId, steps) {
    const onClose = (neverShowAgain) => {
      if (neverShowAgain) {
        try { localStorage.setItem('tutorialEnabled', '0'); } catch {}
      } else {
        try { localStorage.setItem(`tutorial_seen_${screenId}`, '1'); } catch {}
      }
      this._destroy();
    };

    this._destroy();
    this.guide = createGuide(steps, onClose);
  },

  _destroy() {
    if (this.guide && typeof this.guide.destroy === 'function') {
      this.guide.destroy();
    }
    this.guide = null;
  }
};

export default TutorialManager;