// Pointer playthrough of both redesigned lessons. Use only with the dedicated Chrome on port 9333.
// node scripts/playtest-cdp/lesson-v2-playtest.mjs 390 844 [--parent] [--shots]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const width = Number(process.argv[2] || 1280), height = Number(process.argv[3] || 800);
const parentMode = process.argv.includes('--parent');
const saveShots = process.argv.includes('--shots');
const pages = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = pages.find(item => item.type === 'page');
assert.ok(page);
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(resolve => { socket.onopen = resolve; });
let id = 0;
const browserExceptions = [];
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.exceptionThrown') browserExceptions.push(message.params?.exceptionDetails?.text || 'browser exception');
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const requestId = ++id;
  const listener = event => {
    const message = JSON.parse(event.data);
    if (message.id !== requestId) return;
    socket.removeEventListener('message', listener);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  };
  socket.addEventListener('message', listener);
  socket.send(JSON.stringify({ id: requestId, method, params }));
});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const evalPage = async expression => {
  const output = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (output.exceptionDetails) throw new Error(output.exceptionDetails.text);
  return output.result.value;
};
const inGame = expression => evalPage(`(() => { const d = ${parentMode ? "document.querySelector('.yt-lesson-frame')?.contentDocument" : 'document'}; return (${expression}); })()`);
const tap = async (selector, index = 0, game = true) => {
  const point = await evalPage(`(() => {
    const d = ${parentMode && game ? "document.querySelector('.yt-lesson-frame')?.contentDocument" : 'document'};
    const el = d?.querySelectorAll(${JSON.stringify(selector)})[${index}];
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const box = el.getBoundingClientRect();
    const frame = ${parentMode && game ? "document.querySelector('.yt-lesson-frame')?.getBoundingClientRect()" : 'null'};
    return { x: box.left + box.width / 2 + (frame?.left || 0), y: box.top + box.height / 2 + (frame?.top || 0) };
  })()`);
  assert.ok(point, `tap target: ${selector}[${index}]`);
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type, x: point.x, y: point.y, button: 'left', clickCount: 1 });
    await sleep(60);
  }
};
const layout = async () => {
  const result = await inGame(`({ width: d.defaultView.innerWidth, scroll: d.documentElement.scrollWidth,
    broken: [...d.images].filter(image => !image.complete || !image.naturalWidth).map(image => image.src),
    title: d.querySelector('h1')?.textContent })`);
  assert.ok(result.scroll <= result.width, `${result.title}: ${result.scroll} > ${result.width}`);
  assert.deepEqual(result.broken, []);
};
const shot = async name => {
  if (!saveShots) return;
  const output = await send('Page.captureScreenshot', { format: 'png' });
  const folder = path.resolve('docs/lesson-pilot');
  fs.writeFileSync(path.join(folder, `${name}-${width}x${height}.png`), Buffer.from(output.data, 'base64'));
};
const next = async () => {
  assert.equal(await inGame("d.querySelector('.lgv-next')?.disabled"), false);
  await layout();
  await tap('.lgv-next');
};

await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width <= 600 });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Runtime.enable');

for (const slug of ['kururu', 'hitotsubu']) {
  browserExceptions.length = 0;
  await send('Page.navigate', { url: parentMode ? 'http://localhost:4173/' : `http://localhost:4173/lessons/gotomon/${slug}.html` });
  await sleep(1200);
  if (parentMode) {
    await tap('#titleMiniGameButton', 0, false);
    await sleep(450);
    await tap(`.yt-lesson-card[data-lesson-slug="${slug}"]`, 0, false);
    await sleep(500);
  }
  assert.ok(await inGame("d.querySelector('.lgv-intro')"));
  await layout();
  await tap('.lgv-intro .lgv-primary');
  if (slug === 'kururu') {
    for (let i = 0; i < 3; i++) await tap('.lgv-wheel');
    await tap('.lgv-segments .lgv-option', 2);
    for (let i = 0; i < 3; i++) await tap('.lgv-wheel');
    await shot('kururu-v2-crank'); await next();

    await tap('.lgv-controls .lgv-action', 0); await tap('.lgv-controls .lgv-action', 1);
    await tap('.lgv-segments .lgv-option', 1);
    await tap('.lgv-controls .lgv-action', 0); await tap('.lgv-controls .lgv-action', 1);
    await next();

    for (let i = 0; i < 4; i++) await tap('.lgv-controls .lgv-action');
    assert.match(await inGame("d.querySelector('.lgv-note').textContent"), /まだ光っている/);
    await shot('kururu-v2-compare'); await next();

    await tap('.lgv-controls .lgv-action');
    await tap('.lgv-segments .lgv-option', 1);
    await tap('.lgv-controls .lgv-action');
    await next();

    await tap('.lgv-controls .lgv-action');
    await tap('.lgv-controls .lgv-segments:nth-of-type(2) .lgv-option', 1);
    await tap('.lgv-controls .lgv-segments:nth-of-type(3) .lgv-option', 1);
    await tap('.lgv-controls .lgv-action');
    assert.match(await inGame("d.querySelector('.lgv-simulation').textContent"), /4目盛 光った/);
    await shot('kururu-v2-final'); await next();
  } else {
    for (let i = 0; i < 3; i++) { await tap('.lgv-place', i); await tap('.lgv-visit .lgv-action'); }
    await shot('hitotsubu-v2-village'); await next();

    for (let i = 0; i < 4; i++) await tap('.lgv-history-years .lgv-option', i);
    await next();

    await tap('.lgv-controls .lgv-option', 0);
    await tap('.lgv-controls .lgv-option', 2);
    await tap('.lgv-controls .lgv-action');
    assert.match(await inGame("d.querySelector('.lgv-note').textContent"), /見えそう/);
    await tap('.lgv-controls .lgv-option', 1);
    await tap('.lgv-controls .lgv-action');
    await next();

    await tap('.lgv-controls .lgv-option', 0);
    await tap('.lgv-controls .lgv-option', 1);
    await shot('hitotsubu-v2-turnout'); await next();

    await tap('.lgv-ballot-choice', 1);
    await tap('.lgv-controls .lgv-action');
    await tap('.lgv-controls .lgv-option', 2);
    await shot('hitotsubu-v2-vote'); await next();
  }
  assert.equal(await inGame("d.querySelector('.lgv-stars')?.textContent"), '★ ★ ★ ★ ★');
  await layout();
  await tap('.lgv-finish');
  if (parentMode) {
    const saved = await evalPage(`(() => { const a = localStorage.getItem('krb_save'); const b = localStorage.getItem('yomitabi_confirmed_1');
      return { same: a === b, ids: JSON.parse(a).player.collection.gotomonIds, result: document.querySelector('.yt-lesson-result')?.textContent }; })()`);
    assert.equal(saved.same, true);
    assert.equal(saved.ids.filter(id => id === (slug === 'kururu' ? 'EL-001' : 'EL-002')).length, 1);
    assert.match(saved.result, /なかまになったよ/);
  }
  assert.deepEqual(browserExceptions, [], `${slug}: browser exception`);
  console.log(`${slug}: 5場面を実タップ、横はみ出し0、画像読込OK、例外0、まとめ到達${parentMode ? '・捕獲保存OK' : ''}`);
}
socket.close();
