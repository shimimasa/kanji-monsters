// node seekbot.mjs <seconds> [wrongCount]: finds the Gotomon holding the answer (算数) and taps it for real.
const [secs = '120', wrongs = '0'] = process.argv.slice(2);
const list = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = list.find(t => t.type === 'page' && t.url.includes('4173'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
await new Promise(r => ws.onopen = r);
const wait = ms => new Promise(r => setTimeout(r, ms));
const ev = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true })).result?.result?.value;
const tap = async (x, y) => { await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await wait(150); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }); };
const end = Date.now() + Number(secs) * 1000; let wrong = 0, taps = 0, last = '';
while (Date.now() < end) {
  const s = await ev(`(()=>{const r=document.querySelector('#gotomonSeekScreen');if(!r)return null;
    const hs=[...r.querySelectorAll('.sk-hider')].filter(h=>h.dataset.state==='hiding').map(h=>{const t=h.querySelector('.sk-tag').getBoundingClientRect();return [h.querySelector('.sk-tag').textContent,t.x+t.width/2,t.y+t.height/2]});
    return {p:r.querySelector('.sk-prompt').firstChild?.textContent||'',hs,title:r.querySelector('.sk-title').textContent}})()`);
  if (!s || !s.title) break;
  const key = s.p + s.hs.map(h => h[0]).join();
  if (key !== last && s.hs.length) {
    last = key;
    const ans = String(eval(s.p.replace(' = ?', '').replace('−', '-')));
    let h = s.hs.find(x => x[0] === ans);
    if (wrong < Number(wrongs)) { h = s.hs.find(x => x[0] !== ans); wrong++; last = ''; }
    if (h) { await wait(400); await tap(h[1], h[2]); taps++; }
  }
  await wait(250);
}
console.log('taps', taps); process.exit(0);
