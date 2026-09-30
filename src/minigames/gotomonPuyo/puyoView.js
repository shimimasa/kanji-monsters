import { createArcadeFrame, restartClass, bindArcadeKeys } from '../arcade/arcadeKit.js';
import { castAt } from '../gotomonCast.js';
import { PUYO_RULES as R } from './puyoGame.js';

const pctX = column => `${((column + 0.5) / R.columns * 100).toFixed(3)}%`;
const pctY = row => `${((row + 0.5) / R.rows * 100).toFixed(3)}%`;
// The eggs all look alike (no colour per answer), so the child matches them by
// working out each calculation.
const CSS = `
#gotomonPuyoScreen .ya-field{background:radial-gradient(circle at 18% 22%,#fff6 0 5%,transparent 6%),radial-gradient(circle at 82% 30%,#fff5 0 4%,transparent 5%),linear-gradient(#ffe6f0,#ffd1e2 55%,#f7b8d0)}
#gotomonPuyoScreen .pu-well{position:absolute;left:50%;top:58px;bottom:1.5%;aspect-ratio:${R.columns}/${R.rows};max-width:96%;transform:translateX(-50%);border-radius:14px;background:#ffffffaa;box-shadow:inset 0 0 0 3px #e79ab8,0 6px 0 #d27a9e;touch-action:none;cursor:pointer}
#gotomonPuyoScreen .pu-col{position:absolute;top:0;bottom:0;width:${(100 / R.columns).toFixed(3)}%;transform:translateX(-50%);background:transparent}
#gotomonPuyoScreen .pu-col[data-aim=true]{background:linear-gradient(#fff0,#ffe06655)}
#gotomonPuyoScreen .pu-egg{position:absolute;width:${(100 / R.columns * 0.94).toFixed(3)}%;aspect-ratio:.86;transform:translate(-50%,-50%);display:grid;place-items:center;border-radius:50% 50% 46% 46%/58% 58% 42% 42%;background:radial-gradient(circle at 34% 26%,#fff 0 12%,#fffaf0 13% 60%,#f1dcc0 100%);box-shadow:inset 0 -4px 0 #0001,0 3px 3px #0003;color:#3a2400;font-weight:900;font-size:clamp(11px,min(1.9vw,2.4vh),20px);letter-spacing:-.03em;line-height:1;pointer-events:none;transition:top .12s linear,left .08s linear}
#gotomonPuyoScreen .pu-egg::before{content:'';position:absolute;inset:18% 12% auto;height:22%;background:radial-gradient(circle at 20% 50%,#f7b8d0 0 18%,transparent 20%),radial-gradient(circle at 70% 40%,#a8d8ff 0 14%,transparent 16%);opacity:.8}
#gotomonPuyoScreen .pu-egg span{position:relative}
#gotomonPuyoScreen .pu-egg[data-falling=true]{box-shadow:0 0 0 3px #ffb627,0 4px 6px #0004;z-index:3}
#gotomonPuyoScreen .pu-ghost{position:absolute;width:${(100 / R.columns * 0.9).toFixed(3)}%;aspect-ratio:.86;transform:translate(-50%,-50%);border-radius:50% 50% 46% 46%/58% 58% 42% 42%;border:3px dashed #d27a9e88;pointer-events:none}
#gotomonPuyoScreen .pu-egg.pu-found{box-shadow:0 0 0 3px #37c871,0 0 12px #37c871}
#gotomonPuyoScreen .pu-egg.pu-crack{animation:pu-crack .45s ease-in forwards}
#gotomonPuyoScreen .pu-hatch{position:absolute;width:${(100 / R.columns * 1.3).toFixed(3)}%;aspect-ratio:1;transform:translate(-50%,-50%);pointer-events:none;z-index:4;animation:pu-fly 1.3s ease-out forwards}
#gotomonPuyoScreen .pu-hatch img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 3px 3px #0005)}
#gotomonPuyoScreen .pu-buddy{width:44px;height:44px;flex:none}
#gotomonPuyoScreen .pu-buddy .gt-portrait{display:block;width:100%;height:100%;background:none;border:0}
#gotomonPuyoScreen .pu-buddy .gt-portrait img{width:100%;height:100%;object-fit:contain}
#gotomonPuyoScreen .pu-title{margin:0;text-align:center;font-size:14px;font-weight:900;color:#ffd1e2}
#gotomonPuyoScreen .pu-now{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:8px;margin:0;padding:8px;border-radius:14px;background:#ffffff14;color:#fff;font-size:13px;font-weight:800;white-space:nowrap}
#gotomonPuyoScreen .pu-now b{display:inline-block;padding:4px 10px;border-radius:12px;background:#fffaf0;color:#3a2400;font-size:clamp(18px,2.3vw,24px);text-align:center;white-space:nowrap}
#gotomonPuyoScreen .pu-next{flex-basis:100%;display:flex;justify-content:center;align-items:center;gap:6px;opacity:.75;font-size:12px}
#gotomonPuyoScreen .pu-next b{padding:2px 8px;font-size:14px}
#gotomonPuyoScreen .pu-pad{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
#gotomonPuyoScreen .pu-pad button{min-height:52px;border:0;border-radius:14px;background:#fffaf0;color:#3a2400;font:inherit;font-size:18px;font-weight:900;box-shadow:0 4px 0 #d9b98f;cursor:pointer;touch-action:manipulation}
#gotomonPuyoScreen .pu-pad button[data-act=drop]{background:#ffb627;box-shadow:0 4px 0 #b57500}
#gotomonPuyoScreen .pu-pad button:disabled{opacity:.45}
#gotomonPuyoScreen .pu-review{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px}
#gotomonPuyoScreen .pu-review li{padding:6px 10px;border-radius:10px;background:#eef6ef;font-weight:700}
@media (max-width:700px){#gotomonPuyoScreen .pu-well{top:86px}#gotomonPuyoScreen .pu-pad button{min-height:46px}}
@keyframes pu-crack{0%{transform:translate(-50%,-50%)}40%{transform:translate(-50%,-50%) rotate(-10deg) scale(1.1)}100%{transform:translate(-50%,-50%) scale(.2);opacity:0}}
@keyframes pu-fly{0%{transform:translate(-50%,-50%) scale(.3);opacity:0}30%{transform:translate(-50%,-80%) scale(1.15);opacity:1}100%{transform:translate(-50%,-320%) scale(.9);opacity:0}}
`;

export function createPuyoView({ document: doc, dispatch, onBack, getSnapshot, cast }) {
  let active = true, lastSeq = -1, lastEventId = 0, doneShown = false, shownPiece = null, version = -1, pieceKey = null, hatchSerial = 0;
  const removes = [], transient = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'gotomonPuyoScreen', title: 'けいさんぷよ', theme: 'puyo' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });

  const well = el('div', 'pu-well'); well.setAttribute('aria-label', 'たまごの井戸');
  const columns = Array.from({ length: R.columns }, (_, column) => { const node = el('i', 'pu-col'); node.style.left = pctX(column); well.append(node); return node; });
  const ghosts = [el('i', 'pu-ghost'), el('i', 'pu-ghost')];
  const falling = [el('div', 'pu-egg'), el('div', 'pu-egg')];
  falling.forEach(node => { node.dataset.falling = 'true'; node.append(el('span')); });
  well.append(...ghosts, ...falling); world.append(well);
  const settled = new Map();

  const title = el('p', 'pu-title');
  const now = el('p', 'pu-now'); now.dataset.role = 'problem';
  const nowA = el('b'), nowB = el('b'), nextBox = el('span', 'pu-next'), nextA = el('b'), nextB = el('b');
  nextBox.append(el('span', '', 'つぎ '), nextA, nextB); now.append(el('span', '', 'いま'), nowA, nowB, nextBox);
  const pad = el('div', 'pu-pad');
  const button = (text, act, label) => { const node = el('button', '', text); node.type = 'button'; node.dataset.act = act; node.setAttribute('aria-label', label); on(node, 'click', () => command(act)); pad.append(node); return node; };
  const buttons = [button('◀', 'left', '左へ'), button('▶', 'right', '右へ'), button('くるっ', 'rotate', '回す'), button('おとす', 'drop', 'おとす')];
  // The shell advances after feedback; this stays hidden and only serves hosts without auto-advance.
  const go = el('button', 'pu-go', 'つぎへ'); go.type = 'button'; go.dataset.action = 'next'; go.hidden = true;
  on(go, 'click', () => proceed());
  const note = el('p', 'ya-dock-note'); note.dataset.role = 'feedback';
  dock.append(title, now, pad, note, go);
  const review = el('div', 'ya-learning-result'); review.hidden = true;
  const reviewList = el('ol', 'pu-review'); review.append(el('h3', '', 'かえったゴトモン'), reviewList); frame.shell.append(review);
  doc.body.append(root);
  const hatchedList = [];

  const session = () => getSnapshot();
  function command(act, extra = {}) {
    const state = session();
    if (!active || state.paused || state.phase !== 'answering') return false;
    const payload = { sessionId: state.sessionId, attemptId: state.attemptId, ...extra };
    if (act === 'left' || act === 'right') return dispatch({ type: 'shift', payload: { ...payload, direction: act === 'left' ? -1 : 1 } });
    return dispatch({ type: act, payload });
  }
  function proceed() {
    const state = session();
    if (!active || state.paused || state.phase !== 'feedback') return false;
    return dispatch({ type: 'next', payload: { sessionId: state.sessionId } });
  }
  // Tapping a column moves the pair there; tapping its own column turns it.
  on(well, 'pointerdown', event => {
    const state = session(), box = well.getBoundingClientRect?.();
    if (!state.piece || !box?.width || !Number.isFinite(event?.clientX)) return;
    const column = Math.min(R.columns - 1, Math.max(0, Math.floor((event.clientX - box.left) / box.width * R.columns)));
    if (column === state.piece.column) command('rotate'); else command('move', { column });
  });
  removes.push(bindArcadeKeys(doc, event => {
    const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'rotate', ArrowDown: 'drop', ' ': 'drop' };
    return map[event.key] ? command(map[event.key]) : false;
  }));

  const eggNode = e => { const node = el('div', 'pu-egg'); node.append(el('span', '', e.label)); node.setAttribute('aria-label', e.label); return node; };
  const later = (node, className, delay) => {
    node.style.animationDelay = `${delay}ms`; restartClass(node, className);
    node.addEventListener?.('animationend', () => { node.remove?.(); const at = transient.indexOf(node); if (at >= 0) transient.splice(at, 1); });
    transient.push(node); while (transient.length > 40) transient.shift().remove?.();
  };
  // Settled eggs are redrawn when the well changes; hatched eggs crack, wave by wave.
  const renderWell = state => {
    if (version === state.version) return;
    version = state.version;
    const alive = new Map();
    state.grid.forEach((row, r) => row.forEach((cell, c) => { if (cell) alive.set(cell.eggId, { cell, r, c }); }));
    const waves = state.lastAnswer?.waves ?? [], delayOf = new Map();
    waves.forEach((wave, i) => wave.flat().forEach(item => delayOf.set(item.eggId, 150 + i * 480)));
    for (const [id, node] of settled) if (!alive.has(id)) { settled.delete(id); later(node, 'pu-crack', delayOf.get(id) ?? 0); }
    for (const [id, { cell, r, c }] of alive) {
      let node = settled.get(id);
      if (!node) { node = eggNode(cell); settled.set(id, node); well.insertBefore?.(node, ghosts[0]) ?? well.append(node); }
      node.style.left = pctX(c); node.style.top = pctY(r);
    }
  };
  const renderPiece = state => {
    const piece = state.piece;
    falling.forEach((node, i) => {
      node.hidden = !piece; ghosts[i].hidden = !piece;
      if (!piece) return;
      const [row, column] = piece.cells[i];
      if (node.dataset.eggId !== piece.eggs[i].eggId) { node.dataset.eggId = piece.eggs[i].eggId; node.children[0].textContent = piece.eggs[i].label; }
      node.style.left = pctX(column); node.style.top = pctY(Math.max(0, row));
      const drop = piece.landing - piece.row;
      ghosts[i].style.left = pctX(column); ghosts[i].style.top = pctY(Math.max(0, row + drop));
    });
    columns.forEach((node, column) => { const aim = String(!!piece && piece.cells.some(([, c]) => c === column)); if (node.dataset.aim !== aim) node.dataset.aim = aim; });
    buttons.forEach(node => { node.disabled = !piece || state.paused; });
  };
  const renderDock = state => {
    const text = state.phase === 'completed' ? '' : `たまご ${Math.min(state.pieces, state.placed + (state.piece ? 1 : 0))}/${state.pieces}　かえったゴトモン ${state.hatched}`;
    if (title.textContent !== text) title.textContent = text;
    if (state.piece && pieceKey !== state.piece.pieceId) {
      pieceKey = state.piece.pieceId;
      nowA.textContent = state.piece.eggs[0].label; nowB.textContent = state.piece.eggs[1].label;
      nextA.textContent = state.upcoming?.[0]?.label ?? ''; nextB.textContent = state.upcoming?.[1]?.label ?? '';
      note.textContent = '同じ答えのたまごを3つつなげると、ゴトモンがうまれるよ';
    }
  };
  const showAnswer = state => {
    const answer = state.lastAnswer;
    answer.eggs.forEach(e => { const node = settled.get(e.eggId); if (node && e.found) restartClass(node, 'pu-found'); });
    if (answer.correct) {
      if (answer.hatchedNow) {
        const names = [];
        answer.waves.forEach((wave, i) => wave.forEach(group => {
          const who = castAt(cast?.wild, hatchSerial++), at = group[Math.floor(group.length / 2)];
          if (who) {
            names.push(who.name); hatchedList.push(who);
            const fly = el('div', 'pu-hatch'), img = el('img'); img.alt = ''; img.src = who.imageUrl; fly.append(img);
            fly.style.left = pctX(at.column); fly.style.top = pctY(at.row); well.append(fly); later(fly, 'pu-hatch', 150 + i * 480);
          }
        }));
        if (answer.chain >= 2) fx.banner(`${answer.chain}れんさ！`, 'great');
        note.textContent = names.length ? `パカッ！ ${[...new Set(names)].join('と')}が うまれた！` : `パカッ！ たまごが ${answer.hatchedNow}グループ かえった！`;
        fx.burst(50, 45, answer.chain >= 2 ? 'great' : 'good', answer.chain >= 2 ? 1.6 : 1.1);
      } else {
        const found = answer.eggs.find(e => e.found);
        note.textContent = `ぴったり！「${found.label}」は${found.value}。同じ答えがあと少しで かえるよ`;
      }
    } else {
      const [a, b] = answer.eggs;
      note.textContent = `「${a.label}」は${a.value}、「${b.label}」は${b.value}。同じ答えのたまごのとなりに おいてみよう`;
    }
    frame.announce(note.textContent);
  };

  return {
    root,
    attachCompanion(portrait) { const buddy = el('div', 'pu-buddy'); buddy.append(portrait); now.prepend(buddy); },
    focusPlay() { buttons[3].focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      if (!state.grid) return;
      renderWell(state);
      if (!state.result) { renderPiece(state); renderDock(state); }
      if (state.seq !== lastSeq) {
        lastSeq = state.seq;
        if (state.lastAnswer && state.lastAnswer.pieceId !== shownPiece) { shownPiece = state.lastAnswer.pieceId; showAnswer(state); }
      }
      if (state.result && !doneShown) {
        doneShown = true; review.hidden = false; reviewList.textContent = ''; renderPiece({ ...state, piece: null });
        const counts = new Map(); for (const who of hatchedList) counts.set(who.name, (counts.get(who.name) ?? 0) + 1);
        for (const [name, count] of counts) reviewList.append(el('li', '', `🥚 ${name}${count > 1 ? ` ×${count}` : ''}`));
        if (!counts.size) reviewList.append(el('li', '', `たまごを ${state.placed}組 つみあげた`));
      }
    },
    present(play, dt, state) {
      if (!active || !state) return;
      frame.tick(dt);
      const w = play.world || {};
      const event = w.lastEvent;
      if (event && event.id !== lastEventId) {
        lastEventId = event.id;
        if (event.type === 'boost') { fx.banner('ぷよフィーバー！', 'great'); fx.flash('great'); }
      }
      const mission = w.challenge;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: Math.min(1, (state.placed ?? 0) / (state.pieces || 1)), progressLabel: `たまご ${state.placed ?? 0}/${state.pieces ?? 0}`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; [...buttons, go].forEach(node => { node.disabled = true; }); },
    dispose() { this.stopInput(); transient.splice(0).forEach(node => node.remove?.()); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
