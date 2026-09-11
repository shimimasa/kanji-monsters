import { isSaveSessionReady } from '../core/gameState.js';
import { captureSaveContext } from '../core/saveData.js';

export function ownedIdsFromSnapshot(save) {
  const ids = save?.player?.collection?.gotomonIds;
  return Object.freeze(Array.isArray(ids) ? [...new Set(ids.filter(id => typeof id === 'string'))] : []);
}

// captureSaveContext is read-only. Do not call readSaveState here: it can recover
// a pending Storage transaction. Hydration/confirmation belongs to the existing app.
export function readActiveCollection({ ready = isSaveSessionReady, capture = captureSaveContext } = {}) {
  try {
    if (!ready()) return Object.freeze([]);
    const context = capture();
    const [, , raw] = JSON.parse(context);
    if (!ready() || capture() !== context || !raw) return Object.freeze([]);
    return ownedIdsFromSnapshot(JSON.parse(raw));
  } catch { return Object.freeze([]); }
}
