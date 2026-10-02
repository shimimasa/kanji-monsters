// node pushbot.mjs <seconds> [wrongCount] [help]: ゴトモン・おしだし (算数). Taps the answer box (or a wrong one first,
// wrongCount times), then reads the room from the screen, plans the pushes with the game's own solver and
// taps the squares next to the companion (real CDP taps). With "help" it waits for the companion instead.
import { solvePush, stepFrom, PUSH_RULES } from '../../../src/minigames/gotomonPush/pushGame.js';
const [secs = '400', wrongs = '0', mode = ''] = process.argv.slice(2);
const N = PUSH_RULES.size;
const list = await (await fetch('http://127.0.0.1:9333/json')).json();
const page = list.find(t => t.type === 'page' && t.url.includes('4173'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
await new Promise(r => ws.onopen = r);
const wait = ms => new Promise(r => setTimeout(r, ms));
const ev = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true })).result?.result?.value;
const tap = async (x, y) => { await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await wait(110); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }); };
// The room as the screen shows it: every thing's square from its left/top percentages.
const read = () => ev(`(()=>{const r=document.querySelector('#gotomonPushScreen');if(!r)return null;
  const at=n=>Math.round(parseFloat(n.style.top)/(100/${N}))*${N}+Math.round(parseFloat(n.style.left)/(100/${N}));
  const c=n=>{const b=n.getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]};
  const cells=[...r.querySelectorAll('.ps-cell')].map(c);
  return {prompt:r.querySelector('.ps-prompt').firstChild?.textContent||'',choosing:!r.querySelector('.ps-choices').hidden,pushing:!r.querySelector('.ps-controls').hidden,
    done:!!r.closest('body').querySelector('[data-action=build-review]')&&r.querySelector('.ps-title').textContent==='',
    help:!r.querySelector('.ps-help').hidden,helpAt:c(r.querySelector('.ps-help')),
    choices:[...r.querySelectorAll('.ps-choice')].map(b=>[b.textContent,b.disabled]),cells,
    rocks:[...r.querySelectorAll('.ps-rock')].map(at),goal:at(r.querySelector('.ps-nest')),player:at(r.querySelector('.ps-player')),
    boxes:[...r.querySelectorAll('.ps-box')].map(b=>({text:b.textContent,state:b.dataset.state,cell:at(b)}))}})()`);
let wrong = 0, taps = 0, rooms = 0, helped = 0;
const end = Date.now() + Number(secs) * 1000;
while (Date.now() < end) {
  const s = await read();
  if (!s || s.prompt === 'ぜんぶの へや クリア！') break;
  if (s.choosing) {
    const ans = String(eval(s.prompt.replace(' = ?', '').replace('−', '-').replace('×', '*')));
    let box = s.boxes.find(b => b.text === ans);
    if (wrong < Number(wrongs)) { box = s.boxes.find(b => b.text !== ans && b.state !== 'wrong'); wrong++; }
    const [x, y] = s.cells[box.cell];
    await wait(250); await tap(x, y); await wait(500); continue;
  }
  if (s.pushing && mode === 'help') {
    if (s.help) { await tap(...s.helpAt); helped++; rooms++; await wait(1800); } else await wait(1000);
    continue;
  }
  if (s.pushing) {
    const chosen = s.boxes.find(b => b.state === 'chosen');
    const blocked = new Set([...s.rocks, ...s.boxes.filter(b => b !== chosen).map(b => b.cell)]);
    const solved = solvePush({ blocked, box: chosen.cell, player: s.player, goal: s.goal });
    if (!solved) { console.log('no plan from', JSON.stringify(s)); break; }
    // Walk to the first push spot one square at a time, then push once; read the screen again.
    const step = solved.plan[0];
    const before = new Map([[s.player, null]]), queue = [s.player], walls = new Set([...blocked, chosen.cell]);
    while (queue.length) { const at = queue.shift(); for (const d of ['up', 'down', 'left', 'right']) { const to = stepFrom(at, d); if (to >= 0 && !walls.has(to) && !before.has(to)) { before.set(to, at); queue.push(to); } } }
    let next = step.from;
    if (s.player === step.from) next = stepFrom(s.player, step.direction);
    else while (before.get(next) !== s.player) next = before.get(next);
    await tap(...s.cells[next]); taps++; await wait(170);
    if ((await read())?.prompt === 'すあなに とどいた！') { rooms++; await wait(1600); }
    continue;
  }
  await wait(300);
}
console.log('rooms', rooms, 'taps', taps, 'wrong', wrong, 'helped', helped); process.exit(0);
