import { potatoVisual } from './monsterVisualManifest.js';
import { readGLB, verifyGLBHash, validateContainer } from './glbValidation.js';

// All asynchronous work belongs to this early, synchronously returned handle.
export function createGLBPreparation({ scene, activate, materialReady, onFailure,
  isCurrent = () => true, spec = potatoVisual, fetchBytes = defaultFetch,
  loadParser = () => import('./glbParser.js'), verifyHash = verifyGLBHash,
  validate = validateContainer, deadlineMs = 10000, timers = globalThis,
}) {
  let disposed = false, ready = false, phase = 'pending', container = null, operation = null, result = null;
  let deadline, poll, cancel, requests = 0;
  const controller = new AbortController();
  const cancelled = new Promise((_, reject) => { cancel = () => reject(new Error('Visual preparation cancelled')); });
  // cancellation is also safe before the asynchronous task reaches its first await.
  cancelled.catch(() => {});
  const current = () => !disposed && isCurrent();
  const guard = () => { if (!current()) throw new Error('Stale visual session'); };
  const wait = promise => Promise.race([promise, cancelled]);
  const clearTimers = () => { timers.clearTimeout(deadline); timers.clearTimeout(poll); deadline = poll = null; };
  const dispose = () => {
    if (disposed) return;
    disposed = true; ready = false; phase = 'disposed'; clearTimers(); controller.abort(); cancel(); requests = 0;
    try { operation?.dispose(); } finally {
      operation = null;
      if (container) { const old = container; container = null; old.dispose(); }
      result = null;
    }
  };
  const fail = error => {
    if (disposed) return;
    try { dispose(); } finally { onFailure(error); }
  };
  deadline = timers.setTimeout(() => fail(new Error('GLB visual deadline exceeded')), deadlineMs);
  const promise = Promise.resolve().then(async () => {
    guard(); phase = 'fetch'; requests = 1;
    const bytes = await wait(fetchBytes(spec.url, controller.signal)); requests = 0; guard();
    phase = 'header'; const data = readGLB(bytes, spec);
    phase = 'hash'; await wait(verifyHash(bytes, spec)); guard();
    phase = 'loader'; const module = await wait(loadParser()); guard();
    phase = 'parse'; operation = module.parseGLBAsset(scene, data);
    // Attach cleanup to the underlying parse, not only to the cancellable race.
    const loaded = operation.promise.then(value => {
      if (!current()) { value.dispose(); throw new Error('Late GLB disposed'); }
      container = value; return value;
    });
    await wait(loaded); guard(); phase = 'validate';
    result = validate(container, spec); guard(); phase = 'material';
    while (!materialReady(result)) {
      await wait(new Promise(resolve => { poll = timers.setTimeout(() => { poll = null; resolve(); }, 16); }));
      guard();
    }
    guard(); activate(container, result); guard();
    clearTimers(); ready = true; phase = 'ready'; return true;
  }).catch(error => { if (!disposed) fail(error); return false; });
  return { promise, dispose, get ready() { return ready && current(); }, get asset() { return result; },
    resources: () => ({ phase, requests, deadlines: deadline == null ? 0 : 1, polls: poll == null ? 0 : 1,
      containers: container ? 1 : 0, loaderObservers: operation?.resources().observers || 0 }) };
}

async function defaultFetch(url, signal) {
  const response = await fetch(url, { signal, credentials: 'same-origin' });
  if (!response.ok) throw new Error(`GLB HTTP ${response.status}`);
  if ((response.headers.get('content-type') || '').includes('text/html')) throw new Error('GLB HTML rewrite');
  return new Uint8Array(await response.arrayBuffer());
}
