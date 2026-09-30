// node mazebot.mjs <seconds> [wrongCount]: taps a friend's cell then the goal (real CDP taps), answering doors (算数).
const [secs = '200', wrongs = '0'] = process.argv.slice(2);
const list = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = list.find(t => t.type === 'page' && t.url.includes('4173'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
await new Promise(r => ws.onopen = r);
const wait = ms => new Promise(r => setTimeout(r, ms));
const ev = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true })).result?.result?.value;
const tap = async (x, y) => { await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await wait(120); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }); };
const end = Date.now() + Number(secs) * 1000; let wrong = 0, taps = 0, answers = 0;
while (Date.now() < end) {
  const s = await ev(`(()=>{const r=document.querySelector('#gotomonMazeScreen');if(!r)return null;
    const c=n=>{const b=n.getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]};
    const ch=r.querySelector('.mz-choices');
    const friend=[...r.querySelectorAll('.mz-friend')].find(f=>!f.hidden);const goal=r.querySelector('.mz-goal');
    return {p:r.querySelector('.mz-prompt').firstChild?.textContent||'',answering:!ch.hidden,pad:!r.querySelector('.mz-pad').hidden,
      choices:[...ch.querySelectorAll('button')].map(b=>[b.textContent,...c(b)]),target:c((friend||goal).parentElement)}})()`);
  if (!s || s.p === 'ゴール！') break;
  if (s.answering) {
    const ans = String(eval(s.p.replace(' = ?', '').replace('−', '-')));
    let h = s.choices.find(x => x[0] === ans);
    if (wrong < Number(wrongs)) { h = s.choices.find(x => x[0] !== ans); wrong++; }
    await wait(300); await tap(h[1], h[2]); answers++; await wait(400);
  } else if (s.pad) { await tap(s.target[0], s.target[1]); taps++; await wait(900); }
  else await wait(300);
}
console.log('taps', taps, 'answers', answers); process.exit(0);
