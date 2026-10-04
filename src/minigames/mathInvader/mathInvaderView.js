import { restartClass, toggleClass, setVar, createArcadeFrame, createNumberPad, bindArcadeKeys } from '../arcade/arcadeKit.js';
import { castAt } from '../gotomonCast.js';
import { MATH_INVADER_RULES } from './mathInvaderGame.js';

const CSS = `
#mathInvaderScreen .ya-field{background:radial-gradient(ellipse at 50% 120%,#3b2a7a 0,transparent 60%),linear-gradient(#060b24,#131d4a 60%,#23205a)}
#mathInvaderScreen .iv-stars,#mathInvaderScreen .iv-stars2{position:absolute;inset:-50% 0 0;background-image:radial-gradient(1.5px 1.5px at 20px 30px,#fff,transparent),radial-gradient(1px 1px at 90px 120px,#cde,transparent),radial-gradient(2px 2px at 160px 60px,#fff9,transparent),radial-gradient(1px 1px at 230px 170px,#fff,transparent);background-size:260px 200px;animation:iv-drift 18s linear infinite;opacity:.8}
#mathInvaderScreen .iv-stars2{background-size:180px 150px;animation-duration:9s;opacity:.45}
#mathInvaderScreen .iv-lane{position:absolute;top:0;bottom:12%;width:1px;background:linear-gradient(#ffffff00,#ffffff22)}
#mathInvaderScreen .iv-barrier{position:absolute;left:4%;right:4%;height:10px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;transform:translateY(-50%)}
#mathInvaderScreen .iv-barrier i{border-radius:8px;background:linear-gradient(90deg,#63e6ff,#b4f5ff);box-shadow:0 0 16px #63e6ff;transition:opacity .3s,filter .3s}
#mathInvaderScreen .iv-barrier i.off{opacity:.18;filter:grayscale(1);box-shadow:none}
#mathInvaderScreen .iv-turret{position:absolute;left:50%;bottom:1.5%;width:clamp(74px,11vw,110px);height:clamp(74px,11vw,110px);transform:translateX(-50%);z-index:4}
#mathInvaderScreen .iv-turret::before{content:'';position:absolute;left:12%;right:12%;bottom:0;height:34%;border-radius:40px 40px 10px 10px;background:linear-gradient(#8fa4c9,#4f5f86);box-shadow:0 0 0 3px #c9d6f0 inset}
#mathInvaderScreen .iv-turret .gt-portrait{position:absolute;inset:0 0 18% 0;display:block;width:auto;height:auto;background:none;border:0}
#mathInvaderScreen .iv-turret .gt-portrait img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 4px 6px #000a)}
#mathInvaderScreen .iv-turret[data-mood=fire] .gt-portrait{animation:iv-recoil .25s ease-out}
#mathInvaderScreen .iv-turret[data-mood=miss] .gt-portrait{animation:ya-nudge .35s ease-out}
#mathInvaderScreen .iv-turret[data-fever=true]::after{content:'';position:absolute;inset:-18%;border-radius:50%;background:radial-gradient(circle,#ffd54a66,transparent 70%);animation:ya-glow .5s infinite alternate}
#mathInvaderScreen .iv-enemy{position:absolute;z-index:3;transform:translate(-50%,-50%);min-width:clamp(118px,17vw,170px);padding:0;border:0;background:none;color:#fff;font:inherit;cursor:pointer;touch-action:manipulation;transition:top .1s linear}
#mathInvaderScreen .iv-ship{position:relative;display:block;padding:18px 14px 12px;border-radius:50% 50% 40% 40%/60% 60% 40% 40%;background:radial-gradient(ellipse at 50% 20%,#b3ffcf 0 18%,transparent 19%),linear-gradient(#42d392,#1e8a5e);box-shadow:0 6px 0 #135a3e,0 0 18px #42d39288;animation:iv-sway 2.6s ease-in-out infinite alternate}
#mathInvaderScreen .iv-enemy[data-wave="1"] .iv-ship{background:radial-gradient(ellipse at 50% 20%,#ffe0b3 0 18%,transparent 19%),linear-gradient(#ffa24c,#d4621d);box-shadow:0 6px 0 #8a3c0c,0 0 18px #ffa24c88}
#mathInvaderScreen .iv-enemy[data-wave="2"] .iv-ship{background:radial-gradient(ellipse at 50% 20%,#ffd1f4 0 18%,transparent 19%),linear-gradient(#f06ad0,#a3319a);box-shadow:0 6px 0 #6a1a65,0 0 18px #f06ad088}
#mathInvaderScreen .iv-enemy[data-boss=true]{min-width:clamp(180px,26vw,260px)}
#mathInvaderScreen .iv-enemy[data-boss=true] .iv-ship{padding:30px 18px 20px;background:radial-gradient(ellipse at 50% 18%,#fff3 0 16%,transparent 17%),linear-gradient(#8e5cff,#4b21b8);box-shadow:0 8px 0 #2a0f75,0 0 30px #a57dff;animation-duration:3.4s}
#mathInvaderScreen .iv-enemy[data-boss=true] .iv-ship::before{content:'BOSS';position:absolute;top:4px;left:50%;transform:translateX(-50%);font-size:12px;font-weight:900;letter-spacing:.2em;color:#ffe066}
#mathInvaderScreen .iv-mon{display:block;width:clamp(48px,7vw,72px);height:clamp(48px,7vw,72px);margin:-34px auto 2px;object-fit:contain;filter:drop-shadow(0 3px 2px #0007)}
#mathInvaderScreen .iv-enemy[data-boss=true] .iv-mon{width:clamp(80px,11vw,120px);height:clamp(80px,11vw,120px);margin-top:-54px}
#mathInvaderScreen .iv-question{display:block;font-size:clamp(22px,3.4vw,32px);font-weight:900;white-space:nowrap;text-shadow:0 2px 0 #0006;font-variant-numeric:tabular-nums}
#mathInvaderScreen .iv-enemy[data-boss=true] .iv-question{font-size:clamp(28px,4.4vw,42px)}
#mathInvaderScreen .iv-enemy[data-target=true]::after{content:'';position:absolute;inset:-12px -10px;border:3px dashed #ffe066;border-radius:24px;animation:iv-lock 1s ease-in-out infinite;pointer-events:none}
#mathInvaderScreen .iv-enemy[data-danger=true] .iv-ship{outline:3px solid #ffd166;outline-offset:3px}
#mathInvaderScreen .iv-enemy[data-hit=true] .iv-ship{animation:ya-nudge .35s ease-out}
#mathInvaderScreen .iv-enemy:disabled{cursor:default}
#mathInvaderScreen .iv-review{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
#mathInvaderScreen .iv-review li{padding:6px 10px;border-radius:10px;background:#eef6ef;font-weight:700}
#mathInvaderScreen .iv-review li[data-outcome=escaped]{background:#fff3da}
@keyframes iv-drift{to{transform:translateY(50%)}}
@keyframes iv-sway{from{transform:translateX(-6px) rotate(-2deg)}to{transform:translateX(6px) rotate(2deg)}}
@keyframes iv-lock{50%{opacity:.4;transform:scale(1.06)}}
@keyframes iv-recoil{0%{transform:translateY(0)}35%{transform:translateY(8px) scale(.95)}100%{transform:none}}
`;

const LANE_X = [20, 50, 80];
const TURRET = { x: 50, y: 90 };

export function createMathInvaderView({ document: doc, dispatch, onBack, getSnapshot, cast }) {
  // Wild Gotomon ride the ships; the boss ship carries a stage boss.
  let shipSerial = 0;
  const riders = new Map();
  let active = true, entry = '', lastAttemptSerial = 0, lastEscapeSerial = 0, lastSpawned = 0, lastBoosts = 0, moodMs = 0;
  const removes = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'mathInvaderScreen', title: 'けいさんインベーダー', theme: 'space' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });
  world.append(el('div', 'iv-stars'), el('div', 'iv-stars2'));
  for (const x of LANE_X) { const lane = el('i', 'iv-lane'); lane.style.left = `${x}%`; world.append(lane); }
  const barrier = el('div', 'iv-barrier'); barrier.style.top = `${MATH_INVADER_RULES.barrierY * 100 + 2}%`;
  // Ships fly between a top band kept clear for the HUD (two rows on phones) and the barrier.
  const fieldY = y => {
    const top = Math.min(10000 / (world.clientHeight || 600), 30), limit = MATH_INVADER_RULES.barrierY;
    return top + (Math.min(y, limit) / limit) * (limit * 100 - top);
  };
  const shields = [0, 1, 2].map(() => { const node = el('i'); barrier.append(node); return node; });
  const turret = el('div', 'iv-turret'); world.append(barrier, turret);

  const display = el('div', 'ya-entry'); display.setAttribute('aria-live', 'polite'); display.setAttribute('aria-label', 'こたえ');
  const note = el('p', 'ya-dock-note');
  const pad = createNumberPad(doc, { on,
    onDigit: digit => { if (canAnswer() && entry.length < 3) { entry += digit; renderEntry(); } },
    onDelete: () => { if (canAnswer()) { entry = entry.slice(0, -1); renderEntry(); } },
    onFire: () => fire(),
  });
  dock.append(display, note, pad.root);
  const review = el('div', 'ya-learning-result'); review.hidden = true;
  const reviewList = el('ol', 'iv-review'); review.append(el('h3', '', '今回の計算'), reviewList); frame.shell.append(review);
  doc.body.append(root);

  const canAnswer = () => { const state = getSnapshot(); return active && state.phase === 'playing' && !state.paused; };
  const renderEntry = () => {
    display.dataset.empty = String(!entry);
    display.textContent = '';
    if (entry) display.textContent = entry;
    else display.append(el('span', '', '答えの数字を入力'));
  };
  const fire = () => {
    const state = getSnapshot();
    if (!canAnswer() || !entry) { if (!entry) restartClass(display, 'ya-miss'); return false; }
    const accepted = dispatch({ type: 'submit', payload: { sessionId: state.sessionId, token: state.inputToken, value: entry } });
    if (accepted) { entry = ''; renderEntry(); }
    return accepted;
  };
  removes.push(bindArcadeKeys(doc, event => {
    if (!active) return false;
    if (/^[0-9]$/.test(event.key)) { if (canAnswer() && entry.length < 3) { entry += event.key; renderEntry(); } return true; }
    if (event.key === 'Backspace') { if (canAnswer()) { entry = entry.slice(0, -1); renderEntry(); } return true; }
    if (event.key === 'Enter' && !event.repeat) { fire(); return true; }
    return false;
  }));
  renderEntry();

  const enemyNodes = new Map();
  const syncEnemies = state => {
    const live = new Set(state.enemies.map(enemy => enemy.enemyId));
    for (const [id, node] of enemyNodes) if (!live.has(id)) { node.remove(); enemyNodes.delete(id); }
    for (const enemy of state.enemies) {
      let node = enemyNodes.get(enemy.enemyId);
      if (!node) {
        node = el('button', 'iv-enemy'); node.type = 'button'; node.dataset.enemyId = enemy.enemyId;
        const ship = el('span', 'iv-ship'), rider = enemy.boss ? cast?.boss ?? castAt(cast?.wild, shipSerial) : castAt(cast?.wild, shipSerial);
        shipSerial++;
        if (rider) { const img = el('img', 'iv-mon'); img.alt = ''; img.src = rider.imageUrl; ship.append(img); node.dataset.rider = rider.name; riders.set(enemy.enemyId, rider.name); }
        ship.append(el('span', 'iv-question', `${enemy.question} = ?`)); node.append(ship);
        node.dataset.wave = String(enemy.wave); node.dataset.boss = String(enemy.boss);
        node.style.left = `${LANE_X[enemy.lane]}%`;
        node.setAttribute('aria-label', `${enemy.question}。タップでねらう`);
        on(node, 'click', () => {
          const current = getSnapshot();
          if (!active || current.paused) return;
          dispatch({ type: 'select', payload: { sessionId: current.sessionId, enemyId: enemy.enemyId, problemId: enemy.problemId } });
        });
        world.append(node); enemyNodes.set(enemy.enemyId, node);
      }
      node.style.top = `${fieldY(enemy.y)}%`;
      node.dataset.target = String(state.targetId === enemy.enemyId);
      node.dataset.danger = String(enemy.y >= .62);
      node.disabled = state.paused || state.phase !== 'playing';
    }
  };
  const reactToEvents = state => {
    const attempt = state.lastAttempt;
    if (attempt && attempt.serial !== lastAttemptSerial) {
      lastAttemptSerial = attempt.serial;
      const x = LANE_X[attempt.lane], y = fieldY(attempt.y);
      if (attempt.correct) {
        fx.beam(TURRET.x, TURRET.y, x, y, attempt.boss ? 'great' : 'good');
        fx.burst(x, y, attempt.boss ? 'great' : 'good', attempt.boss ? 2 : 1);
        fx.pop(x, y - 6, attempt.boss ? 'ボス撃破！' : `${attempt.question} = ${attempt.value}`, attempt.boss ? 'great' : 'good');
        if (attempt.boss) { fx.banner('ボス撃破！', 'great'); fx.flash('great'); }
        turret.dataset.mood = 'fire'; moodMs = 260;
        const rider = riders.get(attempt.enemyId);
        note.textContent = state.streak >= 3 ? `${state.streak}連続！ その調子！` : rider ? `${rider}に命中！ おとなしくなった` : '命中！';
        frame.announce(`命中。${attempt.question} は ${attempt.value}`);
      } else {
        fx.pop(TURRET.x, 74, 'おしい！', 'soft'); fx.shake();
        const node = enemyNodes.get(attempt.enemyId);
        if (node) { node.dataset.hit = 'false'; void node.offsetWidth; node.dataset.hit = 'true'; }
        restartClass(display, 'ya-miss');
        turret.dataset.mood = 'miss'; moodMs = 350;
        note.textContent = `${attempt.value} ではなかったよ。もう一度！`;
        frame.announce(`${attempt.value} ではありません`);
      }
    }
    const escape = state.lastEscape;
    if (escape && escape.serial !== lastEscapeSerial) {
      lastEscapeSerial = escape.serial;
      fx.pop(LANE_X[escape.lane], MATH_INVADER_RULES.barrierY * 100 - 4, `${escape.question} = ${escape.answer}`, 'info');
      fx.flash('soft');
      note.textContent = `バリアが守ったよ。${escape.question} = ${escape.answer}`;
      frame.announce(`バリアが守りました。${escape.question} は ${escape.answer}`);
    }
    if (state.spawned !== lastSpawned) {
      if (state.enemies.some(enemy => enemy.boss) && lastSpawned < state.total) { fx.banner('ボス登場！', 'great'); frame.announce('ボスが出てきた'); }
      lastSpawned = state.spawned;
    }
  };

  return {
    root,
    attachCompanion(portrait) { turret.append(portrait); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      syncEnemies(state);
      reactToEvents(state);
      shields.forEach((node, index) => toggleClass(node, 'off', index >= state.life));
      const disabled = state.paused || state.phase !== 'playing';
      pad.setEnabled(!disabled);
      if (!note.textContent) note.textContent = '同じ答えの敵に、自動で命中するよ';
      if (state.result && review.hidden) {
        review.hidden = false; reviewList.textContent = '';
        for (const item of state.solved) {
          const row = el('li', '', `${item.outcome === 'correct' ? '✓' : '☆'} ${item.question} = ${item.answer}`);
          row.dataset.outcome = item.outcome; reviewList.append(row);
        }
      }
    },
    present(play, dt, state) {
      if (!active) return;
      frame.tick(dt);
      moodMs = Math.max(0, moodMs - dt); if (!moodMs) turret.dataset.mood = '';
      const w = play.world || {};
      turret.dataset.fever = String(!!w.fever);
      if (play.boosts !== lastBoosts) { if (play.boosts > lastBoosts) { fx.banner('あいぼうの連射！', 'great'); fx.flash('great'); } lastBoosts = play.boosts; }
      const mission = w.challenge;
      frame.hud.set({ points: (state?.score ?? play.learningPoints) + play.bonus, comboCount: play.combo,
        progressValue: (state?.resolved ?? 0) / 10, progressLabel: `撃破 ${state?.correct ?? 0} · のこり ${10 - (state?.resolved ?? 0)}`,
        life: state?.life ?? 3, maxLife: 3, lifeLabel: 'バリア', gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; pad.setEnabled(false); },
    dispose() {
      this.stopInput(); removes.splice(0).forEach(remove => remove());
      enemyNodes.clear(); frame.dispose();
    },
  };
}
