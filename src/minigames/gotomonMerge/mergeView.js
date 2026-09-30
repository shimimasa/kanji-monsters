import { createArcadeFrame, restartClass, bindArcadeKeys } from '../arcade/arcadeKit.js';
import { castAt } from '../gotomonCast.js';
import { MERGE_RULES as R } from './mergeGame.js';

const N = R.size, CELL = 100 / N;
// Tile colours by size: small numbers pale, big numbers warm.
const COLORS = ['#fff4d6', '#ffe7b0', '#ffd08a', '#ffb366', '#ff9a52', '#ff7a45', '#f25c54', '#e0457b', '#b83c9e', '#7b3fbf'];
const tier = value => Math.max(0, Math.round(Math.log2(value)) - 1);
const CSS = `
#gotomonMergeScreen .ya-field{background:radial-gradient(circle at 15% 20%,#ffffff22 0 6%,transparent 7%),linear-gradient(#2d4a6b,#1f3450)}
#gotomonMergeScreen .mg-board{position:absolute;left:50%;top:58px;bottom:2%;aspect-ratio:1;max-width:94%;transform:translateX(-50%);border-radius:18px;background:#c9b79c;box-shadow:0 6px 0 #9c8a6e;touch-action:none;z-index:2}
#gotomonMergeScreen .mg-slot,#gotomonMergeScreen .mg-tile{position:absolute;width:calc(${CELL}% - 12px);height:calc(${CELL}% - 12px);margin:6px;border-radius:12px}
#gotomonMergeScreen .mg-slot{background:#e3d6c2}
#gotomonMergeScreen .mg-tile{display:grid;place-items:center;overflow:hidden;background:var(--c);box-shadow:0 3px 0 #0002;transition:left .12s ease-out,top .12s ease-out;z-index:2}
#gotomonMergeScreen .mg-tile img{position:absolute;inset:8%;width:84%;height:84%;object-fit:contain;opacity:.5}
#gotomonMergeScreen .mg-tile b{position:relative;color:#3a2a1a;font-size:clamp(20px,min(4vw,5.4vh),46px);font-weight:900;text-shadow:0 2px 0 #fff9,0 0 6px #fff}
#gotomonMergeScreen .mg-tile[data-big=true] b{color:#fff;text-shadow:0 2px 0 #0005}
#gotomonMergeScreen .mg-tile[data-question=true]{background:#fffdf6;box-shadow:0 0 0 4px #37a3ff,0 3px 0 #0002;animation:mg-ask 1s ease-in-out infinite alternate}
#gotomonMergeScreen .mg-tile[data-question=true] b{font-size:clamp(16px,min(2.8vw,3.8vh),32px);color:#1b4d80}
#gotomonMergeScreen .mg-tile[data-question=true] img{display:none}
#gotomonMergeScreen .mg-tile.mg-new{animation:mg-new .25s ease-out}
#gotomonMergeScreen .mg-tile.mg-pop{animation:mg-pop .25s ease-out}
#gotomonMergeScreen .mg-tile.mg-no{animation:mg-no .4s ease-out}
#gotomonMergeScreen .mg-tile.mg-gone{z-index:1;animation:mg-gone .16s ease-in forwards}
#gotomonMergeScreen .mg-title{margin:0;text-align:center;font-size:14px;font-weight:900;color:#bfe3ff}
#gotomonMergeScreen .mg-prompt{margin:0;padding:8px 12px;border-radius:14px;background:#ffffff14;color:#fff;text-align:center;font-size:clamp(22px,3vw,30px);font-weight:900}
#gotomonMergeScreen .mg-choices{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
#gotomonMergeScreen .mg-choice{min-height:64px;border:0;border-radius:14px;background:#fffdf6;color:#1b2a36;font:inherit;font-size:clamp(24px,3vw,32px);font-weight:900;box-shadow:0 4px 0 #9c8a6e;cursor:pointer;touch-action:manipulation}
#gotomonMergeScreen .mg-pad{display:grid;grid-template-columns:repeat(3,64px);grid-template-rows:repeat(2,56px);gap:6px;justify-content:center}
#gotomonMergeScreen .mg-arrow{border:0;border-radius:12px;background:#ffffff26;color:#fff;font:inherit;font-size:26px;font-weight:900;cursor:pointer;touch-action:manipulation}
#gotomonMergeScreen .mg-arrow[data-direction=up]{grid-column:2}
#gotomonMergeScreen .mg-arrow[data-direction=left]{grid-column:1;grid-row:2}
#gotomonMergeScreen .mg-arrow[data-direction=down]{grid-column:2;grid-row:2}
#gotomonMergeScreen .mg-arrow[data-direction=right]{grid-column:3;grid-row:2}
@keyframes mg-ask{from{box-shadow:0 0 0 4px #37a3ff,0 3px 0 #0002}to{box-shadow:0 0 0 7px #37a3ff88,0 3px 0 #0002}}
@keyframes mg-new{0%{transform:scale(.3)}100%{transform:none}}
@keyframes mg-pop{0%{transform:scale(1)}50%{transform:scale(1.2)}100%{transform:none}}
@keyframes mg-no{0%,100%{transform:none}30%{transform:translateX(-5px)}60%{transform:translateX(5px)}}
@keyframes mg-gone{to{transform:scale(.6);opacity:0}}
`;

export function createMergeView({ document: doc, dispatch, onBack, getSnapshot, cast }) {
  let active = true, lastEventId = 0, doneShown = false, shownAnswer = 0, shownMove = 0, problemKey = null, start = null;
  const removes = [], nodes = new Map(), bestShown = new Set();
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'gotomonMergeScreen', title: 'けいさん2048', theme: 'merge' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });

  const board = el('div', 'mg-board'); board.setAttribute('aria-label', 'ばん');
  for (let row = 0; row < N; row++) for (let column = 0; column < N; column++) {
    const slot = el('i', 'mg-slot'); slot.style.left = `${column * CELL}%`; slot.style.top = `${row * CELL}%`; board.append(slot);
  }
  world.append(board);
  // A swipe on the board slides the tiles.
  on(board, 'pointerdown', event => { start = [event.clientX, event.clientY]; });
  on(board, 'pointerup', event => {
    if (!start) return;
    const dx = event.clientX - start[0], dy = event.clientY - start[1]; start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    slide(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });

  const title = el('p', 'mg-title');
  const prompt = el('p', 'mg-prompt'); prompt.dataset.role = 'problem';
  const choices = el('div', 'mg-choices'), choiceButtons = [];
  for (let i = 0; i < R.choices; i++) {
    const button = el('button', 'mg-choice'); button.type = 'button';
    on(button, 'click', () => answer(button.dataset.choice)); choices.append(button); choiceButtons.push(button);
  }
  const pad = el('div', 'mg-pad'), arrows = [];
  for (const [direction, text] of [['up', '↑'], ['left', '←'], ['down', '↓'], ['right', '→']]) {
    const button = el('button', 'mg-arrow', text); button.type = 'button'; button.dataset.direction = direction;
    button.setAttribute('aria-label', { up: 'うえ', left: 'ひだり', down: 'した', right: 'みぎ' }[direction]);
    on(button, 'click', () => slide(direction)); pad.append(button); arrows.push(button);
  }
  const note = el('p', 'ya-dock-note'); note.dataset.role = 'feedback';
  dock.append(title, prompt, choices, pad, note);
  doc.body.append(root);

  function answer(choiceId) {
    const state = getSnapshot();
    if (!active || state.paused || state.phase !== 'answering' || !choiceId) return false;
    return dispatch({ type: 'answer', payload: { sessionId: state.sessionId, attemptId: state.attemptId, choiceId } });
  }
  function slide(direction) {
    const state = getSnapshot();
    if (!active || state.paused || state.phase !== 'sliding') return false;
    const moved = dispatch({ type: 'slide', payload: { sessionId: state.sessionId, attemptId: state.attemptId, direction } });
    if (!moved) { note.textContent = 'そっちには うごかないよ。ほかの向きにしてみよう'; nodes.forEach(node => restartClass(node, 'mg-no')); }
    return moved;
  }
  removes.push(bindArcadeKeys(doc, event => {
    const direction = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[event.key];
    if (direction) { slide(direction); return true; }
    const k = ['1', '2', '3', '4'].indexOf(event.key);
    return k >= 0 ? answer(choiceButtons[k]?.dataset.choice) : false;
  }));

  const who = value => castAt(cast?.wild?.length ? cast.wild : cast?.friends, tier(value));
  const paint = (node, tile) => {
    const key = `${tile.value}:${tile.question ?? ''}`;
    if (node.dataset.key === key) return;
    node.dataset.key = key; node.textContent = '';
    node.dataset.question = String(!!tile.question); node.dataset.big = String(tile.value >= 64);
    node.style.setProperty?.('--c', COLORS[Math.min(COLORS.length - 1, tier(tile.value))]);
    const friend = who(tile.value);
    if (friend && !tile.question) { const img = el('img'); img.alt = ''; img.src = friend.imageUrl; node.append(img); }
    node.append(el('b', '', tile.question ? `${tile.question}` : String(tile.value)));
    node.setAttribute('aria-label', tile.question ? `${tile.question} は？` : `${tile.value}${friend ? ` ${friend.name}` : ''}`);
  };
  const renderTiles = state => {
    const seen = new Set();
    for (const tile of state.tiles) {
      seen.add(tile.tileId);
      let node = nodes.get(tile.tileId);
      if (!node) { node = el('div', 'mg-tile'); board.append(node); nodes.set(tile.tileId, node); restartClass(node, 'mg-new'); }
      node.style.left = `${tile.column * CELL}%`; node.style.top = `${tile.row * CELL}%`;
      paint(node, tile);
    }
    for (const [id, node] of nodes) {
      if (seen.has(id)) continue;
      const gone = state.lastMove?.gone.find(item => item.tileId === id);
      if (gone) { node.style.left = `${gone.column * CELL}%`; node.style.top = `${gone.row * CELL}%`; }
      nodes.delete(id); node.classList?.add('mg-gone');
      node.addEventListener?.('animationend', () => node.remove?.());
    }
  };
  const renderDock = state => {
    const answering = state.phase === 'answering', sliding = state.phase === 'sliding';
    choices.hidden = !answering; pad.hidden = !sliding;
    const key = `${state.phase}:${state.problem?.problemId ?? ''}`;
    if (key !== problemKey) {
      problemKey = key;
      if (answering) {
        prompt.textContent = state.problem.prompt;
        state.problem.choices.forEach((choice, i) => { choiceButtons[i].textContent = choice.text; choiceButtons[i].dataset.choice = choice.choiceId; });
      } else prompt.textContent = sliding ? 'スワイプで うごかそう！' : state.phase === 'completed' ? 'おしまい！' : '';
    }
    const titleText = state.phase === 'completed' ? '' : `もんだい ${state.asked}/${state.questions}　いちばん大きい ${state.best}`;
    if (title.textContent !== titleText) title.textContent = titleText;
  };
  const showAnswer = state => {
    const a = state.lastAnswer, node = nodes.get(a.tileId);
    if (a.correct) { fx.pop(50, 45, 'せいかい！', 'good'); note.textContent = `${a.label} = ${a.value}！ 同じ数と合体させよう`; }
    else { note.textContent = `${a.label} は ${a.value}（${a.chosen} ではないよ）。${a.value}のタイルになったよ`; }
    if (node) restartClass(node, 'mg-pop');
    frame.announce(note.textContent);
  };
  const showMove = state => {
    const move = state.lastMove;
    for (const id of move.mergedIds) { const node = nodes.get(id); if (node) restartClass(node, 'mg-pop'); }
    if (move.joined) {
      fx.burst(50, 50, 'great', move.joined > 1 ? 1.5 : 1.1);
      fx.pop(50, 40, move.joined > 1 ? `${move.joined}こ合体！` : '合体！', 'great');
    }
    if (!bestShown.has(move.best) && move.best >= 16 && move.joined) {
      bestShown.add(move.best);
      const friend = who(move.best);
      note.textContent = `${move.best} ができた！${friend ? ` ${friend.name}になったよ` : ''}`;
    }
  };

  return {
    root,
    attachCompanion(portrait) { const buddy = el('div'); buddy.style.cssText = 'position:absolute;left:2%;bottom:2%;width:64px;height:64px;pointer-events:none;z-index:1'; buddy.append(portrait); world.append(buddy); },
    focusPlay() { choiceButtons[0]?.focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      if (!state.tiles) return;
      renderTiles(state); renderDock(state);
      if (state.lastAnswer && state.lastAnswer.answer !== shownAnswer) { shownAnswer = state.lastAnswer.answer; showAnswer(state); }
      if (state.lastMove && state.lastMove.move !== shownMove) { shownMove = state.lastMove.move; showMove(state); }
      if (state.result && !doneShown) {
        doneShown = true;
        const friend = who(state.result.best);
        fx.banner(`いちばん大きい ${state.result.best}！`, 'great'); fx.burst(50, 50, 'great', 2);
        note.textContent = `${state.result.full ? 'ばんがいっぱいになったよ。' : ''}いちばん大きいのは ${state.result.best}${friend ? `（${friend.name}）` : ''}。合体 ${state.result.merges}回！`;
      }
    },
    present(play, dt, state) {
      if (!active || !state) return;
      frame.tick(dt);
      const w = play.world || {};
      const event = w.lastEvent;
      if (event && event.id !== lastEventId) {
        lastEventId = event.id;
        if (event.type === 'boost') { fx.banner('がったいフィーバー！', 'great'); fx.flash('great'); }
      }
      const mission = w.challenge;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: Math.min(1, (state.answered ?? 0) / (state.questions || 1)), progressLabel: `もんだい ${state.asked ?? 0}/${state.questions ?? 0}`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; [...choiceButtons, ...arrows].forEach(button => { button.disabled = true; }); },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
