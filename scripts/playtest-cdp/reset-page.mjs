const v = await (await fetch('http://127.0.0.1:9333/json/version')).json();
const ws = new WebSocket(v.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id=0; const send=(method,params={})=>new Promise(r=>{const i=++id;ws.addEventListener('message',function f(e){const m=JSON.parse(e.data);if(m.id===i){ws.removeEventListener('message',f);r(m)}});ws.send(JSON.stringify({id:i,method,params}))});
const { result } = await send('Target.getTargets');
for (const t of result.targetInfos.filter(t => t.type === 'page' && t.url.startsWith('http'))) console.log('close', t.url, JSON.stringify(await send('Target.closeTarget', { targetId: t.targetId })));
console.log(JSON.stringify(await send('Target.createTarget', { url: 'about:blank' })));
process.exit(0);
