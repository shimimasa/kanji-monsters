import { restartClass, toggleClass, setVar, createArcadeFrame, createNumberPad, bindArcadeKeys } from '../arcade/arcadeKit.js';
import { castAt } from '../gotomonCast.js';

const CSS = `
#mathSprintScreen .ya-field{background:linear-gradient(#8fd3ff 0,#d9f2ff 52%,#b6e3a0 52.2%,#8cc86f 70%)}
#mathSprintScreen .sp-sun{position:absolute;right:8%;top:10%;width:70px;height:70px;border-radius:50%;background:#fff3b0;box-shadow:0 0 40px #fff3b0}
#mathSprintScreen .sp-hills,#mathSprintScreen .sp-clouds{position:absolute;left:0;right:0;background-repeat:repeat-x}
#mathSprintScreen .sp-clouds{top:8%;height:22%;background-image:radial-gradient(ellipse 60px 22px at 80px 40px,#fff 60%,transparent 62%),radial-gradient(ellipse 44px 18px at 260px 70px,#ffffffcc 60%,transparent 62%);background-size:360px 100%}
#mathSprintScreen .sp-hills{top:30%;height:23%;background-image:radial-gradient(ellipse 160px 80px at 120px 100%,#6fbf73 60%,transparent 61%),radial-gradient(ellipse 200px 110px at 380px 100%,#58a860 60%,transparent 61%);background-size:520px 100%}
#mathSprintScreen .sp-track{position:absolute;left:0;right:0;bottom:0;height:34%;background:linear-gradient(#c8764c,#a85c38);border-top:6px solid #f1efe6}
#mathSprintScreen .sp-lines{position:absolute;left:0;right:0;top:34%;height:4px;background:repeating-linear-gradient(90deg,#fff 0 40px,transparent 40px 90px);opacity:.75}
#mathSprintScreen .sp-runner{position:absolute;bottom:31%;width:clamp(72px,10vw,108px);height:clamp(72px,10vw,108px);transform:translateX(-50%);z-index:5}
#mathSprintScreen .sp-runner .gt-portrait{display:block;width:100%;height:100%;background:none;border:0}
#mathSprintScreen .sp-runner .gt-portrait img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 6px 3px #0005)}
#mathSprintScreen .sp-runner[data-state=run] .gt-portrait{animation:sp-bob var(--stride,.4s) ease-in-out infinite alternate}
#mathSprintScreen .sp-runner[data-state=jump] .gt-portrait{animation:sp-jump .56s ease-out}
#mathSprintScreen .sp-runner[data-state=trip] .gt-portrait{animation:sp-trip .6s ease-out}
#mathSprintScreen .sp-runner[data-state=wait] .gt-portrait{transform:scaleY(.9) translateY(6%)}
#mathSprintScreen .sp-runner[data-fever=true]::before{content:'';position:absolute;right:70%;top:25%;width:120%;height:50%;background:repeating-linear-gradient(0deg,transparent 0 8px,#fff6 8px 11px);filter:blur(1px);animation:sp-lines .25s linear infinite}
#mathSprintScreen .sp-runner[data-fever=true]::after{content:'';position:absolute;inset:-10%;border-radius:50%;background:radial-gradient(circle,#ffd54a77,transparent 70%);animation:ya-glow .4s infinite alternate}
#mathSprintScreen .sp-bubble{position:absolute;left:50%;bottom:100%;transform:translateX(-50%);padding:4px 10px;border-radius:12px;background:#fff;color:#16242c;font-weight:900;font-size:15px;white-space:nowrap;box-shadow:0 3px 0 #0003}
#mathSprintScreen .sp-ghost{position:absolute;bottom:calc(31% - 42px);width:72px;height:26px;transform:translateX(-50%);display:grid;place-items:center;border:2px dashed #244d5b;border-radius:8px;background:#fffdf3;color:#16242c;box-shadow:0 2px 5px #0004;pointer-events:none;z-index:4}
#mathSprintScreen .sp-ghost::before{content:'';position:absolute;bottom:100%;left:50%;height:14px;border-left:2px dashed #244d5b}
#mathSprintScreen .sp-ghost span{font-size:13px;font-weight:900;white-space:nowrap}
#mathSprintScreen .sp-hurdle{position:absolute;bottom:31%;width:40px;height:62px;transform:translateX(-50%);z-index:3}
#mathSprintScreen .sp-hurdle::before{content:'';position:absolute;left:0;right:0;top:6px;height:12px;border-radius:4px;background:repeating-linear-gradient(90deg,#fff 0 10px,#e2412f 10px 20px);box-shadow:0 2px 0 #0003}
#mathSprintScreen .sp-hurdle::after{content:'';position:absolute;left:4px;right:4px;top:18px;bottom:0;border-left:5px solid #ddd;border-right:5px solid #ddd}
#mathSprintScreen .sp-hurdle[data-state=knocked]::before{transform:rotate(70deg) translate(24px,6px);transform-origin:0 50%}
#mathSprintScreen .sp-hurdle[data-state=passed]{opacity:.5}
#mathSprintScreen .sp-sign{position:absolute;left:50%;bottom:100%;transform:translate(-50%,-8px);padding:4px 10px;border-radius:12px;background:#fffdf3;color:#16242c;border:3px solid #16242c;font-weight:900;font-size:clamp(16px,2.4vw,22px);white-space:nowrap;box-shadow:0 4px 0 #0004}
#mathSprintScreen .sp-hurdle[data-state=active] .sp-sign{font-size:clamp(22px,3.4vw,32px);border-color:#ff9f1c;box-shadow:0 4px 0 #b86a00,0 0 0 4px #ffe08a;animation:sp-float 1s ease-in-out infinite alternate}
#mathSprintScreen .sp-hurdle[data-state=ready] .sp-sign{background:#d7f7df;border-color:#1f9d55}
#mathSprintScreen .sp-hurdle[data-state=knocked] .sp-sign{background:#fff1d6;border-color:#c77f16}
#mathSprintScreen .sp-fan{position:absolute;bottom:34px;left:-52px;opacity:.95;width:clamp(36px,5vw,52px);height:clamp(36px,5vw,52px);object-fit:contain;filter:drop-shadow(0 3px 2px #0004)}
#mathSprintScreen .sp-hurdle[data-state=ready] .sp-fan,#mathSprintScreen .sp-hurdle[data-state=passed] .sp-fan{animation:sp-cheer .45s ease-in-out infinite alternate}
#mathSprintScreen .sp-goalmon{position:absolute;bottom:0;left:22px;width:clamp(64px,9vw,96px);height:clamp(64px,9vw,96px);object-fit:contain;filter:drop-shadow(0 4px 3px #0005)}
#mathSprintScreen .sp-finish{position:absolute;bottom:31%;width:14px;height:48%;transform:translateX(-50%);background:repeating-linear-gradient(0deg,#16242c 0 12px,#fff 12px 24px);z-index:2}
#mathSprintScreen .sp-finish::after{content:'GOAL';position:absolute;top:-26px;left:50%;transform:translateX(-50%);font-weight:900;color:#16242c;background:#ffe066;border-radius:6px;padding:2px 8px}
#mathSprintScreen .sp-question{margin:0;text-align:center;font-size:clamp(28px,4.6vw,42px);font-weight:900;font-variant-numeric:tabular-nums;color:#fff}
#mathSprintScreen .sp-review{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
#mathSprintScreen .sp-review li{padding:6px 10px;border-radius:10px;background:#eef6ef;font-weight:700}
#mathSprintScreen .sp-review li[data-correct=false]{background:#fff3da}
@keyframes sp-bob{from{transform:translateY(0) rotate(-3deg)}to{transform:translateY(-8px) rotate(3deg)}}
@keyframes sp-jump{0%{transform:none}45%{transform:translateY(-70%) rotate(-10deg)}100%{transform:none}}
@keyframes sp-trip{0%{transform:none}30%{transform:rotate(18deg) translateY(6px)}100%{transform:none}}
@keyframes sp-float{from{transform:translate(-50%,-8px)}to{transform:translate(-50%,-14px)}}
@keyframes sp-cheer{from{transform:none}to{transform:translateY(-10px) rotate(-6deg)}}
@keyframes sp-lines{to{transform:translateX(-20px)}}
`;

const RUNNER_X = 24, PERCENT_PER_M = 1.5;

export function createMathSprintView({ document: doc, dispatch, onBack, getSnapshot, cast }) {
  let active = true, entry = '', lastSeq = -1, lastEventId = 0, problemId = null;
  const removes = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'mathSprintScreen', title: 'けいさんスプリント', theme: 'track' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });
  const clouds = el('div', 'sp-clouds'), hills = el('div', 'sp-hills');
  world.append(el('div', 'sp-sun'), clouds, hills, el('div', 'sp-track'));
  const lines = el('div', 'sp-lines'); world.append(lines);
  const hurdles = Array.from({ length: 10 }, (_, index) => {
    const node = el('div', 'sp-hurdle'), sign = el('span', 'sp-sign', '?'); node.append(sign);
    // A wild Gotomon cheers beside each hurdle and jumps for joy once it is cleared.
    const fan = castAt(cast?.wild, index);
    if (fan) { const img = el('img', 'sp-fan'); img.alt = ''; img.src = fan.imageUrl; node.append(img); }
    world.append(node); return { node, sign };
  });
  const finish = el('div', 'sp-finish'); world.append(finish);
  // A boss Gotomon waits at the goal.
  const host = cast?.boss ?? castAt(cast?.wild, 99);
  if (host) { const img = el('img', 'sp-goalmon'); img.alt = ''; img.src = host.imageUrl; finish.append(img); }
  const ghost = el('div', 'sp-ghost'); ghost.append(el('span', '', 'ベスト')); ghost.hidden = true; world.append(ghost);
  const runner = el('div', 'sp-runner'); runner.style.left = `${RUNNER_X}%`;
  const bubble = el('span', 'sp-bubble', 'こたえて ジャンプ！'); bubble.hidden = true; runner.append(bubble); world.append(runner);

  const question = el('p', 'sp-question'); question.dataset.role = 'problem';
  const display = el('div', 'ya-entry'); display.setAttribute('aria-live', 'polite'); display.setAttribute('aria-label', 'こたえ');
  const note = el('p', 'ya-dock-note', '答えるとジャンプ！ 早いほど止まらず走れる');
  const pad = createNumberPad(doc, { on,
    onDigit: digit => type(digit), onDelete: () => erase(), onFire: () => fire(), fireLabel: 'ジャンプ！',
  });
  dock.append(question, display, note, pad.root);
  const review = el('div', 'ya-learning-result'); review.hidden = true;
  const reviewList = el('ol', 'sp-review'); review.append(el('h3', '', '今回の計算'), reviewList); frame.shell.append(review);
  doc.body.append(root);
  const answers = [];

  const canType = () => { const state = getSnapshot(); return active && !state.paused && ['answering', 'feedback'].includes(state.phase); };
  const renderEntry = () => {
    display.dataset.empty = String(!entry); display.textContent = '';
    if (entry) display.textContent = entry; else display.append(el('span', '', '答えの数字を入力'));
  };
  const type = digit => { if (canType() && entry.length < 3) { entry += digit; renderEntry(); } };
  const erase = () => { if (canType()) { entry = entry.slice(0, -1); renderEntry(); } };
  const fire = () => {
    const state = getSnapshot();
    if (!active || state.paused || state.phase !== 'answering' || !entry) {
      if (!entry) { restartClass(display, 'ya-miss'); }
      return false;
    }
    const accepted = dispatch({ type: 'submit', payload: { sessionId: state.sessionId, token: state.token, value: entry } });
    if (accepted) { entry = ''; renderEntry(); }
    return accepted;
  };
  removes.push(bindArcadeKeys(doc, event => {
    if (!active) return false;
    if (/^[0-9]$/.test(event.key)) { type(event.key); return true; }
    if (event.key === 'Backspace') { erase(); return true; }
    if (event.key === 'Enter' && !event.repeat) { fire(); return true; }
    return false;
  }));
  renderEntry();

  const formatProblem = p => `${p.a} ${p.operation === 'addition' ? '+' : '−'} ${p.b}`;
  const renderTrack = (state, w) => {
    const position = w.position ?? 0;
    // Ground marks move exactly with the hurdles; scenery moves slower (parallax).
    const shift = -position * (frame.field.clientWidth || 1000) * PERCENT_PER_M / 100;
    clouds.style.backgroundPositionX = `${shift * .08}px`; hills.style.backgroundPositionX = `${shift * .3}px`;
    lines.style.backgroundPositionX = `${shift}px`;
    const results = w.results ?? [];
    hurdles.forEach(({ node, sign }, index) => {
      const at = w.hurdles?.[index] ?? 40 + 36 * index, x = RUNNER_X + (at - position) * PERCENT_PER_M;
      node.hidden = x < -10 || x > 112; node.style.left = `${x}%`;
      const result = results[index], passed = index < (w.cleared ?? 0);
      const activeHurdle = !result && index === results.length && state.phase === 'answering';
      node.dataset.state = passed ? (result?.correct ? 'passed' : 'knocked') : result ? (result.correct ? 'ready' : 'knocked') : activeHurdle ? 'active' : 'idle';
      sign.textContent = result ? (result.correct ? '✓' : `${answers[index]?.answer ?? ''}`) : activeHurdle && state.problem ? `${formatProblem(state.problem)} = ?` : '?';
      sign.hidden = passed;
    });
    const fx2 = RUNNER_X + ((w.finishAt ?? 394) - position) * PERCENT_PER_M;
    finish.hidden = fx2 > 112; finish.style.left = `${fx2}%`;
    ghost.hidden = !Number.isFinite(w.ghost) || !!state.result;
    if (!ghost.hidden) ghost.style.left = `${RUNNER_X + (w.ghost - position) * PERCENT_PER_M}%`;
    runner.dataset.state = w.jumpMs > 0 ? 'jump' : w.stumbleMs > 0 ? 'trip' : w.waiting ? 'wait' : 'run';
    runner.dataset.fever = String(!!w.fever);
    setVar(runner, '--stride', `${Math.max(.16, .5 - (w.speed ?? 0) * .03)}s`);
    bubble.hidden = !w.waiting || state.phase !== 'answering';
  };
  const reactToWorld = w => {
    const event = w.lastEvent;
    if (!event || event.id === lastEventId) return;
    lastEventId = event.id;
    if (event.type === 'jump') fx.pop(RUNNER_X, 44, event.clean ? 'ナイスジャンプ！' : 'ジャンプ！', 'good');
    else if (event.type === 'shortcut') { fx.pop(RUNNER_X, 44, 'ころころ近道！', 'great'); fx.burst(RUNNER_X, 62, 'great'); }
    else if (event.type === 'trip') fx.pop(RUNNER_X, 44, 'よいしょ！', 'soft');
    else if (event.type === 'boost') { fx.banner('ゴトモンダッシュ！', 'great'); fx.flash('great'); }
    else if (event.type === 'finish') { fx.banner(`ゴール！ ${((w.timeMs ?? 0) / 1000).toFixed(1)}秒`, 'great'); fx.flash('great'); frame.announce('ゴール'); if (host) fx.pop(60, 30, `${host.name}「ゴールおめでとう！」`, 'great'); }
  };

  return {
    root,
    attachCompanion(portrait) { runner.prepend(portrait); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      if (state.problem && state.problem.problemId !== problemId) {
        problemId = state.problem.problemId;
        question.textContent = `${formatProblem(state.problem)} = ?`;
      }
      if (state.seq !== lastSeq) {
        lastSeq = state.seq;
        const answer = state.lastAnswer;
        if (answer && answers.length < state.answered) {
          answers.push({ question: formatProblem(state.problem), answer: answer.answer, correct: answer.correct });
          if (answer.correct) { fx.pop(70, 30, `${answer.value}！ せいかい`, 'good'); note.textContent = 'せいかい！ ハードルをとびこえよう'; frame.announce('せいかい'); }
          else {
            fx.pop(70, 30, `こたえは ${answer.answer}`, 'info'); fx.shake();
            note.textContent = `${formatProblem(state.problem)} = ${answer.answer}。次でとりかえそう！`;
            frame.announce(`こたえは ${answer.answer}`);
          }
        } else if (state.phase === 'answering') note.textContent = '答えるとジャンプ！ 早いほど止まらず走れる';
      }
      pad.setEnabled(!state.paused && ['answering', 'feedback'].includes(state.phase));
      if (state.result && review.hidden) {
        review.hidden = false; reviewList.textContent = '';
        for (const item of answers) {
          const row = el('li', '', `${item.correct ? '✓' : '☆'} ${item.question} = ${item.answer}`);
          row.dataset.correct = String(item.correct); reviewList.append(row);
        }
      }
    },
    present(play, dt, state) {
      if (!active || !state) return;
      frame.tick(dt);
      const w = play.world || {};
      renderTrack(state, w);
      reactToWorld(w);
      const mission = w.challenge;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: (w.position ?? 0) / (w.finishAt ?? 1), progressLabel: `ハードル ${w.cleared ?? 0}/10 · ${((w.timeMs ?? 0) / 1000).toFixed(1)}秒`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; pad.setEnabled(false); },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
