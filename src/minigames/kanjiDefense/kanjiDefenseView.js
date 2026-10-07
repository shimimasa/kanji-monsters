import { restartClass, toggleClass, setVar, createArcadeFrame } from '../arcade/arcadeKit.js';

const CSS = `
#kanjiDefenseScreen .ya-field{background:linear-gradient(#7cc4ea 0,#bfe6f5 16%,#9fd38a 17%,#7fc06a 60%,#6aa957 100%)}
#kanjiDefenseScreen .kd-forest{position:absolute;left:0;right:0;top:9%;height:12%;background:radial-gradient(circle at 10% 100%,#2f7a47 0 40%,transparent 41%),radial-gradient(circle at 30% 100%,#3c8a52 0 46%,transparent 47%),radial-gradient(circle at 52% 100%,#2f7a47 0 42%,transparent 43%),radial-gradient(circle at 74% 100%,#3c8a52 0 48%,transparent 49%),radial-gradient(circle at 93% 100%,#2f7a47 0 40%,transparent 41%)}
#kanjiDefenseScreen .kd-path{position:absolute;top:18%;bottom:0;width:22%;transform:translateX(-50%);background:linear-gradient(#d8c28a,#c9ae70);clip-path:polygon(35% 0,65% 0,100% 100%,0 100%);opacity:.9}
#kanjiDefenseScreen .kd-gate{position:absolute;left:0;right:0;bottom:0;height:14%;background:linear-gradient(#8a6a4a,#5c4330);border-top:5px solid #d9b67a;box-shadow:0 -4px 0 #0002}
#kanjiDefenseScreen .kd-gate::before{content:'';position:absolute;left:0;right:0;top:-24px;height:18px;background:repeating-linear-gradient(90deg,#8a6a4a 0 26px,transparent 26px 40px)}
#kanjiDefenseScreen .kd-guard{position:absolute;left:0;right:0;bottom:14%;height:6px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:0 4%}
#kanjiDefenseScreen .kd-guard i{border-radius:6px;background:#fff3a6;box-shadow:0 0 12px #fff3a6;transition:opacity .3s}
#kanjiDefenseScreen .kd-guard i.off{opacity:.2;box-shadow:none}
#kanjiDefenseScreen .kd-hero{position:absolute;left:50%;bottom:2%;width:clamp(70px,10vw,104px);height:clamp(70px,10vw,104px);transform:translateX(-50%);z-index:5}
#kanjiDefenseScreen .kd-hero .gt-portrait{display:block;width:100%;height:100%;background:none;border:0}
#kanjiDefenseScreen .kd-hero .gt-portrait img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 4px 5px #0008)}
#kanjiDefenseScreen .kd-hero[data-mood=cast] .gt-portrait{animation:iv-cast .3s ease-out}
#kanjiDefenseScreen .kd-hero[data-fever=true]::after{content:'';position:absolute;inset:-20%;border-radius:50%;background:radial-gradient(circle,#fff38a88,transparent 70%);animation:ya-glow .5s infinite alternate}
#kanjiDefenseScreen .kd-monster{position:absolute;z-index:3;display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-78%) scale(var(--scale,1));transform-origin:50% 100%;padding:0;border:0;background:none;font:inherit;cursor:pointer;touch-action:manipulation;transition:top .12s linear}
#kanjiDefenseScreen .kd-sign{position:relative;padding:4px 12px 5px;border-radius:10px;background:#fffdf3;color:#2a1c10;border:3px solid #8a6a4a;font-size:clamp(24px,3.6vw,36px);font-weight:900;line-height:1.1;box-shadow:0 4px 0 #5c4330;white-space:nowrap}
#kanjiDefenseScreen .kd-sign::after{content:'';position:absolute;left:50%;bottom:-12px;width:4px;height:10px;margin-left:-2px;background:#8a6a4a}
#kanjiDefenseScreen .kd-body{width:clamp(64px,9vw,96px);height:clamp(58px,8vw,86px);margin-top:8px;animation:kd-walk .7s ease-in-out infinite alternate}
#kanjiDefenseScreen .kd-body img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 5px 3px #0005)}
#kanjiDefenseScreen .kd-body .kd-fallback{display:grid;place-items:center;width:100%;height:100%;font-size:40px}
#kanjiDefenseScreen .kd-monster[data-target=true] .kd-sign{border-color:#ff9f1c;box-shadow:0 4px 0 #b86a00,0 0 0 4px #ffe08a}
#kanjiDefenseScreen .kd-monster[data-target=true]::before{content:'ねらい';position:absolute;top:-24px;left:50%;transform:translateX(-50%);font-size:12px;font-weight:900;color:#fff;background:#ff9f1c;border-radius:99px;padding:2px 8px;white-space:nowrap}
#kanjiDefenseScreen .kd-monster[data-danger=true] .kd-sign{animation:kd-pulse .8s ease-in-out infinite alternate}
#kanjiDefenseScreen .kd-monster[data-hit=true]{animation:ya-nudge .35s ease-out}
#kanjiDefenseScreen .kd-hint{position:absolute;top:-58px;left:50%;transform:translateX(-50%);padding:4px 10px;border-radius:10px;background:#1b3550;color:#fff;font-size:15px;font-weight:800;white-space:nowrap}
#kanjiDefenseScreen .kd-target{display:flex;align-items:center;justify-content:center;gap:10px;margin:0;min-height:44px;font-size:16px;color:#d8e8f0}
#kanjiDefenseScreen .kd-target strong{font-size:clamp(26px,4vw,34px);color:#fff;letter-spacing:.06em}
#kanjiDefenseScreen .kd-lanes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
#kanjiDefenseScreen .kd-lane{display:grid;place-items:center;gap:2px;min-width:0;min-height:52px;padding:4px;border:2px solid #ffffff55;border-radius:12px;background:#ffffff1c;color:#fff;font:inherit;cursor:pointer;touch-action:manipulation}
#kanjiDefenseScreen .kd-lane strong{font-size:clamp(17px,2.5vw,22px);line-height:1.2}
#kanjiDefenseScreen .kd-lane small{font-size:12px;line-height:1.2}
#kanjiDefenseScreen .kd-lane[data-target=true]{background:#fff1bb;border-color:#ffb627;color:#523300}
#kanjiDefenseScreen .kd-lane[data-near=true]:not([data-target=true]){border-color:#ffd166}
#kanjiDefenseScreen .kd-lane:disabled{opacity:.45;cursor:default}
#kanjiDefenseScreen .kd-form{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}
#kanjiDefenseScreen .kd-form input{min-width:0;height:60px;border:0;border-radius:14px;padding:0 14px;background:#fff;color:#16242c;font:inherit;font-size:clamp(24px,3.6vw,30px);font-weight:800;box-shadow:inset 0 -4px 0 #0002;-webkit-user-select:text;user-select:text}
#kanjiDefenseScreen .kd-form input.ya-miss{animation:ya-nudge .35s ease-out}
#kanjiDefenseScreen .kd-form input::placeholder{font-size:.62em;font-weight:700;color:#8aa0ad}
#kanjiDefenseScreen .kd-form button{height:60px;border:0;border-radius:14px;padding:0 18px;background:#ffb627;color:#3a2400;font:inherit;font-size:20px;font-weight:900;box-shadow:0 4px 0 #b57500;cursor:pointer}
#kanjiDefenseScreen .kd-form button:disabled,#kanjiDefenseScreen .kd-form input:disabled{opacity:.55}
#kanjiDefenseScreen .kd-words{display:grid;grid-template-columns:1fr 1fr;gap:8px;text-align:left}
#kanjiDefenseScreen .kd-words section{background:#edf4f8;border-radius:10px;padding:8px}
#kanjiDefenseScreen .kd-words h4{margin:0 0 4px;font-size:15px}#kanjiDefenseScreen .kd-words p{margin:0;line-height:1.6}
@keyframes kd-walk{from{transform:translateY(0) rotate(-3deg)}to{transform:translateY(-4px) rotate(3deg)}}
@keyframes kd-pulse{from{box-shadow:0 4px 0 #5c4330}to{box-shadow:0 4px 0 #5c4330,0 0 0 5px #ffd16699}}
@keyframes iv-cast{0%{transform:none}40%{transform:translateY(-10px) scale(1.08)}100%{transform:none}}
@media (max-height:560px){#kanjiDefenseScreen .kd-form input,#kanjiDefenseScreen .kd-form button{height:48px}#kanjiDefenseScreen .kd-sign{font-size:22px}}
`;

const LANE_X = [20, 50, 80];
const LANE_NAMES = ['左', '中', '右'];
const HERO = { x: 50, y: 90 };
// Monsters enter on the road, below the HUD, so the kanji sign is readable from the start.
const START_Y = 26;
const laneY = progress => START_Y + progress * (100 - START_Y);

export function createKanjiDefenseView({ document: doc, dispatch, onBack, getSnapshot }) {
  let active = true, composing = false, lastAttemptSerial = 0, lastResolutionSerial = 0, lastBoosts = 0, moodMs = 0, hint = null;
  const removes = [];
  const on = (target, type, handler) => { target.addEventListener(type, handler); removes.push(() => target.removeEventListener(type, handler)); };
  const frame = createArcadeFrame(doc, { id: 'kanjiDefenseScreen', title: '漢字防衛隊', theme: 'meadow' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });
  world.append(el('div', 'kd-forest'));
  LANE_X.forEach((x, lane) => { const path = el('div', 'kd-path'); path.dataset.lane = String(lane); path.style.left = `${x}%`; world.append(path); });
  const guard = el('div', 'kd-guard'); const lights = [0, 1, 2].map(() => { const node = el('i'); guard.append(node); return node; });
  const hero = el('div', 'kd-hero');
  world.append(el('div', 'kd-gate'), guard, hero);

  const target = el('p', 'kd-target');
  const lanes = el('div', 'kd-lanes'); lanes.setAttribute('aria-label', 'ねらう道');
  const laneButtons = LANE_NAMES.map((name, lane) => {
    const node = el('button', 'kd-lane'); node.type = 'button'; node.dataset.aimLane = String(lane);
    const label = el('strong', '', `${name} まち`), status = el('small', '', 'ここに出るよ');
    node.append(label, status); on(node, 'click', () => selectLane(lane)); lanes.append(node);
    return { node, label, status };
  });
  const form = el('div', 'kd-form');
  const input = el('input'); input.type = 'text'; input.inputMode = 'text'; input.autocomplete = 'off'; input.maxLength = 16;
  input.setAttribute('autocapitalize', 'off'); input.setAttribute('spellcheck', 'false');
  input.setAttribute('aria-label', '漢字の読み（ひらがな）'); input.setAttribute('enterkeyhint', 'done'); input.placeholder = 'よみを ひらがなで';
  const submit = el('button', '', 'こうげき'); submit.type = 'button'; submit.dataset.action = 'answer';
  form.append(input, submit);
  const note = el('p', 'ya-dock-note', '同じ読みのモンスターに、自動で命中するよ');
  dock.append(target, lanes, form, note);
  const review = el('div', 'ya-learning-result'); review.hidden = true;
  const words = el('div', 'kd-words');
  const strongBox = el('section'), weakBox = el('section');
  const strongWords = el('p'), weakWords = el('p');
  strongBox.append(el('h4', '', 'よめたことば'), strongWords); weakBox.append(el('h4', '', 'もう一度見たいことば'), weakWords);
  words.append(strongBox, weakBox); review.append(words); frame.shell.append(review);
  doc.body.append(root);

  const send = () => {
    const state = getSnapshot();
    if (!active || composing || state.paused || state.phase !== 'playing') return false;
    if (!input.value.trim()) { restartClass(input, 'ya-miss'); return false; }
    const accepted = dispatch({ type: 'submit', payload: { sessionId: state.sessionId, token: state.inputToken, value: input.value } });
    if (accepted) input.value = '';
    return accepted;
  };
  const selectEnemy = enemyId => {
    const state = getSnapshot(), enemy = state.enemies.find(item => item.enemyId === enemyId);
    if (!active || state.paused || state.phase !== 'playing' || !enemy) return false;
    const selected = dispatch({ type: 'select', payload: { sessionId: state.sessionId, enemyId: enemy.enemyId, problemId: enemy.problemId } });
    input.focus?.({ preventScroll: true });
    return selected;
  };
  const selectLane = lane => {
    const enemy = getSnapshot().enemies.find(item => item.lane === lane);
    return enemy ? selectEnemy(enemy.enemyId) : false;
  };
  on(input, 'compositionstart', () => { composing = true; });
  on(input, 'compositionend', () => { composing = false; });
  on(input, 'keydown', event => {
    if (event.key !== 'Enter' || event.repeat || event.isComposing || composing || event.keyCode === 229) return;
    event.preventDefault?.(); send();
  });
  on(submit, 'click', send);

  const enemyNodes = new Map();
  const syncEnemies = state => {
    const live = new Set(state.enemies.map(enemy => enemy.enemyId));
    for (const [id, entry] of enemyNodes) if (!live.has(id)) { entry.node.remove(); enemyNodes.delete(id); }
    for (const enemy of state.enemies) {
      let entry = enemyNodes.get(enemy.enemyId);
      if (!entry) {
        const node = el('button', 'kd-monster'); node.type = 'button'; node.dataset.enemyId = enemy.enemyId;
        const sign = el('span', 'kd-sign', enemy.prompt), body = el('span', 'kd-body');
        const image = el('img'); image.src = enemy.imageUrl; image.alt = ''; image.setAttribute('aria-hidden', 'true');
        const fallback = el('span', 'kd-fallback', '👾'); fallback.hidden = true;
        on(image, 'error', () => { image.hidden = true; fallback.hidden = false; });
        body.append(image, fallback); node.append(sign, body);
        node.style.left = `${LANE_X[enemy.lane]}%`;
        on(node, 'click', () => selectEnemy(enemy.enemyId));
        world.append(node); entry = { node }; enemyNodes.set(enemy.enemyId, entry);
      }
      entry.node.style.top = `${laneY(enemy.progress)}%`;
      setVar(entry.node, '--scale', String(.78 + enemy.progress * .35));
      entry.node.style.zIndex = String(3 + Math.round(enemy.progress * 10));
      entry.node.dataset.target = String(state.targetId === enemy.enemyId);
      entry.node.dataset.danger = String(enemy.progress >= .7);
      entry.node.disabled = state.paused || state.phase !== 'playing';
      entry.node.setAttribute('aria-label', `${enemy.lane + 1}番、${enemy.monsterName}、${enemy.prompt}、${enemy.threat}`);
    }
  };
  const syncLanes = state => {
    laneButtons.forEach(({ node, label, status }, lane) => {
      const enemy = state.enemies.find(item => item.lane === lane);
      const labelText = enemy ? `${LANE_NAMES[lane]} ${enemy.prompt}` : `${LANE_NAMES[lane]} まち`;
      const statusText = !enemy ? 'ここに出るよ' : enemy.progress >= .7 ? '門の近く' : enemy.progress >= .48 ? '近づいている' : 'むかっている';
      if (label.textContent !== labelText) label.textContent = labelText;
      if (status.textContent !== statusText) status.textContent = statusText;
      node.dataset.target = String(!!enemy && state.targetId === enemy.enemyId);
      node.dataset.near = String(!!enemy && enemy.progress >= .7);
      node.disabled = !enemy || state.paused || state.phase !== 'playing';
      node.setAttribute('aria-label', `${labelText}、${statusText}${enemy && state.targetId === enemy.enemyId ? '、ねらい中' : ''}`);
    });
  };
  const showHint = (enemyId, text) => {
    hint?.remove(); hint = null;
    const entry = enemyNodes.get(enemyId);
    if (!entry || !text) return;
    hint = el('span', 'kd-hint', `ヒント：${text}`); entry.node.append(hint);
  };
  const reactToEvents = state => {
    const attempt = state.lastAttempt;
    if (attempt && attempt.serial !== lastAttemptSerial) {
      lastAttemptSerial = attempt.serial;
      if (!attempt.correct && attempt.retryAvailable) {
        const entry = enemyNodes.get(attempt.enemyId);
        if (entry) { entry.node.dataset.hit = 'false'; void entry.node.offsetWidth; entry.node.dataset.hit = 'true'; }
        showHint(attempt.enemyId, attempt.hint);
        restartClass(input, 'ya-miss');
        note.textContent = `おしい！「${attempt.prompt}」のヒント：${attempt.hint}`;
        frame.announce(`おしい。ヒント ${attempt.hint}`);
      }
    }
    const resolution = state.lastResolution;
    if (resolution && resolution.serial !== lastResolutionSerial) {
      lastResolutionSerial = resolution.serial;
      const x = LANE_X[resolution.lane], y = laneY(resolution.progress);
      if (resolution.outcome === 'correct') {
        fx.beam(HERO.x, HERO.y, x, y - 6, 'good'); fx.burst(x, y - 6, 'good', 1.3);
        fx.pop(x, y - 16, `${resolution.prompt}＝${resolution.reading}`, 'good');
        hero.dataset.mood = 'cast'; moodMs = 300;
        note.textContent = state.combo >= 3 ? `${state.combo}連続撃退！` : `撃退！「${resolution.prompt}」は「${resolution.reading}」`;
        frame.announce(`撃退。${resolution.prompt}、${resolution.reading}`);
      } else if (resolution.outcome === 'attemptsExhausted') {
        fx.pop(x, y - 16, `よみは「${resolution.reading}」`, 'info');
        note.textContent = `「${resolution.prompt}」は「${resolution.reading}」と読むよ。覚えておこう！`;
        frame.announce(`${resolution.prompt} は ${resolution.reading} と読みます`);
      } else {
        fx.pop(x, 80, `${resolution.prompt}＝${resolution.reading}`, 'info'); fx.flash('soft');
        note.textContent = `門が守ったよ。「${resolution.prompt}」は「${resolution.reading}」`;
        frame.announce(`門が守りました。${resolution.prompt} は ${resolution.reading}`);
      }
      hint?.remove(); hint = null;
    }
  };

  return {
    root,
    attachCompanion(portrait) { hero.append(portrait); },
    focusPlay() { input.focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      syncEnemies(state);
      syncLanes(state);
      reactToEvents(state);
      lights.forEach((node, index) => toggleClass(node, 'off', index >= state.life));
      const aimed = state.targetEnemy;
      target.textContent = '';
      if (aimed) target.append(el('span', '', 'ねらい'), el('strong', '', aimed.prompt));
      else target.append(el('span', '', state.result ? 'おつかれさま！' : 'モンスターを待っているよ'));
      const canAnswer = state.phase === 'playing' && !state.paused;
      input.disabled = !canAnswer; submit.disabled = !canAnswer;
      if (state.result && review.hidden) {
        review.hidden = false;
        strongWords.textContent = state.result.strongWords.join('・') || '次の挑戦で見つけよう';
        weakWords.textContent = state.result.wordsPracticed.filter(item => item.outcome !== 'correct' || item.wrongAttempts > 0)
          .map(item => `${item.prompt}（${item.reading}）`).join('・') || 'なし';
      }
    },
    present(play, dt, state) {
      if (!active) return;
      frame.tick(dt);
      moodMs = Math.max(0, moodMs - dt); if (!moodMs) hero.dataset.mood = '';
      const w = play.world || {};
      hero.dataset.fever = String(!!w.fever);
      if (play.boosts !== lastBoosts) { if (play.boosts > lastBoosts) { fx.banner('あいぼうエール！', 'great'); fx.flash('great'); } lastBoosts = play.boosts; }
      const total = state?.rules?.totalEncounters ?? 12, resolved = state?.resolved ?? 0;
      const mission = w.challenge;
      frame.hud.set({ points: (state?.score ?? play.learningPoints) + play.bonus, comboCount: play.combo,
        progressValue: resolved / total, progressLabel: `撃退 ${state?.correct ?? 0} · のこり ${total - resolved}`,
        life: state?.life ?? 3, maxLife: 3, lifeLabel: '門', gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; composing = false; input.disabled = true; submit.disabled = true; laneButtons.forEach(({ node }) => { node.disabled = true; }); },
    dispose() {
      this.stopInput(); removes.splice(0).forEach(remove => remove());
      enemyNodes.clear(); frame.dispose();
    },
  };
}
