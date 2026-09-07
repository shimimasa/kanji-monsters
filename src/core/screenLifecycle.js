export function createScreenLifecycle() {
  let generation = 0;
  let active = false;
  const timers = new Set();
  const frames = new Set();

  const api = {
    activate() {
      api.deactivate();
      active = true;
      return generation;
    },
    deactivate() {
      active = false;
      generation++;
      for (const id of timers) clearTimeout(id);
      timers.clear();
      for (const id of frames) globalThis.cancelAnimationFrame?.(id);
      frames.clear();
    },
    setTimeout(callback, delay) {
      const owner = generation;
      const id = setTimeout(() => {
        timers.delete(id);
        if (active && generation === owner) callback();
      }, delay);
      timers.add(id);
      return id;
    },
    clearTimeout(id) {
      clearTimeout(id);
      timers.delete(id);
    },
    requestAnimationFrame(callback) {
      const owner = generation;
      const id = requestAnimationFrame(time => {
        frames.delete(id);
        if (active && generation === owner) callback(time);
      });
      frames.add(id);
      return id;
    },
    guard(callback) {
      const owner = generation;
      return (...args) => {
        if (active && generation === owner) return callback(...args);
      };
    },
    get active() { return active; },
    get generation() { return generation; },
  };
  return api;
}
