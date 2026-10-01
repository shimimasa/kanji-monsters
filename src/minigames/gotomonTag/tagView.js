import { createArcadeFrame, bindArcadeKeys } from '../arcade/arcadeKit.js';
import { castAt } from '../gotomonCast.js';
import Speech from '../../audio/speech.js';
import { TAG_RULES as R } from './tagGame.js';

// The board shows the maze with half a cell of room above and below and one cell at the
// sides, so the plates in the side pockets can stick out. Cell (r, c) is at
// left = (c + 1) / W, top = (r + 0.5) / H of the board.
const ROWS = R.board.length, COLS = R.board[0].length, W = COLS + 2, H = ROWS + 1;
const left = x => `${(x + 1) / W * 100}%`, top = y => `${(y + 0.5) / H * 100}%`;
const CSS = `
#gotomonTagScreen .ya-field{background:radial-gradient(circle at 80% 15%,#ffffff10 0 8%,transparent 9%),linear-gradient(#1d3557,#16213e)}
#gotomonTagScreen .tg-board{position:absolute;left:50%;top:58px;bottom:1%;aspect-ratio:${W}/${H};max-width:98%;transform:translateX(-50%);touch-action:none;z-index:2}
#gotomonTagScreen .tg-cell{position:absolute;width:${100 / W}%;height:${100 / H}%;pointer-events:none}
#gotomonTagScreen .tg-wall{background:#4361ee;border-radius:22%;box-shadow:inset 0 0 0 2px #7b93ff,0 0 6px #4361ee88;transform:scale(.92)}
#gotomonTagScreen .tg-floor{background:#0b132b;border-radius:10%}
#gotomonTagScreen .tg-spark{display:grid;place-items:center}
#gotomonTagScreen .tg-spark::after{content:'';width:22%;aspect-ratio:1;border-radius:50%;background:#ffe066;box-shadow:0 0 6px #ffe066}
#gotomonTagScreen .tg-plate{position:absolute;transform:translate(-50%,-50%);min-width:${200 / W}%;max-width:${330 / W}%;padding:2px 6px;border-radius:12px;background:#fffdf6;border:3px solid #f4a261;color:#1b2a36;font-size:clamp(13px,2.6vh,22px);font-weight:900;line-height:1.1;text-align:center;box-shadow:0 3px 0 #9c5a1f;z-index:3;pointer-events:none}
#gotomonTagScreen .tg-plate[data-hint=true]{border-color:#37c871;box-shadow:0 3px 0 #1f9d55,0 0 0 4px #37c871,0 0 18px #37c871;animation:tg-glow .7s ease-in-out infinite alternate}
#gotomonTagScreen .tg-mover{position:absolute;width:${100 / W * 1.15}%;height:${100 / H * 1.15}%;transform:translate(-50%,-50%);pointer-events:none;z-index:4}
#gotomonTagScreen .tg-mover>*{width:100%!important;height:100%!important;object-fit:contain;filter:drop-shadow(0 3px 2px #0008)}
#gotomonTagScreen .tg-me{z-index:6}
#gotomonTagScreen .tg-me[data-safe=true]{animation:tg-blink .25s steps(2) infinite}
#gotomonTagScreen .tg-me[data-power=true]{filter:drop-shadow(0 0 8px #ffe066) drop-shadow(0 0 4px #fff)}
#gotomonTagScreen .tg-token{border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff,#ffcf5a)}
#gotomonTagScreen .tg-it[data-running=true] img{filter:hue-rotate(180deg) saturate(.6) brightness(1.2) drop-shadow(0 0 6px #8ecae6)}
#gotomonTagScreen .tg-it[data-running=true]::after{content:'にげる！';position:absolute;left:50%;top:-22%;transform:translateX(-50%);padding:0 4px;border-radius:6px;background:#8ecae6;color:#023047;font-size:10px;font-weight:900;white-space:nowrap}
#gotomonTagScreen .tg-it[data-waiting=true]{opacity:.45}
#gotomonTagScreen .tg-it img{animation:tg-step .3s ease-in-out infinite alternate}
#gotomonTagScreen .tg-party{position:absolute;right:1%;top:62px;display:flex;flex-direction:column;gap:2px;align-items:center;color:#e0e8ff;font-size:11px;font-weight:900;z-index:3}
#gotomonTagScreen .tg-party img{width:clamp(24px,4.4vh,38px);height:clamp(24px,4.4vh,38px);object-fit:contain;animation:tg-join .5s ease-out}
#gotomonTagScreen .tg-title{margin:0;text-align:center;font-size:14px;font-weight:900;color:#bfd7ff}
#gotomonTagScreen .tg-prompt{margin:0;padding:8px 12px;border-radius:14px;background:#ffffff14;color:#fff;text-align:center;font-size:clamp(20px,2.8vw,28px);font-weight:900;line-height:1.3}
#gotomonTagScreen .tg-prompt[data-power=true]{background:linear-gradient(90deg,#ffb703aa,#fb8500aa)}
#gotomonTagScreen .tg-prompt small{display:block;margin-top:4px;font-size:15px;font-weight:700;color:#d4e8ff}
#gotomonTagScreen .tg-prompt small b{color:#ffe066}
#gotomonTagScreen .tg-pad{display:grid;grid-template-columns:repeat(3,clamp(56px,7vw,72px));grid-template-rows:repeat(2,clamp(50px,7vh,62px));gap:6px;justify-content:center}
#gotomonTagScreen .tg-arrow{border:0;border-radius:12px;background:#ffffff26;color:#fff;font:inherit;font-size:24px;font-weight:900;cursor:pointer;touch-action:none}
#gotomonTagScreen .tg-arrow[data-on=true]{background:#ffe06655}
#gotomonTagScreen .tg-arrow[data-direction=up]{grid-column:2}
#gotomonTagScreen .tg-arrow[data-direction=left]{grid-column:1;grid-row:2}
#gotomonTagScreen .tg-arrow[data-direction=down]{grid-column:2;grid-row:2}
#gotomonTagScreen .tg-arrow[data-direction=right]{grid-column:3;grid-row:2}
@keyframes tg-glow{from{filter:brightness(1)}to{filter:brightness(1.15)}}
@keyframes tg-blink{from{opacity:1}to{opacity:.35}}
@keyframes tg-step{from{transform:translateY(0)}to{transform:translateY(-8%)}}
@keyframes tg-join{from{transform:scale(.2);opacity:0}to{transform:none;opacity:1}}
`;

export function createTagView({ document: doc, dispatch, onBack, getSnapshot, cast }) {
  let active = true, lastEventId = 0, doneShown = false, shownTake = 0, shownTouch = 0, problemKey = null, plateKey = null, start = null;
  const removes = [], sparkNodes = new Map(), itNodes = new Map();
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'gotomonTagScreen', title: 'ゴトモンおにごっこ', theme: 'tag' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });

  const board = el('div', 'tg-board'); board.setAttribute('aria-label', '迷路');
  const place = (node, x, y) => { node.style.left = left(x); node.style.top = top(y); };
  R.board.forEach((line, r) => [...line].forEach((ch, c) => {
    const node = el('div', `tg-cell ${ch === '#' ? 'tg-wall' : 'tg-floor'}`);
    node.style.left = `${(c + 1) / W * 100}%`; node.style.top = `${r / H * 100}%`; board.append(node);
    if (ch === '.') { const spark = el('div', 'tg-cell tg-spark'); spark.style.left = node.style.left; spark.style.top = node.style.top; board.append(spark); sparkNodes.set(r * COLS + c, spark); }
  }));
  const plateNodes = [0, 1, 2, 3].map(() => { const node = el('div', 'tg-plate'); node.hidden = true; board.append(node); return node; });
  const me = el('div', 'tg-mover tg-me'), token = el('div', 'tg-token'); me.append(token); board.append(me);
  const party = el('div', 'tg-party'); party.append(el('span', '', 'なかま'));
  world.append(board, party);

  const send = direction => {
    const state = getSnapshot();
    if (!active || state.paused || state.phase !== 'answering') return false;
    return dispatch({ type: 'move', payload: { sessionId: state.sessionId, attemptId: state.attemptId, direction } });
  };
  // A swipe anywhere on the field turns that way.
  on(world, 'pointerdown', event => { start = [event.clientX, event.clientY]; });
  const swipe = event => {
    if (!start) return;
    const dx = event.clientX - start[0], dy = event.clientY - start[1];
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    send(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    start = [event.clientX, event.clientY];
  };
  on(world, 'pointermove', swipe);
  on(world, 'pointerup', event => { swipe(event); start = null; });

  const title = el('p', 'tg-title');
  const prompt = el('p', 'tg-prompt'); prompt.dataset.role = 'problem';
  const pad = el('div', 'tg-pad'), arrows = [];
  for (const [direction, text, label] of [['up', '▲', 'うえ'], ['left', '◀', 'ひだり'], ['down', '▼', 'した'], ['right', '▶', 'みぎ']]) {
    const button = el('button', 'tg-arrow', text); button.type = 'button'; button.dataset.direction = direction;
    button.setAttribute('aria-label', label);
    on(button, 'pointerdown', event => { event.preventDefault?.(); send(direction); });
    on(button, 'click', event => { if (event.detail === 0) send(direction); });
    pad.append(button); arrows.push(button);
  }
  const note = el('p', 'ya-dock-note'); note.dataset.role = 'feedback';
  dock.append(title, prompt, pad, note);
  doc.body.append(root);
  removes.push(bindArcadeKeys(doc, event => {
    const direction = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[event.key];
    if (!direction) return false;
    send(direction); return true;
  }));

  const renderPrompt = state => {
    const key = state.problem?.problemId ?? (state.phase === 'completed' ? 'done' : state.ending ? 'end' : state.powerMs > 0 ? `power:${state.problemIndex}` : null);
    if (key === problemKey) return;
    problemKey = key;
    const power = !state.problem && state.phase !== 'completed';
    prompt.dataset.power = String(power);
    if (!state.problem) { prompt.textContent = state.phase === 'completed' ? 'おしまい！' : 'パワーアップ！ にげるゴトモンを タッチして なかまに しよう！'; return; }
    prompt.textContent = state.problem.prompt;
    if (state.problem.sentence) { const small = el('small'); small.append(el('span', '', state.problem.sentence.before), el('b', '', state.problem.prompt.match(/「(.+?)」/)?.[1] ?? ''), el('span', '', state.problem.sentence.after)); prompt.append(small); }
    if (state.problem.problemId.endsWith(':0')) {
      const word = state.problem.kind === 'en2ja' ? state.problem.prompt.split(' ')[0] : null;
      if (word) Speech.speakEnglish(word);
    }
  };
  const renderPlates = state => {
    const key = state.plates.map(plate => plate.plateId).join('|') + state.problemIndex;
    if (key !== plateKey) {
      plateKey = key;
      plateNodes.forEach((node, i) => {
        const plate = state.plates[i];
        node.hidden = !plate;
        if (!plate) return;
        node.textContent = plate.text; place(node, plate.c, plate.r);
      });
    }
    state.plates.forEach((plate, i) => {
      const node = plateNodes[i]; if (!node) return;
      if (plate.gone !== node.hidden) node.hidden = plate.gone;
      const hint = String(plate.plateId === state.hintPlateId);
      if (node.dataset.hint !== hint) node.dataset.hint = hint;
    });
  };
  const renderMovers = state => {
    place(me, state.player.x, state.player.y);
    me.dataset.safe = String(state.player.safe); me.dataset.power = String(state.powerMs > 0);
    const seen = new Set();
    for (const it of state.chasers) {
      seen.add(it.chaserId);
      let node = itNodes.get(it.chaserId);
      if (!node) {
        node = el('div', 'tg-mover tg-it');
        const who = castAt(cast?.wild, it.cast);
        if (who) { const img = el('img'); img.alt = ''; img.src = who.imageUrl; node.append(img); }
        else { const dot = el('i'); dot.style.cssText = 'display:block;border-radius:50%;background:#ff8fab'; node.append(dot); }
        board.append(node); itNodes.set(it.chaserId, node);
      }
      place(node, it.x, it.y);
      const running = String(it.running), waiting = String(it.waiting);
      if (node.dataset.running !== running) node.dataset.running = running;
      if (node.dataset.waiting !== waiting) node.dataset.waiting = waiting;
    }
    for (const [id, node] of itNodes) if (!seen.has(id)) { node.remove?.(); itNodes.delete(id); }
  };
  const renderSparkles = state => {
    const left = new Set(state.sparkles);
    for (const [k, node] of sparkNodes) { const gone = !left.has(k); if (node.hidden !== gone) node.hidden = gone; }
  };
  const showTake = state => {
    const t = state.lastTake, x = (t.c + 1) / W * 100, y = 8 + (t.r + 0.5) / H * 86;
    if (t.correct) {
      fx.burst(x, y, t.first ? 'great' : 'good', t.first ? 1.4 : 1.1); fx.banner('パワーアップ！', 'great');
      note.textContent = `せいかい！ ${t.explain}。いまのうちに ゴトモンを タッチ！`;
    } else {
      fx.pop(x, y, 'ざんねん', 'soft');
      note.textContent = `そのふだは「${t.text}」${t.note ? `（${t.note}）` : ''}。答えは「${t.answer}」。光るふだへ 行こう`;
    }
    frame.announce(note.textContent);
  };
  const showTouch = state => {
    const t = state.lastTouch, x = (t.x + 1) / W * 100, y = 8 + (t.y + 0.5) / H * 86;
    const who = castAt(cast?.wild, t.cast);
    if (t.kind === 'friend') {
      if (who) { const img = el('img'); img.alt = who.name; img.src = who.imageUrl; party.append(img); while (party.children.length > 9) party.children[1].remove(); }
      fx.pop(x, y, 'なかまに なった！', 'great');
      note.textContent = `${who ? who.name : 'ゴトモン'}が なかまに なった！`;
    } else {
      fx.pop(x, y, 'タッチされた！', 'soft'); fx.shake();
      note.textContent = `${who ? who.name : 'ゴトモン'}に タッチされた！ まんなかから もう一度。すこしの あいだ タッチされないよ`;
    }
    frame.announce(note.textContent);
  };

  return {
    root,
    // The companion runs in the maze.
    attachCompanion(portrait) { token.remove?.(); me.append(portrait); },
    focusPlay() { arrows[0]?.focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      if (!state.player) return;
      renderPrompt(state); renderPlates(state); renderMovers(state); renderSparkles(state);
      arrows.forEach(button => { const on = String(button.dataset.direction === state.player.wanted); if (button.dataset.on !== on) button.dataset.on = on; });
      if (state.lastTake && state.lastTake.take !== shownTake) { shownTake = state.lastTake.take; showTake(state); }
      if (state.lastTouch && state.lastTouch.touch !== shownTouch) { shownTouch = state.lastTouch.touch; showTouch(state); }
      const titleText = state.phase === 'completed' ? '' : `もんだい ${state.problemIndex + 1}/${state.total}　なかま ${state.friends}`;
      if (title.textContent !== titleText) title.textContent = titleText;
      if (state.result && !doneShown) {
        doneShown = true;
        fx.banner('おにごっこ おしまい！', 'great'); fx.burst(50, 45, 'great', 2);
        note.textContent = `12問 クリア！ なかま ${state.result.friends}ひき・きらきら ${state.result.sparkles}こ`;
      }
    },
    present(play, dt, state) {
      if (!active || !state) return;
      frame.tick(dt);
      const w = play.world || {};
      const event = w.lastEvent;
      if (event && event.id !== lastEventId) {
        lastEventId = event.id;
        if (event.type === 'boost') { fx.banner('おにごっこフィーバー！', 'great'); fx.flash('great'); }
      }
      const mission = w.challenge;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: Math.min(1, (state.answered ?? 0) / (state.total || 1)), progressLabel: state.result ? 'おしまい！' : `もんだい ${(state.problemIndex ?? 0) + 1}/${state.total ?? 0}`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; arrows.forEach(button => { button.disabled = true; }); },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
