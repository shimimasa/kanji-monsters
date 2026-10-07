// Run after entering ゴトモンのおねがい in the dedicated CDP browser.
// Check that looking at a shelf card is safe and that delivery is a separate action.
const pages = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = pages.find(item => item.type === 'page' && item.url.includes('4173'));
if (!page) throw new Error('CDP preview page not found');
const ws = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
let id = 0;
ws.onmessage = event => {
  const message = JSON.parse(event.data);
  if (pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
};
await new Promise(resolve => { ws.onopen = resolve; });
const send = (method, params = {}) => new Promise(resolve => {
  const requestId = ++id;
  pending.set(requestId, resolve);
  ws.send(JSON.stringify({ id: requestId, method, params }));
});
const read = async expression => {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true });
  if (response.result?.exceptionDetails) throw new Error('Browser evaluation failed');
  return response.result?.result?.value;
};
const touch = process.argv.includes('--touch');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
if (touch) {
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await sleep(1500);
} else {
  await send('Emulation.clearDeviceMetricsOverride');
  await send('Emulation.setTouchEmulationEnabled', { enabled: false });
  await sleep(300);
}
const center = selector => read(`(() => {
  const element = document.querySelector(${JSON.stringify(selector)});
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return [rect.x + rect.width / 2, rect.y + rect.height / 2];
})()`);
const state = () => read(`({
  progress:document.querySelector('#gotomonShopScreen .ya-progress')?.textContent,
  points:document.querySelector('#gotomonShopScreen .ya-score')?.textContent,
  selected:[...document.querySelectorAll('#gotomonShopScreen .gs-kanji[data-selected=true]')].map(node=>node.textContent),
  shelfReady:!!document.querySelector('#gotomonShopScreen .gs-kanji:not(:disabled)'),
  note:document.querySelector('#gotomonShopScreen .ya-dock-note')?.textContent,
  overflow:document.documentElement.scrollWidth>innerWidth,
  saveEqual:localStorage.getItem('krb_save')===localStorage.getItem('yomitabi_confirmed_1')
})`);
const tap = async point => {
  if (!point) throw new Error('Tap target not found');
  const [x, y] = point;
  if (touch) {
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await sleep(90);
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  }
  await sleep(180);
};
const drag = async (from, to) => {
  if (!from || !to) throw new Error('Drag endpoint not found');
  const [startX, startY] = from, [endX, endY] = to;
  if (touch) await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y: startY, id: 1 }] });
  else {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: startX, y: startY });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: startX, y: startY, button: 'left', clickCount: 1 });
  }
  for (let step = 1; step <= 10; step++) {
    const x = startX + (endX - startX) * step / 10;
    const y = startY + (endY - startY) * step / 10;
    if (touch) await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] });
    else await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 });
    await sleep(15);
  }
  if (touch) await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  else await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: endX, y: endY, button: 'left', clickCount: 1 });
  await sleep(180);
};
try {
  const before = await state();
  if (!before.shelfReady) throw new Error('Shop is not answering');
  const first = '#gotomonShopScreen .gs-kanji';
  await tap(await center(first));
  const selected = await state();
  if (selected.selected.length !== 1 || selected.progress !== before.progress || selected.points !== before.points) {
    throw new Error('Selecting a card changed the answer or score');
  }
  await tap(await center(first));
  const cleared = await state();
  if (cleared.selected.length || cleared.progress !== before.progress) throw new Error('Card selection did not clear');
  await drag(await center(first), await center('#gotomonShopScreen .gs-title'));
  const outside = await state();
  if (!outside.shelfReady || outside.progress !== before.progress || outside.points !== before.points) {
    throw new Error('A card released outside a customer answered');
  }
  await drag(await center(first), await center('#gotomonShopScreen .gs-customer:not([data-focus=true])'));
  const delivered = await state();
  if (delivered.shelfReady || delivered.note === outside.note) throw new Error('Card delivery did not answer');
  if (delivered.overflow || !delivered.saveEqual) throw new Error('Layout overflow or save keys differ');
  console.log(JSON.stringify({ touch, before, selected, outside, delivered }));
} finally {
  ws.close();
}
