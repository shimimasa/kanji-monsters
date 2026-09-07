import { readSaveState } from '/__experiment/save-validator.js';
const status = document.querySelector('#status');
let info, proof, stopped = false;
const canonical = entries => JSON.stringify(Object.fromEntries(Object.entries(entries).sort(([a],[b]) => a.localeCompare(b,'en'))));
const hash = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))), b=>b.toString(16).padStart(2,'0')).join('');
function stop(error) {
  stopped = true; status.className = 'stop'; status.textContent += '\nSTOP: ' + error.message + '\n削除や上書きをせず、新規profile/sessionを使ってください。';
  document.querySelectorAll('button').forEach(b => b.disabled = true);
}
async function inventory() {
  if (!indexedDB.databases || !navigator.serviceWorker || !window.caches) throw Error('保存領域の検査APIが不足');
  return { localKeys: Object.keys(localStorage), sessionKeys: Object.keys(sessionStorage),
    databases: await indexedDB.databases(), caches: await caches.keys(),
    controller: navigator.serviceWorker.controller?.scriptURL ?? null,
    registrations: (await navigator.serviceWorker.getRegistrations()).map(r => r.scope), firebase: typeof globalThis.firebase };
}
function requireEmpty(i) {
  if (i.localKeys.length || i.sessionKeys.length || i.databases.length || i.caches.length || i.controller || i.registrations.length || i.firebase !== 'undefined') throw Error('既存Storage / SW / Firebase状態を検出');
}
async function request(route, body) {
  const response = await fetch('/__experiment/' + route, body === undefined ? {} : { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body) });
  if (!response.ok) throw Error(route + ' failed: ' + response.status);
  return response;
}
try {
  const response = await request('info');
  info = await response.json();
  const csp = response.headers.get('Content-Security-Policy');
  if (!csp?.includes("connect-src 'self'") || response.headers.get('X-Yomitabi-E0') !== info.role || location.origin !== info.origin) throw Error('実験header/origin不一致');
  const initial = await inventory(); requireEmpty(initial);
  status.textContent = JSON.stringify({ ...info, csp, storage: initial }, null, 2);
  document.querySelector('#isolation').disabled = false;
} catch (e) { stop(e); }
document.querySelector('#isolation').onclick = async () => {
  try {
    if (stopped || !document.querySelector('#profile-confirm').checked) throw Error('専用profileの確認が必要');
    requireEmpty(await inventory());
    const same = await request('ping');
    const violations = [];
    const listen = event => violations.push({ blockedURI:event.blockedURI, directive:event.effectiveDirective, disposition:event.disposition });
    document.addEventListener('securitypolicyviolation', listen);
    let refused = false;
    try { await fetch(info.receiver + '/canary'); } catch { refused = true; }
    await new Promise(resolve => setTimeout(resolve, 100));
    document.removeEventListener('securitypolicyviolation', listen);
    const receiver = await (await request('receiver-status')).json();
    if (!same.ok || !refused || receiver.received !== 0 || !violations.some(v=>v.directive === 'connect-src' && v.disposition === 'enforce')) throw Error('CSP遮断の実証に失敗');
    proof = { sameOrigin: same.status, refused, violations, receiver };
    await request('preflight', proof);
    status.textContent += '\n通信検査 PASS\n' + JSON.stringify(proof, null, 2);
    document.querySelector('#seed').disabled = false;
  } catch(e) { stop(e); }
};
document.querySelector('#seed').onclick = async () => {
  try {
    if (stopped || !proof) throw Error('通信検査が未完了');
    requireEmpty(await inventory());
    const fixture = await (await request('fixture')).json();
    if (await hash(canonical(fixture.entries)) !== info.fixtureHash || fixture.manifest.fixtureHash !== info.fixtureHash) throw Error('fixture hash不一致');
    // Check again immediately before the synchronous write batch. Never clear/overwrite.
    requireEmpty(await inventory());
    for (const [k,v] of Object.entries(fixture.entries)) {
      if (localStorage.getItem(k) !== null) throw Error('既存keyを検出');
      localStorage.setItem(k,v);
    }
    const actual = Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)]));
    if (canonical(actual) !== canonical(fixture.entries) || await hash(canonical(actual)) !== info.fixtureHash) throw Error('readback不一致');
    if (readSaveState().status !== 'valid') throw Error('既存APIのvalid判定失敗');
    const after = Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)]));
    if (canonical(after) !== canonical(actual)) throw Error('validationでStorage変化');
    await request('arm', { fixtureHash: info.fixtureHash, keyCount:Object.keys(actual).length, valid:true });
    status.textContent += '\n架空fixture全key readback / hash / valid PASS。ゲーム起動可能。';
    document.querySelectorAll('button').forEach(b=>b.disabled=true);
    document.querySelector('#play').hidden = false;
  } catch(e) { stop(e); }
};
