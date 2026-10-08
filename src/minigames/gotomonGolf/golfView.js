import { createArcadeFrame, restartClass, bindArcadeKeys } from '../arcade/arcadeKit.js';
import { castAt } from '../gotomonCast.js';
import Speech from '../../audio/speech.js';
import { GOLF_RULES as R, tracePath } from './golfGame.js';

// The course is a box W:1 in the field; things stand at left = x / W, top = y (centred on their point).
const CSS = `
#gotomonGolfScreen .ya-field{background:radial-gradient(circle at 20% 15%,#b9f3a5 0 10%,transparent 11%),linear-gradient(#8fd96b,#5fbf4a)}
#gotomonGolfScreen .gf-wrap{position:absolute;left:0;right:0;top:58px;bottom:6px;container-type:size;display:grid;place-items:center}
#gotomonGolfScreen .gf-course{position:relative;width:min(98cqw,calc(98cqh * ${R.W}));aspect-ratio:${R.W}/1;border-radius:22px;touch-action:none;
  background:repeating-linear-gradient(90deg,#4caf50 0 6.25%,#58bb5b 6.25% 12.5%);box-shadow:0 0 0 8px #8d5a2b,0 0 0 11px #5e3a19,0 10px 18px #0004;cursor:crosshair}
#gotomonGolfScreen .gf-thing{position:absolute;transform:translate(-50%,-50%);pointer-events:none}
#gotomonGolfScreen .gf-tee{width:${R.ballR * 400 / R.W}%;aspect-ratio:1;border-radius:50%;background:#ffffff55;border:2px dashed #fff9}
#gotomonGolfScreen .gf-wall{position:absolute;border-radius:6px;background:linear-gradient(135deg,#a9744a,#7b4f2c);box-shadow:inset 0 0 0 3px #5e3a19,0 4px 0 #3d250f;pointer-events:none}
#gotomonGolfScreen .gf-bumper{border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff7,#ffb3c6 55%,#ff6f91);box-shadow:0 0 0 3px #fff,0 4px 0 #c2185b;display:grid;place-items:center;z-index:3}
#gotomonGolfScreen .gf-bumper img{width:88%;height:88%;object-fit:contain}
#gotomonGolfScreen .gf-bumper.gf-boing{animation:gf-boing .3s ease-out}
#gotomonGolfScreen .gf-cup{width:${R.cupR * 200 / R.W}%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,#0b2b10 0 55%,#1d4d22 70%,#e9f5e0 72%);z-index:2;pointer-events:auto;cursor:pointer}
#gotomonGolfScreen .gf-flag{position:absolute;left:50%;bottom:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;pointer-events:none}
#gotomonGolfScreen .gf-plate{min-width:2.2em;text-align:center;padding:3px 7px;border-radius:9px;background:#fff;color:#1b2a36;font-size:clamp(15px,4cqh,28px);font-weight:900;line-height:1.1;white-space:nowrap;box-shadow:0 3px 0 #0003;border:3px solid #ff7a59}
#gotomonGolfScreen .gf-cup[data-side=back] .gf-flag{left:auto;right:0;transform:none;align-items:flex-end}
#gotomonGolfScreen .gf-pole{width:3px;height:clamp(10px,2.4cqh,22px);background:#fff}
#gotomonGolfScreen .gf-holder{position:absolute;left:-95%;top:-35%;width:clamp(28px,8cqh,56px);aspect-ratio:1;object-fit:contain;filter:drop-shadow(0 3px 2px #0005);pointer-events:none;transition:left .35s,top .35s}
#gotomonGolfScreen .gf-cup[data-lid=true] .gf-holder{left:0;top:0;width:100%;animation:none}
#gotomonGolfScreen .gf-cup[data-lid=true]{background:radial-gradient(circle,#b07a45 0 60%,#7b4f2c 62% 70%,#e9f5e0 72%)}
#gotomonGolfScreen .gf-cup[data-lid=true] .gf-plate{border-color:#b0bec5;opacity:.75}
#gotomonGolfScreen .gf-cup[data-chosen=true] .gf-plate{border-color:#ffd166;background:#fff8d6;box-shadow:0 0 0 3px #ffd166,0 3px 0 #0003}
#gotomonGolfScreen .gf-cup[data-hint=true] .gf-plate{border-color:#37c871;box-shadow:0 0 0 4px #37c871,0 0 18px #37c871;animation:gf-glow .7s ease-in-out infinite alternate}
#gotomonGolfScreen .gf-cup[data-gone=true]{filter:grayscale(1);opacity:.45;pointer-events:none}
#gotomonGolfScreen .gf-cup[data-choosing=true] .gf-plate{animation:gf-bob .9s ease-in-out infinite alternate}
#gotomonGolfScreen .gf-ball{width:${R.ballR * 200 / R.W}%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#e8e8e8 60%,#bdbdbd);box-shadow:0 2px 2px #0006;z-index:5}
#gotomonGolfScreen .gf-ball.gf-sink{animation:gf-sink .5s ease-in forwards}
#gotomonGolfScreen .gf-buddy{width:clamp(34px,11cqh,70px);aspect-ratio:1;z-index:4;transform:translate(-110%,-75%);transition:left .25s,top .25s}
#gotomonGolfScreen .gf-buddy>*{width:100%!important;height:100%!important;object-fit:contain;filter:drop-shadow(0 4px 3px #0005)}
#gotomonGolfScreen .gf-token{border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff,#ffcf5a)}
#gotomonGolfScreen .gf-guide{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:4;overflow:visible}
#gotomonGolfScreen .gf-guide polyline{fill:none;stroke:#fff;stroke-width:.012;stroke-dasharray:.02 .025;stroke-linecap:round}
#gotomonGolfScreen .gf-guide line{stroke:#ffd166;stroke-width:.01;stroke-linecap:round}
#gotomonGolfScreen .gf-title{margin:0;text-align:center;font-size:14px;font-weight:900;color:#bfe3ff}
#gotomonGolfScreen .gf-prompt{margin:0;padding:8px 12px;border-radius:14px;background:#ffffff14;color:#fff;text-align:center;font-size:clamp(20px,2.8vw,28px);font-weight:900;line-height:1.3}
#gotomonGolfScreen .gf-prompt small{display:block;margin-top:4px;font-size:15px;font-weight:700;color:#d4e8ff}
#gotomonGolfScreen .gf-prompt small b{color:#ffe066}
#gotomonGolfScreen .gf-choices{display:grid;grid-template-columns:1fr 1fr;gap:8px}
#gotomonGolfScreen .gf-choice{min-height:clamp(48px,7vh,64px);border:0;border-radius:14px;background:#ffffff26;color:#fff;font:inherit;font-size:clamp(18px,2.4vw,24px);font-weight:900;cursor:pointer}
#gotomonGolfScreen .gf-choice[data-chosen=true]{background:#ffd16655;box-shadow:0 0 0 3px #ffd166}
#gotomonGolfScreen .gf-choice[data-hint=true]{box-shadow:0 0 0 3px #37c871}
#gotomonGolfScreen .gf-choice:disabled{opacity:.4;cursor:default}
#gotomonGolfScreen .gf-aim-controls{display:grid;grid-template-columns:auto minmax(70px,1fr) auto;align-items:center;gap:8px;color:#fff;font-size:14px;font-weight:800}
#gotomonGolfScreen .gf-aim-controls[hidden]{display:none}
#gotomonGolfScreen .gf-aim-controls input{width:100%;height:44px;accent-color:#ffd166;touch-action:manipulation}
#gotomonGolfScreen .gf-shoot{min-height:48px;padding:4px 12px;border:0;border-radius:12px;background:#ffd166;color:#3a2400;font:inherit;font-size:16px;font-weight:900;cursor:pointer}
#gotomonGolfScreen .gf-help{margin:0;text-align:center;font-size:13px;color:#d4e8ff}
@keyframes gf-bob{from{translate:0 0}to{translate:0 -4px}}
@keyframes gf-glow{from{filter:brightness(1)}to{filter:brightness(1.15)}}
@keyframes gf-boing{0%{scale:1.3}100%{scale:1}}
@keyframes gf-sink{to{scale:.2;opacity:0}}
`;
const SVG = 'http://www.w3.org/2000/svg';
// Words pop up a little inside the field's edges, so they are never cut off.
const popX = x => Math.max(14, Math.min(78, x));
// The finger goes down anywhere on the course and pulls back: the ball flies the other way.
// A pull this long (in course heights, at least FULL_PULL_PX) is a full shot; shorter pulls are softer.
const FULL_PULL = 0.42, FULL_PULL_PX = 140, MIN_POWER = 0.04;

export function createGolfView({ document: doc, dispatch, onBack, getSnapshot, cast }) {
  let active = true, lastEventId = 0, doneShown = false, shownCup = 0, shownHelp = 0, shownShot = 0, problemKey = null, holeKey = null;
  // The aim: from a finger pulling back, or from the arrow keys (angle in radians, power 0..1).
  let pulling = null, aim = null, keyAim = { angle: 0, power: 0.5 }, lastBumped = null;
  const removes = [], cupNodes = new Map(), bumperNodes = new Map(), wallNodes = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'gotomonGolfScreen', title: 'ゴトモン・ミニゴルフ', theme: 'golf' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });

  const wrap = el('div', 'gf-wrap');
  const course = el('div', 'gf-course'); course.setAttribute('aria-label', 'ミニゴルフのコース');
  const tee = el('div', 'gf-thing gf-tee');
  const ball = el('div', 'gf-thing gf-ball');
  const buddy = el('div', 'gf-thing gf-buddy'), token = el('div', 'gf-token'); buddy.append(token);
  const guide = doc.createElementNS ? doc.createElementNS(SVG, 'svg') : el('div');
  guide.setAttribute('class', 'gf-guide'); guide.setAttribute('viewBox', `0 0 ${R.W} 1`); guide.setAttribute('preserveAspectRatio', 'none');
  const path = doc.createElementNS ? doc.createElementNS(SVG, 'polyline') : el('i');
  const pull = doc.createElementNS ? doc.createElementNS(SVG, 'line') : el('i');
  guide.append(path, pull);
  course.append(tee, guide, buddy, ball);
  wrap.append(course); world.append(wrap);

  const title = el('p', 'gf-title');
  const prompt = el('p', 'gf-prompt'); prompt.dataset.role = 'problem';
  const choices = el('div', 'gf-choices'), choiceButtons = [];
  const aimControls = el('div', 'gf-aim-controls');
  const powerLabel = el('label', '', 'つよさ');
  const powerRange = el('input'); powerRange.type = 'range'; powerRange.min = '10'; powerRange.max = '100'; powerRange.step = '5'; powerRange.value = '55'; powerRange.setAttribute('aria-label', 'ボールを打つつよさ');
  const shootButton = el('button', 'gf-shoot', 'この向きに うつ'); shootButton.type = 'button';
  aimControls.append(powerLabel, powerRange, shootButton); aimControls.hidden = true;
  on(powerRange, 'input', () => {
    const state = getSnapshot();
    if (!active || state.paused || state.phase !== 'aiming' || !aim) return;
    aim = { angle: aim.angle, power: Number(powerRange.value) / 100 };
    keyAim = { ...aim };
  });
  on(shootButton, 'click', () => { if (aim) shoot(aim); });
  const help = el('p', 'gf-help');
  const note = el('p', 'ya-dock-note'); note.dataset.role = 'feedback';
  dock.append(title, prompt, choices, aimControls, help, note);
  doc.body.append(root);

  const place = (node, x, y) => { node.style.left = `${x / R.W * 100}%`; node.style.top = `${y * 100}%`; };
  const aimToCup = (state, plateId, power = keyAim.power) => {
    const cup = state.hole?.cups.find(item => item.plateId === plateId);
    return cup && state.ball ? { angle: Math.atan2(cup.y - state.ball.y, cup.x - state.ball.x), power } : null;
  };
  const choose = plateId => {
    const state = getSnapshot();
    if (!active || state.paused || !state.canChoose) return false;
    const ok = dispatch({ type: 'choose', payload: { sessionId: state.sessionId, attemptId: state.attemptId, plateId } });
    if (ok) {
      aim = aimToCup(state, plateId, 0.55); keyAim = { ...aim };
      note.textContent = 'コースを タップして ねらいを 変え、つよさを 決めて 打とう。引っぱって すぐ打つこともできるよ';
      frame.announce(note.textContent);
    }
    return ok;
  };
  const shoot = ({ angle, power: p }) => {
    const state = getSnapshot();
    if (!active || state.paused || state.phase !== 'aiming' || !state.chosenPlateId || p < MIN_POWER) return false;
    const ok = dispatch({ type: 'shoot', payload: { sessionId: state.sessionId, attemptId: state.attemptId, angle, power: Math.min(1, p) } });
    if (ok) { keyAim = { angle, power: Math.min(1, p) }; aim = null; }
    return ok;
  };
  // Pulling back from where the finger went down: the ball flies the other way, harder the farther the pull.
  const aimFrom = event => {
    if (!pulling) return null;
    const dx = pulling.x - event.clientX, dy = pulling.y - event.clientY, length = Math.hypot(dx, dy);
    if (!length) return { angle: 0, power: 0 };
    const full = Math.max(FULL_PULL_PX, (course.getBoundingClientRect?.()?.height ?? 0) * FULL_PULL);
    return { angle: Math.atan2(dy, dx), power: Math.min(1, length / full) };
  };
  on(course, 'pointerdown', event => {
    const state = getSnapshot();
    if (!active || state.paused) return;
    // A tap on a cup chooses its flag (before the first shot after a choice).
    const cupNode = event.target?.closest?.('.gf-cup');
    if (cupNode && state.canChoose) { choose(cupNode.dataset.plate); return; }
    if (state.phase !== 'aiming' || !state.chosenPlateId) {
      if (state.phase === 'choosing') { note.textContent = 'さきに、答えの旗を タップしてね'; frame.announce(note.textContent); }
      return;
    }
    event.preventDefault?.(); pulling = { x: event.clientX, y: event.clientY, power: aim?.power ?? Number(powerRange.value) / 100 }; aim = null;
  });
  on(doc, 'pointermove', event => { if (pulling) aim = aimFrom(event); });
  on(doc, 'pointerup', event => {
    if (!pulling) return;
    if (Math.hypot(event.clientX - pulling.x, event.clientY - pulling.y) < 20) {
      const tapPower = pulling.power;
      pulling = null;
      const state = getSnapshot(), box = course.getBoundingClientRect?.();
      if (!box?.width || !state.ball) return;
      const x = (event.clientX - box.left) / box.width * R.W, y = (event.clientY - box.top) / box.height;
      if (Math.hypot(x - state.ball.x, y - state.ball.y) < R.ballR) return;
      aim = { angle: Math.atan2(y - state.ball.y, x - state.ball.x), power: tapPower };
      keyAim = { ...aim };
      note.textContent = '点線で ころがりかたを 見て、つよさを えらぼう';
      frame.announce(note.textContent);
      return;
    }
    const shot = aimFrom(event) ?? aim; pulling = null; aim = null;
    if (shot && !shoot(shot) && shot.power < MIN_POWER) { note.textContent = 'もっと 長く 引っぱってみよう'; frame.announce(note.textContent); }
  });
  on(doc, 'pointercancel', () => { pulling = null; aim = null; });

  removes.push(bindArcadeKeys(doc, event => {
    const state = getSnapshot();
    const n = Number(event.key);
    if (n >= 1 && n <= 4) { const cup = state.hole?.cups[n - 1]; if (cup) choose(cup.plateId); return true; }
    if (state.phase !== 'aiming' || !state.chosenPlateId) return false;
    if (event.key === 'ArrowLeft') { keyAim.angle -= 0.06; aim = { ...keyAim, keys: true }; return true; }
    if (event.key === 'ArrowRight') { keyAim.angle += 0.06; aim = { ...keyAim, keys: true }; return true; }
    if (event.key === 'ArrowUp') { keyAim.power = Math.min(1, keyAim.power + 0.05); aim = { ...keyAim, keys: true }; return true; }
    if (event.key === 'ArrowDown') { keyAim.power = Math.max(0.05, keyAim.power - 0.05); aim = { ...keyAim, keys: true }; return true; }
    if (event.key === ' ' || event.key === 'Enter') { if (!event.repeat) { shoot(keyAim); aim = null; } return true; }
    return false;
  }));

  const renderPrompt = state => {
    const key = state.problem?.problemId ?? null;
    if (key === problemKey) return;
    const sameQuestion = problemKey && state.problem && problemKey.split(':').slice(0, -1).join(':') === key.split(':').slice(0, -1).join(':');
    problemKey = key;
    if (!state.problem) { prompt.textContent = state.phase === 'completed' ? 'ぜんぶの ホール クリア！' : ''; return; }
    prompt.textContent = state.problem.prompt;
    if (state.problem.sentence) { const small = el('small'); small.append(el('span', '', state.problem.sentence.before), el('b', '', state.problem.prompt.match(/「(.+?)」/)?.[1] ?? ''), el('span', '', state.problem.sentence.after)); prompt.append(small); }
    const word = state.problem.kind === 'en2ja' ? state.problem.prompt.split(' ')[0] : null;
    if (word && !sameQuestion) Speech.speakEnglish(word);
  };
  // A new hole: walls, cups with their flags and Gotomon, bumpers; and the choice buttons.
  const buildHole = state => {
    const h = state.hole;
    wallNodes.splice(0).forEach(node => node.remove?.());
    for (const node of [...cupNodes.values(), ...bumperNodes.values()]) node.remove?.();
    cupNodes.clear(); bumperNodes.clear();
    for (const [x1, y1, x2, y2] of h.walls) {
      const node = el('div', 'gf-wall');
      node.style.left = `${x1 / R.W * 100}%`; node.style.top = `${y1 * 100}%`;
      node.style.width = `${(x2 - x1) / R.W * 100}%`; node.style.height = `${(y2 - y1) * 100}%`;
      course.append(node); wallNodes.push(node);
    }
    h.cups.forEach((cup, i) => {
      const node = el('div', 'gf-thing gf-cup'); node.dataset.plate = cup.plateId;
      // A cup near the right edge keeps its plate inside the course.
      node.dataset.side = cup.x > 1.42 ? 'back' : 'front';
      node.setAttribute('role', 'button'); node.setAttribute('aria-label', `${cup.text}の旗`);
      const flag = el('div', 'gf-flag'), plate = el('span', 'gf-plate', cup.text);
      flag.append(plate, el('i', 'gf-pole'));
      const who = castAt(cast?.wild, state.problemIndex * 4 + i);
      if (who) { const img = el('img', 'gf-holder'); img.alt = ''; img.src = who.imageUrl; node.append(img); }
      node.append(flag); place(node, cup.x, cup.y);
      course.append(node); cupNodes.set(cup.cupId, node);
    });
    for (const b of h.bumpers) {
      // The bumpers are the Gotomon after the four flag holders, so nobody is on the course twice.
      const node = el('div', 'gf-thing gf-bumper'), who = castAt(cast?.wild, state.problemIndex * 4 + 4 + b.cast);
      node.style.width = `${b.r * 200 / R.W}%`; node.style.aspectRatio = '1';
      if (who) { const img = el('img'); img.alt = ''; img.src = who.imageUrl; node.append(img); }
      course.append(node); bumperNodes.set(b.id, node);
    }
    place(tee, ...state.tee);
    choiceButtons.splice(0).forEach(button => button.remove?.());
    h.cups.forEach((cup, i) => {
      const button = el('button', 'gf-choice', cup.text); button.type = 'button'; button.dataset.plate = cup.plateId;
      button.setAttribute('aria-label', `${i + 1}: ${cup.text}の旗を えらぶ`);
      on(button, 'click', () => choose(cup.plateId));
      choices.append(button); choiceButtons.push(button);
    });
  };
  const renderGuide = state => {
    if (state.phase === 'aiming' && state.chosenPlateId && !aim && !pulling) aim = aimToCup(state, state.chosenPlateId);
    const show = state.phase === 'aiming' && state.chosenPlateId && aim && aim.power >= MIN_POWER;
    aimControls.hidden = !(state.phase === 'aiming' && state.chosenPlateId);
    shootButton.disabled = !show;
    if (aim && powerRange.value !== String(Math.round(aim.power * 20) * 5)) powerRange.value = String(Math.round(aim.power * 20) * 5);
    if (!show) { path.setAttribute('points', ''); pull.setAttribute('x1', 0); pull.setAttribute('y1', 0); pull.setAttribute('x2', 0); pull.setAttribute('y2', 0); return; }
    const h = { ...state.hole.course, cups: state.hole.cups };
    const points = tracePath(h, state.ball.x, state.ball.y, aim.angle, aim.power, state.worldMs, 0.25 + aim.power * 0.45);
    path.setAttribute('points', points.map(([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`).join(' '));
    const back = [state.ball.x - Math.cos(aim.angle) * aim.power * FULL_PULL, state.ball.y - Math.sin(aim.angle) * aim.power * FULL_PULL];
    pull.setAttribute('x1', state.ball.x); pull.setAttribute('y1', state.ball.y); pull.setAttribute('x2', back[0]); pull.setAttribute('y2', back[1]);
  };
  const render = state => {
    const h = state.hole, key = `${state.problemIndex}:${h.name}`;
    if (key !== holeKey) { holeKey = key; buildHole(state); }
    const choosing = state.canChoose;
    for (const cup of h.cups) {
      const node = cupNodes.get(cup.cupId); if (!node) continue;
      const set = (k, v) => { if (node.dataset[k] !== v) node.dataset[k] = v; };
      set('lid', String(!!state.chosenPlateId && !cup.open && !cup.gone));
      set('chosen', String(cup.plateId === state.chosenPlateId));
      set('hint', String(cup.plateId === state.hintPlateId && !state.chosenPlateId));
      set('gone', String(cup.gone));
      set('choosing', String(choosing && !state.chosenPlateId && !cup.gone));
    }
    for (const b of h.bumpers) { const node = bumperNodes.get(b.id); if (node) place(node, b.x, b.y); }
    choiceButtons.forEach(button => {
      const cup = h.cups.find(c => c.plateId === button.dataset.plate);
      button.disabled = !choosing || !!cup?.gone;
      const chosen = String(cup?.plateId === state.chosenPlateId), hint = String(cup?.plateId === state.hintPlateId && !state.chosenPlateId);
      if (button.dataset.chosen !== chosen) button.dataset.chosen = chosen;
      if (button.dataset.hint !== hint) button.dataset.hint = hint;
    });
    if (state.ball) { place(ball, state.ball.x, state.ball.y); if (!state.ball.moving && state.phase !== 'sunk') place(buddy, state.ball.x, state.ball.y); }
    if (state.phase !== 'sunk' && ball.classList?.contains('gf-sink')) ball.classList.remove('gf-sink');
    renderGuide(state);
    const helpText = state.phase === 'choosing' ? '答えの旗を タップしよう（ボタンや 1〜4キーでも えらべるよ）'
      : state.phase === 'aiming' && state.canChoose ? '旗は 打つまで えらびなおせるよ。点線を 見て ねらおう'
        : state.phase === 'aiming' ? 'コースを タップして ねらうか、うしろへ 引っぱって 打とう' : '';
    if (help.textContent !== helpText) help.textContent = helpText;
  };
  const showCup = state => {
    const cup = state.lastCup, x = popX(cup.x / R.W * 100), y = cup.y * 100;
    if (cup.correct) {
      restartClass(ball, 'gf-sink');
      fx.burst(cup.x / R.W * 100, y, cup.first ? 'great' : 'good', cup.first ? 1.4 : 1.1);
      fx.pop(x, Math.max(10, y - 8), cup.holeInOne ? 'ホールインワン！' : 'カップイン！', 'great');
      note.textContent = `${cup.holeInOne ? 'ホールインワン！' : 'カップイン！'} ${cup.explain}`;
    } else {
      fx.pop(x, Math.max(10, y - 8), 'ころん…', 'soft');
      note.textContent = `そのカップは「${cup.text}」${cup.note ? `（${cup.note}）` : ''}。答えは「${cup.answer}」。光る旗を えらんで、もう一度 打とう`;
    }
    frame.announce(note.textContent);
  };
  const showHelp = state => {
    const h = state.lastHelp;
    fx.pop(popX(h.x / R.W * 100), Math.max(10, h.y * 100 - 8), 'よいしょ！', 'good');
    note.textContent = h.level === 1 ? 'ゴトモンが ボールを 近くまで はこんでくれた！' : 'ゴトモンが カップの 前まで はこんでくれた！';
    frame.announce(note.textContent);
  };

  return {
    root,
    // The companion is the golfer, standing by the ball.
    attachCompanion(portrait) { token.remove?.(); buddy.append(portrait); },
    focusPlay() { choiceButtons[0]?.focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      if (!state.hole) return;
      renderPrompt(state); render(state);
      if (state.lastCup && state.lastCup.cup !== shownCup) { shownCup = state.lastCup.cup; showCup(state); }
      if (state.lastHelp && state.lastHelp.help !== shownHelp) { shownHelp = state.lastHelp.help; showHelp(state); }
      if (state.lastShot && state.lastShot.shot !== shownShot) { shownShot = state.lastShot.shot; keyAim = { angle: state.lastShot.angle, power: state.lastShot.power }; }
      // A Gotomon bumper the ball hits goes boing.
      const bumped = state.phase === 'rolling' ? state.ball && state.hole.bumpers.find(b => Math.hypot(b.x - state.ball.x, b.y - state.ball.y) < b.r + R.ballR + 0.004) : null;
      if (bumped && bumped.id !== lastBumped) restartClass(bumperNodes.get(bumped.id), 'gf-boing');
      lastBumped = bumped?.id ?? null;
      const titleText = state.phase === 'completed' ? '' : `ホール ${state.problemIndex + 1}/${state.total}「${state.hole.name}」　${state.shots}打`;
      if (title.textContent !== titleText) title.textContent = titleText;
      if (state.result && !doneShown) {
        doneShown = true;
        fx.banner('ぜんぶ クリア！', 'great'); fx.burst(50, 40, 'great', 2);
        note.textContent = `12ホール ぜんぶ クリア！ ${state.result.shots}打${state.result.holeInOnes ? `・ホールインワン ${state.result.holeInOnes}回` : ''}`;
      }
    },
    present(play, dt, state) {
      if (!active || !state) return;
      frame.tick(dt);
      const w = play.world || {};
      const event = w.lastEvent;
      if (event && event.id !== lastEventId) {
        lastEventId = event.id;
        if (event.type === 'boost') { fx.banner('ゴルフフィーバー！', 'great'); fx.flash('great'); }
      }
      const mission = w.challenge, done = state.result ? state.total : state.problemIndex ?? 0;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: Math.min(1, done / (state.total || 1)), progressLabel: state.result ? 'クリア！' : `ホール ${Math.min(done, state.total ?? 0)}/${state.total ?? 0}`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; pulling = null; aim = null; [...choiceButtons, powerRange, shootButton].forEach(button => { button.disabled = true; }); },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
