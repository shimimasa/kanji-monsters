// Prints the two lesson sheets through the dedicated Chrome on port 9333 for layout QA.
import fs from 'node:fs';
import path from 'node:path';

const pages = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = pages.find(item => item.type === 'page');
if (!page) throw new Error('CDP page not found');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(resolve => { ws.onopen = resolve; });
let id = 0;
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const requestId = ++id;
  const onMessage = event => {
    const message = JSON.parse(event.data);
    if (message.id !== requestId) return;
    ws.removeEventListener('message', onMessage);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  };
  ws.addEventListener('message', onMessage);
  ws.send(JSON.stringify({ id: requestId, method, params }));
});
const folder = path.resolve('tmp/pdfs');
fs.mkdirSync(folder, { recursive: true });
for (const slug of ['kururu', 'hitotsubu']) {
  await send('Page.navigate', { url: `http://localhost:4173/lessons/gotomon/${slug}-sheet.html` });
  await new Promise(resolve => setTimeout(resolve, 500));
  const pdf = await send('Page.printToPDF', {
    printBackground: true, paperWidth: 8.27, paperHeight: 11.69,
    marginTop: .35, marginBottom: .35, marginLeft: .35, marginRight: .35,
  });
  const target = path.join(folder, `${slug}-sheet.pdf`);
  fs.writeFileSync(target, Buffer.from(pdf.data, 'base64'));
  console.log(target);
}
ws.close();
