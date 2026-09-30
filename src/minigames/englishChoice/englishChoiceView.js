import { createArcadeFrame, bindArcadeKeys } from '../arcade/arcadeKit.js';
import { castAt } from '../gotomonCast.js';

const CSS = `
#englishChoiceScreen .ya-field{background:radial-gradient(ellipse at 50% 0,#6b4fa3 0,transparent 60%),linear-gradient(#2a1d4a,#3b2a5e 70%,#4a3526 70.3%,#35251a)}
#englishChoiceScreen .ec-torch{position:absolute;top:18%;width:14px;height:40px;border-radius:4px;background:#6d4b2a}
#englishChoiceScreen .ec-torch::after{content:'';position:absolute;left:50%;top:-26px;width:26px;height:30px;transform:translateX(-50%);border-radius:50% 50% 45% 45%;background:radial-gradient(circle at 50% 70%,#fff3b0,#ffb627 45%,#ff7a3900 72%);animation:ec-flame .5s ease-in-out infinite alternate}
#englishChoiceScreen .ec-lane{position:absolute;top:0;bottom:30%;width:2px;background:linear-gradient(#ffffff00,#ffffff22);transform:translateX(-50%)}
#englishChoiceScreen .ec-chest{position:absolute;z-index:4;width:min(22%,170px);transform:translate(-50%,0);padding:0;border:0;background:none;font:inherit;color:#2a1c10;cursor:pointer;touch-action:manipulation;display:flex;flex-direction:column;align-items:center;gap:4px}
#englishChoiceScreen .ec-box{position:relative;width:min(100%,92px);aspect-ratio:1.35;border-radius:10px 10px 6px 6px;background:linear-gradient(#b0732f,#8a5522);border:3px solid #5c3514;box-shadow:0 5px 0 #0005}
#englishChoiceScreen .ec-box::before{content:'';position:absolute;left:-3px;right:-3px;top:-3px;height:42%;border-radius:12px 12px 3px 3px;background:linear-gradient(#c98a3d,#9c6128);border:3px solid #5c3514;transform-origin:50% 0;transition:transform .25s}
#englishChoiceScreen .ec-box::after{content:'';position:absolute;left:50%;top:32%;width:16px;height:18px;transform:translateX(-50%);border-radius:3px;background:#ffd54a;border:2px solid #7a5200}
#englishChoiceScreen .ec-label{max-width:100%;padding:5px 10px;border-radius:12px;background:#fffdf3;border:3px solid #5c3514;font-size:clamp(15px,2.2vw,22px);font-weight:900;line-height:1.15;white-space:nowrap;box-shadow:0 3px 0 #0004}
#englishChoiceScreen .ec-key{font-size:.7em;color:#7a6a58;margin-right:4px}
#englishChoiceScreen .ec-chest:focus-visible .ec-label{outline:3px solid #ffd54a;outline-offset:2px}
#englishChoiceScreen .ec-chest[data-status=correct] .ec-box::before{transform:rotateX(70deg) translateY(-8px)}
#englishChoiceScreen .ec-chest[data-status=correct] .ec-box{box-shadow:0 0 0 4px #ffe066,0 0 30px #ffd54a}
#englishChoiceScreen .ec-chest[data-status=correct] .ec-label{background:#d7f7df;border-color:#1f9d55}
#englishChoiceScreen .ec-mon{position:absolute;left:50%;top:-8px;width:70%;aspect-ratio:1;object-fit:contain;transform:translate(-50%,0) scale(.3);opacity:0;pointer-events:none;filter:drop-shadow(0 4px 4px #0006);z-index:2}
#englishChoiceScreen .ec-chest[data-status=correct] .ec-mon{animation:ec-out .6s ease-out forwards}
@keyframes ec-out{0%{transform:translate(-50%,0) scale(.3);opacity:0}60%{transform:translate(-50%,-80%) scale(1.1);opacity:1}100%{transform:translate(-50%,-60%) scale(1);opacity:1}}
#englishChoiceScreen .ec-chest[data-status=empty] .ec-box::before{transform:rotateX(70deg) translateY(-8px)}
#englishChoiceScreen .ec-chest[data-status=empty]{opacity:.7}
#englishChoiceScreen .ec-chest[data-status=faded]{opacity:.35}
#englishChoiceScreen .ec-chest[data-arrived=true]:not([data-status]) .ec-box{animation:ec-wobble .9s ease-in-out infinite}
#englishChoiceScreen .ec-hero{position:absolute;left:50%;bottom:4%;z-index:5;width:clamp(70px,10vw,100px);height:clamp(70px,10vw,100px);transform:translateX(-50%)}
#englishChoiceScreen .ec-hero .gt-portrait{display:block;width:100%;height:100%;background:none;border:0}
#englishChoiceScreen .ec-hero .gt-portrait img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 6px 3px #0006)}
#englishChoiceScreen .ec-hero[data-fever=true]::after{content:'';position:absolute;inset:-18%;border-radius:50%;background:radial-gradient(circle,#ffd54a66,transparent 70%);animation:ya-glow .4s infinite alternate;z-index:-1}
#englishChoiceScreen .ec-word{margin:0;text-align:center;font-size:clamp(34px,5.4vw,52px);font-weight:900;letter-spacing:.02em;color:#fff;font-family:system-ui,"Segoe UI",sans-serif}
#englishChoiceScreen .ec-ask{margin:0;text-align:center;font-size:15px;font-weight:700;color:#d8c8ff}
#englishChoiceScreen .ec-next{min-height:52px;border:0;border-radius:14px;background:#ffb627;color:#3a2400;font:inherit;font-size:20px;font-weight:900;box-shadow:0 4px 0 #b57500;cursor:pointer}
#englishChoiceScreen .ec-review{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
#englishChoiceScreen .ec-review li{padding:6px 10px;border-radius:10px;background:#eef6ef;font-weight:700}
#englishChoiceScreen .ec-review li[data-correct=false]{background:#fff3da}
@keyframes ec-flame{from{transform:translateX(-50%) scale(.92)}to{transform:translateX(-50%) scale(1.08)}}
@keyframes ec-wobble{0%,100%{transform:rotate(0)}25%{transform:rotate(-4deg)}75%{transform:rotate(4deg)}}
`;

const LANE_X = [12.5, 37.5, 62.5, 87.5];
// Chests fall from the top band (kept clear for the HUD) to just above the companion.
const TOP_Y = 14, BOTTOM_Y = 58;

export function createEnglishChoiceView({ document: doc, dispatch, onBack, getSnapshot, cast }) {
  // A Gotomon waits in the treasure chest and jumps out when it opens.
  let chestSerial = 0, hiding = null;
  let active = true, problemId = null, lastSeq = -1, lastEventId = 0;
  const removes = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'englishChoiceScreen', title: 'えいたんご4たく', theme: 'treasure' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });
  for (const x of [4, 96]) { const torch = el('i', 'ec-torch'); torch.style.left = `${x}%`; world.append(torch); }
  for (const x of LANE_X) { const lane = el('i', 'ec-lane'); lane.style.left = `${x}%`; world.append(lane); }
  const chests = LANE_X.map((x, index) => {
    const node = el('button', 'ec-chest'); node.type = 'button'; node.dataset.choiceIndex = String(index + 1);
    node.style.left = `${x}%`; node.style.top = `${TOP_Y}%`;
    const label = el('span', 'ec-label'), mon = el('img', 'ec-mon'); mon.alt = ''; mon.hidden = true; node.append(mon, el('span', 'ec-box'), label);
    on(node, 'click', () => choose(index));
    world.append(node);
    return { node, label, mon };
  });
  const hero = el('div', 'ec-hero'); world.append(hero);

  const word = el('p', 'ec-word'); word.dataset.role = 'problem'; word.lang = 'en';
  const ask = el('p', 'ec-ask', 'の いみは？');
  const note = el('p', 'ya-dock-note', '意味の合う宝箱をタップ！');
  const next = el('button', 'ec-next', 'つぎへ'); next.type = 'button'; next.dataset.action = 'next'; next.hidden = true;
  on(next, 'click', () => {
    const state = getSnapshot();
    if (active && !state.paused && state.phase === 'feedback') dispatch({ type: 'next', payload: { sessionId: state.sessionId, problemId: state.problem?.problemId } });
  });
  dock.append(word, ask, note, next);
  const review = el('div', 'ya-learning-result'); review.hidden = true;
  const reviewList = el('ol', 'ec-review'); review.append(el('h3', '', '今回のことば'), reviewList); frame.shell.append(review);
  doc.body.append(root);
  const answers = [];

  function choose(index) {
    const state = getSnapshot(), choice = state.problem?.choices[index];
    if (!active || state.paused || state.phase !== 'answering' || !choice) return false;
    return dispatch({ type: 'answer', payload: { sessionId: state.sessionId, problemId: state.problem.problemId,
      attemptId: state.attemptId, choiceId: choice.choiceId } });
  }
  removes.push(bindArcadeKeys(doc, event => {
    if (!active || event.repeat) return false;
    const index = ['1', '2', '3', '4'].indexOf(event.key);
    if (index >= 0) { choose(index); return true; }
    if (event.key === 'Enter' && !next.hidden) { next.click(); return true; }
    return false;
  }));

  const showAnswer = state => {
    const answer = state.lastAnswer, problem = state.problem;
    const correctIndex = problem.choices.findIndex(choice => choice.choiceId === answer.correctChoiceId);
    const chosenIndex = problem.choices.findIndex(choice => choice.choiceId === answer.choiceId);
    const meaning = problem.choices[correctIndex]?.text ?? '';
    chests.forEach(({ node }, index) => {
      node.dataset.status = index === correctIndex ? 'correct' : index === chosenIndex ? 'empty' : 'faded';
    });
    const top = parseFloat(chests[correctIndex].node.style.top) || TOP_Y;
    answers.push({ word: problem.prompt, meaning, correct: answer.correct });
    if (answer.correct) {
      fx.burst(LANE_X[correctIndex], top + 6, 'good', 1.2);
      note.textContent = `せいかい！ ${problem.prompt} は「${meaning}」${hiding ? `。宝箱から${hiding.name}が出てきた！` : ''}`;
      frame.announce(`せいかい。${problem.prompt} は ${meaning}`);
    } else {
      fx.pop(LANE_X[chosenIndex], top, 'からっぽ…', 'soft');
      fx.pop(LANE_X[correctIndex], top - 6, `宝はこっち！`, 'info');
      note.textContent = `${problem.prompt} は「${meaning}」。次でとりかえそう！`;
      frame.announce(`${problem.prompt} は ${meaning}`);
    }
  };

  return {
    root,
    attachCompanion(portrait) { hero.append(portrait); },
    focusPlay() { chests[0].node.focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      const problem = state.problem;
      if (problem && problem.problemId !== problemId) {
        problemId = problem.problemId;
        word.textContent = problem.prompt;
        hiding = castAt(cast?.wild, chestSerial++);
        chests.forEach(({ node, label, mon }, index) => {
          const choice = problem.choices[index];
          if (mon) { mon.hidden = !hiding; if (hiding) mon.src = hiding.imageUrl; }
          node.hidden = !choice; delete node.dataset.status;
          label.textContent = '';
          node.dataset.choiceId = choice?.choiceId ?? '';
          if (choice) { label.append(el('span', 'ec-key', String(index + 1)), el('span', '', choice.text)); node.setAttribute('aria-label', `${index + 1}番 ${choice.text}`); }
        });
        note.textContent = state.mode === 'review' ? '意味をたしかめよう' : '意味の合う宝箱をタップ！';
      }
      if (state.seq !== lastSeq) {
        lastSeq = state.seq;
        if (state.lastAnswer && answers.length < state.answered) showAnswer(state);
      }
      const canAnswer = active && !state.paused && state.phase === 'answering';
      chests.forEach(({ node }) => { node.disabled = !canAnswer; });
      next.hidden = !(state.mode === 'review' && state.phase === 'feedback');
      next.disabled = !!state.paused;
      if (state.result && review.hidden) {
        review.hidden = false; reviewList.textContent = '';
        for (const item of answers) {
          const row = el('li', '', `${item.correct ? '✓' : '☆'} ${item.word} = ${item.meaning}`);
          row.dataset.correct = String(item.correct); reviewList.append(row);
        }
      }
    },
    present(play, dt, state) {
      if (!active || !state) return;
      frame.tick(dt);
      const w = play.world || {};
      // Chests stay where they were caught once the question is answered.
      if (state.phase === 'answering' || !state.lastAnswer) {
        const y = TOP_Y + (w.progress ?? 0) * (BOTTOM_Y - TOP_Y);
        chests.forEach(({ node }) => { node.style.top = `${y}%`; node.dataset.arrived = String(!!w.arrived); });
      }
      hero.dataset.fever = String(!!w.fever);
      const event = w.lastEvent;
      if (event && event.id !== lastEventId) {
        lastEventId = event.id;
        if (event.type === 'hit') fx.pop(50, 70, event.special ? '金の宝箱！' : event.quick ? 'はやわざキャッチ！' : 'キャッチ！', event.special ? 'great' : 'good');
        else if (event.type === 'boost') { fx.banner('おたからフィーバー！', 'great'); fx.flash('great'); }
      }
      // Review runs have no goal; only normal play shows the mission.
      const mission = state.mode === 'review' ? null : w.challenge;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: (state.answered ?? 0) / (state.totalQuestions || 10),
        progressLabel: `宝箱 ${w.correct ?? 0} · ${Math.min(state.totalQuestions || 10, (state.answered ?? 0) + (state.phase === 'answering' ? 1 : 0))}/${state.totalQuestions || 10}問`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
      if (state.phase === 'answering' && w.arrived && state.mode !== 'review') note.textContent = '宝箱が着いたよ。ゆっくり選ぼう';
    },
    stopInput() { active = false; chests.forEach(({ node }) => { node.disabled = true; }); next.disabled = true; },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
