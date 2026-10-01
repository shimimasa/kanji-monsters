// node errs.mjs: listens 3 s for exceptions and console errors on the :4173 page.
const list = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = list.find(t => t.type === 'page' && t.url.includes('4173'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pend = new Map(); const logs = [];
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method === 'Runtime.exceptionThrown') logs.push(m.params.exceptionDetails.exception?.description?.slice(0, 400)); else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push(m.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 400)); };
await new Promise(r => ws.onopen = r);
await send('Runtime.enable');
await new Promise(r => setTimeout(r, 3000));
console.log([...new Set(logs)].slice(0, 5).join('\n---\n') || 'no errors'); process.exit(0);
