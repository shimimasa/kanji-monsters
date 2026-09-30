// node linkbot.mjs <seconds> [wrongCount] [tap]: draws lines by real drags (or tap-tap) in 算数.
const [secs = '120', wrongs = '0', mode = 'drag'] = process.argv.slice(2);
const list = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = list.find(t => t.type === 'page' && t.url.includes('4173'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
await new Promise(r => ws.onopen = r);
const wait = ms => new Promise(r => setTimeout(r, ms));
const ev = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true })).result?.result?.value;
const mouse = (type, x, y, buttons = 0) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: 1 });
const end = Date.now() + Number(secs) * 1000; let wrong = 0, lines = 0;
while (Date.now() < end) {
  const s = await ev(`(()=>{const r=document.querySelector('#gotomonLinkScreen');if(!r)return null;
    const c=n=>{const b=n.getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]};
    const L=[...r.querySelectorAll('.lk-left')].filter(n=>n.dataset.linked!=='true').map(n=>[n.textContent,...c(n)]);
    const R=[...r.querySelectorAll('.lk-right')].filter(n=>n.dataset.linked!=='true').map(n=>[n.textContent,...c(n)]);
    return {L,R,done:r.querySelector('.lk-prompt').textContent.includes('ぜんぶ')}})()`);
  if (!s) break;
  if (!s.L.length || s.done) { if (s.done && !s.L.length) { await wait(600); const more = await ev(`[...document.querySelectorAll('#gotomonLinkScreen .lk-left')].filter(n=>n.dataset.linked!=='true').length`); if (!more && lines >= 12) break; } await wait(300); continue; }
  const [text, lx, ly] = s.L[0];
  const value = String(eval(text.replace('−', '-')));
  let target = s.R.find(r => r[0] === value);
  if (wrong < Number(wrongs)) { target = s.R.find(r => r[0] !== value); wrong++; }
  if (!target) { await wait(300); continue; }
  const [, rx, ry] = target;
  if (mode === 'tap') {
    await mouse('mousePressed', lx, ly, 1); await wait(120); await mouse('mouseReleased', lx, ly);
    await wait(250);
    await mouse('mousePressed', rx, ry, 1); await wait(120); await mouse('mouseReleased', rx, ry);
  } else {
    await mouse('mousePressed', lx, ly, 1);
    for (let k = 1; k <= 12; k++) { await mouse('mouseMoved', lx + (rx - lx) * k / 12, ly + (ry - ly) * k / 12, 1); await wait(25); }
    await mouse('mouseReleased', rx, ry);
  }
  lines++; await wait(700);
}
console.log('lines', lines); process.exit(0);
