// node racebot.mjs <seconds> [wrongCount]: steers with real presses on the lane buttons when a gate shows.
const [secs = '120', wrongs = '0'] = process.argv.slice(2);
const list = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = list.find(t => t.type === 'page' && t.url.includes('4173'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
await new Promise(r => ws.onopen = r);
const probe = `(()=>{const s=document.querySelector('#gotomonRaceScreen');if(!s)return null;
const p=s.querySelector('.rc-prompt')?.firstChild?.textContent||'';if(!/=/.test(p))return {p};
const q=p.replace('= ?','').replace('−','-').replace('×','*');const ans=String(eval(q));
const bs=[...s.querySelectorAll('.rc-lane')];const texts=bs.map(b=>b.querySelector('span')?.textContent);
const k=texts.indexOf(ans);const hint=bs.some(b=>b.dataset.hint==='true');
return {p,k,hint,texts,rects:bs.map(b=>{const r=b.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})}})()`;
const end = Date.now() + Number(secs) * 1000; let last = null, wrong = 0, presses = 0;
while (Date.now() < end) {
  const r = (await send('Runtime.evaluate', { expression: probe, returnByValue: true })).result?.result?.value;
  if (r && r.k >= 0) {
    const key = r.p + '|' + r.texts.join(',') + r.hint;
    if (key !== last) {
      last = key; let k = r.k;
      if (wrong < Number(wrongs) && !r.hint) { k = (k + 1) % 4; wrong++; }
      await new Promise(res => setTimeout(res, 700));
      const [x, y] = r.rects[k];
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await new Promise(res => setTimeout(res, 150));
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
      presses++;
    }
  }
  if (r?.p === 'ゴール！') break;
  await new Promise(res => setTimeout(res, 150));
}
console.log('presses', presses); process.exit(0);
