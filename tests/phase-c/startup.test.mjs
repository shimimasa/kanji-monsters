import test from 'node:test';
import assert from 'node:assert/strict';

test('startup loads only the title logo before becoming interactive', async () => {
  const originalImage = globalThis.Image;
  globalThis.Image = class {
    set src(value) {
      this._src = value;
      queueMicrotask(() => this.onload?.());
    }
  };
  try {
    const { images, loadStartupImages } = await import('../../src/loaders/assetsLoader.js');
    let finalProgress = null;
    await loadStartupImages((loaded, total) => { finalProgress = [loaded, total]; });
    assert.deepEqual(finalProgress, [1, 1]);
    assert.equal(Object.keys(images).length, 1);
  } finally {
    globalThis.Image = originalImage;
  }
});

test('simultaneous full-data requests share one in-flight load', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => new Promise(() => {});
  try {
    const { loadAllGameData } = await import('../../src/loaders/dataLoader.js');
    const first = loadAllGameData();
    const second = loadAllGameData();
    assert.strictEqual(first, second);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('an existing validated local save does not wait for the cloud SDK', async () => {
  const { installStorage } = await import('../phase-a/storage-helper.mjs');
  const { getDefaultSave } = await import('../../src/core/saveData.js');
  const { initializeSaveSession } = await import('../../src/core/saveBootstrap.js');
  installStorage({ krb_save: JSON.stringify(getDefaultSave()) });
  let recoveryCalled = false;
  const result = await initializeSaveSession(async () => {
    recoveryCalled = true;
    await new Promise(() => {});
  });
  assert.equal(result.ok, true);
  assert.equal(recoveryCalled, false);
});
