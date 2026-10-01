// node hopbot.mjs <seconds> [wrongCount]: plays ゴトモン・川わたり by pressing the ▲▼◀▶ buttons (real mouse
// presses). Reads the carts and logs from the screen twice to know how fast each lane goes, hops up when the
// next row stays safe for a while, and on the far bank walks to the home of the answer (算数: computed; the
// first wrongCount questions go to another home first).
const [secs = '240', wrongs = '0'] = process.argv.slice(2);
const COLS = 9, ROWS = 8, BANK = 6, ROADS = [1, 2], RIVER = [4, 5];
const list = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = list.find(t => t.type === 'page' && t.url.includes('4173'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
await new Promise(r => ws.onopen = r);
const sleep = ms => new Promise(res => setTimeout(res, ms));
const probe = `(()=>{const s=document.querySelector('#gotomonHopScreen');if(!s)return null;
const pct=v=>parseFloat(v)||0;const pl=s.querySelector('.hp-player');
const p=s.querySelector('.hp-prompt')?.firstChild?.textContent||'';let ans=null;
if(/=/.test(p)){const q=p.replace('= ?','').replace('−','-').replace('×','*');ans=String(eval(q));}
const items=[...s.querySelectorAll('.hp-cart,.hp-log')].map(n=>({id:n.dataset.id,row:+n.dataset.row,x:pct(n.style.left)*${COLS}/100-0.5,len:+n.dataset.len}));
const homes=[...s.querySelectorAll('.hp-home')].map(n=>({text:n.querySelector('.hp-plate')?.textContent,col:Math.round(pct(n.style.left)*${COLS}/100-0.5),gone:n.dataset.gone==='true',hint:n.dataset.hint==='true'}));
const btn=d=>{const r=s.querySelector('.hp-arrow[data-dir='+d+']').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]};
return {p,ans,x:pct(pl.style.left)*${COLS}/100-0.5,row:Math.round(pct(pl.style.bottom)*${ROWS}/100-0.5),bubble:pl.dataset.bubble==='true',items,homes,
  btn:{up:btn('up'),down:btn('down'),left:btn('left'),right:btn('right')},title:s.querySelector('.hp-title')?.textContent,note:s.querySelector('[data-role=feedback]')?.textContent}})()`;
const look = async () => (await send('Runtime.evaluate', { expression: probe, returnByValue: true })).result?.result?.value;
const press = async ([x, y]) => { await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 }); await sleep(60); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 }); };
// Lane speeds from two looks 120 ms apart (things that wrapped around are skipped).
const speeds = (a, b, dt) => {
  const v = {};
  for (const it of b.items) { const was = a.items.find(o => o.id === it.id); if (was && Math.abs(it.x - was.x) < 1) v[it.row] = (it.x - was.x) / dt; }
  return v;
};
const safe = (s, v, X, r, ahead) => {
  if (s.bubble) return true;
  const items = s.items.filter(it => it.row === r), sp = v[r] ?? 0;
  if (!ROADS.includes(r) && !RIVER.includes(r)) return true;
  for (let t = 0; t <= ahead; t += 0.05) {
    const moved = items.map(it => ({ x: it.x + sp * t, len: it.len }));
    if (ROADS.includes(r)) { if (moved.some(it => X + 0.4 > it.x && X - 0.4 < it.x + it.len)) return false; }
    else { const rx = X + sp * t; if (!moved.some(it => rx >= it.x + 0.35 && rx <= it.x + it.len - 0.35)) return false; }
  }
  return true;
};
const end = Date.now() + Number(secs) * 1000;
let wrong = 0, wrongKey = null, hops = 0, questions = new Set();
while (Date.now() < end) {
  const a = await look();
  if (!a) { await sleep(200); continue; }
  if (a.p.includes('わたれた')) break;
  await sleep(120);
  const s = await look();
  if (!s) continue;
  questions.add(s.p);
  const v = speeds(a, s, 0.12);
  let dir = null;
  if (s.row === BANK) {
    const live = s.homes.filter(h => !h.gone);
    let target = live.find(h => h.text === s.ans);
    if (wrong < Number(wrongs) && !live.some(h => h.hint) && wrongKey !== s.p) { target = live.find(h => h.text !== s.ans) ?? target; wrongKey = s.p; wrong++; }
    else if (wrongKey === s.p && !live.some(h => h.hint)) target = live.find(h => h.text !== s.ans) ?? target;
    const dx = target.col - Math.round(s.x);
    dir = dx === 0 ? 'up' : dx > 0 ? 'right' : 'left';
  } else {
    const up = RIVER.includes(s.row + 1) ? s.x : Math.round(s.x);
    if (safe(s, v, up, s.row + 1, 0.8)) dir = 'up';
    else if (!safe(s, v, s.x, s.row, 0.5) && s.row > 0 && s.row !== 3) dir = 'down';
    else if ((s.row === 0 || s.row === 3) && Math.abs(Math.round(s.x) - 4) > 1 && Math.random() < 0.1) dir = Math.round(s.x) < 4 ? 'right' : 'left';
  }
  if (dir) { await press(s.btn[dir]); hops++; await sleep(120); }
}
const last = await look();
console.log('questions seen', questions.size, 'hops', hops, 'wrong', wrong, '|', last?.p, '|', last?.note);
process.exit(0);
