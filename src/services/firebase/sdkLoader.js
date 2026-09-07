const SDK_BASE = 'https://www.gstatic.com/firebasejs/9.22.1';
let sdkPromise = null;

function loadScript(src, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing?.dataset.loaded === '1') return resolve();
    const script = existing || document.createElement('script');
    const fail = message => {
      script.onload = script.onerror = null;
      script.remove();
      reject(new Error(message));
    };
    const timer = setTimeout(() => fail(`Firebase SDK timeout: ${src}`), timeoutMs);
    script.onload = () => {
      clearTimeout(timer);
      script.dataset.loaded = '1';
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timer);
      fail(`Firebase SDK load failed: ${src}`);
    };
    if (!existing) {
      script.src = src;
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

export function loadFirebaseSdk() {
  if (globalThis.firebase?.auth && globalThis.firebase?.firestore) return Promise.resolve();
  if (!sdkPromise) {
    sdkPromise = loadScript(`${SDK_BASE}/firebase-app-compat.js`)
      .then(() => Promise.all([
        loadScript(`${SDK_BASE}/firebase-auth-compat.js`),
        loadScript(`${SDK_BASE}/firebase-firestore-compat.js`),
      ]))
      .catch(error => {
        sdkPromise = null;
        throw error;
      });
  }
  return sdkPromise;
}
