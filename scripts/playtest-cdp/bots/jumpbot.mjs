// node jumpbot.mjs <seconds> [wrongCount]: holds a finger on the tower (real mouse press + moves) and
// steers the companion to the highest ledge in reach; when the row is near, taps the answer cloud (算数: computed).
const [secs = '150', wrongs = '0'] = process.argv.slice(2);
const list = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = list.find(t => t.type === 'page' && t.url.includes('4173'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
await new Promise(r => ws.onopen = r);
const probe = `(()=>{const s=document.querySelector('#gotomonJumpScreen');if(!s)return null;
const t=s.querySelector('.jp-tower').getBoundingClientRect();const pl=s.querySelector('.jp-player').getBoundingClientRect();
const p=s.querySelector('.jp-prompt')?.firstChild?.textContent||'';let ans=null;
if(/=/.test(p)){const q=p.replace('= ?','').replace('−','-').replace('×','*');ans=String(eval(q));}
const clouds=[...s.querySelectorAll('.jp-cloud')].map(c=>{const r=c.getBoundingClientRect();return {text:c.querySelector('span')?.textContent,x:r.x+r.width/2,y:r.y+r.height*0.45,hint:c.dataset.hint==='true',gone:c.dataset.gone==='true',chosen:c.dataset.chosen==='true'}});
const ledges=[...s.querySelectorAll('.jp-ledge')].filter(l=>l.dataset.locked!=='true').map(l=>{const r=l.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y}});
return {p,ans,t:[t.x,t.y,t.width,t.height],px:pl.x+pl.width/2,py:pl.bottom,clouds,ledges,title:s.querySelector('.jp-title')?.textContent}})()`;
const end = Date.now() + Number(secs) * 1000;
let down = false, wrong = 0, wrongKey = null, lastFeet = [], target = null, rows = 0, lastP = '';
const press = async (type, x, y) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
while (Date.now() < end) {
  const r = (await send('Runtime.evaluate', { expression: probe, returnByValue: true })).result?.result?.value;
  if (!r) { await new Promise(res => setTimeout(res, 200)); continue; }
  if (r.p === 'ゴール！') break;
  if (r.p !== lastP) { lastP = r.p; rows++; }
  const [tx, ty, tw, th] = r.t;
  lastFeet.push(r.py); if (lastFeet.length > 3) lastFeet.shift();
  const rising = lastFeet.length > 1 && lastFeet.at(-1) < lastFeet[0];
  // The row is in reach once the feet are within a plain bounce (0.3 tower) of it, going up, or above it.
  const live = r.clouds.filter(c => !c.gone);
  const row = live[0];
  let toX = null;
  if (row && r.ans !== null && (r.py < row.y || (rising && r.py - row.y < th * 0.25))) {
    const key = r.p;
    let pick = live.find(c => c.text === r.ans);
    if (wrong < Number(wrongs) && !live.some(c => c.hint) && wrongKey !== key) { pick = live.find(c => c.text !== r.ans) ?? pick; wrongKey = key; wrong++; }
    else if (wrongKey === key && !live.some(c => c.hint)) pick = live.find(c => c.text !== r.ans) ?? pick;
    toX = pick?.x ?? null;
    // The answer is a tap on its cloud; then the companion glides onto it.
    if (pick && !pick.chosen) {
      if (down) { await press('mouseReleased', toX, ty + th / 2); down = false; }
      await press('mousePressed', pick.x, pick.y); await new Promise(res => setTimeout(res, 60)); await press('mouseReleased', pick.x, pick.y);
      continue;
    }
  } else {
    const reach = r.ledges.filter(l => l.y > r.py - th * 0.27 && l.y < ty + th - 4 && l.y > ty).sort((a, b) => a.y - b.y);
    toX = reach[0]?.x ?? null;
  }
  if (toX !== null) {
    const y = ty + th * 0.5;
    if (!down) { await press('mousePressed', toX, y); down = true; } else await press('mouseMoved', toX, y);
  } else if (down) { await press('mouseReleased', tx + tw / 2, ty + th / 2); down = false; }
  await new Promise(res => setTimeout(res, 50));
}
if (down) await press('mouseReleased', 10, 10);
console.log('rows seen', rows, 'wrong', wrong); process.exit(0);
