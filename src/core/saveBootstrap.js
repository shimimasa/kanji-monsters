import { readSaveState, hasLegacySave } from './saveData.js';
import { loadGameData } from './gameState.js';

export async function initializeSaveSession(recover, { recoverCorrupt = false, isCurrent = () => true } = {}) {
  if (!isCurrent()) return { ok: false, stale: true };
  const before = readSaveState();
  const explicitRecovery = recoverCorrupt && before.status === 'corrupt';
  if (!['valid', 'missing'].includes(before.status) && !explicitRecovery) return { ok: false, error: before.error };
  if (before.status === 'missing' && hasLegacySave()) {
    if (!await loadGameData()) return { ok: false, error: new Error('旧セーブを安全に移行できませんでした') };
  }
  if (before.status === 'missing' || explicitRecovery) {
    try { await recover(); }
    catch (error) {
      // Existing local data remains playable offline. A missing save cannot be
      // treated as a new child until the recovery check has completed.
      if (readSaveState().status !== 'valid') return { ok: false, error };
    }
  }
  if (!isCurrent()) return { ok: false, stale: true };
  const ok = await loadGameData();
  return { ok, error: ok ? null : new Error('保存データを安全に読み込めませんでした') };
}
