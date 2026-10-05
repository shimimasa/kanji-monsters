import { createArcadeFrame, restartClass, bindArcadeKeys } from '../arcade/arcadeKit.js';
import { castAt } from '../gotomonCast.js';
import Speech from '../../audio/speech.js';
import { PUSH_RULES as R, stepFrom } from './pushGame.js';

const N = R.size, CELL = 100 / N;
const CSS = `
#gotomonPushScreen .ya-field{background:radial-gradient(circle at 80% 15%,#ffffff14 0 6%,transparent 7%),linear-gradient(#5b4636,#3d2e24)}
#gotomonPushScreen .ps-board{position:absolute;left:50%;top:60px;bottom:2%;aspect-ratio:1;max-width:94%;transform:translateX(-50%);border-radius:10px;
  background:repeating-linear-gradient(0deg,transparent 0 calc(${CELL}% - 2px),#d9bd8a calc(${CELL}% - 2px) ${CELL}%),repeating-linear-gradient(90deg,transparent 0 calc(${CELL}% - 2px),#d9bd8a calc(${CELL}% - 2px) ${CELL}%),#e9d3a8;
  box-shadow:0 6px 0 #2a1f18,0 0 0 5px #7a5a40;touch-action:none;z-index:2}
#gotomonPushScreen .ps-cell{position:absolute;width:${CELL}%;height:${CELL}%;padding:0;border:0;background:none;font:inherit;cursor:pointer}
#gotomonPushScreen .ps-thing{position:absolute;width:${CELL}%;height:${CELL}%;display:grid;place-items:center;pointer-events:none;transition:left .12s linear,top .12s linear}
#gotomonPushScreen .ps-rock{background:radial-gradient(circle at 40% 35%,#a8a29a,#6b655e 70%);border-radius:40% 45% 38% 42%;transform:scale(.88);box-shadow:inset 0 -4px 0 #4a4540}
#gotomonPushScreen .ps-nest{border-radius:50%;background:radial-gradient(circle,#7a4a24 0 34%,#c98b52 35% 58%,#e9d3a8 60%);transform:scale(.92);box-shadow:0 0 0 3px #ffe066aa}
#gotomonPushScreen .ps-nest[data-glow=true]{animation:ps-glow 1s ease-in-out infinite alternate}
#gotomonPushScreen .ps-box{z-index:3}
#gotomonPushScreen .ps-box>span{width:86%;height:86%;display:grid;place-items:center;border-radius:8px;background:linear-gradient(#e0a458,#b9772e);
  box-shadow:inset 0 0 0 3px #8a531c,inset 0 0 0 5px #f2c27c,0 3px 0 #5a3410;color:#2a1608;font-weight:900;line-height:1.05;text-align:center;
  font-size:clamp(11px,2.6vh,22px);overflow-wrap:anywhere;padding:2px;box-sizing:border-box}
#gotomonPushScreen .ps-box[data-long=true]>span{font-size:clamp(9px,1.9vh,15px)}
#gotomonPushScreen .ps-box[data-state=wrong]>span{background:#cfc6bb;color:#7a7066;box-shadow:inset 0 0 0 3px #9a9088;text-decoration:line-through}
#gotomonPushScreen .ps-box[data-state=rock]>span{background:#bfa98d;color:#5a4a3a;box-shadow:inset 0 0 0 3px #8a7660;opacity:.75}
#gotomonPushScreen .ps-box[data-state=chosen]>span{background:linear-gradient(#ffe066,#f3b51f);box-shadow:inset 0 0 0 3px #b07d06,0 0 0 3px #fff,0 4px 0 #6a4a04}
#gotomonPushScreen .ps-box[data-hint=true]>span{box-shadow:inset 0 0 0 3px #8a531c,0 0 0 4px #37c871,0 0 14px #37c871;animation:ps-glow .8s ease-in-out infinite alternate}
#gotomonPushScreen .ps-box.ps-crack>span{animation:ps-crack .4s ease-out}
#gotomonPushScreen .ps-player{z-index:4}
#gotomonPushScreen .ps-player>*{width:84%!important;height:84%!important;object-fit:contain}
#gotomonPushScreen .ps-player .ps-token{border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff,#7ad1ff)}
#gotomonPushScreen .ps-friend{z-index:5}
#gotomonPushScreen .ps-friend img{width:110%;height:110%;object-fit:contain;animation:ps-pop .7s ease-out}
#gotomonPushScreen .ps-party{position:absolute;right:2%;top:62px;display:flex;flex-direction:column;gap:2px;align-items:center;color:#ffe9c7;font-size:11px;font-weight:900;z-index:3}
#gotomonPushScreen .ps-party img{width:clamp(26px,4.6vh,42px);height:clamp(26px,4.6vh,42px);object-fit:contain;animation:ps-pop .5s ease-out}
#gotomonPushScreen .ps-title{margin:0;text-align:center;font-size:14px;font-weight:900;color:#ffe9c7}
#gotomonPushScreen .ps-prompt{margin:0;padding:8px 12px;border-radius:14px;background:#ffffff14;color:#fff;text-align:center;font-size:clamp(19px,2.7vw,27px);font-weight:900;line-height:1.3}
#gotomonPushScreen .ps-prompt small{display:block;margin-top:4px;font-size:15px;font-weight:700;color:#ffe9c7}
#gotomonPushScreen .ps-prompt small b{color:#ffe066}
#gotomonPushScreen .ps-choices{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
#gotomonPushScreen .ps-choice{min-height:54px;border:3px solid transparent;border-radius:14px;background:#fff6e6;color:#2a1608;font:inherit;font-size:clamp(17px,2.3vw,24px);font-weight:900;box-shadow:0 4px 0 #2a1f18;cursor:pointer;touch-action:manipulation}
#gotomonPushScreen .ps-choice:disabled{opacity:.4;text-decoration:line-through;cursor:default}
#gotomonPushScreen .ps-choice[data-hint=true]{border-color:#37c871;box-shadow:0 0 0 4px #37c871aa}
#gotomonPushScreen .ps-controls{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;align-items:center}
#gotomonPushScreen .ps-pad{display:grid;grid-template-columns:repeat(3,58px);grid-template-rows:repeat(2,50px);gap:6px}
#gotomonPushScreen .ps-arrow{border:0;border-radius:12px;background:#ffffff26;color:#fff;font:inherit;font-size:24px;font-weight:900;cursor:pointer;touch-action:manipulation}
#gotomonPushScreen .ps-arrow[data-direction=up]{grid-column:2}
#gotomonPushScreen .ps-arrow[data-direction=left]{grid-column:1;grid-row:2}
#gotomonPushScreen .ps-arrow[data-direction=down]{grid-column:2;grid-row:2}
#gotomonPushScreen .ps-arrow[data-direction=right]{grid-column:3;grid-row:2}
#gotomonPushScreen .ps-tools{display:grid;gap:6px}
#gotomonPushScreen .ps-tool{min-height:40px;padding:4px 12px;border:0;border-radius:10px;background:#ffffff22;color:#fff;font:inherit;font-size:14px;font-weight:800;cursor:pointer}
#gotomonPushScreen .ps-tool:disabled{opacity:.35;cursor:default}
#gotomonPushScreen .ps-help{background:#37c871;color:#06301a;box-shadow:0 3px 0 #1d7a44}
@keyframes ps-glow{from{filter:brightness(1)}to{filter:brightness(1.25)}}
@keyframes ps-crack{0%,100%{transform:none}25%{transform:rotate(-8deg)}75%{transform:rotate(8deg)}}
@keyframes ps-pop{from{transform:scale(.2) translateY(30%);opacity:0}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){#gotomonPushScreen *{animation:none!important;transition:none!important}}
`;

export function createPushView({ document: doc, dispatch, onBack, getSnapshot, cast }) {
  let active = true, lastEventId = 0, doneShown = false, shownAnswer = 0, shownClear = 0, problemKey = null, roomKey = null, start = null;
  const removes = [], boxNodes = new Map(), roomNodes = [], cellButtons = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'gotomonPushScreen', title: 'ゴトモン・おしだし', theme: 'push' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });
  const place = (node, index) => { node.style.left = `${(index % N) * CELL}%`; node.style.top = `${Math.floor(index / N) * CELL}%`; };

  const board = el('div', 'ps-board'); board.setAttribute('aria-label', 'へや');
  // Tapping a box chooses it; tapping a square next to the companion steps (or pushes) that way.
  for (let index = 0; index < N * N; index++) {
    const cell = el('button', 'ps-cell'); cell.type = 'button'; place(cell, index);
    cell.setAttribute('aria-label', `${Math.floor(index / N) + 1}行 ${(index % N) + 1}列`);
    on(cell, 'click', () => tap(index));
    board.append(cell); cellButtons.push(cell);
  }
  const player = el('div', 'ps-thing ps-player'), token = el('div', 'ps-token'); player.append(token);
  board.append(player);
  const party = el('div', 'ps-party'); party.append(el('span', '', 'なかま'));
  world.append(board, party);
  on(board, 'pointerdown', event => { start = [event.clientX, event.clientY]; });
  on(board, 'pointerup', event => {
    if (!start) return;
    const dx = event.clientX - start[0], dy = event.clientY - start[1]; start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });

  const title = el('p', 'ps-title');
  const prompt = el('p', 'ps-prompt'); prompt.dataset.role = 'problem';
  const choices = el('div', 'ps-choices'), choiceButtons = [];
  for (let i = 0; i < 4; i++) {
    const button = el('button', 'ps-choice'); button.type = 'button';
    on(button, 'click', () => choose(button.dataset.choice)); choices.append(button); choiceButtons.push(button);
  }
  const controls = el('div', 'ps-controls'), pad = el('div', 'ps-pad'), arrows = [];
  for (const [direction, text] of [['up', '↑'], ['left', '←'], ['down', '↓'], ['right', '→']]) {
    const button = el('button', 'ps-arrow', text); button.type = 'button'; button.dataset.direction = direction;
    button.setAttribute('aria-label', { up: 'うえ', left: 'ひだり', down: 'した', right: 'みぎ' }[direction]);
    on(button, 'click', () => move(direction)); pad.append(button); arrows.push(button);
  }
  const tools = el('div', 'ps-tools');
  const undo = el('button', 'ps-tool', '↶ 1つ もどす'); undo.type = 'button'; undo.dataset.action = 'undo';
  const reset = el('button', 'ps-tool', '⟲ さいしょから'); reset.type = 'button'; reset.dataset.action = 'reset';
  const carry = el('button', 'ps-tool ps-help', 'ここから はこんでもらう'); carry.type = 'button'; carry.dataset.action = 'carry';
  on(undo, 'click', () => command('undo')); on(reset, 'click', () => command('reset'));
  on(carry, 'click', () => command('carry'));
  tools.append(undo, reset, carry); controls.append(pad, tools);
  const note = el('p', 'ya-dock-note'); note.dataset.role = 'feedback';
  dock.append(title, prompt, choices, controls, note);
  doc.body.append(root);

  const send = (type, extra = {}) => {
    const state = getSnapshot();
    return dispatch({ type, payload: { sessionId: state.sessionId, attemptId: state.attemptId, ...extra } });
  };
  function choose(boxId) { const s = getSnapshot(); if (!active || s.paused || s.phase !== 'choosing' || !boxId) return false; return send('choose', { boxId }); }
  function move(direction) { const s = getSnapshot(); if (!active || s.paused || s.phase !== 'pushing') return false; return send('move', { direction }); }
  function command(type) { const s = getSnapshot(); if (!active || s.paused || s.phase !== 'pushing') return false; return send(type); }
  function tap(index) {
    const s = getSnapshot();
    if (!active || s.paused) return false;
    if (s.phase === 'choosing') { const hit = s.boxes.find(item => item.cell === index); return hit ? choose(hit.boxId) : false; }
    if (s.phase !== 'pushing') return false;
    const direction = ['up', 'down', 'left', 'right'].find(dir => stepFrom(s.player, dir) === index);
    return direction ? move(direction) : false;
  }
  removes.push(bindArcadeKeys(doc, event => {
    const direction = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[event.key];
    if (direction) { move(direction); return true; }
    if (event.key === 'z' || event.key === 'Backspace') { command('undo'); return true; }
    const k = ['1', '2', '3', '4'].indexOf(event.key);
    return k >= 0 ? choose(choiceButtons[k]?.dataset.choice) : false;
  }));

  const buildRoom = state => {
    roomNodes.splice(0).forEach(node => node.remove?.());
    boxNodes.clear();
    const add = (className, index) => { const node = el('div', `ps-thing ${className}`); place(node, index); board.append(node); roomNodes.push(node); return node; };
    for (const rock of state.rocks) add('ps-rock', rock);
    const nest = add('ps-nest', state.goal); nest.dataset.role = 'nest';
    for (const item of state.boxes) {
      const node = add('ps-box', item.cell), face = el('span', '', item.text);
      node.dataset.long = String([...item.text].length > 4); node.append(face); boxNodes.set(item.boxId, node);
    }
    board.append(player);
  };
  const render = state => {
    const key = `${state.room}:${state.goal}:${state.rocks.join(',')}`;
    if (key !== roomKey) { roomKey = key; buildRoom(state); }
    for (const item of state.boxes) {
      const node = boxNodes.get(item.boxId); if (!node) continue;
      place(node, item.cell);
      if (node.dataset.state !== item.state) { node.dataset.state = item.state; if (item.state === 'wrong') restartClass(node, 'ps-crack'); }
      const hint = String(state.hintChoiceId === item.boxId);
      if (node.dataset.hint !== hint) node.dataset.hint = hint;
    }
    const nest = roomNodes.find(node => node.dataset.role === 'nest');
    if (nest) nest.dataset.glow = String(state.phase === 'pushing');
    place(player, state.player);
    const choosing = state.phase === 'choosing', pushing = state.phase === 'pushing';
    choices.hidden = !choosing; controls.hidden = !pushing;
    undo.disabled = !state.canUndo; reset.disabled = !state.canUndo; carry.hidden = !pushing;
    const pkey = `${state.phase}:${state.problem?.problemId ?? state.room}`;
    if (pkey !== problemKey) {
      problemKey = pkey;
      if (choosing) {
        prompt.textContent = state.problem.prompt;
        if (state.problem.sentence) { const small = el('small'); small.append(el('span', '', state.problem.sentence.before), el('b', '', state.problem.prompt.match(/「(.+?)」/)?.[1] ?? ''), el('span', '', state.problem.sentence.after)); prompt.append(small); }
        state.problem.choices.forEach((choice, i) => { choiceButtons[i].textContent = choice.text; choiceButtons[i].dataset.choice = choice.choiceId; });
        const word = state.problem.kind === 'en2ja' ? state.problem.prompt.split(' ')[0] : null;
        if (word) Speech.speakEnglish(word);
        // A retry keeps the note about the slip.
        if (state.problem.problemId.endsWith(':0')) note.textContent = '答えの はこを タップしよう';
      } else if (pushing) {
        prompt.textContent = '金色の はこを、すあな（まるい ところ）へ おそう！';
        note.textContent = 'はこの うしろから おそう。むずかしいときは「ここから はこんでもらう」も えらべるよ';
      } else prompt.textContent = state.phase === 'cleared' ? 'すあなに とどいた！' : state.phase === 'completed' ? 'ぜんぶの へや クリア！' : '';
    }
    choiceButtons.forEach(button => {
      const item = state.boxes.find(b => b.boxId === button.dataset.choice);
      button.disabled = item?.state === 'wrong';
      const hint = String(!!state.hintChoiceId && button.dataset.choice === state.hintChoiceId); if (button.dataset.hint !== hint) button.dataset.hint = hint;
    });
    const titleText = state.phase === 'completed' ? '' : `へや ${state.room + 1} / ${state.rooms}　⭐${state.stars}${state.phase === 'pushing' ? `　おした ${state.pushes}回` : ''}`;
    if (title.textContent !== titleText) title.textContent = titleText;
  };
  const showAnswer = state => {
    const a = state.lastAnswer;
    if (a.correct) { note.textContent = `${a.first ? 'せいかい！' : 'それだ！'} ${a.explain}`; fx.pop(50, 40, a.first ? 'せいかい！' : 'それだ！', 'great'); }
    else note.textContent = `おしい！ 答えは「${a.answerText}」（「${a.chosen}」${a.note ? `は${a.note}` : 'ではないよ'}）。光っている はこを えらぼう`;
    frame.announce(note.textContent);
  };
  const showClear = state => {
    const c = state.lastClear, who = castAt(cast?.wild, c.room);
    const nest = roomNodes.find(node => node.dataset.role === 'nest');
    if (who && nest) {
      const friend = el('div', 'ps-thing ps-friend'), img = el('img'); img.alt = ''; img.src = who.imageUrl;
      friend.append(img); place(friend, state.goal); board.append(friend); roomNodes.push(friend);
      const icon = el('img'); icon.alt = who.name; icon.src = who.imageUrl; party.append(icon);
    }
    note.textContent = `${who ? who.name : 'ゴトモン'}が はこから でてきた！ ${'⭐'.repeat(c.stars)}${c.helped ? '（はこんでもらった）' : ''}`;
    fx.banner(c.helped ? 'とどいた！' : `⭐${c.stars} クリア！`, 'great');
    frame.announce(note.textContent);
  };

  return {
    root,
    attachCompanion(portrait) { token.remove?.(); player.append(portrait); },
    focusPlay() { choiceButtons[0]?.focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      if (state.room < 0 || !state.boxes?.length) return;
      render(state);
      if (state.lastAnswer && state.lastAnswer.answer !== shownAnswer) { shownAnswer = state.lastAnswer.answer; showAnswer(state); }
      if (state.lastClear && state.lastClear.clear !== shownClear) { shownClear = state.lastClear.clear; showClear(state); }
      if (state.result && !doneShown) {
        doneShown = true;
        fx.banner('おしだし クリア！', 'great'); fx.burst(50, 50, 'great', 2);
        note.textContent = `${state.result.rooms}へや ぜんぶ クリア！ ⭐${state.result.stars}・なかま ${state.result.friends}ひき`;
      }
    },
    present(play, dt, state) {
      if (!active || !state) return;
      frame.tick(dt);
      const w = play.world || {};
      const event = w.lastEvent;
      if (event && event.id !== lastEventId) {
        lastEventId = event.id;
        if (event.type === 'boost') { fx.banner('おしだしフィーバー！', 'great'); fx.flash('great'); }
      }
      const mission = w.challenge;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: Math.min(1, ((state.room ?? 0) + (state.phase === 'cleared' || state.phase === 'completed' ? 1 : 0)) / (state.rooms || 1)), progressLabel: `へや ${Math.max(0, state.room ?? 0) + 1}/${state.rooms ?? 0}`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; [...choiceButtons, ...arrows, undo, reset, carry, ...cellButtons].forEach(button => { button.disabled = true; }); },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
