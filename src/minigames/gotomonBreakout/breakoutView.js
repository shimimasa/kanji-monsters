import { createArcadeFrame, restartClass, bindArcadeKeys } from '../arcade/arcadeKit.js';
import { castAt } from '../gotomonCast.js';
import { BREAKOUT_RULES as R } from './breakoutGame.js';

const px = value => `${(value / R.width * 100).toFixed(3)}%`;
const py = value => `${(value / R.height * 100).toFixed(3)}%`;
const CSS = `
#gotomonBreakoutScreen .ya-field{background:radial-gradient(circle at 80% 15%,#fff3 0 6%,transparent 7%),linear-gradient(#1b3a2c,#2d5a41 60%,#3f7a55)}
#gotomonBreakoutScreen .bk-board{position:absolute;left:50%;top:58px;bottom:1%;aspect-ratio:${R.width}/${R.height};max-width:98%;transform:translateX(-50%);border-radius:14px;background:#0003;box-shadow:inset 0 0 0 3px #ffffff33;touch-action:none;cursor:ew-resize;overflow:hidden}
#gotomonBreakoutScreen .bk-block{position:absolute;display:grid;place-items:center;border-radius:8px;background:linear-gradient(#fff6d6,#f3d38a);box-shadow:inset 0 -4px 0 #0002,0 2px 0 #0004;color:#3a2400;font-weight:900;font-size:clamp(14px,min(2.4vw,2.9vh),26px);pointer-events:none;transition:top .3s}
#gotomonBreakoutScreen .bk-block[data-hint=true]{background:linear-gradient(#d7f7df,#8fe0a8);box-shadow:0 0 0 3px #37c871,0 0 14px #37c871;animation:bk-glow .7s ease-in-out infinite alternate}
#gotomonBreakoutScreen .bk-block.bk-bump{animation:bk-bump .3s ease-out}
#gotomonBreakoutScreen .bk-block.bk-break{animation:bk-break .45s ease-in forwards}
#gotomonBreakoutScreen .bk-block.bk-new{animation:bk-new .3s ease-out}
#gotomonBreakoutScreen .bk-ball{position:absolute;width:${(R.ballRadius * 2 / R.width * 100).toFixed(3)}%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff 0 20%,#ffb627 22% 100%);box-shadow:0 0 10px #ffd54a;pointer-events:none;z-index:3}
#gotomonBreakoutScreen .bk-paddle{position:absolute;height:${(R.paddleHeight / R.height * 100).toFixed(3)}%;transform:translateX(-50%);border-radius:99px;background:linear-gradient(#b9c8ff,#6b7fd6);box-shadow:0 0 12px #9fb2ff;pointer-events:none;z-index:2}
#gotomonBreakoutScreen .bk-buddy{position:absolute;bottom:100%;left:50%;width:clamp(44px,6vw,62px);aspect-ratio:1;transform:translateX(-50%)}
#gotomonBreakoutScreen .bk-buddy .gt-portrait{display:block;width:100%;height:100%;background:none;border:0}
#gotomonBreakoutScreen .bk-buddy .gt-portrait img{width:100%;height:100%;object-fit:contain}
#gotomonBreakoutScreen .bk-free{position:absolute;width:${(1.6 / R.width * 100).toFixed(3)}%;aspect-ratio:1;transform:translate(-50%,-50%);pointer-events:none;z-index:4;animation:bk-free 1.3s ease-out forwards}
#gotomonBreakoutScreen .bk-free img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 3px 3px #0006)}
#gotomonBreakoutScreen .bk-title{margin:0;text-align:center;font-size:14px;font-weight:900;color:#cfe9d8}
#gotomonBreakoutScreen .bk-question{margin:0;padding:10px 12px;border-radius:14px;background:#ffffff14;color:#fff;text-align:center;font-size:clamp(32px,5vw,46px);font-weight:900;font-variant-numeric:tabular-nums}
#gotomonBreakoutScreen .bk-launch{min-height:52px;border:0;border-radius:14px;background:#ffb627;color:#3a2400;font:inherit;font-size:20px;font-weight:900;box-shadow:0 4px 0 #b57500;cursor:pointer;touch-action:manipulation}
#gotomonBreakoutScreen .bk-launch[hidden]{display:none}
#gotomonBreakoutScreen .bk-review{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:6px}
#gotomonBreakoutScreen .bk-review li{padding:6px 10px;border-radius:10px;background:#eef6ef;font-weight:700}
#gotomonBreakoutScreen .bk-review li[data-correct=false]{background:#fff3da}
@media (max-width:700px){#gotomonBreakoutScreen .bk-board{top:86px}}
@keyframes bk-glow{from{filter:brightness(1)}to{filter:brightness(1.15)}}
@keyframes bk-bump{0%,100%{transform:none}40%{transform:translateY(-4px)}}
@keyframes bk-break{to{transform:scale(1.4) rotate(12deg);opacity:0}}
@keyframes bk-new{from{transform:scale(.6);opacity:0}}
@keyframes bk-free{0%{transform:translate(-50%,-50%) scale(.3);opacity:0}30%{transform:translate(-50%,-80%) scale(1.2);opacity:1}100%{transform:translate(-50%,-300%);opacity:0}}
`;

export function createBreakoutView({ document: doc, dispatch, onBack, getSnapshot, cast }) {
  let active = true, lastSeq = -1, lastEventId = 0, doneShown = false, shownHit = 0, shownBounce = 0, version = -1, questionKey = null, freeSerial = 0;
  const removes = [], transient = [], answers = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'gotomonBreakoutScreen', title: 'ゴトモン・ブロックくずし', theme: 'breakout' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });

  const board = el('div', 'bk-board'); board.setAttribute('aria-label', 'ブロックの盤');
  const paddle = el('div', 'bk-paddle'), buddy = el('div', 'bk-buddy'); paddle.append(buddy);
  const ballNode = el('i', 'bk-ball');
  board.append(paddle, ballNode); world.append(board);
  const nodes = new Map();

  const title = el('p', 'bk-title');
  const question = el('p', 'bk-question'); question.dataset.role = 'problem';
  const launchButton = el('button', 'bk-launch', 'ボールをうつ！'); launchButton.type = 'button';
  on(launchButton, 'click', () => command('launch'));
  // The shell advances after feedback; this stays hidden and only serves hosts without auto-advance.
  const go = el('button', 'bk-go', 'つぎへ'); go.type = 'button'; go.dataset.action = 'next'; go.hidden = true;
  on(go, 'click', () => proceed());
  const note = el('p', 'ya-dock-note'); note.dataset.role = 'feedback';
  dock.append(title, question, launchButton, note, go);
  const review = el('div', 'ya-learning-result'); review.hidden = true;
  const reviewList = el('ol', 'bk-review'); review.append(el('h3', '', '今回の計算'), reviewList); frame.shell.append(review);
  doc.body.append(root);

  const session = () => getSnapshot();
  function command(type, extra = {}) {
    const state = session();
    if (!active || state.paused || state.phase !== 'answering') return false;
    return dispatch({ type, payload: { sessionId: state.sessionId, attemptId: state.attemptId, ...extra } });
  }
  function proceed() {
    const state = session();
    if (!active || state.paused || state.phase !== 'feedback') return false;
    return dispatch({ type: 'next', payload: { sessionId: state.sessionId } });
  }
  // The paddle follows the finger; a tap also sends a waiting ball off.
  const xOf = event => { const box = board.getBoundingClientRect?.(); return box?.width && Number.isFinite(event?.clientX) ? (event.clientX - box.left) / box.width * R.width : null; };
  let dragging = false;
  on(board, 'pointerdown', event => { dragging = true; const x = xOf(event); if (x !== null) command('steer', { x }); if (session().ball?.held) command('launch'); });
  on(board, 'pointermove', event => { if (!dragging && event.pointerType !== 'mouse') return; const x = xOf(event); if (x !== null) command('steer', { x }); });
  on(board, 'pointerup', () => { dragging = false; });
  on(board, 'pointercancel', () => { dragging = false; });
  removes.push(bindArcadeKeys(doc, event => {
    const state = session();
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') return command('steer', { x: (state.paddle?.x ?? R.width / 2) + (event.key === 'ArrowLeft' ? -0.8 : 0.8) });
    if (event.key === ' ' || event.key === 'Enter') return command('launch');
    return false;
  }));

  const later = (node, className) => {
    // Earlier animations (appearing, a bump, the hint glow) must not hide the last one.
    node.classList?.remove('bk-new', 'bk-bump'); if (node.dataset) node.dataset.hint = 'false';
    restartClass(node, className);
    node.addEventListener?.('animationend', () => { node.remove?.(); const at = transient.indexOf(node); if (at >= 0) transient.splice(at, 1); });
    transient.push(node); while (transient.length > 30) transient.shift().remove?.();
  };
  const renderBlocks = state => {
    if (version === state.version) return;
    version = state.version;
    const alive = new Set(state.blocks.map(block => block.blockId));
    for (const [id, node] of nodes) if (!alive.has(id)) { nodes.delete(id); later(node, 'bk-break'); }
    for (const block of state.blocks) {
      let node = nodes.get(block.blockId);
      if (!node) { node = el('div', 'bk-block'); nodes.set(block.blockId, node); board.insertBefore?.(node, paddle) ?? board.append(node); restartClass(node, 'bk-new'); }
      node.style.left = px(block.x); node.style.top = py(block.y); node.style.width = px(block.w); node.style.height = py(block.h);
      const text = String(block.number ?? '');
      if (node.textContent !== text) node.textContent = text;
    }
  };
  const renderPlay = state => {
    for (const [id, node] of nodes) { const hint = String(state.phase === 'answering' && state.hintId === id); if (node.dataset.hint !== hint) node.dataset.hint = hint; }
    paddle.style.left = px(state.paddle.x); paddle.style.top = py(state.paddle.y); paddle.style.width = px(state.paddle.w);
    ballNode.hidden = !state.ball;
    if (state.ball) { ballNode.style.left = px(state.ball.x); ballNode.style.top = py(state.ball.y); }
    launchButton.hidden = !(state.ball?.held && state.phase === 'answering');
    const titleText = state.phase === 'completed' ? '' : `もんだい ${Math.min(state.questions, state.question + 1)}/${state.questions}　たすけたゴトモン ${state.freed}`;
    if (title.textContent !== titleText) title.textContent = titleText;
    if (state.problem && questionKey !== state.problem.contentId) {
      questionKey = state.problem.contentId; question.textContent = `${state.problem.question} = ?`;
      note.textContent = 'パドルをうごかして、答えのブロックにボールを当てよう';
    }
    const bounce = state.lastBounce;
    if (bounce && bounce.bounce !== shownBounce && state.phase === 'answering') {
      shownBounce = bounce.bounce;
      const node = nodes.get(bounce.blockId); if (node) restartClass(node, 'bk-bump');
      note.textContent = state.hintId ? `「${bounce.number}」だったよ。光っているブロックが ${state.problem.question} の答え！ 相棒がねらいを手伝うよ` : `コツン！「${bounce.number}」は ${state.problem.question} の答えじゃないよ`;
    }
  };
  const showAnswer = state => {
    const answer = state.lastAnswer, who = castAt(cast?.wild, freeSerial++);
    fx.burst(answer.x / R.width * 100, answer.y / R.height * 100, answer.first ? 'great' : 'good', answer.first ? 1.5 : 1.1);
    note.textContent = `パカーン！ ${answer.question} = ${answer.answer}${who ? `。${who.name}が出てきた！` : ''}`;
    if (who) {
      const fly = el('div', 'bk-free'), img = el('img'); img.alt = ''; img.src = who.imageUrl; fly.append(img);
      fly.style.left = px(answer.x); fly.style.top = py(answer.y); board.append(fly); later(fly, 'bk-free');
    }
    answers.push({ text: `${answer.question} = ${answer.answer}`, correct: answer.first });
    frame.announce(note.textContent);
  };

  return {
    root,
    attachCompanion(portrait) { buddy.append(portrait); },
    focusPlay() { launchButton.focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      if (!state.blocks) return;
      renderBlocks(state);
      if (!state.result) renderPlay(state);
      if (state.seq !== lastSeq) {
        lastSeq = state.seq;
        if (state.lastAnswer && state.lastAnswer.hit !== shownHit) { shownHit = state.lastAnswer.hit; showAnswer(state); }
      }
      if (state.result && !doneShown) {
        doneShown = true; review.hidden = false; reviewList.textContent = ''; ballNode.hidden = true;
        for (const item of answers) { const row = el('li', '', `${item.correct ? '✓' : '☆'} ${item.text}`); row.dataset.correct = String(item.correct); reviewList.append(row); }
      }
    },
    present(play, dt, state) {
      if (!active || !state) return;
      frame.tick(dt);
      const w = play.world || {};
      const event = w.lastEvent;
      if (event && event.id !== lastEventId) {
        lastEventId = event.id;
        if (event.type === 'boost') { fx.banner('パカーンフィーバー！', 'great'); fx.flash('great'); }
      }
      const mission = w.challenge;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: Math.min(1, (state.freed ?? 0) / (state.questions || 1)), progressLabel: `パカーン ${state.freed ?? 0}/${state.questions ?? 0}`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; dragging = false; [launchButton, go].forEach(node => { node.disabled = true; }); },
    dispose() { this.stopInput(); transient.splice(0).forEach(node => node.remove?.()); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
