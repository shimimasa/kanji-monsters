// node tagbot.mjs <seconds> [wrongCount]: presses the ▲▼◀▶ buttons (real mouse presses) to run to the answer's
// plate (算数: computed), keeping off the chasers, and after a power-up runs after the chasers that run away.
const [secs = '200', wrongs = '0'] = process.argv.slice(2);
const list = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = list.find(t => t.type === 'page' && t.url.includes('4173'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
await new Promise(r => ws.onopen = r);
const BOARD = ['#####P#####', '#.........#', '#.##.#.##.#', '#.#.....#.#', '#...#.#...#', 'P.#.....#.P', '#...#.#...#', '#.#.....#.#', '#.##.#.##.#', '#.........#', '#####P#####'];
const W = 13, H = 12, D = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
const isOpen = (r, c) => ['.', 'P'].includes(BOARD[r]?.[c]);
const probe = `(()=>{const s=document.querySelector('#gotomonTagScreen');if(!s)return null;
const cell=n=>({x:parseFloat(n.style.left)*${W}/100-1,y:parseFloat(n.style.top)*${H}/100-0.5});
const p=s.querySelector('.tg-prompt');const t=p?.firstChild?.textContent||'';let ans=null;
if(/=/.test(t)){const q=t.replace('= ?','').replace('−','-').replace('×','*');ans=String(eval(q));}
const plates=[...s.querySelectorAll('.tg-plate')].filter(n=>!n.hidden).map(n=>({...cell(n),text:n.textContent,hint:n.dataset.hint==='true'}));
const its=[...s.querySelectorAll('.tg-it')].map(n=>({...cell(n),running:n.dataset.running==='true',waiting:n.dataset.waiting==='true'}));
const arrows=Object.fromEntries([...s.querySelectorAll('.tg-arrow')].map(b=>{const r=b.getBoundingClientRect();return [b.dataset.direction,[r.x+r.width/2,r.y+r.height/2]]}));
return {t,ans,power:p?.dataset.power==='true',me:cell(s.querySelector('.tg-me')),plates,its,arrows}})()`;
function firstStep(r, c, goals, avoid) {
  for (const careful of [true, false]) {
    const from = new Map([[`${r},${c}`, null]]), q = [[r, c]];
    while (q.length) {
      const [y, x] = q.shift();
      if (goals.some(([gy, gx]) => gy === y && gx === x) && (y !== r || x !== c)) {
        let k = `${y},${x}`, dir = null; while (from.get(k)) { dir = from.get(k).dir; k = from.get(k).prev; } return dir;
      }
      for (const [d, [dy, dx]] of Object.entries(D)) {
        const k = `${y + dy},${x + dx}`;
        if (!isOpen(y + dy, x + dx) || from.has(k) || (careful && avoid.has(k))) continue;
        from.set(k, { prev: `${y},${x}`, dir: d }); q.push([y + dy, x + dx]);
      }
    }
  }
  return null;
}
const end = Date.now() + Number(secs) * 1000;
let wrong = 0, wrongKey = null, last = null, lastPress = 0, presses = 0;
while (Date.now() < end) {
  const s = (await send('Runtime.evaluate', { expression: probe, returnByValue: true })).result?.result?.value;
  if (!s) { await new Promise(r => setTimeout(r, 200)); continue; }
  if (s.t === 'おしまい！') break;
  const r = Math.round(s.me.y), c = Math.round(s.me.x);
  const avoid = new Set();
  for (const it of s.its) if (!it.running && !it.waiting) for (const [dy, dx] of [[0, 0], ...Object.values(D)]) avoid.add(`${Math.round(it.y) + dy},${Math.round(it.x) + dx}`);
  let goals = null;
  if (s.power) goals = s.its.filter(it => it.running && !it.waiting).map(it => [Math.round(it.y), Math.round(it.x)]);
  else if (s.ans !== null && s.plates.length) {
    let pick = s.plates.find(p => p.text === s.ans);
    if (!s.plates.some(p => p.hint) && (wrongKey === s.t || (wrong < Number(wrongs) && wrongKey !== s.t))) {
      if (wrongKey !== s.t) { wrongKey = s.t; wrong++; }
      pick = s.plates.find(p => p.text !== s.ans) ?? pick;
    }
    goals = [[Math.round(pick.y), Math.round(pick.x)]];
  }
  const dir = goals?.length ? firstStep(r, c, goals, avoid) : null;
  if (dir && (dir !== last || Date.now() - lastPress > 600)) {
    const [x, y] = s.arrows[dir];
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await new Promise(r => setTimeout(r, 60));
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
    last = dir; lastPress = Date.now(); presses++;
  }
  await new Promise(r => setTimeout(r, 40));
}
console.log('presses', presses, 'wrong', wrong); process.exit(0);
