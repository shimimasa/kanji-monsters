// node mergebot.mjs <seconds> [wrongCount]: answers by tapping and slides by real swipes on the board.
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
const press = async (x, y, x2 = x, y2 = y) => {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  for (let k = 1; k <= 5; k++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x + (x2 - x) * k / 5, y: y + (y2 - y) * k / 5, button: 'left', buttons: 1 }); await wait(20); }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x2, y: y2, button: 'left', clickCount: 1 });
};
const end = Date.now() + Number(secs) * 1000; let wrong = 0, answers = 0, swipes = 0, dir = 0;
while (Date.now() < end) {
  const s = await ev(`(()=>{const r=document.querySelector('#gotomonMergeScreen');if(!r)return null;const p=r.querySelector('.mg-prompt').textContent;
    const ch=r.querySelector('.mg-choices');const b=r.querySelector('.mg-board').getBoundingClientRect();
    return {p,answering:!ch.hidden,board:[b.x,b.y,b.width,b.height],done:p==='おしまい！',
      choices:[...ch.querySelectorAll('button')].map(x=>{const q=x.getBoundingClientRect();return [x.textContent,q.x+q.width/2,q.y+q.height/2]})}})()`);
  if (!s || s.done) break;
  if (s.answering) {
    const q = s.p.replace(' = ?', '').replace('−', '-').replace('×', '*'); const ans = String(eval(q));
    let c = s.choices.find(x => x[0] === ans);
    if (wrong < Number(wrongs)) { c = s.choices.find(x => x[0] !== ans); wrong++; }
    await wait(300); await press(c[1], c[2]); answers++;
  } else {
    const [x, y, w, h] = s.board, cx = x + w / 2, cy = y + h / 2, d = w * 0.3;
    const moves = [[0, d], [-d, 0], [d, 0], [0, -d]];
    const before = await ev(`document.querySelector('.mg-prompt').textContent + document.querySelectorAll('#gotomonMergeScreen .mg-tile').length`);
    const [mx, my] = moves[dir % 4];
    await wait(250); await press(cx, cy, cx + mx, cy + my); swipes++;
    await wait(250);
    const after = await ev(`document.querySelector('.mg-prompt').textContent + document.querySelectorAll('#gotomonMergeScreen .mg-tile').length`);
    if (after === before) dir++; else dir = 0;
  }
  await wait(200);
}
console.log('answers', answers, 'swipes', swipes); process.exit(0);
