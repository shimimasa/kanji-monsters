import { getContainedRect } from '../ui/viewportLayout.js';

// Display ownership only. No imports from game state, learning, storage or loaders.
const owners = new WeakMap();
let nextSession = 0;
const live = new Set();
export const visualResourceCounts = () => Object.freeze({
  sessions: live.size,
  ...[...live].reduce((sum, session) => {
    const counts = session.resources();
    for (const key of Object.keys(sum)) sum[key] += counts[key] || 0;
    return sum;
  }, { engines: 0, scenes: 0, canvases: 0, observers: 0, listeners: 0, animations: 0, loops: 0 }),
});

export function readVisualLayout(canvas) {
  const r = canvas.getBoundingClientRect();
  return Object.freeze({
    box: Object.freeze({ left: r.left, top: r.top, width: r.width, height: r.height }),
    content: Object.freeze(getContainedRect(r, canvas.width, canvas.height)),
    width: canvas.width, height: canvas.height,
    dpr: Math.min(globalThis.devicePixelRatio || 1, 1.5),
  });
}

export function createBattleVisualAdapter({ canvas, generation,
  load = () => import('./babylonPrimitiveRenderer.js'),
}) {
  owners.get(canvas)?.dispose();
  const session = ++nextSession;
  let disposed = false, failed = false, pending = null, renderer = null, host = null, surface = null;
  let lastLayout = null, appliedLayoutKey = '';
  const current = () => !disposed && owners.get(canvas) === api;
  const hide = () => {
    if (host) host.hidden = true;
    if (owners.get(canvas) === api) canvas.classList.remove('yomitabi-3d-active');
  };
  const release = () => {
    hide();
    const old = renderer;
    renderer = null;
    try { old?.dispose(); } finally { host?.remove(); host = surface = null; }
  };
  const fail = error => {
    failed = true;
    try { release(); } catch (disposeError) { console.warn('Yomitabi 3D dispose:', disposeError); }
    if (current()) console.warn('Yomitabi 3D: continuing in 2D', error);
  };
  const api = {
    session,
    prepare() {
      if (!current() || failed) return Promise.resolve(false);
      if (pending) return pending;
      // The controller never awaits this promise. A stale import creates no GPU resources.
      pending = Promise.resolve().then(load).then(async module => {
        if (!current()) return false;
        host = document.createElement('div');
        host.className = 'yomitabi-3d-backdrop';
        host.hidden = true;
        host.setAttribute('aria-hidden', 'true');
        surface = document.createElement('canvas');
        surface.className = 'yomitabi-3d-canvas';
        surface.tabIndex = -1;
        surface.inert = true;
        surface.setAttribute('aria-hidden', 'true');
        surface.dataset.visualSession = String(session);
        host.appendChild(surface);
        canvas.parentNode.insertBefore(host, canvas);
        const handle = await module.preparePrimitive({ canvas: surface, onFailure: fail });
        if (!current() || failed) { handle.dispose(); return false; }
        renderer = handle;
        if (lastLayout) api.resize(lastLayout);
        return true;
      }).catch(error => { fail(error); return false; });
      return pending;
    },
    present(snapshot, dt, layout) {
      if (!current() || failed || snapshot.generation !== generation || snapshot.session !== session) return false;
      if (snapshot.stageId !== 'hokkaido_area1' || snapshot.enemyId !== 'HKD-E01') { hide(); return false; }
      try {
        api.resize(layout);
        if (!pending) void api.prepare();
        if (!renderer) return false;
        if (renderer.present(snapshot, dt, layout) === false) { hide(); return false; }
        if (!current() || failed) return false;
        if (host.hidden) {
          host.hidden = false;
          canvas.classList.add('yomitabi-3d-active');
        }
        return true; // Only selects the 2D paint path; never a gameplay readiness gate.
      } catch (error) { fail(error); return false; }
    },
    resize(layout) {
      if (!current() || failed) return;
      lastLayout = layout;
      if (!host) return;
      const { box: b, content: c } = layout;
      const key = [b.left,b.top,b.width,b.height,c.left,c.top,c.width,c.height,layout.width,layout.height,layout.dpr].join('/');
      if (key === appliedLayoutKey && renderer) return;
      Object.assign(host.style, { left: b.left + 'px', top: b.top + 'px', width: b.width + 'px', height: b.height + 'px' });
      Object.assign(surface.style, { left: c.left - b.left + 'px', top: c.top - b.top + 'px', width: c.width + 'px', height: c.height + 'px' });
      renderer?.resize(layout);
      if (renderer) appliedLayoutKey = key;
    },
    resources() {
      return { ...renderer?.resources(), canvases: surface ? 1 : 0 };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      try { release(); } catch (error) { console.warn('Yomitabi 3D dispose:', error); }
      if (owners.get(canvas) === api) owners.delete(canvas);
      live.delete(api);
    },
  };
  owners.set(canvas, api);
  live.add(api);
  return api;
}
