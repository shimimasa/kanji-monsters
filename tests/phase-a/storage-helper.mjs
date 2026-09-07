export class MemoryStorage {
  constructor(entries = {}) { this.data = new Map(Object.entries(entries)); this.fail = null; }
  get length() { return this.data.size; }
  key(index) { return [...this.data.keys()][index] ?? null; }
  getItem(key) { this.fail?.('get', key); return this.data.get(String(key)) ?? null; }
  setItem(key, value) { this.fail?.('set', key, String(value)); this.data.set(String(key), String(value)); }
  removeItem(key) { this.fail?.('remove', key); this.data.delete(String(key)); }
  clear() { this.data.clear(); }
}

export function quota() { return new DOMException('Injected storage failure', 'QuotaExceededError'); }

export function installStorage(entries = {}) {
  const storage = new MemoryStorage(entries);
  globalThis.localStorage = storage;
  return storage;
}
