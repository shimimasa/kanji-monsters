import { createArcadeFrame } from '../arcade/arcadeKit.js';
import { HISTORY_BUILDINGS } from './historyContent.js';

const CSS = `
#historyBuildScreen .ya-field{background:linear-gradient(155deg,#e6f4e0,#cce5d1 52%,#a8d2c6)}
#historyBuildScreen .hb-wrap{position:absolute;inset:58px 3% 7px;display:flex;flex-direction:column;gap:8px;align-items:center;justify-content:center;color:#254237}
#historyBuildScreen .hb-bar{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;width:100%}
#historyBuildScreen .hb-chip{padding:4px 10px;border-radius:999px;background:#fffef2;color:#254237;font-weight:800;font-size:clamp(12px,1.8vw,16px)}
#historyBuildScreen .hb-title{margin:0;text-align:center;font-size:clamp(17px,3vw,26px);line-height:1.25}
#historyBuildScreen .hb-question{margin:0;padding:8px 14px;border-radius:12px;background:#fffef2;font-size:clamp(24px,5vw,40px);font-weight:900;text-align:center}
#historyBuildScreen .hb-cards,#historyBuildScreen .hb-answers,#historyBuildScreen .hb-buildings{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;width:min(100%,620px)}
#historyBuildScreen .hb-answers{grid-template-columns:repeat(2,minmax(0,1fr))}
#historyBuildScreen button.hb-card,#historyBuildScreen button.hb-answer,#historyBuildScreen button.hb-building{min-width:0;min-height:54px;padding:8px;border:2px solid #446b55;border-radius:14px;background:#fffef5;color:#203a2f;font:inherit;font-size:clamp(15px,2.3vw,20px);font-weight:800;line-height:1.25;cursor:pointer;touch-action:manipulation;box-shadow:0 4px 0 #42695255}
#historyBuildScreen button.hb-card{min-height:86px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}
#historyBuildScreen button.hb-building{display:flex;flex-direction:column;align-items:center;gap:2px}
#historyBuildScreen button.hb-building:last-child{grid-column:1/-1}
#historyBuildScreen button.hb-card:focus-visible,#historyBuildScreen button.hb-answer:focus-visible,#historyBuildScreen button.hb-building:focus-visible,#historyBuildScreen button.hb-next:focus-visible{outline:4px solid #ffb703;outline-offset:2px}
#historyBuildScreen button:disabled{cursor:default;opacity:.55;box-shadow:none}
#historyBuildScreen .hb-face{font-size:clamp(25px,4vw,37px)}
#historyBuildScreen .hb-town{display:flex;flex-wrap:wrap;justify-content:center;gap:5px;min-height:28px;width:100%}
#historyBuildScreen .hb-town span{padding:3px 7px;border-radius:8px;background:#e9f7ef;color:#254237;font-size:13px;font-weight:800}
#historyBuildScreen .hb-message{margin:0;min-height:1.4em;text-align:center;font-size:clamp(14px,2vw,17px);font-weight:800;line-height:1.35}
#historyBuildScreen .hb-next{min-height:44px;padding:6px 22px;border:0;border-radius:12px;background:#2a7563;color:#fff;font:inherit;font-size:17px;font-weight:900;cursor:pointer}
#historyBuildScreen .ya-dock{color:#fff}
@media(max-width:500px){#historyBuildScreen .hb-wrap{inset:48px 2% 4px;gap:5px}#historyBuildScreen button.hb-card{min-height:65px}#historyBuildScreen .hb-chip{padding:3px 7px}#historyBuildScreen .hb-question{padding:4px 8px}}
`;

export function createHistoryView({ document: doc, dispatch, getSnapshot, onBack }) {
  let active = true, shownRound = -1, shownPhase = '', shownTown = '';
  const removes = [];
  const on = (node, type, listener) => { node.addEventListener(type, listener); removes.push(() => node.removeEventListener(type, listener)); };
  const frame = createArcadeFrame(doc, { id: 'historyBuildScreen', title: 'れきしのカードづくり', theme: 'cards' });
  const { root, world, dock, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });
  const wrap = el('div', 'hb-wrap');
  const bar = el('div', 'hb-bar');
  const title = el('h2', 'hb-title');
  const question = el('p', 'hb-question');
  const cards = el('div', 'hb-cards');
  const answers = el('div', 'hb-answers');
  const buildings = el('div', 'hb-buildings');
  const town = el('div', 'hb-town'); town.setAttribute('aria-label', 'できた町');
  const message = el('p', 'hb-message'); message.setAttribute('role', 'status');
  const next = el('button', 'hb-next', 'つぎのカードへ'); next.type = 'button'; next.dataset.action = 'next';
  const cardButtons = Array.from({ length: 2 }, () => {
    const button = el('button', 'hb-card'); button.type = 'button'; cards.append(button);
    on(button, 'click', () => {
      const state = getSnapshot();
      if (active && state.phase === 'choosing') dispatch({ type: 'choose', payload: { sessionId: state.sessionId, cardId: button.dataset.cardId } });
    });
    return button;
  });
  const answerButtons = Array.from({ length: 4 }, () => {
    const button = el('button', 'hb-answer'); button.type = 'button'; answers.append(button);
    on(button, 'click', () => {
      const state = getSnapshot();
      if (active && state.phase === 'answering') dispatch({ type: 'answer', payload: {
        sessionId: state.sessionId, attemptId: state.attemptId, choiceId: button.dataset.choiceId } });
    });
    return button;
  });
  const buildingButtons = HISTORY_BUILDINGS.map(item => {
    const button = el('button', 'hb-building'); button.type = 'button'; button.dataset.buildingId = item.id;
    button.append(el('span', 'hb-face', item.icon), el('span', '', `${item.name}　米${item.rice}・知識${item.knowledge}`));
    buildings.append(button);
    on(button, 'click', () => {
      const state = getSnapshot();
      if (active && state.phase === 'building') dispatch({ type: 'build', payload: { sessionId: state.sessionId, buildingId: item.id } });
    });
    return button;
  });
  on(next, 'click', () => {
    const state = getSnapshot();
    if (active && state.phase === 'building') dispatch({ type: 'next', payload: {
      sessionId: state.sessionId, problemId: state.problem?.problemId } });
  });
  wrap.append(bar, title, question, cards, answers, buildings, town, message, next);
  world.append(wrap);
  dock.append(el('p', 'ya-dock-note', '読みをえらぶと、そのカードを町づくりに使えるよ。建てるのは今回だけのあそび。'));
  doc.body.append(root);
  return {
    root,
    focusPlay() { cardButtons[0].focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      const phase = state.phase;
      bar.textContent = `カード ${Math.min(state.round + 1, state.rounds)}/${state.rounds}　🌾 米 ${state.rice}　📖 知識 ${state.knowledge}　🏡 町 ${state.points}点`;
      cards.hidden = phase !== 'choosing'; answers.hidden = phase !== 'answering';
      buildings.hidden = phase !== 'building'; next.hidden = phase !== 'building';
      question.hidden = phase !== 'answering';
      if (phase !== shownPhase || state.round !== shownRound) {
        shownPhase = phase; shownRound = state.round;
        if (phase === 'choosing') {
          title.textContent = '町へむかえるカードを1まいえらぼう';
          state.offers.forEach((item, index) => {
            const button = cardButtons[index]; button.dataset.cardId = item.id;
            button.textContent = `${item.icon} ${item.name}`;
          });
          message.textContent = 'どちらをえらんでも、読みをたしかめて町にむかえるよ。';
        } else if (phase === 'answering') {
          title.textContent = 'このカードは、なんと読む？'; question.textContent = state.chosen.name;
          state.problem.choices.forEach((item, index) => {
            answerButtons[index].dataset.choiceId = item.choiceId;
            answerButtons[index].textContent = item.text;
          });
          message.textContent = '';
        } else if (phase === 'building') {
          title.textContent = 'カードをむかえたよ。町をつくろう';
        } else if (phase === 'completed') {
          title.textContent = '町づくり、できたね！'; message.textContent = `${state.deck.length}まいのカードをつかったよ。`;
        }
      }
      if (phase === 'building') {
        buildingButtons.forEach((button, index) => {
          const item = HISTORY_BUILDINGS[index];
          button.disabled = state.builtThisRound || state.rice < item.rice || state.knowledge < item.knowledge;
        });
        message.textContent = state.lastBuild
          ? `${HISTORY_BUILDINGS.find(item => item.id === state.lastBuild)?.name}が町にふえたよ！`
          : `「${state.chosen.name}」は「${state.chosen.reading}」。建物をえらんでも、そのまま次へ進んでもいいよ。`;
        next.textContent = state.round + 1 === state.rounds ? '町づくりをおえる' : 'つぎのカードへ';
      }
      const townKey = state.town.join(',');
      if (townKey !== shownTown) {
        shownTown = townKey; town.textContent = '';
        state.town.forEach(id => { const item = HISTORY_BUILDINGS.find(entry => entry.id === id);
          if (item) town.append(el('span', '', `${item.icon} ${item.name}`)); });
      }
    },
    present(play, dt, state) {
      frame.tick(dt);
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: state.round / state.rounds, progressLabel: `${Math.min(state.round + 1, state.rounds)}/${state.rounds}まい`,
        life: null, gaugeValue: play.gauge });
    },
    stopInput() { active = false; [...cardButtons, ...answerButtons, ...buildingButtons, next].forEach(node => { node.disabled = true; }); },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
