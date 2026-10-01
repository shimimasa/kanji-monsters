import { createArcadeFrame, restartClass, bindArcadeKeys } from '../arcade/arcadeKit.js';
import { castAt } from '../gotomonCast.js';
import Speech from '../../audio/speech.js';
import { HOP_RULES as R } from './hopGame.js';

const ROWS = R.homeRow + 1;
// The course is a box cols:ROWS; a cell's centre is at left = (x + 0.5) / cols, bottom = (row + 0.5) / ROWS.
const CSS = `
#gotomonHopScreen .ya-field{background:linear-gradient(#8fd96b,#5fbf4a)}
#gotomonHopScreen .hp-wrap{position:absolute;left:0;right:0;top:58px;bottom:6px;container-type:size;display:grid;place-items:center}
#gotomonHopScreen .hp-course{position:relative;width:min(98cqw,calc(98cqh * ${R.cols} / ${ROWS}));aspect-ratio:${R.cols}/${ROWS};overflow:hidden;border-radius:16px;touch-action:none;box-shadow:0 0 0 4px #fff8,0 10px 18px #0004}
#gotomonHopScreen .hp-band{position:absolute;left:0;right:0;height:${100 / ROWS}%}
#gotomonHopScreen .hp-band[data-kind=grass]{background:repeating-linear-gradient(90deg,#6cc04a 0 ${100 / R.cols}%,#79c957 ${100 / R.cols}% ${200 / R.cols}%)}
#gotomonHopScreen .hp-band[data-kind=road]{background:linear-gradient(#0000 47%,#ffffffb0 47% 53%,#0000 53%) 0 0/${200 / R.cols}% 100%,#4a4e69;background-repeat:repeat-x}
#gotomonHopScreen .hp-band[data-kind=road]+.hp-band[data-kind=road]{box-shadow:inset 0 -3px 0 #ffd166}
#gotomonHopScreen .hp-band[data-kind=river]{background:radial-gradient(ellipse at 30% 40%,#ffffff40 0 6%,transparent 7%) 0 0/${200 / R.cols}% 100%,linear-gradient(#3a86ff,#2f6fdc);animation:hp-wave 2.4s linear infinite}
#gotomonHopScreen .hp-band[data-kind=hedge]{background:radial-gradient(circle at 50% 70%,#2e7d32 0 45%,transparent 46%) 0 0/${100 / R.cols / 2}% 100%,#388e3c}
#gotomonHopScreen .hp-thing{position:absolute;pointer-events:none}
#gotomonHopScreen .hp-cart{height:${76 / ROWS}%;border-radius:10px;background:linear-gradient(#ff8a65,#e64a19);box-shadow:inset 0 -5px 0 #0003,0 3px 0 #0004;display:flex;align-items:center;justify-content:center;transform:translateY(50%);z-index:3}
#gotomonHopScreen .hp-cart[data-len="2"]{background:linear-gradient(#ffd54f,#f9a825)}
#gotomonHopScreen .hp-cart img{height:120%;aspect-ratio:1;object-fit:contain;margin-top:-30%;filter:drop-shadow(0 2px 2px #0005)}
#gotomonHopScreen .hp-cart[data-dir="-1"] img{transform:scaleX(-1)}
#gotomonHopScreen .hp-log{height:${70 / ROWS}%;border-radius:999px;background:repeating-linear-gradient(90deg,#8d5a2b 0 12px,#a0693a 12px 14px);box-shadow:inset 0 -5px 0 #0003,inset 0 4px 0 #ffffff30;transform:translateY(50%);z-index:2}
#gotomonHopScreen .hp-log[data-float=true]{background:radial-gradient(circle at 25% 50%,#66bb6a 0 22%,transparent 23%),radial-gradient(circle at 75% 50%,#66bb6a 0 22%,transparent 23%);box-shadow:none;display:flex;justify-content:space-around;align-items:center}
#gotomonHopScreen .hp-log img{height:110%;aspect-ratio:1;object-fit:contain;animation:hp-bob 1s ease-in-out infinite alternate}
#gotomonHopScreen .hp-home{width:${100 / R.cols * 1.3}%;height:${100 / ROWS}%;transform:translate(-50%,50%);display:flex;flex-direction:column;align-items:center;justify-content:flex-end;border-radius:12px 12px 0 0;background:#c8e6c9;box-shadow:inset 0 0 0 3px #fff;z-index:2}
#gotomonHopScreen .hp-home img{position:absolute;bottom:38%;height:62%;aspect-ratio:1;object-fit:contain;filter:drop-shadow(0 2px 2px #0005)}
#gotomonHopScreen .hp-plate{position:relative;margin-bottom:6%;padding:1px 6px;border-radius:8px;background:#fff;color:#1b2a36;border:3px solid #ff7a59;font-size:clamp(13px,4.2cqh,26px);font-weight:900;line-height:1.1;white-space:nowrap;z-index:1}
#gotomonHopScreen .hp-plate[data-size=s]{font-size:clamp(11px,3.6cqh,22px)}
#gotomonHopScreen .hp-plate[data-size=xs]{font-size:clamp(10px,3cqh,19px);padding:1px 4px}
#gotomonHopScreen .hp-home[data-hint=true]{box-shadow:inset 0 0 0 3px #fff,0 0 0 4px #37c871,0 0 18px #37c871;animation:hp-glow .7s ease-in-out infinite alternate}
#gotomonHopScreen .hp-home[data-hint=true] .hp-plate{border-color:#37c871}
#gotomonHopScreen .hp-home[data-gone=true]{filter:grayscale(1);opacity:.45}
#gotomonHopScreen .hp-home[data-near=true] .hp-plate{border-color:#ffd166;box-shadow:0 0 0 3px #ffd166}
#gotomonHopScreen .hp-star{width:${100 / R.cols}%;transform:translate(-50%,50%);text-align:center;font-size:clamp(16px,6cqh,34px);line-height:1;z-index:2;animation:hp-bob .9s ease-in-out infinite alternate}
#gotomonHopScreen .hp-friend{width:${80 / R.cols}%;aspect-ratio:1;transform:translate(-50%,50%);z-index:2;animation:hp-bob 1.2s ease-in-out infinite alternate}
#gotomonHopScreen .hp-friend img{width:100%;height:100%;object-fit:contain}
#gotomonHopScreen .hp-friend::after{content:'？';position:absolute;right:-12%;top:-18%;color:#fff;font-weight:900;font-size:clamp(12px,3.5cqh,20px);text-shadow:0 1px 2px #0008}
#gotomonHopScreen .hp-player{position:absolute;width:${92 / R.cols}%;aspect-ratio:1;transform:translate(-50%,50%);z-index:5;pointer-events:none;transition:bottom .12s ease-out}
#gotomonHopScreen .hp-player>*{width:100%!important;height:100%!important;object-fit:contain;filter:drop-shadow(0 4px 3px #0005)}
#gotomonHopScreen .hp-player.hp-hop>*{animation:hp-hop .15s ease-out}
#gotomonHopScreen .hp-player.hp-oops>*{animation:hp-oops .7s ease-out}
#gotomonHopScreen .hp-player[data-bubble=true]::after{content:'';position:absolute;inset:-14%;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ffffffb0 0 10%,#bde0fe40 11% 60%,#a2d2ff90 61% 66%,transparent 67%);animation:hp-bob 1s ease-in-out infinite alternate}
#gotomonHopScreen .hp-token{border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff,#ffcf5a)}
#gotomonHopScreen .hp-title{margin:0;text-align:center;font-size:14px;font-weight:900;color:#bfe3ff}
#gotomonHopScreen .hp-prompt{margin:0;padding:8px 12px;border-radius:14px;background:#ffffff14;color:#fff;text-align:center;font-size:clamp(20px,2.8vw,28px);font-weight:900;line-height:1.3}
#gotomonHopScreen .hp-prompt small{display:block;margin-top:4px;font-size:15px;font-weight:700;color:#d4e8ff}
#gotomonHopScreen .hp-prompt small b{color:#ffe066}
#gotomonHopScreen .hp-pad{display:grid;grid-template-columns:repeat(3,clamp(58px,7vw,74px));grid-template-rows:repeat(2,clamp(50px,7vh,62px));gap:6px;justify-content:center}
#gotomonHopScreen .hp-arrow{border:0;border-radius:12px;background:#ffffff26;color:#fff;font:inherit;font-size:24px;font-weight:900;cursor:pointer;touch-action:none}
#gotomonHopScreen .hp-arrow[data-dir=up]{grid-column:2;background:#ffffff3a}
#gotomonHopScreen .hp-arrow[data-dir=left]{grid-column:1;grid-row:2}
#gotomonHopScreen .hp-arrow[data-dir=down]{grid-column:2;grid-row:2}
#gotomonHopScreen .hp-arrow[data-dir=right]{grid-column:3;grid-row:2}
#gotomonHopScreen .hp-help{margin:0;text-align:center;font-size:13px;color:#d4e8ff}
@keyframes hp-bob{from{translate:0 0}to{translate:0 -6%}}
@keyframes hp-glow{from{filter:brightness(1)}to{filter:brightness(1.12)}}
@keyframes hp-wave{from{background-position:0 0,0 0}to{background-position:${200 / R.cols}% 0,0 0}}
@keyframes hp-hop{0%{translate:0 0;scale:1.1 .9}50%{translate:0 -22%;scale:.95 1.08}100%{translate:0 0;scale:1}}
@keyframes hp-oops{0%{rotate:0deg;scale:1}30%{rotate:-25deg;scale:.8}60%{rotate:20deg;scale:.9}100%{rotate:0;scale:1}}
`;
const left = x => `${(x + 0.5) / R.cols * 100}%`;
const bottom = row => `${(row + 0.5) / ROWS * 100}%`;

export function createHopView({ document: doc, dispatch, onBack, getSnapshot, cast }) {
  let active = true, lastEventId = 0, doneShown = false, problemKey = null, questionKey = null;
  let shownHome = 0, shownOops = 0, shownPickup = 0, shownBlock = 0, shownHelp = 0, lastHops = 0, start = null;
  const removes = [], things = new Map(), homeNodes = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'gotomonHopScreen', title: 'ゴトモン・川わたり', theme: 'hop' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });

  const wrap = el('div', 'hp-wrap');
  const course = el('div', 'hp-course'); course.setAttribute('aria-label', '道路と川のコース');
  for (let r = 0; r < ROWS; r++) {
    const kind = R.roads.includes(r) ? 'road' : R.river.includes(r) ? 'river' : r === R.homeRow ? 'hedge' : 'grass';
    const band = el('div', 'hp-band'); band.dataset.kind = kind; band.style.bottom = `${r / ROWS * 100}%`;
    course.append(band);
  }
  const player = el('div', 'hp-player'), token = el('div', 'hp-token'); player.append(token);
  course.append(player);
  wrap.append(course); world.append(wrap);

  const title = el('p', 'hp-title');
  const prompt = el('p', 'hp-prompt'); prompt.dataset.role = 'problem';
  const pad = el('div', 'hp-pad'), arrows = [];
  const help = el('p', 'hp-help');
  const note = el('p', 'ya-dock-note'); note.dataset.role = 'feedback';
  dock.append(title, prompt, pad, help, note);
  doc.body.append(root);

  const send = dir => {
    const state = getSnapshot();
    if (!active || state.paused || state.phase !== 'answering') return false;
    return dispatch({ type: 'hop', payload: { sessionId: state.sessionId, attemptId: state.attemptId, dir } });
  };
  for (const [dir, text, label] of [['up', '▲', 'まえへ'], ['left', '◀', 'ひだりへ'], ['down', '▼', 'うしろへ'], ['right', '▶', 'みぎへ']]) {
    const button = el('button', 'hp-arrow', text); button.type = 'button'; button.dataset.dir = dir;
    button.setAttribute('aria-label', label);
    on(button, 'pointerdown', event => { event.preventDefault?.(); send(dir); });
    on(button, 'click', event => { if (event.detail === 0) send(dir); });
    pad.append(button); arrows.push(button);
  }
  // On the course: a swipe hops that way; a tap hops toward the tapped spot (mostly up).
  on(course, 'pointerdown', event => { event.preventDefault?.(); start = [event.clientX, event.clientY]; });
  on(doc, 'pointerup', event => {
    if (!start) return;
    const dx = event.clientX - start[0], dy = event.clientY - start[1]; start = null;
    if (Math.hypot(dx, dy) >= 20) { send(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); return; }
    const box = course.getBoundingClientRect?.(), state = getSnapshot();
    if (!box?.width) return;
    const tx = (event.clientX - box.left) / box.width * R.cols - 0.5, tr = (box.bottom - event.clientY) / box.height * ROWS - 0.5;
    const ox = tx - state.x, oy = tr - state.row;
    send(Math.abs(ox) > Math.abs(oy) + 0.3 ? (ox > 0 ? 'right' : 'left') : (oy < -0.5 ? 'down' : 'up'));
  });
  on(doc, 'pointercancel', () => { start = null; });
  removes.push(bindArcadeKeys(doc, event => {
    const dir = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[event.key];
    if (!dir) return false;
    if (!event.repeat) send(dir);
    return true;
  }));

  const renderPrompt = state => {
    const key = state.problem?.problemId ?? null;
    if (key === problemKey) return;
    const base = id => id?.split(':').slice(0, -1).join(':');
    const sameQuestion = problemKey && key && base(problemKey) === base(key);
    problemKey = key;
    if (!state.problem) { prompt.textContent = state.phase === 'completed' ? 'ぜんぶ わたれた！' : ''; return; }
    prompt.textContent = state.problem.prompt;
    if (state.problem.sentence) { const small = el('small'); small.append(el('span', '', state.problem.sentence.before), el('b', '', state.problem.prompt.match(/「(.+?)」/)?.[1] ?? ''), el('span', '', state.problem.sentence.after)); prompt.append(small); }
    const word = state.problem.kind === 'en2ja' ? state.problem.prompt.split(' ')[0] : null;
    if (word && !sameQuestion) Speech.speakEnglish(word);
  };
  // A new question: new homes with their Gotomon and plates.
  const buildHomes = state => {
    homeNodes.splice(0).forEach(node => node.remove?.());
    for (const home of state.homes) {
      const node = el('div', 'hp-thing hp-home'); node.dataset.plate = home.plateId;
      node.style.left = left(home.col); node.style.bottom = `${R.homeRow / ROWS * 100}%`;
      const who = castAt(cast?.wild, home.cast);
      if (who) { const img = el('img'); img.alt = ''; img.src = who.imageUrl; node.append(img); }
      // Long plates (English words) get smaller letters, so neighbouring homes' plates never touch.
      const plate = el('span', 'hp-plate', home.text);
      plate.dataset.size = home.text.length >= 8 ? 'xs' : home.text.length >= 6 ? 's' : 'm';
      node.append(plate);
      course.append(node); homeNodes.push(node);
    }
  };
  // Keeps one node per cart, log, star and friend; the rest are removed.
  const sync = (seen, key, make, place) => {
    let node = things.get(key);
    if (!node) { node = make(); course.insertBefore?.(node, player) ?? course.append(node); things.set(key, node); }
    place(node); seen.add(key);
  };
  const render = state => {
    const key = `${state.problemIndex}`;
    if (key !== questionKey && state.homes.length) { questionKey = key; buildHomes(state); }
    const seen = new Set();
    for (const lane of state.lanes) {
      for (const item of lane.items) {
        sync(seen, `i${item.id}`, () => {
          const node = el('div', `hp-thing ${lane.kind === 'road' ? 'hp-cart' : 'hp-log'}`);
          node.dataset.id = item.id; node.dataset.row = String(lane.row);
          node.dataset.len = String(item.len); node.dataset.dir = String(lane.dir); node.dataset.float = String(!!item.float);
          node.style.width = `${item.len / R.cols * 100}%`;
          if (lane.kind === 'road' || item.float) {
            const count = lane.kind === 'road' ? 1 : item.len;
            for (let k = 0; k < count; k++) {
              const who = castAt(cast?.wild, 20 + item.cast + k);
              if (who) { const img = el('img'); img.alt = ''; img.src = who.imageUrl; node.append(img); }
            }
          }
          return node;
        }, node => { node.style.left = `${(item.x + 0.5) / R.cols * 100}%`; node.style.bottom = bottom(lane.row); });
      }
    }
    for (const star of state.stars) sync(seen, star.starId, () => el('div', 'hp-thing hp-star', '⭐'), node => { node.style.left = left(star.x); node.style.bottom = bottom(star.row); });
    if (state.friend) {
      const f = state.friend;
      sync(seen, f.friendId, () => {
        const node = el('div', 'hp-thing hp-friend'), who = castAt(cast?.wild, 40 + f.cast);
        if (who) { const img = el('img'); img.alt = ''; img.src = who.imageUrl; node.append(img); }
        return node;
      }, node => { node.style.left = left(f.x); node.style.bottom = bottom(f.row); });
    }
    for (const [id, node] of things) if (!seen.has(id)) { node.remove?.(); things.delete(id); }
    state.homes.forEach((home, i) => {
      const node = homeNodes[i]; if (!node) return;
      const set = (k, v) => { if (node.dataset[k] !== v) node.dataset[k] = v; };
      set('hint', String(home.plateId === state.hintPlateId));
      set('gone', String(home.gone));
      set('near', String(state.row === R.bank && Math.round(state.x) === home.col && !home.gone));
    });
    player.style.left = left(state.x); player.style.bottom = bottom(state.row);
    const bubble = String(!!state.bubble);
    if (player.dataset.bubble !== bubble) player.dataset.bubble = bubble;
    if (state.hops !== lastHops) { lastHops = state.hops; restartClass(player, 'hp-hop'); }
    const helpText = state.phase !== 'answering' ? help.textContent
      : state.row === R.bank ? '答えの おうちの 前まで よこに あるいて、▲で 入ろう'
        : R.river.includes(state.row) ? 'まるたや ゴトモンに のって わたろう。水には おちないでね'
          : '▲▼◀▶ か スワイプで ぴょん。荷車に 気をつけて！';
    if (help.textContent !== helpText) help.textContent = helpText;
  };
  const say = text => { note.textContent = text; frame.announce(text); };
  const showHome = state => {
    const home = state.lastHome, x = (home.col + 0.5) / R.cols * 100;
    if (home.correct) {
      fx.burst(x, 18, home.first ? 'great' : 'good', home.first ? 1.4 : 1.1);
      fx.pop(Math.max(14, Math.min(80, x)), 24, 'ただいま！', 'great');
      say(`おうちに ついた！ ${home.explain}`);
    } else {
      fx.pop(Math.max(14, Math.min(80, x)), 24, 'あれれ？', 'soft');
      say(`そのおうちは「${home.text}」${home.note ? `（${home.note}）` : ''}。答えは「${home.answer}」。光る おうちへ 行こう`);
    }
  };
  const showOops = state => {
    restartClass(player, 'hp-oops');
    const oops = state.lastOops;
    fx.pop(Math.max(14, Math.min(80, (oops.x + 0.5) / R.cols * 100)), Math.max(14, 100 - (oops.row + 0.5) / ROWS * 100), oops.kind === 'cart' ? 'ドン！' : 'ぽちゃん！', 'soft');
    say(oops.kind === 'cart' ? 'あぶない！ スタートから もう一度 わたろう' : 'ぽちゃん！ 中州から もう一度 わたろう');
  };
  const showPickup = state => {
    const pickup = state.lastPickup;
    if (pickup.kind === 'star') fx.pop(Math.max(14, Math.min(80, (pickup.x + 0.5) / R.cols * 100)), 60, '⭐ ゲット！', 'good');
    else {
      const who = castAt(cast?.wild, 40 + pickup.cast);
      fx.pop(50, 55, 'なかまに なった！', 'great');
      say(`${who ? who.name : 'ゴトモン'}が なかまに なった！`);
    }
  };
  const showHelp = state => {
    if (state.lastHelp.level === 1) { fx.pop(50, 45, 'ゆっくり モード', 'good'); say('ゴトモンたちが ゆっくり うごいてくれるよ'); }
    else { fx.banner('シャボン玉で まもるよ！', 'great'); say('ゴトモンが シャボン玉で まもってくれる！ このまま ▲で わたろう'); }
  };
  const showBlock = state => say(state.lastBlock.gone ? 'そのおうちは しまっているよ。光る おうちへ 行こう' : 'ここは しげみ。おうちの 前で ▲を おそう');

  return {
    root,
    // The companion does the hopping.
    attachCompanion(portrait) { token.remove?.(); player.append(portrait); },
    focusPlay() { arrows[0]?.focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      if (!state.lanes) return;
      renderPrompt(state); render(state);
      if (state.lastHome && state.lastHome.home !== shownHome) { shownHome = state.lastHome.home; showHome(state); }
      if (state.lastOops && state.lastOops.oops !== shownOops) { shownOops = state.lastOops.oops; showOops(state); }
      if (state.lastPickup && state.lastPickup.pickup !== shownPickup) { shownPickup = state.lastPickup.pickup; showPickup(state); }
      if (state.lastHelp && state.lastHelp.help !== shownHelp) { shownHelp = state.lastHelp.help; showHelp(state); }
      if (state.lastBlock && state.lastBlock.block !== shownBlock) { shownBlock = state.lastBlock.block; showBlock(state); }
      const titleText = state.phase === 'completed' ? '' : `もんだい ${state.problemIndex + 1}/${state.total}　⭐${state.starsTaken}`;
      if (title.textContent !== titleText) title.textContent = titleText;
      if (state.result && !doneShown) {
        doneShown = true;
        fx.banner('ぜんぶ わたれた！', 'great'); fx.burst(50, 40, 'great', 2);
        note.textContent = `12回 わたった！ ⭐${state.result.stars}${state.result.friends ? `・なかま ${state.result.friends}ひき` : ''}`;
      }
    },
    present(play, dt, state) {
      if (!active || !state) return;
      frame.tick(dt);
      const w = play.world || {};
      const event = w.lastEvent;
      if (event && event.id !== lastEventId) {
        lastEventId = event.id;
        if (event.type === 'boost') { fx.banner('ぴょんぴょんフィーバー！', 'great'); fx.flash('great'); }
      }
      const mission = w.challenge, done = state.result ? state.total : state.problemIndex ?? 0;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: Math.min(1, done / (state.total || 1)), progressLabel: state.result ? 'ぜんぶ わたれた！' : `おうち ${Math.min(done, state.total ?? 0)}/${state.total ?? 0}`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; start = null; arrows.forEach(button => { button.disabled = true; }); },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
