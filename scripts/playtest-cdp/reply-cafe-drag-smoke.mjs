// With おへんじカフェ already playing in the dedicated CDP browser, check
// that only a reply dropped on the conversation (or tapped) commits an answer.
const pages = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = pages.find(item => item.type === 'page' && item.url.includes('4173'));
if (!page) throw new Error('CDP preview page not found');
const ws = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
let id = 0;
ws.onmessage = event => {
  const message = JSON.parse(event.data);
  if (pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
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
if (touch) {
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await new Promise(resolve => setTimeout(resolve, 1500));
}
const center = async selector => read(`(() => {
  const element = document.querySelector(${JSON.stringify(selector)});
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return [rect.x + rect.width / 2, rect.y + rect.height / 2];
})()`);
const collection = () => read("document.querySelector('#replyCafeScreen .be-collection')?.textContent");
const drag = async (from, to) => {
  if (!from || !to) throw new Error('Reply or destination not found');
  const [startX, startY] = from, [endX, endY] = to;
  if (touch) await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y: startY, id: 1 }] });
  else {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: startX, y: startY });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: startX, y: startY, button: 'left', clickCount: 1 });
  }
  for (let step = 1; step <= 8; step++) {
    const x = startX + (endX - startX) * step / 8;
    const y = startY + (endY - startY) * step / 8;
    if (touch) await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] });
    else await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 });
  }
  if (touch) await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  else await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: endX, y: endY, button: 'left', clickCount: 1 });
  await new Promise(resolve => setTimeout(resolve, 200));
};
const tap = async point => {
  if (!point) throw new Error('Tap target not found');
  const [x, y] = point;
  if (touch) {
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await new Promise(resolve => setTimeout(resolve, 100));
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  }
  await new Promise(resolve => setTimeout(resolve, 200));
};
try {
  const before = await collection();
  if (before === undefined) throw new Error('おへんじカフェ is not playing');
  await drag(await center('#replyCafeScreen .be-option'), await center('#replyCafeScreen .be-question'));
  const afterOutside = await collection();
  if (afterOutside !== before) throw new Error('A reply released outside the conversation answered');
  await drag(await center('#replyCafeScreen .be-option'), await center('#replyCafeScreen .be-art'));
  const afterDrop = await collection();
  const reply = await read("document.querySelector('#replyCafeScreen .be-cafe-reply')?.textContent");
  if (afterDrop === before || reply !== 'Hello!') throw new Error('A reply dropped on the conversation did not answer');
  await new Promise(resolve => setTimeout(resolve, 500));
  await tap(await center('#replyCafeScreen .be-next'));
  await new Promise(resolve => setTimeout(resolve, 500));
  await tap(await center('#replyCafeScreen .be-option'));
  const afterTap = await collection();
  if (afterTap === afterDrop) throw new Error('Tapping a reply did not answer');
  const layout = await read("({overflow:document.documentElement.scrollWidth>innerWidth,saveEqual:localStorage.getItem('krb_save')===localStorage.getItem('yomitabi_confirmed_1')})");
  if (layout.overflow || !layout.saveEqual) throw new Error('Layout overflow or save keys differ');
  console.log(JSON.stringify({ touch, before, afterOutside, afterDrop, afterTap, reply, ...layout }));
} finally {
  ws.close();
}
