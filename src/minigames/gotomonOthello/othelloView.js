import { createArcadeFrame, restartClass, bindArcadeKeys } from '../arcade/arcadeKit.js';
import { castAt } from '../gotomonCast.js';
import Speech from '../../audio/speech.js';
import { OTHELLO_RULES as R, flipsFor } from './othelloGame.js';

const N = R.size, CELL = 100 / N;
const CSS = `
#gotomonOthelloScreen .ya-field{background:radial-gradient(circle at 20% 20%,#ffffff14 0 8%,transparent 9%),linear-gradient(#1f4d3a,#163a2c)}
#gotomonOthelloScreen .ot-board{position:absolute;left:50%;top:58px;bottom:2%;aspect-ratio:1;max-width:72%;transform:translateX(-50%);border-radius:14px;background:#2f8f5b;box-shadow:0 6px 0 #1d5e3a,inset 0 0 0 4px #1d5e3a;z-index:2}
#gotomonOthelloScreen .ot-cell{position:absolute;width:${CELL}%;height:${CELL}%;display:grid;place-items:center;padding:0;border:0;border-right:2px solid #1d5e3a;border-bottom:2px solid #1d5e3a;background:transparent;font:inherit;cursor:default;touch-action:manipulation}
#gotomonOthelloScreen .ot-cell[data-legal=true]{cursor:pointer}
#gotomonOthelloScreen .ot-cell[data-legal=true]::after{content:attr(data-turns);display:grid;place-items:center;width:42%;height:42%;border-radius:50%;background:#ffe06655;color:#fff;font-size:clamp(11px,1.6vh,15px);font-weight:900;box-shadow:0 0 0 3px #ffe066aa;animation:ot-glow 1s ease-in-out infinite alternate}
#gotomonOthelloScreen .ot-cell[data-preview=true]{background:#ffe06645;box-shadow:inset 0 0 0 3px #ffe066}
#gotomonOthelloScreen .ot-cell[data-will-flip=true] .ot-stone{box-shadow:0 0 0 3px #ffe066,0 4px 0 #0005}
#gotomonOthelloScreen .ot-stone{width:80%;height:80%;border-radius:50%;display:grid;place-items:center;font-size:clamp(14px,3vh,26px);font-weight:900;box-shadow:0 4px 0 #0005,inset 0 -4px 0 #0002;pointer-events:none}
#gotomonOthelloScreen .ot-stone[data-owner=me]{background:radial-gradient(circle at 35% 30%,#fff7c2,#ffd34d 60%,#e0a91e);color:#fff}
#gotomonOthelloScreen .ot-stone[data-owner=star]{background:radial-gradient(circle at 35% 30%,#fff,#ffe066 55%,#f2a900);color:#fff;text-shadow:0 1px 2px #b36b00;box-shadow:0 0 0 3px #fff,0 4px 0 #0005}
#gotomonOthelloScreen .ot-stone[data-owner=rival]{background:radial-gradient(circle at 35% 30%,#c9a8ff,#7b4fd1 60%,#4b2a8f)}
#gotomonOthelloScreen .ot-stone.ot-flip{animation:ot-flip .4s ease-in-out}
#gotomonOthelloScreen .ot-stone.ot-new{animation:ot-new .3s ease-out}
#gotomonOthelloScreen .ot-side{position:absolute;display:flex;flex-direction:column;align-items:center;gap:2px;width:13%;min-width:64px;color:#fff;font-weight:900;text-align:center;z-index:3}
#gotomonOthelloScreen .ot-side img,#gotomonOthelloScreen .ot-side .ot-face>*{width:100%!important;height:auto!important;max-height:90px;object-fit:contain}
#gotomonOthelloScreen .ot-side b{font-size:clamp(20px,3vw,32px)}
#gotomonOthelloScreen .ot-side small{font-size:12px;opacity:.9}
#gotomonOthelloScreen .ot-side i{display:inline-block;width:14px;height:14px;border-radius:50%;vertical-align:-2px;margin-right:4px}
#gotomonOthelloScreen .ot-side[data-turn=true]{filter:drop-shadow(0 0 8px #ffe066)}
#gotomonOthelloScreen .ot-me{left:2%;bottom:4%}
#gotomonOthelloScreen .ot-rival{right:2%;top:64px}
#gotomonOthelloScreen .ot-title{margin:0;text-align:center;font-size:14px;font-weight:900;color:#c8f0d8}
#gotomonOthelloScreen .ot-prompt{margin:0;padding:8px 12px;border-radius:14px;background:#ffffff14;color:#fff;text-align:center;font-size:clamp(20px,2.8vw,28px);font-weight:900;line-height:1.3}
#gotomonOthelloScreen .ot-prompt small{display:block;margin-top:4px;font-size:15px;font-weight:700;color:#d4f0e0}
#gotomonOthelloScreen .ot-prompt small b{color:#ffe066}
#gotomonOthelloScreen .ot-choices{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
#gotomonOthelloScreen .ot-choice{min-height:60px;border:0;border-radius:14px;background:#fffdf6;color:#1b2a36;font:inherit;font-size:clamp(18px,2.4vw,26px);font-weight:900;box-shadow:0 4px 0 #1d5e3a;cursor:pointer;touch-action:manipulation}
#gotomonOthelloScreen .ot-plan{margin:0;text-align:center;color:#fff2bd;font-size:15px;font-weight:800}
#gotomonOthelloScreen .ot-confirm{min-height:52px;border:0;border-radius:14px;background:#ffe066;color:#26402e;font:inherit;font-size:20px;font-weight:900;cursor:pointer;touch-action:manipulation}
#gotomonOthelloScreen .ot-confirm:disabled{opacity:.5;cursor:default}
#gotomonOthelloScreen .ot-star{margin:0;text-align:center;color:#ffe066;font-size:13px;font-weight:900}
@media (max-width:700px){
  #gotomonOthelloScreen .ot-side{width:27%;min-width:0}
  #gotomonOthelloScreen .ot-me{left:12%;bottom:15%}
  #gotomonOthelloScreen .ot-rival{right:12%;top:auto;bottom:15%}
}
@keyframes ot-glow{from{transform:scale(.9)}to{transform:scale(1.05)}}
@keyframes ot-flip{0%{transform:rotateY(0)}50%{transform:rotateY(90deg)}100%{transform:rotateY(0)}}
@keyframes ot-new{0%{transform:scale(.3)}100%{transform:none}}
`;

export function createOthelloView({ document: doc, dispatch, onBack, getSnapshot, cast }) {
  let active = true, lastEventId = 0, doneShown = false, shownAnswer = 0, shownMove = 0, shownPass = 0, problemKey = null, preview = null;
  const removes = [], cells = [], stones = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'gotomonOthelloScreen', title: '漢字オセロ', theme: 'othello' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });

  const board = el('div', 'ot-board'); board.setAttribute('aria-label', 'オセロのばん');
  for (let row = 0; row < N; row++) for (let column = 0; column < N; column++) {
    const cell = el('button', 'ot-cell'); cell.type = 'button';
    cell.style.left = `${column * CELL}%`; cell.style.top = `${row * CELL}%`;
    cell.setAttribute('aria-label', `${row + 1}行 ${column + 1}列`);
    on(cell, 'click', () => chooseMove(row, column));
    board.append(cell); cells.push(cell); stones.push(null);
  }
  const rival = castAt(cast?.wild, 0);
  const meSide = el('div', 'ot-side ot-me'), meFace = el('div', 'ot-face'), meCount = el('b');
  meSide.append(meFace, meCount, el('small', '', 'きみ'));
  const rivalSide = el('div', 'ot-side ot-rival'), rivalCount = el('b');
  if (rival) { const img = el('img'); img.alt = ''; img.src = rival.imageUrl; rivalSide.append(img); }
  rivalSide.append(rivalCount, el('small', '', rival ? rival.name : 'あいて'));
  world.append(board, meSide, rivalSide);

  const title = el('p', 'ot-title');
  const prompt = el('p', 'ot-prompt'); prompt.dataset.role = 'problem';
  const choices = el('div', 'ot-choices'), choiceButtons = [];
  for (let i = 0; i < 4; i++) {
    const button = el('button', 'ot-choice'); button.type = 'button';
    on(button, 'click', () => answer(button.dataset.choice)); choices.append(button); choiceButtons.push(button);
  }
  const starLine = el('p', 'ot-star');
  const plan = el('p', 'ot-plan');
  const confirm = el('button', 'ot-confirm', 'ここに おく'); confirm.type = 'button';
  on(confirm, 'click', () => confirmMove());
  const note = el('p', 'ya-dock-note'); note.dataset.role = 'feedback';
  dock.append(title, prompt, choices, plan, confirm, starLine, note);
  doc.body.append(root);

  function answer(choiceId) {
    const state = getSnapshot();
    if (!active || state.paused || state.phase !== 'answering' || !choiceId) return false;
    return dispatch({ type: 'answer', payload: { sessionId: state.sessionId, attemptId: state.attemptId, choiceId } });
  }
  function place(row, column) {
    const state = getSnapshot();
    if (!active || state.paused || state.phase !== 'placing') return false;
    return dispatch({ type: 'place', payload: { sessionId: state.sessionId, attemptId: state.attemptId, row, column } });
  }
  function confirmMove() {
    const state = getSnapshot();
    if (!preview || preview.attemptId !== state.attemptId || state.phase !== 'placing') return false;
    const { row, column } = preview;
    preview = null;
    return place(row, column);
  }
  function chooseMove(row, column) {
    const state = getSnapshot();
    if (!active || state.paused || state.phase !== 'placing' || !state.legal.some(move => move.row === row && move.column === column)) return false;
    if (preview?.attemptId === state.attemptId && preview.row === row && preview.column === column) return confirmMove();
    preview = { attemptId: state.attemptId, row, column };
    renderBoard(state); renderDock(state);
    return true;
  }
  removes.push(bindArcadeKeys(doc, event => {
    const k = ['1', '2', '3', '4'].indexOf(event.key);
    return k >= 0 ? answer(choiceButtons[k]?.dataset.choice) : false;
  }));

  const renderBoard = state => {
    const legal = new Map(state.legal.map(move => [move.row * N + move.column, move.turns]));
    const planned = preview && state.phase === 'placing' && preview.attemptId === state.attemptId ? preview : null;
    const flipSet = new Set(planned ? flipsFor(state.board, planned.row, planned.column, 'me', N) : []);
    state.board.forEach((owner, index) => {
      const cell = cells[index];
      if (owner && !stones[index]) { const stone = el('div', 'ot-stone'); cell.append(stone); stones[index] = stone; restartClass(stone, 'ot-new'); }
      const stone = stones[index];
      if (stone && stone.dataset.owner !== owner) {
        if (stone.dataset.owner && owner) restartClass(stone, 'ot-flip');
        stone.dataset.owner = owner; stone.textContent = owner === 'star' ? '★' : '';
      }
      const isLegal = legal.has(index);
      if (cell.dataset.legal !== String(isLegal)) cell.dataset.legal = String(isLegal);
      if (isLegal) cell.dataset.turns = String(legal.get(index)); else delete cell.dataset.turns;
      const isPreview = String(!!planned && index === planned.row * N + planned.column);
      const willFlip = String(flipSet.has(index));
      if (cell.dataset.preview !== isPreview) cell.dataset.preview = isPreview;
      if (cell.dataset.willFlip !== willFlip) cell.dataset.willFlip = willFlip;
      const placeName = `${Math.floor(index / N) + 1}行 ${index % N + 1}列`;
      const ariaLabel = isLegal
        ? `${placeName}、${legal.get(index)}まい ひっくり返る${cell.dataset.preview === 'true' ? '、ここをもう一度押すと置く' : ''}`
        : `${placeName}、${owner === 'star' ? 'ほしの石' : owner === 'me' ? 'きみの石' : owner === 'rival' ? 'あいての石' : '空きマス'}`;
      if (cell.getAttribute?.('aria-label') !== ariaLabel) cell.setAttribute('aria-label', ariaLabel);
      cell.disabled = !isLegal;
    });
    meCount.textContent = String(state.mine); rivalCount.textContent = String(state.theirs);
    meSide.dataset.turn = String(state.turn === 'me'); rivalSide.dataset.turn = String(state.turn === 'rival');
  };
  const renderDock = state => {
    choices.hidden = state.phase !== 'answering';
    const planned = preview && state.phase === 'placing' && preview.attemptId === state.attemptId ? preview : null;
    plan.hidden = confirm.hidden = state.phase !== 'placing';
    confirm.disabled = !planned || state.paused;
    const planText = planned ? `${planned.row + 1}行 ${planned.column + 1}列なら ${state.legal.find(move => move.row === planned.row && move.column === planned.column)?.turns ?? 0}まい ひっくり返るよ。ほかのマスも見てみよう` : '光るマスを選んで、ひっくり返る石を見てみよう';
    if (plan.textContent !== planText) plan.textContent = planText;
    const key = `${state.phase}:${state.problem?.problemId ?? ''}`;
    if (key !== problemKey) {
      problemKey = key;
      if (state.phase === 'answering') {
        prompt.textContent = state.problem.prompt;
        if (state.problem.sentence) { const small = el('small'); small.append(el('span', '', state.problem.sentence.before), el('b', '', state.problem.prompt.match(/「(.+?)」/)?.[1] ?? ''), el('span', '', state.problem.sentence.after)); prompt.append(small); }
        state.problem.choices.forEach((choice, i) => { choiceButtons[i].textContent = choice.text; choiceButtons[i].dataset.choice = choice.choiceId; });
        const word = state.problem.kind === 'en2ja' ? state.problem.prompt.split(' ')[0] : null;
        if (word) Speech.speakEnglish(word);
      } else prompt.textContent = state.phase === 'placing' ? 'どこに 石をおこうかな？' : state.phase === 'rival' ? `${rival?.name ?? 'あいて'}の番…` : state.phase === 'completed' ? 'おしまい！' : '';
    }
    const left = state.starEvery - (state.streak % state.starEvery);
    const starText = state.phase === 'completed' ? '' : state.starNext ? '★ こんどの石は「ほしの石」！ ひっくり返されないよ' : `あと${left}問 れんぞく正解で「ほしの石」`;
    if (starLine.textContent !== starText) starLine.textContent = starText;
    const titleText = state.phase === 'completed' ? '' : `もんだい ${Math.min(state.answered + (state.phase === 'answering' ? 1 : 0), state.maxQuestions)}/${state.maxQuestions}`;
    if (title.textContent !== titleText) title.textContent = titleText;
  };
  const showAnswer = state => {
    const a = state.lastAnswer;
    if (a.correct) { fx.pop(50, 45, 'せいかい！', 'good'); note.textContent = `せいかい！ ${a.explain}`; }
    else {
      note.textContent = `おしい！ 答えは「${a.answerText}」（「${a.chosen}」${a.note ? `は${a.note}` : 'ではないよ'}）。こんどは あいての番`;
      frame.announce(note.textContent);
    }
  };
  const showMove = state => {
    const move = state.lastMove;
    if (move.by === 'me' && move.flipped.length) {
      fx.pop(50, 40, `${move.flipped.length}まい ひっくり返した！`, 'great');
      if (move.flipped.length >= 3) fx.burst(50, 50, 'great', 1.2);
    }
  };
  const showPass = state => {
    const pass = state.lastPass;
    note.textContent = pass.by === 'me' ? 'おけるマスがないので、パス！' : `${rival?.name ?? 'あいて'}は おけるマスがなくて パス！`;
    frame.announce(note.textContent);
  };

  return {
    root,
    attachCompanion(portrait) { meFace.append(portrait); },
    focusPlay() { choiceButtons[0]?.focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      if (!state.board) return;
      if (state.phase !== 'placing' || preview?.attemptId !== state.attemptId) preview = null;
      renderBoard(state); renderDock(state);
      if (state.lastAnswer && state.lastAnswer.answer !== shownAnswer) { shownAnswer = state.lastAnswer.answer; showAnswer(state); }
      if (state.lastMove && state.lastMove.move !== shownMove) { shownMove = state.lastMove.move; showMove(state); }
      if (state.lastPass && state.lastPass.pass !== shownPass) { shownPass = state.lastPass.pass; showPass(state); }
      if (state.result && !doneShown) {
        doneShown = true;
        const r = state.result, name = rival?.name ?? 'あいて';
        const head = r.outcome === 'win' ? 'きみの勝ち！' : r.outcome === 'draw' ? 'ひきわけ！' : 'さいごまで あそんだよ！';
        fx.banner(head, r.outcome === 'lose' ? 'good' : 'great'); fx.burst(50, 50, 'great', 2);
        note.textContent = r.outcome === 'lose'
          ? `${head} ${r.stars ? `ほしの石 ${r.stars}こ！ ` : ''}また いっしょに あそぼうね。`
          : `${head} きみ ${r.mine}まい・${name} ${r.theirs}まい。ほしの石 ${r.stars}こ！`;
      }
    },
    present(play, dt, state) {
      if (!active || !state) return;
      frame.tick(dt);
      const w = play.world || {};
      const event = w.lastEvent;
      if (event && event.id !== lastEventId) {
        lastEventId = event.id;
        if (event.type === 'boost') { fx.banner('オセロフィーバー！', 'great'); fx.flash('great'); }
      }
      const mission = w.challenge;
      frame.hud.root.style.display = state.result ? 'none' : '';
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: Math.min(1, (state.board?.filter(Boolean).length ?? 0) / (N * N)), progressLabel: `きみ ${state.mine ?? 0} ・ あいて ${state.theirs ?? 0}`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; preview = null; [...choiceButtons, ...cells, confirm].forEach(button => { button.disabled = true; }); },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
