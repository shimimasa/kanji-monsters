import { createArcadeFrame, bindArcadeKeys, setVar, restartClass } from '../arcade/arcadeKit.js';

const CSS = `
#photoRallyScreen .ya-field{background:linear-gradient(#8fd3ff 0,#d9f2ff 34%,#a6d98a 34.2%,#7cc26b 70%,#6aae5a 100%)}
#photoRallyScreen .pr-hills{position:absolute;left:0;right:0;top:20%;height:15%;background-image:radial-gradient(ellipse 150px 70px at 100px 100%,#8cc27a 60%,transparent 61%),radial-gradient(ellipse 200px 90px at 330px 100%,#79b46a 60%,transparent 61%);background-size:420px 100%;background-repeat:repeat-x}
#photoRallyScreen .pr-place{position:absolute;left:12px;top:60px;z-index:7;padding:3px 12px;border-radius:99px;background:#0008;color:#fff;font-size:13px;font-weight:800}
#photoRallyScreen .pr-spot{position:absolute;z-index:4;width:min(22%,170px);height:min(34%,210px);transform:translate(-50%,-100%);overflow:hidden;pointer-events:none}
#photoRallyScreen .pr-cover{position:absolute;z-index:5;transform:translate(-50%,-100%);pointer-events:none}
#photoRallyScreen .pr-cover[data-kind=bush]{width:min(24%,180px);height:min(12%,76px);border-radius:50% 50% 12px 12px;background:radial-gradient(circle at 25% 40%,#5aa24c 30%,transparent 31%),radial-gradient(circle at 60% 30%,#4f9a45 34%,transparent 35%),radial-gradient(circle at 85% 55%,#5aa24c 28%,transparent 29%),linear-gradient(transparent 35%,#4f9a45 36%)}
#photoRallyScreen .pr-cover[data-kind=rock]{width:min(22%,160px);height:min(11%,70px);border-radius:48% 52% 10px 10px;background:linear-gradient(#a7a39a,#7f7b72);box-shadow:inset -10px -6px 0 #0002}
#photoRallyScreen .pr-monster{position:absolute;left:50%;bottom:0;width:86%;height:100%;transform:translate(-50%,calc(var(--down,1) * 100%));transition:transform .12s ease-out}
#photoRallyScreen .pr-monster img{width:100%;height:100%;object-fit:contain;object-position:50% 100%;filter:drop-shadow(0 4px 3px #0004)}
#photoRallyScreen .pr-monster[data-state=blur] img{filter:blur(4px) drop-shadow(0 4px 3px #0004)}
#photoRallyScreen .pr-finder{position:absolute;z-index:6;width:min(26%,200px);height:min(38%,230px);transform:translate(-50%,-100%);pointer-events:none;transition:left .25s ease-out,top .25s ease-out}
#photoRallyScreen .pr-finder i{position:absolute;width:26px;height:26px;border:4px solid #fff;filter:drop-shadow(0 0 2px #0008)}
#photoRallyScreen .pr-finder i:nth-child(1){left:0;top:0;border-right:0;border-bottom:0}
#photoRallyScreen .pr-finder i:nth-child(2){right:0;top:0;border-left:0;border-bottom:0}
#photoRallyScreen .pr-finder i:nth-child(3){left:0;bottom:0;border-right:0;border-top:0}
#photoRallyScreen .pr-finder i:nth-child(4){right:0;bottom:0;border-left:0;border-top:0}
#photoRallyScreen .pr-finder[data-ready=true] i{border-color:#ffe066}
#photoRallyScreen .pr-flash{position:absolute;inset:0;z-index:8;background:#fff;opacity:0;pointer-events:none}
#photoRallyScreen .pr-flash.pr-shot{animation:pr-flash .45s ease-out}
#photoRallyScreen .pr-polaroid{position:absolute;right:14px;bottom:14px;z-index:9;width:clamp(96px,14vw,130px);padding:8px 8px 6px;border-radius:6px;background:#fffdf6;box-shadow:0 8px 20px #0005;transform:rotate(6deg);text-align:center;color:#2a1c10;font-weight:900;font-size:13px;pointer-events:none}
#photoRallyScreen .pr-polaroid img{display:block;width:100%;aspect-ratio:1;object-fit:contain;background:#d9f2ff;border-radius:3px}
#photoRallyScreen .pr-polaroid.pr-in{animation:pr-drop .5s ease-out}
#photoRallyScreen .pr-stars{color:#e0a800;letter-spacing:1px}
#photoRallyScreen .pr-hero{position:absolute;left:4%;bottom:3%;z-index:6;width:clamp(58px,8vw,84px);height:clamp(58px,8vw,84px)}
#photoRallyScreen .pr-hero .gt-portrait{display:block;width:100%;height:100%;background:none;border:0}
#photoRallyScreen .pr-hero .gt-portrait img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 4px 3px #0005)}
#photoRallyScreen .pr-hero[data-fever=true]::after{content:'';position:absolute;inset:-18%;border-radius:50%;background:radial-gradient(circle,#ffd54a66,transparent 70%);animation:ya-glow .4s infinite alternate;z-index:-1}
#photoRallyScreen .pr-who{margin:0;text-align:center;font-size:14px;font-weight:800;color:#bfe6d8}
#photoRallyScreen .pr-sentence{margin:0;padding:10px 12px;border-radius:12px;background:#ffffff14;text-align:center;font-size:clamp(19px,2.4vw,24px);font-weight:800;line-height:1.5;color:#fff}
#photoRallyScreen .pr-target{display:inline-block;margin:0 2px;padding:0 6px;border-radius:8px;background:#ffe066;color:#3a2400;font-size:1.35em;line-height:1.2}
#photoRallyScreen .pr-choices{display:grid;grid-template-columns:1fr 1fr;gap:8px}
#photoRallyScreen .pr-choice{min-height:56px;border:0;border-radius:14px;background:#f5f8fa;color:#16242c;font:inherit;font-size:clamp(20px,2.6vw,26px);font-weight:900;box-shadow:0 4px 0 #9fb3bf;cursor:pointer;touch-action:manipulation}
#photoRallyScreen .pr-choice small{font-size:.55em;color:#6b7f8a;margin-right:6px}
#photoRallyScreen .pr-choice:focus-visible{outline:3px solid #ffd54a;outline-offset:2px}
#photoRallyScreen .pr-choice[data-status=correct]{background:#d7f7df;box-shadow:0 4px 0 #1f9d55}
#photoRallyScreen .pr-choice[data-status=chosen]{background:#fff1d6;box-shadow:0 4px 0 #c77f16}
#photoRallyScreen .pr-choice:disabled{cursor:default}
#photoRallyScreen .pr-next{min-height:52px;border:0;border-radius:14px;background:#ffb627;color:#3a2400;font:inherit;font-size:20px;font-weight:900;box-shadow:0 4px 0 #b57500;cursor:pointer}
#photoRallyScreen .pr-review{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:6px}
#photoRallyScreen .pr-review li{padding:6px 10px;border-radius:10px;background:#eef6ef;font-weight:700}
#photoRallyScreen .pr-review li[data-correct=false]{background:#fff3da}
@keyframes pr-flash{0%{opacity:.95}100%{opacity:0}}
@keyframes pr-drop{0%{transform:translateY(-140%) rotate(-12deg);opacity:0}100%{transform:rotate(6deg);opacity:1}}
`;

// Hiding places in the meadow; the monster peeks out of one per shot.
const SPOTS = [{ x: 18, y: 72, kind: 'bush' }, { x: 42, y: 60, kind: 'rock' }, { x: 64, y: 72, kind: 'bush' }, { x: 86, y: 60, kind: 'rock' }];

// 1 = hidden. The monster pops up fast, then slowly slips down but never fully hides.
const EMPTY = 'この場所の写真はじゅんび中。「広場へ」から、ほかの場所をえらんでね。';
const monsterDown = progress => progress < .08 ? 1 - progress / .08 : progress > .7 ? Math.min(.45, (progress - .7) / .3 * .45) : 0;

export function createPhotoRallyView({ document: doc, dispatch, onBack, getSnapshot }) {
  let active = true, problemId = null, lastSeq = -1, lastEventId = 0, spotIndex = 0, resolved = false;
  const removes = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'photoRallyScreen', title: 'ゴトモン写真ラリー', theme: 'meadow' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });
  const place = el('p', 'pr-place');
  world.append(el('div', 'pr-hills'), place);
  const spots = SPOTS.map(spot => {
    const box = el('div', 'pr-spot'); box.style.left = `${spot.x}%`; box.style.top = `${spot.y}%`;
    const cover = el('i', 'pr-cover'); cover.dataset.kind = spot.kind; cover.style.left = `${spot.x}%`; cover.style.top = `${spot.y + 1}%`;
    world.append(box, cover); return { ...spot, box };
  });
  const monster = el('div', 'pr-monster'); const monsterImg = el('img'); monsterImg.alt = ''; monster.append(monsterImg);
  const finder = el('div', 'pr-finder'); for (let i = 0; i < 4; i++) finder.append(el('i'));
  const flash = el('div', 'pr-flash');
  const polaroid = el('div', 'pr-polaroid'); const polaroidImg = el('img'); polaroidImg.alt = '';
  const polaroidStars = el('span', 'pr-stars'); polaroid.append(polaroidImg, polaroidStars); polaroid.hidden = true;
  const hero = el('div', 'pr-hero');
  world.append(finder, flash, polaroid, hero);

  const who = el('p', 'pr-who');
  const sentence = el('p', 'pr-sentence'); sentence.dataset.role = 'problem';
  const note = el('p', 'ya-dock-note', '読みを選ぶとシャッター！'); note.dataset.role = 'feedback';
  const choicesBox = el('div', 'pr-choices');
  const choices = [0, 1, 2, 3].map(index => {
    const node = el('button', 'pr-choice'); node.type = 'button'; node.dataset.choiceIndex = String(index + 1);
    on(node, 'click', () => choose(index)); choicesBox.append(node); return node;
  });
  const next = el('button', 'pr-next', 'つぎへ'); next.type = 'button'; next.dataset.action = 'next'; next.hidden = true;
  on(next, 'click', () => {
    const state = getSnapshot();
    if (active && !state.paused && state.phase === 'feedback') dispatch({ type: 'next', payload: { sessionId: state.sessionId, problemId: state.problem?.problemId } });
  });
  dock.append(who, sentence, choicesBox, note, next);
  const review = el('div', 'ya-learning-result'); review.hidden = true;
  const reviewList = el('ol', 'pr-review'); review.append(el('h3', '', '今回の漢字'), reviewList); frame.shell.append(review);
  doc.body.append(root);
  const answers = [];

  function choose(index) {
    const state = getSnapshot(), choice = state.problem?.choices[index];
    if (!active || state.paused || state.phase !== 'answering' || !choice) return false;
    return dispatch({ type: 'answer', payload: { sessionId: state.sessionId, problemId: state.problem.problemId,
      attemptId: state.attemptId, choiceId: choice.choiceId } });
  }
  removes.push(bindArcadeKeys(doc, event => {
    if (!active || event.repeat) return false;
    const index = ['1', '2', '3', '4'].indexOf(event.key);
    if (index >= 0) { choose(index); return true; }
    if (event.key === 'Enter' && !next.hidden) { next.click(); return true; }
    return false;
  }));

  const showProblem = (state, problem) => {
    resolved = false;
    // A different hiding place each shot, chosen from the problem id so replays stay steady.
    spotIndex = [...problem.problemId].reduce((sum, c) => sum + c.charCodeAt(0), 0) % spots.length;
    const spot = spots[spotIndex];
    spot.box.append(monster); monster.dataset.state = '';
    monsterImg.src = problem.monsterImage || ''; monsterImg.hidden = !problem.monsterImage;
    finder.style.left = `${spot.x}%`; finder.style.top = `${spot.y}%`;
    who.textContent = `${problem.monsterName}が顔を出した！`;
    sentence.textContent = '';
    sentence.append(el('span', '', problem.before), el('span', 'pr-target', problem.kanji), el('span', '', problem.after));
    sentence.setAttribute('aria-label', `${problem.before}${problem.kanji}${problem.after}。${problem.kanji}の読みは？`);
    choices.forEach((node, index) => {
      const choice = problem.choices[index];
      node.hidden = !choice; delete node.dataset.status; node.textContent = '';
      node.dataset.choiceId = choice?.choiceId ?? '';
      if (choice) { node.append(el('small', '', String(index + 1)), el('span', '', choice.text)); node.setAttribute('aria-label', `${index + 1}番 ${choice.text}`); }
    });
    note.textContent = '読みを選ぶとシャッター！';
  };
  const showAnswer = state => {
    const answer = state.lastAnswer, problem = state.problem;
    const reading = problem.choices.find(choice => choice.choiceId === answer.correctChoiceId)?.text ?? '';
    choices.forEach(node => {
      if (node.dataset.choiceId === answer.correctChoiceId) node.dataset.status = 'correct';
      else if (node.dataset.choiceId === answer.choiceId) node.dataset.status = 'chosen';
    });
    answers.push({ kanji: problem.kanji, reading, correct: answer.correct });
    resolved = true;
    const spot = spots[spotIndex];
    if (answer.correct) {
      restartClass(flash, 'pr-shot');
      note.textContent = `パシャ！「${problem.kanji}」は「${reading}」`;
      frame.announce(`パシャ。${problem.kanji}、${reading}`);
    } else {
      monster.dataset.state = 'blur';
      fx.pop(spot.x, spot.y - 36, 'ピンぼけ…', 'soft');
      note.textContent = `この文の「${problem.kanji}」は「${reading}」と読むよ。次はきっと撮れる！`;
      frame.announce(`${problem.kanji} は ${reading} と読みます`);
    }
  };

  return {
    root,
    attachCompanion(portrait) { hero.append(portrait); },
    focusPlay() { choices[0].focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      if (state.stage && place.textContent !== state.stage.name) place.textContent = state.stage.name;
      if (!state.totalQuestions && note.textContent !== EMPTY) { note.textContent = EMPTY; sentence.textContent = ''; }
      const problem = state.problem;
      if (problem && problem.problemId !== problemId) { problemId = problem.problemId; showProblem(state, problem); }
      if (state.seq !== lastSeq) {
        lastSeq = state.seq;
        if (state.lastAnswer && answers.length < state.answered) showAnswer(state);
      }
      const canAnswer = !state.paused && state.phase === 'answering';
      choices.forEach(node => { node.disabled = !canAnswer; });
      next.hidden = !(state.mode === 'review' && state.phase === 'feedback');
      next.disabled = !!state.paused;
      if (state.result && review.hidden) {
        review.hidden = false; reviewList.textContent = '';
        for (const item of answers) {
          const row = el('li', '', `${item.correct ? '📷' : '☆'} ${item.kanji}（${item.reading}）`);
          row.dataset.correct = String(item.correct); reviewList.append(row);
        }
      }
    },
    present(play, dt, state) {
      if (!active || !state) return;
      frame.tick(dt);
      const w = play.world || {};
      setVar(monster, '--down', String(resolved ? (state.lastAnswer?.correct ? 0 : .6) : monsterDown(w.progress ?? 0)));
      finder.dataset.ready = String(!resolved && (w.progress ?? 0) < .6);
      hero.dataset.fever = String(!!w.fever);
      const event = w.lastEvent;
      if (event && event.id !== lastEventId) {
        lastEventId = event.id;
        if (event.type === 'hit' && event.stars) {
          polaroidImg.src = state.problem?.monsterImage || ''; polaroidStars.textContent = '★'.repeat(event.stars) + '☆'.repeat(3 - event.stars);
          polaroid.hidden = false; restartClass(polaroid, 'pr-in');
          const spot = spots[spotIndex];
          fx.pop(spot.x, spot.y - 40, event.stars === 3 ? 'ベストショット！' : event.stars === 2 ? 'ナイスショット！' : 'パシャ！', event.stars === 3 ? 'great' : 'good');
        } else if (event.type === 'boost') { fx.banner('シャッターチャンス！', 'great'); fx.flash('great'); }
      }
      const total = state.totalQuestions || 10, mission = w.challenge;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: (state.answered ?? 0) / total,
        progressLabel: `写真 ${w.correct ?? 0} · ${Math.min(total, (state.answered ?? 0) + (state.phase === 'answering' ? 1 : 0))}/${total}`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; choices.forEach(node => { node.disabled = true; }); next.disabled = true; },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
