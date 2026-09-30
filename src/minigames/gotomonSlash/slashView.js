import { createArcadeFrame, restartClass, bindArcadeKeys } from '../arcade/arcadeKit.js';
import { castAt } from '../gotomonCast.js';
import Speech from '../../audio/speech.js';

const pct = value => `${(value * 100).toFixed(3)}%`;
const CSS = `
#gotomonSlashScreen .ya-field{background:radial-gradient(circle at 20% 25%,#ffe7f055 0 8%,transparent 9%),radial-gradient(circle at 80% 18%,#fff6c855 0 6%,transparent 7%),linear-gradient(#3b2a6b,#6a3f8a 55%,#b0567a)}
#gotomonSlashScreen .ya-world{touch-action:none;cursor:crosshair}
#gotomonSlashScreen .sl-ball{position:absolute;z-index:3;display:grid;place-items:center;width:clamp(76px,11vw,120px);aspect-ratio:1;transform:translate(-50%,-50%);pointer-events:none}
#gotomonSlashScreen .sl-ball::before{content:'';position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 32% 28%,#fff 0 10%,transparent 11%),conic-gradient(#ff7ac0 0 25%,#ffe066 0 50%,#7ac8ff 0 75%,#9be08a 0);box-shadow:inset 0 -6px 0 #0002,0 4px 10px #0005}
#gotomonSlashScreen .sl-ball::after{content:'';position:absolute;left:50%;top:-10%;width:3px;height:14%;transform:translateX(-50%);background:#fffdf6}
#gotomonSlashScreen .sl-plate{position:relative;z-index:1;max-width:92%;padding:2px 8px;border-radius:10px;background:#fffdf6;border:3px solid #3b2a6b;color:#1b2a36;font-size:clamp(15px,min(2.2vw,3vh),22px);font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 3px 0 #0004}
#gotomonSlashScreen .sl-ball[data-hint=true] .sl-plate{border-color:#37c871;box-shadow:0 3px 0 #1f9d55,0 0 0 5px #37c871aa}
#gotomonSlashScreen .sl-ball[data-hint=true]::before{box-shadow:0 0 0 5px #37c871,0 0 20px #37c871}
#gotomonSlashScreen .sl-ball[data-state=knocked]{opacity:.55}
#gotomonSlashScreen .sl-ball[data-state=open]::before{animation:sl-open .5s ease-out forwards}
#gotomonSlashScreen .sl-ball[data-state=open] .sl-plate{animation:sl-fade .5s ease-out forwards}
#gotomonSlashScreen .sl-out{position:absolute;z-index:4;width:clamp(64px,9vw,100px);aspect-ratio:1;transform:translate(-50%,-50%);pointer-events:none;animation:sl-out 1.4s ease-out forwards}
#gotomonSlashScreen .sl-out img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 4px 4px #0006)}
#gotomonSlashScreen .sl-trail{position:absolute;z-index:5;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:#fff;box-shadow:0 0 10px #fff,0 0 18px #ffe066;pointer-events:none;animation:sl-trail .35s ease-out forwards}
#gotomonSlashScreen .sl-prompt{margin:0;padding:10px 12px;border-radius:14px;background:#ffffff14;color:#fff;text-align:center;font-size:clamp(24px,3.4vw,34px);font-weight:900;line-height:1.3}
#gotomonSlashScreen .sl-prompt small{display:block;margin-top:4px;font-size:15px;font-weight:700;color:#e4d4ff}
#gotomonSlashScreen .sl-prompt small b{color:#ffe066}
#gotomonSlashScreen .sl-title{margin:0;text-align:center;font-size:14px;font-weight:900;color:#ffd1e2}
#gotomonSlashScreen .sl-review{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
#gotomonSlashScreen .sl-review li{padding:6px 10px;border-radius:10px;background:#eef6ef;font-weight:700}
#gotomonSlashScreen .sl-review li[data-correct=false]{background:#fff3da}
@keyframes sl-open{0%{transform:none;opacity:1}40%{transform:scale(1.25) rotate(20deg)}100%{transform:scale(1.6) rotate(40deg);opacity:0}}
@keyframes sl-fade{to{opacity:0;transform:translateY(-20px)}}
@keyframes sl-out{0%{transform:translate(-50%,-50%) scale(.3);opacity:0}25%{transform:translate(-50%,-80%) scale(1.2);opacity:1}100%{transform:translate(-50%,-220%) scale(1);opacity:0}}
@keyframes sl-trail{to{transform:scale(.2);opacity:0}}
`;

export function createSlashView({ document: doc, dispatch, onBack, getSnapshot, cast }) {
  let active = true, lastEventId = 0, doneShown = false, shownSlash = 0, problemKey = null, outSerial = 0, last = null, moved = false;
  const removes = [], answers = [], transient = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'gotomonSlashScreen', title: 'ゴトモン・スラッシュ', theme: 'slash' });
  const { root, world, dock, fx, el, field } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });
  const nodes = new Map();

  const title = el('p', 'sl-title');
  const prompt = el('p', 'sl-prompt'); prompt.dataset.role = 'problem';
  // The shell advances after feedback; this stays hidden and only serves hosts without auto-advance.
  const go = el('button', 'sl-go', 'つぎへ'); go.type = 'button'; go.dataset.action = 'next'; go.hidden = true;
  const note = el('p', 'ya-dock-note'); note.dataset.role = 'feedback';
  dock.append(title, prompt, note, go);
  const review = el('div', 'ya-learning-result'); review.hidden = true;
  const reviewList = el('ol', 'sl-review'); review.append(el('h3', '', '今回のもんだい'), reviewList); frame.shell.append(review);
  doc.body.append(root);

  const session = () => getSnapshot();
  const pointOf = event => {
    const box = field.getBoundingClientRect?.();
    return box?.width && Number.isFinite(event?.clientX) ? { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height } : null;
  };
  function slash(a, b) {
    const state = session();
    if (!active || state.paused || state.phase !== 'answering') return false;
    return dispatch({ type: 'slash', payload: { sessionId: state.sessionId, attemptId: state.attemptId, x1: a.x, y1: a.y, x2: b.x, y2: b.y } });
  }
  const trail = point => {
    const dot = el('i', 'sl-trail'); dot.style.left = pct(point.x); dot.style.top = pct(point.y);
    dot.addEventListener?.('animationend', () => dot.remove?.()); world.append(dot); transient.push(dot);
    while (transient.length > 24) transient.shift().remove?.();
  };
  // Swiping cuts what the finger passes through; a tap cuts what is under it.
  on(world, 'pointerdown', event => { last = pointOf(event); moved = false; if (last) trail(last); });
  on(world, 'pointermove', event => {
    if (!last) return; const point = pointOf(event); if (!point) return;
    if (Math.hypot(point.x - last.x, point.y - last.y) < 0.01) return;
    moved = true; trail(point); slash(last, point); last = point;
  });
  on(world, 'pointerup', event => { const point = pointOf(event); if (last && !moved && point) slash(point, point); last = null; });
  on(world, 'pointercancel', () => { last = null; });
  removes.push(bindArcadeKeys(doc, event => {
    const k = ['1', '2', '3', '4'].indexOf(event.key);
    if (k < 0) return false;
    const flying = session().balls?.filter(ball => ball.state === 'flying').sort((a, b) => a.x - b.x) ?? [];
    const ball = flying[k]; return ball ? slash(ball, ball) : false;
  }));

  const render = state => {
    const live = new Set(state.balls.map(ball => ball.ballId));
    for (const [id, node] of nodes) if (!live.has(id)) { node.remove(); nodes.delete(id); }
    for (const ball of state.balls) {
      let node = nodes.get(ball.ballId);
      if (!node) { node = el('div', 'sl-ball'); node.append(el('span', 'sl-plate', ball.text)); world.append(node); nodes.set(ball.ballId, node); }
      node.style.left = pct(ball.x); node.style.top = pct(ball.y);
      if (node.dataset.state !== ball.state) node.dataset.state = ball.state;
      const hint = String(state.phase === 'answering' && ball.state === 'flying' && state.hintPlateId === ball.plateId);
      if (node.dataset.hint !== hint) node.dataset.hint = hint;
    }
    const titleText = state.phase === 'completed' ? '' : `もんだい ${Math.min(state.total, state.problemIndex + 1)}/${state.total}　出てきたゴトモン ${state.opened}`;
    if (title.textContent !== titleText) title.textContent = titleText;
    if (state.problem && problemKey !== state.problem.contentId) {
      problemKey = state.problem.contentId; prompt.textContent = state.problem.prompt;
      if (state.problem.sentence) { const small = el('small'); small.append(el('span', '', state.problem.sentence.before), el('b', '', state.problem.prompt.match(/「(.+?)」/)?.[1] ?? ''), el('span', '', state.problem.sentence.after)); prompt.append(small); }
      note.textContent = '答えのくす玉を、ゆびでスッと切ろう！';
      const word = state.problem.kind === 'en2ja' ? state.problem.prompt.split(' ')[0] : null;
      if (word) Speech.speakEnglish(word);
    }
  };
  const showSlash = state => {
    const answer = state.lastAnswer;
    if (answer.correct) {
      const who = castAt(cast?.wild, outSerial++);
      if (who) { const out = el('div', 'sl-out'), img = el('img'); img.alt = ''; img.src = who.imageUrl; out.append(img); out.style.left = pct(answer.x); out.style.top = pct(answer.y); out.addEventListener?.('animationend', () => out.remove?.()); world.append(out); transient.push(out); }
      fx.burst(answer.x * 100, answer.y * 100, answer.first ? 'great' : 'good', answer.first ? 1.5 : 1.1);
      fx.pop(answer.x * 100, answer.y * 100 - 10, 'パカッ！', 'great');
      note.textContent = `${who ? `${who.name}が出てきた！ ` : ''}${answer.explain}`;
      answers.push({ text: answer.explain, correct: answer.first });
    } else {
      fx.pop(answer.x * 100, answer.y * 100 - 8, 'カキン', 'soft');
      note.textContent = `そのふだは「${answer.text}」${answer.note ? `（${answer.note}）` : ''}。光っているくす玉をねらおう`;
    }
    frame.announce(note.textContent);
  };

  return {
    root,
    attachCompanion(portrait) { const buddy = el('div'); buddy.style.cssText = 'position:absolute;left:3%;bottom:3%;width:64px;height:64px;pointer-events:none;z-index:2'; buddy.append(portrait); world.append(buddy); },
    focusPlay() { root.focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      if (!state.balls) return;
      if (!state.result) render(state);
      if (state.lastAnswer && state.lastAnswer.slash !== shownSlash) { shownSlash = state.lastAnswer.slash; showSlash(state); }
      if (state.result && !doneShown) {
        doneShown = true; review.hidden = false; reviewList.textContent = '';
        for (const [, node] of nodes) node.remove(); nodes.clear();
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
        if (event.type === 'boost') { fx.banner('スラッシュフィーバー！', 'great'); fx.flash('great'); }
      }
      const mission = w.challenge;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: Math.min(1, (state.opened ?? 0) / (state.total || 1)), progressLabel: `パカッ ${state.opened ?? 0}/${state.total ?? 0}`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; last = null; Speech.cancel(); go.disabled = true; },
    dispose() { this.stopInput(); transient.splice(0).forEach(node => node.remove?.()); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
