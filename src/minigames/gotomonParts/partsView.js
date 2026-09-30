import { createArcadeFrame, restartClass, bindArcadeKeys } from '../arcade/arcadeKit.js';
import { castAt } from '../gotomonCast.js';
import { PARTS_RULES as R } from './partsGame.js';

const colX = column => `${((column + 0.5) / R.columns * 100).toFixed(3)}%`;
const pct = value => `${(value * 100).toFixed(3)}%`;
const CSS = `
#gotomonPartsScreen .ya-field{background:linear-gradient(#fef3d7,#f6dca0 70%,#c99a5a 70.3%,#a87a42)}
#gotomonPartsScreen .kp-well{position:absolute;left:3%;right:3%;top:58px;bottom:1%;touch-action:none;cursor:pointer}
#gotomonPartsScreen .kp-col{position:absolute;top:0;bottom:0;width:${(100 / R.columns).toFixed(3)}%;transform:translateX(-50%);border-left:1px dashed #c9a86a66}
#gotomonPartsScreen .kp-col[data-aim=true]{background:linear-gradient(#fff0,#ffe06655)}
#gotomonPartsScreen .kp-fall{position:absolute;z-index:4;width:clamp(58px,9vw,96px);aspect-ratio:1;transform:translate(-50%,-50%);display:grid;place-items:center;border-radius:14px;background:#fffdf6;border:4px solid #d27a2a;box-shadow:0 5px 0 #a0561a;color:#1b2a36;font-size:clamp(36px,6vw,64px);font-weight:900;line-height:1;pointer-events:none;transition:left .12s ease-out}
#gotomonPartsScreen .kp-fall.kp-bounce{animation:kp-bounce .5s ease-out}
#gotomonPartsScreen .kp-base{position:absolute;box-sizing:border-box;z-index:3;top:${pct(R.baseY + 0.02)};width:${(100 / R.columns * 0.92).toFixed(3)}%;display:flex;flex-direction:column;align-items:center;gap:2px;transform:translateX(-50%);pointer-events:none}
#gotomonPartsScreen .kp-base img{position:absolute;right:-6%;bottom:-18%;width:clamp(32px,4.4vw,48px);height:clamp(32px,4.4vw,48px);object-fit:contain;filter:drop-shadow(0 3px 2px #0005)}
#gotomonPartsScreen .kp-part{display:grid;place-items:center;width:clamp(52px,8vw,84px);aspect-ratio:1;border-radius:12px;background:#fffdf6;border:3px solid #7a4a1a;box-shadow:0 4px 0 #5a3410;color:#1b2a36;font-size:clamp(32px,5vw,56px);font-weight:900;line-height:1}
#gotomonPartsScreen .kp-base[data-hint=true] .kp-part{border-color:#37c871;box-shadow:0 4px 0 #1f9d55,0 0 0 5px #37c871aa;animation:kp-glow .7s ease-in-out infinite alternate}
#gotomonPartsScreen .kp-base.kp-new .kp-part{animation:kp-new .3s ease-out}
#gotomonPartsScreen .kp-made{position:absolute;z-index:5;display:grid;place-items:center;width:clamp(96px,14vw,150px);aspect-ratio:1;transform:translate(-50%,-50%);border-radius:18px;background:#fff6cf;border:4px solid #ffb627;box-shadow:0 0 24px #ffd54a;color:#3a2400;font-size:clamp(60px,9vw,100px);font-weight:900;pointer-events:none;animation:kp-made 1.3s ease-out forwards}
#gotomonPartsScreen .kp-target{display:flex;align-items:center;justify-content:center;gap:12px;margin:0;padding:8px 12px;border-radius:14px;background:#ffffff14;color:#fff}
#gotomonPartsScreen .kp-target b{font-size:clamp(48px,7vw,72px);line-height:1}
#gotomonPartsScreen .kp-target span{font-size:18px;font-weight:800}
#gotomonPartsScreen .kp-sum{margin:0;text-align:center;color:#ffe2b8;font-size:clamp(22px,3vw,30px);font-weight:900}
#gotomonPartsScreen .kp-title{margin:0;text-align:center;font-size:14px;font-weight:900;color:#ffe2b8}
#gotomonPartsScreen .kp-pad{display:grid;grid-template-columns:1fr 1fr 1.4fr;gap:8px}
#gotomonPartsScreen .kp-pad button{min-height:52px;border:0;border-radius:14px;background:#fffaf0;color:#3a2400;font:inherit;font-size:20px;font-weight:900;box-shadow:0 4px 0 #d9b98f;cursor:pointer;touch-action:manipulation}
#gotomonPartsScreen .kp-pad [data-act=drop]{background:#ffb627;box-shadow:0 4px 0 #b57500}
#gotomonPartsScreen .kp-review{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px}
#gotomonPartsScreen .kp-review li{padding:6px 10px;border-radius:10px;background:#eef6ef;font-weight:700}
#gotomonPartsScreen .kp-review li[data-correct=false]{background:#fff3da}
@media (max-width:700px){#gotomonPartsScreen .kp-well{top:86px}#gotomonPartsScreen .kp-base img{width:28px;height:28px}}
@keyframes kp-bounce{0%{transform:translate(-50%,-50%)}40%{transform:translate(-50%,-50%) rotate(-12deg)}100%{transform:translate(-50%,-50%)}}
@keyframes kp-glow{from{transform:none}to{transform:translateY(-4px)}}
@keyframes kp-new{from{transform:scale(.6)}to{transform:none}}
@keyframes kp-made{0%{transform:translate(-50%,-50%) scale(.4);opacity:0}25%{transform:translate(-50%,-70%) scale(1.15);opacity:1}75%{transform:translate(-50%,-90%) scale(1);opacity:1}100%{transform:translate(-50%,-140%);opacity:0}}
`;
const JOIN = Object.freeze({ lr: 'となりにならべると', tb: '上と下にかさねると', out: '外と中に入れると' });

export function createPartsView({ document: doc, dispatch, onBack, getSnapshot, cast }) {
  let active = true, lastEventId = 0, doneShown = false, shownLanding = 0, targetKey = null;
  const removes = [], answers = [], transient = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'gotomonPartsScreen', title: '漢字パーツ落とし', theme: 'parts' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });

  const well = el('div', 'kp-well'); well.setAttribute('aria-label', 'パーツの井戸');
  const columns = Array.from({ length: R.columns }, (_, column) => { const node = el('i', 'kp-col'); node.style.left = colX(column); well.append(node); return node; });
  // Each base is held by a Gotomon.
  const guards = [...(cast?.friends ?? []), ...(cast?.wild ?? [])].filter((item, i, all) => all.findIndex(other => other.id === item.id) === i);
  const bases = Array.from({ length: R.columns }, (_, column) => {
    const node = el('div', 'kp-base'), part = el('span', 'kp-part'), who = castAt(guards, column);
    node.style.left = colX(column); node.append(part);
    if (who) { const img = el('img'); img.alt = ''; img.src = who.imageUrl; node.append(img); }
    well.append(node); return { node, part, text: null };
  });
  const fall = el('div', 'kp-fall'); well.append(fall); world.append(well);

  const title = el('p', 'kp-title');
  const target = el('p', 'kp-target'); target.dataset.role = 'problem';
  const targetKanji = el('b'), targetReading = el('span'); target.append(targetKanji, targetReading);
  const sum = el('p', 'kp-sum');
  const pad = el('div', 'kp-pad');
  const button = (text, act, label) => { const node = el('button', '', text); node.type = 'button'; node.dataset.act = act; node.setAttribute('aria-label', label); on(node, 'click', () => command(act)); pad.append(node); return node; };
  const buttons = [button('◀', 'left', '左へ'), button('▶', 'right', '右へ'), button('おとす', 'drop', 'おとす')];
  // The shell advances after feedback; this stays hidden and only serves hosts without auto-advance.
  const go = el('button', 'kp-go', 'つぎへ'); go.type = 'button'; go.dataset.action = 'next'; go.hidden = true;
  const note = el('p', 'ya-dock-note'); note.dataset.role = 'feedback';
  dock.append(title, target, sum, pad, note, go);
  const review = el('div', 'ya-learning-result'); review.hidden = true;
  const reviewList = el('ol', 'kp-review'); review.append(el('h3', '', '今回くみたてた漢字'), reviewList); frame.shell.append(review);
  doc.body.append(root);

  const session = () => getSnapshot();
  function command(act, extra = {}) {
    const state = session();
    if (!active || state.paused || state.phase !== 'answering') return false;
    const payload = { sessionId: state.sessionId, attemptId: state.attemptId, ...extra };
    if (act === 'left' || act === 'right') return dispatch({ type: 'shift', payload: { ...payload, direction: act === 'left' ? -1 : 1 } });
    return dispatch({ type: act, payload });
  }
  // Tap a column to move there; tap the part's own column to drop it.
  on(well, 'pointerdown', event => {
    const state = session(), box = well.getBoundingClientRect?.();
    if (!state.falling || !box?.width || !Number.isFinite(event?.clientX)) return;
    const column = Math.min(R.columns - 1, Math.max(0, Math.floor((event.clientX - box.left) / box.width * R.columns)));
    if (column === state.falling.column) command('drop'); else command('move', { column });
  });
  removes.push(bindArcadeKeys(doc, event => {
    const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'drop', ' ': 'drop' };
    return map[event.key] ? command(map[event.key]) : false;
  }));

  const render = state => {
    bases.forEach((item, column) => {
      const base = state.bases[column];
      if (item.text !== base.part) { item.text = base.part; item.part.textContent = base.part; item.node.setAttribute('aria-label', `${base.part}のパーツ`); restartClass(item.node, 'kp-new'); }
      const hint = String(state.phase === 'answering' && state.hintColumn === column);
      if (item.node.dataset.hint !== hint) item.node.dataset.hint = hint;
    });
    fall.hidden = !state.falling || state.phase !== 'answering';
    if (state.falling) {
      if (fall.textContent !== state.falling.part) fall.textContent = state.falling.part;
      fall.style.left = colX(state.falling.column); fall.style.top = pct(state.falling.y);
    }
    columns.forEach((node, column) => { const aim = String(state.falling?.column === column && state.phase === 'answering'); if (node.dataset.aim !== aim) node.dataset.aim = aim; });
    buttons.forEach(node => { node.disabled = state.paused || state.phase !== 'answering'; });
    const titleText = state.phase === 'completed' ? '' : `漢字 ${Math.min(state.total, state.targetIndex + 1)}/${state.total}　できた ${state.made}`;
    if (title.textContent !== titleText) title.textContent = titleText;
    if (state.target && targetKey !== `${state.targetIndex}`) {
      targetKey = `${state.targetIndex}`;
      targetKanji.textContent = state.target.kanji; targetReading.textContent = `（${state.target.reading}）をつくろう`;
      note.textContent = 'おちてくるパーツを、あいぼうのパーツの上へ動かして おとそう';
    }
    if (state.falling && state.phase === 'answering') { const text = `${state.falling.part} ＋ ？ ＝ ${state.target.kanji}`; if (sum.textContent !== text) sum.textContent = text; }
  };
  const showLanding = state => {
    const answer = state.lastAnswer, x = (answer.column + 0.5) / R.columns * 100;
    if (answer.correct) {
      const made = el('div', 'kp-made', answer.kanji); made.style.left = colX(answer.column); made.style.top = pct(R.baseY - 0.05);
      made.addEventListener?.('animationend', () => made.remove?.()); well.append(made); transient.push(made);
      fx.burst(x, R.baseY * 100, answer.first ? 'great' : 'good', answer.first ? 1.4 : 1.1);
      sum.textContent = `${answer.parts[0]} ＋ ${answer.parts[1]} ＝ ${answer.kanji}`;
      note.textContent = `がったい！ ${answer.parts[0]}と${answer.parts[1]}を${JOIN[answer.layout]}「${answer.kanji}」（${answer.reading}）`;
      answers.push({ text: `${answer.parts[0]}＋${answer.parts[1]}＝${answer.kanji}`, correct: answer.first });
    } else {
      restartClass(fall, 'kp-bounce');
      note.textContent = `「${answer.part}」と「${answer.onto}」では漢字にならないよ。光っているパーツをさがそう`;
    }
    frame.announce(note.textContent);
  };

  return {
    root,
    attachCompanion(portrait) { const buddy = el('div'); buddy.style.cssText = 'width:52px;height:52px;flex:none'; buddy.append(portrait); target.prepend(buddy); },
    focusPlay() { buttons[2].focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      if (!state.bases?.length) return;
      if (!state.result) render(state);
      if (state.lastAnswer && state.lastAnswer.landing !== shownLanding) { shownLanding = state.lastAnswer.landing; showLanding(state); }
      if (state.result && !doneShown) {
        doneShown = true; review.hidden = false; reviewList.textContent = ''; fall.hidden = true;
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
        if (event.type === 'boost') { fx.banner('がったいフィーバー！', 'great'); fx.flash('great'); }
      }
      const mission = w.challenge;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: Math.min(1, (state.made ?? 0) / (state.total || 1)), progressLabel: `漢字 ${state.made ?? 0}/${state.total ?? 0}`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; [...buttons, go].forEach(node => { node.disabled = true; }); },
    dispose() { this.stopInput(); transient.splice(0).forEach(node => node.remove?.()); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
