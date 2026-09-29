import { createArcadeFrame, restartClass, setVar } from '../arcade/arcadeKit.js';
import { TOSS_BASKETS } from './tossContent.js';

// Where the companion throws from, in field percent.
const THROWER = Object.freeze({ x: 50, y: 90 });
const FLIGHT_MS = 380;
const CSS = `
#gotomonTossScreen .ya-field{background:radial-gradient(ellipse at 50% 108%,#6cbf5a 0 34%,transparent 35%),linear-gradient(#bfe6ff 0 22%,#9fd48a 22% 24%,#8cc97a 24%,#7ab86a)}
#gotomonTossScreen .gt-carrier{position:absolute;z-index:3;display:flex;flex-direction:column;align-items:center;gap:0;width:clamp(76px,12vw,120px);padding:0;border:0;background:none;font:inherit;color:#1b2a36;transform:translate(-50%,-50%);cursor:pointer;touch-action:manipulation}
#gotomonTossScreen .gt-carrier:focus-visible{outline:3px solid #2a6fb0;outline-offset:4px;border-radius:14px}
#gotomonTossScreen .gt-basket{position:relative;display:grid;place-items:center;min-width:clamp(48px,min(8vw,9vh),64px);height:clamp(32px,min(5.5vw,6.5vh),50px);padding:0 10px;border-radius:6px 6px 22px 22px;background:repeating-linear-gradient(90deg,#c98a3c 0 8px,#b5752c 8px 16px);border:3px solid #7a4a1a;box-shadow:0 4px 0 #5a3410;color:#fff;font-size:clamp(19px,min(3.2vw,4.2vh),30px);font-weight:900;text-shadow:0 2px 0 #5a3410}
#gotomonTossScreen .gt-carrier img{width:clamp(44px,min(9vw,11vh),96px);height:clamp(44px,min(9vw,11vh),96px);object-fit:contain;margin-top:-6px;filter:drop-shadow(0 4px 2px #0003);transition:transform .2s}
#gotomonTossScreen .gt-carrier[data-dir='-1'] img{transform:scaleX(-1)}
#gotomonTossScreen .gt-name{font-size:11px;font-weight:900;color:#244018;background:#ffffffaa;border-radius:8px;padding:0 6px;white-space:nowrap}
#gotomonTossScreen .gt-carrier[data-hint=true] .gt-basket{border-color:#37c871;box-shadow:0 4px 0 #1f9d55,0 0 0 5px #37c871aa;animation:gt-glow .7s ease-in-out infinite alternate}
#gotomonTossScreen .gt-carrier.gt-in .gt-basket{animation:gt-in .45s ease-out}
#gotomonTossScreen .gt-carrier.gt-miss img{animation:gt-miss .45s ease-out}
#gotomonTossScreen .gt-carrier.gt-new .gt-basket{animation:gt-new .3s ease-out}
#gotomonTossScreen .gt-thrower{position:absolute;left:50%;bottom:1%;z-index:4;width:clamp(64px,9vw,92px);height:clamp(64px,9vw,92px);transform:translateX(-50%);pointer-events:none}
#gotomonTossScreen .gt-thrower .gt-portrait{display:block;width:100%;height:100%;background:none;border:0}
#gotomonTossScreen .gt-thrower .gt-portrait img{width:100%;height:100%;object-fit:contain}
#gotomonTossScreen .gt-ball{position:absolute;z-index:5;width:22px;height:22px;margin:-11px 0 0 -11px;pointer-events:none;animation:gt-fly ${FLIGHT_MS}ms linear forwards}
#gotomonTossScreen .gt-ball i{display:block;width:100%;height:100%;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff 0 20%,#ff5d5d 22% 100%);box-shadow:0 2px 3px #0005;animation:gt-arc ${FLIGHT_MS}ms ease-out forwards}
#gotomonTossScreen .gt-ball[data-hit=false] i{animation:gt-arc ${FLIGHT_MS}ms ease-out forwards,gt-bounce .5s ${FLIGHT_MS}ms ease-in forwards}
#gotomonTossScreen .gt-question{margin:0;padding:10px 12px;border-radius:14px;background:#ffffff14;color:#fff;text-align:center;font-size:clamp(34px,5vw,48px);font-weight:900;letter-spacing:.04em;font-variant-numeric:tabular-nums}
#gotomonTossScreen .gt-title{margin:0;text-align:center;font-size:15px;font-weight:900;color:#d6f5c8}
#gotomonTossScreen .gt-review{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:6px}
#gotomonTossScreen .gt-review li{padding:6px 10px;border-radius:10px;background:#eef6ef;font-weight:700}
#gotomonTossScreen .gt-review li[data-correct=false]{background:#fff3da}
@media (max-width:700px){#gotomonTossScreen .gt-thrower{width:60px;height:60px}#gotomonTossScreen .gt-name{display:none}}
@keyframes gt-fly{from{left:var(--x0);top:var(--y0)}to{left:var(--x1);top:var(--y1)}}
@keyframes gt-arc{0%{transform:translateY(0) scale(1.2)}50%{transform:translateY(-70px) scale(1)}100%{transform:translateY(0) scale(.8)}}
@keyframes gt-bounce{to{transform:translate(30px,60px) scale(.7);opacity:0}}
@keyframes gt-in{0%,100%{transform:none}40%{transform:scale(1.18)}}
@keyframes gt-miss{0%,100%{transform:none}30%{transform:rotate(-10deg)}60%{transform:rotate(8deg)}}
@keyframes gt-new{from{transform:scale(.6)}to{transform:none}}
@keyframes gt-glow{from{transform:none}to{transform:translateY(-4px)}}
`;

export function createTossView({ document: doc, dispatch, onBack, getSnapshot }) {
  let active = true, lastSeq = -1, lastEventId = 0, problemKey = null, doneShown = false, shownThrow = 0;
  const removes = [], balls = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'gotomonTossScreen', title: 'ゴトモン玉入れ', theme: 'toss' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });

  const carriers = Array.from({ length: TOSS_BASKETS }, (_, index) => {
    const node = el('button', 'gt-carrier'); node.type = 'button'; node.dataset.index = String(index);
    const basket = el('span', 'gt-basket'), img = el('img'), name = el('span', 'gt-name');
    img.alt = ''; node.append(basket, img, name);
    on(node, 'click', () => toss(index)); world.append(node);
    return { node, basket, img, name, key: null, number: null, dir: null, x: null };
  });
  const thrower = el('div', 'gt-thrower'); world.append(thrower);

  const title = el('p', 'gt-title');
  const question = el('p', 'gt-question'); question.dataset.role = 'problem';
  // The shell advances after feedback; this stays hidden and only serves hosts without auto-advance.
  const go = el('button', 'gt-go', 'つぎへ'); go.type = 'button'; go.dataset.action = 'next'; go.hidden = true;
  on(go, 'click', () => proceed());
  const note = el('p', 'ya-dock-note'); note.dataset.role = 'feedback';
  dock.append(title, question, note, go);
  const review = el('div', 'ya-learning-result'); review.hidden = true;
  const reviewList = el('ol', 'gt-review'); review.append(el('h3', '', '今回の計算'), reviewList); frame.shell.append(review);
  doc.body.append(root);
  const answers = [];

  const session = () => getSnapshot();
  function toss(index) {
    const state = session(), basket = state.baskets?.[index];
    if (!active || state.paused || state.phase !== 'answering' || !basket) return false;
    return dispatch({ type: 'throw', payload: { sessionId: state.sessionId, attemptId: state.attemptId, basketId: basket.basketId } });
  }
  function proceed() {
    const state = session();
    if (!active || state.paused || state.phase !== 'feedback') return false;
    return dispatch({ type: 'next', payload: { sessionId: state.sessionId, problemId: state.problem?.problemId } });
  }

  // Positions move every frame; contents change only when a new problem starts.
  const renderCarriers = state => {
    carriers.forEach((item, index) => {
      const basket = state.baskets[index];
      if (!basket) { item.node.hidden = true; return; }
      if (item.key !== basket.basketId) {
        item.key = basket.basketId; item.name.textContent = basket.name;
        item.img.src = basket.imageUrl || ''; item.img.hidden = !basket.imageUrl;
      }
      if (item.number !== basket.number) {
        item.number = basket.number; item.basket.textContent = String(basket.number ?? '');
        item.node.setAttribute('aria-label', `${basket.name}のかご ${basket.number}`);
        restartClass(item.node, 'gt-new');
      }
      const x = `${(basket.x * 100).toFixed(2)}%`;
      if (item.x !== x) { item.x = x; item.node.style.left = x; item.node.style.top = `${basket.y * 100}%`; }
      const dir = String(basket.dir);
      if (item.dir !== dir) { item.dir = dir; item.node.dataset.dir = dir; }
      const hint = String(state.phase === 'answering' && state.hintBasketId === basket.basketId);
      if (item.node.dataset.hint !== hint) item.node.dataset.hint = hint;
      item.node.disabled = state.phase !== 'answering' || state.paused;
    });
  };
  const renderDock = state => {
    const titleText = state.problem ? `玉入れ ${Math.min(state.total, state.scored + 1)}/${state.total}` : '';
    if (title.textContent !== titleText) title.textContent = titleText;
    if (state.problem && problemKey !== state.problem.contentId) {
      problemKey = state.problem.contentId; question.textContent = `${state.problem.question} = ?`;
      note.textContent = 'こたえの かごを タップして 玉を入れよう';
    }
  };
  const throwBall = (answer, hit) => {
    const ball = el('span', 'gt-ball'); ball.append(el('i'));
    ball.dataset.hit = String(hit);
    setVar(ball, '--x0', `${THROWER.x}%`); setVar(ball, '--y0', `${THROWER.y}%`);
    setVar(ball, '--x1', `${answer.x * 100}%`); setVar(ball, '--y1', `${answer.y * 100 - 4}%`);
    const remove = () => { ball.remove?.(); const at = balls.indexOf(ball); if (at >= 0) balls.splice(at, 1); };
    ball.addEventListener?.('animationend', event => { if (event?.animationName === (hit ? 'gt-fly' : 'gt-bounce')) remove(); });
    world.append(ball); balls.push(ball);
    while (balls.length > 6) { const old = balls.shift(); old.remove?.(); }
  };
  const showAnswer = state => {
    const answer = state.lastAnswer;
    const item = carriers[answer.row];
    throwBall(answer, answer.correct);
    if (answer.correct) {
      if (item) restartClass(item.node, 'gt-in');
      note.textContent = `${answer.question} = ${answer.answer}　はいった！`;
      fx.burst(answer.x * 100, answer.y * 100 - 6, answer.first ? 'great' : 'good', answer.first ? 1.3 : 1);
      if (answer.first) fx.pop(answer.x * 100, answer.y * 100 - 14, 'ナイス！', 'great');
      answers.push({ text: `${answer.question} = ${answer.answer}`, correct: answer.first });
    } else {
      if (item) restartClass(item.node, 'gt-miss');
      note.textContent = `「${answer.value}」のかごだったよ。${answer.question} は いくつかな？ 光るかごに入れてみよう`;
    }
    frame.announce(note.textContent);
  };

  return {
    root,
    attachCompanion(portrait) { thrower.append(portrait); },
    focusPlay() { carriers[0].node.focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      if (!state.baskets?.length) return;
      if (!state.result) { renderCarriers(state); renderDock(state); }
      if (state.seq !== lastSeq) {
        lastSeq = state.seq;
        if (state.lastAnswer && state.lastAnswer.throw !== shownThrow) { shownThrow = state.lastAnswer.throw; showAnswer(state); }
      }
      if (state.result && !doneShown) {
        doneShown = true; review.hidden = false; reviewList.textContent = '';
        for (const item of answers) {
          const row = el('li', '', `${item.correct ? '✓' : '☆'} ${item.text}`);
          row.dataset.correct = String(item.correct); reviewList.append(row);
        }
      }
    },
    present(play, dt, state) {
      if (!active || !state) return;
      frame.tick(dt);
      const w = play.world || {};
      const event = w.lastEvent;
      if (event && event.id !== lastEventId) {
        lastEventId = event.id;
        if (event.type === 'boost') { fx.banner('玉入れフィーバー！', 'great'); fx.flash('great'); }
      }
      const mission = w.challenge;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: Math.min(1, (state.scored ?? 0) / (state.total || 1)), progressLabel: `玉 ${state.scored ?? 0}/${state.total ?? 0}`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; [...carriers.map(item => item.node), go].forEach(node => { node.disabled = true; }); },
    dispose() { this.stopInput(); balls.splice(0).forEach(ball => ball.remove?.()); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
