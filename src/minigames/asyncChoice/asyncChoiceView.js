import { createArcadeFrame, bindArcadeKeys, setVar } from '../arcade/arcadeKit.js';

const CSS = `
#asyncChoiceScreen .ya-field{background:radial-gradient(ellipse at 50% 0,#3d5a4a 0,transparent 55%),linear-gradient(#1f2f2a,#2b3f36 40%,#5b4a36 40.3%,#4a3b2a)}
#asyncChoiceScreen .ac-rock{position:absolute;left:0;right:0;top:0;height:40%;background-image:radial-gradient(ellipse 70px 40px at 50px 100%,#364a40 60%,transparent 62%),radial-gradient(ellipse 50px 30px at 130px 100%,#2e4037 60%,transparent 62%);background-size:180px 100%;background-repeat:repeat-x}
#asyncChoiceScreen .ac-rails{position:absolute;inset:0;width:100%;height:100%;z-index:1;overflow:visible}
#asyncChoiceScreen .ac-rails path{fill:none;stroke:#9b8a73;stroke-width:5;stroke-linecap:round;vector-effect:non-scaling-stroke}
#asyncChoiceScreen .ac-rails path.ac-ties{stroke:#6b5238;stroke-width:14;stroke-dasharray:4 14}
#asyncChoiceScreen .ac-rails path[data-lit=true]{stroke:#ffd54a}
#asyncChoiceScreen .ac-tunnel{position:absolute;z-index:3;top:9%;width:min(23%,170px);min-width:44px;min-height:44px;transform:translateX(-50%);padding:0;border:0;background:none;font:inherit;cursor:pointer;touch-action:manipulation;display:flex;flex-direction:column;align-items:center;gap:4px}
#asyncChoiceScreen .ac-mouth{width:min(100%,110px);aspect-ratio:1.5;border-radius:50% 50% 6px 6px;background:radial-gradient(ellipse at 50% 90%,#0c1310 55%,#231a12 57%);border:5px solid #6b5238;box-shadow:inset 0 -6px 0 #0006}
#asyncChoiceScreen .ac-sign{max-width:100%;padding:5px 10px;border-radius:10px;background:#fffdf3;color:#2a1c10;border:3px solid #6b5238;font-size:clamp(15px,2.1vw,21px);font-weight:900;white-space:nowrap;box-shadow:0 3px 0 #0004}
#asyncChoiceScreen .ac-key{font-size:.65em;color:#8a7358;margin-right:3px}
#asyncChoiceScreen .ac-tunnel:focus-visible .ac-sign{outline:3px solid #ffd54a;outline-offset:2px}
#asyncChoiceScreen .ac-tunnel[data-status=correct] .ac-mouth{box-shadow:inset 0 -6px 0 #0006,0 0 0 4px #ffe066,0 0 30px #ffd54a;background:radial-gradient(circle at 50% 70%,#fff3b0,#ffb627 30%,#0c1310 60%)}
#asyncChoiceScreen .ac-tunnel[data-status=correct] .ac-sign{background:#d7f7df;border-color:#1f9d55}
#asyncChoiceScreen .ac-tunnel[data-status=chosen] .ac-sign{background:#fff1d6;border-color:#c77f16}
#asyncChoiceScreen .ac-tunnel[data-status=faded]{opacity:.4}
#asyncChoiceScreen .ac-cart{position:absolute;z-index:4;width:clamp(84px,12vw,120px);transform:translate(-50%,-100%);transition:left .35s ease-in-out,top .35s ease-in-out}
#asyncChoiceScreen .ac-cart .gt-portrait{position:relative;z-index:1;display:block;width:78%;height:auto;aspect-ratio:1;margin:0 auto -34%;background:none;border:0}
#asyncChoiceScreen .ac-cart .gt-portrait img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 4px 2px #0006)}
#asyncChoiceScreen .ac-car{position:relative;z-index:2;display:block;height:clamp(34px,5vw,48px);border-radius:6px 6px 14px 14px;background:linear-gradient(#8a8f96,#5c6168);border:4px solid #3a3e44}
#asyncChoiceScreen .ac-car::before,#asyncChoiceScreen .ac-car::after{content:'';position:absolute;bottom:-12px;width:18px;height:18px;border-radius:50%;background:#2a2d31;border:3px solid #9aa0a8}
#asyncChoiceScreen .ac-car::before{left:12%}#asyncChoiceScreen .ac-car::after{right:12%}
#asyncChoiceScreen .ac-cart[data-moving=true] .ac-car{animation:ac-rattle .18s linear infinite alternate}
#asyncChoiceScreen .ac-cart[data-fever=true]::after{content:'';position:absolute;inset:-14%;border-radius:50%;background:radial-gradient(circle,#ffd54a66,transparent 70%);animation:ya-glow .4s infinite alternate;z-index:0}
#asyncChoiceScreen .ac-prompt{margin:0;text-align:center;font-size:clamp(22px,3vw,30px);font-weight:900;line-height:1.35;color:#fff}
#asyncChoiceScreen .ac-status{margin:0;text-align:center;font-size:18px;font-weight:800;color:#d8e8f0}
#asyncChoiceScreen .ac-next{min-height:52px;border:0;border-radius:14px;background:#ffb627;color:#3a2400;font:inherit;font-size:20px;font-weight:900;box-shadow:0 4px 0 #b57500;cursor:pointer}
#asyncChoiceScreen .ac-review{margin:0;padding:0;list-style:none;display:grid;gap:6px}
#asyncChoiceScreen .ac-review li{padding:6px 10px;border-radius:10px;background:#eef6ef;font-weight:700}
#asyncChoiceScreen .ac-review li[data-correct=false]{background:#fff3da}
@keyframes ac-rattle{from{transform:translateY(0)}to{transform:translateY(-2px)}}
`;

const EXIT_X = [14, 38, 62, 86];
// The trunk runs up the middle; the cart rolls from START_Y to the fork at FORK_Y.
const TRUNK_X = 50, START_Y = 96, FORK_Y = 62, TUNNEL_Y = 30;
const SVG = 'http://www.w3.org/2000/svg';

export function createAsyncChoiceView({ document: doc, dispatch, onBack, getSnapshot }) {
  let active = true, problemId = null, lastSeq = -1, lastEventId = 0, choiceIndex = null;
  const removes = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'asyncChoiceScreen', title: 'よみこみクイズ', theme: 'mine' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });
  world.append(el('div', 'ac-rock'));
  // Rails are drawn in a 100x100 box that stretches with the field.
  const rails = doc.createElementNS ? doc.createElementNS(SVG, 'svg') : el('div');
  rails.setAttribute('class', 'ac-rails'); rails.setAttribute('viewBox', '0 0 100 100'); rails.setAttribute('preserveAspectRatio', 'none');
  const railPath = (d, className = '') => {
    const path = doc.createElementNS ? doc.createElementNS(SVG, 'path') : el('i');
    path.setAttribute('d', d); if (className) path.setAttribute('class', className); rails.append(path); return path;
  };
  const trunk = `M ${TRUNK_X} 100 L ${TRUNK_X} ${FORK_Y}`;
  railPath(trunk, 'ac-ties'); railPath(trunk);
  const branches = EXIT_X.map(x => {
    const d = `M ${TRUNK_X} ${FORK_Y} C ${TRUNK_X} ${FORK_Y - 14}, ${x} ${TUNNEL_Y + 16}, ${x} ${TUNNEL_Y}`;
    railPath(d, 'ac-ties'); return railPath(d);
  });
  world.append(rails);
  const tunnels = EXIT_X.map((x, index) => {
    const node = el('button', 'ac-tunnel'); node.type = 'button'; node.dataset.choiceIndex = String(index + 1);
    node.style.left = `${x}%`;
    const sign = el('span', 'ac-sign'); node.append(el('span', 'ac-mouth'), sign);
    on(node, 'click', () => choose(index));
    world.append(node);
    return { node, sign };
  });
  const cart = el('div', 'ac-cart'); cart.append(el('span', 'ac-car')); world.append(cart);

  const prompt = el('p', 'ac-prompt'); prompt.dataset.role = 'problem';
  const loading = el('p', 'ac-status', '問題を読み込んでいます…'); loading.dataset.role = 'loading';
  loading.setAttribute('role', 'status');
  const failure = el('p', 'ac-status', '問題を読み込めませんでした。「広場へ」でもどって、もう一度ためしてね。');
  failure.dataset.role = 'failure'; failure.setAttribute('role', 'alert'); failure.hidden = true;
  const note = el('p', 'ya-dock-note', '答えの線路をタップ！');
  const next = el('button', 'ac-next', 'つぎへ'); next.type = 'button'; next.dataset.action = 'next'; next.hidden = true;
  on(next, 'click', () => {
    const state = getSnapshot();
    if (active && !state.paused && state.phase === 'feedback') dispatch({ type: 'next', payload: { sessionId: state.sessionId, problemId: state.problem?.problemId } });
  });
  dock.append(loading, failure, prompt, note, next);
  const review = el('div', 'ya-learning-result'); review.hidden = true;
  const reviewList = el('ol', 'ac-review'); review.append(el('h3', '', '今回の問題'), reviewList); frame.shell.append(review);
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

  const placeCart = (x, y) => { cart.style.left = `${x}%`; cart.style.top = `${y}%`; };
  const showAnswer = state => {
    const answer = state.lastAnswer, problem = state.problem;
    const correctIndex = problem.choices.findIndex(choice => choice.choiceId === answer.correctChoiceId);
    const chosenIndex = problem.choices.findIndex(choice => choice.choiceId === answer.choiceId);
    const text = problem.choices[correctIndex]?.text ?? '';
    choiceIndex = chosenIndex;
    tunnels.forEach(({ node }, index) => { node.dataset.status = index === correctIndex ? 'correct' : index === chosenIndex ? 'chosen' : 'faded'; });
    branches.forEach((path, index) => path.setAttribute('data-lit', String(index === chosenIndex)));
    // The cart rides the chosen rail to its tunnel mouth.
    placeCart(EXIT_X[chosenIndex], TUNNEL_Y + 14);
    answers.push({ prompt: problem.prompt, text, correct: answer.correct });
    if (answer.correct) {
      fx.burst(EXIT_X[correctIndex], TUNNEL_Y, 'good', 1.3);
      note.textContent = `せいかい！ 答えは「${text}」`;
      frame.announce(`せいかい。${text}`);
    } else {
      fx.pop(EXIT_X[chosenIndex], TUNNEL_Y + 6, 'いきどまり…', 'soft');
      fx.pop(EXIT_X[correctIndex], TUNNEL_Y + 10, '宝はこっち！', 'info');
      note.textContent = `答えは「${text}」。次でとりかえそう！`;
      frame.announce(`答えは ${text}`);
    }
  };

  return {
    root,
    attachCompanion(portrait) { cart.prepend(portrait); },
    focusPlay() { tunnels[0].node.focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      loading.hidden = !['idle', 'loading', 'ready'].includes(state.phase);
      failure.hidden = state.phase !== 'failed';
      const problem = state.problem;
      if (problem && problem.problemId !== problemId) {
        problemId = problem.problemId; choiceIndex = null;
        prompt.textContent = problem.prompt;
        tunnels.forEach(({ node, sign }, index) => {
          const choice = problem.choices[index];
          node.hidden = !choice; delete node.dataset.status; sign.textContent = '';
          node.dataset.choiceId = choice?.choiceId ?? '';
          if (choice) { sign.append(el('span', 'ac-key', String(index + 1)), el('span', '', choice.text)); node.setAttribute('aria-label', `${index + 1}番 ${choice.text}`); }
        });
        branches.forEach(path => path.setAttribute('data-lit', 'false'));
        note.textContent = state.mode === 'review' ? '答えをたしかめよう' : '答えの線路をタップ！';
      }
      prompt.hidden = !problem;
      tunnels.forEach(({ node }) => { if (!problem) node.hidden = true; });
      if (state.seq !== lastSeq) {
        lastSeq = state.seq;
        if (state.lastAnswer && answers.length < state.answered) showAnswer(state);
      }
      const canAnswer = !state.paused && state.phase === 'answering';
      tunnels.forEach(({ node }) => { node.disabled = !canAnswer; });
      next.hidden = !(state.mode === 'review' && state.phase === 'feedback');
      next.disabled = !!state.paused;
      if (state.result && review.hidden) {
        review.hidden = false; reviewList.textContent = '';
        for (const item of answers) {
          const row = el('li', '', `${item.correct ? '✓' : '☆'} ${item.prompt} → ${item.text}`);
          row.dataset.correct = String(item.correct); reviewList.append(row);
        }
      }
    },
    present(play, dt, state) {
      if (!active || !state) return;
      frame.tick(dt);
      const w = play.world || {};
      if (choiceIndex === null) placeCart(TRUNK_X, START_Y - (w.progress ?? 0) * (START_Y - FORK_Y));
      cart.dataset.moving = String(choiceIndex === null && state.phase === 'answering' && !w.arrived && state.mode !== 'review');
      cart.dataset.fever = String(!!w.fever);
      setVar(cart, '--progress', String(w.progress ?? 0));
      if (state.phase === 'answering' && w.arrived && state.mode !== 'review') note.textContent = '分かれ道に着いたよ。ゆっくり選ぼう';
      const event = w.lastEvent;
      if (event && event.id !== lastEventId) {
        lastEventId = event.id;
        if (event.type === 'hit') fx.pop(50, 50, event.special ? '羅針盤の宝！' : event.quick ? 'はやわざ発見！' : '宝石発見！', event.special ? 'great' : 'good');
        else if (event.type === 'boost') { fx.banner('発見フィーバー！', 'great'); fx.flash('great'); }
      }
      const total = state.totalQuestions || 10, mission = w.challenge;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: (state.answered ?? 0) / total,
        progressLabel: `宝石 ${w.correct ?? 0} · ${Math.min(total, (state.answered ?? 0) + (state.phase === 'answering' ? 1 : 0))}/${total}問`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; tunnels.forEach(({ node }) => { node.disabled = true; }); next.disabled = true; },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
