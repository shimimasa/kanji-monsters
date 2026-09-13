import { saveNow } from '../../src/core/saveData.js';
import { readFileSync } from 'node:fs';

// Synthetic operations fixture, not a child's save and not another ownership source.
export const INITIAL_SAVE_ID = 'child-playtest-candidate-1-initial-v1';
export function initialSave() {
  return JSON.parse(readFileSync(new URL('./CHILD_PLAYTEST_INITIAL_SAVE.json', import.meta.url), 'utf8'));
}

// Run the existing save transaction/projection in isolated in-memory Storage.
// Never read or modify a real browser profile. Browser launch uses these entries
// only in a brand-new owned context, once, before the game loads.
export function initialStorage() {
  if ('localStorage' in globalThis) throw new Error('Fixture generation requires an isolated Node process');
  const entries = new Map();
  globalThis.localStorage = {
    get length() { return entries.size; }, key: i => [...entries.keys()][i] ?? null,
    getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, String(value)),
    removeItem: key => entries.delete(key),
  };
  try {
    const result = saveNow(initialSave(), { extraEntries: { yomitabi_slot: '1', bgmVolume: '0.2', seVolume: '0.3' } });
    if (!result.ok) throw result.error;
    return Object.fromEntries(entries);
  } finally { delete globalThis.localStorage; }
}

export async function newInitialContext(browser, { viewport = { width: 390, height: 844 } } = {}) {
  const entries = initialStorage();
  const context = await browser.newContext({ viewport, acceptDownloads: true, serviceWorkers: 'block' });
  // No Firebase login, analytics, remote navigation or account traffic in the pilot.
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === 'http://127.0.0.1:5181' ? route.continue() : route.abort();
  });
  await context.addInitScript(entries => {
    if (location.origin !== 'http://127.0.0.1:5181' || sessionStorage.getItem('candidate-initial-loaded')) return;
    if (localStorage.length) throw new Error('Initial save requires empty isolated Storage');
    for (const [key,value] of Object.entries(entries)) localStorage.setItem(key,value);
    sessionStorage.setItem('candidate-initial-loaded','1');
  }, entries);
  return context;
}
