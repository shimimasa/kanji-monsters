// node othbot.mjs <seconds>: answers by tapping a random choice and places on a random glowing square (real CDP taps).
const [secs = '240'] = process.argv.slice(2);
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
const end = Date.now() + Number(secs) * 1000; let answers = 0, places = 0, notes = new Set();
while (Date.now() < end) {
  const s = await ev(`(()=>{const r=document.querySelector('#gotomonOthelloScreen');if(!r)return null;
    const c=n=>{const b=n.getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]};
    const ch=r.querySelector('.ot-choices');
    return {p:r.querySelector('.ot-prompt').textContent,note:r.querySelector('[data-role=feedback]').textContent,
      choices:ch.hidden?[]:[...ch.querySelectorAll('button')].map(c),legal:[...r.querySelectorAll('.ot-cell[data-legal=true]')].map(c)}})()`);
  if (!s) break;
  if (s.note) notes.add(s.note.slice(0, 40));
  if (s.p === 'おしまい！') break;
  if (s.choices.length) { const [x, y] = s.choices[Math.floor(Math.random() * 4)]; await wait(300); await tap(x, y); answers++; }
  else if (s.legal.length) { const [x, y] = s.legal[Math.floor(Math.random() * s.legal.length)]; await wait(300); await tap(x, y); places++; }
  await wait(350);
}
console.log('answers', answers, 'places', places); console.log([...notes].slice(0, 8).join('\n')); process.exit(0);
