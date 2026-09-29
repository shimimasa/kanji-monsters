// usage: node cdp.mjs eval "<js>" | shot <path> | click x y | key <Key> | type <text> | nav <url>
setTimeout(()=>{console.log("TIMEOUT");process.exit(2)},15000);
const [cmd, ...args] = process.argv.slice(2);
const list = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = list.find(t => t.type === 'page' && (process.env.T ? t.id===process.env.T : true));
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
await new Promise(r => ws.onopen = r);
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const fs = await import('node:fs');
if (cmd === 'eval') {
  const r = await send('Runtime.evaluate', { expression: args[0], awaitPromise: true, returnByValue: true });
  console.log(JSON.stringify(r.result?.result?.value ?? r.result?.exceptionDetails ?? r, null, 1));
} else if (cmd === 'shot') {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(args[0], Buffer.from(r.result.data, 'base64')); console.log('saved', args[0]);
} else if (cmd === 'zoom') {
  const [x, y, w, h, out] = args; const r = await send('Page.captureScreenshot', { format: 'png', clip: { x: +x, y: +y, width: +w, height: +h, scale: 2 } });
  fs.writeFileSync(out, Buffer.from(r.result.data, 'base64')); console.log('saved', out);
} else if (cmd === 'viewport') {
  const [w, h] = args.map(Number); const win = await send('Browser.getWindowForTarget'); await send('Browser.setWindowBounds', { windowId: win.result.windowId, bounds: { width: w, height: h } });
  const r = await send('Runtime.evaluate', { expression: 'innerWidth+"x"+innerHeight', returnByValue: true }); console.log('viewport', r.result.result.value);
} else if (cmd === 'click') {
  const [x, y] = args.map(Number);
  for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
  console.log('clicked', x, y);
} else if (cmd === 'key') {
  for (const k of args) { for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: k, code: k.length === 1 ? 'Key' + k.toUpperCase() : k, text: type === 'keyDown' && k.length === 1 ? k : undefined, windowsVirtualKeyCode: k === 'Enter' ? 13 : k.length === 1 ? k.toUpperCase().charCodeAt(0) : 0 }); }
  console.log('keys', args.join(' '));
} else if (cmd === 'type') {
  await send('Input.insertText', { text: args[0] }); console.log('typed');
} else if (cmd === 'nav') {
  await send('Page.navigate', { url: args[0] }); console.log('nav', args[0]);
}
ws.close(); process.exit(0);
