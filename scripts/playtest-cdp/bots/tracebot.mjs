// node tracebot.mjs <seconds> [wrongCount] [tap]: plays ゴトモン・もじなぞり with real mouse input. 算数: computes the
// answer and drags through the tiles (press on the first tile, move through each tile's middle, let go); with
// "tap" it taps the tiles one by one instead. Other modes (or the first wrongCount questions): traces a wrong
// word of the right length first, and after two wrong words follows the glowing tiles.
const [secs = '240', wrongs = '0', how = 'drag'] = process.argv.slice(2);
const list = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = list.find(t => t.type === 'page' && t.url.includes('4173'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
await new Promise(r => ws.onopen = r);
const sleep = ms => new Promise(res => setTimeout(res, ms));
const probe = `(()=>{const s=document.querySelector('#gotomonTraceScreen');if(!s)return null;
const p=s.querySelector('.tr-prompt')?.firstChild?.textContent||'';let ans=null;
if(/=/.test(p)){const q=p.replace('= ?','').replace('−','-').replace('×','*');ans=String(eval(q));}
const tiles=[...s.querySelectorAll('.tr-tile')].map(t=>{const r=t.getBoundingClientRect();return {ch:t.textContent,x:r.x+r.width/2,y:r.y+r.height/2,hint:t.dataset.hint==='true',order:+(t.dataset.order||0),pop:t.dataset.pop==='true'}});
return {p,ans,tiles,len:s.querySelectorAll('.tr-slot').length,title:s.querySelector('.tr-title')?.textContent,note:s.querySelector('[data-role=feedback]')?.textContent}})()`;
const look = async () => (await send('Runtime.evaluate', { expression: probe, returnByValue: true })).result?.result?.value;
const mouse = (type, x, y) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
const touch = (a, b) => a !== b && Math.abs(Math.floor(a / 5) - Math.floor(b / 5)) <= 1 && Math.abs(a % 5 - b % 5) <= 1;
const find = (tiles, word) => {
  const t = [...word];
  const go = l => { if (l.length === t.length) return l; for (let c = 0; c < 25; c++) if (!l.includes(c) && touch(l.at(-1), c) && tiles[c].ch === t[l.length]) { const r = go([...l, c]); if (r) return r; } return null; };
  for (let c = 0; c < 25; c++) if (tiles[c].ch === t[0]) { const r = go([c]); if (r) return r; }
  return null;
};
const wrongOf = (tiles, len, avoid) => {
  const go = l => { if (l.length === len) return avoid && l.map(c => tiles[c].ch).join('') === avoid ? null : l; for (let c = 0; c < 25; c++) if (!l.includes(c) && touch(l.at(-1), c)) { const r = go([...l, c]); if (r) return r; } return null; };
  for (let c = 24; c >= 0; c--) { const r = go([c]); if (r) return r; }
  return null;
};
const trace = async (tiles, cells) => {
  if (how === 'tap') { for (const c of cells) { await mouse('mousePressed', tiles[c].x, tiles[c].y); await sleep(40); await mouse('mouseReleased', tiles[c].x, tiles[c].y); await sleep(80); } return; }
  await mouse('mousePressed', tiles[cells[0]].x, tiles[cells[0]].y);
  for (let k = 1; k < cells.length; k++) {
    const a = tiles[cells[k - 1]], b = tiles[cells[k]];
    for (let f = 1; f <= 4; f++) { await mouse('mouseMoved', a.x + (b.x - a.x) * f / 4, a.y + (b.y - a.y) * f / 4); await sleep(15); }
  }
  await sleep(60); await mouse('mouseReleased', tiles[cells.at(-1)].x, tiles[cells.at(-1)].y);
};
const end = Date.now() + Number(secs) * 1000;
let wrong = 0, words = 0, lastKey = null, triesHere = 0;
while (Date.now() < end) {
  const s = await look();
  if (!s) { await sleep(200); continue; }
  if (s.p.includes('できた')) break;
  if (!s.len || s.tiles.some(t => t.pop)) { await sleep(150); continue; }
  const key = s.p + '|' + s.tiles.map(t => t.ch).join('');
  if (key !== lastKey) { lastKey = key; triesHere = 0; }
  const glowing = s.tiles.map((t, i) => (t.hint ? i : -1)).filter(i => i >= 0);
  let cells = null;
  if (glowing.length === s.len) {
    // The whole word glows, with numbers for the order.
    cells = [...glowing].sort((a, b) => s.tiles[a].order - s.tiles[b].order);
  } else if (s.ans !== null && !(wrong < Number(wrongs) && triesHere === 0)) cells = find(s.tiles, s.ans);
  else { cells = wrongOf(s.tiles, s.len, s.ans); if (triesHere === 0) wrong++; }
  if (!cells) { await sleep(300); continue; }
  await trace(s.tiles, cells);
  triesHere++; words++;
  await sleep(700);
}
const last = await look();
console.log('traces', words, 'wrong first tries', wrong, '|', last?.p, '|', last?.note);
process.exit(0);
