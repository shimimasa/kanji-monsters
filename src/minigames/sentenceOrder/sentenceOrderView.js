import { createArcadeFrame, bindArcadeKeys, restartClass } from '../arcade/arcadeKit.js';
import { castAt } from '../gotomonCast.js';

const CSS = `
#sentenceOrderScreen .ya-field{background:linear-gradient(#9fdcff 0,#d6f1ff 32%,#7cc26b 32.2%,#5fa855 46%,#3f8fc9 46.2%,#2f74b0 100%)}
#sentenceOrderScreen .so-bank{position:absolute;z-index:5;top:46%;bottom:0;width:17%;background:linear-gradient(#6fb85c 0 14%,#8a6a45 14% 100%);border-top:4px solid #4f9a45}
#sentenceOrderScreen .so-bank[data-side=left]{left:0;border-radius:0 18px 0 0}
#sentenceOrderScreen .so-bank[data-side=right]{right:0;border-radius:18px 0 0 0}
#sentenceOrderScreen .so-waves{position:absolute;left:0;right:0;top:50%;bottom:0;background-image:repeating-linear-gradient(90deg,#ffffff22 0 30px,transparent 30px 90px);opacity:.6;animation:so-flow 3s linear infinite}
#sentenceOrderScreen .so-slot{position:absolute;z-index:3;top:46%;height:clamp(44px,7%,56px);transform:translateY(-100%);border:3px dashed #ffffffaa;border-radius:8px}
#sentenceOrderScreen .so-slot[data-next=true]{border-color:#ffe066;box-shadow:0 0 0 3px #ffe06655}
#sentenceOrderScreen .so-plank{position:absolute;z-index:4;min-height:44px;padding:6px 12px;border:0;border-radius:8px;background:linear-gradient(#e0b46e,#b88340);color:#2a1c10;border-bottom:5px solid #7a5226;font:inherit;font-size:clamp(15px,1.8vw,19px);font-weight:900;line-height:1.2;cursor:pointer;touch-action:manipulation;box-shadow:0 4px 0 #0004;overflow-wrap:anywhere}
#sentenceOrderScreen .so-plank[data-where=river]{transform:translate(-50%,-50%);width:max-content;min-width:88px;max-width:30%}
#sentenceOrderScreen .so-plank[data-where=bridge]{transform:translateY(-100%);padding:4px 6px;cursor:default;background:linear-gradient(#bff0c8,#7fcf94);border-bottom-color:#2f8a4f}
#sentenceOrderScreen .so-key{font-size:.7em;color:#6b4a2a;margin-right:4px}
#sentenceOrderScreen .so-plank:focus-visible{outline:3px solid #ffd54a;outline-offset:2px}
#sentenceOrderScreen .so-plank[data-hint=true]{box-shadow:0 0 0 4px #ffe066,0 0 24px #ffd54a;animation:so-glow .6s ease-in-out infinite alternate}
#sentenceOrderScreen .so-plank.so-nope{animation:so-nope .45s ease-out}
#sentenceOrderScreen .so-plank[data-rainbow=true]{background:linear-gradient(90deg,#ffb3b3,#ffe08a,#b8f0a8,#a8d8ff,#d8b8ff);border-bottom-color:#7a5aa0}
#sentenceOrderScreen .so-hero{position:absolute;z-index:6;width:clamp(64px,9vw,92px);height:clamp(64px,9vw,92px);transform:translate(-50%,-100%);top:46%;transition:left .25s ease-out}
#sentenceOrderScreen .so-hero .gt-portrait{display:block;width:100%;height:100%;background:none;border:0}
#sentenceOrderScreen .so-hero .gt-portrait img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 6px 3px #0005)}
#sentenceOrderScreen .so-hero[data-walking=true] .gt-portrait{animation:so-step .35s ease-in-out infinite alternate}
#sentenceOrderScreen .so-hero[data-fever=true]::after{content:'';position:absolute;inset:-18%;border-radius:50%;background:radial-gradient(circle,#ffd54a66,transparent 70%);animation:ya-glow .4s infinite alternate;z-index:-1}
#sentenceOrderScreen .so-friend{position:absolute;z-index:6;right:2%;top:46%;width:clamp(60px,8vw,88px);aspect-ratio:1;transform:translateY(-100%);object-fit:contain;filter:drop-shadow(0 5px 3px #0005);animation:so-wave 1.2s ease-in-out infinite alternate}
#sentenceOrderScreen .so-friend[data-met=true]{animation:so-met .5s ease-out 3}
@keyframes so-wave{from{transform:translateY(-100%) rotate(-4deg)}to{transform:translateY(-104%) rotate(4deg)}}
@keyframes so-met{0%,100%{transform:translateY(-100%)}50%{transform:translateY(-135%)}}
#sentenceOrderScreen .so-sentence{margin:0;min-height:2.6em;padding:8px 10px;border-radius:12px;background:#ffffff14;text-align:center;font-size:clamp(20px,2.6vw,26px);font-weight:900;line-height:1.35;color:#fff}
#sentenceOrderScreen .so-blanks{color:#ffffff55}
#sentenceOrderScreen .so-feedback{margin:0;text-align:center;font-size:15px;font-weight:700;color:#d8e8f0}
#sentenceOrderScreen .so-next{min-height:52px;border:0;border-radius:14px;background:#ffb627;color:#3a2400;font:inherit;font-size:20px;font-weight:900;box-shadow:0 4px 0 #b57500;cursor:pointer}
#sentenceOrderScreen .so-review{margin:0;padding:0;list-style:none;display:grid;gap:6px}
#sentenceOrderScreen .so-review li{padding:6px 10px;border-radius:10px;background:#eef6ef;font-weight:700}
#sentenceOrderScreen .so-review li[data-correct=false]{background:#fff3da}
@keyframes so-flow{to{background-position-x:-90px}}
@keyframes so-step{from{transform:translateY(0) rotate(-4deg)}to{transform:translateY(-8%) rotate(4deg)}}
@keyframes so-glow{from{filter:brightness(1)}to{filter:brightness(1.15)}}
@keyframes so-nope{0%,100%{margin-left:0}20%{margin-left:-10px}40%{margin-left:9px}60%{margin-left:-6px}80%{margin-left:4px}}
`;

// Planks drift right-to-left inside the river, each in its own lane so they never overlap.
const BRIDGE_FROM = 17, BRIDGE_TO = 83, STREAM_FROM = 24, STREAM_TO = 76, LANES = [58, 68, 78, 88, 96];
const WALK_FROM = 6, BANK_EDGE = 9;
const STREAM_SPEED = { normal: 4, slow: 2.4 }; // percent of the field per second

export function createSentenceOrderView({ document: doc, dispatch, onBack, getSnapshot, cast }) {
  // A Gotomon waits across the river; the companion crosses the finished bridge to meet it.
  let friendSerial = 0, friendName = '';
  let active = true, problemId = null, lastSeq = -1, lastEventId = 0, lastStepSerial = 0, laidShown = -1;
  let crossing = null, drift = 0;
  const removes = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'sentenceOrderScreen', title: '文ならべ', theme: 'river' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });
  const left = el('div', 'so-bank'); left.dataset.side = 'left';
  const right = el('div', 'so-bank'); right.dataset.side = 'right';
  world.append(el('div', 'so-waves'), left, right);
  const hero = el('div', 'so-hero'); hero.style.left = `${WALK_FROM}%`; world.append(hero);
  const friend = el('img', 'so-friend'); friend.alt = ''; friend.hidden = true; world.append(friend);
  // Built once per sentence: taps never land on a node that is being replaced.
  let slots = [], planks = [];

  const sentence = el('p', 'so-sentence'); sentence.dataset.role = 'problem';
  const laidText = el('span', 'so-laid'), blanks = el('span', 'so-blanks'); sentence.append(laidText, blanks);
  const feedback = el('p', 'so-feedback', '文のはじめの言葉をタップ！'); feedback.setAttribute('aria-live', 'polite');
  const next = el('button', 'so-next', 'つぎへ'); next.type = 'button'; next.dataset.action = 'next'; next.hidden = true;
  on(next, 'click', () => {
    const state = getSnapshot();
    if (active && !state.paused && state.phase === 'feedback') dispatch({ type: 'next', payload: { sessionId: state.sessionId, problemId: state.problem?.problemId } });
  });
  dock.append(sentence, feedback, next);
  const review = el('div', 'ya-learning-result'); review.hidden = true;
  const reviewList = el('ol', 'so-review'); review.append(el('h3', '', '今回の文'), reviewList); frame.shell.append(review);
  doc.body.append(root);
  const answers = [];

  const textOf = (problem, id) => problem.chunks.find(chunk => chunk.chunkId === id)?.text ?? '';
  function lay(chunkId) {
    const state = getSnapshot();
    if (!active || state.paused || state.phase !== 'answering' || state.laid?.includes(chunkId)) return false;
    return dispatch({ type: 'lay', payload: { sessionId: state.sessionId, problemId: state.problem?.problemId, attemptId: state.attemptId, chunkId } });
  }
  removes.push(bindArcadeKeys(doc, event => {
    if (!active || event.repeat) return false;
    const index = ['1', '2', '3', '4', '5'].indexOf(event.key);
    if (index >= 0) { const plank = planks.find(item => item.key === index + 1); if (plank) lay(plank.id); return true; }
    if (event.key === 'Enter' && !next.hidden) { next.click(); return true; }
    return false;
  }));

  const build = (problem, order) => {
    for (const node of [...slots, ...planks.map(item => item.node)]) node.remove();
    crossing = null; laidShown = -1; lastStepSerial = 0;
    const count = problem.chunks.length, width = (BRIDGE_TO - BRIDGE_FROM) / count;
    slots = problem.chunks.map((_, i) => {
      const slot = el('i', 'so-slot'); slot.style.left = `${BRIDGE_FROM + width * i + .4}%`; slot.style.width = `${width - .8}%`;
      world.append(slot); return slot;
    });
    planks = order.map((id, index) => {
      const node = el('button', 'so-plank'); node.type = 'button'; node.dataset.chunkId = id; node.dataset.where = 'river';
      node.append(el('span', 'so-key', String(index + 1)), el('span', '', textOf(problem, id)));
      node.setAttribute('aria-label', `${index + 1}番 ${textOf(problem, id)}`);
      on(node, 'click', () => lay(id));
      world.append(node);
      return { id, node, key: index + 1, stream: index };
    });
  };
  // Laid planks sit on the bridge in sentence order; the rest keep drifting.
  const placeLaid = (problem, laid) => {
    const width = (BRIDGE_TO - BRIDGE_FROM) / problem.chunks.length;
    laid.forEach((id, index) => {
      const plank = planks.find(item => item.id === id); if (!plank || plank.node.dataset.where === 'bridge') return;
      const { node } = plank;
      node.dataset.where = 'bridge'; node.dataset.hint = 'false';
      node.style.left = `${BRIDGE_FROM + width * index + .4}%`; node.style.top = '46%'; node.style.width = `${width - .8}%`;
      node.children[0].hidden = true; node.style.opacity = '1'; node.setAttribute('aria-label', `橋の${index + 1}まいめ ${textOf(problem, id)}`);
    });
    slots.forEach((slot, index) => { slot.dataset.next = String(index === laid.length); });
    laidText.textContent = laid.map(id => textOf(problem, id)).join('');
    blanks.textContent = ' ＿'.repeat(Math.max(0, problem.chunks.length - laid.length));
  };
  const showStep = (state, step) => {
    const problem = state.problem, plank = planks.find(item => item.id === step.chunkId);
    if (step.ok) {
      const index = state.laid.indexOf(step.chunkId), width = (BRIDGE_TO - BRIDGE_FROM) / problem.chunks.length;
      fx.pop(BRIDGE_FROM + width * (index + .5), 32, 'ぴったり！', 'good');
      if (state.phase === 'answering') feedback.textContent = 'そのちょうし！ 次の言葉は？';
    } else {
      if (plank) restartClass(plank.node, 'so-nope');
      feedback.textContent = `「${textOf(problem, step.chunkId)}」は、もっとあとに来るよ`;
      frame.announce(`${textOf(problem, step.chunkId)} はもっとあと`);
    }
  };
  const showAnswer = state => {
    const answer = state.lastAnswer, problem = state.problem;
    const text = answer.correctOrder.map(id => textOf(problem, id)).join('');
    answers.push({ text, correct: answer.correct });
    crossing = 0;
    if (answer.correct) {
      fx.pop(50, 26, '橋がつながった！', 'good');
      feedback.textContent = friendName && !friend.hidden ? `せいかい！ 相棒がわたって、${friendName}に会いに行くよ` : 'せいかい！ 相棒がわたるよ';
      if (!friend.hidden) friend.dataset.met = 'true';
      frame.announce(`せいかい。${text}`);
    } else {
      fx.pop(50, 26, '橋ができた！', 'info');
      feedback.textContent = '橋ができた！ 正しい文をもう一度読んでみよう';
      frame.announce(`正しい文は ${text}`);
    }
  };

  return {
    root,
    attachCompanion(portrait) { hero.append(portrait); },
    focusPlay() { planks[0]?.node.focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      const problem = state.problem;
      if (problem && problem.problemId !== problemId) {
        problemId = problem.problemId; build(problem, state.currentOrder);
        const waiting = castAt(cast?.wild, friendSerial++);
        friend.hidden = !waiting || state.mode === 'review'; friend.dataset.met = 'false'; friendName = waiting?.name ?? '';
        if (waiting) friend.src = waiting.imageUrl;
        feedback.textContent = state.mode === 'review' ? '文のつながりを、相棒とたしかめよう' : '文のはじめの言葉をタップ！';
      }
      if (!problem) return;
      const laid = state.laid ?? [];
      if (laid.length !== laidShown) { laidShown = laid.length; placeLaid(problem, laid); }
      if (state.lastStep && state.lastStep.serial !== lastStepSerial) { lastStepSerial = state.lastStep.serial; showStep(state, state.lastStep); }
      for (const plank of planks) {
        const hint = String(plank.id === state.hintChunkId && plank.node.dataset.where === 'river');
        if (plank.node.dataset.hint !== hint) plank.node.dataset.hint = hint;
      }
      if (state.hintChunkId && state.phase === 'answering') feedback.textContent = '光っている言葉が、次に来るよ';
      if (state.seq !== lastSeq) {
        lastSeq = state.seq;
        if (state.lastAnswer && answers.length < state.answered) showAnswer(state);
      }
      const canPlay = !state.paused && state.phase === 'answering';
      for (const plank of planks) plank.node.disabled = !canPlay || plank.node.dataset.where === 'bridge';
      next.hidden = !(state.mode === 'review' && state.phase === 'feedback');
      next.disabled = !!state.paused;
      if (state.result && review.hidden) {
        review.hidden = false; reviewList.textContent = '';
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
      // Only positions change per frame; the plank elements themselves stay put.
      if (state.phase === 'answering' && !state.paused) drift += (dt / 1000) * (STREAM_SPEED[w.pace] ?? STREAM_SPEED.normal);
      const span = STREAM_TO - STREAM_FROM, gap = span / Math.max(1, planks.length);
      for (const plank of planks) {
        if (plank.node.dataset.where !== 'river') continue;
        const x = STREAM_TO - (((plank.stream * gap + drift) % span) + span) % span;
        plank.node.style.left = `${x}%`; plank.node.style.top = `${LANES[plank.stream % LANES.length]}%`;
        // Fade near the river ends so the wrap-around never pops a plank out from under a finger.
        plank.node.style.opacity = String(Math.max(.2, Math.min(1, (x - STREAM_FROM) / 5, (STREAM_TO - x) / 5)));
      }
      let x = WALK_FROM + (w.progress ?? 0) * (BANK_EDGE - WALK_FROM);
      if (crossing !== null) { crossing = Math.min(1, crossing + dt / 420); x = BANK_EDGE + crossing * (95 - BANK_EDGE); }
      hero.style.left = `${x}%`;
      hero.dataset.walking = String(crossing !== null ? crossing < 1 : state.phase === 'answering' && !w.arrived && state.mode !== 'review');
      hero.dataset.fever = String(!!w.fever);
      const event = w.lastEvent;
      if (event && event.id !== lastEventId) {
        lastEventId = event.id;
        if (event.type === 'hit') {
          if (event.special || w.fever) for (const plank of planks) plank.node.dataset.rainbow = 'true';
          if (event.special) fx.banner('虹の橋！', 'great');
          else if (event.quick) fx.pop(50, 16, '止まらずにわたれた！', 'great');
        } else if (event.type === 'boost') { fx.banner('虹のかけ橋！', 'great'); fx.flash('great'); }
      }
      // Review runs have no goal; only normal play shows the mission.
      const total = state.totalQuestions || 10, mission = state.mode === 'review' ? null : w.challenge;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: (state.answered ?? 0) / total,
        progressLabel: `橋 ${w.correct ?? 0} · ${Math.min(total, (state.answered ?? 0) + (state.phase === 'answering' ? 1 : 0))}/${total}文`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; for (const plank of planks) plank.node.disabled = true; next.disabled = true; },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
