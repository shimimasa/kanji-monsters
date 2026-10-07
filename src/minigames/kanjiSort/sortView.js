import { createArcadeFrame, restartClass } from '../arcade/arcadeKit.js';
import { SORT_SIZES } from './sortContent.js';
import { castAt } from '../gotomonCast.js';

const MAX_CARDS = Math.max(...SORT_SIZES);
const CSS = `
#kanjiSortScreen .ya-field{background:radial-gradient(circle at 20% 15%,#fff7d6 0 12%,transparent 13%),repeating-linear-gradient(45deg,#f3dfb0 0 22px,#efd7a2 22px 44px)}
#kanjiSortScreen .ks-mat{position:absolute;left:3%;right:3%;top:64px;bottom:6%;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(10px,2vh,18px)}
#kanjiSortScreen .ks-prev{margin:0;padding:4px 12px;border-radius:10px;background:#fffdf6cc;color:#4a3a1a;font-size:clamp(12px,1.5vw,15px);font-weight:800;text-align:center}
#kanjiSortScreen .ks-prev[hidden]{display:none}
#kanjiSortScreen .ks-rule{margin:0;padding:6px 16px;border-radius:999px;background:#5b3a8c;color:#fff;font-size:clamp(17px,2.4vw,24px);font-weight:900;box-shadow:0 4px 0 #3b2560}
#kanjiSortScreen .ks-rail{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:clamp(4px,1vw,10px);width:min(100%,640px)}
#kanjiSortScreen .ks-slot{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:clamp(96px,17vh,150px);padding:6px 2px;border:3px dashed #b08a4a;border-radius:14px;background:#fffaf0aa;color:#1b2a36}
#kanjiSortScreen .ks-slot[data-filled=true]{border-style:solid;border-color:#5b3a8c;background:#fffdf6;box-shadow:0 4px 0 #c9b98f}
#kanjiSortScreen .ks-slot[data-next=true]{border-color:#ff9f1c;background:#fff3d6;animation:ks-wait 1s ease-in-out infinite alternate}
#kanjiSortScreen .ks-slot.ks-in{animation:ks-in .35s ease-out}
#kanjiSortScreen .ks-holder{position:absolute;left:50%;top:92%;width:46%;aspect-ratio:1;transform:translateX(-50%);object-fit:contain;filter:drop-shadow(0 3px 2px #0004);pointer-events:none}
#kanjiSortScreen .ks-slot[data-filled=true] .ks-holder{animation:ks-hold .5s ease-out}
#kanjiSortScreen .ks-rail[data-done=true] .ks-holder{animation:ks-hold .45s ease-in-out 3}
@keyframes ks-hold{0%,100%{transform:translateX(-50%)}45%{transform:translate(-50%,-26%) rotate(-6deg)}}
#kanjiSortScreen .ks-rail{padding-bottom:clamp(36px,8vh,64px)}
#kanjiSortScreen .ks-order{position:absolute;left:6px;top:4px;font-size:12px;font-weight:900;color:#8a6a3a}
#kanjiSortScreen .ks-slot-kanji{font-size:clamp(30px,5vw,54px);font-weight:900;line-height:1}
#kanjiSortScreen .ks-slot-label{min-height:1.3em;font-size:clamp(12px,1.6vw,16px);font-weight:900;color:#5b3a8c}
#kanjiSortScreen .ks-ends{display:flex;justify-content:space-between;width:min(100%,640px);font-size:14px;font-weight:900;color:#6b4a1a}
#kanjiSortScreen .ks-ends span:first-child::after{content:' →'}
#kanjiSortScreen .ks-ends span:last-child::before{content:'→ '}
#kanjiSortScreen .ks-buddy{position:absolute;right:2%;bottom:4%;z-index:3;width:72px;height:72px;pointer-events:none}
#kanjiSortScreen .ks-buddy .gt-portrait{display:block;width:100%;height:100%;background:none;border:0}
#kanjiSortScreen .ks-buddy .gt-portrait img{width:100%;height:100%;object-fit:contain}
#kanjiSortScreen .ks-title{margin:0;text-align:center;font-size:15px;font-weight:900;color:#e4d4ff}
#kanjiSortScreen .ks-ask{margin:0;padding:8px 12px;border-radius:14px;background:#ffffff14;color:#fff;text-align:center;font-size:clamp(16px,2vw,20px);font-weight:800;line-height:1.5}
#kanjiSortScreen .ks-ask b{display:inline-block;margin:0 2px;padding:0 6px;border-radius:8px;background:#ffe066;color:#3a2400}
#kanjiSortScreen .ks-tray{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:8px;border-radius:14px;background:#3b2560}
#kanjiSortScreen .ks-tray[data-count='4']{grid-template-columns:repeat(2,1fr)}
#kanjiSortScreen .ks-card{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:70px;padding:6px 2px;border:0;border-radius:12px;background:#fffdf6;color:#1b2a36;font:inherit;box-shadow:0 4px 0 #c9b98f;cursor:pointer;touch-action:manipulation}
#kanjiSortScreen .ks-card[hidden]{display:none}
#kanjiSortScreen .ks-card-kanji{font-size:clamp(28px,4vw,40px);font-weight:900;line-height:1}
#kanjiSortScreen .ks-card-word{font-size:13px;font-weight:700;color:#4a5e52;white-space:nowrap}
#kanjiSortScreen .ks-card-word b{color:#c0392b}
#kanjiSortScreen .ks-card-clue{display:block;padding:1px 6px;border-radius:7px;background:#e3f4e8;color:#22583b;font-size:clamp(13px,1.7vw,16px);font-weight:900;line-height:1.2}
#kanjiSortScreen .ks-card-clue[hidden]{display:none}
#kanjiSortScreen .ks-hint-toggle{align-self:center;min-height:40px;padding:5px 15px;border:2px solid #5b3a8c;border-radius:11px;background:#fffdf6;color:#4b2d77;font:inherit;font-size:clamp(14px,1.8vw,17px);font-weight:900;cursor:pointer;touch-action:manipulation}
#kanjiSortScreen .ks-hint-toggle[aria-pressed=true]{background:#dff5e7;border-color:#36865d;color:#22583b}
#kanjiSortScreen .ks-hint-toggle:focus-visible{outline:3px solid #ffd54a;outline-offset:2px}
#kanjiSortScreen .ks-hint-toggle:disabled{opacity:.7;cursor:default}
#kanjiSortScreen .ks-card:focus-visible{outline:3px solid #ffd54a;outline-offset:2px}
#kanjiSortScreen .ks-card[data-placed=true]{visibility:hidden}
#kanjiSortScreen .ks-card[data-hint=true]{background:#d7f7df;box-shadow:0 4px 0 #1f9d55,0 0 0 4px #37c871;animation:ks-glow .8s ease-in-out infinite alternate}
#kanjiSortScreen .ks-card.ks-no{animation:ks-no .45s ease-out}
#kanjiSortScreen .ks-review{margin:0;padding:0;list-style:none;display:grid;gap:6px}
#kanjiSortScreen .ks-review li{padding:6px 10px;border-radius:10px;background:#eef6ef;font-weight:700}
@media (max-width:700px){#kanjiSortScreen .ks-mat{top:92px;bottom:3%;gap:8px}#kanjiSortScreen .ks-buddy{display:none}#kanjiSortScreen .ks-slot{min-height:84px}#kanjiSortScreen .ks-card{min-height:62px}}
@keyframes ks-in{0%{transform:translateY(-14px) scale(.9)}100%{transform:none}}
@keyframes ks-wait{from{transform:none}to{transform:translateY(-3px)}}
@keyframes ks-no{0%,100%{transform:none}30%{transform:rotate(-8deg)}60%{transform:rotate(7deg)}}
@keyframes ks-glow{from{transform:none}to{transform:translateY(-3px)}}
`;
const RULES = Object.freeze({
  strokes: { rule: '画数の 少ない順', first: '少ない', last: '多い', ask: '画数がいちばん少ない漢字は どれかな？' },
  reading: { rule: '読みの あいうえお順', first: 'あ', last: 'ん', ask: '読みの最初の音が、あいうえお順で いちばん前の漢字は？' },
});
const labelOf = (kind, card) => kind === 'strokes' ? `${card.strokes}画` : card.reading;
// A reading is shown with its word, since it leaves out the okurigana (小さい → ちい).
const wordOf = card => card.word ? `${card.word.before}${card.kanji}${card.word.after}` : card.kanji;
const readingText = card => card.word ? `「${wordOf(card)}」の「${card.kanji}」は「${card.reading}」` : `「${card.kanji}」は「${card.reading}」`;

export function createSortView({ document: doc, dispatch, onBack, getSnapshot, cast }) {
  // A Gotomon waits under each place in the row and cheers when its card arrives.
  let holderSerial = 0;
  let active = true, lastSeq = -1, lastEventId = 0, puzzleKey = null, doneShown = false, shownAttempt = null, hintShown = false;
  const removes = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'kanjiSortScreen', title: '漢字ならべパズル', theme: 'sort' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });

  const mat = el('div', 'ks-mat');
  // The puzzle just finished stays in view while the next one starts.
  const prev = el('p', 'ks-prev'); prev.hidden = true;
  const rule = el('p', 'ks-rule');
  const rail = el('div', 'ks-rail'); rail.setAttribute('aria-label', 'ならべた漢字');
  const slots = Array.from({ length: MAX_CARDS }, (_, index) => {
    const node = el('div', 'ks-slot'), kanji = el('span', 'ks-slot-kanji'), label = el('span', 'ks-slot-label');
    const holder = el('img', 'ks-holder'); holder.alt = ''; holder.hidden = true;
    node.append(el('span', 'ks-order', String(index + 1)), kanji, label, holder); rail.append(node);
    return { node, kanji, label, holder, key: null };
  });
  const ends = el('div', 'ks-ends'); const firstEnd = el('span'), lastEnd = el('span'); ends.append(firstEnd, lastEnd);
  const buddy = el('div', 'ks-buddy');
  mat.append(prev, rule, rail, ends); world.append(mat, buddy);

  const title = el('p', 'ks-title');
  const ask = el('p', 'ks-ask'); ask.dataset.role = 'problem';
  const hintToggle = el('button', 'ks-hint-toggle'); hintToggle.type = 'button';
  hintToggle.dataset.action = 'sort-hint'; hintToggle.setAttribute('aria-pressed', 'false');
  const tray = el('div', 'ks-tray'); tray.setAttribute('aria-label', 'ならべる漢字');
  const cards = Array.from({ length: MAX_CARDS }, (_, index) => {
    const node = el('button', 'ks-card'); node.type = 'button'; node.dataset.index = String(index);
    on(node, 'click', () => place(index)); tray.append(node); return node;
  });
  // The shell advances after feedback; this stays hidden and only serves hosts without auto-advance.
  const go = el('button', 'ks-go', 'つぎへ'); go.type = 'button'; go.dataset.action = 'next'; go.hidden = true;
  on(go, 'click', () => proceed());
  const note = el('p', 'ya-dock-note'); note.dataset.role = 'feedback';
  dock.append(title, ask, hintToggle, tray, note, go);
  const review = el('div', 'ya-learning-result'); review.hidden = true;
  const reviewList = el('ol', 'ks-review'); review.append(el('h3', '', '今回ならべた漢字'), reviewList); frame.shell.append(review);
  doc.body.append(root);
  const finished = [];

  const session = () => getSnapshot();
  const syncHint = kind => {
    hintToggle.textContent = hintShown ? 'ヒントを とじる' : kind === 'reading' ? '読みを 見る' : '画数を 見る';
    hintToggle.setAttribute('aria-pressed', String(hintShown));
    const state = session();
    cards.forEach((node, index) => {
      const clue = node.querySelector('.ks-card-clue');
      if (clue) clue.hidden = !hintShown;
      const card = state.cards?.[index];
      if (card) {
        const label = card.word ? `「${wordOf(card)}」の「${card.kanji}」` : `「${card.kanji}」`;
        node.setAttribute('aria-label', hintShown ? `${label}、${kind === 'reading' ? '読み' : '画数'} ${labelOf(kind, card)}` : label);
      }
    });
  };
  on(hintToggle, 'click', () => {
    const state = session();
    if (!active || state.paused || state.phase !== 'answering') return;
    hintShown = !hintShown;
    syncHint(state.kind);
  });
  function place(index) {
    const state = session(), card = state.cards?.[index];
    if (!active || state.paused || state.phase !== 'answering' || !card || state.placed.includes(card.cardId)) return false;
    return dispatch({ type: 'place', payload: { sessionId: state.sessionId, attemptId: state.attemptId, cardId: card.cardId } });
  }
  function proceed() {
    const state = session();
    if (!active || state.paused || state.phase !== 'feedback') return false;
    return dispatch({ type: 'next', payload: { sessionId: state.sessionId, problemId: state.problem?.problemId } });
  }

  // Card contents change only when a new puzzle starts, never during a tap.
  const renderPuzzle = state => {
    if (puzzleKey === state.puzzleId) return;
    puzzleKey = state.puzzleId;
    hintShown = false;
    const text = RULES[state.kind];
    rule.textContent = text.rule; firstEnd.textContent = text.first; lastEnd.textContent = text.last;
    // A clue about a wrong card stays until the next tap; a new puzzle starts clean.
    if (state.placed.length === 0) note.textContent = '';
    cards.forEach((node, index) => {
      const card = state.cards[index];
      node.hidden = !card; node.textContent = ''; node.dataset.placed = 'false'; node.dataset.hint = 'false';
      if (!card) return;
      node.dataset.cardId = card.cardId;
      node.append(el('span', 'ks-card-kanji', card.kanji));
      if (card.word) {
        const word = el('span', 'ks-card-word');
        word.append(el('span', '', card.word.before), el('b', '', card.kanji), el('span', '', card.word.after));
        node.append(word);
      }
      const clue = el('span', 'ks-card-clue', labelOf(state.kind, card));
      clue.hidden = true; node.append(clue);
      node.setAttribute('aria-label', card.word ? `「${wordOf(card)}」の「${card.kanji}」` : `「${card.kanji}」`);
    });
    slots.forEach((slot, index) => {
      slot.node.hidden = index >= state.cards.length; slot.key = null;
      slot.kanji.textContent = ''; slot.label.textContent = '';
      const who = castAt(cast?.wild, holderSerial * 5 + index);
      slot.holder.hidden = !who; if (who) slot.holder.src = who.imageUrl;
    });
    tray.dataset.count = String(state.cards.length); rail.dataset.done = 'false'; holderSerial++;
    syncHint(state.kind);
  };
  const renderRow = state => {
    const byId = new Map(state.cards.map(card => [card.cardId, card]));
    slots.forEach((slot, index) => {
      if (slot.node.hidden) return;
      const card = byId.get(state.placed[index]) ?? null, key = card?.cardId ?? null;
      if (slot.key !== key) {
        slot.key = key;
        slot.kanji.textContent = card?.kanji ?? ''; slot.label.textContent = card ? labelOf(state.kind, card) : '';
        if (card) restartClass(slot.node, 'ks-in');
      }
      const filled = String(!!card), next = String(!card && index === state.placed.length && state.phase === 'answering');
      if (slot.node.dataset.filled !== filled) slot.node.dataset.filled = filled;
      if (slot.node.dataset.next !== next) slot.node.dataset.next = next;
    });
    cards.forEach(node => {
      if (node.hidden) return;
      const placed = String(state.placed.includes(node.dataset.cardId));
      const hint = String(state.phase === 'answering' && state.hintCardId === node.dataset.cardId);
      if (node.dataset.placed !== placed) node.dataset.placed = placed;
      if (node.dataset.hint !== hint) node.dataset.hint = hint;
      node.disabled = state.phase !== 'answering' || state.paused || placed === 'true';
    });
  };
  const renderDock = state => {
    const titleText = state.phase === 'completed' ? '' : `パズル ${state.puzzle + 1}/${state.puzzles} · ⭐${state.stars}`;
    if (title.textContent !== titleText) title.textContent = titleText;
    hintToggle.hidden = state.phase === 'completed';
    hintToggle.disabled = state.paused || state.phase !== 'answering';
    if (state.phase === 'answering') {
      const text = state.hintCardId ? '光っているカードが、つぎに入るよ' : state.placed.length ? `${state.placed.length + 1}ばんめに入る漢字は どれかな？` : RULES[state.kind].ask;
      if (ask.textContent !== text) ask.textContent = text;
    }
  };
  const showAnswer = state => {
    const answer = state.lastAnswer;
    const node = cards.find(item => item.dataset.cardId === answer.choiceId);
    if (answer.correct) {
      note.textContent = answer.finished ? `かんせい！ ${'⭐'.repeat(answer.stars)}` : `${answer.kind === 'strokes' ? `「${answer.kanji}」は ${answer.strokes}画` : readingText(answer)}。ぴったり！`;
      const at = ((state.placed.length - 0.5) / state.cards.length) * 100;
      fx.burst(Math.max(10, Math.min(90, at)), 45, answer.finished ? 'great' : 'good', answer.finished ? 1.5 : 1);
      if (answer.finished) {
        fx.banner('かんせい！', 'great'); rail.dataset.done = 'true';
        const row = [...state.cards].sort((a, b) => a.rank - b.rank).map(card => state.kind === 'strokes' ? `${card.kanji}（${card.strokes}画）` : `${wordOf(card)}（${card.reading}）`).join(' → ');
        finished.push(`${RULES[state.kind].rule}：${row}`);
        prev.textContent = `さっきのパズル ✓ ${row}`; prev.hidden = false;
      }
    } else {
      if (node) restartClass(node, 'ks-no');
      note.textContent = answer.kind === 'strokes'
        ? `「${answer.kanji}」は ${answer.strokes}画。もっと画数の少ない漢字があるよ`
        : `${readingText(answer)}。「${answer.reading[0]}」より前の音の漢字があるよ`;
    }
    frame.announce(note.textContent);
  };

  return {
    root,
    attachCompanion(portrait) { buddy.append(portrait); },
    focusPlay() { cards[0].focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      if (!state.cards?.length && !state.result) return;
      if (state.cards?.length) { renderPuzzle(state); renderRow(state); }
      renderDock(state);
      if (state.seq !== lastSeq) {
        lastSeq = state.seq;
        if (state.lastAnswer && state.lastAnswer.attemptId !== shownAttempt) { shownAttempt = state.lastAnswer.attemptId; showAnswer(state); }
      }
      if (state.result && !doneShown) {
        doneShown = true; review.hidden = false; reviewList.textContent = '';
        for (const text of finished) reviewList.append(el('li', '', text));
      }
    },
    present(play, dt, state) {
      if (!active || !state) return;
      frame.tick(dt);
      const w = play.world || {};
      const event = w.lastEvent;
      if (event && event.id !== lastEventId) {
        lastEventId = event.id;
        if (event.type === 'boost') { fx.banner('ならべ名人！', 'great'); fx.flash('great'); }
      }
      const mission = w.challenge;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: Math.min(1, (state.solved ?? 0) / (state.puzzles || 1)), progressLabel: `パズル ${state.solved ?? 0}/${state.puzzles ?? 0}`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; [...cards, hintToggle, go].forEach(node => { node.disabled = true; }); },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
