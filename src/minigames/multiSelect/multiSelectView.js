import { createArcadeFrame, bindArcadeKeys } from '../arcade/arcadeKit.js';

const CSS = `
#multiSelectScreen .ya-field{background:radial-gradient(ellipse at 70% 110%,#2f5f7a 0,transparent 60%),linear-gradient(#070d24,#10204a 70%,#1c3a5e)}
#multiSelectScreen .ms-sky{position:absolute;inset:0;background-image:radial-gradient(1.5px 1.5px at 12% 18%,#fff,transparent),radial-gradient(1px 1px at 27% 44%,#fffc,transparent),radial-gradient(1.5px 1.5px at 44% 12%,#fff,transparent),radial-gradient(1px 1px at 63% 52%,#fffa,transparent),radial-gradient(1.5px 1.5px at 78% 16%,#fff,transparent),radial-gradient(1px 1px at 90% 46%,#fffc,transparent),radial-gradient(1px 1px at 8% 70%,#fff8,transparent),radial-gradient(1px 1px at 55% 80%,#fff8,transparent)}
#multiSelectScreen .ms-moon{position:absolute;z-index:1;width:clamp(34px,5vw,54px);aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fffbe0,#ffe9a0 60%,#e8c870);box-shadow:0 0 30px #ffe9a088;transform:translate(-50%,-50%)}
#multiSelectScreen .ms-lines{position:absolute;inset:0;width:100%;height:100%;z-index:2;overflow:visible;pointer-events:none}
#multiSelectScreen .ms-lines line{stroke:#ffe9a0;stroke-width:3;stroke-linecap:round;vector-effect:non-scaling-stroke;opacity:.85}
#multiSelectScreen .ms-star{position:absolute;z-index:3;transform:translate(-50%,-50%);padding:0;border:0;background:none;font:inherit;color:#fff;cursor:pointer;touch-action:manipulation;display:flex;flex-direction:column;align-items:center;gap:2px;min-width:64px;min-height:44px}
#multiSelectScreen .ms-tag{padding:1px 8px;border-radius:99px;background:#000a;font-size:13px;font-weight:900;white-space:nowrap}
#multiSelectScreen .ms-tag:empty{display:none}
#multiSelectScreen .ms-glyph{display:grid;place-items:center;width:clamp(48px,6.4vw,70px);aspect-ratio:1;font-size:clamp(40px,5.4vw,60px);line-height:1;color:#cfe3ff;text-shadow:0 0 12px #9cc8ff;transition:transform .15s}
#multiSelectScreen .ms-label{max-width:9.5em;padding:3px 9px;border-radius:10px;background:#0b1633cc;border:2px solid #5d7fb8;font-size:clamp(16px,1.9vw,19px);font-weight:900;line-height:1.2;text-align:center}
#multiSelectScreen .ms-key{font-size:.7em;color:#9fb6d8;margin-right:3px}
#multiSelectScreen .ms-star:focus-visible .ms-label{outline:3px solid #ffd54a;outline-offset:2px}
#multiSelectScreen .ms-star[aria-pressed=true] .ms-glyph{color:#ffe066;text-shadow:0 0 18px #ffd54a,0 0 40px #ffd54a88;transform:scale(1.15)}
#multiSelectScreen .ms-star[aria-pressed=true] .ms-label{background:#3d2f06e6;border-color:#ffd54a;color:#fff6cc}
#multiSelectScreen .ms-star[data-status=right] .ms-glyph{color:#ffe066;text-shadow:0 0 22px #ffd54a,0 0 50px #ffd54a}
#multiSelectScreen .ms-star[data-status=right] .ms-label{background:#15482c;border-color:#5fe08f}
#multiSelectScreen .ms-star[data-status=missed] .ms-glyph{color:#9cd8ff;animation:ms-pulse .6s ease-in-out infinite alternate}
#multiSelectScreen .ms-star[data-status=missed] .ms-label{background:#12385a;border-color:#7cc8ff}
#multiSelectScreen .ms-star[data-status=extra],#multiSelectScreen .ms-star[data-status=rest]{opacity:.4}
#multiSelectScreen .ms-hero{position:absolute;left:8%;bottom:4%;z-index:4;width:clamp(64px,9vw,92px);height:clamp(64px,9vw,92px)}
#multiSelectScreen .ms-hero .gt-portrait{display:block;width:100%;height:100%;background:none;border:0}
#multiSelectScreen .ms-hero .gt-portrait img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 0 10px #9cc8ff88)}
#multiSelectScreen .ms-hero[data-fever=true]::after{content:'';position:absolute;inset:-18%;border-radius:50%;background:radial-gradient(circle,#ffd54a66,transparent 70%);animation:ya-glow .4s infinite alternate;z-index:-1}
#multiSelectScreen .ms-prompt{margin:0;text-align:center;font-size:clamp(22px,3vw,30px);font-weight:900;line-height:1.35;color:#fff}
#multiSelectScreen .ms-count{margin:0;text-align:center;font-size:16px;font-weight:800;color:#ffe9a0}
#multiSelectScreen .ms-submit{min-height:56px;border:0;border-radius:14px;background:#ffb627;color:#3a2400;font:inherit;font-size:22px;font-weight:900;box-shadow:0 4px 0 #b57500;cursor:pointer}
#multiSelectScreen .ms-submit:disabled{opacity:.5;cursor:default}
#multiSelectScreen .ms-review{margin:0;padding:0;list-style:none;display:grid;gap:6px}
#multiSelectScreen .ms-review li{padding:6px 10px;border-radius:10px;background:#eef6ef;font-weight:700}
#multiSelectScreen .ms-review li[data-correct=false]{background:#fff3da}
@keyframes ms-pulse{from{transform:scale(1)}to{transform:scale(1.18)}}
`;

// Five resting spots, clear of the HUD band and the companion's corner.
const SPOTS = [[16, 34], [38, 22], [60, 36], [82, 24], [48, 62]];
const SVG = 'http://www.w3.org/2000/svg';

export function createMultiSelectView({ document: doc, dispatch, onBack, getSnapshot }) {
  let active = true, problemId = null, lastSeq = -1, lastEventId = 0, clock = 0, resolved = false;
  const removes = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'multiSelectScreen', title: 'えらんで完成', theme: 'night' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });
  const moon = el('i', 'ms-moon');
  const lines = doc.createElementNS ? doc.createElementNS(SVG, 'svg') : el('div');
  lines.setAttribute('class', 'ms-lines'); lines.setAttribute('viewBox', '0 0 100 100'); lines.setAttribute('preserveAspectRatio', 'none');
  world.append(el('div', 'ms-sky'), moon, lines);
  const stars = SPOTS.map((spot, index) => {
    const node = el('button', 'ms-star'); node.type = 'button'; node.dataset.choiceIndex = String(index + 1);
    node.setAttribute('aria-pressed', 'false');
    // The tag names each star's result in words, not only by colour.
    const label = el('span', 'ms-label'), tag = el('span', 'ms-tag'); node.append(el('span', 'ms-glyph', '★'), label, tag);
    on(node, 'click', () => toggle(index));
    world.append(node);
    return { node, label, tag, spot, x: spot[0], y: spot[1] };
  });
  const hero = el('div', 'ms-hero'); world.append(hero);

  const prompt = el('p', 'ms-prompt'); prompt.dataset.role = 'problem';
  const count = el('p', 'ms-count');
  const note = el('p', 'ya-dock-note', '合う星をぜんぶタップ！'); note.dataset.role = 'feedback';
  const submit = el('button', 'ms-submit', 'あつめた！'); submit.type = 'button'; submit.dataset.action = 'submit';
  on(submit, 'click', () => send());
  // Normal play advances on its own (the shell); the button is the manual path, like the other quiz views.
  const next = el('button', 'ms-submit', 'つぎへ'); next.type = 'button'; next.dataset.action = 'next'; next.hidden = true;
  on(next, 'click', () => {
    const state = getSnapshot();
    if (active && !state.paused && state.phase === 'feedback') dispatch({ type: 'next', payload: { sessionId: state.sessionId, problemId: state.problem?.problemId } });
  });
  dock.append(prompt, count, note, submit, next);
  const review = el('div', 'ya-learning-result'); review.hidden = true;
  const reviewList = el('ol', 'ms-review'); review.append(el('h3', '', '今回のお題'), reviewList); frame.shell.append(review);
  doc.body.append(root);
  const answers = [];

  const identity = state => ({ sessionId: state.sessionId, problemId: state.problem?.problemId, attemptId: state.attemptId });
  function toggle(index) {
    const state = getSnapshot(), choice = state.problem?.choices[index];
    if (!active || state.paused || state.phase !== 'answering' || !choice) return false;
    return dispatch({ type: 'toggle', payload: { ...identity(state), choiceId: choice.choiceId } });
  }
  function send() {
    const state = getSnapshot();
    if (!active || state.paused || state.phase !== 'answering' || !state.selectedChoiceIds?.length) return false;
    return dispatch({ type: 'submit', payload: identity(state) });
  }
  removes.push(bindArcadeKeys(doc, event => {
    if (!active || event.repeat) return false;
    const index = ['1', '2', '3', '4', '5'].indexOf(event.key);
    if (index >= 0) { toggle(index); return true; }
    if (event.key === 'Enter') { send(); return true; }
    return false;
  }));

  const drawLines = ids => {
    lines.textContent = '';
    const points = stars.filter((_, index) => ids.has(getSnapshot().problem?.choices[index]?.choiceId));
    for (let i = 1; i < points.length; i++) {
      const line = doc.createElementNS ? doc.createElementNS(SVG, 'line') : el('i');
      line.setAttribute('x1', String(points[i - 1].x)); line.setAttribute('y1', String(points[i - 1].y));
      line.setAttribute('x2', String(points[i].x)); line.setAttribute('y2', String(points[i].y));
      lines.append(line);
    }
  };
  const showAnswer = state => {
    const answer = state.lastAnswer, problem = state.problem;
    const chosen = new Set(answer.selectedChoiceIds), right = new Set(answer.correctChoiceIds);
    const TAGS = { right: 'あつめた！', missed: 'これも仲間', extra: 'べつの星', rest: '' };
    stars.forEach(({ node, tag }, index) => {
      const id = problem.choices[index]?.choiceId;
      node.dataset.status = chosen.has(id) && right.has(id) ? 'right' : right.has(id) ? 'missed' : chosen.has(id) ? 'extra' : 'rest';
      tag.textContent = TAGS[node.dataset.status];
    });
    drawLines(new Set([...chosen].filter(id => right.has(id))));
    const names = problem.choices.filter(choice => right.has(choice.choiceId)).map(choice => choice.text);
    answers.push({ prompt: problem.prompt, names, correct: answer.classification === 'fullCorrect' });
    if (answer.classification === 'fullCorrect') {
      fx.banner('星座完成！', 'great');
      note.textContent = `ぜんぶ集めた！ ${names.join('・')}`;
      frame.announce(`星座完成。${names.join('、')}`);
    } else {
      const missing = stars.filter(({ node }) => node.dataset.status === 'missed');
      missing.forEach(({ x, y }) => fx.pop(x, y - 10, 'これも仲間！', 'info'));
      note.textContent = `${answer.classification === 'partial' ? 'おしい！ ' : ''}合う星は ${names.join('・')}`;
      frame.announce(`合う星は ${names.join('、')}`);
    }
  };

  return {
    root,
    attachCompanion(portrait) { hero.append(portrait); },
    focusPlay() { stars[0].node.focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      const problem = state.problem;
      if (problem && problem.problemId !== problemId) {
        problemId = problem.problemId; resolved = false; lines.textContent = '';
        prompt.textContent = problem.prompt;
        stars.forEach(({ node, label, tag }, index) => {
          const choice = problem.choices[index];
          node.hidden = !choice; delete node.dataset.status; label.textContent = ''; tag.textContent = '';
          node.dataset.choiceId = choice?.choiceId ?? '';
          if (choice) { label.append(el('span', 'ms-key', String(index + 1)), el('span', '', choice.text)); node.setAttribute('aria-label', `${index + 1}番 ${choice.text}`); }
        });
        note.textContent = '合う星をぜんぶタップ！';
      }
      const picked = new Set(state.selectedChoiceIds ?? []);
      if (state.phase === 'answering') {
        stars.forEach(({ node }, index) => node.setAttribute('aria-pressed', String(picked.has(problem?.choices[index]?.choiceId))));
        drawLines(picked);
      }
      if (state.seq !== lastSeq) {
        lastSeq = state.seq;
        if (state.lastAnswer && answers.length < state.answered) { showAnswer(state); resolved = true; }
      }
      const canPlay = !state.paused && state.phase === 'answering';
      stars.forEach(({ node }) => { node.disabled = !canPlay; });
      submit.disabled = !canPlay || !picked.size;
      count.textContent = state.phase === 'answering' ? `集めた星 ${picked.size}こ` : '';
      if (state.result && review.hidden) {
        review.hidden = false; reviewList.textContent = '';
        for (const item of answers) {
          const row = el('li', '', `${item.correct ? '✓' : '☆'} ${item.prompt}：${item.names.join('・')}`);
          row.dataset.correct = String(item.correct); reviewList.append(row);
        }
      }
    },
    present(play, dt, state) {
      if (!active || !state) return;
      frame.tick(dt);
      clock += dt;
      const w = play.world || {};
      // Stars sway gently in place; the moon crossing the sky shows the time left for a bright constellation.
      if (!resolved) stars.forEach((star, index) => {
        star.x = star.spot[0] + Math.sin(clock / 1400 + index * 1.7) * 2.5;
        star.y = star.spot[1] + Math.cos(clock / 1700 + index * 2.3) * 2;
        star.node.style.left = `${star.x}%`; star.node.style.top = `${star.y}%`;
      });
      const p = w.progress ?? 0;
      moon.style.left = `${10 + p * 80}%`; moon.style.top = `${22 - Math.sin(p * Math.PI) * 10}%`;
      hero.dataset.fever = String(!!w.fever);
      if (state.phase === 'answering' && w.arrived) note.textContent = '月がしずんだよ。集めたら「あつめた！」';
      const event = w.lastEvent;
      if (event && event.id !== lastEventId) {
        lastEventId = event.id;
        if (event.type === 'hit' && event.special) fx.banner('流れ星！', 'great');
        else if (event.type === 'hit' && event.quick) fx.pop(50, 12, 'かがやく星座！', 'great');
        else if (event.type === 'boost') { fx.banner('星のきらめき！', 'great'); fx.flash('great'); }
      }
      const mission = w.challenge;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: (state.answered ?? 0) / 10,
        progressLabel: `星座 ${w.correct ?? 0} · ${Math.min(10, (state.answered ?? 0) + (state.phase === 'answering' ? 1 : 0))}/10問`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; stars.forEach(({ node }) => { node.disabled = true; }); submit.disabled = true; next.disabled = true; },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
