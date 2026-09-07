// A multi-key Storage update is not atomic. Keep the exact preimage until every
// write succeeds; a failed rollback remains recoverable on the next launch.
export const STORAGE_JOURNAL_KEY = 'yomitabi_phase_a_pending';

function applyEntries(entries) {
  for (const [key, value] of Object.entries(entries)) {
    if (value !== null && localStorage.getItem(key) !== value) localStorage.setItem(key, value);
  }
  for (const [key, value] of Object.entries(entries)) {
    if (value === null && localStorage.getItem(key) !== null) localStorage.removeItem(key);
  }
  for (const [key, value] of Object.entries(entries)) {
    if (localStorage.getItem(key) !== value) throw new Error('Storage verification failed');
  }
}

export function recoverStorageTransaction() {
  try {
    const raw = localStorage.getItem(STORAGE_JOURNAL_KEY);
    if (raw === null) return { ok: true, recovered: false };
    const journal = JSON.parse(raw);
    if (journal?.version !== 1 || !journal.before || Array.isArray(journal.before) ||
        typeof journal.before !== 'object' || Object.hasOwn(journal.before, STORAGE_JOURNAL_KEY) ||
        Object.values(journal.before).some(v => v !== null && typeof v !== 'string')) {
      throw new Error('Unrecognized Storage recovery record');
    }
    applyEntries(journal.before);
    localStorage.removeItem(STORAGE_JOURNAL_KEY);
    return { ok: true, recovered: true };
  } catch (error) { return { ok: false, error }; }
}

export function writeStorageTransaction(entries) {
  const recovery = recoverStorageTransaction();
  if (!recovery.ok) return recovery;
  let journalWritten = false;
  try {
    if (Object.hasOwn(entries, STORAGE_JOURNAL_KEY) ||
        Object.values(entries).some(v => v !== null && typeof v !== 'string')) {
      throw new Error('Invalid Storage transaction');
    }
    const before = Object.fromEntries(Object.keys(entries).map(key => [key, localStorage.getItem(key)]));
    if (Object.keys(entries).every(key => entries[key] === before[key])) return { ok: true };
    localStorage.setItem(STORAGE_JOURNAL_KEY, JSON.stringify({ version: 1, before }));
    journalWritten = true;
    applyEntries(entries);
    localStorage.removeItem(STORAGE_JOURNAL_KEY);
    return { ok: true };
  } catch (error) {
    const rollback = journalWritten ? recoverStorageTransaction() : { ok: true };
    return { ok: false, error, recoveryRequired: !rollback.ok };
  }
}
