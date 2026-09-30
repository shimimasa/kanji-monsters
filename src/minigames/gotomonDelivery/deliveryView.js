import { createArcadeFrame, restartClass } from '../arcade/arcadeKit.js';
import { PREFECTURES, MAP_COLUMNS, MAP_ROWS, prefectureByName, regionName } from './prefectures.js';

const CSS = `
#gotomonDeliveryScreen .ya-field{background:radial-gradient(circle at 80% 10%,#fff6c8 0 8%,transparent 9%),linear-gradient(#9fd8f5,#6fb9e3)}
#gotomonDeliveryScreen .gd-map{position:absolute;left:50%;top:62px;bottom:2%;z-index:2;display:grid;grid-template-columns:repeat(${MAP_COLUMNS},1fr);grid-template-rows:repeat(${MAP_ROWS},1fr);gap:2px;aspect-ratio:${MAP_COLUMNS}/${MAP_ROWS};max-width:96%;transform:translateX(-50%)}
#gotomonDeliveryScreen .gd-tile{position:relative;display:grid;place-items:center;min-width:0;min-height:0;padding:0;border:0;border-radius:4px;background:var(--land);color:#1b2a36;font:inherit;font-size:clamp(9px,1.1vw,13px);font-weight:900;line-height:1;box-shadow:0 2px 0 #0002;cursor:default;touch-action:manipulation;opacity:.72}
#gotomonDeliveryScreen .gd-tile[data-region=hokkaido-tohoku]{--land:#b8e0a8}
#gotomonDeliveryScreen .gd-tile[data-region=kanto]{--land:#f4d58d}
#gotomonDeliveryScreen .gd-tile[data-region=chubu]{--land:#a9dcd2}
#gotomonDeliveryScreen .gd-tile[data-region=kinki]{--land:#f6c1a6}
#gotomonDeliveryScreen .gd-tile[data-region=chugoku-shikoku]{--land:#d8c8ee}
#gotomonDeliveryScreen .gd-tile[data-region=kyushu-okinawa]{--land:#f3b8c6}
#gotomonDeliveryScreen .gd-tile[data-focus=false]{opacity:.35}
#gotomonDeliveryScreen .gd-tile[data-candidate=true]{z-index:2;opacity:1;background:#fffdf6;outline:3px solid #ff9f1c;cursor:pointer;animation:gd-call 1s ease-in-out infinite alternate}
#gotomonDeliveryScreen .gd-tile[data-stamp=true]{opacity:1}
#gotomonDeliveryScreen .gd-tile[data-stamp=true]::after{content:'✓';position:absolute;right:-4px;top:-5px;display:grid;place-items:center;width:clamp(12px,1.5vw,18px);height:clamp(12px,1.5vw,18px);border-radius:50%;background:#e5484d;color:#fff;font-size:clamp(9px,1.1vw,12px);box-shadow:0 1px 2px #0005}
#gotomonDeliveryScreen .gd-tile[data-hint=true]{outline-color:#37c871;box-shadow:0 0 0 5px #37c871aa}
#gotomonDeliveryScreen .gd-tile.gd-landed{animation:gd-landed .5s ease-out}
#gotomonDeliveryScreen .gd-tile.gd-back{animation:gd-back .45s ease-out}
#gotomonDeliveryScreen .gd-plane{position:absolute;z-index:4;width:clamp(40px,6vw,64px);height:clamp(40px,6vw,64px);transform:translate(-50%,-70%);transition:left .5s ease-in-out,top .5s ease-in-out;pointer-events:none}
#gotomonDeliveryScreen .gd-plane[data-idle=true]{animation:gd-cruise 7s ease-in-out infinite}
#gotomonDeliveryScreen .gd-plane::after{content:'📦';position:absolute;right:-8px;bottom:-4px;font-size:clamp(16px,2vw,22px)}
#gotomonDeliveryScreen .gd-plane .gt-portrait{display:block;width:100%;height:100%;background:none;border:0}
#gotomonDeliveryScreen .gd-plane .gt-portrait img{width:100%;height:100%;object-fit:contain}
#gotomonDeliveryScreen .gd-customer{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:8px}
#gotomonDeliveryScreen .gd-customer img{width:clamp(52px,7vw,72px);height:clamp(52px,7vw,72px);object-fit:contain}
#gotomonDeliveryScreen .gd-bubble{margin:0;padding:8px 10px;border-radius:12px;background:#fffdf6;color:#1b2a36;font-size:clamp(14px,1.7vw,17px);font-weight:800;line-height:1.45}
#gotomonDeliveryScreen .gd-bubble small{display:block;margin-top:2px;font-size:12px;color:#5a6a70}
#gotomonDeliveryScreen .gd-title{margin:0;text-align:center;font-size:14px;font-weight:900;color:#cfe9ff}
#gotomonDeliveryScreen .gd-choices{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
#gotomonDeliveryScreen .gd-choice{min-height:52px;border:0;border-radius:12px;background:#fffdf6;color:#1b2a36;font:inherit;font-size:clamp(18px,2.2vw,22px);font-weight:900;box-shadow:0 4px 0 #c9b98f;cursor:pointer;touch-action:manipulation}
#gotomonDeliveryScreen .gd-choice:focus-visible{outline:3px solid #ffd54a;outline-offset:2px}
#gotomonDeliveryScreen .gd-choice[data-hint=true]{background:#d7f7df;box-shadow:0 4px 0 #1f9d55,0 0 0 4px #37c871;animation:gd-glow .8s ease-in-out infinite alternate}
#gotomonDeliveryScreen .gd-review{margin:0;padding:0;list-style:none;display:grid;gap:6px}
#gotomonDeliveryScreen .gd-review li{padding:6px 10px;border-radius:10px;background:#eef6ef;font-weight:700}
#gotomonDeliveryScreen .gd-review li[data-correct=false]{background:#fff3da}
@media (max-width:700px){#gotomonDeliveryScreen .gd-map{top:88px}#gotomonDeliveryScreen .gd-tile{font-size:0;border-radius:2px}#gotomonDeliveryScreen .gd-tile[data-candidate=true]{font-size:9px;outline-width:2px}#gotomonDeliveryScreen .gd-customer img{width:48px;height:48px}}
@keyframes gd-call{from{transform:none}to{transform:translateY(-2px)}}
@keyframes gd-landed{0%,100%{transform:none}40%{transform:scale(1.35)}}
@keyframes gd-back{0%,100%{transform:none}30%{transform:translateX(-4px)}60%{transform:translateX(4px)}}
@keyframes gd-glow{from{transform:none}to{transform:translateY(-3px)}}
@keyframes gd-cruise{0%{left:44%;top:30%}25%{left:62%;top:44%}50%{left:52%;top:62%}75%{left:34%;top:52%}100%{left:44%;top:30%}}
`;

export function createDeliveryView({ document: doc, dispatch, onBack, getSnapshot }) {
  let active = true, lastSeq = -1, lastEventId = 0, deliveryKey = null, doneShown = false, shownTry = 0;
  const removes = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'gotomonDeliveryScreen', title: 'ゴトモン宅配便', theme: 'delivery' });
  const { root, world, dock, fx, el, field } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });

  const map = el('div', 'gd-map'); map.setAttribute('aria-label', '日本地図');
  const tiles = new Map();
  for (const pref of PREFECTURES) {
    const node = el('button', 'gd-tile'); node.type = 'button'; node.disabled = true;
    node.dataset.region = pref.regionId; node.dataset.name = pref.name;
    node.style.gridColumn = `${pref.column + 1} / span ${pref.width}`; node.style.gridRow = `${pref.row + 1} / span ${pref.height}`;
    node.setAttribute('aria-label', pref.fullName);
    on(node, 'click', () => deliver(pref.name)); map.append(node); tiles.set(pref.name, { node });
  }
  const plane = el('div', 'gd-plane'); plane.dataset.idle = 'true'; map.append(plane);
  world.append(map);

  const title = el('p', 'gd-title');
  const customer = el('div', 'gd-customer'); const face = el('img'); face.alt = '';
  const bubble = el('p', 'gd-bubble'); bubble.dataset.role = 'problem';
  customer.append(face, bubble);
  const choicesBox = el('div', 'gd-choices');
  const choices = Array.from({ length: 4 }, () => {
    const node = el('button', 'gd-choice'); node.type = 'button';
    on(node, 'click', () => deliver(node.dataset.name)); choicesBox.append(node); return node;
  });
  // The shell advances after feedback; this stays hidden and only serves hosts without auto-advance.
  const go = el('button', 'gd-go', 'つぎへ'); go.type = 'button'; go.dataset.action = 'next'; go.hidden = true;
  on(go, 'click', () => proceed());
  const note = el('p', 'ya-dock-note'); note.dataset.role = 'feedback';
  dock.append(title, customer, choicesBox, note, go);
  const review = el('div', 'ya-learning-result'); review.hidden = true;
  const reviewList = el('ol', 'gd-review'); review.append(el('h3', '', '今回とどけた ふるさと'), reviewList); frame.shell.append(review);
  doc.body.append(root);
  const answers = [];

  const session = () => getSnapshot();
  function deliver(name) {
    const state = session();
    if (!active || state.paused || state.phase !== 'answering' || !name || !state.delivery?.candidates.includes(name)) return false;
    return dispatch({ type: 'deliver', payload: { sessionId: state.sessionId, attemptId: state.attemptId, prefecture: name } });
  }
  function proceed() {
    const state = session();
    if (!active || state.paused || state.phase !== 'feedback') return false;
    return dispatch({ type: 'next', payload: { sessionId: state.sessionId, problemId: state.problem?.problemId } });
  }
  // Where a tile sits on the map and in the field, in percent.
  const tileCenter = name => {
    const pref = prefectureByName(name);
    return { x: (pref.column + pref.width / 2) / MAP_COLUMNS * 100, y: (pref.row + pref.height / 2) / MAP_ROWS * 100 };
  };
  const fieldPoint = name => {
    const box = field.getBoundingClientRect?.(), tile = tiles.get(name)?.node.getBoundingClientRect?.();
    if (!box?.width || !tile) return { x: 50, y: 50 };
    return { x: (tile.left + tile.width / 2 - box.left) / box.width * 100, y: (tile.top + tile.height / 2 - box.top) / box.height * 100 };
  };

  // Contents change only when a new delivery starts, never during a tap.
  const renderDelivery = state => {
    const item = state.delivery;
    if (!item || deliveryKey === item.deliveryId) return;
    deliveryKey = item.deliveryId;
    face.src = item.imageUrl || ''; face.hidden = !item.imageUrl;
    bubble.textContent = '';
    bubble.append(el('span', '', `${item.name}「${item.hint}」`));
    if (item.habitat) bubble.append(el('small', '', `すみか：${item.habitat}`));
    item.candidates.forEach((name, i) => {
      const node = choices[i]; node.dataset.name = name; node.textContent = prefectureByName(name).fullName;
    });
    for (const [name, tile] of tiles) {
      const candidate = item.candidates.includes(name);
      tile.node.dataset.candidate = String(candidate); tile.node.disabled = !candidate;
      tile.node.textContent = candidate ? name : '';
      tile.node.dataset.focus = String(state.regionId === 'all' || tile.node.dataset.region === state.regionId);
    }
    plane.dataset.idle = 'true'; plane.style.left = ''; plane.style.top = '';
    note.textContent = 'どこの都道府県に とどけるかな？ 地図か下のボタンでえらぼう';
  };
  const renderState = state => {
    const titleText = state.delivery ? `おとどけ ${Math.min(state.total, state.delivered + 1)}/${state.total}${state.regionId !== 'all' ? `　${regionName(state.regionId)}` : '　全国'}` : '';
    if (title.textContent !== titleText) title.textContent = titleText;
    const open = state.phase === 'answering' && !state.paused;
    for (const [name, tile] of tiles) {
      const stamp = String(state.stamps.includes(name)), hint = String(state.phase === 'answering' && state.hintPrefecture === name);
      if (tile.node.dataset.stamp !== stamp) tile.node.dataset.stamp = stamp;
      if (tile.node.dataset.hint !== hint) tile.node.dataset.hint = hint;
      if (tile.node.dataset.candidate === 'true') tile.node.disabled = !open;
    }
    for (const node of choices) {
      const hint = String(state.phase === 'answering' && state.hintPrefecture === node.dataset.name);
      if (node.dataset.hint !== hint) node.dataset.hint = hint;
      node.disabled = !open;
    }
  };
  const showAnswer = state => {
    const answer = state.lastAnswer, target = tileCenter(answer.chosen), at = fieldPoint(answer.chosen);
    plane.dataset.idle = 'false'; plane.style.left = `${target.x}%`; plane.style.top = `${target.y}%`;
    const tile = tiles.get(answer.chosen)?.node;
    const chosen = prefectureByName(answer.chosen);
    if (answer.correct) {
      if (tile) restartClass(tile, 'gd-landed');
      note.textContent = `${chosen.fullName}に とどいた！ ${answer.fact}`;
      fx.burst(at.x, at.y, answer.first ? 'great' : 'good', answer.first ? 1.3 : 1);
      if (answer.first) fx.pop(at.x, at.y - 8, 'おとどけ！', 'great');
      answers.push({ text: `${prefectureByName(answer.prefecture).fullName} · ${answer.name}`, correct: answer.first });
    } else {
      if (tile) restartClass(tile, 'gd-back');
      note.textContent = `そこは${chosen.fullName}（${regionName(chosen.regionId)}）。${answer.name}のふるさとは ちがうみたい。光っているところに とどけよう`;
    }
    frame.announce(note.textContent);
  };

  return {
    root,
    attachCompanion(portrait) { plane.append(portrait); },
    focusPlay() { choices[0].focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      if (!state.delivery && !state.result) return;
      if (!state.result) { renderDelivery(state); renderState(state); }
      if (state.seq !== lastSeq) {
        lastSeq = state.seq;
        if (state.lastAnswer && state.lastAnswer.try !== shownTry) { shownTry = state.lastAnswer.try; showAnswer(state); }
      }
      if (state.result && !doneShown) {
        doneShown = true; review.hidden = false; reviewList.textContent = '';
        for (const item of answers) {
          const row = el('li', '', `${item.correct ? '✓' : '☆'} ${item.text}`);
          row.dataset.correct = String(item.correct); reviewList.append(row);
        }
      }
    },
    present(play, dt, state) {
      if (!active || !state) return;
      frame.tick(dt);
      const w = play.world || {};
      const event = w.lastEvent;
      if (event && event.id !== lastEventId) {
        lastEventId = event.id;
        if (event.type === 'boost') { fx.banner('スピード配達！', 'great'); fx.flash('great'); }
      }
      const mission = w.challenge;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: Math.min(1, (state.delivered ?? 0) / (state.total || 1)), progressLabel: `おとどけ ${state.delivered ?? 0}/${state.total ?? 0}`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; [...choices, ...[...tiles.values()].map(tile => tile.node), go].forEach(node => { node.disabled = true; }); },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
