import { createArcadeFrame, restartClass, bindArcadeKeys } from '../arcade/arcadeKit.js';
import { castAt } from '../gotomonCast.js';
import Speech from '../../audio/speech.js';
import { TRACE_RULES as R, touching } from './traceGame.js';

const CSS = `
#gotomonTraceScreen .ya-field{background:radial-gradient(circle at 20% 20%,#ffe9a8 0 12%,transparent 13%),linear-gradient(#ffd6a5,#ffc6ff)}
#gotomonTraceScreen .tr-wrap{position:absolute;left:0;right:0;top:58px;bottom:6px;container-type:size;display:grid;place-items:center}
#gotomonTraceScreen .tr-stage{display:flex;flex-direction:column;align-items:center;gap:1.6cqh;width:min(96cqw,calc(100cqh * .78))}
#gotomonTraceScreen .tr-top{display:flex;align-items:center;gap:8px;width:100%}
#gotomonTraceScreen .tr-asker{width:clamp(40px,11cqh,84px);aspect-ratio:1;object-fit:contain;filter:drop-shadow(0 3px 2px #0004);animation:tr-bob 1.2s ease-in-out infinite alternate}
#gotomonTraceScreen .tr-buddy{width:clamp(40px,11cqh,84px);aspect-ratio:1}
#gotomonTraceScreen .tr-buddy>*{width:100%!important;height:100%!important;object-fit:contain;filter:drop-shadow(0 3px 2px #0004)}
#gotomonTraceScreen .tr-buddy.tr-cheer>*{animation:tr-pop2 .5s ease-out}
#gotomonTraceScreen .tr-slots{flex:1;display:flex;justify-content:center;gap:4px;flex-wrap:nowrap}
#gotomonTraceScreen .tr-slot{width:clamp(22px,6.4cqh,46px);aspect-ratio:1;display:grid;place-items:center;border-radius:8px;background:#fff9;border:3px dashed #b388eb;color:#3c096c;font-size:clamp(14px,4.6cqh,32px);font-weight:900}
#gotomonTraceScreen .tr-slot[data-on=true]{background:#fff;border-style:solid}
#gotomonTraceScreen .tr-slots.tr-shake{animation:tr-shake .4s}
#gotomonTraceScreen .tr-review{padding:2px 8px;border-radius:999px;background:#7b2cbf;color:#fff;font-size:12px;font-weight:900}
#gotomonTraceScreen .tr-gauge{width:100%;height:10px;border-radius:6px;background:#ffffff80;overflow:hidden}
#gotomonTraceScreen .tr-gauge i{display:block;height:100%;width:0;background:linear-gradient(90deg,#80ed99,#ffd166,#ff8fab)}
#gotomonTraceScreen .tr-board{position:relative;width:100%;aspect-ratio:1;display:grid;grid-template-columns:repeat(${R.size},1fr);gap:2.2%;padding:2.2%;box-sizing:border-box;border-radius:18px;background:#7b2cbf;box-shadow:0 8px 0 #5a189a,0 12px 18px #0003;touch-action:none;user-select:none}
#gotomonTraceScreen .tr-tile{display:grid;place-items:center;border-radius:14%;background:linear-gradient(#fff,#f1e4ff);color:#240046;font-size:clamp(18px,7.4cqh,52px);font-weight:900;box-shadow:0 4px 0 #c8b6ff;cursor:pointer;transition:transform .08s}
#gotomonTraceScreen .tr-tile[data-on=true]{background:linear-gradient(#ffe066,#ffd43b);box-shadow:0 4px 0 #f59f00;transform:scale(1.05)}
#gotomonTraceScreen .tr-tile[data-hint=true]{box-shadow:0 0 0 4px #37c871,0 0 16px #37c871;animation:tr-glow .7s ease-in-out infinite alternate}
#gotomonTraceScreen .tr-tile{position:relative}
#gotomonTraceScreen .tr-tile[data-order]:not([data-order=''])::after{content:attr(data-order);position:absolute;left:6%;top:4%;min-width:1.4em;padding:0 .2em;border-radius:999px;background:#37c871;color:#fff;font-size:clamp(10px,2.6cqh,18px);line-height:1.4em;text-align:center}
#gotomonTraceScreen .tr-tile[data-pop=true]{animation:tr-pop .8s ease-out forwards}
#gotomonTraceScreen .tr-line{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}
#gotomonTraceScreen .tr-line polyline{fill:none;stroke:#ff6d00cc;stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round}
#gotomonTraceScreen .tr-title{margin:0;text-align:center;font-size:14px;font-weight:900;color:#bfe3ff}
#gotomonTraceScreen .tr-prompt{margin:0;padding:8px 12px;border-radius:14px;background:#ffffff14;color:#fff;text-align:center;font-size:clamp(20px,2.8vw,28px);font-weight:900;line-height:1.3}
#gotomonTraceScreen .tr-prompt small{display:block;margin-top:4px;font-size:15px;font-weight:700;color:#d4e8ff}
#gotomonTraceScreen .tr-prompt small b{color:#ffe066}
#gotomonTraceScreen .tr-tools{display:flex;justify-content:center;gap:8px}
#gotomonTraceScreen .tr-btn{min-height:44px;padding:0 18px;border:0;border-radius:12px;background:#ffffff26;color:#fff;font:inherit;font-size:16px;font-weight:900;cursor:pointer}
#gotomonTraceScreen .tr-help{margin:0;text-align:center;font-size:13px;color:#d4e8ff}
@keyframes tr-pop2{40%{transform:translateY(-18%) scale(1.1)}}
@keyframes tr-bob{from{translate:0 0}to{translate:0 -6%}}
@keyframes tr-glow{from{filter:brightness(1)}to{filter:brightness(1.15)}}
@keyframes tr-shake{0%,100%{translate:0}25%{translate:-8px}75%{translate:8px}}
@keyframes tr-pop{0%{transform:scale(1)}40%{transform:scale(1.25) rotate(-6deg)}100%{transform:scale(0);opacity:0}}
`;
const SVG = 'http://www.w3.org/2000/svg';

export function createTraceView({ document: doc, dispatch, onBack, getSnapshot, cast }) {
  let active = true, lastEventId = 0, doneShown = false, problemKey = null, boardKey = null, shownTrace = 0, dragging = false;
  let path = [];
  const removes = [], tileNodes = [], slotNodes = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'gotomonTraceScreen', title: 'ゴトモン・もじなぞり', theme: 'trace' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });

  const wrap = el('div', 'tr-wrap'), stage = el('div', 'tr-stage');
  const top = el('div', 'tr-top'), asker = el('img', 'tr-asker'); asker.alt = '';
  const slots = el('div', 'tr-slots'), badge = el('span', 'tr-review', 'ふくしゅう'); badge.hidden = true;
  const buddy = el('div', 'tr-buddy');
  top.append(asker, slots, badge, buddy);
  const gauge = el('div', 'tr-gauge'), gaugeBar = el('i'); gauge.append(gaugeBar);
  const board = el('div', 'tr-board'); board.setAttribute('aria-label', 'もじの ばん');
  const line = doc.createElementNS ? doc.createElementNS(SVG, 'svg') : el('div');
  line.setAttribute('class', 'tr-line'); line.setAttribute('viewBox', '0 0 100 100'); line.setAttribute('preserveAspectRatio', 'none');
  const poly = doc.createElementNS ? doc.createElementNS(SVG, 'polyline') : el('i'); line.append(poly);
  for (let i = 0; i < R.size * R.size; i++) {
    const tile = el('div', 'tr-tile'); tile.dataset.cell = String(i); tile.setAttribute('role', 'button');
    board.append(tile); tileNodes.push(tile);
  }
  board.append(line);
  stage.append(top, gauge, board); wrap.append(stage); world.append(wrap);

  const title = el('p', 'tr-title');
  const prompt = el('p', 'tr-prompt'); prompt.dataset.role = 'problem';
  const tools = el('div', 'tr-tools');
  const clearBtn = el('button', 'tr-btn', 'けす'); clearBtn.type = 'button';
  const backBtn = el('button', 'tr-btn', '1文字もどす'); backBtn.type = 'button';
  tools.append(backBtn, clearBtn);
  const help = el('p', 'tr-help', 'となりの もじを ゆびで なぞって、答えを つくろう（タップでも つなげられるよ）');
  const note = el('p', 'ya-dock-note'); note.dataset.role = 'feedback';
  dock.append(title, prompt, tools, help, note);
  doc.body.append(root);

  const state = () => getSnapshot();
  const say = text => { note.textContent = text; frame.announce(text); };
  const drawPath = () => {
    const s = state();
    tileNodes.forEach((tile, i) => { const v = String(path.includes(i)); if (tile.dataset.on !== v) tile.dataset.on = v; });
    const pts = path.map(i => { const r = Math.floor(i / R.size), c = i % R.size; return `${(c + 0.5) * 100 / R.size},${(r + 0.5) * 100 / R.size}`; });
    poly.setAttribute('points', pts.join(' '));
    slotNodes.forEach((slot, k) => { const ch = path[k] !== undefined ? s.tiles[path[k]] : ''; if (slot.textContent !== ch) slot.textContent = ch; slot.dataset.on = String(!!ch); });
  };
  const submit = () => {
    const s = state();
    if (!active || s.paused || s.phase !== 'answering') return false;
    const cells = [...path];
    const ok = dispatch({ type: 'trace', payload: { sessionId: s.sessionId, attemptId: s.attemptId, cells } });
    if (!ok && cells.length && cells.length < s.length) say(`あと ${s.length - cells.length}文字 つなげよう`);
    if (ok) path = [];
    drawPath();
    return ok;
  };
  // Adds a tile if it touches the last one (or starts the path); going back onto the one before undoes a letter.
  const reach = cell => {
    const s = state();
    if (s.phase !== 'answering' || cell === null) return;
    if (path.length >= 2 && cell === path[path.length - 2]) { path.pop(); drawPath(); return; }
    if (path.includes(cell)) return;
    if (path.length && !touching(path.at(-1), cell)) { if (!dragging) { path = [cell]; drawPath(); } return; }
    if (path.length >= s.length) return;
    path.push(cell); drawPath();
    if (!dragging && path.length === s.length) submit();
  };
  // The tile under the finger, only near its middle (so a diagonal move does not catch a side tile).
  const cellAt = event => {
    const box = board.getBoundingClientRect?.(); if (!box?.width) return null;
    const fx2 = (event.clientX - box.left) / box.width * R.size, fy = (event.clientY - box.top) / box.height * R.size;
    const c = Math.floor(fx2), r = Math.floor(fy);
    if (c < 0 || r < 0 || c >= R.size || r >= R.size) return null;
    if (Math.hypot(fx2 - c - 0.5, fy - r - 0.5) > 0.42) return null;
    return r * R.size + c;
  };
  on(board, 'pointerdown', event => {
    event.preventDefault?.();
    const cell = cellAt(event);
    if (cell === null) return;
    const s = state();
    if (s.phase !== 'answering') return;
    // A finger down on the last tile keeps going from there; elsewhere a drag starts a new word.
    if (!(path.length && cell === path.at(-1)) && !(path.length && touching(path.at(-1), cell) && !path.includes(cell))) path = [];
    dragging = true; reach(cell);
  });
  on(doc, 'pointermove', event => { if (dragging) reach(cellAt(event)); });
  on(doc, 'pointerup', () => {
    if (!dragging) return;
    dragging = false;
    if (path.length === state().length) submit();
  });
  on(doc, 'pointercancel', () => { dragging = false; });
  on(clearBtn, 'click', () => { path = []; drawPath(); });
  on(backBtn, 'click', () => { path.pop(); drawPath(); });
  // Typing: each letter takes a matching tile next to the last one; Backspace undoes; Enter checks.
  removes.push(bindArcadeKeys(doc, event => {
    const s = state();
    if (s.phase !== 'answering') return false;
    if (event.key === 'Backspace') { path.pop(); drawPath(); return true; }
    if (event.key === 'Escape') { path = []; drawPath(); return true; }
    if (event.key === 'Enter') { submit(); return true; }
    const ch = event.key.length === 1 ? event.key.toLowerCase() : null;
    if (!ch) return false;
    const cell = s.tiles.findIndex((t, i) => t === ch && !path.includes(i) && (!path.length || touching(path.at(-1), i)));
    if (cell < 0) return false;
    reach(cell);
    return true;
  }));

  const renderPrompt = s => {
    const key = s.problem?.problemId ?? null;
    if (key === problemKey) return;
    problemKey = key;
    if (!s.problem) { prompt.textContent = s.phase === 'completed' ? 'ぜんぶ できた！' : ''; return; }
    prompt.textContent = s.problem.prompt;
    if (s.problem.sentence) { const small = el('small'); small.append(el('span', '', s.problem.sentence.before), el('b', '', s.problem.prompt.match(/「(.+?)」/)?.[1] ?? ''), el('span', '', s.problem.sentence.after)); prompt.append(small); }
  };
  const render = s => {
    const key = `${s.problemIndex}:${s.review}:${s.tiles.join('')}`;
    if (key !== boardKey) {
      boardKey = key; path = [];
      tileNodes.forEach((tile, i) => { tile.textContent = s.tiles[i] ?? ''; tile.dataset.pop = 'false'; tile.setAttribute('aria-label', s.tiles[i] ?? ''); });
      slotNodes.splice(0).forEach(n => n.remove?.());
      for (let k = 0; k < s.length; k++) { const slot = el('span', 'tr-slot'); slots.append(slot); slotNodes.push(slot); }
      const who = castAt(cast?.wild, s.problemIndex);
      if (who) { asker.src = who.imageUrl; asker.hidden = false; } else asker.hidden = true;
      badge.hidden = !s.review;
      drawPath();
    }
    tileNodes.forEach((tile, i) => {
      const hint = String(s.hintCells.includes(i)), pop = String(s.solvedCells.includes(i));
      // When the whole word glows, numbers show the order to trace it in.
      const order = s.hintCells.length > 1 && s.hintCells.includes(i) ? String(s.hintCells.indexOf(i) + 1) : '';
      if (tile.dataset.hint !== hint) tile.dataset.hint = hint;
      if (tile.dataset.order !== order) tile.dataset.order = order;
      if (tile.dataset.pop !== pop) tile.dataset.pop = pop;
    });
    gaugeBar.style.width = `${Math.round(s.gauge * 100)}%`;
  };
  const showTrace = s => {
    const t = s.lastTrace;
    if (t.short) return;
    if (t.correct) {
      const stars = s.lastSolved?.stars ?? 1;
      restartClass(buddy, 'tr-cheer');
      fx.burst(50, 50, stars === 3 ? 'great' : 'good', stars === 3 ? 1.4 : 1.1);
      fx.pop(50, 30, `${'⭐'.repeat(stars)}`, 'great');
      say(`せいかい！「${t.answer}」　${t.explain}`);
      if (s.script === 'letters') Speech.speakEnglish(t.answer);
    } else {
      restartClass(slots, 'tr-shake');
      say(`「${t.word}」ではなかったよ。${t.wrongAt}文字目は「${t.expected}」。光る もじから なぞろう`);
    }
  };

  return {
    root,
    // The companion stands across from the asking Gotomon and cheers at every right word.
    attachCompanion(portrait) { buddy.append(portrait); },
    focusPlay() { tileNodes[0]?.focus?.({ preventScroll: true }); },
    update(s) {
      if (!active) return;
      frame.setPaused(s.paused && !s.result);
      if (!s.tiles) return;
      renderPrompt(s);
      if (s.tiles.length) render(s);
      if (s.lastTrace && s.lastTrace.trace !== shownTrace) { shownTrace = s.lastTrace.trace; showTrace(s); }
      const titleText = s.phase === 'completed' ? '' : s.review ? `ふくしゅう ${s.problemIndex - s.firstRound + 1}/${s.total - s.firstRound}　⭐${s.stars}` : `もんだい ${s.problemIndex + 1}/${s.firstRound}　⭐${s.stars}`;
      if (title.textContent !== titleText) title.textContent = titleText;
      if (s.result && !doneShown) {
        doneShown = true;
        fx.banner('ぜんぶ できた！', 'great'); fx.burst(50, 40, 'great', 2);
        note.textContent = `${s.result.answered}問 なぞった！ ⭐${s.result.stars}${s.result.reviewed ? `・ふくしゅう ${s.result.reviewCorrect}/${s.result.reviewed}` : ''}`;
      }
    },
    present(play, dt, s) {
      if (!active || !s) return;
      frame.tick(dt);
      const w = play.world || {};
      const event = w.lastEvent;
      if (event && event.id !== lastEventId) {
        lastEventId = event.id;
        if (event.type === 'boost') { fx.banner('なぞりフィーバー！', 'great'); fx.flash('great'); }
      }
      const mission = w.challenge, done = s.result ? s.total : s.problemIndex ?? 0;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: Math.min(1, done / (s.total || 1)), progressLabel: s.result ? 'できた！' : `ことば ${Math.min(done, s.total ?? 0)}/${s.total ?? 0}`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; dragging = false; [clearBtn, backBtn].forEach(b => { b.disabled = true; }); },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
