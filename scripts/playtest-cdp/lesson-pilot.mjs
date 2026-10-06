// Real pointer playthrough for the two Gotomon lesson prototypes.
// Usage: node scripts/playtest-cdp/lesson-pilot.mjs 390 844 [screenshot-directory] [--parent]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const [widthArg = '1280', heightArg = '800', shotDir] = process.argv.slice(2);
const width = Number(widthArg), height = Number(heightArg);
const parentMode = process.argv.includes('--parent');
const pages = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = pages.find(tab => tab.type === 'page');
assert.ok(page, 'Chrome の CDP ページが必要');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(resolve => { socket.onopen = resolve; });
let nextId = 0;
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId;
  const onMessage = event => {
    const message = JSON.parse(event.data);
    if (message.id !== id) return;
    socket.removeEventListener('message', onMessage);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  };
  socket.addEventListener('message', onMessage);
  socket.send(JSON.stringify({ id, method, params }));
});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const evaluate = async expression => {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
};
const gameEvaluate = expression => evaluate(`(() => {
  const d = ${parentMode ? "document.querySelector('.yt-lesson-frame')?.contentDocument" : 'document'};
  return (${expression});
})()`);
const tap = async (selector, index = 0, inGame = true) => {
  const point = await evaluate(`(() => {
    const d = ${parentMode && inGame ? "document.querySelector('.yt-lesson-frame')?.contentDocument" : 'document'};
    const element = d?.querySelectorAll(${JSON.stringify(selector)})[${index}];
    if (!element) return null;
    element.scrollIntoView({ block: 'center' });
    const box = element.getBoundingClientRect();
    const frame = ${parentMode && inGame ? "document.querySelector('.yt-lesson-frame')?.getBoundingClientRect()" : 'null'};
    return { x: (frame?.left || 0) + box.left + box.width / 2,
      y: (frame?.top || 0) + box.top + box.height / 2 };
  })()`);
  assert.ok(point, `タップ先がない: ${selector}[${index}]`);
  await sleep(120);
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type, x: point.x, y: point.y, button: 'left', clickCount: 1 });
    await sleep(80);
  }
};
const assertLayout = async slug => {
  const status = await gameEvaluate(`({ width: d.defaultView.innerWidth, scroll: d.documentElement.scrollWidth,
    broken: [...d.images].filter(image => !image.complete || image.naturalWidth === 0).map(image => image.src) })`);
  assert.ok(status.scroll <= status.width, `${slug}: 横はみ出し ${status.scroll} > ${status.width}`);
  assert.deepEqual(status.broken, [], `${slug}: 画像の読み込み`);
};
const screenshot = async name => {
  if (!shotDir) return;
  fs.mkdirSync(shotDir, { recursive: true });
  const response = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(shotDir, `${name}-${width}x${height}.png`), Buffer.from(response.data, 'base64'));
};

await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width <= 600 });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
const routes = [
  { slug: 'kururu', choices: [[0, 2], [0, 1], [0, 1], [0, 1], [0, 2]], required: [2, 2, 2, 2, 1] },
  { slug: 'hitotsubu', choices: [[0, 1, 2], [0, 1, 2, 3], [0, 1], [0, 1], [1]], required: [3, 4, 2, 2, 1] },
];

for (const route of routes) {
  await send('Page.navigate', { url: parentMode ? 'http://localhost:4173/' : `http://localhost:4173/lessons/gotomon/${route.slug}.html` });
  await sleep(1200);
  if (parentMode) {
    await tap('#titleMiniGameButton', 0, false);
    await sleep(500);
    await tap(`.yt-lesson-card[data-lesson-slug="${route.slug}"]`, 0, false);
    await sleep(500);
    assert.equal(await evaluate("document.querySelector('.yt-lesson-frame')?.contentDocument?.body?.dataset?.lesson"), route.slug);
  }
  await assertLayout(route.slug);
  await tap('.lesson-intro button');
  for (let stage = 0; stage < 5; stage++) {
    assert.equal(await gameEvaluate("d.querySelector('.lesson-next')?.disabled"), true);
    for (let choice = 0; choice < route.choices[stage].length; choice++) {
      await tap('.lesson-choice', route.choices[stage][choice]);
      if (route.slug === 'kururu' && stage === 4 && choice === 0) {
        assert.equal(await gameEvaluate("d.querySelector('.lesson-next')?.disabled"), true);
        await tap('.lesson-stage-footer button:not(.lesson-next)');
        assert.match(await gameEvaluate("d.querySelector('.lesson-hint')?.textContent"), /クルル/);
      }
      if (choice + 1 < route.required[stage]) {
        assert.equal(await gameEvaluate("d.querySelector('.lesson-next')?.disabled"), true);
      }
    }
    assert.equal(await gameEvaluate("d.querySelector('.lesson-next')?.disabled"), false);
    await assertLayout(route.slug);
    if (stage === 0 || stage === 4) await screenshot(`${route.slug}-stage-${stage + 1}`);
    if (route.slug === 'hitotsubu' && stage === 4) {
      assert.match(await gameEvaluate("d.querySelector('.lesson-observation')?.textContent"), /橋 2票・市場 2票・案内板 1票/);
    }
    await tap('.lesson-next');
    assert.equal(await gameEvaluate("d.querySelector('.lesson-stars')?.textContent || ''"), stage === 4 ? '★ ★ ★ ★ ★' : '');
  }
  await assertLayout(route.slug);
  await screenshot(`${route.slug}-summary`);
  await tap('.lesson-finish');
  assert.equal(await gameEvaluate("d.querySelector('.lesson-finish')?.disabled"), true);
  if (parentMode) {
    const saved = await evaluate(`(() => {
      const a = localStorage.getItem('krb_save'), b = localStorage.getItem('yomitabi_confirmed_1');
      return { same: a === b, ids: JSON.parse(a).player.collection.gotomonIds,
        result: document.querySelector('.yt-lesson-result')?.textContent };
    })()`);
    assert.equal(saved.same, true);
    assert.equal(saved.ids.filter(id => id === (route.slug === 'kururu' ? 'EL-001' : 'EL-002')).length, 1);
    assert.match(saved.result, /なかまになったよ/);
  }
  console.log(`${route.slug}: 5場面を実タップ、横はみ出し0、画像読込OK、まとめ到達${parentMode ? '・捕獲保存OK' : ''}`);
}
socket.close();
