// node landbot.mjs <seconds> [wrongCount]: plays ゴトモン・ぼうけんランド with real mouse presses: holds ▶,
// presses ジャンプ before holes, steps and acorns (read from the tiles on screen), waits for moving platforms,
// and in the hall walks to the door of the answer (算数: computed; the first wrongCount stages pick another door
// first) and presses 「▲ とびらに はいる」.
const [secs = '300', wrongs = '0'] = process.argv.slice(2);
const list = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = list.find(t => t.type === 'page' && t.url.includes('4173'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
await new Promise(r => ws.onopen = r);
const sleep = ms => new Promise(res => setTimeout(res, ms));
const probe = `(()=>{const s=document.querySelector('#gotomonLandScreen');if(!s)return null;
const em=v=>parseFloat(v)||0;const pl=s.querySelector('.ld-player');
const p=s.querySelector('.ld-prompt')?.firstChild?.textContent||'';let ans=null;
if(/=/.test(p)){const q=p.replace('= ?','').replace('−','-').replace('×','*');ans=String(eval(q));}
const h={};let width=0;for(const t of s.querySelectorAll('.ld-t')){const c=Math.round(em(t.style.left)),r=Math.round(em(t.style.bottom));width=Math.max(width,c+1);
  if(t.dataset.kind==='grass')h[c]=Math.max(h[c]||0,r+1);if(t.dataset.kind==='bridge')h[c]=Math.max(h[c]||0,2);}
const doors=[...s.querySelectorAll('.ld-door')].map(n=>({text:n.querySelector('.ld-plate')?.textContent,col:em(n.style.left)-0.5,gone:n.dataset.gone==='true',hint:n.dataset.hint==='true'}));
const btn=a=>{const b=s.querySelector('.ld-btn[data-act='+a+']');const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,disabled:b.disabled}};
return {p,ans,x:em(pl.style.left),y:em(pl.style.bottom),h,width,doors,
  platforms:[...s.querySelectorAll('.ld-platform')].map(n=>em(n.style.left)),acorns:[...s.querySelectorAll('.ld-acorn')].map(n=>em(n.style.left)),
  btn:{left:btn('left'),right:btn('right'),jump:btn('jump'),enter:btn('enter')},title:s.querySelector('.ld-title')?.textContent,note:s.querySelector('[data-role=feedback]')?.textContent}})()`;
const look = async () => (await send('Runtime.evaluate', { expression: probe, returnByValue: true })).result?.result?.value;
const mouse = (type, b) => send('Input.dispatchMouseEvent', { type, x: b.x, y: b.y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
let holding = null;
const hold = async (b, name) => { if (holding === name) return; if (holding) await mouse('mouseReleased', b); holding = name; if (name) await mouse('mousePressed', b); };
const tap = async b => { const was = holding; if (was) { await mouse('mouseReleased', b); holding = null; } await mouse('mousePressed', b); await sleep(50); await mouse('mouseReleased', b); };
const end = Date.now() + Number(secs) * 1000;
let wrong = 0, wrongKey = null, stages = new Set(), jumps = 0, lastY = null;
while (Date.now() < end) {
  const s = await look();
  if (!s) { await sleep(200); continue; }
  if (s.p.includes('クリア')) break;
  stages.add(s.title);
  const hall = Math.min(...s.doors.map(d => d.col)) - 2;
  const grounded = lastY !== null && Math.abs(s.y - lastY) < 1e-3 && Math.abs(s.y - Math.round(s.y)) < 1e-3;
  lastY = s.y;
  if (s.x >= hall) {
    const live = s.doors.filter(d => !d.gone);
    let door = live.find(d => d.text === s.ans);
    if (wrong < Number(wrongs) && !live.some(d => d.hint) && wrongKey !== s.p) { door = live.find(d => d.text !== s.ans) ?? door; wrongKey = s.p; wrong++; }
    else if (wrongKey === s.p && !live.some(d => d.hint)) door = live.find(d => d.text !== s.ans) ?? door;
    const dx = door.col + 0.5 - s.x;
    if (Math.abs(dx) < 0.25) { await hold(s.btn.right, null); await sleep(120); const again = await look(); if (!again.btn.enter.disabled) await tap(again.btn.enter); await sleep(400); }
    else await hold(dx > 0 ? s.btn.right : s.btn.left, dx > 0 ? 'right' : 'left');
    continue;
  }
  const col = Math.floor(s.x), front = s.x + 0.35, ahead = Math.floor(front + 0.6);
  // A 4-wide hole is a moving platform's: wait until the platform touches this side, ride, get off at the far side.
  let holeStart = -1, w = 0;
  for (let c = Math.floor(front); c <= Math.floor(front) + 1; c++) if (!s.h[c]) { holeStart = c; break; }
  if (holeStart >= 0) while (!s.h[holeStart + w] && w < 6) w++;
  const onPlat = !s.h[col] && s.platforms.some(px => s.x > px - 0.1 && s.x < px + 2.1) && Math.abs(s.y - 2) < 0.05;
  if (onPlat) {
    const px = s.platforms.find(q => s.x > q - 0.1 && s.x < q + 2.1);
    let start = col; while (!s.h[start - 1]) start--;
    if (px >= start + 2 - 0.2 || s.x < px + 0.9) await hold(s.btn.right, 'right'); else await hold(s.btn.right, null);
  } else if (w === 4 && holeStart - front < 0.6) {
    const near = s.platforms.find(px => Math.abs(px - holeStart) < 2.5);
    if (near !== undefined && near <= holeStart + 0.15) await hold(s.btn.right, 'right'); else await hold(s.btn.right, null);
  } else {
    await hold(s.btn.right, 'right');
    const here = s.h[col] ?? 2, next = s.h[ahead];
    const acorn = s.acorns.some(a => a > s.x && a - s.x < 1.6);
    if (grounded && ((next === undefined || next === 0 || next > here) && w !== 4 || acorn)) { await tap(s.btn.jump); jumps++; await hold(s.btn.right, 'right'); }
  }
  await sleep(40);
}
if (holding) await mouse('mouseReleased', { x: 10, y: 10 });
const last = await look();
console.log('stages seen', stages.size, 'jumps', jumps, 'wrong', wrong, '|', last?.p, '|', last?.note);
process.exit(0);
