import { createArcadeFrame, restartClass } from '../arcade/arcadeKit.js';
import { FISH_SWIMMERS } from './fishContent.js';
import Speech from '../../audio/speech.js';

// Where the fishing line starts (the boat), in field percent.
const BOAT = Object.freeze({ x: 50, y: 24 });
const CSS = `
#gotomonFishingScreen .ya-field{background:linear-gradient(#bfe6ff 0 26%,#7fc8ec 26% 27%,#4aa3d6 27%,#2f7fb8 70%,#235f93)}
#gotomonFishingScreen .fs-boat{position:absolute;left:50%;top:9%;z-index:4;width:clamp(120px,18vw,180px);height:clamp(64px,9vw,92px);transform:translateX(-50%);pointer-events:none}
#gotomonFishingScreen .fs-boat::after{content:'';position:absolute;left:0;right:0;bottom:0;height:42%;border-radius:0 0 50% 50%/0 0 100% 100%;background:linear-gradient(#b5752c,#7a4a1a);box-shadow:0 3px 0 #5a3410}
#gotomonFishingScreen .fs-buddy{position:absolute;left:50%;bottom:26%;width:clamp(52px,7vw,72px);height:clamp(52px,7vw,72px);transform:translateX(-50%)}
#gotomonFishingScreen .fs-buddy .gt-portrait{display:block;width:100%;height:100%;background:none;border:0}
#gotomonFishingScreen .fs-buddy .gt-portrait img{width:100%;height:100%;object-fit:contain}
#gotomonFishingScreen .fs-wave{position:absolute;left:0;right:0;top:26%;height:10px;background:radial-gradient(circle at 10px -2px,transparent 9px,#bfe6ff 10px) 0 0/20px 10px repeat-x;pointer-events:none}
#gotomonFishingScreen .fs-swimmer{position:absolute;z-index:3;display:flex;flex-direction:column;align-items:center;padding:0;border:0;background:none;font:inherit;color:#1b2a36;transform:translate(-50%,-50%);cursor:pointer;touch-action:manipulation}
#gotomonFishingScreen .fs-swimmer:disabled{cursor:default}
#gotomonFishingScreen .fs-swimmer:focus-visible{outline:3px solid #ffd54a;outline-offset:4px;border-radius:14px}
#gotomonFishingScreen .fs-plate{max-width:clamp(96px,16vw,170px);padding:4px 10px;border-radius:10px;background:#fffdf6;border:3px solid #1f5f8a;box-shadow:0 3px 0 #0f3a57;font-size:clamp(15px,min(2.2vw,3vh),22px);font-weight:900;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#gotomonFishingScreen .fs-swimmer[data-kind=ja2en] .fs-plate{font-family:ui-rounded,'Segoe UI',system-ui,sans-serif;letter-spacing:.02em}
#gotomonFishingScreen .fs-swimmer img{width:clamp(44px,min(8vw,10vh),84px);height:clamp(44px,min(8vw,10vh),84px);object-fit:contain;margin-top:-2px;filter:drop-shadow(0 4px 3px #0004)}
#gotomonFishingScreen .fs-swimmer[data-dir='-1'] img{transform:scaleX(-1)}
#gotomonFishingScreen .fs-swimmer[data-hint=true] .fs-plate{border-color:#37c871;box-shadow:0 3px 0 #1f9d55,0 0 0 5px #37c871aa;animation:fs-glow .7s ease-in-out infinite alternate}
#gotomonFishingScreen .fs-swimmer.fs-caught{animation:fs-caught .6s ease-out}
#gotomonFishingScreen .fs-swimmer.fs-away img{animation:fs-away .5s ease-out}
#gotomonFishingScreen .fs-swimmer.fs-new .fs-plate{animation:fs-new .3s ease-out}
#gotomonFishingScreen .fs-kind{margin:0;text-align:center;font-size:15px;font-weight:900;color:#bfe6ff}
#gotomonFishingScreen .fs-ask{display:flex;align-items:center;justify-content:center;gap:10px;margin:0;padding:10px 12px;border-radius:14px;background:#ffffff14;color:#fff;text-align:center;font-size:clamp(26px,4vw,40px);font-weight:900;line-height:1.2}
#gotomonFishingScreen .fs-ask[data-kind=en2ja] .fs-prompt{font-family:ui-rounded,'Segoe UI',system-ui,sans-serif;letter-spacing:.03em}
#gotomonFishingScreen .fs-say{min-width:48px;min-height:48px;border:0;border-radius:50%;background:#ffe066;font-size:22px;cursor:pointer;touch-action:manipulation}
#gotomonFishingScreen .fs-say[hidden]{display:none}
#gotomonFishingScreen .fs-review{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}
#gotomonFishingScreen .fs-review li{padding:6px 10px;border-radius:10px;background:#eef6ef;font-weight:700}
#gotomonFishingScreen .fs-review li[data-correct=false]{background:#fff3da}
@keyframes fs-caught{0%{transform:translate(-50%,-50%)}40%{transform:translate(-50%,-120%) rotate(-8deg)}100%{transform:translate(-50%,-50%)}}
@keyframes fs-away{0%,100%{transform:none}50%{transform:translateY(12px) scale(.9)}}
@keyframes fs-new{from{transform:scale(.6)}to{transform:none}}
@keyframes fs-glow{from{transform:none}to{transform:translateY(-4px)}}
`;
const KIND_TEXT = Object.freeze({ en2ja: 'この英語の意味は？', ja2en: 'これを英語で言うと？' });

export function createFishView({ document: doc, dispatch, onBack, getSnapshot }) {
  let active = true, lastSeq = -1, lastEventId = 0, problemKey = null, doneShown = false, shownCast = 0, sayWord = '';
  const removes = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'gotomonFishingScreen', title: 'ゴトモンつり', theme: 'fishing' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });

  const wave = el('i', 'fs-wave'); world.append(wave);
  const boat = el('div', 'fs-boat'); const buddy = el('div', 'fs-buddy'); boat.append(buddy); world.append(boat);
  const swimmers = Array.from({ length: FISH_SWIMMERS }, (_, index) => {
    const node = el('button', 'fs-swimmer'); node.type = 'button'; node.dataset.index = String(index);
    const plate = el('span', 'fs-plate'), img = el('img');
    img.alt = ''; node.append(plate, img);
    on(node, 'click', () => cast(index)); world.append(node);
    return { node, plate, img, key: null, plateKey: null, dir: null, x: null };
  });

  const kind = el('p', 'fs-kind');
  const ask = el('p', 'fs-ask'); ask.dataset.role = 'problem';
  const promptText = el('span', 'fs-prompt');
  const say = el('button', 'fs-say', '🔊'); say.type = 'button'; say.setAttribute('aria-label', '英語を聞く');
  on(say, 'click', () => { if (active && sayWord) Speech.speakEnglish(sayWord); });
  ask.append(promptText, say);
  // The shell advances after feedback; this stays hidden and only serves hosts without auto-advance.
  const go = el('button', 'fs-go', 'つぎへ'); go.type = 'button'; go.dataset.action = 'next'; go.hidden = true;
  on(go, 'click', () => proceed());
  const note = el('p', 'ya-dock-note'); note.dataset.role = 'feedback';
  dock.append(kind, ask, note, go);
  const review = el('div', 'ya-learning-result'); review.hidden = true;
  const reviewList = el('ol', 'fs-review'); review.append(el('h3', '', '今回つった ことば'), reviewList); frame.shell.append(review);
  doc.body.append(root);
  const answers = [];

  const session = () => getSnapshot();
  function cast(index) {
    const state = session(), swimmer = state.swimmers?.[index];
    if (!active || state.paused || state.phase !== 'answering' || !swimmer) return false;
    return dispatch({ type: 'cast', payload: { sessionId: state.sessionId, attemptId: state.attemptId, swimmerId: swimmer.swimmerId } });
  }
  function proceed() {
    const state = session();
    if (!active || state.paused || state.phase !== 'feedback') return false;
    return dispatch({ type: 'next', payload: { sessionId: state.sessionId, problemId: state.problem?.problemId } });
  }

  // Positions move every frame; plates change only when a new problem starts.
  const renderSwimmers = state => {
    swimmers.forEach((item, index) => {
      const swimmer = state.swimmers[index];
      if (!swimmer) { item.node.hidden = true; return; }
      if (item.key !== swimmer.swimmerId) {
        item.key = swimmer.swimmerId; item.img.src = swimmer.imageUrl || ''; item.img.hidden = !swimmer.imageUrl;
        item.node.style.top = `${swimmer.y * 100}%`;
      }
      const plateKey = `${state.problem?.contentId}:${swimmer.plate?.contentId}`;
      if (swimmer.plate && item.plateKey !== plateKey) {
        item.plateKey = plateKey; item.plate.textContent = swimmer.plate.text;
        item.node.dataset.kind = state.problem?.kind ?? '';
        item.node.setAttribute('aria-label', `${swimmer.name}の ${swimmer.plate.text}`);
        restartClass(item.node, 'fs-new');
      }
      const x = `${(swimmer.x * 100).toFixed(2)}%`;
      if (item.x !== x) { item.x = x; item.node.style.left = x; }
      const dir = String(swimmer.dir);
      if (item.dir !== dir) { item.dir = dir; item.node.dataset.dir = dir; }
      const hint = String(state.phase === 'answering' && state.hintSwimmerId === swimmer.swimmerId);
      if (item.node.dataset.hint !== hint) item.node.dataset.hint = hint;
      item.node.disabled = state.phase !== 'answering' || state.paused;
    });
  };
  const renderDock = state => {
    const problem = state.problem;
    const kindText = problem ? `${KIND_TEXT[problem.kind]}　${Math.min(state.total, state.caught + 1)}/${state.total}` : '';
    if (kind.textContent !== kindText) kind.textContent = kindText;
    if (problem && problemKey !== problem.contentId) {
      problemKey = problem.contentId; ask.dataset.kind = problem.kind;
      promptText.textContent = problem.kind === 'en2ja' ? problem.word : `「${problem.meaning}」`;
      say.hidden = problem.kind !== 'en2ja'; sayWord = problem.kind === 'en2ja' ? problem.word : '';
      note.textContent = problem.kind === 'en2ja' ? 'この意味のふだを持ったゴトモンをつろう' : 'この英語のふだを持ったゴトモンをつろう';
      // The word is heard as well as seen; the meaning problem keeps it for after the catch.
      if (problem.kind === 'en2ja') Speech.speakEnglish(problem.word);
    }
  };
  const showAnswer = state => {
    const answer = state.lastAnswer;
    const item = swimmers[answer.row];
    const x = answer.x * 100, y = answer.y * 100;
    fx.beam(BOAT.x, BOAT.y, x, y - 6, answer.correct ? 'great' : 'good');
    if (answer.correct) {
      if (item) restartClass(item.node, 'fs-caught');
      note.textContent = `つれた！ ${answer.word} ＝ ${answer.meaning}`;
      fx.burst(x, y - 8, answer.first ? 'great' : 'good', answer.first ? 1.3 : 1);
      if (answer.first) fx.pop(x, y - 16, 'つれた！', 'great');
      Speech.speakEnglish(answer.word);
      answers.push({ text: `${answer.word} ＝ ${answer.meaning}`, correct: answer.first });
    } else {
      if (item) restartClass(item.node, 'fs-away');
      note.textContent = `${answer.name}のふだは「${answer.plate.word} ＝ ${answer.plate.meaning}」だったよ。光っているゴトモンをつろう`;
    }
    frame.announce(note.textContent);
  };

  return {
    root,
    attachCompanion(portrait) { buddy.append(portrait); },
    focusPlay() { swimmers[0].node.focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      if (!state.swimmers?.length) return;
      if (!state.result) { renderSwimmers(state); renderDock(state); }
      if (state.seq !== lastSeq) {
        lastSeq = state.seq;
        if (state.lastAnswer && state.lastAnswer.cast !== shownCast) { shownCast = state.lastAnswer.cast; showAnswer(state); }
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
        if (event.type === 'boost') { fx.banner('大漁フィーバー！', 'great'); fx.flash('great'); }
      }
      const mission = w.challenge;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: Math.min(1, (state.caught ?? 0) / (state.total || 1)), progressLabel: `つった ${state.caught ?? 0}/${state.total ?? 0}`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; Speech.cancel(); [...swimmers.map(item => item.node), say, go].forEach(node => { node.disabled = true; }); },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
