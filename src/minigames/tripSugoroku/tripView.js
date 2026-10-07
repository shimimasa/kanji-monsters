import { createArcadeFrame, bindArcadeKeys, restartClass } from '../arcade/arcadeKit.js';
import { NODE_TYPES, ITEMS, TRIP_COLUMNS } from './tripGame.js';
import { CASE_MASK } from '../proverbDetective/proverbCases.js';

const CSS = `
#tripSugorokuScreen .ya-field{background:linear-gradient(#9fdcff 0,#d9f2ff 38%,#a6d98a 38.2%,#7cc26b 100%)}
#tripSugorokuScreen .tr-route{position:absolute;left:3%;right:3%;top:13%;height:26%;z-index:3}
#tripSugorokuScreen .tr-road{position:absolute;left:4%;right:4%;top:50%;height:10px;transform:translateY(-50%);border-radius:99px;background:repeating-linear-gradient(90deg,#e8d6a8 0 18px,#d9c28a 18px 36px);box-shadow:0 2px 0 #0002}
#tripSugorokuScreen .tr-node{position:absolute;z-index:2;width:clamp(46px,6.4vw,64px);height:clamp(46px,6.4vw,64px);transform:translate(-50%,-50%);padding:0;border:3px solid #fffdf6;border-radius:50%;background:#f1e3bf;font-size:clamp(20px,3vw,28px);box-shadow:0 4px 0 #0003;cursor:pointer;touch-action:manipulation}
#tripSugorokuScreen .tr-node[data-state=open]{background:#ffe066;border-color:#b86a00;animation:tr-bob .8s ease-in-out infinite alternate}
#tripSugorokuScreen .tr-node[data-selected=true]{outline:4px solid #2474b5;outline-offset:4px}
#tripSugorokuScreen .tr-node[data-state=visited]{background:#bff0c8;border-color:#2f8a4f}
#tripSugorokuScreen .tr-node[data-state=skipped]{opacity:.35}
#tripSugorokuScreen .tr-node:focus-visible{outline:3px solid #2a6fb0;outline-offset:2px}
#tripSugorokuScreen .tr-boss{position:absolute;z-index:2;right:0;top:50%;transform:translate(0,-50%);display:grid;place-items:center;width:clamp(58px,8vw,80px);height:clamp(58px,8vw,80px);border-radius:14px;background:#5a2a2a;border:3px solid #ffb3b3;font-size:clamp(24px,3.6vw,34px);box-shadow:0 4px 0 #0004}
#tripSugorokuScreen .tr-token{position:absolute;z-index:4;width:clamp(40px,5.4vw,56px);height:clamp(40px,5.4vw,56px);transform:translate(-50%,-110%);transition:left .35s ease-out,top .35s ease-out;pointer-events:none}
#tripSugorokuScreen .tr-token .gt-portrait{display:block;width:100%;height:100%;background:none;border:0}
#tripSugorokuScreen .tr-token .gt-portrait img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 3px 2px #0005)}
#tripSugorokuScreen .tr-stage{position:absolute;left:0;right:0;top:44%;bottom:0;z-index:2;display:grid;place-items:center}
#tripSugorokuScreen .tr-foe{display:flex;flex-direction:column;align-items:center;gap:6px}
#tripSugorokuScreen .tr-foe img{width:clamp(110px,20vw,190px);height:clamp(110px,20vw,190px);object-fit:contain;filter:drop-shadow(0 8px 4px #0005)}
#tripSugorokuScreen .tr-foe[data-boss=true] img{width:clamp(140px,26vw,240px);height:clamp(140px,26vw,240px)}
#tripSugorokuScreen .tr-foe.tr-hit img{animation:tr-hit .35s ease-out}
#tripSugorokuScreen .tr-foe-name{padding:3px 12px;border-radius:99px;background:#0008;color:#fff;font-weight:900;font-size:15px}
#tripSugorokuScreen .tr-hp{display:flex;gap:4px;font-size:22px;letter-spacing:1px}
#tripSugorokuScreen .tr-hp i{font-style:normal;font-size:26px;line-height:1;color:#e5364b;text-shadow:0 2px 0 #0004}
#tripSugorokuScreen .tr-hp i[data-full=false]{color:#0003;text-shadow:none}
#tripSugorokuScreen .tr-scroll{padding:16px 22px;border-radius:12px;background:linear-gradient(#fff6dc,#f1dfae);border:4px solid #b88340;color:#7a4a12;font-weight:900;font-size:40px;box-shadow:0 8px 0 #0003}
#tripSugorokuScreen .tr-gift{font-size:72px;animation:tr-pop .45s ease-out}
#tripSugorokuScreen .tr-preview{display:grid;gap:8px;max-width:88%;padding:14px 18px;border:4px solid #fff3b0;border-radius:16px;background:#fff8de;color:#573800;text-align:center;box-shadow:0 6px 0 #98723a;font-weight:800}
#tripSugorokuScreen .tr-preview strong{font-size:clamp(21px,3vw,30px)}
#tripSugorokuScreen .tr-preview span{font-size:clamp(14px,1.8vw,18px);line-height:1.4}
#tripSugorokuScreen .tr-title{margin:0;text-align:center;font-size:16px;font-weight:900;color:#ffe2b8}
#tripSugorokuScreen .tr-stops{display:grid;gap:8px}
#tripSugorokuScreen .tr-stop{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;align-items:center;min-height:64px;padding:8px 12px;border:0;border-radius:14px;background:#f5f8fa;color:#16242c;font:inherit;text-align:left;box-shadow:0 4px 0 #9fb3bf;cursor:pointer;touch-action:manipulation}
#tripSugorokuScreen .tr-stop b{grid-row:span 2;font-size:30px}
#tripSugorokuScreen .tr-stop strong{font-size:20px}
#tripSugorokuScreen .tr-stop small{font-size:13px;color:#4a5e6a}
#tripSugorokuScreen .tr-stop[data-selected=true]{background:#fff2ba;box-shadow:0 4px 0 #bd850e,0 0 0 3px #ffd54a}
#tripSugorokuScreen .tr-stop:focus-visible,#tripSugorokuScreen .tr-choice:focus-visible{outline:3px solid #ffd54a;outline-offset:2px}
#tripSugorokuScreen .tr-question{margin:0;padding:10px 12px;border-radius:12px;background:#ffffff14;text-align:center;font-size:clamp(18px,2.3vw,23px);font-weight:800;line-height:1.5;color:#fff}
#tripSugorokuScreen .tr-target{display:inline-block;margin:0 2px;padding:0 6px;border-radius:8px;background:#ffe066;color:#3a2400;font-size:1.3em;line-height:1.2}
#tripSugorokuScreen .tr-choices{display:grid;grid-template-columns:1fr 1fr;gap:8px}
#tripSugorokuScreen .tr-choices[data-kind=proverb]{grid-template-columns:1fr}
#tripSugorokuScreen .tr-choice{min-height:54px;padding:6px 10px;border:0;border-radius:14px;background:#f5f8fa;color:#16242c;font:inherit;font-size:clamp(18px,2.3vw,23px);font-weight:900;box-shadow:0 4px 0 #9fb3bf;cursor:pointer;touch-action:manipulation}
#tripSugorokuScreen .tr-choices[data-kind=proverb] .tr-choice{font-size:clamp(16px,1.9vw,20px);text-align:left}
#tripSugorokuScreen .tr-choice small{font-size:.55em;color:#6b7f8a;margin-right:6px}
#tripSugorokuScreen .tr-choice[data-status=correct]{background:#d7f7df;box-shadow:0 4px 0 #1f9d55}
#tripSugorokuScreen .tr-choice[data-status=chosen]{background:#fff1d6;box-shadow:0 4px 0 #c77f16}
#tripSugorokuScreen .tr-choice[data-status=gone]{visibility:hidden}
#tripSugorokuScreen .tr-items{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
#tripSugorokuScreen .tr-item{min-height:44px;padding:4px 12px;border:2px solid #ffffff55;border-radius:99px;background:#ffffff1c;color:#fff;font:inherit;font-size:15px;font-weight:900;white-space:nowrap;cursor:pointer}
#tripSugorokuScreen .tr-item:disabled{opacity:.4;cursor:default}
#tripSugorokuScreen .tr-item[data-armed=true]{opacity:1;background:#ffe066;color:#3a2400;border-color:#ffe066}
#tripSugorokuScreen .tr-reward{margin:0;padding:12px;border-radius:12px;background:#fff6dc;color:#3a2400;text-align:center;font-size:18px;font-weight:900;line-height:1.5}
#tripSugorokuScreen .tr-go{min-height:56px;border:0;border-radius:14px;background:#ffb627;color:#3a2400;font:inherit;font-size:22px;font-weight:900;box-shadow:0 4px 0 #b57500;cursor:pointer}
#tripSugorokuScreen .tr-review{margin:0;padding:0;list-style:none;display:grid;gap:6px}
#tripSugorokuScreen .tr-review li{padding:6px 10px;border-radius:10px;background:#eef6ef;font-weight:700}
#tripSugorokuScreen .tr-review li[data-correct=false]{background:#fff3da}
@keyframes tr-bob{from{transform:translate(-50%,-50%)}to{transform:translate(-50%,-62%)}}
@keyframes tr-hit{0%,100%{transform:none}30%{transform:translateX(-12px) rotate(-6deg)}60%{transform:translateX(10px) rotate(5deg)}}
@keyframes tr-pop{0%{transform:scale(.3);opacity:0}70%{transform:scale(1.15)}100%{transform:scale(1)}}
`;

// Route layout inside the route strip (percent): start, four columns, boss.
const COLUMN_X = [18, 36, 54, 72], ROW_Y = [22, 78], START_X = 3, BOSS_X = 92;

export function createTripView({ document: doc, dispatch, onBack, getSnapshot }) {
  let active = true, shownKey = null, lastSeq = -1, lastEventId = 0, bossHp = null, sceneKey = null, bannered = false, stopsKey = null, foeBox = null, hpBox = null;
  let selectedStopId = null, selectionKey = null;
  const removes = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'tripSugorokuScreen', title: '旅すごろく', theme: 'road' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });

  const route = el('div', 'tr-route'); route.append(el('i', 'tr-road'));
  const nodes = [];
  for (let column = 0; column < TRIP_COLUMNS; column++) for (let row = 0; row < 2; row++) {
    const node = el('button', 'tr-node'); node.type = 'button'; node.dataset.column = String(column); node.dataset.row = String(row);
    node.style.left = `${COLUMN_X[column]}%`; node.style.top = `${ROW_Y[row]}%`;
    on(node, 'click', () => chooseStop(node.dataset.nodeId)); route.append(node); nodes.push(node);
  }
  const bossMark = el('span', 'tr-boss', '👑'); route.append(bossMark);
  const token = el('div', 'tr-token'); route.append(token);
  const scene = el('div', 'tr-stage');
  world.append(route, scene);

  const title = el('p', 'tr-title');
  const stops = el('div', 'tr-stops');
  const stopButtons = [0, 1].map(index => {
    const node = el('button', 'tr-stop'); node.type = 'button'; node.dataset.choiceIndex = String(index + 1);
    on(node, 'click', () => chooseStop(node.dataset.nodeId)); stops.append(node); return node;
  });
  const question = el('p', 'tr-question'); question.dataset.role = 'problem';
  const choicesBox = el('div', 'tr-choices');
  const choices = [0, 1, 2, 3].map(index => {
    const node = el('button', 'tr-choice'); node.type = 'button'; node.dataset.choiceIndex = String(index + 1);
    on(node, 'click', () => answer(index)); choicesBox.append(node); return node;
  });
  const itemsBox = el('div', 'tr-items');
  const itemButtons = Object.fromEntries(Object.keys(ITEMS).map(item => {
    const node = el('button', 'tr-item'); node.type = 'button'; node.dataset.item = item;
    on(node, 'click', () => useItem(item)); itemsBox.append(node); return [item, node];
  }));
  const rewardText = el('p', 'tr-reward');
  const go = el('button', 'tr-go', 'すすむ'); go.type = 'button'; go.dataset.action = 'next';
  on(go, 'click', () => proceed());
  on(go, 'keydown', event => {
    if (event.key !== 'Enter' || event.repeat || session().phase !== 'map') return;
    event.preventDefault();
    proceed();
  });
  const note = el('p', 'ya-dock-note'); note.dataset.role = 'feedback';
  dock.append(title, stops, question, choicesBox, itemsBox, rewardText, go, note);
  const review = el('div', 'ya-learning-result'); review.hidden = true;
  const reviewList = el('ol', 'tr-review'); review.append(el('h3', '', '今回の旅の問題'), reviewList); frame.shell.append(review);
  doc.body.append(root);
  const answers = [];

  const session = () => getSnapshot();
  function chooseStop(nodeId) {
    const state = session(), stop = state.map?.[state.column]?.find(item => item.nodeId === nodeId);
    if (!active || state.paused || state.phase !== 'map' || !stop) return false;
    selectedStopId = nodeId;
    renderRoute(state);
    renderScene(state);
    renderDock(state);
    go.focus?.({ preventScroll: true });
    return true;
  }
  function move(nodeId) {
    const state = session();
    if (!active || state.paused || state.phase !== 'map' || !nodeId) return false;
    return dispatch({ type: 'move', payload: { sessionId: state.sessionId, nodeId } });
  }
  function answer(index) {
    const state = session(), choice = state.problem?.choices[index];
    if (!active || state.paused || state.phase !== 'answering' || !choice || state.hiddenChoiceIds.includes(choice.choiceId)) return false;
    return dispatch({ type: 'answer', payload: { sessionId: state.sessionId, problemId: state.problem.problemId, attemptId: state.attemptId, choiceId: choice.choiceId } });
  }
  function useItem(item) {
    const state = session();
    if (!active || state.paused || state.phase !== 'answering') return false;
    return dispatch({ type: 'useItem', payload: { sessionId: state.sessionId, item } });
  }
  function proceed() {
    const state = session();
    if (!active || state.paused) return false;
    if (state.phase === 'map') return selectedStopId ? move(selectedStopId) : false;
    if (!['reward', 'feedback'].includes(state.phase)) return false;
    return dispatch({ type: 'next', payload: { sessionId: state.sessionId, problemId: state.problem?.problemId } });
  }
  removes.push(bindArcadeKeys(doc, event => {
    if (!active || event.repeat) return false;
    const state = session(), index = ['1', '2', '3', '4'].indexOf(event.key);
    if (index >= 0 && state.phase === 'map') { chooseStop(stopButtons[index]?.dataset.nodeId); return true; }
    if (index >= 0) { answer(index); return true; }
    if (event.key === 'Enter' && !go.hidden) { proceed(); return true; }
    return false;
  }));

  const foe = (name, image, boss) => {
    const box = el('div', 'tr-foe'); box.dataset.boss = String(!!boss);
    if (image) { const img = el('img'); img.src = image; img.alt = ''; box.append(img); }
    box.append(el('span', 'tr-foe-name', name));
    hpBox = boss ? el('span', 'tr-hp') : null; if (hpBox) box.append(hpBox);
    foeBox = box;
    return box;
  };
  const renderScene = state => {
    scene.textContent = ''; foeBox = null; hpBox = null;
    if (state.phase === 'reward') { scene.append(el('span', 'tr-gift', state.reward?.item ? ITEMS[state.reward.item].icon : '🌟')); return; }
    if (state.column >= TRIP_COLUMNS && state.boss) { scene.append(foe(state.boss.name, state.boss.imageUrl, true)); return; }
    if (state.problem?.kind === 'proverb') { scene.append(el('div', 'tr-scroll', '📜')); return; }
    if (state.opponent) { scene.append(foe(state.opponent.name, state.opponent.imageUrl, false)); return; }
    if (state.node?.type === 'training') { scene.append(el('div', 'tr-scroll', '🔥 修行')); return; }
    if (state.phase === 'map') {
      const selected = state.map[state.column]?.find(stop => stop.nodeId === selectedStopId);
      if (!selected) { scene.append(el('span', 'tr-gift', '🗺')); return; }
      const type = NODE_TYPES[selected.type], preview = el('div', 'tr-preview');
      preview.append(el('strong', '', `${type.icon} ${type.label}`), el('span', '', type.note));
      scene.append(preview);
    }
  };
  const renderRoute = state => {
    nodes.forEach(node => {
      const column = Number(node.dataset.column), row = Number(node.dataset.row), stop = state.map[column]?.[row];
      const icon = stop ? NODE_TYPES[stop.type].icon : '';
      node.dataset.nodeId = stop?.nodeId ?? ''; if (node.textContent !== icon) node.textContent = icon;
      node.setAttribute('aria-label', stop ? `${column + 1}列目 ${NODE_TYPES[stop.type].label}${stop.nodeId === selectedStopId ? '、えらんだ道' : ''}` : '');
      node.dataset.state = state.path.includes(stop?.nodeId) ? 'visited' : column < state.column ? 'skipped'
        : column === state.column && state.phase === 'map' ? 'open' : 'ahead';
      node.dataset.selected = String(state.phase === 'map' && stop?.nodeId === selectedStopId);
      node.setAttribute('aria-pressed', String(state.phase === 'map' && stop?.nodeId === selectedStopId));
      node.disabled = !(column === state.column && state.phase === 'map');
    });
    const last = state.path.at(-1), lastNode = nodes.find(node => node.dataset.nodeId === last);
    const x = state.column >= TRIP_COLUMNS && ['answering', 'feedback', 'completed'].includes(state.phase) ? BOSS_X - 6
      : lastNode ? parseFloat(lastNode.style.left) : START_X, y = lastNode ? parseFloat(lastNode.style.top) : 50;
    token.style.left = `${x}%`; token.style.top = `${y}%`;
  };
  const renderDock = state => {
    const map = state.phase === 'map', asking = ['answering', 'feedback'].includes(state.phase), reward = state.phase === 'reward';
    stops.hidden = !map; question.hidden = !asking; choicesBox.hidden = !asking; itemsBox.hidden = !asking;
    rewardText.hidden = !reward; go.hidden = !reward && !(map && selectedStopId);
    go.textContent = map ? 'この道へすすむ' : 'すすむ';
    if (map) {
      title.textContent = `${state.column + 1}つ目の分かれ道。どっちへ進む？`;
      // Build the stop buttons once per fork; rebuilding every frame would swallow a finger tap.
      if (stopsKey !== state.column) state.map[state.column].forEach((stop, index) => {
        stopsKey = state.column;
        const node = stopButtons[index], type = NODE_TYPES[stop.type];
        node.dataset.nodeId = stop.nodeId; node.textContent = '';
        node.append(el('b', '', type.icon), el('strong', '', type.label), el('small', '', type.note));
      });
      stopButtons.forEach(node => {
        const chosen = node.dataset.nodeId === selectedStopId;
        node.dataset.selected = String(chosen);
        node.setAttribute('aria-pressed', String(chosen));
      });
      note.textContent = `道具：🔥${state.items.hint}　⭐${state.items.power}`;
    }
    if (reward) { title.textContent = 'ごほうび'; rewardText.textContent = state.reward?.text || 'ひと息ついた！'; note.textContent = ''; }
    if (asking && state.problem) {
      const problem = state.problem, boss = state.column >= TRIP_COLUMNS;
      title.textContent = boss ? `ボス戦！ ${state.boss?.name}` : state.node ? NODE_TYPES[state.node.type].label : '';
      if (shownKey !== problem.problemId) {
        shownKey = problem.problemId;
        question.textContent = '';
        if (problem.kind === 'proverb') {
          const [before, after = ''] = problem.question.split(CASE_MASK);
          for (const line of problem.clues) question.append(el('span', '', line));
          question.append(el('span', '', before), el('span', 'tr-target', '？'), el('span', '', after));
        } else question.append(el('span', '', problem.before), el('span', 'tr-target', problem.kanji), el('span', '', problem.after));
        choicesBox.dataset.kind = problem.kind;
        choices.forEach((node, index) => {
          const choice = problem.choices[index];
          node.hidden = !choice; delete node.dataset.status; node.textContent = ''; node.dataset.choiceId = choice?.choiceId ?? '';
          if (choice) { node.append(el('small', '', String(index + 1)), el('span', '', choice.text)); node.setAttribute('aria-label', `${index + 1}番 ${choice.text}`); }
        });
      }
      if (state.phase === 'answering') {
        const ask = (problem.kind === 'proverb' ? 'ぴったりのことわざは？' : `［${problem.kanji}］の読みは？`)
          + (boss && state.items.power && !state.powerArmed ? '　⭐を使うと2ダメージ！' : '');
        if (note.textContent !== ask) note.textContent = ask;
      }
      choices.forEach(node => { if (state.hiddenChoiceIds.includes(node.dataset.choiceId)) node.dataset.status = 'gone'; });
      itemButtons.hint.textContent = `🔥 ヒント ×${state.items.hint}`;
      itemButtons.hint.disabled = state.phase !== 'answering' || !state.items.hint || state.hiddenChoiceIds.length > 0;
      itemButtons.power.textContent = state.powerArmed ? '⭐ つぎは2ダメージ！' : `⭐ きらきら ×${state.items.power}`;
      itemButtons.power.hidden = !boss; itemButtons.power.dataset.armed = String(state.powerArmed);
      itemButtons.power.disabled = state.phase !== 'answering' || !state.items.power || state.powerArmed;
      choices.forEach(node => { node.disabled = state.phase !== 'answering' || state.paused; });
    }
  };
  const showAnswer = state => {
    const answer = state.lastAnswer, problem = state.problem;
    choices.forEach(node => {
      if (node.dataset.choiceId === answer.correctChoiceId) node.dataset.status = 'correct';
      else if (node.dataset.choiceId === answer.choiceId) node.dataset.status = 'chosen';
    });
    const right = problem.choices.find(choice => choice.choiceId === answer.correctChoiceId)?.text ?? '';
    answers.push({ text: problem.kind === 'proverb' ? `${problem.text}（${problem.meaning}）` : `${problem.kanji}（${problem.reading}）`, correct: answer.correct });
    if (answer.correct) {
      note.textContent = answer.damage ? `命中！ ボスに${answer.damage}ダメージ！` : 'せいかい！';
      if (answer.damage) { if (foeBox) restartClass(foeBox, 'tr-hit'); fx.burst(50, 64, answer.damage > 1 ? 'great' : 'good', answer.damage > 1 ? 1.6 : 1.1); }
    } else note.textContent = problem.kind === 'proverb' ? `正しくは「${right}」。${problem.meaning}` : `この文の「${problem.kanji}」は「${right}」と読むよ`;
    frame.announce(note.textContent);
  };

  return {
    root,
    attachCompanion(portrait) { token.append(portrait); },
    focusPlay() { stopButtons[0].focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      if (!state.map) return;
      if (state.phase === 'map' && selectionKey !== `${state.sessionId}:${state.column}`) {
        selectionKey = `${state.sessionId}:${state.column}`;
        selectedStopId = null;
      }
      renderRoute(state);
      const key = `${state.phase}:${state.problem?.problemId ?? ''}:${state.column}:${state.path.length}:${state.phase === 'map' ? selectedStopId ?? '' : ''}`;
      if (key !== sceneKey) { sceneKey = key; renderScene(state); }
      const hp = hpBox;
      if (hp && state.boss && bossHp !== `${state.boss.hp}:${key}`) { bossHp = `${state.boss.hp}:${key}`; hp.textContent = ''; hp.setAttribute('aria-label', `のこり${state.boss.hp}`);
        for (let i = 0; i < state.boss.maxHp; i++) { const heart = el('i', '', '♥'); heart.dataset.full = String(i < state.boss.hp); hp.append(heart); } }
      renderDock(state);
      if (state.seq !== lastSeq) {
        lastSeq = state.seq;
        if (state.lastAnswer && answers.length < state.answered) showAnswer(state);
      }
      if (state.result && review.hidden) {
        review.hidden = false; reviewList.textContent = '';
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
        if (event.type === 'boost') { fx.banner('旅の追い風！', 'great'); fx.flash('great'); }
      }
      if (state.result?.bossDefeated && !bannered) { bannered = true; fx.banner('ボス撃破！', 'great'); }
      const mission = w.challenge;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: Math.min(1, (state.column ?? 0) / (TRIP_COLUMNS + 1)),
        progressLabel: state.column >= TRIP_COLUMNS ? `ボス戦 ${state.stage?.name ?? ''}` : `${state.stage?.name ?? ''} ${Math.min(TRIP_COLUMNS, (state.column ?? 0) + 1)}/${TRIP_COLUMNS}`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; [...nodes, ...stopButtons, ...choices, ...Object.values(itemButtons), go].forEach(node => { node.disabled = true; }); },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
