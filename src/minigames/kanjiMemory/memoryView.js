import { createArcadeFrame, restartClass } from '../arcade/arcadeKit.js';
import { castAt } from '../gotomonCast.js';

const CSS = `
#kanjiMemoryScreen .ya-field{background:radial-gradient(circle at 50% 20%,#e9f7ff 0,#b8e0f5 45%,#7fb8dd 100%)}
#kanjiMemoryScreen .mm-board{position:absolute;left:3%;right:3%;top:54px;bottom:12px;z-index:2;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(3,1fr);gap:clamp(6px,1.2vw,12px)}
#kanjiMemoryScreen .mm-card{position:relative;min-width:0;min-height:0;padding:0;border:0;background:none;font:inherit;perspective:700px;cursor:pointer;touch-action:manipulation}
#kanjiMemoryScreen .mm-card:disabled{cursor:default}
#kanjiMemoryScreen .mm-card:focus-visible{outline:4px solid #ffd54a;outline-offset:2px;border-radius:14px}
#kanjiMemoryScreen .mm-card[data-marked=true][data-up=false]::after{content:'★';position:absolute;right:7px;top:7px;z-index:2;display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:#ffe066;color:#563500;font-size:21px;box-shadow:0 2px 3px #0005;pointer-events:none}
#kanjiMemoryScreen .mm-inner{position:absolute;inset:0;transform-style:preserve-3d;transition:transform .32s ease-out}
#kanjiMemoryScreen .mm-card[data-up=true] .mm-inner{transform:rotateY(180deg)}
#kanjiMemoryScreen .mm-back,#kanjiMemoryScreen .mm-face{position:absolute;inset:0;display:grid;place-items:center;border-radius:14px;backface-visibility:hidden;-webkit-backface-visibility:hidden;box-shadow:0 5px 0 #0003}
#kanjiMemoryScreen .mm-back{background:repeating-linear-gradient(45deg,#3d7fc4 0 10px,#3574b6 10px 20px);border:4px solid #fffdf6;color:#ffffffcc;font-size:clamp(22px,4vmin,36px);font-weight:900}
#kanjiMemoryScreen .mm-face{transform:rotateY(180deg);padding:6px;background:#fffdf6;border:4px solid #fffdf6;color:#1b2a36;text-align:center;font-weight:900;line-height:1.3;overflow:hidden}
#kanjiMemoryScreen .mm-card[data-face=kanji] .mm-face{font-size:clamp(30px,6.4vmin,60px);line-height:1}
#kanjiMemoryScreen .mm-card[data-face=reading] .mm-face{font-size:clamp(18px,3.4vmin,30px);color:#7a3d00;background:#fff6dc}
#kanjiMemoryScreen .mm-card[data-face=meaning] .mm-face{font-size:clamp(13px,2.2vmin,17px);color:#0d4a6b;background:#eaf6ff}
#kanjiMemoryScreen .mm-back img{width:62%;height:62%;object-fit:contain;opacity:.55;filter:grayscale(.3) drop-shadow(0 2px 2px #0005)}
#kanjiMemoryScreen .mm-badge{position:absolute;right:-8px;top:-10px;width:44%;aspect-ratio:1;object-fit:contain;filter:drop-shadow(0 2px 2px #0006);animation:mm-badge .45s ease-out}
@keyframes mm-badge{from{transform:scale(0) rotate(-30deg)}to{transform:none}}
#kanjiMemoryScreen .mm-card[data-matched=true] .mm-face{border-color:#37c871;box-shadow:0 5px 0 #1f9d55}
#kanjiMemoryScreen .mm-card.mm-pair .mm-face{animation:mm-pair .45s ease-out}
#kanjiMemoryScreen .mm-card.mm-miss .mm-face{animation:mm-miss .4s ease-out}
#kanjiMemoryScreen .mm-buddy{align-self:center;width:84px;height:84px;pointer-events:none}
#kanjiMemoryScreen .mm-buddy .gt-portrait{display:block;width:100%;height:100%;background:none;border:0}
#kanjiMemoryScreen .mm-buddy .gt-portrait img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 3px 2px #0005)}
#kanjiMemoryScreen .mm-buddy.mm-cheer{animation:mm-cheer .5s ease-out}
#kanjiMemoryScreen .mm-title{margin:0;text-align:center;font-size:17px;font-weight:900;color:#ffe2b8}
#kanjiMemoryScreen .mm-left{margin:0;text-align:center;font-size:15px;font-weight:800;color:#d8e6ee}
#kanjiMemoryScreen .mm-found{margin:0;padding:10px 12px;border-radius:14px;background:#ffffff14;color:#fff;text-align:center;font-size:clamp(17px,2.2vw,22px);font-weight:800;line-height:1.5}
#kanjiMemoryScreen .mm-target{display:inline-block;margin:0 2px;padding:0 6px;border-radius:8px;background:#ffe066;color:#3a2400;font-size:1.2em;line-height:1.25}
#kanjiMemoryScreen .mm-tools{display:flex;justify-content:center;flex-wrap:wrap;gap:8px}
#kanjiMemoryScreen .mm-peek,#kanjiMemoryScreen .mm-mark{min-height:48px;padding:4px 16px;border:2px solid #ffffff55;border-radius:99px;background:#ffffff1c;color:#fff;font:inherit;font-size:16px;font-weight:900;white-space:nowrap;cursor:pointer;touch-action:manipulation}
#kanjiMemoryScreen .mm-mark[aria-pressed=true]{background:#ffe066;border-color:#fff2a0;color:#3a2400}
#kanjiMemoryScreen .mm-peek:disabled,#kanjiMemoryScreen .mm-mark:disabled{opacity:.4;cursor:default}
#kanjiMemoryScreen .mm-review{margin:0;padding:0;list-style:none;display:grid;gap:6px}
#kanjiMemoryScreen .mm-review li{padding:6px 10px;border-radius:10px;background:#eef6ef;font-weight:700}
#kanjiMemoryScreen .mm-review li[data-correct=false]{background:#fff3da}
@media (max-width:700px){#kanjiMemoryScreen .mm-buddy{display:none}#kanjiMemoryScreen .mm-board{top:90px;bottom:8px;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(4,1fr)}}
@keyframes mm-pair{0%{transform:rotateY(180deg) scale(1)}50%{transform:rotateY(180deg) scale(1.1)}100%{transform:rotateY(180deg) scale(1)}}
@keyframes mm-miss{0%,100%{transform:rotateY(180deg)}30%{transform:rotateY(180deg) translateX(-6px)}60%{transform:rotateY(180deg) translateX(5px)}}
@keyframes mm-cheer{0%,100%{transform:none}40%{transform:translateY(-14px)}}
`;
const ROUND_NAMES = Object.freeze({ reading: '漢字と読み', meaning: '漢字と意味' });

export function createMemoryView({ document: doc, dispatch, onBack, getSnapshot, cast }) {
  // Every card back shows the same Gotomon (so backs never tell pairs apart);
  // a found pair brings out a Gotomon of its own.
  const emblem = castAt(cast?.friends, 0) ?? castAt(cast?.wild, 0);
  let pairSerial = 0;
  let active = true, shownTries = 0, roundKey = null, lastSeq = -1, lastEventId = 0, lastPeeking = false, doneShown = false;
  let marking = false;
  const marks = new Set();
  const removes = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'kanjiMemoryScreen', title: '漢字カードめくり', theme: 'cards' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });

  const board = el('div', 'mm-board'); board.setAttribute('aria-label', 'カード');
  const cards = [];
  const buddy = el('div', 'mm-buddy');
  world.append(board);

  const title = el('p', 'mm-title');
  const left = el('p', 'mm-left');
  const found = el('p', 'mm-found'); found.dataset.role = 'problem';
  const tools = el('div', 'mm-tools');
  const peekButton = el('button', 'mm-peek'); peekButton.type = 'button'; peekButton.dataset.action = 'peek';
  on(peekButton, 'click', () => peek()); tools.append(peekButton);
  const markButton = el('button', 'mm-mark', '★ 目印をつける'); markButton.type = 'button'; markButton.dataset.action = 'mark';
  on(markButton, 'click', () => toggleMarking()); tools.append(markButton);
  // The shell advances after feedback; this stays hidden and only serves hosts without auto-advance.
  const go = el('button', 'mm-go', 'つぎへ'); go.type = 'button'; go.dataset.action = 'next'; go.hidden = true;
  on(go, 'click', () => proceed());
  const note = el('p', 'ya-dock-note'); note.dataset.role = 'feedback';
  dock.append(buddy, title, left, found, tools, note, go);
  const review = el('div', 'ya-learning-result'); review.hidden = true;
  const reviewList = el('ol', 'mm-review'); review.append(el('h3', '', '今回見つけたペア'), reviewList); frame.shell.append(review);
  doc.body.append(root);
  const answers = [];

  const session = () => getSnapshot();
  function flip(index) {
    const state = session(), card = state.cards?.[index];
    if (!active || state.paused || state.phase !== 'answering' || state.peeking || !card) return false;
    return dispatch({ type: 'flip', payload: { sessionId: state.sessionId, attemptId: state.attemptId, cardId: card.cardId } });
  }
  function peek() {
    const state = session();
    if (!active || state.paused || state.phase !== 'answering' || state.peeking) return false;
    marking = false;
    return dispatch({ type: 'peek', payload: { sessionId: state.sessionId } });
  }
  function toggleMarking() {
    const state = session();
    if (!active || state.paused || state.phase !== 'answering' || state.peeking) return false;
    marking = !marking;
    renderBoard(state);
    renderDock(state);
    return true;
  }
  function tapCard(index) {
    const state = session(), card = state.cards?.[index];
    if (!active || state.paused || state.phase !== 'answering' || state.peeking || !card) return false;
    if (!marking) return flip(index);
    if (state.matched.includes(card.cardId) || state.up.includes(card.cardId)) return false;
    if (marks.has(card.cardId)) marks.delete(card.cardId);
    else marks.add(card.cardId);
    renderBoard(state);
    renderDock(state);
    return true;
  }
  function proceed() {
    const state = session();
    if (!active || state.paused || state.phase !== 'feedback') return false;
    return dispatch({ type: 'next', payload: { sessionId: state.sessionId, problemId: state.problem?.problemId } });
  }

  const makeCard = index => {
    const node = el('button', 'mm-card'); node.type = 'button';
    const inner = el('span', 'mm-inner'), back = el('span', 'mm-back', emblem ? '' : '？'), face = el('span', 'mm-face');
    if (emblem) { const img = el('img'); img.alt = ''; img.src = emblem.imageUrl; back.append(img); }
    inner.append(back, face); node.append(inner);
    on(node, 'click', () => tapCard(index)); board.append(node);
    return { node, face };
  };
  const setData = (node, key, value) => { if (node.dataset[key] !== value) node.dataset[key] = value; };
  const renderBoard = state => {
    // Cards are built once per round; rebuilding during play would swallow a finger tap.
    if (roundKey !== `${state.sessionId}:${state.round}`) {
      roundKey = `${state.sessionId}:${state.round}`;
      marking = false;
      marks.clear();
      while (cards.length < state.cards.length) cards.push(makeCard(cards.length));
      cards.forEach(({ node, face }, index) => {
        const card = state.cards[index];
        node.hidden = !card; if (!card) return;
        face.textContent = card.text; node.dataset.face = card.face; node.dataset.cardId = card.cardId; delete node.dataset.badged;
      });
      found.textContent = 'ペアを見つけると、ここに漢字の使い方が出るよ';
      if (state.round > 0) { fx.banner(`ラウンド${state.round + 1} ${ROUND_NAMES[state.roundKind]}！`, 'great'); }
    }
    cards.forEach(({ node }, index) => {
      const card = state.cards[index]; if (!card) return;
      const matched = state.matched.includes(card.cardId), up = matched || state.up.includes(card.cardId) || state.peeking;
      if (matched) marks.delete(card.cardId);
      setData(node, 'up', String(up)); setData(node, 'matched', String(matched)); setData(node, 'marked', String(marks.has(card.cardId)));
      const label = up ? card.text : `うらのカード${marks.has(card.cardId) ? '、目印あり' : ''}`;
      if (node.getAttribute('aria-label') !== label) node.setAttribute('aria-label', label);
      node.disabled = matched || state.phase !== 'answering' || state.paused || state.peeking || (marking && up);
    });
  };
  const renderDock = state => {
    if (state.phase !== 'answering' || state.paused || state.peeking) marking = false;
    const titleText = `ラウンド${state.round + 1}/${state.rounds}：${ROUND_NAMES[state.roundKind] ?? ''}のペア`;
    if (title.textContent !== titleText) title.textContent = titleText;
    const leftText = `のこり ${state.pairsLeft}組`;
    if (left.textContent !== leftText) left.textContent = leftText;
    if (state.phase === 'answering') {
      const ask = state.peeking ? 'いまのうちに、場所をおぼえよう！' : marking ? '気になるカードに目印をつけよう。もう一度タップすると外せるよ' : state.up.length ? 'もう1まいめくろう' : 'カードを2まいめくって、ペアをさがそう';
      if (note.textContent !== ask) note.textContent = ask;
    }
    const peekText = `👀 のぞき見 ×${state.peeks}`;
    if (peekButton.textContent !== peekText) peekButton.textContent = peekText;
    peekButton.disabled = state.phase !== 'answering' || state.paused || state.peeking || !state.peeks;
    markButton.setAttribute('aria-pressed', String(marking));
    const markText = marking ? '✓ めくりにもどる' : '★ 目印をつける';
    if (markButton.textContent !== markText) markButton.textContent = markText;
    markButton.disabled = state.phase !== 'answering' || state.paused || state.peeking;
  };
  const showFound = (pair, kind) => {
    found.textContent = '';
    if (kind === 'reading' && pair.sentence) found.append(el('span', '', pair.sentence.before), el('span', 'mm-target', pair.kanji), el('span', '', `${pair.sentence.after}（${pair.text}）`));
    else found.append(el('span', 'mm-target', pair.kanji), el('span', '', `＝${pair.text}`));
  };
  const showAnswer = state => {
    const answer = state.lastAnswer;
    const upCards = cards.filter(({ node }) => state.up.includes(node.dataset.cardId));
    if (answer.match) {
      const pair = state.pairs.find(item => item.pairId === answer.pairId);
      if (pair) { showFound(pair, state.roundKind); answers.push({ text: `${pair.kanji}（${pair.text}）`, correct: answer.correct }); }
      upCards.forEach(({ node }) => restartClass(node, 'mm-pair'));
      const friend = castAt(cast?.wild, pairSerial++);
      if (friend) upCards.forEach(({ node, face }) => {
        if (node.dataset.badged) return;
        const img = el('img', 'mm-badge'); img.alt = ''; img.src = friend.imageUrl; face.append(img); node.dataset.badged = 'true';
      });
      restartClass(buddy, 'mm-cheer');
      fx.burst(50, 50, answer.roundDone ? 'great' : 'good', answer.roundDone ? 1.6 : 1);
      note.textContent = answer.roundDone ? 'ぜんぶそろった！' : answer.earnedPeek ? 'ペア！ 👀のぞき見がふえた！' : friend ? `ペア！ ${friend.name}が出てきた！` : 'ペア！';
    } else {
      upCards.forEach(({ node }) => restartClass(node, 'mm-miss'));
      note.textContent = 'ちがうペアだった。場所をおぼえておこう！';
    }
    frame.announce(note.textContent);
  };
  return {
    root,
    attachCompanion(portrait) { buddy.append(portrait); },
    focusPlay() { cards[0]?.node.focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      if (!state.cards?.length) return;
      renderBoard(state);
      renderDock(state);
      if (state.peeking && !lastPeeking) fx.flash('good');
      lastPeeking = state.peeking;
      if (state.seq !== lastSeq) {
        lastSeq = state.seq;
        if (state.lastAnswer && state.tries > shownTries) { shownTries = state.tries; showAnswer(state); }
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
        if (event.type === 'boost') { fx.banner('めくりの達人！', 'great'); fx.flash('great'); }
      }
      const mission = w.challenge;
      const total = (state.rounds || 1) * 6, done = state.round * 6 + (6 - (state.pairsLeft ?? 6));
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: Math.min(1, done / total), progressLabel: `ペア ${done}/${total}`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; [...cards.map(item => item.node), peekButton, markButton, go].forEach(node => { node.disabled = true; }); },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
