import { createArcadeFrame, bindArcadeKeys } from '../arcade/arcadeKit.js';

const CSS = `
#sentenceOrderScreen .ya-field{background:linear-gradient(#9fdcff 0,#d6f1ff 32%,#7cc26b 32.2%,#5fa855 46%,#3f8fc9 46.2%,#2f74b0 100%)}
#sentenceOrderScreen .so-bank{position:absolute;z-index:2;top:46%;bottom:0;width:17%;background:linear-gradient(#6fb85c 0 14%,#8a6a45 14% 100%);border-top:4px solid #4f9a45}
#sentenceOrderScreen .so-bank[data-side=left]{left:0;border-radius:0 18px 0 0}
#sentenceOrderScreen .so-bank[data-side=right]{right:0;border-radius:18px 0 0 0}
#sentenceOrderScreen .so-waves{position:absolute;left:0;right:0;top:50%;bottom:0;background-image:repeating-linear-gradient(90deg,#ffffff22 0 30px,transparent 30px 90px);opacity:.6;animation:so-flow 3s linear infinite}
#sentenceOrderScreen .so-slot{position:absolute;z-index:3;top:46%;height:clamp(40px,7%,56px);transform:translateY(-100%);border:3px dashed #ffffffaa;border-radius:8px}
#sentenceOrderScreen .so-plank{position:absolute;z-index:4;min-height:44px;padding:4px 6px;border:0;border-radius:8px;background:linear-gradient(#e0b46e,#b88340);color:#2a1c10;border-bottom:5px solid #7a5226;font:inherit;font-size:clamp(15px,1.8vw,19px);font-weight:900;line-height:1.2;cursor:pointer;touch-action:manipulation;box-shadow:0 4px 0 #0004;overflow-wrap:anywhere}
#sentenceOrderScreen .so-plank[data-where=river]{transform:translate(-50%,-50%);animation:so-bob 1.6s ease-in-out infinite alternate;width:max-content;min-width:88px;max-width:34%;padding:6px 12px}
#sentenceOrderScreen .so-plank[data-where=bridge]{transform:translateY(-100%);min-height:clamp(40px,7%,56px)}
#sentenceOrderScreen .so-key{font-size:.7em;color:#6b4a2a;margin-right:3px}
#sentenceOrderScreen .so-plank:focus-visible{outline:3px solid #ffd54a;outline-offset:2px}
#sentenceOrderScreen .so-plank[data-status=right]{background:linear-gradient(#bff0c8,#7fcf94);border-bottom-color:#2f8a4f}
#sentenceOrderScreen .so-plank[data-status=fixed]{background:linear-gradient(#cfe8ff,#94c4f0);border-bottom-color:#2a6fb0}
#sentenceOrderScreen .so-plank[data-rainbow=true]{background:linear-gradient(90deg,#ffb3b3,#ffe08a,#b8f0a8,#a8d8ff,#d8b8ff);border-bottom-color:#7a5aa0}
#sentenceOrderScreen .so-hero{position:absolute;z-index:5;width:clamp(64px,9vw,92px);height:clamp(64px,9vw,92px);transform:translate(-50%,-100%);top:46%;transition:left .1s linear}
#sentenceOrderScreen .so-hero .gt-portrait{display:block;width:100%;height:100%;background:none;border:0}
#sentenceOrderScreen .so-hero .gt-portrait img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 6px 3px #0005)}
#sentenceOrderScreen .so-hero[data-walking=true] .gt-portrait{animation:so-step .35s ease-in-out infinite alternate}
#sentenceOrderScreen .so-hero[data-fever=true]::after{content:'';position:absolute;inset:-18%;border-radius:50%;background:radial-gradient(circle,#ffd54a66,transparent 70%);animation:ya-glow .4s infinite alternate;z-index:-1}
#sentenceOrderScreen .so-sentence{margin:0;min-height:2.6em;padding:8px 10px;border-radius:12px;background:#ffffff14;text-align:center;font-size:clamp(20px,2.6vw,26px);font-weight:900;line-height:1.35;color:#fff}
#sentenceOrderScreen .so-sentence span:not(.so-laid){color:#ffffff55}
#sentenceOrderScreen .so-feedback{margin:0;text-align:center;font-size:15px;font-weight:700;color:#d8e8f0}
#sentenceOrderScreen .so-next{min-height:52px;border:0;border-radius:14px;background:#ffb627;color:#3a2400;font:inherit;font-size:20px;font-weight:900;box-shadow:0 4px 0 #b57500;cursor:pointer}
#sentenceOrderScreen .so-review{margin:0;padding:0;list-style:none;display:grid;gap:6px}
#sentenceOrderScreen .so-review li{padding:6px 10px;border-radius:10px;background:#eef6ef;font-weight:700}
#sentenceOrderScreen .so-review li[data-correct=false]{background:#fff3da}
@keyframes so-bob{from{margin-top:-4px}to{margin-top:4px}}
@keyframes so-flow{to{background-position-x:90px}}
@keyframes so-step{from{transform:translateY(0) rotate(-4deg)}to{transform:translateY(-8%) rotate(4deg)}}
`;

// The companion walks from WALK_FROM to the bank edge while the sentence is open.
const BRIDGE_FROM = 17, BRIDGE_TO = 83, WALK_FROM = 6, BANK_EDGE = 9, RIVER_Y = 76;

export function createSentenceOrderView({ document: doc, dispatch, onBack, getSnapshot }) {
  let active = true, problemId = null, lastSeq = -1, lastEventId = 0, placed = 0, crossing = null;
  const removes = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'sentenceOrderScreen', title: '文ならべ', theme: 'river' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });
  const left = el('div', 'so-bank'); left.dataset.side = 'left';
  const right = el('div', 'so-bank'); right.dataset.side = 'right';
  world.append(el('div', 'so-waves'), left, right);
  const slots = [], planks = new Map();
  const hero = el('div', 'so-hero'); hero.style.left = `${WALK_FROM}%`; world.append(hero);

  const sentence = el('p', 'so-sentence'); sentence.dataset.role = 'problem';
  const feedback = el('p', 'so-feedback', '文のはじめの板からタップ！');
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

  const identity = state => ({ sessionId: state.sessionId, problemId: state.problem?.problemId, attemptId: state.attemptId });
  const textOf = (problem, id) => problem.chunks.find(chunk => chunk.chunkId === id)?.text ?? '';
  const canPlay = state => active && !state.paused && state.phase === 'answering';
  // Taking a floating plank lays it on the next free slot of the bridge.
  function take(chunkId) {
    const state = getSnapshot();
    if (!canPlay(state)) return false;
    const from = state.currentOrder.indexOf(chunkId);
    if (from < placed) return false;
    if (from !== placed && dispatch({ type: 'place', payload: { ...identity(state), chunkId, to: placed } }) !== true) return false;
    placed++;
    const after = getSnapshot();
    if (placed >= after.currentOrder.length) dispatch({ type: 'submit', payload: identity(after) });
    render(getSnapshot());
    return true;
  }
  // Tapping a laid plank sends it, and every plank after it, back to the river.
  function lift(chunkId) {
    const state = getSnapshot();
    if (!canPlay(state)) return false;
    const at = state.currentOrder.indexOf(chunkId);
    if (at < 0 || at >= placed) return false;
    placed = at; render(state); return true;
  }
  removes.push(bindArcadeKeys(doc, event => {
    if (!active || event.repeat) return false;
    const state = getSnapshot();
    const index = ['1', '2', '3', '4', '5'].indexOf(event.key);
    if (index >= 0) { const id = state.currentOrder?.[placed + index]; if (id) take(id); return true; }
    if (event.key === 'Backspace') { const id = state.currentOrder?.[placed - 1]; if (id) lift(id); return true; }
    if (event.key === 'Enter' && !next.hidden) { next.click(); return true; }
    return false;
  }));

  const build = problem => {
    for (const node of [...slots, ...planks.values()]) node.remove();
    slots.length = 0; planks.clear(); placed = 0; crossing = null;
    const count = problem.chunks.length, width = (BRIDGE_TO - BRIDGE_FROM) / count;
    for (let i = 0; i < count; i++) {
      const slot = el('i', 'so-slot'); slot.style.left = `${BRIDGE_FROM + width * i + .4}%`; slot.style.width = `${width - .8}%`;
      world.append(slot); slots.push(slot);
    }
    for (const chunk of problem.chunks) {
      const node = el('button', 'so-plank'); node.type = 'button'; node.dataset.chunkId = chunk.chunkId;
      on(node, 'click', () => (node.dataset.where === 'bridge' ? lift(chunk.chunkId) : take(chunk.chunkId)));
      world.append(node); planks.set(chunk.chunkId, node);
    }
  };
  // Draw every plank from the Core order: the first `placed` are on the bridge.
  function render(state) {
    const problem = state.problem;
    if (!problem) return;
    const order = state.lastAnswer ? (state.lastAnswer.correct ? state.lastAnswer.submittedOrder : state.lastAnswer.correctOrder) : state.currentOrder;
    const onBridge = state.lastAnswer ? order.length : placed;
    const count = order.length, width = (BRIDGE_TO - BRIDGE_FROM) / count, pool = order.slice(onBridge);
    order.forEach((id, index) => {
      const node = planks.get(id); if (!node) return;
      node.textContent = '';
      if (index < onBridge) {
        node.dataset.where = 'bridge';
        node.style.left = `${BRIDGE_FROM + width * index + .4}%`; node.style.top = '46%'; node.style.width = `${width - .8}%`;
        node.append(el('span', '', textOf(problem, id)));
        node.setAttribute('aria-label', `橋の${index + 1}まいめ ${textOf(problem, id)}。タップで川にもどす`);
      } else {
        const slot = index - onBridge;
        node.dataset.where = 'river';
        node.style.left = `${BRIDGE_FROM + 13 + (BRIDGE_TO - BRIDGE_FROM - 26) * (pool.length === 1 ? .5 : slot / (pool.length - 1))}%`;
        node.style.top = `${RIVER_Y + (slot % 2 ? 8 : 0)}%`; node.style.width = '';
        node.style.animationDelay = `${-slot * .4}s`;
        node.append(el('span', 'so-key', String(slot + 1)), el('span', '', textOf(problem, id)));
        node.setAttribute('aria-label', `${slot + 1}番 ${textOf(problem, id)}`);
      }
      node.disabled = !canPlay(state);
    });
    sentence.textContent = '';
    const laid = order.slice(0, onBridge).map(id => textOf(problem, id));
    sentence.append(el('span', 'so-laid', laid.join('')));
    if (onBridge < count) sentence.append(el('span', '', ' ＿'.repeat(count - onBridge)));
  }

  const showAnswer = state => {
    const answer = state.lastAnswer, problem = state.problem;
    const rightText = answer.correctOrder.map(id => textOf(problem, id)).join('');
    answers.push({ text: rightText, correct: answer.correct });
    crossing = 0;
    render(state);
    for (const [id, node] of planks) node.dataset.status = answer.correct ? 'right' : answer.submittedOrder.indexOf(id) === answer.correctOrder.indexOf(id) ? 'right' : 'fixed';
    if (answer.correct) {
      fx.pop(50, 30, '橋がつながった！', 'good');
      feedback.textContent = 'せいかい！ 相棒がわたるよ';
      frame.announce(`せいかい。${rightText}`);
    } else {
      fx.pop(50, 30, '板をならべかえたよ', 'info');
      feedback.textContent = '青い板は、場所を入れかえたよ。正しい文を読んでみよう';
      frame.announce(`正しい文は ${rightText}`);
    }
  };

  return {
    root,
    attachCompanion(portrait) { hero.append(portrait); },
    focusPlay() { [...planks.values()].find(node => node.dataset.where === 'river')?.focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      const problem = state.problem;
      if (problem && problem.problemId !== problemId) {
        problemId = problem.problemId; build(problem);
        feedback.textContent = state.mode === 'review' ? '文のつながりを、相棒とたしかめよう' : '文のはじめの板からタップ！';
      }
      if (state.seq !== lastSeq) {
        lastSeq = state.seq;
        if (state.lastAnswer && answers.length < state.answered) showAnswer(state);
      }
      if (!state.lastAnswer) render(state);
      else for (const node of planks.values()) node.disabled = true;
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
      let x = WALK_FROM + (w.progress ?? 0) * (BANK_EDGE - WALK_FROM);
      if (crossing !== null) { crossing = Math.min(1, crossing + dt / 420); x = BANK_EDGE + crossing * (95 - BANK_EDGE); }
      hero.style.left = `${x}%`;
      hero.dataset.walking = String(crossing !== null ? crossing < 1 : state.phase === 'answering' && !w.arrived && state.mode !== 'review');
      hero.dataset.fever = String(!!w.fever);
      if (state.phase === 'answering' && w.arrived && state.mode !== 'review') feedback.textContent = '相棒が川岸で待ってるよ。ゆっくりならべよう';
      const event = w.lastEvent;
      if (event && event.id !== lastEventId) {
        lastEventId = event.id;
        if (event.type === 'hit') {
          if (event.special || w.fever) for (const node of planks.values()) node.dataset.rainbow = 'true';
          if (event.special) fx.banner('虹の橋！', 'great');
          else if (event.quick) fx.pop(50, 18, '止まらずにわたれた！', 'great');
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
    stopInput() { active = false; for (const node of planks.values()) node.disabled = true; next.disabled = true; },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
