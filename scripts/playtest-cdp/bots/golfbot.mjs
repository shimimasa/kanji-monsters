// node golfbot.mjs <seconds> [wrongCount]: plays ゴトモン・ミニゴルフ with real mouse input. Taps the answer's
// flag (算数: computed; the first wrongCount holes choose another flag first), then presses on the course and
// pulls back away from the chosen cup, as long as needed to stop just past it (straight at it; walls and
// bumpers get in the way at times, and then the helping Gotomon carry the ball nearer).
const [secs = '240', wrongs = '0'] = process.argv.slice(2);
const list = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = list.find(t => t.type === 'page' && t.url.includes('4173'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
await new Promise(r => ws.onopen = r);
const sleep = ms => new Promise(res => setTimeout(res, ms));
const probe = `(()=>{const s=document.querySelector('#gotomonGolfScreen');if(!s)return null;
const c=s.querySelector('.gf-course').getBoundingClientRect();const b=s.querySelector('.gf-ball').getBoundingClientRect();
const p=s.querySelector('.gf-prompt')?.firstChild?.textContent||'';let ans=null;
if(/=/.test(p)){const q=p.replace('= ?','').replace('−','-').replace('×','*');ans=String(eval(q));}
const cups=[...s.querySelectorAll('.gf-cup')].map(n=>{const r=n.getBoundingClientRect();return {text:n.querySelector('.gf-plate')?.textContent,x:r.x+r.width/2,y:r.y+r.height/2,
  gone:n.dataset.gone==='true',chosen:n.dataset.chosen==='true',choosing:n.dataset.choosing==='true',hint:n.dataset.hint==='true'}});
return {p,ans,c:[c.x,c.y,c.width,c.height],bx:b.x+b.width/2,by:b.y+b.height/2,cups,power:!s.querySelector('.gf-power').hidden,
  title:s.querySelector('.gf-title')?.textContent,note:s.querySelector('[data-role=feedback]')?.textContent}})()`;
const look = async () => (await send('Runtime.evaluate', { expression: probe, returnByValue: true })).result?.result?.value;
const mouse = (type, x, y) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
const tap = async (x, y) => { await mouse('mousePressed', x, y); await sleep(120); await mouse('mouseReleased', x, y); };
// The rolling distance from a start speed v (course heights per second): decel 0.75 + drag 0.55 * v.
const rollOf = v => (v - (0.75 / 0.55) * Math.log((0.75 + 0.55 * v) / 0.75)) / 0.55;
const end = Date.now() + Number(secs) * 1000;
let wrong = 0, wrongKey = null, holes = new Set(), shots = 0, lastTitle = '';
while (Date.now() < end) {
  const r = await look();
  if (!r) { await sleep(200); continue; }
  if (r.p.includes('クリア')) break;
  if (r.title && r.title !== lastTitle) { lastTitle = r.title; holes.add(r.title.split('「')[0]); }
  const live = r.cups.filter(c => !c.gone);
  if (live.some(c => c.choosing)) {
    let pick = live.find(c => c.text === r.ans);
    if (wrong < Number(wrongs) && !live.some(c => c.hint) && wrongKey !== r.p) { pick = live.find(c => c.text !== r.ans) ?? pick; wrongKey = r.p; wrong++; }
    if (pick) await tap(pick.x, pick.y);
    await sleep(300); continue;
  }
  const target = live.find(c => c.chosen);
  if (!r.power || !target) { await sleep(150); continue; }
  // Wait until the ball rests.
  await sleep(150);
  const again = await look();
  if (!again || Math.hypot(again.bx - r.bx, again.by - r.by) > 0.5) continue;
  const [cx, cy, cw, ch] = r.c;
  const dx = target.x - r.bx, dy = target.y - r.by, d = Math.hypot(dx, dy) / ch;
  let v = 0.2; while (v < 2.6 && rollOf(v) < d + 0.08) v += 0.01;
  const power = Math.min(1, v / 2.6), full = Math.max(140, ch * 0.42), len = power * full;
  const wobble = (Math.random() - 0.5) * 0.08, ang = Math.atan2(dy, dx) + wobble;
  // Press on open grass in the middle of the course, pull back the other way, let go.
  const px = cx + cw * 0.35, py = cy + ch * 0.5;
  await mouse('mousePressed', px, py);
  for (let k = 1; k <= 6; k++) { await mouse('mouseMoved', px - Math.cos(ang) * len * k / 6, py - Math.sin(ang) * len * k / 6); await sleep(40); }
  await sleep(150);
  await mouse('mouseReleased', px - Math.cos(ang) * len, py - Math.sin(ang) * len);
  shots++;
  await sleep(400);
}
const last = await look();
console.log('holes seen', holes.size, 'shots', shots, 'wrong', wrong, '|', last?.p, '|', last?.note);
process.exit(0);
