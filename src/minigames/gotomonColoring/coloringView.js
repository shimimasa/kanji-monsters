import { createArcadeFrame, restartClass, bindArcadeKeys } from '../arcade/arcadeKit.js';
import { COLORING_RULES as R } from './coloringGame.js';

const CSS = `
#gotomonColoringScreen .ya-field{background:radial-gradient(circle at 15% 20%,#fff 0 6%,transparent 7%),linear-gradient(#fff8ec,#f3e3c8)}
#gotomonColoringScreen .cl-board{position:absolute;left:50%;top:58px;bottom:1.5%;aspect-ratio:1;max-width:96%;transform:translateX(-50%);display:grid;grid-template-columns:repeat(${R.size},1fr);grid-template-rows:repeat(${R.size},1fr);gap:2px;padding:6px;border-radius:14px;background:#fffdf6;box-shadow:0 6px 0 #d9c29a,inset 0 0 0 3px #e8d6b0}
#gotomonColoringScreen .cl-cell{display:grid;place-items:center;min-width:0;min-height:0;padding:0;border:0;border-radius:4px;background:#f1ece2;color:#3a2a1a;font:inherit;font-size:clamp(9px,min(2.6vw,2.2vh),18px);font-weight:900;letter-spacing:-.04em;line-height:1;cursor:pointer;touch-action:manipulation;box-shadow:inset 0 0 0 1px #d9cdb8}
#gotomonColoringScreen .cl-cell[data-empty=true]{background:transparent;box-shadow:none;cursor:default}
#gotomonColoringScreen .cl-cell[data-painted=true]{background:var(--paint);color:transparent;box-shadow:none;cursor:default}
#gotomonColoringScreen .cl-cell.cl-pop{animation:cl-pop .3s ease-out}
#gotomonColoringScreen .cl-cell.cl-no{animation:cl-no .4s ease-out}
#gotomonColoringScreen .cl-cell:focus-visible{outline:3px solid #2a6fb0;outline-offset:1px}
#gotomonColoringScreen .cl-reveal{position:absolute;inset:6px;width:calc(100% - 12px);height:calc(100% - 12px);object-fit:contain;opacity:0;pointer-events:none;filter:drop-shadow(0 6px 6px #0004)}
#gotomonColoringScreen .cl-reveal[data-shown=true]{animation:cl-reveal 1.6s ease-out forwards}
#gotomonColoringScreen .cl-title{margin:0;text-align:center;font-size:14px;font-weight:900;color:#ffe2b8}
#gotomonColoringScreen .cl-ask{margin:0;text-align:center;color:#fff;font-size:15px;font-weight:800;line-height:1.5}
#gotomonColoringScreen .cl-palette{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
#gotomonColoringScreen .cl-color{display:flex;flex-direction:column;align-items:center;gap:4px;min-height:84px;padding:6px;border:3px solid transparent;border-radius:14px;background:#ffffff14;color:#fff;font:inherit;cursor:pointer;touch-action:manipulation}
#gotomonColoringScreen .cl-color[aria-pressed=true]{border-color:#ffe066;background:#ffffff2a}
#gotomonColoringScreen .cl-color i{display:block;width:40px;height:28px;border-radius:8px;background:var(--paint);box-shadow:inset 0 0 0 2px #fff8}
#gotomonColoringScreen .cl-color b{font-size:clamp(20px,2.8vw,28px);line-height:1}
#gotomonColoringScreen .cl-color small{font-size:12px;opacity:.85}
#gotomonColoringScreen .cl-color[data-done=true]{opacity:.45}
@keyframes cl-pop{0%{transform:scale(1.35)}100%{transform:none}}
@keyframes cl-no{0%,100%{transform:none}30%{transform:translateX(-3px)}60%{transform:translateX(3px)}}
@keyframes cl-reveal{0%{opacity:0;transform:scale(.8)}60%{opacity:1;transform:scale(1.05)}100%{opacity:1;transform:none}}
`;

export function createColoringView({ document: doc, dispatch, onBack, getSnapshot }) {
  let active = true, lastEventId = 0, doneShown = false, shownTap = 0, built = false;
  const removes = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'gotomonColoringScreen', title: 'ゴトモンぬりえ', theme: 'coloring' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });

  const board = el('div', 'cl-board'); board.setAttribute('aria-label', 'ぬりえ');
  const reveal = el('img', 'cl-reveal'); reveal.alt = '';
  world.append(board);
  const cellNodes = new Map();

  const title = el('p', 'cl-title');
  const ask = el('p', 'cl-ask'); ask.dataset.role = 'problem';
  const palette = el('div', 'cl-palette'); palette.setAttribute('aria-label', 'いろ');
  const swatches = [];
  const note = el('p', 'ya-dock-note'); note.dataset.role = 'feedback';
  dock.append(title, ask, palette, note);
  doc.body.append(root);

  const session = () => getSnapshot();
  function paint(cellId) {
    const state = session();
    if (!active || state.paused || state.phase !== 'answering') return false;
    return dispatch({ type: 'paint', payload: { sessionId: state.sessionId, attemptId: state.attemptId, cellId } });
  }
  function choose(color) {
    const state = session();
    if (!active || state.paused || state.phase !== 'answering') return false;
    return dispatch({ type: 'choose', payload: { sessionId: state.sessionId, color } });
  }
  removes.push(bindArcadeKeys(doc, event => { const k = ['1', '2', '3'].indexOf(event.key); return k >= 0 ? choose(k) : false; }));

  // The board is built once: a button for every square to paint, blanks elsewhere.
  const build = state => {
    built = true;
    const byIndex = new Map(state.cells.map(cell => [cell.index, cell]));
    for (let index = 0; index < R.size * R.size; index++) {
      const cell = byIndex.get(index);
      if (!cell) { const blank = el('i', 'cl-cell'); blank.dataset.empty = 'true'; board.append(blank); continue; }
      const node = el('button', 'cl-cell', cell.label); node.type = 'button';
      node.style.setProperty?.('--paint', state.picture.palette[cell.color]);
      node.setAttribute('aria-label', cell.label);
      on(node, 'click', () => paint(cell.cellId)); board.append(node); cellNodes.set(cell.cellId, node);
    }
    board.append(reveal);
    state.values.forEach((value, color) => {
      const node = el('button', 'cl-color'), chip = el('i'), number = el('b', '', `＝${value}`), count = el('small');
      node.type = 'button'; chip.style.setProperty?.('--paint', state.picture.palette[color]);
      node.append(chip, number, count); node.setAttribute('aria-label', `答えが${value}の色`);
      on(node, 'click', () => choose(color)); palette.append(node); swatches.push({ node, count });
    });
    title.textContent = `${state.picture.name}のぬりえ`;
  };
  const render = state => {
    if (!built) build(state);
    for (const cell of state.cells) {
      const node = cellNodes.get(cell.cellId), done = String(cell.painted);
      if (node && node.dataset.painted !== done) { node.dataset.painted = done; node.disabled = cell.painted; if (cell.painted) restartClass(node, 'cl-pop'); }
    }
    swatches.forEach(({ node, count }, color) => {
      const pressed = String(state.selected === color);
      if (node.getAttribute('aria-pressed') !== pressed) node.setAttribute('aria-pressed', pressed);
      const text = state.left[color] ? `のこり ${state.left[color]}` : 'ぬりおわり';
      if (count.textContent !== text) count.textContent = text;
      node.dataset.done = String(!state.left[color]);
    });
    const text = state.phase === 'completed' ? '' : `答えが ${state.values[state.selected]} になるマスを、タップしてぬろう（${state.painted}/${state.total}）`;
    if (ask.textContent !== text) ask.textContent = text;
  };
  const showTap = state => {
    const tap = state.lastTap, node = cellNodes.get(tap.cellId);
    if (tap.correct) {
      if (!tap.first) note.textContent = `ぬれた！「${tap.label}」は ${tap.value}`;
      else if (note.textContent.startsWith('「')) note.textContent = '';
    } else {
      if (node) restartClass(node, 'cl-no');
      note.textContent = `「${tap.label}」は ${tap.value}。えらんでいる色は ${tap.chosenValue} だよ`;
      frame.announce(note.textContent);
    }
  };

  return {
    root,
    attachCompanion(portrait) { const buddy = el('div'); buddy.style.cssText = 'position:absolute;left:3%;bottom:3%;width:64px;height:64px;pointer-events:none'; buddy.append(portrait); world.append(buddy); },
    focusPlay() { swatches[0]?.node.focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      if (!state.cells?.length || !state.picture) return;
      render(state);
      if (state.lastTap && state.lastTap.tap !== shownTap) { shownTap = state.lastTap.tap; showTap(state); }
      if (state.result && !doneShown) {
        doneShown = true;
        if (state.picture.imageUrl) { reveal.src = state.picture.imageUrl; reveal.dataset.shown = 'true'; }
        fx.banner(`${state.picture.name} かんせい！`, 'great'); fx.burst(50, 50, 'great', 2);
        note.textContent = `ぬりえ かんせい！ ${state.picture.name}があらわれた！`;
      }
    },
    present(play, dt, state) {
      if (!active || !state) return;
      frame.tick(dt);
      const w = play.world || {};
      const event = w.lastEvent;
      if (event && event.id !== lastEventId) {
        lastEventId = event.id;
        if (event.type === 'boost') { fx.banner('ぬりぬりフィーバー！', 'great'); fx.flash('great'); }
      }
      const mission = w.challenge;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: Math.min(1, (state.painted ?? 0) / (state.total || 1)), progressLabel: `ぬった ${state.painted ?? 0}/${state.total ?? 0}`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; [...cellNodes.values(), ...swatches.map(item => item.node)].forEach(node => { node.disabled = true; }); },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
