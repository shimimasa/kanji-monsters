import { createArcadeFrame, restartClass, bindArcadeKeys } from '../arcade/arcadeKit.js';
import { castAt } from '../gotomonCast.js';
import { publish } from '../../core/eventBus.js';
import Speech from '../../audio/speech.js';

// The drum sits at DRUM_X on the lane; notes come in from the right edge.
const DRUM_X = 13, ENTER_X = 104, DANCERS = 8;
const CSS = `
#gotomonDrumScreen .ya-field{background:radial-gradient(circle at 12% 18%,#ffd36a55 0 5%,transparent 6%),radial-gradient(circle at 88% 12%,#ff9ab055 0 4%,transparent 5%),linear-gradient(#2a1b4d,#6b2d5c 62%,#3a2140)}
#gotomonDrumScreen .dr-lanterns{position:absolute;left:0;right:0;top:0;height:40px;background:radial-gradient(circle at 50% 60%,#ffb347 0 9px,transparent 10px) 0 0/60px 40px repeat-x;opacity:.35;pointer-events:none}
#gotomonDrumScreen .dr-card{position:absolute;left:50%;top:56px;width:min(92%,760px);transform:translateX(-50%);padding:10px 14px;border-radius:16px;background:#fffdf6;border:4px solid #ffcf5a;box-shadow:0 5px 0 #b8862a;color:#2a1b3d;text-align:center}
#gotomonDrumScreen .dr-card[data-near=true]{border-color:#ff6b4a;box-shadow:0 5px 0 #b8412a,0 0 0 5px #ff6b4a66}
#gotomonDrumScreen .dr-card b{display:block;font-size:clamp(22px,min(3.4vw,4.6vh),36px);line-height:1.3}
#gotomonDrumScreen .dr-card small{display:block;margin-top:2px;font-size:clamp(13px,1.6vw,16px);font-weight:700;color:#6b4a8a}
#gotomonDrumScreen .dr-card small em{font-style:normal;color:#c2410c}
#gotomonDrumScreen .dr-card i{display:block;font-style:normal;font-size:12px;font-weight:800;color:#8a6aa8}
#gotomonDrumScreen .dr-lane{position:absolute;left:0;right:0;top:44%;height:clamp(64px,14vh,104px);transform:translateY(-50%);background:linear-gradient(#1b1030,#2b1a45);border-block:4px solid #ffcf5a88}
#gotomonDrumScreen .dr-drum{position:absolute;left:${DRUM_X}%;top:50%;width:clamp(58px,12vh,92px);aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,#f6e6c8 0 52%,#c0392b 53% 66%,#7a1f16 67%);box-shadow:0 0 0 4px #ffcf5a;z-index:2}
#gotomonDrumScreen .dr-drum.dr-don{animation:dr-don .18s ease-out}
#gotomonDrumScreen .dr-drum.dr-ka{animation:dr-ka .18s ease-out}
#gotomonDrumScreen .dr-drum[data-beat=true]{box-shadow:0 0 0 6px #ffe89a}
#gotomonDrumScreen .dr-note{position:absolute;top:50%;display:grid;place-items:center;transform:translate(-50%,-50%);border-radius:50%;font-weight:900;color:#fff;z-index:3;pointer-events:none;box-shadow:0 0 0 3px #fff}
#gotomonDrumScreen .dr-note[data-kind=don]{width:clamp(34px,7vh,52px);aspect-ratio:1;background:#e74c3c}
#gotomonDrumScreen .dr-note[data-kind=ka]{width:clamp(34px,7vh,52px);aspect-ratio:1;background:#3498db}
#gotomonDrumScreen .dr-note[data-kind=quiz]{width:clamp(54px,11vh,84px);aspect-ratio:1;background:radial-gradient(circle at 35% 30%,#fff7c2,#ffcf5a 60%,#d9941e);color:#5a2d00;font-size:clamp(24px,5vh,38px);box-shadow:0 0 0 4px #fff,0 0 14px #ffe066}
#gotomonDrumScreen .dr-note[data-state=hit]{animation:dr-hit .35s ease-out forwards}
#gotomonDrumScreen .dr-note[data-state=miss]{animation:dr-miss .5s ease-out forwards}
#gotomonDrumScreen .dr-note[data-state=passed]{opacity:.35}
#gotomonDrumScreen .dr-stage{position:absolute;left:0;right:0;bottom:0;height:30%;background:linear-gradient(#0000,#0006);display:flex;align-items:flex-end;justify-content:center;gap:1%;padding:0 4% 2%}
#gotomonDrumScreen .dr-dancer{width:min(11%,90px);aspect-ratio:1;animation:dr-bob var(--beat,600ms) ease-in-out infinite alternate}
#gotomonDrumScreen .dr-dancer img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 4px 3px #0007)}
#gotomonDrumScreen .dr-dancer.dr-join{animation:dr-join .6s ease-out,dr-bob var(--beat,600ms) ease-in-out .6s infinite alternate}
#gotomonDrumScreen .dr-crowd{position:absolute;right:3%;bottom:31%;color:#ffe2b8;font-size:13px;font-weight:900}
#gotomonDrumScreen .dr-title{margin:0;text-align:center;font-size:14px;font-weight:900;color:#ffd1e2}
#gotomonDrumScreen .dr-pads{display:grid;grid-template-columns:1fr 1fr;gap:10px}
#gotomonDrumScreen .dr-pad{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:clamp(96px,17vh,150px);border:0;border-radius:22px;color:#fff;font:inherit;font-weight:900;cursor:pointer;touch-action:manipulation;user-select:none;-webkit-user-select:none}
#gotomonDrumScreen .dr-pad b{font-size:clamp(28px,4vw,40px);line-height:1}
#gotomonDrumScreen .dr-pad span{font-size:clamp(15px,1.9vw,19px)}
#gotomonDrumScreen .dr-pad small{font-size:11px;opacity:.8}
#gotomonDrumScreen .dr-pad[data-drum=don]{background:radial-gradient(circle at 50% 40%,#ff7a6a,#c0392b);box-shadow:0 6px 0 #7a1f16}
#gotomonDrumScreen .dr-pad[data-drum=ka]{background:radial-gradient(circle at 50% 40%,#6ab8f0,#2471a3);box-shadow:0 6px 0 #154360}
#gotomonDrumScreen .dr-pad.dr-press{animation:dr-press .15s ease-out}
@keyframes dr-don{0%{transform:translate(-50%,-50%) scale(1.18)}100%{transform:translate(-50%,-50%)}}
@keyframes dr-ka{0%{transform:translate(-50%,-50%) rotate(-8deg) scale(1.06)}100%{transform:translate(-50%,-50%)}}
@keyframes dr-hit{to{transform:translate(-50%,-160%) scale(1.3);opacity:0}}
@keyframes dr-miss{0%{transform:translate(-50%,-50%)}40%{transform:translate(-30%,-90%) rotate(20deg)}100%{transform:translate(0,40%) rotate(60deg);opacity:0}}
@keyframes dr-bob{from{transform:translateY(0)}to{transform:translateY(-14%)}}
@keyframes dr-join{0%{transform:translateY(60%) scale(.3);opacity:0}70%{transform:translateY(-20%) scale(1.15);opacity:1}100%{transform:none}}
@keyframes dr-press{0%{transform:scale(.94)}100%{transform:none}}
`;

// Drum sounds are made on the spot (no files), so they sound on the beat.
function createDrumSound(win) {
  let ctx = null, volume = 0.2;
  try { publish('getSEVolume', value => { if (Number.isFinite(value)) volume = value; }); } catch { /* keep the default */ }
  const context = () => {
    if (!ctx) { const Ctor = win?.AudioContext || win?.webkitAudioContext; if (!Ctor) return null; try { ctx = new Ctor(); } catch { return null; } }
    if (ctx.state === 'suspended') ctx.resume?.().catch?.(() => {});
    return ctx;
  };
  const tone = (type, from, to, decay, level) => {
    const c = context(); if (!c || volume <= 0) return;
    const osc = c.createOscillator(), gain = c.createGain(), now = c.currentTime;
    osc.type = type; osc.frequency.setValueAtTime(from, now); osc.frequency.exponentialRampToValueAtTime(to, now + decay);
    gain.gain.setValueAtTime(Math.min(1, level * volume * 3), now); gain.gain.exponentialRampToValueAtTime(0.001, now + decay);
    osc.connect(gain).connect(c.destination); osc.start(now); osc.stop(now + decay + 0.02);
  };
  return {
    don() { tone('sine', 140, 55, 0.28, 0.9); },
    ka() { tone('triangle', 1400, 900, 0.07, 0.5); },
    close() { try { ctx?.close?.(); } catch { /* already closed */ } ctx = null; },
  };
}

export function createDrumView({ document: doc, dispatch, onBack, getSnapshot, cast }) {
  let active = true, lastEventId = 0, doneShown = false, shownHit = 0, problemKey = null, dancerCount = 0, lastBeat = -1;
  const removes = [], noteNodes = new Map();
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'gotomonDrumScreen', title: 'ゴトモン・リズムたいこ', theme: 'drum' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });
  const sound = createDrumSound(doc.defaultView);

  const card = el('div', 'dr-card'); card.dataset.role = 'problem';
  const lane = el('div', 'dr-lane'), drum = el('div', 'dr-drum');
  const stage = el('div', 'dr-stage'), crowd = el('p', 'dr-crowd');
  lane.append(drum); world.append(el('div', 'dr-lanterns'), card, lane, stage, crowd);

  const title = el('p', 'dr-title');
  const pads = el('div', 'dr-pads');
  const pad = (drumKind, big, word, key) => {
    const node = el('button', 'dr-pad'); node.type = 'button'; node.dataset.drum = drumKind;
    node.append(el('b', '', big), el('span', '', word), el('small', '', key)); node.setAttribute('aria-label', `${big} ${word}`);
    // Pointer down, not click: a drum sounds the moment it is struck.
    on(node, 'pointerdown', event => { event.preventDefault?.(); strike(drumKind); });
    on(node, 'click', event => { if (event.detail === 0) strike(drumKind); });
    return node;
  };
  const donPad = pad('don', 'ドン', 'そう！ ○', 'F / J キー'), kaPad = pad('ka', 'カッ', 'ちがう！ ×', 'D / K キー');
  pads.append(donPad, kaPad);
  const note = el('p', 'ya-dock-note'); note.dataset.role = 'feedback';
  dock.append(title, pads, note);
  doc.body.append(root);

  function strike(drumKind) {
    const state = getSnapshot();
    if (!active || state.paused || state.phase !== 'answering') return false;
    sound[drumKind]();
    restartClass(drum, drumKind === 'don' ? 'dr-don' : 'dr-ka');
    restartClass(drumKind === 'don' ? donPad : kaPad, 'dr-press');
    dispatch({ type: 'hit', payload: { sessionId: state.sessionId, attemptId: state.attemptId, drum: drumKind } });
    return true;
  }
  removes.push(bindArcadeKeys(doc, event => {
    if (event.repeat) return false;
    const key = event.key?.toLowerCase();
    if (key === 'f' || key === 'j') return strike('don');
    if (key === 'd' || key === 'k') return strike('ka');
    return false;
  }));

  const addDancer = (who, joining) => {
    if (!who || stage.children.length >= DANCERS) return;
    const box = el('div', joining ? 'dr-dancer dr-join' : 'dr-dancer'), img = el('img'); img.alt = ''; img.src = who.imageUrl; box.append(img);
    box.style.animationDelay = joining ? '' : `${(stage.children.length % 2) * 120}ms`;
    stage.append(box);
  };
  const renderCard = state => {
    const key = state.problem?.problemId ?? (state.phase === 'completed' ? 'done' : 'none');
    if (key === problemKey) return;
    problemKey = key; card.textContent = '';
    if (!state.problem) { card.append(el('b', '', state.phase === 'completed' ? 'おまつり だいせいこう！' : 'リズムにのって、たたこう！')); return; }
    const p = state.problem;
    card.append(el('i', '', p.again ? 'もう一度！ そう？ ちがう？' : 'そう？ ちがう？'), el('b', '', p.statement));
    if (p.sentence) { const small = el('small'); small.append(el('span', '', p.sentence.before), el('em', '', p.statement.match(/「(.+?)」/)?.[1] ?? ''), el('span', '', p.sentence.after)); card.append(small); }
    const word = p.kind === 'en2ja' ? p.statement.split(' ')[0] : null;
    if (word) Speech.speakEnglish(word);
  };
  const renderNotes = state => {
    const seen = new Set();
    for (const item of state.notes) {
      seen.add(item.noteId);
      let node = noteNodes.get(item.noteId);
      if (!node) {
        node = el('div', 'dr-note', item.kind === 'quiz' ? '？' : item.kind === 'don' ? 'ドン' : 'カッ'); node.dataset.kind = item.kind;
        if (item.kind !== 'quiz') node.style.fontSize = '11px';
        lane.append(node); noteNodes.set(item.noteId, node);
      }
      if (node.dataset.state !== item.state) node.dataset.state = item.state;
      // Notes keep sliding after they are struck or pass, and fade out.
      const x = DRUM_X + (item.at - state.songMs) / state.travelMs * (ENTER_X - DRUM_X);
      node.style.left = `${x.toFixed(2)}%`;
      node.hidden = x > ENTER_X + 4;
    }
    for (const [id, node] of noteNodes) if (!seen.has(id)) { node.remove(); noteNodes.delete(id); }
    const next = state.notes.find(item => item.kind === 'quiz' && item.state === 'coming');
    card.dataset.near = String(!!next && next.at - state.songMs < state.beatMs * 2);
    const beat = Math.floor(state.songMs / state.beatMs);
    if (beat !== lastBeat) { lastBeat = beat; drum.dataset.beat = 'true'; } else if (state.songMs % state.beatMs > 120) drum.dataset.beat = 'false';
  };
  const showHit = state => {
    const hit = state.lastHit;
    if (!hit.quiz) {
      fx.pop(DRUM_X + 4, 62, hit.right ? (hit.grade === 'great' ? 'かんぺき！' : 'いいね！') : 'おっと', hit.right ? 'good' : 'soft');
      return;
    }
    if (hit.right) {
      fx.burst(DRUM_X, 44, 'great', hit.grade === 'great' ? 1.6 : 1.2);
      fx.pop(DRUM_X + 8, 62, hit.truth ? 'そう！' : 'ちがう！', 'great');
      const who = castAt(cast?.wild, dancerCount++);
      note.textContent = hit.truth ? `そう！ ${hit.explain}` : `ちがう！ 答えは「${hit.answer}」${hit.shownNote ? `（「${hit.shown}」は${hit.shownNote}）` : ''}`;
      if (who) { addDancer(who, true); note.textContent += `　${who.name}がおどりに来た！`; }
    } else {
      fx.pop(DRUM_X + 8, 62, 'おしい！', 'soft');
      note.textContent = hit.truth ? `じつは そう！ ${hit.explain}` : `じつは ちがう。答えは「${hit.answer}」${hit.shownNote ? `（「${hit.shown}」は${hit.shownNote}）` : ''}`;
      if (hit.first) note.textContent += '　もう一度 出てくるよ';
    }
    frame.announce(note.textContent);
  };

  // The companion's friends are dancing from the start; more join with each answer.
  addDancer(castAt(cast?.friends, 0), false);

  return {
    root,
    attachCompanion(portrait) { const buddy = el('div'); buddy.style.cssText = 'position:absolute;left:2%;bottom:2%;width:64px;height:64px;pointer-events:none;z-index:2'; buddy.append(portrait); world.append(buddy); },
    focusPlay() { donPad.focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      if (!state.notes) return;
      if (!stage.dataset.beat) { stage.dataset.beat = String(state.beatMs); stage.style.setProperty?.('--beat', `${state.beatMs}ms`); }
      renderCard(state);
      renderNotes(state);
      if (state.lastHit && state.lastHit.hit !== shownHit) { shownHit = state.lastHit.hit; showHit(state); }
      const titleText = state.phase === 'completed' ? '' : `もんだい ${state.resolved}/${state.total}　リズム ${state.drumCombo}コンボ`;
      if (title.textContent !== titleText) title.textContent = titleText;
      const crowdText = stage.children.length ? `おどっているゴトモン ${stage.children.length}` : '';
      if (crowd.textContent !== crowdText) crowd.textContent = crowdText;
      if (state.result && !doneShown) {
        doneShown = true;
        fx.banner('おまつり だいせいこう！', 'great'); fx.burst(50, 50, 'great', 2);
        note.textContent = `${state.result.correct}問 1回で正解！ かんぺきなリズム ${state.result.greats}回`;
      }
    },
    present(play, dt, state) {
      if (!active || !state) return;
      frame.tick(dt);
      const w = play.world || {};
      const event = w.lastEvent;
      if (event && event.id !== lastEventId) {
        lastEventId = event.id;
        if (event.type === 'boost') { fx.banner('おまつりフィーバー！', 'great'); fx.flash('great'); }
      }
      const mission = w.challenge;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: Math.min(1, (state.resolved ?? 0) / (state.total || 1)), progressLabel: `もんだい ${state.resolved ?? 0}/${state.total ?? 0}`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; donPad.disabled = true; kaPad.disabled = true; },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); sound.close(); frame.dispose(); },
  };
}
