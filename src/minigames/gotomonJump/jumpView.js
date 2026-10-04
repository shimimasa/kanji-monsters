import { createArcadeFrame, restartClass, bindArcadeKeys } from '../arcade/arcadeKit.js';
import { castAt } from '../gotomonCast.js';
import Speech from '../../audio/speech.js';
import { JUMP_RULES as R } from './jumpGame.js';

// The tower is a column in the field, 3 wide by 4 high; one tower height is 100% of it.
// Things stand on their y: bottom = (y - camera) * 100%.
const CSS = `
#gotomonJumpScreen .ya-field{background:linear-gradient(#7ec8f2,#bfe6ff 60%,#e8f6ff)}
#gotomonJumpScreen .jp-tower{position:absolute;left:50%;top:58px;bottom:0;aspect-ratio:3/4;max-width:100%;transform:translateX(-50%);overflow:hidden;touch-action:none;
  background:radial-gradient(circle at 20% 30%,#ffffffb0 0 6%,transparent 7%) 0 var(--sky,0px)/100% 70% ,radial-gradient(circle at 75% 70%,#ffffff90 0 5%,transparent 6%) 0 var(--sky2,0px)/100% 55%,linear-gradient(#5aa9e6,#9fd6f7);border-inline:3px solid #ffffff80}
#gotomonJumpScreen .jp-thing{position:absolute;transform:translateX(-50%);pointer-events:none}
#gotomonJumpScreen .jp-ledge{height:12px;border-radius:8px;background:linear-gradient(#7ed957,#4caf3c);box-shadow:0 4px 0 #2f7d24;z-index:2}
#gotomonJumpScreen .jp-ledge[data-kind=move]{background:linear-gradient(#ffd166,#f4a93b);box-shadow:0 4px 0 #b9741c}
#gotomonJumpScreen .jp-ledge[data-kind=spring]::after{content:'';position:absolute;left:50%;bottom:100%;width:22px;height:14px;transform:translateX(-50%);border-radius:5px 5px 0 0;background:repeating-linear-gradient(#e74c3c 0 3px,#fff 3px 6px)}
#gotomonJumpScreen .jp-ledge[data-locked=true]{opacity:.35;filter:grayscale(.6)}
#gotomonJumpScreen .jp-cloud{width:${R.cloudW * 100}%;height:clamp(40px,9%,64px);margin-bottom:calc(clamp(40px,9%,64px) * -0.55);display:grid;place-items:center;border-radius:40px;background:#fff;box-shadow:0 5px 0 #b8d4ea,inset 0 -6px 0 #e3f0fa;color:#1b2a36;font-size:clamp(14px,2.6vh,24px);font-weight:900;line-height:1.05;text-align:center;padding:0 4px;z-index:3}
#gotomonJumpScreen .jp-cloud img{position:absolute;left:50%;bottom:78%;width:clamp(34px,7vh,56px);height:clamp(34px,7vh,56px);transform:translateX(-50%);object-fit:contain;filter:drop-shadow(0 3px 2px #0004);animation:jp-bob 1.1s ease-in-out infinite alternate}
#gotomonJumpScreen .jp-cloud[data-hint=true]{box-shadow:0 5px 0 #1f9d55,0 0 0 5px #37c871,0 0 22px #37c871;animation:jp-glow .7s ease-in-out infinite alternate}
#gotomonJumpScreen .jp-cloud[data-chosen=true]{box-shadow:0 5px 0 #f59f00,0 0 0 5px #ffd43b,0 0 18px #ffd43b}
#gotomonJumpScreen .jp-cloud[data-gone=true]{opacity:0;transform:translateX(-50%) scale(1.4);transition:opacity .35s,transform .35s}
#gotomonJumpScreen .jp-ceiling{left:0!important;right:0;transform:none;height:6px;background:repeating-linear-gradient(90deg,#ff7a7a 0 12%,#ffd166 0 24%,#7ed957 0 36%,#6ac6ff 0 48%,#b48cff 0 60%);opacity:.55;z-index:1}
#gotomonJumpScreen .jp-star{width:clamp(22px,4.4vh,36px);font-size:clamp(20px,4vh,32px);line-height:1;text-align:center;z-index:2;animation:jp-bob .9s ease-in-out infinite alternate}
#gotomonJumpScreen .jp-balloon{width:clamp(40px,8vh,62px);z-index:2;animation:jp-bob 1.3s ease-in-out infinite alternate}
#gotomonJumpScreen .jp-balloon::before{content:'';display:block;width:60%;aspect-ratio:4/5;margin:0 auto -6%;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff9 0 12%,transparent 14%),#ff6f91;box-shadow:inset -4px -6px 0 #0002}
#gotomonJumpScreen .jp-balloon img{display:block;width:100%;aspect-ratio:1;object-fit:contain}
#gotomonJumpScreen .jp-goal{left:50%;width:70%;padding:6px 0;border-radius:16px;background:linear-gradient(90deg,#ffd166,#fff3b0,#ffd166);color:#7a4a00;font-size:clamp(18px,3.4vh,28px);font-weight:900;text-align:center;box-shadow:0 0 18px #ffd166;z-index:2}
#gotomonJumpScreen .jp-tramp{position:absolute;left:4%;right:4%;bottom:0;height:16px;border-radius:12px 12px 0 0;background:repeating-linear-gradient(90deg,#3a86ff 0 18px,#ffbe0b 18px 36px);box-shadow:0 -3px 0 #fff8;z-index:4;pointer-events:none}
#gotomonJumpScreen .jp-tramp.jp-boing{animation:jp-boing .3s ease-out}
#gotomonJumpScreen .jp-player{position:absolute;width:clamp(48px,${R.playerW * 100}%,80px);aspect-ratio:1;transform:translateX(-50%);z-index:5;pointer-events:none}
#gotomonJumpScreen .jp-player>*{width:100%!important;height:100%!important;object-fit:contain;filter:drop-shadow(0 4px 3px #0005)}
#gotomonJumpScreen .jp-player[data-face=left]>*{transform:scaleX(-1)}
#gotomonJumpScreen .jp-player.jp-squash{animation:jp-squash .25s ease-out}
#gotomonJumpScreen .jp-player[data-super=true]::after{content:'';position:absolute;left:20%;right:20%;top:85%;height:120%;border-radius:40%;background:linear-gradient(#fff9,#fff0);z-index:-1}
#gotomonJumpScreen .jp-token{border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff,#ffcf5a)}
#gotomonJumpScreen .jp-party{position:absolute;right:1%;top:62px;display:flex;flex-direction:column;gap:2px;align-items:center;color:#1b2a36;font-size:11px;font-weight:900;z-index:3}
#gotomonJumpScreen .jp-party img{width:clamp(26px,4.6vh,40px);height:clamp(26px,4.6vh,40px);object-fit:contain;animation:jp-join .5s ease-out}
#gotomonJumpScreen .jp-title{margin:0;text-align:center;font-size:14px;font-weight:900;color:#bfe3ff}
#gotomonJumpScreen .jp-prompt{margin:0;padding:8px 12px;border-radius:14px;background:#ffffff14;color:#fff;text-align:center;font-size:clamp(20px,2.8vw,28px);font-weight:900;line-height:1.3}
#gotomonJumpScreen .jp-prompt small{display:block;margin-top:4px;font-size:15px;font-weight:700;color:#d4e8ff}
#gotomonJumpScreen .jp-prompt small b{color:#ffe066}
#gotomonJumpScreen .jp-pad{display:grid;grid-template-columns:1fr 1fr;gap:10px}
#gotomonJumpScreen .jp-arrow{min-height:clamp(56px,9vh,76px);border:0;border-radius:16px;background:#ffffff26;color:#fff;font:inherit;font-size:28px;font-weight:900;cursor:pointer;touch-action:none}
#gotomonJumpScreen .jp-arrow[data-held=true]{background:#ffe06655}
#gotomonJumpScreen .jp-help{margin:0;text-align:center;font-size:13px;color:#d4e8ff}
@keyframes jp-bob{from{translate:0 0}to{translate:0 -10%}}
@keyframes jp-glow{from{filter:brightness(1)}to{filter:brightness(1.12)}}
@keyframes jp-squash{0%{scale:1.25 .75}100%{scale:1 1}}
@keyframes jp-boing{0%{transform:scaleY(.4)}100%{transform:none}}
@keyframes jp-join{from{transform:scale(.2);opacity:0}to{transform:none;opacity:1}}
`;

export function createJumpView({ document: doc, dispatch, onBack, getSnapshot, cast }) {
  let active = true, lastEventId = 0, doneShown = false, shownLanding = 0, shownPickup = 0, problemKey = null, rowKey = null, held = null, lastX = null;
  const removes = [], cloudNodes = [], things = new Map();
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'gotomonJumpScreen', title: 'ゴトモン・ジャンプ', theme: 'jump' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });

  const tower = el('div', 'jp-tower'); tower.setAttribute('aria-label', 'ゴトモンの塔');
  const ceiling = el('div', 'jp-thing jp-ceiling'); ceiling.hidden = true;
  const goal = el('div', 'jp-thing jp-goal', '🌈 ゴール 🌈'); goal.hidden = true;
  const tramp = el('div', 'jp-tramp');
  const player = el('div', 'jp-player'), token = el('div', 'jp-token'); player.append(token);
  tower.append(ceiling, goal, tramp, player);
  const party = el('div', 'jp-party'); party.append(el('span', '', 'なかま'));
  world.append(tower, party);

  // Holding a finger on the tower steers toward it; letting go stops.
  const towerX = event => {
    const box = tower.getBoundingClientRect?.(); if (!box?.width) return null;
    return Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
  };
  const steer = (dir, toX) => {
    const state = getSnapshot();
    if (!active || state.paused || state.phase !== 'answering') return false;
    return dispatch({ type: 'move', payload: { sessionId: state.sessionId, attemptId: state.attemptId, dir, toX } });
  };
  // A tap on a cloud chooses it as the answer (the companion glides onto it); elsewhere the finger steers.
  const choose = plateId => {
    const state = getSnapshot();
    if (!active || state.paused || state.phase !== 'answering') return false;
    const ok = dispatch({ type: 'choose', payload: { sessionId: state.sessionId, attemptId: state.attemptId, plateId } });
    if (ok) { note.textContent = 'その雲に きめた！ あいぼうが おりていくよ'; frame.announce(note.textContent); }
    return ok;
  };
  const cloudAt = event => cloudNodes.find(node => {
    if (node.dataset.gone === 'true') return false;
    const r = node.getBoundingClientRect?.();
    return r?.width && event.clientX >= r.left - 6 && event.clientX <= r.right + 6 && event.clientY >= r.top - 40 && event.clientY <= r.bottom + 6;
  });
  on(tower, 'pointerdown', event => {
    event.preventDefault?.();
    const cloud = cloudAt(event);
    if (cloud) { choose(cloud.dataset.plate); return; }
    held = 'finger'; steer(0, towerX(event));
  });
  on(doc, 'pointermove', event => { if (held === 'finger') steer(0, towerX(event)); });
  const release = () => { if (held) { held = null; steer(0, null); arrows.forEach(button => { button.dataset.held = 'false'; }); } };
  on(doc, 'pointerup', release); on(doc, 'pointercancel', release);

  const title = el('p', 'jp-title');
  const prompt = el('p', 'jp-prompt'); prompt.dataset.role = 'problem';
  const pad = el('div', 'jp-pad'), arrows = [];
  for (const [dir, text, label] of [[-1, '◀', 'ひだりへ'], [1, '▶', 'みぎへ']]) {
    const button = el('button', 'jp-arrow', text); button.type = 'button'; button.dataset.dir = String(dir);
    button.setAttribute('aria-label', label);
    on(button, 'pointerdown', event => { event.preventDefault?.(); held = 'arrow'; button.dataset.held = 'true'; steer(dir, null); });
    pad.append(button); arrows.push(button);
  }
  const help = el('p', 'jp-help', '塔をゆびで おさえると、そっちへ うごくよ。答えの雲は タップして えらぼう！');
  const note = el('p', 'ya-dock-note'); note.dataset.role = 'feedback';
  dock.append(title, prompt, pad, help, note);
  doc.body.append(root);

  removes.push(bindArcadeKeys(doc, event => {
    const n = Number(event.key);
    if (n >= 1 && n <= R.clouds) { const plate = getSnapshot().row?.plates[n - 1]; if (plate) choose(plate.plateId); return true; }
    const dir = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (!dir) return false;
    if (!event.repeat) { held = 'key'; steer(dir, null); }
    return true;
  }));
  const keyUp = event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key) && held === 'key') { held = null; steer(0, null); } };
  doc.addEventListener('keyup', keyUp); removes.push(() => doc.removeEventListener('keyup', keyUp));

  const at = (node, x, y, camera) => { node.style.left = `${x * 100}%`; node.style.bottom = `${(y - camera) * 100}%`; };
  // Keeps one node per ledge, star and balloon on screen; the rest are removed.
  const sync = (list, key, make, camera) => {
    const seen = new Set();
    for (const item of list) {
      const id = item[key]; seen.add(id);
      let node = things.get(id);
      if (!node) { node = make(item); tower.append(node); things.set(id, node); }
      at(node, item.x, item.y, camera);
      if (item.locked !== undefined && node.dataset.locked !== String(item.locked)) node.dataset.locked = String(item.locked);
    }
    return seen;
  };
  const renderPrompt = state => {
    const key = state.problem?.contentId ?? (state.goalAt !== null ? 'goal' : null);
    if (key === problemKey) return;
    problemKey = key;
    if (!state.problem) { prompt.textContent = state.phase === 'completed' ? 'ゴール！' : 'にじの ゴールへ ジャンプ！'; return; }
    prompt.textContent = state.problem.prompt;
    if (state.problem.sentence) { const small = el('small'); small.append(el('span', '', state.problem.sentence.before), el('b', '', state.problem.prompt.match(/「(.+?)」/)?.[1] ?? ''), el('span', '', state.problem.sentence.after)); prompt.append(small); }
    const word = state.problem.kind === 'en2ja' ? state.problem.prompt.split(' ')[0] : null;
    if (word) Speech.speakEnglish(word);
  };
  const renderRow = state => {
    const row = state.row;
    if ((row?.rowId ?? null) !== rowKey) {
      rowKey = row?.rowId ?? null;
      cloudNodes.splice(0).forEach(node => node.remove?.());
      if (row) row.plates.forEach((plate, i) => {
        const node = el('div', 'jp-thing jp-cloud'), who = castAt(cast?.wild, row.part * R.clouds + i);
        if (who) { const img = el('img'); img.alt = ''; img.src = who.imageUrl; node.append(img); }
        node.append(el('span', '', plate.text)); node.dataset.plate = plate.plateId;
        tower.append(node); cloudNodes.push(node);
      });
    }
    ceiling.hidden = !row;
    if (!row) return;
    at(ceiling, 0, row.y + R.above - 0.1 + 0.12, state.camera);
    row.plates.forEach((plate, i) => {
      const node = cloudNodes[i]; if (!node) return;
      at(node, plate.x, row.y, state.camera);
      const hint = String(plate.plateId === state.hintPlateId), gone = String(plate.gone), chosen = String(plate.plateId === state.chosenPlateId);
      if (node.dataset.hint !== hint) node.dataset.hint = hint;
      if (node.dataset.chosen !== chosen) node.dataset.chosen = chosen;
      if (node.dataset.gone !== gone) node.dataset.gone = gone;
    });
  };
  const render = state => {
    const camera = state.camera;
    tower.style.setProperty?.('--sky', `${camera * 60}%`); tower.style.setProperty?.('--sky2', `${camera * 35}%`);
    const seen = new Set([
      ...sync(state.ledges, 'ledgeId', ledge => { const node = el('div', 'jp-thing jp-ledge'); node.dataset.kind = ledge.kind; node.style.width = `${ledge.w * 100}%`; return node; }, camera),
      ...sync(state.stars, 'starId', () => el('div', 'jp-thing jp-star', '⭐'), camera),
      ...sync(state.balloons, 'balloonId', balloon => {
        const node = el('div', 'jp-thing jp-balloon'), who = castAt(cast?.wild, 48 + balloon.cast);
        if (who) { const img = el('img'); img.alt = ''; img.src = who.imageUrl; node.append(img); }
        return node;
      }, camera),
    ]);
    for (const [id, node] of things) if (!seen.has(id)) { node.remove?.(); things.delete(id); }
    renderRow(state);
    goal.hidden = state.goalY === null || state.problemIndex < state.total - 1;
    if (state.goalY !== null) at(goal, 0.5, state.goalY, camera);
    at(player, state.x, state.y, camera);
    player.dataset.super = String(state.vy > 2.5);
    // The companion faces the way it moves.
    if (lastX !== null) {
      let dx = state.x - lastX; if (dx > 0.5) dx -= 1; if (dx < -0.5) dx += 1;
      if (Math.abs(dx) > 0.001) { const face = dx < 0 ? 'left' : 'right'; if (player.dataset.face !== face) player.dataset.face = face; }
    }
    lastX = state.x;
  };
  const showLanding = state => {
    const landing = state.lastLanding, x = landing.x * 100;
    if (landing.correct) {
      restartClass(player, 'jp-squash');
      fx.burst(50, 45, landing.first ? 'great' : 'good', landing.first ? 1.4 : 1.1);
      fx.pop(50, 40, 'スーパージャンプ！', 'great');
      note.textContent = `スーパージャンプ！ ${landing.explain}`;
    } else {
      fx.pop(Math.max(15, Math.min(85, x)), 55, 'ふわっ…', 'soft');
      note.textContent = `その雲は「${landing.text}」${landing.note ? `（${landing.note}）` : ''}。答えは「${landing.answer}」。光る雲を めざそう`;
    }
    frame.announce(note.textContent);
  };
  const showPickup = state => {
    const pickup = state.lastPickup;
    if (pickup.kind === 'trampoline' || pickup.kind === 'big') restartClass(tramp, 'jp-boing');
    restartClass(player, 'jp-squash');
    if (pickup.kind === 'star') fx.pop(50, 50, '⭐ ゲット！', 'good');
    else if (pickup.kind === 'spring') fx.pop(50, 55, 'ボヨーン！', 'good');
    else if (pickup.kind === 'big') { fx.pop(50, 55, '大ジャンプ！', 'good'); note.textContent = '大ジャンプ！ 雲の上で、答えの雲に おりよう'; frame.announce(note.textContent); }
    else if (pickup.kind === 'friend') {
      const who = castAt(cast?.wild, 48 + pickup.cast);
      if (who) { const img = el('img'); img.alt = who.name; img.src = who.imageUrl; party.append(img); }
      fx.pop(50, 45, 'なかまになった！', 'great');
      note.textContent = `${who ? who.name : 'ゴトモン'}が なかまになった！`; frame.announce(note.textContent);
    }
  };

  return {
    root,
    // The companion does the jumping.
    attachCompanion(portrait) { token.remove?.(); player.append(portrait); },
    focusPlay() { arrows[0]?.focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      if (!state.ledges) return;
      renderPrompt(state); render(state);
      if (state.lastLanding && state.lastLanding.landing !== shownLanding) { shownLanding = state.lastLanding.landing; showLanding(state); }
      if (state.lastPickup && state.lastPickup.pickup !== shownPickup) { shownPickup = state.lastPickup.pickup; showPickup(state); }
      const titleText = state.phase === 'completed' ? '' : state.goalAt !== null ? 'ゴールへ！' : `もんだい ${state.problemIndex + 1}/${state.total}　⭐${state.starsTaken}`;
      if (title.textContent !== titleText) title.textContent = titleText;
      if (state.result && !doneShown) {
        doneShown = true;
        fx.banner('ゴール！', 'great'); fx.burst(50, 40, 'great', 2);
        note.textContent = `塔の てっぺんに ついた！ スーパージャンプ ${state.result.superJumps}回・⭐${state.result.stars}・なかま ${state.result.friends}ひき`;
      }
    },
    present(play, dt, state) {
      if (!active || !state) return;
      frame.tick(dt);
      const w = play.world || {};
      const event = w.lastEvent;
      if (event && event.id !== lastEventId) {
        lastEventId = event.id;
        if (event.type === 'boost') { fx.banner('ジャンプフィーバー！', 'great'); fx.flash('great'); }
      }
      const mission = w.challenge, done = state.result ? state.total : state.problemIndex ?? 0;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: Math.min(1, done / (state.total || 1)), progressLabel: state.result ? 'ゴール！' : `雲 ${Math.min(done, state.total ?? 0)}/${state.total ?? 0}`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; held = null; arrows.forEach(button => { button.disabled = true; }); },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
