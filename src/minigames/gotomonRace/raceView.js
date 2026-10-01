import { createArcadeFrame, restartClass, bindArcadeKeys } from '../arcade/arcadeKit.js';
import { castAt } from '../gotomonCast.js';
import Speech from '../../audio/speech.js';
import { RACE_RULES as R } from './raceGame.js';

// The course: lanes between ROAD_L and ROAD_R (% of the field); the runner at RUNNER_Y;
// one gate of distance is GATE_H % of the field's height.
const ROAD_L = 10, ROAD_R = 90, RUNNER_Y = 80, GATE_H = 62;
const laneX = lane => ROAD_L + (lane + 0.5) * (ROAD_R - ROAD_L) / R.lanes;
const CSS = `
#gotomonRaceScreen .ya-field{background:linear-gradient(90deg,#5fb85a 0 ${ROAD_L}%,transparent ${ROAD_L}% ${ROAD_R}%,#5fb85a ${ROAD_R}%),#c98b52}
#gotomonRaceScreen .rc-road{position:absolute;top:0;bottom:0;left:${ROAD_L}%;right:${100 - ROAD_R}%;background:repeating-linear-gradient(90deg,transparent 0 calc(25% - 2px),#fff8 calc(25% - 2px) 25%),linear-gradient(90deg,#d99a5e,#c98b52 50%,#d99a5e);border-inline:6px solid #fff}
#gotomonRaceScreen .rc-stripes{position:absolute;inset:0;background:repeating-linear-gradient(#0000 0 44px,#ffffff22 44px 60px);pointer-events:none}
#gotomonRaceScreen .rc-grass{position:absolute;top:0;bottom:0;width:${ROAD_L}%;background:radial-gradient(circle,#3f8f3a 0 5px,transparent 6px) 0 0/28px 40px;opacity:.6}
#gotomonRaceScreen .rc-gate{position:absolute;left:${ROAD_L}%;right:${100 - ROAD_R}%;display:grid;grid-template-columns:repeat(${R.lanes},1fr);gap:4px;transform:translateY(-50%);z-index:3;pointer-events:none}
#gotomonRaceScreen .rc-gate::before{content:'';position:absolute;left:-10px;right:-10px;top:-12px;height:8px;border-radius:4px;background:#e74c3c;box-shadow:0 0 0 2px #fff}
#gotomonRaceScreen .rc-plate{display:grid;place-items:center;min-height:clamp(40px,8vh,64px);padding:2px 4px;border-radius:12px;background:#fffdf6;border:3px solid #2a4d7a;color:#1b2a36;font-size:clamp(15px,min(2.4vw,3.4vh),28px);font-weight:900;line-height:1.1;text-align:center;box-shadow:0 4px 0 #2a4d7a}
#gotomonRaceScreen .rc-plate[data-hint=true]{border-color:#37c871;box-shadow:0 4px 0 #1f9d55,0 0 0 5px #37c871aa}
#gotomonRaceScreen .rc-plate[data-mine=true]{background:#fff3b0}
#gotomonRaceScreen .rc-finish{position:absolute;left:${ROAD_L}%;right:${100 - ROAD_R}%;height:22px;transform:translateY(-50%);background:repeating-conic-gradient(#222 0 25%,#fff 0 50%) 0 0/22px 22px;z-index:2}
#gotomonRaceScreen .rc-runner,#gotomonRaceScreen .rc-rival{position:absolute;width:clamp(52px,9vh,84px);aspect-ratio:1;transform:translate(-50%,-50%);transition:left .22s ease-out;z-index:2;pointer-events:none}
#gotomonRaceScreen .rc-runner{top:${RUNNER_Y}%;z-index:6}
#gotomonRaceScreen .rc-me{position:absolute;left:50%;bottom:-18px;transform:translateX(-50%);padding:0 8px;border-radius:8px;background:#ffe066;color:#1b2a36;font-size:11px;font-weight:900;white-space:nowrap;z-index:1}
#gotomonRaceScreen .rc-runner>:not(.rc-me){width:100%!important;height:100%!important;object-fit:contain}
#gotomonRaceScreen .rc-runner::after{content:'';position:absolute;left:15%;right:15%;bottom:-6%;height:12%;border-radius:50%;background:#0003;z-index:-1}
#gotomonRaceScreen .rc-runner[data-boost=true]::before{content:'';position:absolute;left:10%;right:10%;top:70%;height:90%;background:repeating-linear-gradient(90deg,#fff0 0 8px,#fffb 8px 11px);filter:blur(1px);z-index:-1}
#gotomonRaceScreen .rc-runner[data-slow=true]{filter:saturate(.6)}
#gotomonRaceScreen .rc-runner.rc-hop>*{animation:rc-hop .35s ease-out}
#gotomonRaceScreen .rc-body{animation:rc-run .32s ease-in-out infinite alternate}
#gotomonRaceScreen .rc-rival img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 4px 3px #0005);animation:rc-run .36s ease-in-out infinite alternate}
#gotomonRaceScreen .rc-rival small{position:absolute;left:50%;top:-14px;transform:translateX(-50%);white-space:nowrap;padding:0 6px;border-radius:8px;background:#0008;color:#fff;font-size:11px;font-weight:800}
#gotomonRaceScreen .rc-rival[data-off=true]{top:64px!important;width:40px;opacity:.9}
#gotomonRaceScreen .rc-rival[data-off=true] small::before{content:'↑ '}
#gotomonRaceScreen .rc-place{position:absolute;right:2%;bottom:3%;padding:4px 12px;border-radius:12px;background:#1b2a36cc;color:#ffe066;font-size:clamp(18px,2.4vw,26px);font-weight:900;z-index:5}
#gotomonRaceScreen .rc-title{margin:0;text-align:center;font-size:14px;font-weight:900;color:#bfe3ff}
#gotomonRaceScreen .rc-prompt{margin:0;padding:8px 12px;border-radius:14px;background:#ffffff14;color:#fff;text-align:center;font-size:clamp(22px,3vw,30px);font-weight:900;line-height:1.3}
#gotomonRaceScreen .rc-prompt small{display:block;margin-top:4px;font-size:15px;font-weight:700;color:#d4e8ff}
#gotomonRaceScreen .rc-prompt small b{color:#ffe066}
#gotomonRaceScreen .rc-lanes{display:grid;grid-template-columns:repeat(${R.lanes},1fr);gap:6px}
#gotomonRaceScreen .rc-lane{min-height:clamp(64px,11vh,90px);padding:4px;border:3px solid transparent;border-radius:14px;background:#ffffff1c;color:#fff;font:inherit;font-size:clamp(15px,2vw,22px);font-weight:900;line-height:1.15;cursor:pointer;touch-action:manipulation}
#gotomonRaceScreen .rc-lane[aria-pressed=true]{border-color:#ffe066;background:#ffffff33}
#gotomonRaceScreen .rc-lane[data-hint=true]{box-shadow:0 0 0 3px #37c871}
#gotomonRaceScreen .rc-lane small{display:block;font-size:11px;opacity:.75}
@keyframes rc-run{from{transform:translateY(0) rotate(-3deg)}to{transform:translateY(-8%) rotate(3deg)}}
@keyframes rc-hop{0%{transform:scale(1.3) translateY(-10%)}100%{transform:none}}
`;

export function createRaceView({ document: doc, dispatch, onBack, getSnapshot, cast }) {
  let active = true, lastEventId = 0, doneShown = false, shownGate = 0, problemKey = null, gateKey = null, plateNodes = [];
  const removes = [], rivalNodes = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'gotomonRaceScreen', title: 'ゴトモン・レース', theme: 'race' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });

  const road = el('div', 'rc-road'), stripes = el('div', 'rc-stripes'); road.append(stripes);
  const grassL = el('div', 'rc-grass'), grassR = el('div', 'rc-grass'); grassR.style.right = '0'; grassL.style.left = '0';
  const gateNode = el('div', 'rc-gate'); gateNode.hidden = true;
  const finish = el('div', 'rc-finish'); finish.hidden = true;
  const runner = el('div', 'rc-runner'), body = el('div', 'rc-body'); runner.append(body);
  body.style.cssText = 'width:100%;height:100%;border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff,#ffcf5a)';
  const placeTag = el('p', 'rc-place');
  runner.append(el('small', 'rc-me', 'きみ'));
  world.append(grassL, grassR, road, finish, gateNode, runner, placeTag);
  for (let i = 0; i < R.rivals; i++) {
    const who = castAt(cast?.wild, i), node = el('div', 'rc-rival');
    if (who) { const img = el('img'); img.alt = ''; img.src = who.imageUrl; node.append(img, el('small', '', who.name)); }
    else { const dot = el('i'); dot.style.cssText = 'display:block;width:100%;height:100%;border-radius:50%;background:#8ab4f8'; node.append(dot); }
    world.append(node); rivalNodes.push(node);
  }
  // Tapping the course moves to the lane tapped.
  on(world, 'pointerdown', event => {
    const box = world.getBoundingClientRect?.(); if (!box?.width) return;
    const x = (event.clientX - box.left) / box.width * 100;
    if (x < ROAD_L || x > ROAD_R) return;
    steer(Math.min(R.lanes - 1, Math.floor((x - ROAD_L) / (ROAD_R - ROAD_L) * R.lanes)));
  });

  const title = el('p', 'rc-title');
  const prompt = el('p', 'rc-prompt'); prompt.dataset.role = 'problem';
  const lanes = el('div', 'rc-lanes'), laneButtons = [];
  for (let i = 0; i < R.lanes; i++) {
    const button = el('button', 'rc-lane'); button.type = 'button'; button.dataset.lane = String(i);
    on(button, 'pointerdown', event => { event.preventDefault?.(); steer(i); });
    on(button, 'click', event => { if (event.detail === 0) steer(i); });
    lanes.append(button); laneButtons.push(button);
  }
  const note = el('p', 'ya-dock-note'); note.dataset.role = 'feedback';
  dock.append(title, prompt, lanes, note);
  doc.body.append(root);

  function steer(lane) {
    const state = getSnapshot();
    if (!active || state.paused || state.phase !== 'answering') return false;
    return dispatch({ type: 'steer', payload: { sessionId: state.sessionId, attemptId: state.attemptId, lane } });
  }
  removes.push(bindArcadeKeys(doc, event => {
    const state = getSnapshot();
    if (event.key === 'ArrowLeft') return steer(Math.max(0, state.lane - 1)) || true;
    if (event.key === 'ArrowRight') return steer(Math.min(R.lanes - 1, state.lane + 1)) || true;
    const k = ['1', '2', '3', '4'].indexOf(event.key);
    return k >= 0 ? (steer(k), true) : false;
  }));

  const renderPrompt = state => {
    const key = state.problem?.contentId ?? (state.finishAt !== null ? 'finish' : null);
    if (key === problemKey) return;
    problemKey = key;
    if (!state.problem) { prompt.textContent = state.phase === 'completed' ? 'ゴール！' : 'ゴールまで いっきに走ろう！'; return; }
    prompt.textContent = state.problem.prompt;
    if (state.problem.sentence) { const small = el('small'); small.append(el('span', '', state.problem.sentence.before), el('b', '', state.problem.prompt.match(/「(.+?)」/)?.[1] ?? ''), el('span', '', state.problem.sentence.after)); prompt.append(small); }
    const word = state.problem.kind === 'en2ja' ? state.problem.prompt.split(' ')[0] : null;
    if (word) Speech.speakEnglish(word);
  };
  const renderGate = state => {
    const gate = state.gate;
    if ((gate?.gateId ?? null) !== gateKey) {
      gateKey = gate?.gateId ?? null; gateNode.textContent = ''; plateNodes = [];
      if (gate) for (const plate of gate.plates) { const node = el('div', 'rc-plate', plate.text); gateNode.append(node); plateNodes.push(node); }
      laneButtons.forEach((button, i) => {
        button.textContent = '';
        if (gate) button.append(el('span', '', gate.plates[i].text), el('small', '', `${i + 1}`)); else button.append(el('span', '', '→'));
        button.setAttribute('aria-label', gate ? `レーン${i + 1}「${gate.plates[i].text}」` : `レーン${i + 1}`);
      });
    }
    gateNode.hidden = !gate;
    if (gate) {
      gateNode.style.top = `${RUNNER_Y - (gate.at - state.distance) * GATE_H}%`;
      gate.plates.forEach((plate, i) => {
        const hint = String(plate.plateId === state.hintPlateId), mine = String(i === state.lane);
        if (plateNodes[i].dataset.hint !== hint) plateNodes[i].dataset.hint = hint;
        if (plateNodes[i].dataset.mine !== mine) plateNodes[i].dataset.mine = mine;
        if (laneButtons[i].dataset.hint !== hint) laneButtons[i].dataset.hint = hint;
      });
    }
    laneButtons.forEach((button, i) => { const on = String(i === state.lane); if (button.dataset.pressed !== on) { button.dataset.pressed = on; button.setAttribute('aria-pressed', on); } });
  };
  const renderCourse = state => {
    stripes.style.backgroundPosition = `0 ${(state.distance * 400) % 60}px`;
    runner.style.left = `${laneX(state.lane)}%`;
    runner.dataset.boost = String(state.boostMs > 0); runner.dataset.slow = String(state.slowMs > 0);
    finish.hidden = state.finishAt === null;
    if (state.finishAt !== null) finish.style.top = `${RUNNER_Y - (state.finishAt - state.distance) * GATE_H}%`;
    state.rivals.forEach((rival, i) => {
      const node = rivalNodes[i]; if (!node) return;
      const y = RUNNER_Y - (rival.distance - state.distance) * GATE_H;
      node.style.left = `${laneX(rival.lane)}%`; node.style.top = `${Math.min(115, y)}%`;
      node.dataset.off = String(y < 8);
    });
    const text = `${state.place}位`;
    if (placeTag.textContent !== text) placeTag.textContent = text;
  };
  const showGate = state => {
    const gate = state.lastGate, x = laneX(gate.lane);
    if (gate.late) {
      fx.pop(x, RUNNER_Y - 18, 'もう一度！', 'soft');
      note.textContent = state.hintPlateId ? 'まにあわなかった！ 光っている レーンを タップしよう' : 'まにあわなかった！ 次の ゲートで もう一度。レーンを タップして えらぼう';
    } else if (gate.correct) {
      restartClass(runner, 'rc-hop');
      fx.burst(x, RUNNER_Y - 8, gate.first ? 'great' : 'good', gate.first ? 1.4 : 1.1);
      fx.pop(x, RUNNER_Y - 18, 'ダッシュ！', 'great');
      note.textContent = `ダッシュ！ ${gate.explain}`;
    } else {
      fx.pop(x, RUNNER_Y - 18, 'ぬかるみ', 'soft');
      note.textContent = `そのレーンは「${gate.text}」${gate.note ? `（${gate.note}）` : ''}。答えは「${gate.answer}」。光るレーンへ行こう`;
    }
    frame.announce(note.textContent);
  };

  return {
    root,
    // The companion runs the race.
    attachCompanion(portrait) { body.remove?.(); runner.append(portrait); },
    focusPlay() { laneButtons[0]?.focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      if (!state.rivals) return;
      renderPrompt(state); renderGate(state); renderCourse(state);
      if (state.lastGate && state.lastGate.gate !== shownGate) { shownGate = state.lastGate.gate; showGate(state); }
      const titleText = state.phase === 'completed' ? '' : state.finishAt !== null ? 'ラストスパート！' : `もんだい ${state.problemIndex + 1}/${state.total}　ダッシュ ${state.dashes}`;
      if (title.textContent !== titleText) title.textContent = titleText;
      if (state.result && !doneShown) {
        doneShown = true;
        const first = state.result.place === 1;
        fx.banner(first ? 'ゴール！ 1位！' : `ゴール！ ${state.result.place}位`, 'great'); fx.burst(50, 40, 'great', 2);
        note.textContent = first ? `1位でゴール！ ダッシュ ${state.result.dashes}回` : `${state.result.place}位でゴール！ ダッシュ ${state.result.dashes}回。1回で正解をふやすと、もっと前へ行けるよ`;
      }
    },
    present(play, dt, state) {
      if (!active || !state) return;
      frame.tick(dt);
      const w = play.world || {};
      const event = w.lastEvent;
      if (event && event.id !== lastEventId) {
        lastEventId = event.id;
        if (event.type === 'boost') { fx.banner('レースフィーバー！', 'great'); fx.flash('great'); }
      }
      const mission = w.challenge;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: Math.min(1, (state.distance ?? 0) / ((state.total || 1) + 0.6)), progressLabel: state.result ? 'ゴール！' : `もんだい ${(state.problemIndex ?? 0) + 1}/${state.total ?? 0}`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; laneButtons.forEach(button => { button.disabled = true; }); },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
