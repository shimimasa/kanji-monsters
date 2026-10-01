// Swipes across the ball with the answer (math mode) for N seconds; "wrong" swipes one wrong ball first.
const seconds = Number(process.argv[2] || 60), wrongFirst = process.argv[3] === 'wrong';
const list = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = list.find(t => t.type === 'page' && t.url.includes('4173'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
await new Promise(r => ws.onopen = r);
const probe = want => `(()=>{if(document.querySelector('[data-completed=true]'))return {done:true};const q=document.querySelector('.sl-prompt')?.textContent.replace(/[^0-9+−×]/g,'')||'';const m=q.match(/([0-9]+)([+−×])([0-9]+)/);if(!m)return null;const a=m[2]==='+'?+m[1]+ +m[3]:m[2]==='−'?m[1]-m[3]:m[1]*m[3];const bs=[...document.querySelectorAll('.sl-ball')].filter(n=>n.dataset.state==='flying');const b=bs.find(n=>('${want}'==='wrong')!==(+n.querySelector('.sl-plate').textContent===a));if(!b)return null;const r=b.getBoundingClientRect();if(r.top<60||r.bottom>window.innerHeight-40)return null;return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width}})()`;
const swipe = async v => {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: v.x - v.w, y: v.y + 4, button: 'left', clickCount: 1 });
  for (let i = 1; i <= 6; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: v.x - v.w + (2 * v.w * i) / 6, y: v.y + 4 - i, button: 'left', buttons: 1 }); await new Promise(r => setTimeout(r, 12)); }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: v.x + v.w, y: v.y - 2, button: 'left', clickCount: 1 });
};
let wrong = wrongFirst;
const end = Date.now() + seconds * 1000;
while (Date.now() < end) {
  const v = (await send('Runtime.evaluate', { expression: probe(wrong ? 'wrong' : 'right'), returnByValue: true })).result?.result?.value;
  if (v?.done) break;
  if (v) { await swipe(v); if (wrong) { wrong = false; console.log('wrong swipe'); break; } await new Promise(r => setTimeout(r, 700)); }
  else await new Promise(r => setTimeout(r, 60));
}
console.log('done'); process.exit(0);
