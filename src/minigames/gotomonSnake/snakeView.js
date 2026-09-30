import { createArcadeFrame, bindArcadeKeys } from '../arcade/arcadeKit.js';
import { castAt } from '../gotomonCast.js';
import { SNAKE_RULES as R } from './snakeGame.js';
import Speech from '../../audio/speech.js';

const px = c => `${((c + 0.5) / R.columns * 100).toFixed(3)}%`;
const py = r => `${((r + 0.5) / R.rows * 100).toFixed(3)}%`;
const CSS = `
#gotomonSnakeScreen .ya-field{background:linear-gradient(#a8e0a0,#7cc46e)}
#gotomonSnakeScreen .sn-board{position:absolute;left:50%;top:58px;bottom:1.5%;aspect-ratio:${R.columns}/${R.rows};max-width:97%;transform:translateX(-50%);border-radius:14px;background:repeating-conic-gradient(#9ed493 0 25%,#92cc86 0 50%) 0 0/${(200 / R.columns).toFixed(3)}% ${(200 / R.rows).toFixed(3)}%;box-shadow:inset 0 0 0 3px #5fa855;touch-action:none;cursor:pointer}
#gotomonSnakeScreen .sn-cell{position:absolute;width:${(100 / R.columns * 0.9).toFixed(3)}%;aspect-ratio:1;transform:translate(-50%,-50%);display:grid;place-items:center;pointer-events:none;transition:left .18s linear,top .18s linear}
#gotomonSnakeScreen .sn-cell[data-jump=true]{transition:none}
#gotomonSnakeScreen .sn-head{z-index:4}
#gotomonSnakeScreen .sn-head .gt-portrait{display:block;width:120%;height:120%;background:none;border:0}
#gotomonSnakeScreen .sn-head .gt-portrait img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 3px 2px #0005)}
#gotomonSnakeScreen .sn-body{z-index:3;border-radius:12px;background:#ffe066;color:#3a2400;font-weight:900;font-size:clamp(16px,min(2.6vw,3.6vh),28px);box-shadow:0 3px 0 #c9951a}
#gotomonSnakeScreen .sn-token{z-index:2}
#gotomonSnakeScreen .sn-token img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:.85}
#gotomonSnakeScreen .sn-token b{position:relative;z-index:1;min-width:58%;padding:1px 6px;border-radius:10px;background:#fffdf6;color:#1b2a36;border:3px solid #3574b6;font-size:clamp(16px,min(2.6vw,3.6vh),28px);line-height:1.1;text-align:center;box-shadow:0 3px 0 #0003;transform:translateY(24%)}
#gotomonSnakeScreen .sn-token[data-hint=true] b{border-color:#37c871;box-shadow:0 3px 0 #1f9d55,0 0 0 4px #37c871aa;animation:sn-glow .7s ease-in-out infinite alternate}
#gotomonSnakeScreen .sn-meaning{display:flex;align-items:center;justify-content:center;gap:10px;margin:0;color:#fff;font-size:clamp(22px,3vw,30px);font-weight:900}
#gotomonSnakeScreen .sn-say{min-width:44px;min-height:44px;border:0;border-radius:50%;background:#ffe066;font-size:20px;cursor:pointer}
#gotomonSnakeScreen .sn-word{display:flex;justify-content:center;gap:4px;margin:0;padding:8px;border-radius:14px;background:#ffffff14}
#gotomonSnakeScreen .sn-word span{min-width:1.3em;padding:2px 4px;border-radius:8px;background:#ffffff22;color:#ffffff88;font-size:clamp(24px,3.4vw,34px);font-weight:900;text-align:center;font-family:ui-rounded,'Segoe UI',system-ui,sans-serif}
#gotomonSnakeScreen .sn-word span[data-state=done]{background:#ffe066;color:#3a2400}
#gotomonSnakeScreen .sn-word span[data-state=next]{background:#fff;color:#1b2a36;box-shadow:0 0 0 3px #37c871}
#gotomonSnakeScreen .sn-pad{display:grid;grid-template-columns:repeat(3,56px);grid-template-rows:repeat(2,48px);gap:6px;justify-content:center}
#gotomonSnakeScreen .sn-pad button{border:0;border-radius:12px;background:#fffaf0;color:#3a2400;font:inherit;font-size:20px;font-weight:900;box-shadow:0 4px 0 #d9b98f;cursor:pointer;touch-action:manipulation}
#gotomonSnakeScreen .sn-pad [data-to=up]{grid-column:2;grid-row:1}
#gotomonSnakeScreen .sn-pad [data-to=left]{grid-column:1;grid-row:2}
#gotomonSnakeScreen .sn-pad [data-to=down]{grid-column:2;grid-row:2}
#gotomonSnakeScreen .sn-pad [data-to=right]{grid-column:3;grid-row:2}
#gotomonSnakeScreen .sn-pad button[data-on=true]{background:#ffe066}
#gotomonSnakeScreen .sn-review{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px}
#gotomonSnakeScreen .sn-review li{padding:6px 10px;border-radius:10px;background:#eef6ef;font-weight:700}
#gotomonSnakeScreen .sn-review li[data-correct=false]{background:#fff3da}
@media (max-width:700px){#gotomonSnakeScreen .sn-board{top:86px}#gotomonSnakeScreen .sn-pad{grid-template-rows:repeat(2,42px)}}
@keyframes sn-glow{from{transform:translateY(24%)}to{transform:translateY(10%)}}
`;

export function createSnakeView({ document: doc, dispatch, onBack, getSnapshot, cast }) {
  let active = true, lastEventId = 0, doneShown = false, shownDone = 0, shownSlip = 0, wordKey = null, tokenSerial = 0;
  const removes = [], answers = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'gotomonSnakeScreen', title: 'スペルスネーク', theme: 'snake' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });

  const board = el('div', 'sn-board'); board.setAttribute('aria-label', 'スネークの原っぱ');
  const head = el('div', 'sn-cell sn-head'); board.append(head); world.append(board);
  const bodyNodes = [], tokenNodes = new Map();
  let headAt = null;

  const meaning = el('p', 'sn-meaning'); meaning.dataset.role = 'problem';
  const meaningText = el('span'), say = el('button', 'sn-say', '🔊'); say.type = 'button'; say.setAttribute('aria-label', '英語を聞く');
  meaning.append(meaningText, say);
  on(say, 'click', () => { const w = getSnapshot().word?.word; if (active && w) Speech.speakEnglish(w); });
  const wordRow = el('p', 'sn-word');
  const pad = el('div', 'sn-pad');
  const arrows = [['up', '▲'], ['left', '◀'], ['down', '▼'], ['right', '▶']].map(([to, text]) => {
    const node = el('button', '', text); node.type = 'button'; node.dataset.to = to; node.setAttribute('aria-label', { up: '上', left: '左', down: '下', right: '右' }[to]);
    on(node, 'click', () => turn(to)); pad.append(node); return node;
  });
  // The shell advances after feedback; this stays hidden and only serves hosts without auto-advance.
  const go = el('button', 'sn-go', 'つぎへ'); go.type = 'button'; go.dataset.action = 'next'; go.hidden = true;
  const note = el('p', 'ya-dock-note'); note.dataset.role = 'feedback';
  dock.append(meaning, wordRow, pad, note, go);
  const review = el('div', 'ya-learning-result'); review.hidden = true;
  const reviewList = el('ol', 'sn-review'); review.append(el('h3', '', '今回つづった英単語'), reviewList); frame.shell.append(review);
  doc.body.append(root);

  const session = () => getSnapshot();
  function turn(to) {
    const state = session();
    if (!active || state.paused || state.phase !== 'answering') return false;
    return dispatch({ type: 'turn', payload: { sessionId: state.sessionId, attemptId: state.attemptId, to } });
  }
  // A tap turns the snake toward the tapped square.
  on(board, 'pointerdown', event => {
    const state = session(), box = board.getBoundingClientRect?.();
    if (!state.snake?.length || !box?.width || !Number.isFinite(event?.clientX)) return;
    const c = (event.clientX - box.left) / box.width * R.columns - 0.5, r = (event.clientY - box.top) / box.height * R.rows - 0.5;
    const dc = c - state.snake[0].c, dr = r - state.snake[0].r;
    if (Math.abs(dc) < 0.5 && Math.abs(dr) < 0.5) return;
    turn(Math.abs(dc) >= Math.abs(dr) ? (dc > 0 ? 'right' : 'left') : (dr > 0 ? 'down' : 'up'));
  });
  removes.push(bindArcadeKeys(doc, event => {
    const to = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[event.key];
    return to ? turn(to) : false;
  }));

  const put = (node, c, r) => {
    // A step across the wrapping edge jumps instead of sliding over the board.
    const last = node.dataset.at?.split(',').map(Number);
    const jump = last && (Math.abs(last[0] - c) > 1 || Math.abs(last[1] - r) > 1);
    if (node.dataset.jump !== String(!!jump)) node.dataset.jump = String(!!jump);
    node.dataset.at = `${c},${r}`; node.style.left = px(c); node.style.top = py(r);
  };
  const renderBoard = state => {
    const [h, ...body] = state.snake;
    put(head, h.c, h.r); headAt = h;
    while (bodyNodes.length < body.length) { const node = el('div', 'sn-cell sn-body'); board.append(node); bodyNodes.push(node); }
    bodyNodes.forEach((node, i) => {
      const seg = body[i]; node.hidden = !seg; if (!seg) return;
      if (node.textContent !== seg.letter) node.textContent = seg.letter;
      put(node, seg.c, seg.r);
    });
    const live = new Set(state.tokens.map(token => token.tokenId));
    for (const [id, node] of tokenNodes) if (!live.has(id)) { node.remove(); tokenNodes.delete(id); }
    for (const token of state.tokens) {
      let node = tokenNodes.get(token.tokenId);
      if (!node) {
        node = el('div', 'sn-cell sn-token'); const who = castAt(cast?.wild, tokenSerial++);
        if (who) { const img = el('img'); img.alt = ''; img.src = who.imageUrl; node.append(img); }
        node.append(el('b', '', token.letter)); board.append(node); tokenNodes.set(token.tokenId, node);
        node.style.left = px(token.c); node.style.top = py(token.r);
      }
      const hint = String(state.hintTokenId === token.tokenId);
      if (node.dataset.hint !== hint) node.dataset.hint = hint;
    }
    arrows.forEach(node => { const onIt = String(node.dataset.to === state.direction); if (node.dataset.on !== onIt) node.dataset.on = onIt; node.disabled = state.paused || state.phase !== 'answering'; });
  };
  const renderWord = state => {
    const word = state.word;
    if (!word) return;
    if (wordKey !== word.contentId) {
      wordKey = word.contentId; meaningText.textContent = `「${word.meaning}」`;
      wordRow.textContent = ''; [...word.word].forEach(letter => wordRow.append(el('span', '', letter)));
      note.textContent = '光っている順に、文字を食べよう';
      Speech.speakEnglish(word.word);
    }
    [...wordRow.children].forEach((node, i) => {
      const stateText = i < state.spelled ? 'done' : i === state.spelled ? 'next' : 'rest';
      if (node.dataset.state !== stateText) node.dataset.state = stateText;
    });
  };
  const showDone = state => {
    const answer = state.lastAnswer;
    fx.banner(`${answer.word}！`, 'great');
    fx.burst(headAt ? (headAt.c + 0.5) / R.columns * 100 : 50, headAt ? (headAt.r + 0.5) / R.rows * 100 : 50, answer.first ? 'great' : 'good', 1.3);
    note.textContent = `できた！ ${answer.word} ＝ ${answer.meaning}`;
    Speech.speakEnglish(answer.word);
    answers.push({ text: `${answer.word} ＝ ${answer.meaning}`, correct: answer.first && answer.wrongs === 0 });
    frame.announce(note.textContent);
  };
  const showSlip = state => {
    const slip = state.lastSlip;
    fx.pop((slip.c + 0.5) / R.columns * 100, (slip.r + 0.5) / R.rows * 100 - 6, slip.letter, 'soft');
    note.textContent = `それは「${slip.letter}」。つぎは「${slip.expected}」だよ。光っている文字をさがそう`;
    frame.announce(note.textContent);
  };

  return {
    root,
    attachCompanion(portrait) { head.append(portrait); },
    focusPlay() { arrows[3].focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      if (!state.snake?.length) return;
      if (!state.result) { renderBoard(state); renderWord(state); }
      if (state.lastSlip && state.lastSlip.slip !== shownSlip) { shownSlip = state.lastSlip.slip; showSlip(state); }
      if (state.lastAnswer && state.lastAnswer.done !== shownDone) { shownDone = state.lastAnswer.done; showDone(state); }
      if (state.result && !doneShown) {
        doneShown = true; review.hidden = false; reviewList.textContent = '';
        for (const item of answers) { const row = el('li', '', `${item.correct ? '✓' : '☆'} ${item.text}`); row.dataset.correct = String(item.correct); reviewList.append(row); }
      }
    },
    present(play, dt, state) {
      if (!active || !state) return;
      frame.tick(dt);
      const w = play.world || {};
      const event = w.lastEvent;
      if (event && event.id !== lastEventId) {
        lastEventId = event.id;
        if (event.type === 'boost') { fx.banner('スペルフィーバー！', 'great'); fx.flash('great'); }
      }
      const mission = w.challenge;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: Math.min(1, (state.wordIndex + (state.phase === 'feedback' ? 1 : 0)) / (state.total || 1)), progressLabel: `たんご ${state.wordIndex + (state.phase === 'feedback' ? 1 : 0)}/${state.total ?? 0}`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; Speech.cancel(); [...arrows, say, go].forEach(node => { node.disabled = true; }); },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
