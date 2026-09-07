import { syncAllCaches, startDataSync } from './firebaseController.js';

/**
 * ローカルとリモートのID配列を、順序を保ったまま和集合にする。
 * @param {string|null} localRaw localStorage の生の値（JSON配列を想定）
 * @param {unknown} remote Firestore 側の値
 * @returns {string[]}
 */
export function mergeAdditiveIds(localRaw, remote) {
  let local = [];
  try {
    const parsed = localRaw ? JSON.parse(localRaw) : [];
    if (Array.isArray(parsed)) local = parsed.filter(x => typeof x === 'string');
  } catch {}
  const rem = Array.isArray(remote) ? remote.filter(x => typeof x === 'string') : [];
  return [...new Set([...local, ...rem])];
}

// The legacy listener must never overwrite the canonical queue behind gameState.
const DataSync = {
  initialize: () => startDataSync(),
  syncAll: () => syncAllCaches()
};
export default DataSync;
