// With ABCポスト already playing in the dedicated CDP browser, verify that
// releasing a letter outside a mailbox does not answer, while a mailbox does.
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
const centers = await read(`(() => {
  const center = element => {
    const rect = element.getBoundingClientRect();
    return [rect.x + rect.width / 2, rect.y + rect.height / 2];
  };
  return {
    letter: center(document.querySelector('#abcPostScreen .be-art-text')),
    outside: center(document.querySelector('#abcPostScreen .be-question')),
    mailbox: center(document.querySelector('#abcPostScreen .be-option')),
  };
})()`);
const collection = () => read("document.querySelector('#abcPostScreen .be-collection').textContent");
const drag = async (from, to) => {
  const [startX, startY] = from;
  const [endX, endY] = to;
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
try {
  const before = await collection();
  await drag(centers.letter, centers.outside);
  const afterOutside = await collection();
  if (afterOutside !== before) throw new Error('A release outside a mailbox answered');
  await drag(centers.letter, centers.mailbox);
  const afterMailbox = await collection();
  if (afterMailbox === before) throw new Error('A mailbox release did not answer');
  console.log(JSON.stringify({ before, afterOutside, afterMailbox }));
} finally {
  ws.close();
}
