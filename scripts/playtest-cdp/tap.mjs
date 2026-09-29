// node tap.mjs x y holdMs [touch]: press, hold, release like a finger.
const [x, y, hold = 150, kind = 'mouse'] = process.argv.slice(2);
const list = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = list.find(t => t.type === 'page' && t.url.includes('4173'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
await new Promise(r => ws.onopen = r);
if (kind === 'touch') {
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: +x, y: +y }] });
  await new Promise(r => setTimeout(r, +hold));
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
} else {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: +x, y: +y, button: 'left', clickCount: 1 });
  await new Promise(r => setTimeout(r, +hold));
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: +x, y: +y, button: 'left', clickCount: 1 });
}
await new Promise(r => setTimeout(r, 300));
console.log('tapped', x, y, hold, kind); process.exit(0);
