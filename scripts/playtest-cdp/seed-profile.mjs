// Seed only the dedicated CDP test profile. The production save is never read or changed.
import { getDefaultSave } from '../../src/core/saveData.js';

const pages = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = pages.find(item => item.type === 'page');
if (!page) throw new Error('CDP page not found');
const ws = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
let id = 0;
ws.onmessage = event => {
  const message = JSON.parse(event.data);
  if (pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
};
await new Promise(resolve => { ws.onopen = resolve; });
const send = (method, params = {}) => new Promise(resolve => {
  const requestId = ++id;
  pending.set(requestId, resolve);
  ws.send(JSON.stringify({ id: requestId, method, params }));
});
await send('Page.navigate', { url: 'http://127.0.0.1:4173/' });
await new Promise(resolve => setTimeout(resolve, 1000));
const save = getDefaultSave();
save.player.name = '41本プレイ確認';
save.player.collection.gotomonIds = ['HKD-E01', 'HKD-E02'];
save.meta.compatibilityEntries = { tutorial_seen_title: '1' };
const serialized = JSON.stringify(save);
const expression = `(()=>{const value=${JSON.stringify(serialized)};localStorage.setItem('krb_save',value);localStorage.setItem('yomitabi_confirmed_1',value);localStorage.setItem('bgmVolume','0');localStorage.setItem('seVolume','0');return localStorage.getItem('krb_save')===localStorage.getItem('yomitabi_confirmed_1')})()`;
const result = await send('Runtime.evaluate', { expression, returnByValue: true });
if (!result.result?.result?.value) throw new Error('test save was not written');
await send('Page.reload');
ws.close();
console.log('CDP test save prepared');
