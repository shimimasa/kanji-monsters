import { createArcadeFrame, bindArcadeKeys, setVar } from '../arcade/arcadeKit.js';
import { castAt } from '../gotomonCast.js';

const CSS = `
#timedChoiceScreen .ya-field{background:linear-gradient(#9fdcff 0,#d6f1ff 30%,#8fd07a 30.2%,#6fb85c 100%)}
#timedChoiceScreen .tc-hedge{position:absolute;left:0;right:0;top:24%;height:12%;background-image:radial-gradient(ellipse 60px 40px at 40px 100%,#4f9a45 60%,transparent 62%);background-size:90px 100%;background-repeat:repeat-x}
#timedChoiceScreen .tc-hole{position:absolute;z-index:2;width:min(21%,150px);aspect-ratio:2.6;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(ellipse at 50% 40%,#2b1a0d 55%,#5a3a1f 57%,#7a5230 70%,transparent 72%)}
#timedChoiceScreen .tc-mole{position:absolute;z-index:3;width:min(21%,150px);height:min(34%,190px);min-width:44px;min-height:44px;transform:translate(-50%,-100%);padding:0;border:0;background:none;font:inherit;cursor:pointer;touch-action:manipulation;overflow:hidden;-webkit-clip-path:inset(-60px -20px 0 -20px);clip-path:inset(-60px -20px 0 -20px)}
#timedChoiceScreen .tc-body{position:absolute;left:50%;bottom:0;width:66%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;transform:translate(-50%,calc(var(--down,1) * 100%));transition:transform .08s linear}
#timedChoiceScreen .tc-card{position:relative;z-index:2;margin-bottom:-6px;padding:4px 10px;border-radius:10px;background:#fffdf3;color:#2a1c10;border:3px solid #6b4a2a;font-size:clamp(16px,2.4vw,24px);font-weight:900;white-space:nowrap;box-shadow:0 3px 0 #0003}
#timedChoiceScreen .tc-key{font-size:.65em;color:#8a7358;margin-right:3px}
#timedChoiceScreen .tc-head{position:relative;width:100%;flex:1;border-radius:48% 48% 12% 12%;background:radial-gradient(circle at 34% 34%,#2a1c10 5%,transparent 6%),radial-gradient(circle at 66% 34%,#2a1c10 5%,transparent 6%),radial-gradient(ellipse at 50% 52%,#f7a6a6 8%,transparent 9%),radial-gradient(ellipse at 50% 60%,#d9b08c 22%,transparent 23%),linear-gradient(#8a5a36,#6d4527)}
#timedChoiceScreen .tc-head[data-gotomon=true]{background:none}
#timedChoiceScreen .tc-mon{position:absolute;left:50%;bottom:-6%;width:118%;height:112%;transform:translateX(-50%);object-fit:contain;object-position:50% 100%;filter:drop-shadow(0 3px 2px #0005)}
#timedChoiceScreen .tc-mole[data-status=hit] .tc-mon{animation:tc-squash .3s ease-out}
#timedChoiceScreen .tc-mole[data-status=hit] .tc-head[data-gotomon=true]{background:none}
#timedChoiceScreen .tc-mole[data-status=hit] .tc-head{background:radial-gradient(circle at 34% 34%,#2a1c10 2%,transparent 7%),radial-gradient(circle at 66% 34%,#2a1c10 2%,transparent 7%),radial-gradient(ellipse at 50% 60%,#d9b08c 22%,transparent 23%),linear-gradient(#8a5a36,#6d4527);animation:tc-squash .3s ease-out}
#timedChoiceScreen .tc-mole[data-status=hit] .tc-card{background:#d7f7df;border-color:#1f9d55}
#timedChoiceScreen .tc-mole[data-status=answer] .tc-card{background:#e4f4ff;border-color:#2a6fb0;box-shadow:0 0 0 4px #bfe3ff}
#timedChoiceScreen .tc-mole[data-status=miss] .tc-card{background:#fff1d6;border-color:#c77f16}
#timedChoiceScreen .tc-mole:focus-visible .tc-card{outline:3px solid #ffd54a;outline-offset:2px}
#timedChoiceScreen .tc-hero{position:absolute;left:50%;bottom:3%;z-index:5;width:clamp(64px,9vw,92px);height:clamp(64px,9vw,92px);transform:translateX(-50%)}
#timedChoiceScreen .tc-hero .gt-portrait{display:block;width:100%;height:100%;background:none;border:0}
#timedChoiceScreen .tc-hero .gt-portrait img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 6px 3px #0005)}
#timedChoiceScreen .tc-hero[data-fever=true]::after{content:'';position:absolute;inset:-18%;border-radius:50%;background:radial-gradient(circle,#ffd54a66,transparent 70%);animation:ya-glow .4s infinite alternate;z-index:-1}
#timedChoiceScreen .tc-word{margin:0;text-align:center;font-size:clamp(40px,6vw,60px);font-weight:900;color:#fff;letter-spacing:.04em}
#timedChoiceScreen .tc-ask{margin:0;text-align:center;font-size:15px;font-weight:700;color:#ffe2b8}
#timedChoiceScreen .tc-timer{height:12px;border-radius:99px;background:#ffffff22;overflow:hidden}
#timedChoiceScreen .tc-timer i{display:block;height:100%;width:calc(var(--left,1) * 100%);background:linear-gradient(90deg,#ffb627,#ffe066);border-radius:inherit}
#timedChoiceScreen .tc-timer[data-low=true] i{background:linear-gradient(90deg,#ff7a59,#ffb627)}
#timedChoiceScreen .tc-remaining{margin:0;text-align:center;font-size:14px;font-weight:700;color:#ffe2b8;font-variant-numeric:tabular-nums}
#timedChoiceScreen .tc-next{min-height:52px;border:0;border-radius:14px;background:#ffb627;color:#3a2400;font:inherit;font-size:20px;font-weight:900;box-shadow:0 4px 0 #b57500;cursor:pointer}
#timedChoiceScreen .tc-review{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
#timedChoiceScreen .tc-review li{padding:6px 10px;border-radius:10px;background:#eef6ef;font-weight:700}
#timedChoiceScreen .tc-review li[data-correct=false]{background:#fff3da}
@keyframes tc-squash{0%{transform:scaleY(1)}40%{transform:scaleY(.7) translateY(12%)}100%{transform:scaleY(1)}}
`;

const HOLE_X = [14, 38, 62, 86], HOLE_Y = 66;

// How far a mole is hidden (1 = in the hole) for the time spent on the question.
const moleDown = (elapsed, deadline) => {
  if (!Number.isFinite(deadline)) return Math.max(0, 1 - elapsed / 300);
  const rise = Math.max(0, 1 - elapsed / 300), sink = Math.max(0, (elapsed - (deadline - 700)) / 700);
  return Math.min(1, Math.max(rise, sink * .55));
};

export function createTimedChoiceView({ document: doc, dispatch, onBack, getSnapshot, cast }) {
  // Gotomon peek out of the holes instead of moles; a different set each word.
  let peekSerial = 0;
  const friendly = !!cast?.wild?.length;
  let active = true, problemId = null, lastSeq = -1, lastEventId = 0, resolved = false;
  const removes = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'timedChoiceScreen', title: 'タイムことば', theme: 'garden' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });
  world.append(el('div', 'tc-hedge'));
  const moles = HOLE_X.map((x, index) => {
    const hole = el('i', 'tc-hole'); hole.style.left = `${x}%`; hole.style.top = `${HOLE_Y}%`;
    const node = el('button', 'tc-mole'); node.type = 'button'; node.dataset.choiceIndex = String(index + 1);
    node.style.left = `${x}%`; node.style.top = `${HOLE_Y}%`;
    const body = el('span', 'tc-body'), card = el('span', 'tc-card'), head = el('span', 'tc-head'), mon = el('img', 'tc-mon');
    mon.alt = ''; if (friendly) { head.dataset.gotomon = 'true'; head.append(mon); }
    body.append(card, head); node.append(body);
    on(node, 'click', () => choose(index));
    world.append(hole, node);
    return { node, body, card, mon };
  });
  const hero = el('div', 'tc-hero'); world.append(hero);

  const word = el('p', 'tc-word'); word.dataset.role = 'problem';
  const ask = el('p', 'tc-ask', 'の よみは？');
  const timer = el('div', 'tc-timer'); timer.append(el('i'));
  timer.setAttribute('role', 'progressbar'); timer.setAttribute('aria-label', 'のこり時間'); timer.setAttribute('aria-valuemin', '0'); timer.setAttribute('aria-valuemax', '100');
  const remaining = el('p', 'tc-remaining'); remaining.dataset.role = 'remaining';
  const note = el('p', 'ya-dock-note', '正しい読みのもぐらをたたこう！'); note.dataset.role = 'feedback';
  const next = el('button', 'tc-next', 'つぎへ'); next.type = 'button'; next.dataset.action = 'next'; next.hidden = true;
  on(next, 'click', () => {
    const state = getSnapshot();
    if (active && !state.paused && state.phase === 'feedback') dispatch({ type: 'next', payload: { sessionId: state.sessionId, problemId: state.problem?.problemId } });
  });
  dock.append(word, ask, timer, remaining, note, next);
  const review = el('div', 'ya-learning-result'); review.hidden = true;
  const reviewList = el('ol', 'tc-review'); review.append(el('h3', '', '今回のことば'), reviewList); frame.shell.append(review);
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

  const wordOf = prompt => prompt.match(/「(.+?)」/)?.[1] ?? prompt;
  const showAnswer = state => {
    const answer = state.lastAnswer, problem = state.problem;
    const correctIndex = problem.choices.findIndex(choice => choice.choiceId === answer.correctChoiceId);
    const chosenIndex = problem.choices.findIndex(choice => choice.choiceId === answer.choiceId);
    const reading = problem.choices[correctIndex]?.text ?? '';
    const shown = wordOf(problem.prompt);
    moles.forEach(({ node }, index) => {
      if (index === correctIndex) node.dataset.status = answer.correct ? 'hit' : 'answer';
      else if (index === chosenIndex) node.dataset.status = 'miss';
      else node.dataset.status = 'hide';
    });
    answers.push({ word: shown, reading, correct: answer.correct });
    if (answer.correct) {
      fx.pop(HOLE_X[correctIndex], HOLE_Y - 34, friendly ? 'ハイタッチ！' : 'ポカッ！', 'good'); fx.burst(HOLE_X[correctIndex], HOLE_Y - 20, 'good', 1.1);
      note.textContent = `せいかい！「${shown}」は「${reading}」`;
      frame.announce(`せいかい。${shown}、${reading}`);
    } else {
      const timeout = !answer.choiceId;
      if (!timeout) fx.pop(HOLE_X[chosenIndex], HOLE_Y - 30, 'スカッ', 'soft');
      fx.pop(HOLE_X[correctIndex], HOLE_Y - 40, `こたえは ${reading}`, 'info');
      note.textContent = `${timeout ? '時間切れ。' : ''}「${shown}」は「${reading}」と読むよ`;
      frame.announce(`${shown} は ${reading} と読みます`);
    }
  };

  return {
    root,
    attachCompanion(portrait) { hero.append(portrait); },
    focusPlay() { moles[0].node.focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      const problem = state.problem;
      if (problem && problem.problemId !== problemId) {
        problemId = problem.problemId; resolved = false;
        word.textContent = wordOf(problem.prompt);
        const round = peekSerial++;
        moles.forEach(({ node, card, mon }, index) => {
          const choice = problem.choices[index], peeker = castAt(cast?.wild, round * HOLE_X.length + index);
          if (friendly && peeker) { mon.src = peeker.imageUrl; node.dataset.gotomon = peeker.name; }
          node.hidden = !choice; delete node.dataset.status; card.textContent = '';
          node.dataset.choiceId = choice?.choiceId ?? '';
          if (choice) { card.append(el('span', 'tc-key', String(index + 1)), el('span', '', choice.text)); node.setAttribute('aria-label', `${index + 1}番 ${choice.text}`); }
        });
        note.textContent = state.mode === 'review' ? '時間を気にせず、読みをたしかめよう' : friendly ? '正しい読みのゴトモンに ハイタッチしよう！' : '正しい読みのもぐらをたたこう！';
      }
      if (state.seq !== lastSeq) {
        lastSeq = state.seq;
        if (state.lastAnswer && answers.length < state.answered) { showAnswer(state); resolved = true; }
      }
      const canAnswer = !state.paused && state.phase === 'answering';
      moles.forEach(({ node }) => { node.disabled = !canAnswer; });
      timer.hidden = remaining.hidden = state.mode === 'review';
      // The countdown comes straight from the Core clock.
      const elapsed = state.problemElapsedMs ?? 0, deadline = state.deadlineMs;
      const left = Number.isFinite(deadline) && state.phase === 'answering' ? Math.max(0, 1 - elapsed / deadline) : resolved ? 0 : 1;
      setVar(timer, '--left', String(left)); timer.dataset.low = String(left < .3);
      timer.setAttribute('aria-valuenow', String(Math.round(left * 100)));
      remaining.textContent = Number.isFinite(deadline) && state.phase === 'answering' ? `のこり ${(Math.max(0, deadline - elapsed) / 1000).toFixed(1)} 秒` : '';
      next.hidden = !(state.mode === 'review' && state.phase === 'feedback');
      next.disabled = !!state.paused;
      if (state.result && review.hidden) {
        review.hidden = false; reviewList.textContent = '';
        for (const item of answers) {
          const row = el('li', '', `${item.correct ? '✓' : '☆'} ${item.word}（${item.reading}）`);
          row.dataset.correct = String(item.correct); reviewList.append(row);
        }
      }
    },
    present(play, dt, state) {
      if (!active || !state) return;
      frame.tick(dt);
      const w = play.world || {};
      const elapsed = state.problemElapsedMs ?? 0, deadline = state.deadlineMs;
      const down = resolved ? null : moleDown(elapsed, deadline);
      moles.forEach(({ node, body }) => {
        const status = node.dataset.status;
        // After an answer only the right mole stays up to show the reading.
        const value = down ?? (status === 'hit' || status === 'answer' ? 0 : status === 'miss' ? .35 : 1);
        setVar(body, '--down', String(value));
      });
      hero.dataset.fever = String(!!w.fever);
      const event = w.lastEvent;
      if (event && event.id !== lastEventId) {
        lastEventId = event.id;
        if (event.type === 'hit' && event.special) fx.banner('しずくハンマー！', 'great');
        else if (event.type === 'hit' && event.quick) fx.pop(50, 30, 'すばやい！', 'great');
        else if (event.type === 'boost') { fx.banner(friendly ? 'ゴトモンフィーバー！' : 'もぐらフィーバー！', 'great'); fx.flash('great'); }
      }
      // Review runs have no goal; only normal play shows the mission.
      const mission = state.mode === 'review' ? null : w.challenge;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: (state.answered ?? 0) / (state.totalQuestions || 10),
        progressLabel: `${friendly ? 'タッチ' : 'ポカッ'} ${w.correct ?? 0} · ${Math.min(state.totalQuestions || 10, (state.answered ?? 0) + (state.phase === 'answering' ? 1 : 0))}/${state.totalQuestions || 10}問`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; moles.forEach(({ node }) => { node.disabled = true; }); next.disabled = true; },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
