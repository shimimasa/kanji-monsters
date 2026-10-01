import { createArcadeFrame, restartClass, bindArcadeKeys } from '../arcade/arcadeKit.js';
import { castAt } from '../gotomonCast.js';
import Speech from '../../audio/speech.js';
import { LAND_RULES as R } from './landGame.js';

// The stage is a strip measured in tiles: one tile is 1em, the view is R.rows tiles high.
// A thing at (x, y) stands with its feet at bottom = y em, its middle at left = x em.
const CSS = `
#gotomonLandScreen .ya-field{background:linear-gradient(#7ec8f2,#cdeeff 70%,#e9f8ff)}
#gotomonLandScreen .ld-wrap{position:absolute;left:0;right:0;top:58px;bottom:6px;container-type:size;overflow:hidden;border-radius:14px}
#gotomonLandScreen .ld-sky{position:absolute;inset:0;background:radial-gradient(ellipse at 20% 30%,#fff 0 6%,transparent 7%) 0 0/60% 70%,radial-gradient(ellipse at 70% 20%,#ffffffd0 0 5%,transparent 6%) 0 0/45% 60%;background-position:var(--sky,0) 0}
#gotomonLandScreen .ld-strip{position:absolute;left:0;bottom:0;height:100%;font-size:calc(100cqh / ${R.rows});will-change:transform}
#gotomonLandScreen .ld-t{position:absolute;width:1em;height:1em;box-sizing:border-box}
#gotomonLandScreen .ld-t[data-kind=ground]{background:#a0693a;box-shadow:inset 0 0 0 1px #8d5a2b}
#gotomonLandScreen .ld-t[data-kind=grass]{background:linear-gradient(#6cc04a 0 28%,#a0693a 28%);box-shadow:inset 0 0 0 1px #8d5a2b}
#gotomonLandScreen .ld-t[data-kind=bridge]{height:.35em;bottom:auto;background:repeating-linear-gradient(90deg,#d7a86e 0 .22em,#b07a45 .22em .26em);border-radius:3px;box-shadow:0 .08em 0 #7b4f2c}
#gotomonLandScreen .ld-t[data-kind=block]{background:radial-gradient(circle,#fff6 0 20%,transparent 21%),#ffb703;border-radius:.12em;box-shadow:inset 0 0 0 .07em #fb8500,0 .06em 0 #b35c00;display:grid;place-items:center;color:#fff;font-weight:900;font-size:1em;line-height:1}
#gotomonLandScreen .ld-t[data-kind=block]::after{content:'？';font-size:.7em;text-shadow:0 .04em 0 #b35c00}
#gotomonLandScreen .ld-t[data-kind=used]{background:#b07a45;border-radius:.12em;box-shadow:inset 0 0 0 .07em #7b4f2c}
#gotomonLandScreen .ld-thing{position:absolute;transform:translateX(-50%);pointer-events:none}
#gotomonLandScreen .ld-door{width:1.1em;height:1.7em;border-radius:.55em .55em 0 0;background:linear-gradient(#c77d3a,#8d5a2b);box-shadow:inset 0 0 0 .07em #5e3a19;z-index:2}
#gotomonLandScreen .ld-door::after{content:'';position:absolute;right:.16em;top:52%;width:.13em;height:.13em;border-radius:50%;background:#ffd166}
#gotomonLandScreen .ld-door img{position:absolute;left:100%;bottom:0;width:.9em;height:.9em;object-fit:contain;filter:drop-shadow(0 .05em .04em #0005)}
#gotomonLandScreen .ld-plate{position:absolute;left:50%;bottom:105%;transform:translateX(-50%);padding:.04em .16em;border-radius:.14em;background:#fff;color:#1b2a36;border:.06em solid #ff7a59;font-size:.42em;font-weight:900;line-height:1.1;white-space:nowrap}
#gotomonLandScreen .ld-plate[data-size=s]{font-size:.34em}
#gotomonLandScreen .ld-door[data-raise=true] .ld-plate{bottom:calc(105% + 1.5em)}
#gotomonLandScreen .ld-door[data-here=true] .ld-plate{border-color:#ffd166;box-shadow:0 0 0 .08em #ffd166}
#gotomonLandScreen .ld-door[data-hint=true]{box-shadow:inset 0 0 0 .07em #5e3a19,0 0 0 .1em #37c871,0 0 .4em #37c871;animation:ld-glow .7s ease-in-out infinite alternate}
#gotomonLandScreen .ld-door[data-hint=true] .ld-plate{border-color:#37c871}
#gotomonLandScreen .ld-door[data-gone=true]{filter:grayscale(1);opacity:.45}
#gotomonLandScreen .ld-flag{width:.12em;height:2.2em;background:#eee;z-index:1}
#gotomonLandScreen .ld-flag::after{content:'';position:absolute;left:.12em;top:0;width:.7em;height:.5em;background:#bbb;clip-path:polygon(0 0,100% 50%,0 100%)}
#gotomonLandScreen .ld-flag[data-reached=true]::after{background:#ff595e}
#gotomonLandScreen .ld-bush{width:1.3em;height:.8em;border-radius:.6em .6em 0 0;background:radial-gradient(circle at 30% 60%,#4caf50 0 35%,transparent 36%),radial-gradient(circle at 70% 55%,#43a047 0 38%,transparent 39%),radial-gradient(circle at 50% 35%,#66bb6a 0 34%,transparent 35%);z-index:3}
#gotomonLandScreen .ld-platform{width:${R.platformW}em;height:.32em;transform:none;border-radius:.16em;background:repeating-linear-gradient(90deg,#90caf9 0 .3em,#64b5f6 .3em .6em);box-shadow:0 .07em 0 #1e88e5;z-index:2}
#gotomonLandScreen .ld-acorn{font-size:.75em;line-height:1;z-index:3;animation:ld-roll .6s linear infinite}
#gotomonLandScreen .ld-star{font-size:.62em;line-height:1;z-index:2;animation:ld-bob .9s ease-in-out infinite alternate}
#gotomonLandScreen .ld-player{width:1.1em;height:1.1em;z-index:5}
#gotomonLandScreen .ld-player>*{width:100%!important;height:100%!important;object-fit:contain;filter:drop-shadow(0 .06em .05em #0005)}
#gotomonLandScreen .ld-player[data-face="-1"]>*{transform:scaleX(-1)}
#gotomonLandScreen .ld-player[data-safe=true]{animation:ld-blink .2s steps(2) infinite}
#gotomonLandScreen .ld-player.ld-squash>*{animation:ld-squash .2s ease-out}
#gotomonLandScreen .ld-player.ld-warp{transition:opacity .6s,transform .6s;opacity:0;transform:translateX(-50%) scale(.5)}
#gotomonLandScreen .ld-token{border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff,#ffcf5a)}
#gotomonLandScreen .ld-pop{font-size:.8em;line-height:1;z-index:6;animation:ld-up .8s ease-out forwards}
#gotomonLandScreen .ld-pop img{width:1.2em;height:1.2em;object-fit:contain}
#gotomonLandScreen .ld-title{margin:0;text-align:center;font-size:14px;font-weight:900;color:#bfe3ff}
#gotomonLandScreen .ld-prompt{margin:0;padding:8px 12px;border-radius:14px;background:#ffffff14;color:#fff;text-align:center;font-size:clamp(20px,2.8vw,28px);font-weight:900;line-height:1.3}
#gotomonLandScreen .ld-prompt small{display:block;margin-top:4px;font-size:15px;font-weight:700;color:#d4e8ff}
#gotomonLandScreen .ld-prompt small b{color:#ffe066}
#gotomonLandScreen .ld-pad{display:grid;grid-template-columns:1fr 1fr 1.3fr;grid-template-rows:auto auto;gap:8px}
#gotomonLandScreen .ld-btn{min-height:clamp(54px,8vh,72px);border:0;border-radius:14px;background:#ffffff26;color:#fff;font:inherit;font-size:24px;font-weight:900;cursor:pointer;touch-action:none;user-select:none}
#gotomonLandScreen .ld-btn[data-held=true]{background:#ffe06655}
#gotomonLandScreen .ld-btn[data-act=jump]{grid-row:span 2;background:#ff7a5955;font-size:20px}
#gotomonLandScreen .ld-btn[data-act=enter]{grid-column:span 2;font-size:18px}
#gotomonLandScreen .ld-btn[data-act=enter]:disabled{opacity:.35;cursor:default}
#gotomonLandScreen .ld-btn[data-act=enter]:not(:disabled){background:#37c87188;box-shadow:0 0 0 3px #37c871;animation:ld-glow .7s ease-in-out infinite alternate}
#gotomonLandScreen .ld-help{margin:0;text-align:center;font-size:13px;color:#d4e8ff}
@keyframes ld-bob{from{translate:0 0}to{translate:0 -.12em}}
@keyframes ld-glow{from{filter:brightness(1)}to{filter:brightness(1.15)}}
@keyframes ld-roll{to{rotate:-360deg}}
@keyframes ld-blink{50%{opacity:.35}}
@keyframes ld-squash{0%{scale:1.2 .8}100%{scale:1}}
@keyframes ld-up{from{translate:0 0;opacity:1}to{translate:0 -1.2em;opacity:0}}
`;

export function createLandView({ document: doc, dispatch, onBack, getSnapshot, cast }) {
  let active = true, lastEventId = 0, doneShown = false, problemKey = null, stageKey = null, tilesKey = null;
  let shownDoor = 0, shownFall = 0, shownPickup = 0, shownBump = 0, shownHelp = 0, shownBlocked = 0, wasGrounded = true, held = null;
  const removes = [], things = new Map(), stageNodes = [], tileNodes = [], doorNodes = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'gotomonLandScreen', title: 'ゴトモン・ぼうけんランド', theme: 'land' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });

  const wrap = el('div', 'ld-wrap'), sky = el('div', 'ld-sky'), strip = el('div', 'ld-strip');
  wrap.setAttribute('aria-label', 'ぼうけんランドのステージ');
  const player = el('div', 'ld-thing ld-player'), token = el('div', 'ld-token'); player.append(token);
  strip.append(player);
  wrap.append(sky, strip); world.append(wrap);

  const title = el('p', 'ld-title');
  const prompt = el('p', 'ld-prompt'); prompt.dataset.role = 'problem';
  const pad = el('div', 'ld-pad');
  const button = (act, text, label) => { const b = el('button', 'ld-btn', text); b.type = 'button'; b.dataset.act = act; b.setAttribute('aria-label', label); pad.append(b); return b; };
  const leftBtn = button('left', '◀', 'ひだりへ はしる'), rightBtn = button('right', '▶', 'みぎへ はしる'), jumpBtn = button('jump', 'ジャンプ', 'ジャンプ');
  const enterBtn = button('enter', '▲ とびらに はいる', 'とびらに はいる'); enterBtn.disabled = true;
  const help = el('p', 'ld-help');
  const note = el('p', 'ya-dock-note'); note.dataset.role = 'feedback';
  dock.append(title, prompt, pad, help, note);
  doc.body.append(root);

  const send = (type, payload = {}) => {
    const state = getSnapshot();
    if (!active || state.paused) return false;
    return dispatch({ type, payload: { sessionId: state.sessionId, attemptId: state.attemptId, ...payload } });
  };
  const steer = dir => send('move', { dir });
  // ◀ ▶ run while held; ジャンプ and はいる are presses.
  for (const [b, dir] of [[leftBtn, -1], [rightBtn, 1]]) {
    on(b, 'pointerdown', event => { event.preventDefault?.(); held = b; b.dataset.held = 'true'; steer(dir); });
  }
  const release = () => { if (held) { held.dataset.held = 'false'; held = null; steer(0); } };
  on(doc, 'pointerup', release); on(doc, 'pointercancel', release);
  on(jumpBtn, 'pointerdown', event => { event.preventDefault?.(); send('jump'); });
  on(enterBtn, 'click', () => send('enter'));
  let keyDir = 0;
  removes.push(bindArcadeKeys(doc, event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      if (!event.repeat) { keyDir = event.key === 'ArrowLeft' ? -1 : 1; steer(keyDir); }
      return true;
    }
    if (event.key === ' ') { if (!event.repeat) send('jump'); return true; }
    if (event.key === 'ArrowUp') { if (!event.repeat) send(getSnapshot().canEnter ? 'enter' : 'jump'); return true; }
    return false;
  }));
  const keyUp = event => { if ((event.key === 'ArrowLeft' && keyDir === -1) || (event.key === 'ArrowRight' && keyDir === 1)) { keyDir = 0; steer(0); } };
  doc.addEventListener('keyup', keyUp); removes.push(() => doc.removeEventListener('keyup', keyUp));

  const put = (node, x, y) => { node.style.left = `${x}em`; node.style.bottom = `${y}em`; };
  const renderPrompt = state => {
    const key = state.problem?.problemId ?? null;
    if (key === problemKey) return;
    const base = id => id?.split(':').slice(0, -1).join(':');
    const sameQuestion = problemKey && key && base(problemKey) === base(key);
    problemKey = key;
    if (!state.problem) { prompt.textContent = state.phase === 'completed' ? 'ぜんぶの ステージ クリア！' : ''; return; }
    prompt.textContent = state.problem.prompt;
    if (state.problem.sentence) { const small = el('small'); small.append(el('span', '', state.problem.sentence.before), el('b', '', state.problem.prompt.match(/「(.+?)」/)?.[1] ?? ''), el('span', '', state.problem.sentence.after)); prompt.append(small); }
    const word = state.problem.kind === 'en2ja' ? state.problem.prompt.split(' ')[0] : null;
    if (word && !sameQuestion) Speech.speakEnglish(word);
  };
  // A new stage: doors with plates and Gotomon, the checkpoint flag, the acorn bushes.
  const buildStage = state => {
    stageNodes.splice(0).forEach(node => node.remove?.()); doorNodes.length = 0;
    for (const door of state.doors) {
      const node = el('div', 'ld-thing ld-door'); node.dataset.plate = door.plateId;
      put(node, door.col + 0.5, R.base);
      const who = castAt(cast?.wild, door.cast);
      if (who) { const img = el('img'); img.alt = ''; img.src = who.imageUrl; node.append(img); }
      // Long plates (English words) get smaller letters, and then every other plate stands higher, so neighbours never touch.
      const plate = el('span', 'ld-plate', door.text);
      plate.dataset.size = door.text.length >= 5 ? 's' : 'm';
      node.append(plate);
      strip.append(node); stageNodes.push(node); doorNodes.push(node);
    }
    const long = state.doors.some(door => door.text.length >= 5);
    doorNodes.forEach((node, i) => { node.dataset.raise = String(long && i % 2 === 1); });
    const flag = el('div', 'ld-thing ld-flag'); put(flag, state.stage.checkpoint + 0.5, R.base); flag.dataset.role = 'checkpoint';
    strip.append(flag); stageNodes.push(flag);
    for (const s of state.stage.spawners) for (const c of [s.from, s.to]) { const bush = el('div', 'ld-thing ld-bush'); put(bush, c, R.base); strip.append(bush); stageNodes.push(bush); }
    player.classList?.remove('ld-warp');
  };
  const buildTiles = state => {
    tileNodes.splice(0).forEach(node => node.remove?.());
    for (const t of state.stage.tiles) {
      const node = el('div', 'ld-t'); node.dataset.kind = t.kind;
      node.style.left = `${t.c}em`; node.style.bottom = `${t.kind === 'bridge' ? t.r + 0.65 : t.r}em`;
      strip.insertBefore?.(node, strip.firstChild) ?? strip.append(node); tileNodes.push(node);
    }
  };
  const sync = (seen, key, make, x, y) => {
    let node = things.get(key);
    if (!node) { node = make(); strip.append(node); things.set(key, node); }
    put(node, x, y); seen.add(key);
  };
  const render = state => {
    const st = state.stage;
    if (`${st.index}` !== stageKey) { stageKey = `${st.index}`; buildStage(state); tilesKey = null; }
    if (`${st.index}:${st.tilesVersion}` !== tilesKey) { tilesKey = `${st.index}:${st.tilesVersion}`; buildTiles(state); }
    const seen = new Set();
    for (const p of state.platforms) sync(seen, `p${st.index}${p.platformId}`, () => el('div', 'ld-thing ld-platform'), p.x, p.y - 0.32);
    for (const a of state.acorns) sync(seen, a.acornId, () => el('div', 'ld-thing ld-acorn', '🌰'), a.x, a.y);
    for (const s of state.stars) sync(seen, s.starId, () => el('div', 'ld-thing ld-star', '⭐'), s.x, s.y - 0.3);
    for (const [id, node] of things) if (!seen.has(id)) { node.remove?.(); things.delete(id); }
    state.doors.forEach((door, i) => {
      const node = doorNodes[i]; if (!node) return;
      const set = (k, v) => { if (node.dataset[k] !== v) node.dataset[k] = v; };
      set('hint', String(door.plateId === state.hintPlateId)); set('gone', String(door.gone)); set('here', String(state.doorHere === door.doorId));
    });
    const flag = stageNodes.find(n => n.dataset?.role === 'checkpoint');
    if (flag) flag.dataset.reached = String(st.reachedCheckpoint);
    const p = state.player;
    put(player, p.x, p.y);
    player.dataset.face = String(p.face); player.dataset.safe = String(p.safe);
    if (p.grounded && !wasGrounded) restartClass(player, 'ld-squash');
    wasGrounded = p.grounded;
    // The camera keeps the companion a little left of the middle.
    const box = wrap.getBoundingClientRect?.(), tile = box?.height ? box.height / R.rows : 0;
    const view = tile ? box.width / tile : 14;
    const cam = Math.max(0, Math.min(Math.max(0, st.width - view), p.x - view * 0.4));
    strip.style.transform = `translateX(${-cam}em)`;
    sky.style.setProperty?.('--sky', `${-cam * (tile || 40) * 0.3}px`);
    enterBtn.disabled = !state.canEnter || state.phase !== 'running';
    const helpText = state.canEnter ? '「▲ とびらに はいる」で このとびらに 入るよ'
      : p.x >= st.hall ? '答えの とびらの 前に 立って「▲ とびらに はいる」'
        : '◀ ▶ で はしって、ジャンプで あなや どんぐりを こえよう';
    if (help.textContent !== helpText) help.textContent = helpText;
  };
  const say = text => { note.textContent = text; frame.announce(text); };
  const popAt = (x, y, content) => { const node = el('div', 'ld-thing ld-pop'); if (typeof content === 'string') node.textContent = content; else node.append(content); put(node, x, y); strip.append(node); setTimeout(() => node.remove?.(), 900); };

  return {
    root,
    // The companion does the running and jumping.
    attachCompanion(portrait) { token.remove?.(); player.append(portrait); },
    focusPlay() { jumpBtn.focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      if (!state.stage) return;
      renderPrompt(state); render(state);
      if (state.lastDoor && state.lastDoor.door !== shownDoor) {
        shownDoor = state.lastDoor.door;
        const d = state.lastDoor;
        if (d.correct) {
          player.classList?.add('ld-warp'); fx.burst(50, 45, d.first ? 'great' : 'good', d.first ? 1.4 : 1.1); fx.pop(50, 38, 'とびらの むこうへ！', 'great');
          say(`せいかい！ ${d.explain}`);
        } else { fx.pop(50, 40, 'あれれ？', 'soft'); say(`そのとびらは「${d.text}」${d.note ? `（${d.note}）` : ''}。答えは「${d.answer}」。光る とびらへ 行こう`); }
      }
      if (state.lastFall && state.lastFall.fall !== shownFall) { shownFall = state.lastFall.fall; fx.pop(50, 60, 'おっと！', 'soft'); say(`おっと！ ${state.stage.reachedCheckpoint ? '旗' : 'スタート'}から もう一度 いこう`); }
      if (state.lastHelp && state.lastHelp.help !== shownHelp) { shownHelp = state.lastHelp.help; fx.banner('ゴトモンが 橋を かけたよ！', 'great'); say('ゴトモンたちが あなに 橋を かけてくれた！'); }
      if (state.lastBump && state.lastBump.bump !== shownBump) { shownBump = state.lastBump.bump; say('どんぐりに ぶつかった！ 上から ふむと ほしに なるよ'); }
      if (state.lastBlocked && state.lastBlocked.blocked !== shownBlocked) { shownBlocked = state.lastBlocked.blocked; say(state.lastBlocked.gone ? 'そのとびらは しまっているよ。光る とびらへ 行こう' : 'とびらの 前で おしてね'); }
      if (state.lastPickup && state.lastPickup.pickup !== shownPickup) {
        shownPickup = state.lastPickup.pickup;
        const k = state.lastPickup;
        if (k.kind === 'friend') {
          const who = castAt(cast?.wild, 40 + k.cast);
          if (who) { const img = el('img'); img.alt = who.name; img.src = who.imageUrl; popAt(k.x, k.y, img); } else popAt(k.x, k.y, '★');
          fx.pop(50, 40, 'なかまに なった！', 'great'); say(`？ブロックから ${who ? who.name : 'ゴトモン'}が 出てきて なかまに なった！`);
        } else popAt(k.x, k.y, k.kind === 'stomp' ? '⭐ ぽよん！' : '⭐');
      }
      const titleText = state.phase === 'completed' ? '' : `ステージ ${state.problemIndex + 1}/${state.total}　⭐${state.starsTaken}`;
      if (title.textContent !== titleText) title.textContent = titleText;
      if (state.result && !doneShown) {
        doneShown = true;
        fx.banner('ぜんぶ クリア！', 'great'); fx.burst(50, 40, 'great', 2);
        note.textContent = `12ステージ クリア！ ⭐${state.result.stars}${state.result.friends ? `・なかま ${state.result.friends}ひき` : ''}`;
      }
    },
    present(play, dt, state) {
      if (!active || !state) return;
      frame.tick(dt);
      const w = play.world || {};
      const event = w.lastEvent;
      if (event && event.id !== lastEventId) {
        lastEventId = event.id;
        if (event.type === 'boost') { fx.banner('ぼうけんフィーバー！', 'great'); fx.flash('great'); }
      }
      const mission = w.challenge, done = state.result ? state.total : state.problemIndex ?? 0;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: Math.min(1, done / (state.total || 1)), progressLabel: state.result ? 'クリア！' : `ステージ ${Math.min(done, state.total ?? 0)}/${state.total ?? 0}`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; held = null; [leftBtn, rightBtn, jumpBtn, enterBtn].forEach(b => { b.disabled = true; }); },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
