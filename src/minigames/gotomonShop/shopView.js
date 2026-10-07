import { createArcadeFrame, restartClass } from '../arcade/arcadeKit.js';
import { SHOP_SLOTS, SHELF_SIZE } from './shopGame.js';

const CSS = `
#gotomonShopScreen .ya-field{background:linear-gradient(#fbe3b8 0,#f6d49a 58%,#b87a44 58.3%,#a0663a 100%)}
#gotomonShopScreen .gs-counter{position:absolute;left:2%;right:2%;top:64px;bottom:14%;z-index:2;display:grid;grid-template-columns:repeat(3,1fr);align-items:center;gap:clamp(6px,1.4vw,14px)}
#gotomonShopScreen .gs-customer{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-width:0;padding:10px 6px 10px;border:3px solid transparent;border-radius:16px;background:#ffffff33;font:inherit;color:#3a2400;cursor:pointer;touch-action:manipulation}
#gotomonShopScreen .gs-customer[hidden]{display:none}
#gotomonShopScreen .gs-customer[data-focus=true]{border-color:#ffb627;background:#fff6dccc;box-shadow:0 0 0 4px #ffb62755}
#gotomonShopScreen .gs-customer:focus-visible{outline:3px solid #2a6fb0;outline-offset:2px}
#gotomonShopScreen .gs-bubble{position:relative;max-width:100%;padding:6px 10px;border-radius:14px;background:#fff;color:#1b2a36;font-size:clamp(13px,1.8vw,17px);font-weight:900;line-height:1.35;box-shadow:0 3px 0 #0002;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
#gotomonShopScreen .gs-bubble::after{content:'';position:absolute;left:50%;bottom:-8px;transform:translateX(-50%);border:8px solid transparent;border-top-color:#fff;border-bottom:0}
#gotomonShopScreen .gs-bubble b{display:inline-block;padding:0 5px;border-radius:6px;background:#ffe066;color:#3a2400}
#gotomonShopScreen .gs-customer[data-kind=meaning] .gs-bubble{background:#eaf6ff}
#gotomonShopScreen .gs-customer[data-kind=meaning] .gs-bubble::after{border-top-color:#eaf6ff}
#gotomonShopScreen .gs-customer img{width:clamp(72px,14vw,160px);height:clamp(72px,14vw,160px);object-fit:contain;margin-top:8px;filter:drop-shadow(0 5px 3px #0004)}
#gotomonShopScreen .gs-name{font-size:12px;font-weight:900;color:#5a3616}
#gotomonShopScreen .gs-mood{font-size:26px;line-height:1}
#gotomonShopScreen .gs-customer.gs-happy img{animation:gs-happy .5s ease-out}
#gotomonShopScreen .gs-customer.gs-no img{animation:gs-no .45s ease-out}
#gotomonShopScreen .gs-keeper{align-self:center;width:72px;height:72px;pointer-events:none}
#gotomonShopScreen .gs-keeper .gt-portrait{display:block;width:100%;height:100%;background:none;border:0}
#gotomonShopScreen .gs-keeper .gt-portrait img{width:100%;height:100%;object-fit:contain}
#gotomonShopScreen .gs-title{margin:0;text-align:center;font-size:15px;font-weight:900;color:#ffe2b8}
#gotomonShopScreen .gs-request{margin:0;padding:10px 12px;border-radius:14px;background:#ffffff14;color:#fff;text-align:center;font-size:clamp(17px,2.2vw,22px);font-weight:800;line-height:1.5}
#gotomonShopScreen .gs-target{display:inline-block;margin:0 2px;padding:0 6px;border-radius:8px;background:#ffe066;color:#3a2400;font-size:1.15em;line-height:1.25}
#gotomonShopScreen .gs-shelf{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:8px;border-radius:14px;background:#7a4a22}
#gotomonShopScreen .gs-kanji{min-height:62px;border:0;border-radius:12px;background:#fffdf6;color:#1b2a36;font:inherit;font-size:clamp(28px,4vw,40px);font-weight:900;line-height:1;box-shadow:0 4px 0 #c9b98f;cursor:pointer;touch-action:none}
#gotomonShopScreen .gs-kanji[data-selected=true]{background:#fff0bc;box-shadow:0 4px 0 #b38132,0 0 0 3px #ffcc48}
#gotomonShopScreen .gs-kanji[data-dragging=true]{position:relative;z-index:12;touch-action:none;box-shadow:0 10px 18px #0006,0 0 0 3px #ffcc48}
#gotomonShopScreen .gs-kanji:focus-visible{outline:3px solid #ffd54a;outline-offset:2px}
#gotomonShopScreen .gs-kanji[data-hint=true]{background:#d7f7df;box-shadow:0 4px 0 #1f9d55,0 0 0 4px #37c871;animation:gs-glow .8s ease-in-out infinite alternate}
#gotomonShopScreen .gs-kanji.gs-given{animation:gs-give .35s ease-out}
#gotomonShopScreen .gs-give{align-self:stretch;min-height:42px;padding:6px 12px;border:2px solid #ffcc48;border-radius:11px;background:#fff0bc;color:#432b10;font:inherit;font-size:clamp(14px,1.8vw,17px);font-weight:900;cursor:pointer;touch-action:manipulation}
#gotomonShopScreen .gs-give:disabled{opacity:.65;cursor:default}
#gotomonShopScreen .gs-give:focus-visible{outline:3px solid #fff;outline-offset:2px}
#gotomonShopScreen .gs-review{margin:0;padding:0;list-style:none;display:grid;gap:6px}
#gotomonShopScreen .gs-review li{padding:6px 10px;border-radius:10px;background:#eef6ef;font-weight:700}
#gotomonShopScreen .gs-review li[data-correct=false]{background:#fff3da}
@media (max-width:700px){#gotomonShopScreen .gs-counter{top:92px;bottom:4%}#gotomonShopScreen .gs-keeper{display:none}#gotomonShopScreen .gs-kanji{min-height:54px}}
@keyframes gs-happy{0%,100%{transform:none}40%{transform:translateY(-16px) scale(1.06)}}
@keyframes gs-no{0%,100%{transform:none}30%{transform:rotate(-8deg)}60%{transform:rotate(7deg)}}
@keyframes gs-give{0%{transform:scale(1)}50%{transform:scale(.88)}100%{transform:scale(1)}}
@keyframes gs-glow{from{transform:none}to{transform:translateY(-3px)}}
`;
const moodFace = mood => mood >= .6 ? '😊' : mood >= .3 ? '🙂' : '😐';

export function createShopView({ document: doc, dispatch, onBack, getSnapshot }) {
  let active = true, lastSeq = -1, lastEventId = 0, requestKey = null, doneShown = false, shownAttempt = null, selectedCellId = null;
  const removes = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'gotomonShopScreen', title: 'ゴトモンのおねがい', theme: 'shop' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });

  const counter = el('div', 'gs-counter');
  const slots = Array.from({ length: SHOP_SLOTS }, (_, slot) => {
    const node = el('button', 'gs-customer'); node.type = 'button'; node.dataset.slot = String(slot);
    const bubble = el('span', 'gs-bubble'), img = el('img'), name = el('span', 'gs-name'), mood = el('span', 'gs-mood');
    img.alt = ''; node.append(bubble, img, name, mood);
    on(node, 'click', () => choose(slot)); counter.append(node);
    return { node, bubble, img, name, mood, key: null, face: '' };
  });
  world.append(counter);

  const title = el('p', 'gs-title');
  const request = el('p', 'gs-request'); request.dataset.role = 'problem';
  const shelfBox = el('div', 'gs-shelf'); shelfBox.setAttribute('aria-label', 'たなの漢字');
  const shelf = Array.from({ length: SHELF_SIZE }, (_, index) => {
    const node = el('button', 'gs-kanji'); node.type = 'button'; node.dataset.index = String(index);
    on(node, 'click', () => {
      if (node.dataset.dragged === 'true') { node.dataset.dragged = 'false'; return; }
      selectCard(index);
    });
    let pointerId = null, start = null;
    on(node, 'pointerdown', event => {
      const state = getSnapshot();
      if (!active || state.paused || state.phase !== 'answering' || !event.isPrimary || event.button !== 0) return;
      pointerId = event.pointerId; start = { x: event.clientX, y: event.clientY };
      node.dataset.dragged = 'false'; node.setPointerCapture(pointerId);
    });
    on(node, 'pointermove', event => {
      if (event.pointerId !== pointerId || !start) return;
      const dx = event.clientX - start.x, dy = event.clientY - start.y;
      if (node.dataset.dragging !== 'true' && Math.hypot(dx, dy) < 8) return;
      node.dataset.dragging = 'true'; node.dataset.dragged = 'true';
      node.style.transform = `translate(${dx}px,${dy}px)`;
    });
    const finishDrag = event => {
      if (event.pointerId !== pointerId) return;
      const wasDragging = node.dataset.dragging === 'true';
      pointerId = null; start = null; node.dataset.dragging = 'false'; node.style.transform = '';
      if (node.hasPointerCapture(event.pointerId)) node.releasePointerCapture(event.pointerId);
      if (event.type !== 'pointerup' || !wasDragging) return;
      const customer = doc.elementFromPoint(event.clientX, event.clientY)?.closest('.gs-customer');
      if (customer && slots.some(item => item.node === customer)) {
        const state = getSnapshot();
        selectedCellId = state.shelf?.[index]?.cellId ?? null;
        deliverTo(Number(customer.dataset.slot));
      }
    };
    on(node, 'pointerup', finishDrag); on(node, 'pointercancel', finishDrag);
    shelfBox.append(node); return node;
  });
  const giveButton = el('button', 'gs-give', '漢字を えらぼう'); giveButton.type = 'button';
  giveButton.dataset.action = 'shop-give'; giveButton.disabled = true;
  on(giveButton, 'click', () => deliverTo(getSnapshot().focus));
  // The shell advances after feedback; this stays hidden and only serves hosts without auto-advance.
  const go = el('button', 'gs-go', 'つぎへ'); go.type = 'button'; go.dataset.action = 'next'; go.hidden = true;
  on(go, 'click', () => proceed());
  const note = el('p', 'ya-dock-note'); note.dataset.role = 'feedback';
  const keeper = el('div', 'gs-keeper');
  dock.append(keeper, title, request, shelfBox, giveButton, note, go);
  const review = el('div', 'ya-learning-result'); review.hidden = true;
  const reviewList = el('ol', 'gs-review'); review.append(el('h3', '', '今回わたした漢字'), reviewList); frame.shell.append(review);
  doc.body.append(root);
  const answers = [];

  const session = () => getSnapshot();
  function deliverTo(slot) {
    let state = session();
    if (!active || state.paused || state.phase !== 'answering' || !selectedCellId ||
        !state.shelf?.some(cell => cell.cellId === selectedCellId) || !state.customers?.some(customer => customer.slot === slot)) return false;
    if (state.focus !== slot) {
      if (!dispatch({ type: 'focus', payload: { sessionId: state.sessionId, slot } })) return false;
      state = session();
    }
    if (state.phase !== 'answering' || state.focus !== slot) return false;
    const handed = dispatch({ type: 'give', payload: { sessionId: state.sessionId, attemptId: state.attemptId, cellId: selectedCellId } });
    if (handed) selectedCellId = null;
    return handed;
  }
  function choose(slot) {
    const state = session();
    if (!active || state.paused || state.phase !== 'answering') return false;
    if (selectedCellId) return deliverTo(slot);
    if (state.focus === slot) return false;
    return dispatch({ type: 'focus', payload: { sessionId: state.sessionId, slot } });
  }
  function selectCard(index) {
    const state = session(), cell = state.shelf?.[index];
    if (!active || state.paused || state.phase !== 'answering' || !cell) return false;
    selectedCellId = selectedCellId === cell.cellId ? null : cell.cellId;
    renderDock(state);
    return true;
  }
  function proceed() {
    const state = session();
    if (!active || state.paused || state.phase !== 'feedback') return false;
    return dispatch({ type: 'next', payload: { sessionId: state.sessionId, problemId: state.problem?.problemId } });
  }

  const renderCounter = state => {
    slots.forEach(item => {
      const customer = state.customers.find(entry => entry.slot === Number(item.node.dataset.slot));
      item.node.hidden = !customer;
      if (!customer) { item.key = null; item.node.dataset.focus = 'false'; return; }
      if (item.key !== customer.customerId) {
        // Content is replaced only when a new customer arrives, never during a tap.
        item.key = customer.customerId;
        item.node.dataset.kind = customer.kind;
        item.bubble.textContent = '';
        if (customer.kind === 'reading') item.bubble.append(el('span', '', '「'), el('b', '', customer.clue.reading), el('span', '', '」の漢字ください！'));
        else item.bubble.append(el('span', '', `${customer.clue.meaning}、ください！`));
        item.img.src = customer.imageUrl || ''; item.img.hidden = !customer.imageUrl;
        item.name.textContent = customer.name;
        const clueText = customer.kind === 'reading' ? customer.clue.reading : customer.clue.meaning;
        item.node.setAttribute('aria-label', `${customer.name}のおねがい、${clueText}の漢字`);
      }
      const face = moodFace(customer.mood);
      if (item.face !== face) { item.face = face; item.mood.textContent = face; }
      const focused = String(state.focus === customer.slot);
      if (item.node.dataset.focus !== focused) item.node.dataset.focus = focused;
      item.node.disabled = state.phase !== 'answering' || state.paused;
    });
  };
  const renderDock = state => {
    const titleText = state.problem ? `おねがい ${Math.min(state.total, state.served + 1)}/${state.total} · チップ⭐${state.tips}` : '';
    if (title.textContent !== titleText) title.textContent = titleText;
    const problem = state.problem;
    if (problem && requestKey !== problem.problemId) {
      requestKey = problem.problemId;
      const customer = state.customers.find(entry => entry.slot === state.focus);
      request.textContent = '';
      request.append(el('span', '', `${customer?.name ?? ''}：`));
      if (problem.kind === 'reading') request.append(el('span', '', problem.clue.before), el('span', 'gs-target', problem.clue.reading), el('span', '', problem.clue.after));
      else request.append(el('span', 'gs-target', problem.clue.meaning));
    }
    if (selectedCellId && !state.shelf.some(cell => cell.cellId === selectedCellId)) selectedCellId = null;
    shelf.forEach((node, index) => {
      const cell = state.shelf[index];
      node.hidden = !cell; if (!cell) return;
      if (node.dataset.cellId !== cell.cellId) { node.dataset.cellId = cell.cellId; node.textContent = cell.kanji; node.setAttribute('aria-label', cell.kanji); }
      const selected = String(state.phase === 'answering' && selectedCellId === cell.cellId);
      if (node.dataset.selected !== selected) { node.dataset.selected = selected; node.setAttribute('aria-pressed', selected); }
      const hint = String(state.phase === 'answering' && state.hintCellId === cell.cellId);
      if (node.dataset.hint !== hint) node.dataset.hint = hint;
      node.disabled = state.phase !== 'answering' || state.paused;
    });
    const chosen = state.phase === 'answering' ? state.shelf.find(cell => cell.cellId === selectedCellId) : null;
    const customer = state.customers.find(entry => entry.slot === state.focus);
    giveButton.disabled = state.paused || !chosen;
    giveButton.textContent = chosen ? `「${chosen.kanji}」を ${customer?.name ?? 'おきゃくさん'}に わたす` : '漢字を えらぼう';
    if (state.phase === 'answering') {
      const ask = chosen ? `「${chosen.kanji}」を えらんだよ。おきゃくさんへ とどけよう` : state.hintCellId ? '光っている漢字をわたしてあげよう' : problem?.kind === 'reading' ? '黄色の読みの漢字を、たなからえらぼう' : 'この意味の漢字を、たなからえらぼう';
      if (note.textContent !== ask) note.textContent = ask;
    }
  };
  const showAnswer = state => {
    const answer = state.lastAnswer;
    const slot = slots.find(item => Number(item.node.dataset.slot) === answer.slot);
    const given = shelf.find(node => node.dataset.cellId === answer.choiceId);
    if (given) restartClass(given, 'gs-given');
    if (answer.first) answers.push({ text: answer.kanji, correct: answer.correct });
    if (answer.correct) {
      if (slot) restartClass(slot.node, 'gs-happy');
      note.textContent = `${answer.name}「ありがとう！」 チップ${'⭐'.repeat(answer.tip)}`;
      fx.burst(50, 40, answer.tip >= 3 ? 'great' : 'good', answer.tip >= 3 ? 1.5 : 1);
      if (answer.tip >= 3) fx.pop(50, 30, 'ごきげん！', 'great');
    } else {
      if (slot) restartClass(slot.node, 'gs-no');
      note.textContent = `${answer.name}「おねがいの漢字は「${answer.kanji}」だよ。もう一度 えらんでみよう」`;
    }
    frame.announce(note.textContent);
  };

  return {
    root,
    attachCompanion(portrait) { keeper.append(portrait); },
    focusPlay() { shelf[0].focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      if (!state.shelf?.length && !state.result) return;
      renderCounter(state);
      renderDock(state);
      if (state.seq !== lastSeq) {
        lastSeq = state.seq;
        if (state.lastAnswer && state.lastAnswer.attemptId !== shownAttempt) { shownAttempt = state.lastAnswer.attemptId; showAnswer(state); }
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
        if (event.type === 'boost') { fx.banner('大はんじょう！', 'great'); fx.flash('great'); }
      }
      const mission = w.challenge;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: Math.min(1, (state.served ?? 0) / (state.total || 1)), progressLabel: `おねがい ${state.served ?? 0}/${state.total ?? 0}`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; [...slots.map(item => item.node), ...shelf, giveButton, go].forEach(node => { node.disabled = true; }); },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
