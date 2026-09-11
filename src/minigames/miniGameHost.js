import { publish } from '../core/eventBus.js';
import { images } from '../loaders/assetsLoader.js';
import { HKD_E01_MOTION } from '../visuals/motion/monsterMotionManifest.js';
import { prefersReducedMotion } from '../ui/motionPreferences.js';
import { miniGameRegistry } from './registry.js';
import { readActiveCollection } from './collectionAdapter.js';
import { createCompanionAdapter } from './companionAdapter.js';

const layout = Object.freeze({ imageRect: { x: 20, y: 10, width: 240, height: 120 },
  clipRect: { x: 24, y: 14, width: 232, height: 112 } });

// The general monster loader tries other assets and generates a placeholder on
// failure. This slice permits only the existing E01 asset, with a text fallback.
export function loadCompanionImage() {
  if (images['HKD-E01']) return Promise.resolve(images['HKD-E01']);
  return new Promise((resolve, reject) => {
    const image = new Image();
    const finish = callback => { image.onload = null; image.onerror = null; callback(); };
    image.onload = () => finish(() => resolve(image));
    image.onerror = () => finish(() => reject(new Error('Companion image unavailable')));
    image.src = HKD_E01_MOTION.imageUrl;
  });
}

export function createMiniGameHost({ document: doc = globalThis.document,
  window: win = globalThis.window, collection = readActiveCollection,
  makeSessionId = () => crypto.randomUUID(), random = Math.random,
  loadImage = loadCompanionImage,
  makeCompanion = createCompanionAdapter, makeView = null,
  reduced = prefersReducedMotion, onBack = () => publish('changeScreen', 'title') } = {}) {
  let game = null, view = null, companion = null, valid = false, cleanups = [], props = null;
  let visibilityPaused = false, manualPaused = false;
  const syncPause = () => game?.setPaused(visibilityPaused || manualPaused);
  const host = {
    enter(nextProps = {}) {
      host.exit(); props = nextProps;
      const definition = miniGameRegistry[nextProps.gameId || 'mathSprint'];
      if (!definition) throw new Error('Unknown mini game');
      const sessionId = makeSessionId(); valid = true; manualPaused = false; visibilityPaused = !!doc.hidden;
      companion = makeCompanion({ sessionId, ownedMonsterIds: collection(), loadImage });
      game = definition.create({ sessionId, random, onEvent: event => { if (valid) companion?.observe(event); } });
      const current = game;
      const createView = makeView || definition.createView;
      if (typeof createView !== 'function') throw new Error('Mini game view unavailable');
      view = createView({ document: doc, getSnapshot: () => current.snapshot(),
        onSubmit: answer => {
          if (!valid || current !== game || !current.submit(answer)) return false;
          host.update(0); return true;
        },
        onNext: (...args) => valid && current === game && current.next?.(...args),
        onSelect: (...args) => {
          if (!valid || current !== game || !current.select?.(...args)) return false;
          host.update(0); return true;
        },
        onBack: () => { if (valid && current === game) { host.exit(); onBack(); } },
        onReplay: () => { if (valid && current === game && current.snapshot().result) host.enter(props); } });
      const visibility = () => { visibilityPaused = !!doc.hidden; syncPause(); host.update(0); };
      doc.addEventListener('visibilitychange', visibility);
      cleanups.push(() => doc.removeEventListener('visibilitychange', visibility));
      // Respect the visible viewport when the OS keyboard shrinks or pans it.
      const root = view.root;
      const viewport = win?.visualViewport;
      const keyboard = win?.navigator?.virtualKeyboard;
      const resize = () => {
        if (!root || !viewport) return;
        const keyboardRect = keyboard?.boundingRect;
        const height = keyboardRect?.height > 0
          ? Math.min(viewport.height, Math.max(1, keyboardRect.y - viewport.offsetTop)) : viewport.height;
        root.style.top = `${viewport.offsetTop}px`; root.style.height = `${height}px`; root.style.bottom = 'auto';
      };
      if (viewport) {
        viewport.addEventListener('resize', resize); viewport.addEventListener('scroll', resize);
        cleanups.push(() => { viewport.removeEventListener('resize', resize); viewport.removeEventListener('scroll', resize); }); resize();
      }
      if (keyboard) {
        keyboard.addEventListener('geometrychange', resize);
        cleanups.push(() => keyboard.removeEventListener('geometrychange', resize));
      }
      // Keep the underlying app out of keyboard focus while this screen owns input.
      for (const node of [...doc.body.children]) {
        if (node === root || node.tagName === 'SCRIPT') continue;
        const previous = node.inert; node.inert = true;
        cleanups.push(() => { node.inert = previous; });
      }
      syncPause(); game.enter(); host.update(0);
    },
    update(dtMs) {
      if (!valid) return;
      game.update(dtMs);
      const state = game.snapshot();
      companion.update(state.paused ? 0 : dtMs, reduced());
      view.update(state, companion.inspect());
      const ctx = view.canvas?.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, view.canvas.width, view.canvas.height);
        companion.present(ctx, layout);
      }
    },
    setPaused(value) { manualPaused = !!value; syncPause(); host.update(0); },
    exit() {
      if (!valid) return;
      view?.stopInput(); valid = false;
      game?.exit(); game = null;
      companion?.dispose(); companion = null;
      cleanups.splice(0).forEach(remove => remove());
      view?.dispose(); view = null;
    },
    inspect() { return { valid, session: game?.snapshot() ?? null, companion: companion?.inspect() ?? null, listeners: cleanups.length }; },
  };
  return host;
}

export default createMiniGameHost();
