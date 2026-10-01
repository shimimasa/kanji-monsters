// node tapnow.mjs "<js returning element>": measure and finger-tap (150ms) in one connection.
const [expr] = process.argv.slice(2);
const list = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = list.find(t => t.type === 'page' && t.url.includes('4173'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
await new Promise(r => ws.onopen = r);
const res = await send('Runtime.evaluate', { expression: `(()=>{const e=(${expr}); if(!e) return null; const b=e.getBoundingClientRect(); return [b.x+b.width/2, b.y+b.height/2]})()`, returnByValue: true });
const at = res.result?.result?.value;
if (!at) { console.log('none'); process.exit(0); }
const [x, y] = at;
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
await new Promise(r => setTimeout(r, 150));
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
console.log('tapped', Math.round(x), Math.round(y)); process.exit(0);
