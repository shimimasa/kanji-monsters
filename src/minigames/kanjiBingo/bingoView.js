import { createArcadeFrame, restartClass } from '../arcade/arcadeKit.js';
import { castAt } from '../gotomonCast.js';
import { BINGO_CELLS, BINGO_LINES } from './bingoContent.js';

const CSS = `
#kanjiBingoScreen .ya-field{background:radial-gradient(circle at 50% 30%,#fff3c9 0,#ffd9a0 45%,#f0a868 100%)}
#kanjiBingoScreen .kb-card{position:absolute;left:50%;top:54px;bottom:12px;transform:translateX(-50%);aspect-ratio:1;max-width:94%;z-index:2;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(4,1fr);gap:clamp(4px,1vw,8px);padding:clamp(6px,1.4vw,12px);border-radius:18px;background:#2f6fb3;box-shadow:0 8px 0 #1d4a7a,0 12px 24px #0004}
#kanjiBingoScreen .kb-cell{position:relative;display:grid;place-items:center;min-width:0;min-height:0;padding:0;border:0;border-radius:12px;background:#fffdf6;color:#1b2a36;font:inherit;font-size:clamp(26px,5.4vmin,54px);font-weight:900;line-height:1;box-shadow:0 4px 0 #c9b98f;cursor:pointer;touch-action:manipulation}
#kanjiBingoScreen .kb-cell:focus-visible{outline:4px solid #ffd54a;outline-offset:1px}
#kanjiBingoScreen .kb-cell::after{content:'';position:absolute;inset:10%;border-radius:50%;pointer-events:none}
#kanjiBingoScreen .kb-cell[data-mark=call]{background:#fff0f0;color:#8a2030}
#kanjiBingoScreen .kb-cell[data-mark=call]::after{border:clamp(3px,.8vmin,6px) solid #e5364bcc;animation:kb-stamp .35s ease-out}
#kanjiBingoScreen .kb-cell[data-mark=stamp]{background:#fff6cf;color:#7a5a00}
#kanjiBingoScreen .kb-cell[data-mark=stamp]::after{content:'⭐';display:grid;place-items:end;inset:4px;font-size:clamp(14px,2.6vmin,24px);animation:kb-stamp .35s ease-out}
#kanjiBingoScreen .kb-cell[data-line=true]{box-shadow:0 4px 0 #c9951a,0 0 0 4px #ffc400}
#kanjiBingoScreen .kb-cell[data-reach=true]:not([data-mark]){box-shadow:0 4px 0 #c9b98f,0 0 0 3px #ffb627;animation:kb-reach 1s ease-in-out infinite alternate}
#kanjiBingoScreen .kb-cell[data-answer=true]{background:#d7f7df;box-shadow:0 4px 0 #1f9d55,0 0 0 4px #37c871}
#kanjiBingoScreen .kb-cell[data-plan=true]{outline:4px solid #72e9ff;outline-offset:-6px}
#kanjiBingoScreen .kb-cell[data-stampable=true]{animation:kb-reach .7s ease-in-out infinite alternate}
#kanjiBingoScreen .kb-cell.kb-miss{animation:kb-miss .4s ease-out}
#kanjiBingoScreen .kb-buddy{position:absolute;left:10px;bottom:10px;z-index:3;width:clamp(56px,8vw,88px);height:clamp(56px,8vw,88px);pointer-events:none}
#kanjiBingoScreen .kb-buddy .gt-portrait{display:block;width:100%;height:100%;background:none;border:0}
#kanjiBingoScreen .kb-buddy .gt-portrait img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 3px 2px #0005)}
#kanjiBingoScreen .kb-buddy.kb-cheer{animation:kb-cheer .5s ease-out}
@media (max-width:700px){#kanjiBingoScreen .kb-buddy{display:none}#kanjiBingoScreen .kb-card{top:90px;bottom:8px}}
#kanjiBingoScreen .kb-title{margin:0;text-align:center;font-size:15px;font-weight:900;color:#ffe2b8}
#kanjiBingoScreen .kb-ball{display:flex;align-items:center;gap:10px;margin:0;padding:10px 12px;border-radius:14px;background:#ffffff14;color:#fff}
#kanjiBingoScreen .kb-ball b{flex:none;display:grid;place-items:center;width:52px;height:52px;border-radius:50%;background:radial-gradient(circle at 28% 22%,#fff 0 9%,#ff8a3d 34%,#c24d0b);color:#fff;font-size:16px;font-weight:900;text-shadow:0 1px 2px #000b;box-shadow:0 3px 0 #0004}
#kanjiBingoScreen .kb-ball[data-kind=meaning] b{background:radial-gradient(circle at 28% 22%,#fff 0 9%,#4fb0ff 34%,#1b5fa8)}
#kanjiBingoScreen .kb-clue{font-size:clamp(18px,2.3vw,23px);font-weight:800;line-height:1.5}
#kanjiBingoScreen .kb-target{display:inline-block;margin:0 2px;padding:0 6px;border-radius:8px;background:#ffe066;color:#3a2400;font-size:1.2em;line-height:1.25}
#kanjiBingoScreen .kb-tools{display:flex;justify-content:center;flex-wrap:wrap;gap:8px}
#kanjiBingoScreen .kb-stampbtn,#kanjiBingoScreen .kb-planbtn{min-height:48px;padding:4px 16px;border:2px solid #ffffff55;border-radius:99px;background:#ffffff1c;color:#fff;font:inherit;font-size:16px;font-weight:900;white-space:nowrap;cursor:pointer;touch-action:manipulation}
#kanjiBingoScreen .kb-stampbtn:disabled,#kanjiBingoScreen .kb-planbtn:disabled{opacity:.4;cursor:default}
#kanjiBingoScreen .kb-stampbtn[data-armed=true]{opacity:1;background:#ffe066;color:#3a2400;border-color:#ffe066}
#kanjiBingoScreen .kb-planbtn[aria-expanded=true]{background:#d6f7ff;color:#12394b;border-color:#72e9ff}
#kanjiBingoScreen .kb-planlist{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}
#kanjiBingoScreen .kb-planlist button{min-width:0;min-height:44px;padding:4px 2px;border:2px solid #ffffff55;border-radius:10px;background:#ffffff1c;color:#fff;font:inherit;font-size:14px;font-weight:900;cursor:pointer;touch-action:manipulation}
#kanjiBingoScreen .kb-planlist button[aria-pressed=true]{background:#72e9ff;border-color:#d6f7ff;color:#12394b}
#kanjiBingoScreen .kb-planlist button:disabled{opacity:.4;cursor:default}
#kanjiBingoScreen .kb-review{margin:0;padding:0;list-style:none;display:grid;gap:6px}
#kanjiBingoScreen .kb-review li{padding:6px 10px;border-radius:10px;background:#eef6ef;font-weight:700}
#kanjiBingoScreen .kb-review li[data-correct=false]{background:#fff3da}
#kanjiBingoScreen .kb-sticker{position:absolute;z-index:3;width:22%;aspect-ratio:1;transform:translate(-50%,-50%) rotate(-8deg);border-radius:50%;background:#fffdf6e6;box-shadow:0 0 0 4px #ffc400,0 4px 8px #0005;pointer-events:none;animation:kb-stick .45s ease-out}
#kanjiBingoScreen .kb-sticker img{width:100%;height:100%;object-fit:contain}
@keyframes kb-stick{from{transform:translate(-50%,-50%) scale(2) rotate(20deg);opacity:0}}
@keyframes kb-stamp{from{transform:scale(1.8);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes kb-reach{from{transform:none}to{transform:translateY(-3px)}}
@keyframes kb-cheer{0%,100%{transform:none}40%{transform:translateY(-14px)}}
@keyframes kb-miss{0%,100%{transform:none}30%{transform:translateX(-6px)}60%{transform:translateX(5px)}}
`;
const LINE_NAMES = Object.freeze(['よこ1', 'よこ2', 'よこ3', 'よこ4', 'たて1', 'たて2', 'たて3', 'たて4', 'ななめ↘', 'ななめ↙']);

export function createBingoView({ document: doc, dispatch, onBack, getSnapshot, cast }) {
  // Every bingo line earns a Gotomon sticker, stuck on the middle of that line.
  const stickers = new Map();
  let lastSticker = null;
  let active = true, stampNote = false, cardKey = null, clueKey = null, lastSeq = -1, lastEventId = 0;
  let planning = false, plannedLine = null;
  const removes = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'kanjiBingoScreen', title: '漢字ビンゴ', theme: 'hall' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });

  const card = el('div', 'kb-card'); card.setAttribute('role', 'grid'); card.setAttribute('aria-label', 'ビンゴカード');
  const cells = Array.from({ length: BINGO_CELLS }, (_, index) => {
    const node = el('button', 'kb-cell'); node.type = 'button'; node.dataset.index = String(index);
    on(node, 'click', () => tap(index)); card.append(node); return node;
  });
  const buddy = el('div', 'kb-buddy');
  world.append(card, buddy);

  const title = el('p', 'kb-title');
  const ball = el('p', 'kb-ball'); ball.dataset.role = 'problem';
  const ballLabel = el('b'), clue = el('span', 'kb-clue'); ball.append(ballLabel, clue);
  const tools = el('div', 'kb-tools');
  const stampButton = el('button', 'kb-stampbtn'); stampButton.type = 'button'; stampButton.dataset.action = 'stamp';
  on(stampButton, 'click', () => toggleStamp()); tools.append(stampButton);
  const planButton = el('button', 'kb-planbtn', '🎯 ねらう列'); planButton.type = 'button'; planButton.dataset.action = 'plan';
  on(planButton, 'click', () => togglePlan()); tools.append(planButton);
  const planList = el('div', 'kb-planlist'); planList.hidden = true; planList.setAttribute('aria-label', 'ねらう列');
  const lineButtons = LINE_NAMES.map((name, index) => {
    const node = el('button', '', name); node.type = 'button'; node.dataset.line = String(index);
    on(node, 'click', () => chooseLine(index)); planList.append(node); return node;
  });
  // The shell advances after feedback; this stays hidden and only serves hosts without auto-advance.
  const go = el('button', 'kb-go', 'つぎへ'); go.type = 'button'; go.dataset.action = 'next'; go.hidden = true;
  on(go, 'click', () => proceed());
  const note = el('p', 'ya-dock-note'); note.dataset.role = 'feedback';
  dock.append(title, ball, tools, planList, note, go);
  const review = el('div', 'ya-learning-result'); review.hidden = true;
  const reviewList = el('ol', 'kb-review'); review.append(el('h3', '', '今回のビンゴの漢字'), reviewList); frame.shell.append(review);
  doc.body.append(root);
  const answers = [];

  const session = () => getSnapshot();
  function tap(index) {
    const state = session(), cell = state.card?.[index];
    if (!active || state.paused || state.phase !== 'answering' || planning || !cell || state.marked[index]) return false;
    if (state.stampArmed) {
      // The square being called is for the child to find, so it cannot be stamped.
      if (cell.cellId === state.problem?.cellId) { stampNote = true; restartClass(cells[index], 'kb-miss'); return false; }
      return dispatch({ type: 'stamp', payload: { sessionId: state.sessionId, cellId: cell.cellId } });
    }
    return dispatch({ type: 'answer', payload: { sessionId: state.sessionId, problemId: state.problem.problemId, attemptId: state.attemptId, choiceId: cell.cellId } });
  }
  function toggleStamp() {
    const state = session();
    if (!active || state.paused || state.phase !== 'answering') return false;
    return dispatch({ type: 'armStamp', payload: { sessionId: state.sessionId, armed: !state.stampArmed } });
  }
  function togglePlan() {
    const state = session();
    if (!active || state.paused || state.phase !== 'answering') return false;
    planning = !planning;
    renderCard(state);
    renderDock(state);
    return true;
  }
  function chooseLine(index) {
    const state = session();
    if (!active || state.paused || state.phase !== 'answering' || !BINGO_LINES[index]) return false;
    plannedLine = index;
    planning = false;
    renderCard(state);
    renderDock(state);
    return true;
  }
  function proceed() {
    const state = session();
    if (!active || state.paused || state.phase !== 'feedback') return false;
    return dispatch({ type: 'next', payload: { sessionId: state.sessionId, problemId: state.problem?.problemId } });
  }

  const setData = (node, key, value) => { if (value === null) { if (key in node.dataset) delete node.dataset[key]; } else if (node.dataset[key] !== value) node.dataset[key] = value; };
  const renderCard = state => {
    if (cardKey !== state.sessionId) {
      cardKey = state.sessionId;
      planning = false; plannedLine = null;
      state.card.forEach((cell, index) => { cells[index].textContent = cell.kanji; cells[index].dataset.cellId = cell.cellId; });
    }
    const inLine = new Set(state.lines.flatMap(line => BINGO_LINES[line]));
    for (const line of state.lines) {
      if (stickers.has(line)) continue;
      const who = castAt(cast?.wild, stickers.size);
      stickers.set(line, who);
      if (!who) continue;
      const spots = BINGO_LINES[line], side = Math.sqrt(BINGO_CELLS);
      const x = spots.reduce((sum, i) => sum + (i % side) + .5, 0) / spots.length / side * 100;
      const y = spots.reduce((sum, i) => sum + Math.floor(i / side) + .5, 0) / spots.length / side * 100;
      const sticker = el('span', 'kb-sticker'), img = el('img'); img.alt = who.name; img.src = who.imageUrl; sticker.append(img);
      sticker.style.left = `${x}%`; sticker.style.top = `${y}%`; card.append(sticker); lastSticker = who;
    }
    const reach = new Set();
    for (const line of BINGO_LINES) {
      const open = line.filter(index => !state.marked[index]);
      if (open.length === 1) reach.add(open[0]);
    }
    const showAnswer = state.phase === 'feedback' && state.lastAnswer && !state.lastAnswer.correct;
    cells.forEach((node, index) => {
      const cell = state.card[index], mark = state.marked[index];
      setData(node, 'mark', mark ?? null);
      setData(node, 'line', inLine.has(index) ? 'true' : null);
      setData(node, 'reach', reach.has(index) ? 'true' : null);
      setData(node, 'answer', showAnswer && cell.cellId === state.lastAnswer.correctChoiceId ? 'true' : null);
      setData(node, 'stampable', state.stampArmed && !mark && cell.cellId !== state.problem?.cellId ? 'true' : null);
      const inPlan = plannedLine !== null && BINGO_LINES[plannedLine].includes(index);
      setData(node, 'plan', inPlan ? 'true' : null);
      const label = `${cell.kanji}${mark ? '（あいた）' : ''}${inPlan ? '、ねらう列' : ''}`;
      if (node.getAttribute('aria-label') !== label) node.setAttribute('aria-label', label);
      node.disabled = !!mark || state.phase !== 'answering' || state.paused || planning;
    });
  };
  const renderDock = state => {
    if (state.phase !== 'answering' || state.paused) planning = false;
    if (state.problem && clueKey !== state.problem.problemId) {
      clueKey = state.problem.problemId;
      const problem = state.problem;
      ball.dataset.kind = problem.kind; ballLabel.textContent = problem.kind === 'reading' ? 'よみ' : 'いみ';
      clue.textContent = '';
      if (problem.kind === 'reading') clue.append(el('span', '', problem.clue.before), el('span', 'kb-target', problem.clue.reading), el('span', '', problem.clue.after));
      else clue.append(el('span', 'kb-target', problem.clue.meaning));
    }
    const calls = state.calls;
    title.textContent = state.problem ? `よびだし ${calls.made}/${calls.total}` : '';
    if (state.phase === 'answering') {
      if (!state.stampArmed) stampNote = false;
      const ask = planning ? 'そろえたい列をえらぼう。あいたマスの数も見られるよ' : state.stampArmed ? (stampNote ? 'よびだし中の漢字には⭐をおせないよ。ほかのマスをえらぼう' : '⭐をおすマスをタップ（よびだし中の漢字はのぞく）')
        : state.problem?.kind === 'reading' ? '黄色の読みの漢字はどれ？' : 'この意味の漢字はどれ？';
      if (note.textContent !== ask) note.textContent = ask;
    }
    const stampText = state.stampArmed ? '⭐ やめる' : `⭐ スタンプ ×${state.stamps}`;
    if (stampButton.textContent !== stampText) stampButton.textContent = stampText;
    stampButton.dataset.armed = String(!!state.stampArmed);
    stampButton.disabled = state.phase !== 'answering' || state.paused || (!state.stamps && !state.stampArmed);
    const remaining = plannedLine === null ? null : BINGO_LINES[plannedLine].filter(index => !state.marked[index]).length;
    const planText = plannedLine === null ? '🎯 ねらう列' : `🎯 ${LINE_NAMES[plannedLine]} ${remaining ? `あと${remaining}` : 'ビンゴ！'}`;
    if (planButton.textContent !== planText) planButton.textContent = planText;
    planButton.setAttribute('aria-expanded', String(planning));
    planButton.disabled = state.phase !== 'answering' || state.paused;
    planList.hidden = !planning;
    lineButtons.forEach((node, index) => {
      const open = BINGO_LINES[index].filter(cell => !state.marked[cell]).length;
      const text = `${LINE_NAMES[index]} ${4 - open}/4`;
      if (node.textContent !== text) node.textContent = text;
      node.setAttribute('aria-label', `${LINE_NAMES[index]}、あと${open}マス`);
      node.setAttribute('aria-pressed', String(plannedLine === index));
      node.disabled = state.phase !== 'answering' || state.paused;
    });
  };
  const showAnswer = state => {
    const answer = state.lastAnswer, problem = state.problem;
    const clueText = problem.kind === 'reading' ? problem.clue.reading : problem.clue.meaning;
    answers.push({ text: `${problem.kanji}（${clueText}）`, correct: answer.correct });
    if (answer.correct) {
      note.textContent = answer.newLines ? `ビンゴ！ ${answer.lines}列そろった！${lastSticker ? ` ${lastSticker.name}のシールをもらった！` : ''}` : answer.earnedStamp ? 'せいかい！ ⭐スタンプを手に入れた！' : 'せいかい！';
      fx.burst(50, 50, answer.newLines ? 'great' : 'good', answer.newLines ? 1.6 : 1);
      if (answer.newLines) { fx.banner(answer.lines > 1 ? `${answer.lines}列ビンゴ！` : 'ビンゴ！', 'great'); fx.flash('great'); }
    } else {
      const tapped = cells.find(node => node.dataset.cellId === answer.choiceId);
      if (tapped) restartClass(tapped, 'kb-miss');
      note.textContent = `さがしていたのは「${problem.kanji}」。光っているマスだよ。また出てくるよ！`;
    }
    if (answer.correct) restartClass(buddy, 'kb-cheer');
    frame.announce(note.textContent);
  };

  return {
    root,
    attachCompanion(portrait) { buddy.append(portrait); },
    focusPlay() { cells[0].focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      if (!state.card) return;
      renderCard(state);
      renderDock(state);
      if (state.seq !== lastSeq) {
        lastSeq = state.seq;
        if (state.lastAnswer && answers.length < state.answered) showAnswer(state);
      }
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
      const event = w.lastEvent;
      if (event && event.id !== lastEventId) {
        lastEventId = event.id;
        if (event.type === 'boost') { fx.banner('ビンゴチャンス！', 'great'); fx.flash('great'); }
      }
      const mission = w.challenge;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: Math.min(1, (state.calls?.made ?? 0) / (state.calls?.total || 1)),
        progressLabel: `ビンゴ ${state.lines?.length ?? 0}列`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; [...cells, stampButton, planButton, ...lineButtons, go].forEach(node => { node.disabled = true; }); },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
