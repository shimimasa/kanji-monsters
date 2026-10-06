import Speech from '../../audio/speech.js';
import { createArcadeFrame } from '../arcade/arcadeKit.js';
import { NEW_GAME_CONTENT } from './content.js';

const CSS = `
.be-field{background:linear-gradient(145deg,#d8f5ee,#b8ddea 60%,#d9cbf2)}
.be-wrap{position:absolute;inset:56px 3% 6px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#20364c;text-align:center}
.be-top{width:min(100%,640px);display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:clamp(13px,1.8vw,17px);font-weight:900}
.be-art{position:relative;display:grid;place-items:center;width:min(100%,640px);min-height:100px;border:3px solid #375b72;border-radius:20px;background:#fafff9;box-shadow:0 5px 0 #375b7244;overflow:hidden}
.be-art-text{position:relative;z-index:1;font-size:clamp(34px,7vw,66px);line-height:1.2;transition:transform .2s}
.be-art[data-filled=true] .be-art-text{transform:scale(1.08)}
.be-art-result{position:relative;z-index:2;display:none;max-width:88%;padding:5px 12px;border-radius:12px;background:#fffef4;color:#194c56;font-size:clamp(15px,2.4vw,23px);font-weight:900;line-height:1.25}
.be-art[data-filled=true] .be-art-result{display:block;animation:be-arrive .3s ease-out}
@keyframes be-arrive{from{opacity:0;transform:translateY(12px) scale(.92)}to{opacity:1;transform:translateY(0) scale(1)}}
.be-question{max-width:660px;margin:0;font-size:clamp(18px,3vw,27px);font-weight:900;line-height:1.3}
.be-transcript{margin:0;padding:4px 12px;border-radius:8px;background:#fff;max-width:100%;font-size:clamp(17px,2.5vw,23px);font-weight:800;overflow-wrap:anywhere}
.be-tools{display:flex;justify-content:center;gap:8px;min-height:35px}
.be-tools button,.be-next{min-height:38px;padding:4px 14px;border:2px solid #416079;border-radius:12px;background:#fff;color:#20364c;font:inherit;font-size:clamp(14px,2vw,18px);font-weight:900;cursor:pointer;touch-action:manipulation}
.be-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;width:min(100%,660px)}
.be-option{min-width:0;min-height:65px;padding:6px 5px;border:3px solid #416079;border-radius:16px;background:#fff;color:#20364c;font:inherit;font-size:clamp(16px,2.4vw,22px);font-weight:900;line-height:1.25;cursor:pointer;touch-action:manipulation;overflow-wrap:anywhere;box-shadow:0 4px 0 #41607955}
.be-option:focus-visible,.be-tools button:focus-visible,.be-next:focus-visible{outline:4px solid #f4a000;outline-offset:2px}
.be-option:disabled{opacity:.6;cursor:default}
.be-feedback{max-width:660px;min-height:1.5em;margin:0;font-size:clamp(14px,2vw,18px);font-weight:800;line-height:1.3}
.be-next{background:#245d70;color:#fff;border-color:#245d70;min-height:44px;padding:6px 22px}
.be-collection{display:flex;justify-content:center;gap:5px;flex-wrap:wrap;width:min(100%,660px);min-height:29px}
.be-collection span{display:grid;place-items:center;min-width:34px;min-height:28px;padding:1px 5px;border-radius:8px;background:#fff9;color:#1d4355;font-size:clamp(14px,2vw,21px);font-weight:800}
#abcPostScreen .be-art{background:linear-gradient(#ffe9ad,#fff8df)}#abcPostScreen .be-option{background:#fff4d0;border-radius:22px 22px 9px 9px}
#englishRadioScreen .be-art{background:radial-gradient(circle,#f7e6ff,#d4d9ff)}#englishRadioScreen .be-art::after{content:'♪ 〜 ♪';position:absolute;right:7%;top:12%;font-size:28px;color:#805aa3}
#replyCafeScreen .be-art{background:linear-gradient(#fff0d5,#efd1ac)}#replyCafeScreen .be-option{border-radius:22px;background:#fffaf1}
#englishRoomScreen .be-art{background:linear-gradient(#e4f6ff 64%,#c9a579 65%)}#englishRoomScreen .be-option{background:#eef8ff}
#englishRoomScreen .be-art-text{font-size:clamp(43px,7vw,66px)}#englishRoomScreen .be-room-object{position:absolute;z-index:2;left:23%;top:35%;font-size:clamp(33px,6vw,52px);transition:left .35s,top .35s}
#englishRoomScreen .be-art[data-position=上] .be-room-object{left:52%;top:0}
#englishRoomScreen .be-art[data-position=中] .be-room-object{left:49%;top:28%}
#englishRoomScreen .be-art[data-position=下] .be-room-object{left:52%;top:60%}
#englishRoomScreen .be-art-result{position:absolute;right:3%;bottom:5%;font-size:15px}
#wonderLabScreen .be-art{background:radial-gradient(circle at 50% 72%,#bdfff4,#ecf7ff)}#wonderLabScreen .be-art::after{content:'✦ ✧ ✦';position:absolute;top:10%;right:12%;color:#347ba1}
#wonderLabScreen .be-art[data-filled=true] .be-art-text{animation:be-arrive .45s ease-out}
#lifeCycleScreen .be-art{background:linear-gradient(#e6f9d8,#bfe6a8)}#lifeCycleScreen .be-collection span{border-radius:50%}
#mapTownScreen .be-art{background:linear-gradient(90deg,#e2edd8 49%,#c7dfd0 50%)}#mapTownScreen .be-collection span{background:#f4f0da}
#shapeMosaicScreen .be-art{background:repeating-linear-gradient(45deg,#edf4ff 0 16px,#dfeaf9 16px 32px)}#shapeMosaicScreen .be-option{background:#e9f5ff}
#mapTownScreen .be-collection,#shapeMosaicScreen .be-collection{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;width:min(240px,70%);padding:4px;border:2px solid #416079;border-radius:10px;background:#d3e3d3}
#mapTownScreen .be-collection span,#shapeMosaicScreen .be-collection span{min-height:31px;background:#fffefa}
#shapeMosaicScreen .be-collection{background:#dce9ff}#shapeMosaicScreen .be-collection span{color:#476fc0}
@media(max-width:520px){.be-wrap{inset:48px 2% 3px;gap:5px}.be-art{min-height:80px}.be-options{gap:5px}.be-option{min-height:60px;padding:4px 2px;font-size:clamp(14px,3.8vw,18px)}.be-collection span{min-width:27px}}
`;

const needsSpeech = new Set(['englishRadio', 'replyCafe', 'englishRoom']);

export function createBalancedView(gameId, { document: doc, dispatch, getSnapshot, onBack }) {
  const config = NEW_GAME_CONTENT[gameId];
  if (!config) throw new Error('Unknown balanced mini game view');
  let active = true, shownKey = '', shownCollection = -1, textShown = false;
  const removes = [];
  const on = (node, type, listener) => {
    node.addEventListener(type, listener);
    removes.push(() => node.removeEventListener(type, listener));
  };
  const frame = createArcadeFrame(doc, { id: `${gameId}Screen`, title: config.title, theme: 'cards' });
  const { root, world, dock, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  frame.field.className += ' be-field';
  const wrap = el('div', 'be-wrap');
  const top = el('div', 'be-top');
  const progress = el('span'), motto = el('span', '', config.subject === 'english' ? 'ABC ✦' : config.subject === 'science' ? 'はっけん ✦' : 'つくろう ✦');
  top.append(progress, motto);
  const art = el('div', 'be-art');
  const artText = el('span', 'be-art-text');
  const roomObject = el('span', 'be-room-object');
  const artResult = el('span', 'be-art-result');
  art.append(artText, roomObject, artResult);
  const question = el('h2', 'be-question');
  const transcript = el('p', 'be-transcript');
  const tools = el('div', 'be-tools');
  const listen = el('button', '', '🔊 きく'); listen.type = 'button'; listen.dataset.action = 'listen';
  const showText = el('button', '', '文字で見る'); showText.type = 'button'; showText.dataset.action = 'show-text';
  tools.append(listen, showText);
  const options = el('div', 'be-options');
  const buttons = Array.from({ length: 3 }, () => {
    const button = el('button', 'be-option'); button.type = 'button'; options.append(button);
    on(button, 'click', () => {
      const state = getSnapshot();
      if (active && state.phase === 'answering') dispatch({ type: 'answer', payload: {
        sessionId: state.sessionId, attemptId: state.attemptId, choiceId: button.dataset.choiceId } });
    });
    return button;
  });
  const feedback = el('p', 'be-feedback'); feedback.setAttribute('role', 'status');
  const next = el('button', 'be-next', 'つぎへ'); next.type = 'button'; next.dataset.action = 'next';
  const collection = el('div', 'be-collection'); collection.setAttribute('aria-label', 'できたもの');
  on(frame.back, 'click', () => { if (active) onBack(); });
  on(listen, 'click', () => {
    const state = getSnapshot();
    if (active && state.phase === 'answering' && state.problem?.speech) Speech.speakEnglish(state.problem.speech);
  });
  on(showText, 'click', () => {
    const state = getSnapshot();
    if (active && state.phase === 'answering') {
      textShown = true; transcript.hidden = false; showText.hidden = true;
    }
  });
  on(next, 'click', () => {
    const state = getSnapshot();
    if (active && state.phase === 'feedback') dispatch({ type: 'next', payload: {
      sessionId: state.sessionId, problemId: state.problem?.problemId } });
  });
  wrap.append(top, art, question, transcript, tools, options, feedback, next, collection);
  world.append(wrap);
  dock.append(el('p', 'ya-dock-note', config.intro));
  doc.body.append(root);
  return {
    root,
    focusPlay() { (gameId === 'englishRadio' ? listen : buttons[0]).focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      progress.textContent = `${Math.min(state.round + 1, state.rounds)}/${state.rounds}`;
      const key = `${state.round}:${state.phase}`;
      if (key !== shownKey) {
        shownKey = key;
        const problem = state.problem;
        if (problem) {
          question.textContent = problem.prompt;
          if (gameId === 'englishRoom') {
            const [object, furniture] = problem.visual.split(' ');
            roomObject.textContent = object;
            artText.textContent = furniture;
            art.dataset.position = state.phase === 'feedback'
              ? (problem.correctChoiceId.includes(' 上') ? '上' : problem.correctChoiceId.includes(' 中') ? '中' : '下') : 'まえ';
          } else { roomObject.textContent = ''; artText.textContent = problem.visual; }
          art.dataset.filled = String(state.phase === 'feedback');
          artResult.textContent = state.phase === 'feedback'
            ? (gameId === 'replyCafe' || gameId === 'wonderLab' || gameId === 'lifeCycle' ||
                gameId === 'mapTown' || gameId === 'shapeMosaic' || gameId === 'englishRoom')
              ? problem.correctChoiceId : 'できた！'
            : '';
          buttons.forEach((button, index) => {
            const choice = problem.choices[index];
            button.hidden = !choice;
            if (choice) { button.textContent = choice.text; button.dataset.choiceId = choice.choiceId; }
          });
          if (state.phase === 'answering') textShown = false;
          const audioUsable = Speech.isSupported() && Speech.isEnabled();
          listen.hidden = !needsSpeech.has(gameId) || !audioUsable || !problem.speech || state.phase !== 'answering';
          showText.hidden = gameId !== 'englishRadio' || !audioUsable || textShown || state.phase !== 'answering';
          transcript.textContent = problem.speech || '';
          transcript.hidden = gameId !== 'englishRadio' || (audioUsable && !textShown && state.phase === 'answering');
          if (gameId === 'englishRadio' && state.phase === 'answering') question.textContent = audioUsable ? problem.prompt : `${problem.speech}　— ${problem.prompt}`;
          feedback.textContent = state.phase === 'feedback' ? problem.explain : '';
          buttons.forEach(button => { button.disabled = state.phase !== 'answering'; });
          next.textContent = state.round + 1 === state.rounds ? 'できたものを見る' : 'つぎへ';
        } else {
          question.textContent = state.phase === 'completed' ? 'いっしょに 完成したよ！' : config.intro;
          artText.textContent = state.phase === 'completed' ? '✦ ✦ ✦' : '✦';
          roomObject.textContent = ''; artResult.textContent = ''; art.dataset.filled = 'false';
          feedback.textContent = ''; transcript.hidden = true; listen.hidden = true; showText.hidden = true;
        }
      }
      options.hidden = state.phase !== 'answering';
      next.hidden = state.phase !== 'feedback';
      tools.hidden = listen.hidden && showText.hidden;
      if (state.artifacts.length !== shownCollection) {
        shownCollection = state.artifacts.length;
        collection.textContent = '';
        for (let index = 0; index < state.rounds; index++) {
          const item = state.artifacts[index];
          const mark = gameId === 'shapeMosaic' && item
            ? ['▲', '■', '●', '▭', '▲', '●'][index] : item ?? '·';
          collection.append(el('span', '', mark));
        }
      }
    },
    present(play, dt, state) {
      frame.tick(dt);
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: state.answered / state.rounds,
        progressLabel: `${state.answered}/${state.rounds}`, life: null, gaugeValue: play.gauge });
    },
    stopInput() { active = false; [...buttons, listen, showText, next].forEach(node => { node.disabled = true; }); Speech.cancel(); },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
