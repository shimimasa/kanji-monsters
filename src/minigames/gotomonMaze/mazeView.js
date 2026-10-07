import { createArcadeFrame, restartClass, bindArcadeKeys } from '../arcade/arcadeKit.js';
import { castAt } from '../gotomonCast.js';
import Speech from '../../audio/speech.js';
import { MAZE_RULES as R, wayBetween } from './mazeGame.js';

const N = R.size, CELL = 100 / N;
const CSS = `
#gotomonMazeScreen .ya-field{background:radial-gradient(circle at 15% 20%,#ffffff12 0 7%,transparent 8%),linear-gradient(#3b2f5c,#2a2145)}
#gotomonMazeScreen .mz-board{position:absolute;left:50%;top:60px;bottom:2%;aspect-ratio:1;max-width:94%;transform:translateX(-50%);border-radius:10px;background:#f4ead2;box-shadow:0 6px 0 #1c1530,0 0 0 4px #5a4a8a;touch-action:none;z-index:2}
#gotomonMazeScreen .mz-cell{position:absolute;width:${CELL}%;height:${CELL}%;box-sizing:border-box;padding:0;border:0 solid #5a4a8a;border-radius:0;background:none;box-shadow:none;font:inherit;cursor:pointer}
#gotomonMazeScreen .mz-cell[data-n=false]{border-top-width:4px}
#gotomonMazeScreen .mz-cell[data-s=false]{border-bottom-width:4px}
#gotomonMazeScreen .mz-cell[data-w=false]{border-left-width:4px}
#gotomonMazeScreen .mz-cell[data-e=false]{border-right-width:4px}
#gotomonMazeScreen .mz-cell[data-route=true]{background:#64c9a377}
#gotomonMazeScreen .mz-cell[data-route-end=true]{background:#ffe066aa;box-shadow:inset 0 0 0 4px #ef9d27}
#gotomonMazeScreen .mz-cell[data-route-target=true]{outline:3px dashed #ffe066;outline-offset:-5px}
#gotomonMazeScreen .mz-thing{position:absolute;inset:12%;display:grid;place-items:center;pointer-events:none;font-weight:900}
#gotomonMazeScreen .mz-door{border-radius:10px;background:linear-gradient(#c0392b,#8e2a20);color:#fff;font-size:clamp(16px,3.4vh,30px);box-shadow:0 3px 0 #5a1a12,inset 0 0 0 3px #ffcf5a}
#gotomonMazeScreen .mz-door[data-open=true]{background:#e4f7e8;color:#37c871;box-shadow:inset 0 0 0 2px #37c871;opacity:.8}
#gotomonMazeScreen .mz-door.mz-knock{animation:mz-knock .4s ease-out}
#gotomonMazeScreen .mz-goal{border-radius:10px;background:#ffe066;box-shadow:0 0 0 3px #fff,0 0 12px #ffe066;font-size:clamp(20px,4.4vh,40px)}
#gotomonMazeScreen .mz-friend img{width:100%;height:100%;object-fit:contain;animation:mz-wave 1.2s ease-in-out infinite alternate}
#gotomonMazeScreen .mz-player{position:absolute;width:${CELL}%;height:${CELL}%;display:grid;place-items:center;transition:left .12s linear,top .12s linear;pointer-events:none;z-index:3}
#gotomonMazeScreen .mz-player>*{width:80%!important;height:80%!important;object-fit:contain}
#gotomonMazeScreen .mz-player .mz-token{border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff,#ffcf5a)}
#gotomonMazeScreen .mz-party{position:absolute;right:2%;top:62px;display:flex;flex-direction:column;gap:2px;align-items:center;color:#e8dcff;font-size:11px;font-weight:900;z-index:3}
#gotomonMazeScreen .mz-party img{width:clamp(28px,5vh,44px);height:clamp(28px,5vh,44px);object-fit:contain;animation:mz-join .5s ease-out}
#gotomonMazeScreen .mz-title{margin:0;text-align:center;font-size:14px;font-weight:900;color:#e8dcff}
#gotomonMazeScreen .mz-prompt{margin:0;padding:8px 12px;border-radius:14px;background:#ffffff14;color:#fff;text-align:center;font-size:clamp(20px,2.8vw,28px);font-weight:900;line-height:1.3}
#gotomonMazeScreen .mz-prompt small{display:block;margin-top:4px;font-size:15px;font-weight:700;color:#e8dcff}
#gotomonMazeScreen .mz-prompt small b{color:#ffe066}
#gotomonMazeScreen .mz-choices{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
#gotomonMazeScreen .mz-choice{min-height:58px;border:3px solid transparent;border-radius:14px;background:#fffdf6;color:#1b2a36;font:inherit;font-size:clamp(18px,2.4vw,26px);font-weight:900;box-shadow:0 4px 0 #1c1530;cursor:pointer;touch-action:manipulation}
#gotomonMazeScreen .mz-choice[data-hint=true]{border-color:#37c871;box-shadow:0 0 0 4px #37c871aa}
#gotomonMazeScreen .mz-leave{justify-self:center;padding:6px 14px;border:0;border-radius:10px;background:#ffffff22;color:#fff;font:inherit;font-weight:800;cursor:pointer}
#gotomonMazeScreen .mz-route{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;color:#e8fff4;text-align:center;font-size:15px;font-weight:800}
#gotomonMazeScreen .mz-go{min-height:44px;padding:5px 14px;border:0;border-radius:12px;background:#ffe066;color:#302341;font:inherit;font-weight:900;cursor:pointer;touch-action:manipulation}
#gotomonMazeScreen .mz-pad{display:grid;grid-template-columns:repeat(3,60px);grid-template-rows:repeat(2,52px);gap:6px;justify-content:center}
#gotomonMazeScreen .mz-arrow{border:0;border-radius:12px;background:#ffffff26;color:#fff;font:inherit;font-size:24px;font-weight:900;cursor:pointer;touch-action:manipulation}
#gotomonMazeScreen .mz-arrow[data-direction=up]{grid-column:2}
#gotomonMazeScreen .mz-arrow[data-direction=left]{grid-column:1;grid-row:2}
#gotomonMazeScreen .mz-arrow[data-direction=down]{grid-column:2;grid-row:2}
#gotomonMazeScreen .mz-arrow[data-direction=right]{grid-column:3;grid-row:2}
@keyframes mz-knock{0%,100%{transform:none}25%{transform:rotate(-6deg)}75%{transform:rotate(6deg)}}
@keyframes mz-wave{from{transform:translateY(0)}to{transform:translateY(-10%)}}
@keyframes mz-join{from{transform:scale(.2);opacity:0}to{transform:none;opacity:1}}
`;

export function createMazeView({ document: doc, dispatch, onBack, getSnapshot, cast }) {
  let active = true, lastEventId = 0, doneShown = false, shownAnswer = 0, shownFriend = 0, problemKey = null, floorKey = null, start = null, planned = null, swipeUntil = 0;
  const removes = [], cellNodes = [], thingNodes = new Map();
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'gotomonMazeScreen', title: 'ゴトモン迷路', theme: 'maze' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });

  const board = el('div', 'mz-board'); board.setAttribute('aria-label', '迷路');
  for (let index = 0; index < N * N; index++) {
    const cell = el('button', 'mz-cell'); cell.type = 'button';
    cell.style.left = `${(index % N) * CELL}%`; cell.style.top = `${Math.floor(index / N) * CELL}%`;
    cell.setAttribute('aria-label', `${Math.floor(index / N) + 1}行 ${(index % N) + 1}列`);
    cell.setAttribute('aria-pressed', 'false');
    on(cell, 'click', () => { if (Date.now() >= swipeUntil) chooseRoute(index); });
    board.append(cell); cellNodes.push(cell);
  }
  const player = el('div', 'mz-player'), token = el('div', 'mz-token'); player.append(token);
  board.append(player);
  const party = el('div', 'mz-party'); party.append(el('span', '', 'なかま'));
  world.append(board, party);
  // A swipe on the maze takes one step that way.
  on(board, 'pointerdown', event => { start = [event.clientX, event.clientY]; });
  on(board, 'pointerup', event => {
    if (!start) return;
    const dx = event.clientX - start[0], dy = event.clientY - start[1]; start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
    swipeUntil = Date.now() + 300;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });

  const title = el('p', 'mz-title');
  const prompt = el('p', 'mz-prompt'); prompt.dataset.role = 'problem';
  const choices = el('div', 'mz-choices'), choiceButtons = [];
  for (let i = 0; i < 4; i++) {
    const button = el('button', 'mz-choice'); button.type = 'button';
    on(button, 'click', () => answer(button.dataset.choice)); choices.append(button); choiceButtons.push(button);
  }
  const leave = el('button', 'mz-leave', 'とびらからはなれる'); leave.type = 'button';
  on(leave, 'click', () => { const s = getSnapshot(); if (active && s.phase === 'answering') dispatch({ type: 'leave', payload: { sessionId: s.sessionId } }); });
  const route = el('div', 'mz-route'), routeText = el('span', 'mz-route-text');
  const go = el('button', 'mz-go', 'この道を すすむ'); go.type = 'button';
  on(go, 'click', () => followRoute()); route.append(routeText, go); route.hidden = true;
  const pad = el('div', 'mz-pad'), arrows = [];
  for (const [direction, text] of [['up', '↑'], ['left', '←'], ['down', '↓'], ['right', '→']]) {
    const button = el('button', 'mz-arrow', text); button.type = 'button'; button.dataset.direction = direction;
    button.setAttribute('aria-label', { up: 'うえ', left: 'ひだり', down: 'した', right: 'みぎ' }[direction]);
    on(button, 'click', () => move(direction)); pad.append(button); arrows.push(button);
  }
  const note = el('p', 'ya-dock-note'); note.dataset.role = 'feedback';
  dock.append(title, prompt, choices, leave, route, pad, note);
  doc.body.append(root);

  const send = (type, extra) => {
    const state = getSnapshot();
    return dispatch({ type, payload: { sessionId: state.sessionId, attemptId: state.attemptId, ...extra } });
  };
  function clearRoute() {
    if (!planned) return;
    for (const cell of planned.path) { delete cellNodes[cell].dataset.route; delete cellNodes[cell].dataset.routeEnd; }
    delete cellNodes[planned.cell].dataset.routeTarget;
    cellNodes[planned.cell].setAttribute('aria-pressed', 'false');
    planned = null; route.hidden = true;
  }
  function move(direction) {
    const s = getSnapshot(); if (!active || s.paused || s.phase !== 'walking') return false;
    clearRoute(); return send('move', { direction });
  }
  function followRoute() {
    const s = getSnapshot();
    if (!active || s.paused || s.phase !== 'walking' || s.walking || !planned || planned.from !== s.player || planned.floor !== s.floor) return false;
    const cell = planned.cell; clearRoute(); return send('walkTo', { cell });
  }
  function chooseRoute(cell) {
    const s = getSnapshot();
    if (!active || s.paused || s.phase !== 'walking' || s.walking) return false;
    if (planned?.cell === cell) return followRoute();
    clearRoute();
    if (cell === s.player) return false;
    const wholePath = wayBetween(s.cells, N, s.player, cell);
    if (!wholePath?.length) return false;
    const stopAt = wholePath.findIndex(at => s.doors.some(door => door.cell === at && !door.open) || at === s.goal);
    const path = stopAt < 0 ? wholePath : wholePath.slice(0, stopAt + 1);
    const end = path.at(-1), door = s.doors.some(item => item.cell === end && !item.open);
    const friends = s.friends.filter(friend => !friend.met && path.includes(friend.cell)).length;
    planned = { cell, from: s.player, floor: s.floor, path };
    for (const at of path) cellNodes[at].dataset.route = 'true';
    cellNodes[end].dataset.routeEnd = 'true';
    cellNodes[cell].dataset.routeTarget = 'true';
    cellNodes[cell].setAttribute('aria-pressed', 'true');
    routeText.textContent = `${path.length}マスの道${door ? '・とびらで いったん止まる' : end === s.goal ? '・ゴールへ' : friends ? `・なかまに ${friends}ひき会える` : ''}`;
    route.hidden = false; frame.announce(`${routeText.textContent}。この道を すすむボタンか 同じマスを もう一度押して すすもう`);
    return true;
  }
  function answer(choiceId) { const s = getSnapshot(); if (!active || s.paused || s.phase !== 'answering' || !choiceId) return false; return send('answer', { choiceId }); }
  removes.push(bindArcadeKeys(doc, event => {
    const direction = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[event.key];
    if (direction) { move(direction); return true; }
    const k = ['1', '2', '3', '4'].indexOf(event.key);
    return k >= 0 ? answer(choiceButtons[k]?.dataset.choice) : false;
  }));

  const buildFloor = state => {
    for (const node of thingNodes.values()) node.remove?.();
    thingNodes.clear();
    state.cells.forEach((cell, index) => { for (const side of ['n', 'e', 's', 'w']) cellNodes[index].dataset[side] = String(cell[side]); });
    const put = (key, index, className, text = '') => { const node = el('div', `mz-thing ${className}`, text); cellNodes[index].append(node); thingNodes.set(key, node); return node; };
    put('goal', state.goal, 'mz-goal', '🏁');
    for (const door of state.doors) put(door.doorId, door.cell, 'mz-door', '？');
    for (const friend of state.friends) {
      const who = castAt(cast?.wild, friend.index), node = put(friend.friendId, friend.cell, 'mz-friend');
      if (who) { const img = el('img'); img.alt = ''; img.src = who.imageUrl; node.append(img); } else node.textContent = '★';
    }
  };
  const render = state => {
    const key = `${state.floor}:${state.doors[0]?.doorId}`;
    if (key !== floorKey) { clearRoute(); floorKey = key; buildFloor(state); }
    if (planned && (state.player !== planned.from || state.floor !== planned.floor || state.phase !== 'walking' || state.walking)) clearRoute();
    for (const door of state.doors) {
      const node = thingNodes.get(door.doorId); if (!node) continue;
      if (node.dataset.open !== String(door.open)) { node.dataset.open = String(door.open); node.textContent = door.open ? '✓' : '？'; }
    }
    for (const friend of state.friends) { const node = thingNodes.get(friend.friendId); if (node) node.hidden = friend.met; }
    player.style.left = `${(state.player % N) * CELL}%`; player.style.top = `${Math.floor(state.player / N) * CELL}%`;
    const answering = state.phase === 'answering';
    choices.hidden = !answering; leave.hidden = !answering || !state.problem?.problemId.endsWith(':0'); pad.hidden = state.phase !== 'walking';
    const pkey = `${state.phase}:${state.problem?.problemId ?? ''}`;
    if (pkey !== problemKey) {
      problemKey = pkey;
      if (answering) {
        prompt.textContent = state.problem.prompt;
        if (state.problem.sentence) { const small = el('small'); small.append(el('span', '', state.problem.sentence.before), el('b', '', state.problem.prompt.match(/「(.+?)」/)?.[1] ?? ''), el('span', '', state.problem.sentence.after)); prompt.append(small); }
        state.problem.choices.forEach((choice, i) => { choiceButtons[i].textContent = choice.text; choiceButtons[i].dataset.choice = choice.choiceId; });
        const word = state.problem.kind === 'en2ja' ? state.problem.prompt.split(' ')[0] : null;
        if (word) Speech.speakEnglish(word);
        const door = thingNodes.get(state.problem.doorId); if (door) restartClass(door, 'mz-knock');
      } else prompt.textContent = state.phase === 'walking' ? '行きたいマスをタップして 道を見よう。🏁 がゴール！' : state.phase === 'cleared' ? `${state.floor + 1}かい クリア！` : state.phase === 'completed' ? 'ゴール！' : '';
    }
    choiceButtons.forEach(button => { const hint = String(!!state.hintChoiceId && button.dataset.choice === state.hintChoiceId); if (button.dataset.hint !== hint) button.dataset.hint = hint; });
    const titleText = state.phase === 'completed' ? '' : `${state.floor + 1}かい / ${state.floors}　あけたとびら ${state.opened}/${state.total}`;
    if (title.textContent !== titleText) title.textContent = titleText;
  };
  const showAnswer = state => {
    const a = state.lastAnswer;
    if (a.correct) { note.textContent = `とびらが あいた！ ${a.explain}`; fx.pop(50, 45, 'ひらいた！', 'great'); }
    else note.textContent = `おしい！ 答えは「${a.answerText}」（「${a.chosen}」${a.note ? `は${a.note}` : 'ではないよ'}）。光っている答えを えらぼう`;
    frame.announce(note.textContent);
  };
  const showFriend = state => {
    const who = castAt(cast?.wild, state.lastFriend.index);
    if (who) { const img = el('img'); img.alt = who.name; img.src = who.imageUrl; party.append(img); }
    note.textContent = `${who ? who.name : 'なかま'}が なかまになった！`;
    fx.pop(50, 40, 'なかまになった！', 'great');
    frame.announce(note.textContent);
  };

  return {
    root,
    attachCompanion(portrait) { token.remove?.(); player.append(portrait); },
    focusPlay() { arrows[0]?.focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      if (!state.cells?.length) return;
      render(state);
      if (state.lastAnswer && state.lastAnswer.answer !== shownAnswer) { shownAnswer = state.lastAnswer.answer; showAnswer(state); }
      if (state.lastFriend && state.lastFriend.meet !== shownFriend) { shownFriend = state.lastFriend.meet; showFriend(state); }
      if (state.phase === 'cleared' && note.dataset.floor !== String(state.floor)) { note.dataset.floor = String(state.floor); fx.banner(`${state.floor + 1}かい クリア！`, 'great'); }
      if (state.result && !doneShown) {
        doneShown = true;
        fx.banner('迷路 クリア！', 'great'); fx.burst(50, 50, 'great', 2);
        note.textContent = `${state.result.floors}かい ぜんぶ クリア！ あけたとびら ${state.result.opened}・なかま ${state.result.friends}ひき`;
      }
    },
    present(play, dt, state) {
      if (!active || !state) return;
      frame.tick(dt);
      const w = play.world || {};
      const event = w.lastEvent;
      if (event && event.id !== lastEventId) {
        lastEventId = event.id;
        if (event.type === 'boost') { fx.banner('迷路フィーバー！', 'great'); fx.flash('great'); }
      }
      const mission = w.challenge;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: Math.min(1, (state.opened ?? 0) / (state.total || 1)), progressLabel: `とびら ${state.opened ?? 0}/${state.total ?? 0}`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; clearRoute(); [...choiceButtons, ...arrows, ...cellNodes, leave, go].forEach(button => { button.disabled = true; }); },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
