import { createArcadeFrame, restartClass, bindArcadeKeys } from '../arcade/arcadeKit.js';
import { castAt } from '../gotomonCast.js';
import Speech from '../../audio/speech.js';

// Card columns (% of the field's width) and the band the rows share (% of its height).
const LEFT_X = [5, 38], RIGHT_X = [58, 95], TOP = 13, BOTTOM = 97;
const CSS = `
#gotomonLinkScreen .ya-field{background:radial-gradient(circle at 50% 50%,#ffffff10 0 30%,transparent 31%),linear-gradient(#27415e,#35597a)}
#gotomonLinkScreen .ya-world{touch-action:none}
#gotomonLinkScreen .lk-card{position:absolute;display:flex;align-items:center;gap:6px;padding:4px 10px;border:3px solid #fff0;border-radius:14px;background:#fffdf6;color:#1b2a36;font:inherit;font-weight:900;line-height:1.15;box-shadow:0 4px 0 #0003;cursor:pointer;touch-action:none;z-index:3;transform:translateY(-50%)}
#gotomonLinkScreen .lk-left{justify-content:flex-start;font-size:clamp(22px,min(3.2vw,4.4vh),38px)}
#gotomonLinkScreen .lk-left img{width:clamp(30px,6vh,48px);height:clamp(30px,6vh,48px);object-fit:contain;flex:none}
#gotomonLinkScreen .lk-right{justify-content:center;text-align:center;font-size:clamp(17px,min(2.2vw,3vh),24px)}
#gotomonLinkScreen .lk-right[data-long=true]{font-size:clamp(12px,min(1.7vw,2.3vh),18px)}
#gotomonLinkScreen .lk-card::after{content:'';position:absolute;top:50%;width:14px;height:14px;margin-top:-7px;border-radius:50%;background:#ffcf5a;box-shadow:0 0 0 3px #fff}
#gotomonLinkScreen .lk-left::after{right:-10px}
#gotomonLinkScreen .lk-right::after{left:-10px}
#gotomonLinkScreen .lk-card[data-selected=true]{border-color:#ffcf5a;box-shadow:0 0 0 4px #ffcf5a88,0 4px 0 #0003}
#gotomonLinkScreen .lk-card[data-hint=true]{border-color:#37c871;box-shadow:0 0 0 4px #37c87188,0 4px 0 #0003}
#gotomonLinkScreen .lk-card[data-linked=true]{background:#e4f7e8;cursor:default}
#gotomonLinkScreen .lk-left[data-linked=true] img{opacity:0}
#gotomonLinkScreen .lk-arrived{width:clamp(26px,5vh,40px);height:clamp(26px,5vh,40px);object-fit:contain;flex:none;animation:lk-in .4s ease-out .8s both}
#gotomonLinkScreen .lk-card.lk-no{animation:lk-no .4s ease-out}
#gotomonLinkScreen .lk-line{position:absolute;height:6px;margin-top:-3px;border-radius:3px;transform-origin:0 50%;background:#ffcf5a;box-shadow:0 0 0 2px #fff8;z-index:2;pointer-events:none}
#gotomonLinkScreen .lk-line[data-state=drag]{background:#ffffffcc;box-shadow:none}
#gotomonLinkScreen .lk-line[data-state=wrong]{background:#ff8a65;animation:lk-snap .5s ease-in forwards}
#gotomonLinkScreen .lk-rider{position:absolute;width:clamp(30px,6vh,48px);height:clamp(30px,6vh,48px);transform:translate(-50%,-50%);z-index:4;pointer-events:none;animation:lk-ride .9s ease-in-out forwards}
#gotomonLinkScreen .lk-rider img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 3px 3px #0006)}
#gotomonLinkScreen .lk-title{margin:0;text-align:center;font-size:14px;font-weight:900;color:#bfe3ff}
#gotomonLinkScreen .lk-prompt{margin:0;padding:8px 12px;border-radius:14px;background:#ffffff14;color:#fff;text-align:center;font-size:clamp(18px,2.4vw,24px);font-weight:900;line-height:1.4}
#gotomonLinkScreen .lk-prompt small{display:block;font-size:15px;font-weight:700;color:#d4e8ff}
#gotomonLinkScreen .lk-prompt small b{color:#ffe066}
@keyframes lk-no{0%,100%{transform:translateY(-50%)}30%{transform:translate(-5px,-50%)}60%{transform:translate(5px,-50%)}}
@keyframes lk-snap{to{opacity:0;transform:var(--r) scaleX(.1)}}
@keyframes lk-in{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:none}}
@keyframes lk-ride{0%{left:var(--x1);top:var(--y1)}100%{left:var(--x2);top:var(--y2)}}
`;

export function createLinkView({ document: doc, dispatch, onBack, getSnapshot, cast }) {
  let active = true, lastEventId = 0, doneShown = false, shownLine = 0, roundKey = null, selected = null, dragLine = null, dragFrom = null;
  const removes = [], leftNodes = new Map(), rightNodes = new Map(), lines = new Map();
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'gotomonLinkScreen', title: '線つなぎ', theme: 'link' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });

  const title = el('p', 'lk-title');
  const prompt = el('p', 'lk-prompt'); prompt.dataset.role = 'problem';
  const note = el('p', 'ya-dock-note'); note.dataset.role = 'feedback';
  dock.append(title, prompt, note);
  doc.body.append(root);

  // Points on the field, in % of its size, from the cards' dots.
  const box = () => world.getBoundingClientRect?.() ?? null;
  const dot = (node, side) => {
    const w = box(), r = node.getBoundingClientRect?.();
    if (!w?.width || !r) return null;
    return [((side === 'left' ? r.right + 3 : r.left - 3) - w.left) / w.width * 100, (r.top + r.height / 2 - w.top) / w.height * 100];
  };
  const place = (line, from, to) => {
    const w = box(); if (!w?.width || !from || !to) return;
    const dx = (to[0] - from[0]) * w.width / 100, dy = (to[1] - from[1]) * w.height / 100;
    const rotate = `rotate(${Math.atan2(dy, dx)}rad)`;
    line.style.left = `${from[0]}%`; line.style.top = `${from[1]}%`; line.style.width = `${Math.hypot(dx, dy)}px`;
    line.style.transform = rotate; line.style.setProperty?.('--r', rotate);
  };

  function link(leftId, rightId) {
    const state = getSnapshot();
    if (!active || state.paused || state.phase !== 'answering') return false;
    return dispatch({ type: 'link', payload: { sessionId: state.sessionId, attemptId: state.attemptId, leftId, rightId } });
  }
  const select = (side, id) => {
    const state = getSnapshot();
    if (!active || state.paused || state.phase !== 'answering') return;
    if (selected && selected.side !== side) {
      const leftId = side === 'left' ? id : selected.id, rightId = side === 'right' ? id : selected.id;
      selected = null; link(leftId, rightId); return;
    }
    selected = selected?.id === id ? null : { side, id };
    const left = side === 'left' && selected ? state.lefts.find(item => item.leftId === id) : null;
    if (left?.speak) Speech.speakEnglish(left.speak);
  };
  const cardAt = (x, y) => {
    const hit = doc.elementFromPoint?.(x, y);
    const card = hit?.closest?.('.lk-card');
    return card && card.dataset.id ? { side: card.dataset.side, id: card.dataset.id } : null;
  };
  // Press on a card and drag to the other side, or tap one card and then the other.
  on(world, 'pointerdown', event => {
    const card = event.target?.closest?.('.lk-card');
    const from = card?.dataset.id ? { side: card.dataset.side, id: card.dataset.id } : cardAt(event.clientX, event.clientY);
    if (!from) return;
    event.preventDefault?.();
    dragFrom = { ...from, x: event.clientX, y: event.clientY, moved: false };
    select(from.side, from.id);
  });
  on(doc, 'pointermove', event => {
    if (!dragFrom || !active) return;
    if (Math.hypot(event.clientX - dragFrom.x, event.clientY - dragFrom.y) > 12) dragFrom.moved = true;
    if (!dragFrom.moved) return;
    const node = (dragFrom.side === 'left' ? leftNodes : rightNodes).get(dragFrom.id), w = box();
    if (!node || !w?.width) return;
    if (!dragLine) { dragLine = el('div', 'lk-line'); dragLine.dataset.state = 'drag'; world.append(dragLine); }
    place(dragLine, dot(node, dragFrom.side), [(event.clientX - w.left) / w.width * 100, (event.clientY - w.top) / w.height * 100]);
  });
  on(doc, 'pointerup', event => {
    if (!dragFrom) return;
    const from = dragFrom; dragFrom = null; dragLine?.remove?.(); dragLine = null;
    if (!from.moved) return;
    const to = cardAt(event.clientX, event.clientY);
    if (to && to.side !== from.side) { selected = { side: from.side, id: from.id }; select(to.side, to.id); }
  });
  removes.push(bindArcadeKeys(doc, event => {
    if (event.key === 'Escape' && selected) { selected = null; return true; }
    return false;
  }));

  const build = state => {
    for (const node of [...leftNodes.values(), ...rightNodes.values(), ...lines.values()]) node.remove?.();
    leftNodes.clear(); rightNodes.clear(); lines.clear(); selected = null;
    const rows = state.lefts.length, rowY = slot => TOP + (slot + 0.5) * (BOTTOM - TOP) / rows, height = (BOTTOM - TOP) / rows - 3;
    state.lefts.forEach((item, index) => {
      const node = el('button', 'lk-card lk-left'); node.type = 'button'; node.dataset.side = 'left'; node.dataset.id = item.leftId;
      const who = castAt(cast?.wild, state.roundIndex * rows + index);
      if (who) { const img = el('img'); img.alt = ''; img.src = who.imageUrl; node.append(img); node.dataset.who = who.imageUrl; }
      node.append(el('span', '', item.text));
      node.style.cssText = `left:${LEFT_X[0]}%;width:${LEFT_X[1] - LEFT_X[0]}%;top:${rowY(item.slot)}%;height:${height}%`;
      node.setAttribute('aria-label', item.text);
      world.append(node); leftNodes.set(item.leftId, node);
    });
    state.rights.forEach(item => {
      const node = el('button', 'lk-card lk-right', item.text); node.type = 'button'; node.dataset.side = 'right'; node.dataset.id = item.rightId;
      node.dataset.long = String(item.text.length > 9);
      node.style.cssText = `left:${RIGHT_X[0]}%;width:${RIGHT_X[1] - RIGHT_X[0]}%;top:${rowY(item.slot)}%;height:${height}%`;
      node.setAttribute('aria-label', item.text);
      world.append(node); rightNodes.set(item.rightId, node);
    });
    // Keyboard: Enter or Space on a focused card selects it.
    for (const [id, node] of leftNodes) on(node, 'click', event => { if (event.detail === 0) select('left', id); });
    for (const [id, node] of rightNodes) on(node, 'click', event => { if (event.detail === 0) select('right', id); });
  };
  const render = state => {
    const key = `${state.roundIndex}:${state.lefts[0]?.leftId}`;
    if (key !== roundKey) { roundKey = key; build(state); }
    const pickedLeft = selected?.side === 'left' ? state.lefts.find(item => item.leftId === selected.id) : null;
    for (const item of state.lefts) {
      const node = leftNodes.get(item.leftId); if (!node) continue;
      node.dataset.selected = String(selected?.id === item.leftId); node.dataset.linked = String(item.linked); node.disabled = item.linked;
      node.dataset.hint = 'false';
    }
    for (const item of state.rights) {
      const node = rightNodes.get(item.rightId); if (!node) continue;
      node.dataset.selected = String(selected?.id === item.rightId); node.dataset.linked = String(item.linked); node.disabled = item.linked;
      // After a wrong line, the card that fits glows while its left card is picked.
      node.dataset.hint = String(!!pickedLeft?.hint && !item.linked && item.pairId === pickedLeft.pairId);
    }
    for (const item of state.lefts.filter(left => left.linked)) {
      const right = state.rights.find(r => r.pairId === item.pairId);
      let line = lines.get(item.leftId);
      if (!line) { line = el('div', 'lk-line'); world.append(line); lines.set(item.leftId, line); }
      place(line, dot(leftNodes.get(item.leftId), 'left'), dot(rightNodes.get(right.rightId), 'right'));
      // The Gotomon that crossed now waits on the right card.
      const arrived = rightNodes.get(right.rightId), who = leftNodes.get(item.leftId)?.dataset.who;
      if (arrived && who && !arrived.dataset.arrived) { arrived.dataset.arrived = 'true'; const img = el('img', 'lk-arrived'); img.alt = ''; img.src = who; arrived.prepend?.(img); }
    }
    const text = state.phase === 'completed' ? 'ぜんぶ つながった！' : state.clearing ? 'ぜんぶ つながった！' : `左と右の 合うものを、線でつなごう（${state.roundLabel}）`;
    if (!pickedLeft?.sentence) { if (prompt.textContent !== text) prompt.textContent = text; }
    else {
      const s = pickedLeft.sentence, sentenceKey = `s:${pickedLeft.leftId}`;
      if (prompt.dataset.key !== sentenceKey) {
        prompt.textContent = `「${s.kanji}」の読みは？`; const small = el('small'); small.append(el('span', '', s.before), el('b', '', s.kanji), el('span', '', s.after)); prompt.append(small);
      }
      prompt.dataset.key = sentenceKey;
    }
    if (!pickedLeft?.sentence) prompt.dataset.key = '';
    const titleText = state.phase === 'completed' ? '' : `${state.roundIndex + 1}まいめ / ${state.rounds}　つないだ ${state.lefts.filter(item => item.linked).length}/${state.lefts.length}`;
    if (title.textContent !== titleText) title.textContent = titleText;
  };
  const showLine = state => {
    const line = state.lastLine, leftNode = leftNodes.get(line.leftId), rightNode = rightNodes.get(line.rightId);
    const from = leftNode && dot(leftNode, 'left'), to = rightNode && dot(rightNode, 'right');
    if (line.correct) {
      if (from && to && leftNode.dataset.who) {
        const rider = el('div', 'lk-rider'), img = el('img'); img.alt = ''; img.src = leftNode.dataset.who; rider.append(img);
        rider.style.setProperty?.('--x1', `${from[0]}%`); rider.style.setProperty?.('--y1', `${from[1]}%`);
        rider.style.setProperty?.('--x2', `${to[0] + 6}%`); rider.style.setProperty?.('--y2', `${to[1]}%`);
        rider.addEventListener?.('animationend', () => rider.remove?.()); world.append(rider);
      }
      if (to) { fx.burst(to[0], to[1], line.first ? 'great' : 'good', 1.1); fx.pop(to[0], to[1] - 6, 'つながった！', 'great'); }
      note.textContent = `つながった！ ${line.explain}`;
    } else {
      if (from && to) { const snap = el('div', 'lk-line'); snap.dataset.state = 'wrong'; place(snap, from, to); snap.addEventListener?.('animationend', () => snap.remove?.()); world.append(snap); }
      if (rightNode) restartClass(rightNode, 'lk-no');
      note.textContent = `「${line.right}」は ここじゃないよ（${line.otherExplain}）。光るカードをさがそう`;
      // Keep the left card picked so the fitting card glows.
      selected = { side: 'left', id: line.leftId };
    }
    frame.announce(note.textContent);
  };

  return {
    root,
    attachCompanion(portrait) { const buddy = el('div'); buddy.style.cssText = 'position:absolute;left:44%;bottom:2%;width:56px;height:56px;pointer-events:none;z-index:1'; buddy.append(portrait); world.append(buddy); },
    focusPlay() { leftNodes.values().next().value?.focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      if (!state.lefts?.length) return;
      render(state);
      if (state.lastLine && state.lastLine.line !== shownLine) { shownLine = state.lastLine.line; showLine(state); render(state); }
      if (state.result && !doneShown) {
        doneShown = true;
        fx.banner('ぜんぶ つながった！', 'great'); fx.burst(50, 50, 'great', 2);
        note.textContent = `${state.result.joined}本 つないだ！ 1回でつないだのは ${state.result.correct}本`;
      }
    },
    present(play, dt, state) {
      if (!active || !state) return;
      frame.tick(dt);
      const w = play.world || {};
      const event = w.lastEvent;
      if (event && event.id !== lastEventId) {
        lastEventId = event.id;
        if (event.type === 'boost') { fx.banner('つなぎフィーバー！', 'great'); fx.flash('great'); }
      }
      const mission = w.challenge;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: Math.min(1, (state.joined ?? 0) / (state.total || 1)), progressLabel: `つないだ ${state.joined ?? 0}/${state.total ?? 0}`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; [...leftNodes.values(), ...rightNodes.values()].forEach(node => { node.disabled = true; }); },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
