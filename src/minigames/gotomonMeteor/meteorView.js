import { createArcadeFrame, restartClass, bindArcadeKeys } from '../arcade/arcadeKit.js';
import { castAt } from '../gotomonCast.js';
import { METEOR_RULES as R } from './meteorGame.js';

const pct = value => `${(value * 100).toFixed(3)}%`;
const CSS = `
#gotomonMeteorScreen .ya-field{background:radial-gradient(1px 1px at 15% 20%,#fff,transparent),radial-gradient(1px 1px at 65% 35%,#fff,transparent),radial-gradient(2px 2px at 85% 12%,#fffa,transparent),linear-gradient(#0b1030,#27205a 55%,#5a3a7a 78%,#3b2a55 78.5%,#2a1f40)}
#gotomonMeteorScreen .mt-shield{position:absolute;left:2%;right:2%;top:${pct(R.groundY - 0.07)};height:12%;border-radius:50% 50% 0 0/100% 100% 0 0;border-top:3px solid #7fd6ff55;background:linear-gradient(#7fd6ff14,transparent);pointer-events:none}
#gotomonMeteorScreen .mt-shield.mt-block{animation:mt-shield .6s ease-out}
#gotomonMeteorScreen .mt-rock{position:absolute;z-index:3;display:flex;flex-direction:column;align-items:center;gap:2px;padding:0;border:0;background:none;font:inherit;color:#fff;transform:translate(-50%,-50%);cursor:pointer;touch-action:manipulation}
#gotomonMeteorScreen .mt-rock::before{content:'';display:block;width:clamp(44px,6vw,64px);aspect-ratio:1;border-radius:46% 54% 50% 50%/55% 48% 52% 45%;background:radial-gradient(circle at 35% 30%,#b58a6a 0 12%,#8a5a3a 13% 60%,#5a3a22);box-shadow:0 0 18px #ff8a3d,0 -18px 22px -6px #ffb62788}
#gotomonMeteorScreen .mt-q{padding:2px 8px;border-radius:10px;background:#0b1030cc;border:2px solid #ffb627;font-size:clamp(16px,2.3vw,22px);font-weight:900;white-space:nowrap;font-variant-numeric:tabular-nums}
#gotomonMeteorScreen .mt-rock[data-target=true] .mt-q{background:#ffe066;color:#3a2400;border-color:#fff}
#gotomonMeteorScreen .mt-rock[data-target=true]::after{content:'';position:absolute;left:50%;top:0;width:clamp(56px,8vw,82px);aspect-ratio:1;transform:translate(-50%,-10%);border:3px dashed #ffe066;border-radius:50%;animation:mt-lock 1s linear infinite;pointer-events:none}
#gotomonMeteorScreen .mt-rock.mt-boom{animation:mt-boom .45s ease-out forwards}
#gotomonMeteorScreen .mt-base{position:absolute;z-index:4;bottom:2%;width:clamp(86px,14vw,140px);display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 4px;border:0;border-radius:16px;background:#ffffff1c;color:#fff;font:inherit;transform:translateX(-50%);cursor:pointer;touch-action:manipulation}
#gotomonMeteorScreen .mt-base img{width:clamp(44px,6.5vw,72px);height:clamp(44px,6.5vw,72px);object-fit:contain;filter:drop-shadow(0 3px 2px #0006)}
#gotomonMeteorScreen .mt-num{min-width:64%;padding:2px 10px;border-radius:12px;background:#fffdf6;color:#1b2a36;font-size:clamp(24px,3.6vw,36px);font-weight:900;text-align:center;box-shadow:0 4px 0 #c9b98f}
#gotomonMeteorScreen .mt-base:focus-visible{outline:3px solid #ffd54a;outline-offset:2px}
#gotomonMeteorScreen .mt-base[data-hint=true] .mt-num{background:#d7f7df;box-shadow:0 4px 0 #1f9d55,0 0 0 5px #37c871aa;animation:mt-glow .7s ease-in-out infinite alternate}
#gotomonMeteorScreen .mt-base.mt-fire img{animation:mt-fire .35s ease-out}
#gotomonMeteorScreen .mt-base.mt-no{animation:mt-no .4s ease-out}
#gotomonMeteorScreen .mt-base.mt-new .mt-num{animation:mt-new .3s ease-out}
#gotomonMeteorScreen .mt-title{margin:0;text-align:center;font-size:14px;font-weight:900;color:#e4d4ff}
#gotomonMeteorScreen .mt-ask{margin:0;padding:10px 12px;border-radius:14px;background:#ffffff14;color:#fff;text-align:center;font-size:clamp(30px,4.6vw,44px);font-weight:900;font-variant-numeric:tabular-nums}
#gotomonMeteorScreen .mt-review{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:6px}
#gotomonMeteorScreen .mt-review li{padding:6px 10px;border-radius:10px;background:#eef6ef;font-weight:700}
#gotomonMeteorScreen .mt-review li[data-correct=false]{background:#fff3da}
@media (max-width:700px){#gotomonMeteorScreen .mt-base{width:28%}}
@keyframes mt-lock{to{transform:translate(-50%,-10%) rotate(360deg)}}
@keyframes mt-boom{to{transform:translate(-50%,-50%) scale(1.8);opacity:0}}
@keyframes mt-shield{0%{border-top-color:#7fd6ff}100%{border-top-color:#7fd6ff55}}
@keyframes mt-glow{from{transform:none}to{transform:translateY(-4px)}}
@keyframes mt-fire{0%,100%{transform:none}40%{transform:translateY(-12px) scale(1.1)}}
@keyframes mt-no{0%,100%{transform:translateX(-50%)}30%{transform:translateX(calc(-50% - 8px))}60%{transform:translateX(calc(-50% + 8px))}}
@keyframes mt-new{from{transform:scale(.6)}to{transform:none}}
`;

export function createMeteorView({ document: doc, dispatch, onBack, getSnapshot, cast }) {
  let active = true, lastEventId = 0, doneShown = false, shownShot = 0, shownLanding = 0, askKey = null;
  const removes = [], answers = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'gotomonMeteorScreen', title: 'いん石げいげき', theme: 'meteor' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });

  const shield = el('i', 'mt-shield'); world.append(shield);
  const rocks = new Map();
  // Each base is guarded by one of the child's Gotomon; wild ones fill in, three different.
  const guards = [...(cast?.friends ?? []), ...(cast?.wild ?? [])].filter((item, i, all) => all.findIndex(other => other.id === item.id) === i);
  const bases = R.bases.map((x, slot) => {
    const node = el('button', 'mt-base'), num = el('span', 'mt-num'), who = castAt(guards, slot);
    node.type = 'button'; node.style.left = pct(x); node.dataset.slot = String(slot);
    if (who) { const img = el('img'); img.alt = ''; img.src = who.imageUrl; node.append(img); node.dataset.name = who.name; }
    node.append(num); on(node, 'click', () => fire(slot)); world.append(node);
    return { node, num, version: -1 };
  });

  const title = el('p', 'mt-title');
  const ask = el('p', 'mt-ask'); ask.dataset.role = 'problem';
  // The shell advances after feedback; this stays hidden and only serves hosts without auto-advance.
  const go = el('button', 'mt-go', 'つぎへ'); go.type = 'button'; go.dataset.action = 'next'; go.hidden = true;
  const note = el('p', 'ya-dock-note'); note.dataset.role = 'feedback';
  dock.append(title, ask, note, go);
  const review = el('div', 'ya-learning-result'); review.hidden = true;
  const reviewList = el('ol', 'mt-review'); review.append(el('h3', '', '今回のいん石'), reviewList); frame.shell.append(review);
  doc.body.append(root);

  const session = () => getSnapshot();
  function fire(slot) {
    const state = session(), base = state.bases?.[slot];
    if (!active || state.paused || state.phase !== 'answering' || !base || !state.attemptId) return false;
    return dispatch({ type: 'fire', payload: { sessionId: state.sessionId, attemptId: state.attemptId, baseId: base.baseId } });
  }
  removes.push(bindArcadeKeys(doc, event => {
    const slot = ['1', '2', '3'].indexOf(event.key);
    return slot >= 0 ? fire(slot) : false;
  }));

  const renderField = state => {
    const live = new Set(state.meteors.map(m => m.meteorId));
    for (const [id, node] of rocks) if (!live.has(id) && !node.classList?.contains('mt-boom')) { node.remove(); rocks.delete(id); }
    for (const meteor of state.meteors) {
      let node = rocks.get(meteor.meteorId);
      if (!node) {
        node = el('button', 'mt-rock'); node.type = 'button'; node.append(el('span', 'mt-q', `${meteor.question} = ?`));
        node.setAttribute('aria-label', `${meteor.question}。タップでねらう`);
        on(node, 'click', () => { const s = session(); if (active && !s.paused) dispatch({ type: 'select', payload: { sessionId: s.sessionId, meteorId: meteor.meteorId } }); });
        world.append(node); rocks.set(meteor.meteorId, node);
      }
      node.style.left = pct(meteor.x); node.style.top = pct(meteor.y);
      const aimed = String(state.targetId === meteor.meteorId);
      if (node.dataset.target !== aimed) node.dataset.target = aimed;
      node.disabled = state.paused;
    }
    bases.forEach((item, slot) => {
      const base = state.bases[slot];
      if (item.version !== base.version) { item.version = base.version; item.num.textContent = String(base.number ?? ''); item.node.setAttribute('aria-label', `${base.number}の基地`); restartClass(item.node, 'mt-new'); }
      const hint = String(state.hintBaseId === base.baseId);
      if (item.node.dataset.hint !== hint) item.node.dataset.hint = hint;
      item.node.disabled = state.paused || state.phase !== 'answering';
    });
    const titleText = state.phase === 'completed' ? '' : `いん石 ${Math.min(state.total, state.fallen + 1)}/${state.total}　まもった ${state.defended}`;
    if (title.textContent !== titleText) title.textContent = titleText;
    const text = state.problem ? `${state.problem.question} = ?` : '';
    if (askKey !== text) { askKey = text; ask.textContent = text || 'いん石が来るよ…'; if (text) note.textContent = '答えの数字の基地をタップして、げいげき！'; }
  };
  const showShot = state => {
    const shot = state.lastShot, base = bases[shot.slot], name = base?.node.dataset.name;
    const bx = R.bases[shot.slot] * 100;
    if (shot.correct) {
      fx.beam(bx, 88, shot.x * 100, shot.y * 100, shot.first ? 'great' : 'good');
      fx.burst(shot.x * 100, shot.y * 100, shot.first ? 'great' : 'good', shot.first ? 1.4 : 1.1);
      fx.pop(shot.x * 100, shot.y * 100 - 6, `${shot.question} = ${shot.answer}`, 'great');
      const rock = rocks.get(shot.meteorId); if (rock) { restartClass(rock, 'mt-boom'); rock.addEventListener?.('animationend', () => { rock.remove(); rocks.delete(shot.meteorId); }); }
      if (base) restartClass(base.node, 'mt-fire');
      note.textContent = `${name ? `${name}の` : ''}げいげき成功！ ${shot.question} = ${shot.answer}`;
      answers.push({ text: `${shot.question} = ${shot.answer}`, correct: shot.first });
    } else {
      if (base) restartClass(base.node, 'mt-no');
      note.textContent = `${shot.question} は ${shot.number} じゃないよ。光っている基地をタップしよう`;
    }
    frame.announce(note.textContent);
  };
  const showLanding = state => {
    const landing = state.lastLanding;
    restartClass(shield, 'mt-block'); fx.pop(landing.x * 100, R.groundY * 100 - 8, 'シールド！', 'info');
    note.textContent = `シールドが守ったよ。${landing.question} = ${landing.answer}。つぎは うってみよう`;
    answers.push({ text: `${landing.question} = ${landing.answer}`, correct: false });
    frame.announce(note.textContent);
  };

  return {
    root,
    attachCompanion(portrait) { const buddy = el('div'); buddy.style.cssText = 'position:absolute;left:3%;top:64px;width:56px;height:56px;pointer-events:none'; buddy.append(portrait); world.append(buddy); },
    focusPlay() { bases[0].node.focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      if (!state.bases) return;
      if (!state.result) renderField(state);
      if (state.lastShot && state.lastShot.shot !== shownShot) { shownShot = state.lastShot.shot; showShot(state); }
      if (state.lastLanding && state.lastLanding.landing !== shownLanding) { shownLanding = state.lastLanding.landing; showLanding(state); }
      if (state.result && !doneShown) {
        doneShown = true; review.hidden = false; reviewList.textContent = '';
        for (const [, node] of rocks) node.remove(); rocks.clear();
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
        if (event.type === 'boost') { fx.banner('スターげいげき！', 'great'); fx.flash('great'); }
      }
      const mission = w.challenge;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: Math.min(1, (state.fallen ?? 0) / (state.total || 1)), progressLabel: `げいげき ${state.defended ?? 0}/${state.total ?? 0}`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; [...bases.map(item => item.node), go].forEach(node => { node.disabled = true; }); },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
