// node emusession.mjs <w> <h> <cmd>... : emulate a phone for the whole session and run steps
//   nav:<url>  wait:<ms>  eval:<js>  tap:<x>,<y>  tapjs:<js returning element>  shot:<file>
import fs from 'node:fs';
const [w, h, ...steps] = process.argv.slice(2);
const list = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = list.find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const send = (method, params = {}) => new Promise(r => { const i = ++id; ws.addEventListener('message', function f(e) { const m = JSON.parse(e.data); if (m.id === i) { ws.removeEventListener('message', f); r(m); } }); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Emulation.setDeviceMetricsOverride', { width: Number(w), height: Number(h), deviceScaleFactor: 1, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const evalJs = async js => (await send('Runtime.evaluate', { expression: js, returnByValue: true, awaitPromise: true })).result?.result?.value;
const tap = async (x, y) => { for (const type of ['mousePressed', 'mouseReleased']) { await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }); await sleep(80); } };
for (const step of steps) {
  const i = step.indexOf(':'), cmd = step.slice(0, i), arg = step.slice(i + 1);
  if (cmd === 'nav') { await send('Page.navigate', { url: arg }); await sleep(2500); }
  else if (cmd === 'wait') await sleep(Number(arg));
  else if (cmd === 'eval') console.log(JSON.stringify(await evalJs(arg)));
  else if (cmd === 'tap') { const [x, y] = arg.split(',').map(Number); await tap(x, y); }
  else if (cmd === 'tapjs') { const r = await evalJs(`(()=>{const e=(${arg});if(!e)return null;e.scrollIntoView?.({block:'center'});const b=e.getBoundingClientRect();return [b.left+b.width/2,b.top+b.height/2]})()`); if (r) await tap(r[0], r[1]); else console.log('tapjs: not found'); }
  else if (cmd === 'tapgame') { const [gx, gy] = arg.split(',').map(Number); const r = await evalJs(`(()=>{const c=document.getElementById('gameCanvas');const b=c.getBoundingClientRect();const s=Math.min(b.width/c.width,b.height/c.height);const l=b.left+(b.width-c.width*s)/2,t=b.top+(b.height-c.height*s)/2;return [l+${gx}*s,t+${gy}*s]})()`); await tap(r[0], r[1]); }
  else if (cmd === 'size') { const [a, b] = arg.split(',').map(Number); await send('Emulation.setDeviceMetricsOverride', { width: a, height: b, deviceScaleFactor: 1, mobile: true }); await sleep(1200); }
  else if (cmd === 'shot') { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(arg, Buffer.from(s.result.data, 'base64')); }
}
process.exit(0);
