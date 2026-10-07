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
.be-art-outcome{position:relative;z-index:2;display:none;max-width:88%;padding:5px 12px;border-radius:12px;background:#fffef4;color:#194c56;font-size:clamp(15px,2.4vw,23px);font-weight:900;line-height:1.25}
.be-art[data-filled=true] .be-art-outcome{display:block;animation:be-arrive .3s ease-out}
@keyframes be-arrive{from{opacity:0;transform:translateY(12px) scale(.92)}to{opacity:1;transform:translateY(0) scale(1)}}
.be-question{max-width:660px;margin:0;font-size:clamp(18px,3vw,27px);font-weight:900;line-height:1.3}
.be-transcript{margin:0;padding:4px 12px;border-radius:8px;background:#fff;max-width:100%;font-size:clamp(17px,2.5vw,23px);font-weight:800;overflow-wrap:anywhere}
.be-tools{display:flex;justify-content:center;gap:8px;min-height:35px}
.be-tools button,.be-next{min-height:38px;padding:4px 14px;border:2px solid #416079;border-radius:12px;background:#fff;color:#20364c;font:inherit;font-size:clamp(14px,2vw,18px);font-weight:900;cursor:pointer;touch-action:manipulation}
.be-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;width:min(100%,660px)}
.be-option{min-width:0;min-height:65px;padding:6px 5px;border:3px solid #416079;border-radius:16px;background:#fff;color:#20364c;font:inherit;font-size:clamp(16px,2.4vw,22px);font-weight:900;line-height:1.25;cursor:pointer;touch-action:manipulation;overflow-wrap:anywhere;box-shadow:0 4px 0 #41607955}
.be-option:focus-visible,.be-tools button:focus-visible,.be-next:focus-visible,.be-place-target:focus-visible{outline:4px solid #f4a000;outline-offset:2px}
.be-option:disabled{opacity:.6;cursor:default}
.be-feedback{max-width:660px;min-height:1.5em;margin:0;font-size:clamp(14px,2vw,18px);font-weight:800;line-height:1.3}
.be-next{background:#245d70;color:#fff;border-color:#245d70;min-height:44px;padding:6px 22px}
.be-collection{display:flex;justify-content:center;gap:5px;flex-wrap:wrap;width:min(100%,660px);min-height:29px}
.be-collection span{display:grid;place-items:center;min-width:34px;min-height:28px;padding:1px 5px;border-radius:8px;background:#fff9;color:#1d4355;font-size:clamp(14px,2vw,21px);font-weight:800}
.be-trials{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;width:min(100%,660px)}
.be-trials button{min-height:48px;padding:6px 12px;border:3px solid #347b87;border-radius:14px;background:#effdfa;color:#20364c;font:inherit;font-weight:900;cursor:pointer}
.be-trials button[data-seen=true]{background:#d4f3e7}
.be-trials button:focus-visible{outline:4px solid #f4a000;outline-offset:2px}
.be-observation{max-width:660px;min-height:2.6em;margin:0;font-size:clamp(15px,2vw,19px);font-weight:800;line-height:1.35}
#abcPostScreen .be-art{z-index:1;overflow:visible;background:linear-gradient(#ffe9ad,#fff8df)}
#abcPostScreen .be-art-text{cursor:grab;touch-action:none;user-select:none}
#abcPostScreen .be-art-text[data-dragging=true]{cursor:grabbing;transition:none}
#abcPostScreen .be-art-outcome{margin-bottom:4px;font-size:clamp(14px,2vw,18px)}
#abcPostScreen .be-option{background:#fff4d0;border-radius:22px 22px 9px 9px;min-height:80px;font-size:clamp(25px,4vw,34px)}
#abcPostScreen .be-option::before{content:'📮';display:block;font-size:clamp(22px,3vw,29px);line-height:1}
#abcPostScreen .be-collection{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));width:min(100%,300px)}
#abcPostScreen .be-collection span{min-width:0;background:#fff3cf;border:2px solid #c88943}
#englishRadioScreen .be-art{background:radial-gradient(circle,#f7e6ff,#d4d9ff)}#englishRadioScreen .be-art::after{content:'♪ 〜 ♪';position:absolute;right:7%;top:12%;font-size:28px;color:#805aa3}
#replyCafeScreen .be-art{min-height:158px;display:flex;flex-direction:column;justify-content:center;gap:8px;padding:9px 15px 9px 65px;background:linear-gradient(#fff0d5,#efd1ac)}
#replyCafeScreen .be-art-text{position:absolute;left:10px;bottom:9px;font-size:38px}
#replyCafeScreen .be-art[data-filled=true] .be-art-text{transform:none}
#replyCafeScreen .be-art-outcome{display:none}
.be-cafe-partner,.be-cafe-reply{max-width:95%;padding:7px 12px;border:2px solid #8b664c;border-radius:17px;background:#fffaf0;font-size:clamp(16px,2.6vw,23px);font-weight:900;line-height:1.25;overflow-wrap:anywhere}
.be-cafe-partner{align-self:flex-start}
.be-cafe-reply{align-self:flex-end;border-style:dashed;background:#fff}
#replyCafeScreen .be-art[data-filled=true] .be-cafe-reply{border-style:solid;border-color:#438275;background:#e7fff3;animation:be-arrive .3s ease-out}
#replyCafeScreen .be-option{border-radius:22px;background:#fffaf1;cursor:grab;touch-action:none;user-select:none}
#replyCafeScreen .be-option[data-dragging=true]{cursor:grabbing;transition:none;position:relative;z-index:3}
#englishRoomScreen .be-art{min-height:205px;background:linear-gradient(#e4f6ff 64%,#c9a579 65%)}
#englishRoomScreen .be-art-text{position:absolute;left:33%;top:51%;font-size:clamp(43px,7vw,66px);transform:translate(-50%,-50%)}
#englishRoomScreen .be-art[data-filled=true] .be-art-text{transform:translate(-50%,-50%) scale(1.05)}
#englishRoomScreen .be-room-object{position:absolute;z-index:2;left:12%;top:43%;font-size:clamp(33px,6vw,52px);transition:left .35s,top .35s}
#englishRoomScreen .be-art[data-position=上] .be-room-object{left:30%;top:2%}
#englishRoomScreen .be-art[data-position=中] .be-room-object{left:30%;top:40%}
#englishRoomScreen .be-art[data-position=下] .be-room-object{left:30%;top:73%}
#englishRoomScreen .be-art-outcome{position:absolute;right:3%;bottom:5%;font-size:15px}
.be-room-zone{position:absolute;right:3%;width:35%;height:28%;min-height:46px;border:3px dashed #31768e;border-radius:12px;background:#f6fdff;color:#1b4c63;font:inherit;font-size:clamp(16px,2.3vw,21px);font-weight:900;cursor:pointer;touch-action:manipulation}
.be-room-zone[data-position=上]{top:4%}.be-room-zone[data-position=中]{top:36%}.be-room-zone[data-position=下]{top:68%}
.be-room-zone:focus-visible{outline:4px solid #f4a000;outline-offset:2px}
.be-room-hint{max-width:660px;margin:0;padding:4px 10px;border-radius:9px;background:#fffef0;font-size:clamp(14px,2vw,18px);font-weight:800}
#wonderLabScreen .be-art{background:radial-gradient(circle at 50% 72%,#bdfff4,#ecf7ff)}#wonderLabScreen .be-art::after{content:'✦ ✧ ✦';position:absolute;top:10%;right:12%;color:#347ba1}
#wonderLabScreen .be-art[data-filled=true] .be-art-text{animation:be-arrive .45s ease-out}
#wonderLabScreen .be-art-outcome{position:absolute;bottom:4px;left:50%;transform:translateX(-50%);width:max-content;max-width:95%;font-size:clamp(13px,2vw,18px)}
#wonderLabScreen .be-art[data-filled=true] .be-art-outcome{display:block}
#lifeCycleScreen .be-art{background:linear-gradient(#e6f9d8,#bfe6a8)}
#lifeCycleScreen .be-art-text{padding:8px 20px;border:3px dashed #5b945e;border-radius:18px;background:#fffdf0}
#lifeCycleScreen .be-options{position:relative;margin-top:12px}
#lifeCycleScreen .be-options::before{content:'つぎの すがたを つなごう';position:absolute;bottom:100%;left:0;width:100%;font-size:clamp(13px,1.8vw,17px);font-weight:900;color:#285e3b}
#lifeCycleScreen .be-option{border-color:#4c8557;border-radius:50% 50% 18px 18px;background:#f6ffe8;box-shadow:0 4px 0 #4c855755}
#lifeCycleScreen .be-collection{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;width:min(100%,440px)}
#lifeCycleScreen .be-collection span{min-height:35px;border:2px solid #89b98a;border-radius:12px;background:#f5ffeb;font-size:clamp(14px,2vw,18px)}
#mapTownScreen .be-art{background:linear-gradient(90deg,#e2edd8 49%,#c7dfd0 50%)}#mapTownScreen .be-collection span{background:#f4f0da}
#shapeMosaicScreen .be-art{background:repeating-linear-gradient(45deg,#edf4ff 0 16px,#dfeaf9 16px 32px);grid-template-columns:1fr 1fr}
#shapeMosaicScreen .be-art-text{font-size:clamp(42px,7vw,68px)}
#shapeMosaicScreen .be-room-object{display:none}
#shapeMosaicScreen .be-art-outcome{position:absolute;right:3%;bottom:6%;font-size:clamp(15px,2vw,19px)}
#shapeMosaicScreen .be-option{background:#e9f5ff;border-radius:8px;min-height:74px}
#shapeMosaicScreen .be-option[data-selected=true]{background:#ffe9ac;border-color:#b26829;transform:translateY(-3px)}
.be-place-target{min-width:105px;min-height:74px;margin:6px;border:3px dashed #4169a5;border-radius:12px;background:#fffcf0;color:#294c78;font:inherit;font-size:clamp(15px,2.2vw,20px);font-weight:900;cursor:pointer;touch-action:manipulation}
.be-place-target:disabled{opacity:.8;cursor:default}
#mapTownScreen .be-collection,#shapeMosaicScreen .be-collection{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;width:min(240px,70%);padding:4px;border:2px solid #416079;border-radius:10px;background:#d3e3d3}
#mapTownScreen .be-collection span,#shapeMosaicScreen .be-collection span{min-height:31px;background:#fffefa}
#mapTownScreen .be-collection button{min-height:42px;border:1px solid #416079;border-radius:5px;background:#fffefa;color:#1d4355;font:inherit;font-size:clamp(15px,2vw,21px);font-weight:800;cursor:pointer}
#mapTownScreen .be-collection button:focus-visible{outline:4px solid #f4a000;outline-offset:2px}
#mapTownScreen .be-collection button:disabled{cursor:default}
#shapeMosaicScreen .be-collection{background:#dce9ff}#shapeMosaicScreen .be-collection span{color:#476fc0}
@media(max-width:520px){.be-wrap{inset:48px 2% 3px;gap:5px}.be-art{min-height:80px}.be-options{gap:5px}.be-option{min-height:60px;padding:4px 2px;font-size:clamp(14px,3.8vw,18px)}.be-collection span{min-width:27px}.be-place-target{min-width:90px;min-height:62px}}
@media(max-width:520px){#englishRoomScreen .be-art[data-position=上] .be-room-object{top:12%}}
`;

const needsSpeech = new Set(['englishRadio', 'replyCafe', 'englishRoom']);
// The prediction is the learning answer. Trying conditions afterwards changes
// only the observation, so no extra learning outcome is written.
const LAB_TRIALS = Object.freeze([
  [{ label: 'じしゃくを 近づける', result: 'くぎが くっついた！', visual: '🧲 ✨ 🔩' }, { label: 'じしゃくを 離す', result: 'くぎは そのまま。', visual: '🧲　　🔩' }],
  [{ label: '水を まぜる', result: '食塩が 水に とけて 見えにくくなった！', visual: '🧂 ↻ 💧' }, { label: 'そのまま 観察', result: '食塩は ゆっくり とけていく。', visual: '🧂 → 💧' }],
  [{ label: '十分に 冷やす', result: '水が こおりに なった！', visual: '💧 → 🧊' }, { label: 'そのまま 置く', result: '水の ままだね。', visual: '💧' }],
  [{ label: '風を 当てる', result: '風車が まわった！', visual: '🌬️ → 🎡' }, { label: '風を とめる', result: '風車は とまった。', visual: '🎡' }],
  [{ label: '虫めがねで 見る', result: '小さな 文字が 大きく 見える！', visual: '🔍 → Ａ' }, { label: 'そのまま 見る', result: '文字の 大きさは そのまま。', visual: '📖' }],
  [{ label: '水に 入れる', result: 'こおりが 水に ういた！', visual: '🧊 ↑ 💧' }, { label: '机に 置く', result: '机の 上に のっている。', visual: '🧊 ▰' }],
]);
const MAP_SYMBOLS = Object.freeze(['文', '〒', '＋', '📖', '文', '〒']);

export function createBalancedView(gameId, { document: doc, dispatch, getSnapshot, onBack }) {
  const config = NEW_GAME_CONTENT[gameId];
  if (!config) throw new Error('Unknown balanced mini game view');
  let active = true, shownKey = '', shownCollection = -1, textShown = false, roomHintShown = false;
  let selectedShapeChoiceId = null, postDragId = null, postDragStart = null;
  const labSeen = new Set();
  let labRound = -1, labAction = null;
  const prepareLabRound = round => {
    if (labRound === round) return;
    labRound = round;
    labSeen.clear();
    labAction = null;
  };
  const townPlacedRounds = new Set(), townLots = Array(6).fill(null);
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
  const artResult = el('span', 'be-art-outcome');
  const cafePartner = el('span', 'be-cafe-partner');
  const cafeReply = el('span', 'be-cafe-reply');
  cafePartner.hidden = gameId !== 'replyCafe'; cafeReply.hidden = gameId !== 'replyCafe';
  const shapePlace = el('button', 'be-place-target', '？ ここに はめる');
  shapePlace.type = 'button'; shapePlace.dataset.action = 'place-shape';
  shapePlace.hidden = gameId !== 'shapeMosaic'; shapePlace.disabled = true;
  art.append(artText, roomObject, artResult, cafePartner, cafeReply, shapePlace);
  const question = el('h2', 'be-question');
  const transcript = el('p', 'be-transcript');
  const tools = el('div', 'be-tools');
  const listen = el('button', '', '🔊 きく'); listen.type = 'button'; listen.dataset.action = 'listen';
  const showText = el('button', '', '文字で見る'); showText.type = 'button'; showText.dataset.action = 'show-text';
  const roomHint = el('button', '', 'ことばの ヒント'); roomHint.type = 'button'; roomHint.dataset.action = 'room-hint';
  roomHint.hidden = true; roomHint.setAttribute('aria-expanded', 'false');
  const roomHintText = el('p', 'be-room-hint', 'on は 上、in は 中、under は 下。');
  roomHintText.hidden = true;
  tools.append(listen, showText, roomHint);
  const options = el('div', 'be-options');
  if (gameId === 'abcPost') options.setAttribute('aria-label', '小文字の ポストを えらぶ');
  if (gameId === 'lifeCycle') options.setAttribute('aria-label', 'つぎの すがたを えらぶ');
  if (gameId === 'shapeMosaic') options.setAttribute('aria-label', '形の タイルを えらぶ');
  if (gameId === 'replyCafe') options.setAttribute('aria-label', '返事を タップするか、会話の絵へ とどける');
  const answerChoice = choiceId => {
    const state = getSnapshot();
    if (!active || state.paused || state.phase !== 'answering' ||
        !state.problem?.choices.some(choice => choice.choiceId === choiceId)) return false;
    return dispatch({ type: 'answer', payload: {
      sessionId: state.sessionId, attemptId: state.attemptId, choiceId } });
  };
  const buttons = Array.from({ length: 3 }, () => {
    const button = el('button', 'be-option'); button.type = 'button'; options.append(button);
    on(button, 'click', () => {
      const state = getSnapshot();
      if (gameId === 'replyCafe' && button.dataset.dragged === 'true') {
        button.dataset.dragged = 'false'; return;
      }
      if (!active || state.paused || state.phase !== 'answering') return;
      if (gameId === 'shapeMosaic') {
        selectedShapeChoiceId = button.dataset.choiceId;
        buttons.forEach(tile => { tile.dataset.selected = String(tile === button); });
        shapePlace.textContent = `${selectedShapeChoiceId.split(' ')[0]} ここに はめる`;
        shapePlace.setAttribute('aria-label', `${selectedShapeChoiceId}の タイルを ここに はめる`);
        shapePlace.disabled = false;
        shapePlace.focus({ preventScroll: true });
        return;
      }
      answerChoice(button.dataset.choiceId);
    });
    return button;
  });
  const roomZones = gameId === 'englishRoom' ? ['上', '中', '下'].map(position => {
    const zone = el('button', 'be-room-zone', `${position}に おく`);
    zone.type = 'button'; zone.dataset.position = position; zone.hidden = true;
    art.append(zone);
    on(zone, 'click', () => { answerChoice(zone.dataset.choiceId); });
    return zone;
  }) : [];
  if (gameId === 'replyCafe') buttons.forEach(button => {
    let pointerId = null, start = null;
    on(button, 'pointerdown', event => {
      const state = getSnapshot();
      if (!active || state.paused || state.phase !== 'answering' || !event.isPrimary || event.button !== 0) return;
      pointerId = event.pointerId;
      start = { x: event.clientX, y: event.clientY };
      button.dataset.dragged = 'false';
      button.setPointerCapture(pointerId);
    });
    on(button, 'pointermove', event => {
      if (event.pointerId !== pointerId || !start) return;
      const dx = event.clientX - start.x, dy = event.clientY - start.y;
      if (!button.dataset.dragging && Math.hypot(dx, dy) < 8) return;
      button.dataset.dragging = 'true';
      button.dataset.dragged = 'true';
      button.style.transform = `translate(${dx}px,${dy}px)`;
    });
    const finish = event => {
      if (event.pointerId !== pointerId) return;
      const wasDragging = button.dataset.dragging === 'true';
      pointerId = null; start = null;
      button.dataset.dragging = 'false';
      button.style.transform = '';
      if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
      if (event.type !== 'pointerup' || !wasDragging) return;
      const target = art.getBoundingClientRect();
      if (event.clientX >= target.left && event.clientX <= target.right &&
          event.clientY >= target.top && event.clientY <= target.bottom) answerChoice(button.dataset.choiceId);
    };
    on(button, 'pointerup', finish);
    on(button, 'pointercancel', finish);
  });
  on(shapePlace, 'click', () => {
    const state = getSnapshot();
    if (!active || state.paused || state.phase !== 'answering' || !selectedShapeChoiceId ||
        !state.problem?.choices.some(choice => choice.choiceId === selectedShapeChoiceId)) return;
    answerChoice(selectedShapeChoiceId);
  });
  if (gameId === 'abcPost') {
    on(artText, 'pointerdown', event => {
      const state = getSnapshot();
      if (!active || state.paused || state.phase !== 'answering' || !event.isPrimary || event.button !== 0) return;
      postDragId = event.pointerId;
      postDragStart = { x: event.clientX, y: event.clientY };
      artText.dataset.dragging = 'true';
      artText.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    on(artText, 'pointermove', event => {
      if (event.pointerId !== postDragId || !postDragStart) return;
      artText.style.transform = `translate(${event.clientX - postDragStart.x}px,${event.clientY - postDragStart.y}px)`;
    });
    const finishPostDrag = event => {
      if (event.pointerId !== postDragId) return;
      postDragId = null; postDragStart = null;
      artText.dataset.dragging = 'false';
      artText.style.transform = '';
      if (artText.hasPointerCapture(event.pointerId)) artText.releasePointerCapture(event.pointerId);
      if (event.type !== 'pointerup') return;
      artText.style.pointerEvents = 'none';
      const target = doc.elementFromPoint(event.clientX, event.clientY)?.closest('.be-option');
      artText.style.pointerEvents = '';
      if (target && options.contains(target)) answerChoice(target.dataset.choiceId);
    };
    on(artText, 'pointerup', finishPostDrag);
    on(artText, 'pointercancel', finishPostDrag);
  }
  const feedback = el('p', 'be-feedback'); feedback.setAttribute('role', 'status');
  const next = el('button', 'be-next', 'つぎへ'); next.type = 'button'; next.dataset.action = 'next';
  const trials = el('div', 'be-trials'); trials.setAttribute('aria-label', '条件をかえて実験する');
  const observation = el('p', 'be-observation'); observation.setAttribute('role', 'status');
  const trialButtons = gameId === 'wonderLab' ? Array.from({ length: 2 }, (_, index) => {
    const trial = el('button'); trial.type = 'button'; trials.append(trial);
    on(trial, 'click', () => {
      const state = getSnapshot();
      if (!active || state.paused || state.phase !== 'feedback') return;
      prepareLabRound(state.round);
      const action = LAB_TRIALS[state.round]?.[index];
      if (!action) return;
      labSeen.add(index);
      labAction = action;
      artText.textContent = action.visual;
      art.dataset.filled = 'true';
      artResult.textContent = action.result;
      trial.dataset.seen = 'true';
      observation.textContent = labSeen.size === 2
        ? `${action.result} 2つの 条件を くらべたよ。 ${state.problem.explain}`
        : `${action.result} もう一つも ためして、ちがいを くらべよう。`;
      next.hidden = labSeen.size < 2;
      if (labSeen.size === 2) next.focus({ preventScroll: true });
    });
    return trial;
  }) : [];
  const collection = el('div', 'be-collection'); collection.setAttribute('aria-label', 'できたもの');
  const townButtons = gameId === 'mapTown' ? Array.from({ length: 6 }, (_, index) => {
    const lot = el('button', '', '·'); lot.type = 'button';
    lot.setAttribute('aria-label', `${index + 1}番の 区画に 建物を おく`);
    collection.append(lot);
    on(lot, 'click', () => {
      const state = getSnapshot();
      if (!active || state.paused || state.phase !== 'feedback' || townPlacedRounds.has(state.round) || townLots[index]) return;
      townLots[index] = MAP_SYMBOLS[state.round] ?? state.problem.visual;
      townPlacedRounds.add(state.round);
      lot.textContent = townLots[index];
      lot.disabled = true;
      lot.setAttribute('aria-label', `${index + 1}番の 区画: ${state.problem.correctChoiceId}`);
      feedback.textContent = `町の 地図に おいたよ。 ${state.problem.explain}`;
      next.hidden = false;
      next.focus({ preventScroll: true });
    });
    return lot;
  }) : [];
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
  on(roomHint, 'click', () => {
    const state = getSnapshot();
    if (!active || state.paused || state.phase !== 'answering' || gameId !== 'englishRoom') return;
    roomHintShown = !roomHintShown;
    roomHintText.hidden = !roomHintShown;
    roomHint.setAttribute('aria-expanded', String(roomHintShown));
  });
  on(next, 'click', () => {
    const state = getSnapshot();
    if (active && state.phase === 'feedback' && (gameId !== 'wonderLab' || labSeen.size === 2) &&
        (gameId !== 'mapTown' || townPlacedRounds.has(state.round))) dispatch({ type: 'next', payload: {
      sessionId: state.sessionId, problemId: state.problem?.problemId } });
  });
  wrap.append(top, art, question, transcript, tools, roomHintText, options, trials, observation, feedback, next, collection);
  world.append(wrap);
  dock.append(el('p', 'ya-dock-note', config.intro));
  doc.body.append(root);
  return {
    root,
    focusPlay() { (gameId === 'englishRadio' ? listen : gameId === 'englishRoom' ? roomZones[0] : buttons[0]).focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      progress.textContent = `${Math.min(state.round + 1, state.rounds)}/${state.rounds}`;
      if (gameId === 'wonderLab') prepareLabRound(state.round);
      const key = `${state.round}:${state.phase}`;
      if (key !== shownKey) {
        shownKey = key;
        if (gameId === 'abcPost') {
          postDragId = null; postDragStart = null;
          artText.dataset.dragging = 'false';
          artText.style.transform = '';
        }
        if (gameId === 'replyCafe') buttons.forEach(button => {
          button.dataset.dragging = 'false'; button.style.transform = '';
        });
        if (gameId === 'shapeMosaic' && state.phase === 'answering') {
          selectedShapeChoiceId = null;
          shapePlace.textContent = '？ ここに はめる';
          shapePlace.setAttribute('aria-label', 'タイルを えらんで ここに はめる');
          shapePlace.disabled = true;
          buttons.forEach(button => { button.dataset.selected = 'false'; });
        }
        const problem = state.problem;
        if (problem) {
          if (gameId === 'wonderLab') {
            if (!labSeen.size) observation.textContent = state.phase === 'feedback' ? '予想したら、2つの 条件を ためして くらべよう。' : '';
            trialButtons.forEach((trial, index) => {
              trial.textContent = LAB_TRIALS[state.round][index].label;
              trial.dataset.seen = String(labSeen.has(index));
            });
          }
          question.textContent = gameId === 'replyCafe' ? 'ゴトモンに なんて かえす？' : problem.prompt;
          cafePartner.hidden = gameId !== 'replyCafe'; cafeReply.hidden = gameId !== 'replyCafe';
          if (gameId === 'replyCafe') {
            cafePartner.textContent = `ゴトモン: ${problem.speech}`;
            cafeReply.textContent = state.phase === 'feedback' ? problem.correctChoiceId : 'ここへ 返事を とどけよう';
          }
          if (gameId === 'englishRoom') {
            const [object, furniture] = problem.visual.split(' ');
            roomObject.textContent = object;
            artText.textContent = furniture;
            art.dataset.position = state.phase === 'feedback'
              ? (problem.correctChoiceId.includes(' 上') ? '上' : problem.correctChoiceId.includes(' 中') ? '中' : '下') : 'まえ';
          } else {
            roomObject.textContent = '';
            artText.textContent = gameId === 'wonderLab' && state.phase === 'feedback' && labAction ? labAction.visual
              : gameId === 'abcPost' && state.phase === 'feedback'
                ? `${problem.visual} → 📮 ${problem.correctChoiceId}`
              : gameId === 'lifeCycle' && state.phase === 'feedback'
                ? problem.visual.replace('？', problem.correctChoiceId.split(' ')[0]) : problem.visual;
          }
          art.dataset.filled = String(state.phase === 'feedback' && (gameId !== 'wonderLab' || !!labAction));
          artResult.textContent = state.phase === 'feedback'
            ? gameId === 'wonderLab' ? labAction?.result ?? ''
              : gameId === 'abcPost' ? `${problem.correctChoiceId} に とどいたよ`
              : (gameId === 'replyCafe' || gameId === 'lifeCycle' ||
                gameId === 'mapTown' || gameId === 'shapeMosaic' || gameId === 'englishRoom')
              ? problem.correctChoiceId : 'できた！'
            : '';
          buttons.forEach((button, index) => {
            const choice = problem.choices[index];
            button.hidden = !choice;
            if (choice) { button.textContent = choice.text; button.dataset.choiceId = choice.choiceId; }
          });
          roomZones.forEach(zone => {
            const choice = problem.choices.find(item => item.choiceId.endsWith(` ${zone.dataset.position}`));
            zone.dataset.choiceId = choice?.choiceId ?? '';
            zone.setAttribute('aria-label', choice?.text ?? `${zone.dataset.position}に おく`);
          });
          if (state.phase === 'answering') {
            textShown = false; roomHintShown = false;
            roomHint.setAttribute('aria-expanded', 'false');
          }
          const audioUsable = Speech.isSupported() && Speech.isEnabled();
          listen.hidden = !needsSpeech.has(gameId) || !audioUsable || !problem.speech || state.phase !== 'answering';
          showText.hidden = gameId !== 'englishRadio' || !audioUsable || textShown || state.phase !== 'answering';
          roomHint.hidden = gameId !== 'englishRoom' || state.phase !== 'answering';
          transcript.textContent = problem.speech || '';
          transcript.hidden = gameId !== 'englishRadio' || (audioUsable && !textShown && state.phase === 'answering');
          if (gameId === 'englishRadio' && state.phase === 'answering') question.textContent = audioUsable ? problem.prompt : `${problem.speech}　— ${problem.prompt}`;
          feedback.textContent = state.phase === 'feedback' && gameId === 'mapTown'
            ? townPlacedRounds.has(state.round) ? `町の 地図に おいたよ。 ${problem.explain}`
              : '町の 地図で、建物を おく 場所を えらぼう。'
            : state.phase === 'feedback' && gameId !== 'wonderLab' ? problem.explain : '';
          buttons.forEach(button => { button.disabled = state.phase !== 'answering'; });
          next.textContent = state.round + 1 === state.rounds ? 'できたものを見る' : 'つぎへ';
        } else {
          question.textContent = state.phase === 'completed' ? 'いっしょに 完成したよ！' : config.intro;
          artText.textContent = state.phase === 'completed' ? '✦ ✦ ✦' : '✦';
          roomObject.textContent = ''; artResult.textContent = ''; art.dataset.filled = 'false';
          cafePartner.hidden = true; cafeReply.hidden = true;
          feedback.textContent = ''; transcript.hidden = true; listen.hidden = true; showText.hidden = true; roomHint.hidden = true;
        }
      }
      options.hidden = gameId === 'englishRoom' || state.phase !== 'answering';
      roomZones.forEach(zone => {
        zone.hidden = state.phase !== 'answering' || !zone.dataset.choiceId;
        zone.disabled = state.phase !== 'answering';
      });
      shapePlace.hidden = gameId !== 'shapeMosaic' || state.phase !== 'answering';
      trials.hidden = gameId !== 'wonderLab' || state.phase !== 'feedback';
      observation.hidden = trials.hidden;
      next.hidden = state.phase !== 'feedback' || (gameId === 'wonderLab' && labSeen.size < 2) ||
        (gameId === 'mapTown' && !townPlacedRounds.has(state.round));
      roomHintText.hidden = gameId !== 'englishRoom' || state.phase !== 'answering' || !roomHintShown;
      tools.hidden = listen.hidden && showText.hidden && roomHint.hidden;
      if (gameId !== 'mapTown' && state.artifacts.length !== shownCollection) {
        shownCollection = state.artifacts.length;
        collection.textContent = '';
        for (let index = 0; index < state.rounds; index++) {
          const item = state.artifacts[index];
          const mark = gameId === 'shapeMosaic' && item
            ? ['▲', '■', '●', '▭', '▲', '●'][index]
            : gameId === 'abcPost' && item
              ? `${config.rounds[index].visual.split(' ')[1]} → ${config.rounds[index].correct}`
            : gameId === 'lifeCycle' && item
              ? item.replace('？', config.rounds[index].correct.split(' ')[0]) : item ?? '·';
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
    stopInput() { active = false; postDragId = null; artText.style.transform = ''; [...buttons, ...roomZones, ...trialButtons, ...townButtons, shapePlace, listen, showText, roomHint, next].forEach(node => { node.disabled = true; }); Speech.cancel(); },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
