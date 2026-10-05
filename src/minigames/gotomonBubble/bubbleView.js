import { createArcadeFrame, restartClass, bindArcadeKeys } from '../arcade/arcadeKit.js';
import { BUBBLE_RULES as R, predictShot } from './bubbleGame.js';

const W = R.columns, H = R.height;
const pct = (value, of) => `${(value / of * 100).toFixed(3)}%`;
// How long the ball flies, from the path length, in ms.
const flightMs = points => Math.min(700, Math.max(220, points.reduce((sum, point, i) => i ? sum + Math.hypot(point.x - points[i - 1].x, point.y - points[i - 1].y) : 0, 0) * 45));
const CSS = `
#gotomonBubbleScreen .ya-field{background:radial-gradient(circle at 20% 20%,#ffffff55 0 6%,transparent 7%),radial-gradient(circle at 80% 35%,#ffffff44 0 4%,transparent 5%),linear-gradient(#2b1b54,#4b2f8a 55%,#6a47b8)}
#gotomonBubbleScreen .ya-world{touch-action:none}
#gotomonBubbleScreen .gb-board{position:absolute;left:50%;top:58px;bottom:1%;aspect-ratio:${W}/${H};max-width:98%;transform:translateX(-50%);border-radius:14px;background:#ffffff10;box-shadow:inset 0 0 0 2px #ffffff22}
#gotomonBubbleScreen .gb-bubble{position:absolute;width:${pct(0.96, W)};aspect-ratio:1;transform:translate(-50%,-50%);display:grid;place-items:center;border-radius:50%;background:radial-gradient(circle at 32% 28%,#ffffffee 0 12%,#bfe6ff 13% 55%,#6fb9e3 100%);box-shadow:inset 0 -3px 0 #0002,0 2px 3px #0004;color:#1b2a36;font-weight:900;font-size:clamp(14px,min(2.2vw,2.5vh),19px);letter-spacing:-.04em;line-height:1;pointer-events:none;transition:left .3s,top .3s}
#gotomonBubbleScreen .gb-bubble span{position:relative;z-index:1;padding:1px 3px;border-radius:6px;background:#fffdf6;box-shadow:0 1px 2px #0004}
#gotomonBubbleScreen .gb-bubble img{position:absolute;inset:6%;width:88%;height:88%;object-fit:contain;opacity:.95;filter:drop-shadow(0 1px 1px #0005)}
#gotomonBubbleScreen .gb-bubble[data-gotomon=true]{background:radial-gradient(circle at 32% 28%,#ffffffee 0 12%,#ffe7a8 13% 55%,#f0a868 100%)}
#gotomonBubbleScreen .gb-bubble[data-hint=true]{box-shadow:0 0 0 3px #37c871,0 0 12px 4px #37c871aa;animation:gb-glow .7s ease-in-out infinite alternate}
#gotomonBubbleScreen .gb-bubble.gb-new{animation:gb-new .25s ease-out backwards}
#gotomonBubbleScreen .gb-bubble.gb-pop{animation:gb-pop .35s ease-in forwards}
#gotomonBubbleScreen .gb-bubble.gb-fall{animation:gb-fall .6s ease-in forwards}
#gotomonBubbleScreen .gb-guide{position:absolute;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;background:#fff;opacity:.75;pointer-events:none}
#gotomonBubbleScreen .gb-guide[data-end=true]{width:${pct(0.96, W)};height:auto;aspect-ratio:1;margin:0;transform:translate(-50%,-50%);background:none;box-shadow:0 0 0 2px #fff;opacity:.9}
#gotomonBubbleScreen .gb-ball{position:absolute;width:${pct(0.96, W)};aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle at 32% 28%,#fff 0 12%,#ffe066 13% 60%,#f0a800);box-shadow:0 0 12px #ffe066;pointer-events:none;z-index:3}
#gotomonBubbleScreen .gb-shooter{position:absolute;left:${pct(R.shooter.x, W)};top:${pct(R.shooter.y, H)};width:${pct(1.5, W)};aspect-ratio:1;transform:translate(-50%,-50%);display:grid;place-items:center;border-radius:50%;background:radial-gradient(circle at 32% 28%,#fff 0 12%,#ffe066 13% 60%,#f0a800);box-shadow:0 0 0 3px #fff8,0 0 18px #ffe06699;font-weight:900;font-size:clamp(13px,min(2vw,2.6vh),20px);color:#3a2400;z-index:2}
#gotomonBubbleScreen .gb-buddy{position:absolute;left:${pct(R.shooter.x - 1.55, W)};top:${pct(R.shooter.y, H)};width:${pct(1.3, W)};aspect-ratio:1;transform:translate(-50%,-50%);pointer-events:none}
#gotomonBubbleScreen .gb-buddy .gt-portrait{display:block;width:100%;height:100%;background:none;border:0}
#gotomonBubbleScreen .gb-buddy .gt-portrait img{width:100%;height:100%;object-fit:contain}
#gotomonBubbleScreen .gb-next{position:absolute;left:${pct(R.shooter.x + 1.6, W)};top:${pct(R.shooter.y + 0.15, H)};transform:translate(-50%,-50%);padding:3px 8px;border-radius:10px;background:#ffffff22;color:#fff;font-size:12px;font-weight:900;white-space:nowrap}
#gotomonBubbleScreen .gb-freed-fly{position:absolute;width:${pct(1.1, W)};aspect-ratio:1;transform:translate(-50%,-50%);pointer-events:none;animation:gb-free 1.1s ease-out forwards;z-index:4}
#gotomonBubbleScreen .gb-freed-fly img{width:100%;height:100%;object-fit:contain}
#gotomonBubbleScreen .gb-title{margin:0;text-align:center;font-size:14px;font-weight:900;color:#e4d4ff}
#gotomonBubbleScreen .gb-ask{margin:0;padding:10px 12px;border-radius:14px;background:#ffffff14;color:#fff;text-align:center;font-size:15px;font-weight:800;line-height:1.5}
#gotomonBubbleScreen .gb-ask b{display:inline-block;margin:0 4px;padding:0 8px;border-radius:10px;background:#ffe066;color:#3a2400;font-size:clamp(24px,3.4vw,34px);line-height:1.3}
#gotomonBubbleScreen .gb-friends{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;min-height:40px}
#gotomonBubbleScreen .gb-friend{width:40px;height:40px;border-radius:50%;background:#ffffff18;display:grid;place-items:center;overflow:hidden}
#gotomonBubbleScreen .gb-friend img{width:100%;height:100%;object-fit:contain}
#gotomonBubbleScreen .gb-friend[data-free=false] img{filter:grayscale(1) brightness(.6);opacity:.5}
#gotomonBubbleScreen .gb-review{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:6px}
#gotomonBubbleScreen .gb-review li{padding:6px 10px;border-radius:10px;background:#eef6ef;font-weight:700}
#gotomonBubbleScreen .gb-review li[data-correct=false]{background:#fff3da}
@media (max-width:700px){#gotomonBubbleScreen .gb-board{top:86px}#gotomonBubbleScreen .gb-friend{width:28px;height:28px}#gotomonBubbleScreen .gb-friends{min-height:28px}#gotomonBubbleScreen .gb-fire{display:none}#gotomonBubbleScreen .gb-ask{padding:6px 10px}}
@keyframes gb-new{from{transform:translate(-50%,-50%) scale(.4);opacity:0}}
@keyframes gb-pop{to{transform:translate(-50%,-50%) scale(1.5);opacity:0}}
@keyframes gb-fall{to{transform:translate(-50%,300%) rotate(40deg);opacity:0}}
@keyframes gb-glow{from{transform:translate(-50%,-50%)}to{transform:translate(-50%,-58%)}}
@keyframes gb-free{0%{transform:translate(-50%,-50%) scale(.6)}30%{transform:translate(-50%,-90%) scale(1.3)}100%{transform:translate(-50%,-400%) scale(1);opacity:0}}
`;

export function createBubbleView({ document: doc, dispatch, onBack, getSnapshot }) {
  let active = true, lastSeq = -1, lastEventId = 0, doneShown = false, shownShot = 0, version = -1, loadKey = null;
  let angle = Math.PI / 2, aiming = false, guideKey = null, holdUntil = 0, clock = 0;
  const removes = [], transient = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'gotomonBubbleScreen', title: 'ゴトモン・バブル', theme: 'bubble' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });

  const board = el('div', 'gb-board'); board.setAttribute('aria-label', 'あわの盤面');
  const guideLayer = el('div'); const shooter = el('div', 'gb-shooter'); shooter.dataset.role = 'shooter';
  const buddy = el('div', 'gb-buddy'); const next = el('div', 'gb-next');
  board.append(guideLayer, buddy, shooter, next); world.append(board);
  const nodes = new Map();

  const title = el('p', 'gb-title');
  const ask = el('p', 'gb-ask'); ask.dataset.role = 'problem';
  const askLabel = el('b');
  ask.append(el('span', '', 'じゅんびした泡'), askLabel, el('span', '', 'と 同じ答えの泡に当てよう'));
  const friends = el('div', 'gb-friends'); friends.setAttribute('aria-label', 'とじこめられたゴトモン');
  const fire = el('button', 'gb-fire ya-primary', 'ここにうつ！'); fire.type = 'button';
  on(fire, 'click', () => shoot());
  // The shell advances after feedback; this stays hidden and only serves hosts without auto-advance.
  const go = el('button', 'gb-go', 'つぎへ'); go.type = 'button'; go.dataset.action = 'next'; go.hidden = true;
  on(go, 'click', () => proceed());
  const note = el('p', 'ya-dock-note'); note.dataset.role = 'feedback';
  dock.append(title, ask, friends, fire, note, go);
  const review = el('div', 'ya-learning-result'); review.hidden = true;
  const reviewList = el('ol', 'gb-review'); review.append(el('h3', '', '今回うった泡'), reviewList); frame.shell.append(review);
  doc.body.append(root);
  const answers = [], friendNodes = [];

  const session = () => getSnapshot();
  const ready = () => { const state = session(); return active && !state.paused && state.phase === 'answering' && clock >= holdUntil; };
  function shoot() {
    const state = session();
    if (!ready()) return false;
    return dispatch({ type: 'shoot', payload: { sessionId: state.sessionId, attemptId: state.attemptId, angle } });
  }
  function proceed() {
    const state = session();
    if (!active || state.paused || state.phase !== 'feedback') return false;
    return dispatch({ type: 'next', payload: { sessionId: state.sessionId, problemId: state.problem?.problemId } });
  }
  // Aim at the finger: the angle from the shooter to the point on the board.
  const aimAt = event => {
    const box = board.getBoundingClientRect?.();
    if (!box?.width || !Number.isFinite(event?.clientX)) return;
    const x = (event.clientX - box.left) / box.width * W, y = (event.clientY - box.top) / box.height * H;
    angle = Math.min(R.maxAngle, Math.max(R.minAngle, Math.atan2(R.shooter.y - y, x - R.shooter.x)));
    renderGuide(session());
  };
  on(world, 'pointerdown', event => { if (!ready()) return; aiming = true; aimAt(event); });
  on(world, 'pointermove', event => { if (aiming) aimAt(event); });
  on(world, 'pointerup', event => { if (!aiming) return; aiming = false; aimAt(event); shoot(); });
  on(world, 'pointercancel', () => { aiming = false; });
  removes.push(bindArcadeKeys(doc, event => {
    if (event.key === 'ArrowLeft') { angle = Math.min(R.maxAngle, angle + 0.05); renderGuide(session()); return true; }
    if (event.key === 'ArrowRight') { angle = Math.max(R.minAngle, angle - 0.05); renderGuide(session()); return true; }
    if (event.key === ' ' || event.key === 'Enter') return shoot();
    return false;
  }));

  const renderGuide = state => {
    const key = `${state.version}:${angle.toFixed(3)}:${state.phase}`;
    if (guideKey === key) return;
    guideKey = key; guideLayer.textContent = '';
    if (state.phase !== 'answering') return;
    const { path, land } = predictShot(state.bubbles, state.shift, angle);
    // Dots along the path, bounces included, then a ring where the bubble would stick.
    let carry = 0;
    for (let i = 1; i < path.points.length; i++) {
      const a = path.points[i - 1], b = path.points[i], length = Math.hypot(b.x - a.x, b.y - a.y);
      for (let d = carry; d < length; d += 0.55) {
        const dot = el('i', 'gb-guide'); dot.style.left = pct(a.x + (b.x - a.x) * d / length, W); dot.style.top = pct(a.y + (b.y - a.y) * d / length, H);
        guideLayer.append(dot);
      }
      carry = (carry - length) % 0.55; if (carry < 0) carry += 0.55;
    }
    if (land) { const ring = el('i', 'gb-guide'); ring.dataset.end = 'true'; ring.style.left = pct(land.x, W); ring.style.top = pct(land.y, H); guideLayer.append(ring); }
  };
  const bubbleNode = bubble => {
    const node = el('div', 'gb-bubble');
    if (bubble.gotomon?.imageUrl) { const img = el('img'); img.alt = ''; img.src = bubble.gotomon.imageUrl; node.append(img); node.dataset.gotomon = 'true'; }
    node.append(el('span', '', bubble.label));
    return node;
  };
  const later = (node, className, delay) => {
    node.style.animationDelay = `${delay}ms`; restartClass(node, className);
    const done = () => { node.remove?.(); const at = transient.indexOf(node); if (at >= 0) transient.splice(at, 1); };
    node.addEventListener?.('animationend', done); transient.push(node);
    while (transient.length > 40) transient.shift().remove?.();
  };
  // The board is redrawn when it changes; bubbles that left pop or fall after the ball lands.
  const renderBoard = (state, delay) => {
    if (version === state.version) return;
    version = state.version;
    const alive = new Set(state.bubbles.map(bubble => bubble.bubbleId));
    const answer = state.lastAnswer, falling = new Set((answer?.dropped ?? []).map(item => item.bubbleId));
    for (const [id, node] of nodes) if (!alive.has(id)) { nodes.delete(id); later(node, falling.has(id) ? 'gb-fall' : 'gb-pop', delay); }
    for (const bubble of state.bubbles) {
      let node = nodes.get(bubble.bubbleId);
      if (!node) { node = bubbleNode(bubble); nodes.set(bubble.bubbleId, node); board.insertBefore?.(node, guideLayer) ?? board.append(node); node.style.animationDelay = `${delay}ms`; restartClass(node, 'gb-new'); }
      node.style.left = pct(bubble.x, W); node.style.top = pct(bubble.y, H);
    }
  };
  const renderHints = state => {
    const hints = new Set(state.phase === 'answering' ? state.hintIds : []);
    for (const [id, node] of nodes) { const hint = String(hints.has(id)); if (node.dataset.hint !== hint) node.dataset.hint = hint; }
  };
  const renderDock = state => {
    const fresh = state.phase === 'answering' && state.problem?.problemId.endsWith(':0');
    const titleText = state.phase === 'completed' ? '' : `たま ${Math.min(state.shots, state.shot + (fresh ? 1 : 0))}/${state.shots}　たすけたゴトモン ${state.freed.length}/${state.trapped}`;
    if (title.textContent !== titleText) title.textContent = titleText;
    if (state.loaded && loadKey !== state.loaded.loadId) {
      loadKey = state.loaded.loadId; askLabel.textContent = state.loaded.label; shooter.textContent = state.loaded.label;
      next.textContent = state.upcoming ? `つぎ ${state.upcoming.label}` : '';
      note.textContent = 'ゆびで ねらって はなすと うてるよ';
    }
    fire.disabled = !(state.phase === 'answering' && !state.paused);
    const all = state.bubbles.filter(bubble => bubble.gotomon).map(bubble => ({ gotomon: bubble.gotomon, free: false }))
      .concat(state.freed.map(gotomon => ({ gotomon, free: true })));
    if (friendNodes.length !== all.length || all.some((item, i) => friendNodes[i]?.dataset.free !== String(item.free) || friendNodes[i]?.dataset.name !== item.gotomon.name)) {
      friends.textContent = ''; friendNodes.length = 0;
      for (const item of all.sort((a, b) => Number(b.free) - Number(a.free))) {
        const node = el('span', 'gb-friend'); node.dataset.free = String(item.free); node.dataset.name = item.gotomon.name; node.title = item.gotomon.name;
        if (item.gotomon.imageUrl) { const img = el('img'); img.alt = item.gotomon.name; img.src = item.gotomon.imageUrl; node.append(img); }
        friends.append(node); friendNodes.push(node);
      }
    }
  };
  const showAnswer = (state, delay) => {
    const answer = state.lastAnswer;
    const ball = el('span', 'gb-ball'), last = answer.path.at(-1);
    ball.style.left = pct(answer.correct ? answer.land.x : last.x, W); ball.style.top = pct(answer.correct ? answer.land.y : last.y, H);
    board.append(ball); transient.push(ball);
    // The ball follows the path (bounces too); without animation support it simply lands.
    const frames = answer.path.map(point => ({ left: pct(point.x, W), top: pct(point.y, H) }));
    if (answer.correct) frames.push({ left: pct(answer.land.x, W), top: pct(answer.land.y, H) });
    else frames.push({ left: pct(R.shooter.x, W), top: pct(R.shooter.y, H), opacity: 0 });
    const run = ball.animate?.(frames, { duration: answer.correct ? delay : delay + 350, easing: 'linear', fill: 'forwards' });
    if (run) run.onfinish = () => ball.remove?.(); else ball.remove?.();
    const at = { x: answer.land.x / W * 100, y: answer.land.y / H * 100 };
    if (answer.correct) {
      const broken = answer.popped.length + answer.dropped.length;
      if (broken) {
        note.textContent = answer.freed.length ? `パチン！ ${broken}こ われて、${answer.freed.map(g => g.name).join('と')}を たすけた！` : `パチン！ ${broken}こ われた！`;
        fx.burst(at.x, at.y, broken >= 5 ? 'great' : 'good', broken >= 5 ? 1.5 : 1.1);
        if (broken >= 5) fx.pop(at.x, at.y - 8, `${broken}れんさ！`, 'great');
        for (const item of [...answer.popped, ...answer.dropped].filter(bubble => bubble.gotomon?.imageUrl)) {
          const fly = el('div', 'gb-freed-fly'); const img = el('img'); img.alt = ''; img.src = item.gotomon.imageUrl; fly.append(img);
          fly.style.left = pct(item.x, W); fly.style.top = pct(item.y, H); later(fly, 'gb-freed-fly', delay); board.append(fly);
          fx.pop(item.x / W * 100, item.y / H * 100 - 6, 'ありがとう！', 'great');
        }
      } else note.textContent = `くっついた！ 同じ答えがあと1こ つながると われるよ`;
      answers.push({ text: `${answer.label} = ${answer.value}`, correct: answer.first });
    } else {
      const around = [...new Set(answer.touched.map(item => item.label))];
      note.textContent = `「${answer.label}」は ${answer.value}。${around.length ? `となりは「${around.join('」「')}」で、${answer.value}じゃなかったよ。` : ''}光っている泡をねらおう`;
    }
    frame.announce(note.textContent);
  };

  return {
    root,
    attachCompanion(portrait) { buddy.append(portrait); },
    focusPlay() { fire.focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      if (!state.bubbles && !state.result) return;
      let delay = 0;
      if (state.seq !== lastSeq) {
        lastSeq = state.seq;
        if (state.lastAnswer && state.lastAnswer.shot !== shownShot) {
          shownShot = state.lastAnswer.shot; delay = flightMs(state.lastAnswer.path);
          // No new aim until the ball has landed.
          holdUntil = clock + delay; showAnswer(state, delay);
        }
      }
      renderBoard(state, delay);
      renderHints(state);
      if (!state.result) { renderDock(state); renderGuide(state); }
      if (state.result && !doneShown) {
        doneShown = true; review.hidden = false; reviewList.textContent = ''; guideLayer.textContent = '';
        for (const item of answers) {
          const row = el('li', '', `${item.correct ? '✓' : '☆'} ${item.text}`);
          row.dataset.correct = String(item.correct); reviewList.append(row);
        }
      }
    },
    present(play, dt, state) {
      if (!active || !state) return;
      frame.tick(dt); clock += Math.max(0, Number.isFinite(dt) ? dt : 0);
      const w = play.world || {};
      const event = w.lastEvent;
      if (event && event.id !== lastEventId) {
        lastEventId = event.id;
        if (event.type === 'boost') { fx.banner('バブルフィーバー！', 'great'); fx.flash('great'); }
      }
      const mission = w.challenge;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: Math.min(1, (state.shot ?? 0) / (state.shots || 1)), progressLabel: `たま ${state.shot ?? 0}/${state.shots ?? 0}`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; aiming = false; [fire, go].forEach(node => { node.disabled = true; }); },
    dispose() { this.stopInput(); transient.splice(0).forEach(node => node.remove?.()); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
