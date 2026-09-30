// node drumbot.mjs <seconds> [wrongFirst]: hits notes on the beat with real mouse presses on the pads.
const [secs = '120', wrongFirst = ''] = process.argv.slice(2);
const list = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = list.find(t => t.type === 'page' && t.url.includes('4173'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
await new Promise(r => ws.onopen = r);
const probe = `(()=>{const s=document.querySelector('#gotomonDrumScreen');if(!s)return null;
const ns=[...s.querySelectorAll('.dr-note:not([data-state])'),...s.querySelectorAll('.dr-note[data-state=coming]')].map(n=>({x:parseFloat(n.style.left),k:n.dataset.kind})).filter(n=>n.x>=10).sort((a,b)=>a.x-b.x);
const n=ns[0];if(!n)return {none:true};
let drum=n.k;if(n.k==='quiz'){const t=s.querySelector('.dr-card b').textContent.replace('？','').replace('−','-').replace('×','*').replace('=','===');drum=eval(t)?'don':'ka';}
const pad=s.querySelector('.dr-pad[data-drum='+drum+']').getBoundingClientRect();
return {x:n.x,k:n.k,drum,px:pad.x+pad.width/2,py:pad.y+pad.height/2,done:!!document.querySelector('#gotomonDrumScreen')&&s.querySelector('.dr-card b')?.textContent.includes('だいせいこう')}})()`;
const end = Date.now() + Number(secs) * 1000; let hits = 0, wrongDone = !wrongFirst, lastX = null;
while (Date.now() < end) {
  const r = (await send('Runtime.evaluate', { expression: probe, returnByValue: true })).result?.result?.value;
  if (!r) { await new Promise(r => setTimeout(r, 200)); continue; }
  if (r.done) break;
  if (r.none) { await new Promise(r => setTimeout(r, 50)); continue; }
  const ms = (r.x - 13) / 91 * 2400;
  if (ms > 60) { await new Promise(res => setTimeout(res, Math.min(ms - 50, 200))); continue; }
  let drum = r.drum, px = r.px;
  if (!wrongDone && r.k === 'quiz') { wrongDone = true; drum = drum === 'don' ? 'ka' : 'don'; const o = (await send('Runtime.evaluate', { expression: `(()=>{const b=document.querySelector('#gotomonDrumScreen .dr-pad[data-drum=${drum}]').getBoundingClientRect();return b.x+b.width/2})()`, returnByValue: true })).result.result.value; px = o; }
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: px, y: r.py, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: px, y: r.py, button: 'left', clickCount: 1 });
  hits++; await new Promise(res => setTimeout(res, 300));
}
console.log('hits', hits); process.exit(0);
