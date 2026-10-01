import { createArcadeFrame, restartClass, bindArcadeKeys } from '../arcade/arcadeKit.js';
import { castAt } from '../gotomonCast.js';
import { SHOOTER_FORMATION } from './shooterContent.js';
import Speech from '../../audio/speech.js';

const pct = value => `${(value * 100).toFixed(3)}%`;
const CSS = `
#gotomonShooterScreen .ya-field{background:radial-gradient(1px 1px at 20% 30%,#fff,transparent),radial-gradient(1px 1px at 70% 60%,#fff,transparent),radial-gradient(2px 2px at 40% 80%,#fffa,transparent),radial-gradient(1px 1px at 85% 15%,#fff,transparent),linear-gradient(#0d1b3d,#1f2f6b 60%,#3a3f8f);background-size:200px 200px,260px 260px,320px 320px,180px 180px,100% 100%;animation:gs-scroll 6s linear infinite}
#gotomonShooterScreen .ya-world{touch-action:none;cursor:crosshair}
#gotomonShooterScreen .gs-enemy{position:absolute;z-index:3;display:flex;flex-direction:column;align-items:center;gap:2px;transform:translate(-50%,-50%);pointer-events:none}
#gotomonShooterScreen .gs-enemy img{width:clamp(48px,7vw,78px);height:clamp(48px,7vw,78px);object-fit:contain;filter:drop-shadow(0 0 6px #a8d8ff88)}
#gotomonShooterScreen .gs-plate{max-width:clamp(90px,17vw,170px);padding:3px 9px;border-radius:10px;background:#fffdf6;color:#1b2a36;border:3px solid #6fb9e3;font-size:clamp(14px,min(2vw,2.8vh),20px);font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 3px 0 #0005}
#gotomonShooterScreen .gs-enemy[data-hint=true] .gs-plate{border-color:#37c871;box-shadow:0 3px 0 #1f9d55,0 0 0 5px #37c871aa;animation:gs-glow .7s ease-in-out infinite alternate}
#gotomonShooterScreen .gs-enemy.gs-leave{animation:gs-leave .7s ease-in forwards}
#gotomonShooterScreen .gs-enemy.gs-friend{animation:gs-friend .6s ease-out}
#gotomonShooterScreen .gs-ship{position:absolute;z-index:4;width:clamp(64px,9vw,96px);aspect-ratio:1;transform:translate(-50%,-50%);pointer-events:none}
#gotomonShooterScreen .gs-ship::after{content:'';position:absolute;left:10%;right:10%;bottom:-4%;height:34%;border-radius:50% 50% 30% 30%;background:linear-gradient(#b9c8ff,#6b7fd6);box-shadow:0 0 12px #9fb2ff,0 6px 10px #ffb62788;z-index:-1}
#gotomonShooterScreen .gs-ship .gt-portrait{display:block;width:100%;height:100%;background:none;border:0}
#gotomonShooterScreen .gs-ship .gt-portrait img{width:100%;height:100%;object-fit:contain}
#gotomonShooterScreen .gs-escort{position:absolute;z-index:3;width:clamp(30px,4vw,44px);aspect-ratio:1;transform:translate(-50%,-50%);object-fit:contain;opacity:.9;pointer-events:none;transition:left .25s ease-out}
#gotomonShooterScreen .gs-beam{position:absolute;z-index:3;width:8px;height:clamp(22px,4vh,34px);transform:translate(-50%,-50%);border-radius:6px;background:linear-gradient(#fff,#ffd6f0 40%,#ff7ac0);box-shadow:0 0 10px #ff9ad0;pointer-events:none}
#gotomonShooterScreen .gs-mark{position:absolute;z-index:2;bottom:4%;width:2px;height:70%;transform:translateX(-50%);background:linear-gradient(transparent,#ffffff33);pointer-events:none}
#gotomonShooterScreen .gs-kind{margin:0;text-align:center;font-size:14px;font-weight:900;color:#bfd0ff}
#gotomonShooterScreen .gs-ask{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;margin:0;padding:10px 12px;border-radius:14px;background:#ffffff14;color:#fff;text-align:center;font-size:clamp(24px,3.6vw,36px);font-weight:900;line-height:1.3}
#gotomonShooterScreen .gs-ask small{flex-basis:100%;font-size:15px;font-weight:700;color:#d8e8f0}
#gotomonShooterScreen .gs-ask small b{color:#ffe066}
#gotomonShooterScreen .gs-say{min-width:44px;min-height:44px;border:0;border-radius:50%;background:#ffe066;font-size:20px;cursor:pointer}
#gotomonShooterScreen .gs-say[hidden]{display:none}
#gotomonShooterScreen .gs-fire{min-height:56px;border:0;border-radius:16px;background:#ff7ac0;color:#fff;font:inherit;font-size:22px;font-weight:900;box-shadow:0 5px 0 #b8457f;cursor:pointer;touch-action:manipulation}
#gotomonShooterScreen .gs-fire:disabled{opacity:.5}
#gotomonShooterScreen .gs-review{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
#gotomonShooterScreen .gs-review li{padding:6px 10px;border-radius:10px;background:#eef6ef;font-weight:700}
#gotomonShooterScreen .gs-review li[data-correct=false]{background:#fff3da}
@keyframes gs-scroll{to{background-position:0 200px,0 260px,0 320px,0 180px,0 0}}
@keyframes gs-glow{from{transform:none}to{transform:translateY(-3px)}}
@keyframes gs-leave{to{transform:translate(-50%,-260%) scale(.6);opacity:0}}
@keyframes gs-friend{0%,100%{transform:translate(-50%,-50%)}40%{transform:translate(-50%,-50%) scale(1.25)}}
`;
const KIND_TEXT = Object.freeze({ en2ja: 'この英語の意味のふだに ビーム！', ja2en: 'これを英語で言うと？ そのふだに ビーム！', kanji: 'この文での 読みのふだに ビーム！' });

export function createShooterView({ document: doc, dispatch, onBack, getSnapshot, cast }) {
  let active = true, lastSeq = -1, lastEventId = 0, waveKey = null, doneShown = false, shownHit = 0, pointer = null, sayWord = '';
  const removes = [], answers = [], escorts = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'gotomonShooterScreen', title: 'ゴトモン・シューター', theme: 'shooter' });
  const { root, world, dock, fx, el, field } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });

  const mark = el('i', 'gs-mark'); world.append(mark);
  const enemies = Array.from({ length: SHOOTER_FORMATION }, () => {
    const node = el('div', 'gs-enemy'), img = el('img'), plate = el('span', 'gs-plate');
    img.alt = ''; node.append(img, plate); world.append(node); return { node, img, plate, key: null };
  });
  const ship = el('div', 'gs-ship'); world.append(ship);
  const beamNodes = new Map();

  const kind = el('p', 'gs-kind');
  const ask = el('p', 'gs-ask'); ask.dataset.role = 'problem';
  const askText = el('span'), sentence = el('small');
  const say = el('button', 'gs-say', '🔊'); say.type = 'button'; say.setAttribute('aria-label', '英語を聞く');
  on(say, 'click', () => { if (active && sayWord) Speech.speakEnglish(sayWord); });
  ask.append(askText, say, sentence);
  const fireButton = el('button', 'gs-fire', 'うつ！'); fireButton.type = 'button';
  on(fireButton, 'click', () => command('fire'));
  // The shell advances after feedback; this stays hidden and only serves hosts without auto-advance.
  const go = el('button', 'gs-go', 'つぎへ'); go.type = 'button'; go.dataset.action = 'next'; go.hidden = true;
  on(go, 'click', () => proceed());
  const note = el('p', 'ya-dock-note'); note.dataset.role = 'feedback';
  dock.append(kind, ask, fireButton, note, go);
  const review = el('div', 'ya-learning-result'); review.hidden = true;
  const reviewList = el('ol', 'gs-review'); review.append(el('h3', '', '今回なかよくなったことば'), reviewList); frame.shell.append(review);
  doc.body.append(root);

  const session = () => getSnapshot();
  function command(type, extra = {}) {
    const state = session();
    if (!active || state.paused || state.phase !== 'answering') return false;
    return dispatch({ type, payload: { sessionId: state.sessionId, attemptId: state.attemptId, ...extra } });
  }
  function proceed() {
    const state = session();
    if (!active || state.paused || state.phase !== 'feedback') return false;
    return dispatch({ type: 'next', payload: { sessionId: state.sessionId } });
  }
  // A tap flies the ship there and fires; dragging only moves it.
  const xOf = event => { const box = field.getBoundingClientRect?.(); return box?.width && Number.isFinite(event?.clientX) ? (event.clientX - box.left) / box.width : null; };
  on(world, 'pointerdown', event => { const x = xOf(event); if (x === null) return; pointer = { x0: event.clientX, dragged: false }; });
  on(world, 'pointermove', event => {
    if (!pointer) return; const x = xOf(event);
    if (Math.abs(event.clientX - pointer.x0) > 12) pointer.dragged = true;
    if (pointer.dragged && x !== null) command('steer', { x });
  });
  on(world, 'pointerup', event => { const x = xOf(event), was = pointer; pointer = null; if (was && !was.dragged && x !== null) command('aimFire', { x }); });
  on(world, 'pointercancel', () => { pointer = null; });
  removes.push(bindArcadeKeys(doc, event => {
    const state = session();
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') return command('steer', { x: (state.ship?.x ?? .5) + (event.key === 'ArrowLeft' ? -0.1 : 0.1) });
    if (event.key === ' ' || event.key === 'Enter') return command('fire');
    return false;
  }));

  const renderWave = state => {
    const problem = state.problem;
    if (!problem || waveKey === `${state.wave}`) return;
    waveKey = `${state.wave}`;
    kind.textContent = `${KIND_TEXT[problem.kind] ?? ''}　${state.wave + 1}/${state.waves}`;
    askText.textContent = problem.kind === 'ja2en' ? `「${problem.meaning}」` : problem.prompt;
    sentence.textContent = '';
    if (problem.kind === 'kanji' && problem.sentence) sentence.append(el('span', '', problem.sentence.before), el('b', '', problem.prompt), el('span', '', problem.sentence.after));
    say.hidden = problem.kind !== 'en2ja'; sayWord = problem.kind === 'en2ja' ? problem.word : '';
    if (sayWord) Speech.speakEnglish(sayWord);
    note.textContent = 'タップした所へ飛んでビーム！ ドラッグで移動だけもできるよ';
    state.enemies.forEach((enemy, i) => {
      const item = enemies[enemy.slot], who = castAt(cast?.wild, state.wave * SHOOTER_FORMATION + i);
      item.key = enemy.enemyId; item.plate.textContent = enemy.plate.text; item.node.classList?.remove('gs-leave', 'gs-friend');
      item.img.hidden = !who; if (who) { item.img.src = who.imageUrl; item.node.dataset.name = who.name; }
    });
  };
  const renderField = state => {
    enemies.forEach((item, slot) => {
      const enemy = state.enemies.find(other => other.slot === slot);
      // A Gotomon that left keeps its leaving animation until the next wave.
      if (!enemy) return;
      item.node.hidden = false;
      item.node.style.left = pct(enemy.x); item.node.style.top = pct(enemy.y);
      const hint = String(state.phase === 'answering' && state.hintId === enemy.enemyId);
      if (item.node.dataset.hint !== hint) item.node.dataset.hint = hint;
    });
    ship.style.left = pct(state.ship.x); ship.style.top = pct(state.ship.y);
    mark.style.left = pct(state.ship.x);
    escorts.forEach((node, i) => { node.style.left = pct(Math.min(0.97, Math.max(0.03, state.ship.x + (i % 2 ? 1 : -1) * (0.08 + Math.floor(i / 2) * 0.05)))); node.style.top = pct(state.ship.y + 0.05); });
    const live = new Set(state.beams.map(beam => beam.beamId));
    for (const [id, node] of beamNodes) if (!live.has(id)) { node.remove(); beamNodes.delete(id); }
    for (const beam of state.beams) {
      let node = beamNodes.get(beam.beamId);
      if (!node) { node = el('i', 'gs-beam'); world.append(node); beamNodes.set(beam.beamId, node); }
      node.style.left = pct(beam.x); node.style.top = pct(beam.y);
    }
    fireButton.disabled = state.phase !== 'answering' || state.paused;
  };
  const showAnswer = state => {
    const answer = state.lastAnswer, item = enemies[answer.slot], name = item?.node.dataset.name;
    if (answer.correct) {
      if (item) restartClass(item.node, 'gs-friend');
      state.enemies.forEach(enemy => { if (enemy.slot !== answer.slot) restartClass(enemies[enemy.slot].node, 'gs-leave'); });
      const text = answer.kind === 'kanji' ? `「${answer.word}」は「${answer.meaning}」` : `${answer.word} ＝ ${answer.meaning}`;
      note.textContent = `${name ? `${name}となかよくなった！ ` : 'なかよくなった！ '}${text}`;
      fx.burst(answer.x * 100, answer.y * 100, answer.first ? 'great' : 'good', answer.first ? 1.4 : 1);
      fx.pop(answer.x * 100, answer.y * 100 - 8, '💗', 'great');
      if (answer.kind !== 'kanji') Speech.speakEnglish(answer.word);
      answers.push({ text, correct: answer.first });
      const src = item?.img.hidden === false ? item.img.src : '';
      if (src && escorts.length < 8) { const node = el('img', 'gs-escort'); node.alt = ''; node.src = src; world.append(node); escorts.push(node); }
    } else {
      if (item) restartClass(item.node, 'gs-leave');
      const plate = answer.plate;
      note.textContent = answer.kind === 'kanji' ? `そのふだは「${plate.text}」（${plate.note ?? `${plate.word}の読み`}）。光っているふだをねらおう`
        : `${name ?? 'そのゴトモン'}のふだは「${plate.word} ＝ ${plate.meaning}」だったよ。光っているふだをねらおう`;
    }
    frame.announce(note.textContent);
  };

  return {
    root,
    attachCompanion(portrait) { ship.append(portrait); },
    focusPlay() { fireButton.focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      if (!state.ship) return;
      if (!state.result) { renderWave(state); renderField(state); }
      if (state.seq !== lastSeq) {
        lastSeq = state.seq;
        if (state.lastAnswer && state.lastAnswer.hit !== shownHit) { shownHit = state.lastAnswer.hit; showAnswer(state); }
      }
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
        if (event.type === 'boost') { fx.banner('なかよしフィーバー！', 'great'); fx.flash('great'); }
      }
      const mission = w.challenge;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: Math.min(1, (state.friends ?? 0) / (state.waves || 1)), progressLabel: `なかま ${state.friends ?? 0}/${state.waves ?? 0}`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; pointer = null; Speech.cancel(); [fireButton, say, go].forEach(node => { node.disabled = true; }); },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
