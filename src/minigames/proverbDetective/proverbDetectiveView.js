import { createArcadeFrame, bindArcadeKeys, setVar, restartClass } from '../arcade/arcadeKit.js';
import { castAt } from '../gotomonCast.js';
import { CASE_MASK } from './proverbCases.js';

const CSS = `
#proverbDetectiveScreen .ya-field{background:radial-gradient(ellipse at 50% 0,#6a4f8a 0,transparent 60%),linear-gradient(#241a33,#2f2342 62%,#3b2a22 62.3%,#2c2019)}
#proverbDetectiveScreen .pd-window{position:absolute;right:7%;top:14%;width:18%;height:22%;border:6px solid #5a4230;border-radius:6px;background:radial-gradient(circle at 70% 30%,#fff3b0 6%,transparent 7%),linear-gradient(#1a2a4a,#2d3f66);box-shadow:inset 0 0 0 3px #3b2a1c}
#proverbDetectiveScreen .pd-client{position:absolute;left:3%;top:15%;z-index:3;width:clamp(96px,15%,140px);padding:8px;border-radius:12px;background:#fffdf3;color:#2a1c10;text-align:center;box-shadow:0 6px 0 #0005;transform:rotate(-3deg)}
#proverbDetectiveScreen .pd-client b{display:grid;place-items:center;height:56px;margin-bottom:4px;border-radius:8px;background:linear-gradient(#cdb8e8,#a88fcf);font-size:34px;color:#fff}
#proverbDetectiveScreen .pd-client span{display:block;font-size:12px;font-weight:900;line-height:1.3}
#proverbDetectiveScreen .pd-client small{display:block;font-size:10px;color:#7a6a58}
#proverbDetectiveScreen .pd-memo{position:absolute;left:50%;top:50%;z-index:4;width:min(68%,560px);transform:translate(-44%,-52%);padding:16px 18px 14px;border-radius:6px;background:repeating-linear-gradient(#fffdf6 0 31px,#d9e6f5 31px 32px);color:#2a1c10;box-shadow:0 10px 24px #0007;font-size:clamp(17px,2.1vw,22px);font-weight:700;line-height:32px}
#proverbDetectiveScreen .pd-memo h2{margin:0 0 4px;font-size:14px;color:#6b4e8a;letter-spacing:.1em;line-height:1.4}
#proverbDetectiveScreen .pd-memo p{margin:0}
#proverbDetectiveScreen .pd-question{color:#3a1f5c}
#proverbDetectiveScreen .pd-blank{display:inline-block;min-width:4em;margin:0 2px;padding:0 6px;border-radius:6px;background:#ffe066;color:#3a2400;text-align:center}
#proverbDetectiveScreen .pd-hintbar{height:8px;margin-top:8px;border-radius:99px;background:#0001;overflow:hidden}
#proverbDetectiveScreen .pd-hintbar i{display:block;height:100%;width:calc(var(--p,0) * 100%);background:linear-gradient(90deg,#b99be0,#6b4e8a)}
#proverbDetectiveScreen .pd-hint{margin:6px 0 0;padding:6px 10px;border-radius:8px;background:#efe6ff;color:#3a1f5c;font-size:15px;line-height:1.5}
#proverbDetectiveScreen .pd-solved{margin:8px 0 0;padding:8px 10px;border-radius:8px;background:#e8f6ea;line-height:1.5;font-size:16px}
#proverbDetectiveScreen .pd-solved strong{display:block;font-size:22px}
#proverbDetectiveScreen .pd-stamp{position:absolute;right:10px;top:-14px;padding:4px 12px;border:4px solid #c0392b;border-radius:10px;color:#c0392b;font-size:22px;font-weight:900;transform:rotate(10deg);background:#fffdf6cc}
#proverbDetectiveScreen .pd-stamp.pd-press{animation:pd-press .4s ease-out}
#proverbDetectiveScreen .pd-hero{position:absolute;right:4%;bottom:4%;z-index:5;width:clamp(64px,9vw,92px);height:clamp(64px,9vw,92px)}
#proverbDetectiveScreen .pd-hero .gt-portrait{display:block;width:100%;height:100%;background:none;border:0}
#proverbDetectiveScreen .pd-hero .gt-portrait img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 6px 3px #0006)}
#proverbDetectiveScreen .pd-hero::before{content:'🔍';position:absolute;left:-26%;top:20%;font-size:30px;filter:drop-shadow(0 2px 2px #0006)}
#proverbDetectiveScreen .pd-hero[data-fever=true]::after{content:'';position:absolute;inset:-18%;border-radius:50%;background:radial-gradient(circle,#ffd54a66,transparent 70%);animation:ya-glow .4s infinite alternate;z-index:-1}
#proverbDetectiveScreen .pd-ask{margin:0;text-align:center;font-size:15px;font-weight:800;color:#e6d8ff}
#proverbDetectiveScreen .pd-helper{position:absolute;left:4%;bottom:6%;z-index:3;display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:none}
#proverbDetectiveScreen .pd-helper img{width:clamp(64px,9vw,96px);height:clamp(64px,9vw,96px);object-fit:contain;filter:drop-shadow(0 4px 3px #0005)}
#proverbDetectiveScreen .pd-helper span{padding:1px 8px;border-radius:8px;background:#fffdf3;color:#2a1c10;font-size:11px;font-weight:900}
#proverbDetectiveScreen .pd-helper.pd-cheer img{animation:pd-cheer .45s ease-out 2}
@media (max-width:640px){#proverbDetectiveScreen .pd-helper{left:2%;bottom:2%}#proverbDetectiveScreen .pd-helper img{width:44px;height:44px}#proverbDetectiveScreen .pd-helper span{display:none}}
@keyframes pd-cheer{0%,100%{transform:none}50%{transform:translateY(-22px) rotate(-6deg)}}
#proverbDetectiveScreen .pd-suspects{display:grid;gap:8px}
#proverbDetectiveScreen .pd-suspect{min-height:56px;padding:8px 12px;border:0;border-radius:14px;background:#f5f2fa;color:#241a33;font:inherit;font-size:clamp(17px,2vw,21px);font-weight:900;text-align:left;box-shadow:0 4px 0 #a99bc0;cursor:pointer;touch-action:manipulation;line-height:1.3}
#proverbDetectiveScreen .pd-suspect small{font-size:.6em;color:#7a6a90;margin-right:6px}
#proverbDetectiveScreen .pd-suspect em{display:block;margin-top:4px;font-style:normal;font-size:.62em;font-weight:700;color:#5d4a78}
#proverbDetectiveScreen .pd-suspect:focus-visible{outline:3px solid #ffd54a;outline-offset:2px}
#proverbDetectiveScreen .pd-suspect[data-status=alibi]{background:#e9e4f0;color:#7a6a90;box-shadow:0 4px 0 #c9bfd8}
#proverbDetectiveScreen .pd-suspect[data-status=culprit]{background:#d7f7df;box-shadow:0 4px 0 #1f9d55}
#proverbDetectiveScreen .pd-suspect.ya-nudge{animation:ya-nudge .35s ease-out}
#proverbDetectiveScreen .pd-next{min-height:52px;border:0;border-radius:14px;background:#ffb627;color:#3a2400;font:inherit;font-size:20px;font-weight:900;box-shadow:0 4px 0 #b57500;cursor:pointer}
#proverbDetectiveScreen .pd-review{margin:0;padding:0;list-style:none;display:grid;gap:6px}
#proverbDetectiveScreen .pd-review li{padding:6px 10px;border-radius:10px;background:#eef6ef;font-weight:700}
#proverbDetectiveScreen .pd-review li[data-correct=false]{background:#fff3da}
@media (max-width:640px){#proverbDetectiveScreen .pd-client{display:none}#proverbDetectiveScreen .pd-memo{width:90%;transform:translate(-50%,-46%);padding:12px 14px 10px;font-size:16px;line-height:26px;background:repeating-linear-gradient(#fffdf6 0 25px,#d9e6f5 25px 26px)}#proverbDetectiveScreen .pd-solved{font-size:14px;padding:6px 8px}#proverbDetectiveScreen .pd-solved strong{font-size:18px}#proverbDetectiveScreen .pd-stamp{top:-8px;font-size:17px;padding:2px 10px}}
@keyframes pd-press{0%{transform:rotate(10deg) scale(2);opacity:0}100%{transform:rotate(10deg) scale(1);opacity:1}}
`;

// The meaning hint shows once the hint meter fills (half the case time).
const HINT_AT = .5;

export function createProverbDetectiveView({ document: doc, dispatch, onBack, getSnapshot, cast }) {
  // One of the child's Gotomon works as the detective's assistant for the whole run.
  const assistant = castAt(cast?.friends, 0) ?? castAt(cast?.wild, 0);
  let active = true, problemId = null, lastSeq = -1, lastEventId = 0, lastTrySerial = 0, hintShown = false;
  const removes = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'proverbDetectiveScreen', title: 'ことわざ探偵', theme: 'office' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });
  const client = el('div', 'pd-client'); const clientName = el('span');
  client.append(el('b', '', '？'), el('small', '', '依頼人'), clientName);
  const memo = el('div', 'pd-memo'); memo.dataset.role = 'problem';
  const memoTitle = el('h2', '', '事件メモ'), clues = el('div'), question = el('p', 'pd-question');
  const hintbar = el('div', 'pd-hintbar'); hintbar.append(el('i')); hintbar.setAttribute('aria-hidden', 'true');
  const hint = el('p', 'pd-hint'); hint.hidden = true;
  const solved = el('div', 'pd-solved'); solved.hidden = true;
  const stamp = el('span', 'pd-stamp', '解決！'); stamp.hidden = true;
  memo.append(stamp, memoTitle, clues, question, hintbar, hint, solved);
  const hero = el('div', 'pd-hero');
  world.append(el('i', 'pd-window'), client, memo, hero);
  const helper = el('div', 'pd-helper');
  if (assistant) { const img = el('img'); img.alt = ''; img.src = assistant.imageUrl; helper.append(img, el('span', '', `助手 ${assistant.name}`)); world.append(helper); }

  const ask = el('p', 'pd-ask', 'ぴったりのことわざを指名しよう！');
  const suspectsBox = el('div', 'pd-suspects');
  const suspects = [0, 1, 2, 3].map(index => {
    const node = el('button', 'pd-suspect'); node.type = 'button'; node.dataset.choiceIndex = String(index + 1);
    on(node, 'click', () => accuse(index)); suspectsBox.append(node); return node;
  });
  const note = el('p', 'ya-dock-note'); note.dataset.role = 'feedback';
  const next = el('button', 'pd-next', 'つぎの事件へ'); next.type = 'button'; next.dataset.action = 'next'; next.hidden = true;
  on(next, 'click', () => {
    const state = getSnapshot();
    if (active && !state.paused && state.phase === 'feedback') dispatch({ type: 'next', payload: { sessionId: state.sessionId, problemId: state.problem?.problemId } });
  });
  dock.append(ask, suspectsBox, note, next);
  const review = el('div', 'ya-learning-result'); review.hidden = true;
  const reviewList = el('ol', 'pd-review'); review.append(el('h3', '', '今回のことわざ'), reviewList); frame.shell.append(review);
  doc.body.append(root);
  const answers = [];

  function accuse(index) {
    const state = getSnapshot(), choice = state.problem?.choices[index];
    if (!active || state.paused || state.phase !== 'answering' || !choice || state.ruledOut?.includes(choice.choiceId)) return false;
    return dispatch({ type: 'answer', payload: { sessionId: state.sessionId, problemId: state.problem.problemId,
      attemptId: state.attemptId, choiceId: choice.choiceId } });
  }
  removes.push(bindArcadeKeys(doc, event => {
    if (!active || event.repeat) return false;
    const index = ['1', '2', '3', '4'].indexOf(event.key);
    if (index >= 0) { accuse(index); return true; }
    if (event.key === 'Enter' && !next.hidden) { next.click(); return true; }
    return false;
  }));

  const showCase = (state, problem) => {
    hintShown = false; lastTrySerial = 0;
    clientName.textContent = problem.client;
    memoTitle.textContent = `事件メモ No.${(state.answered ?? 0) + 1}`;
    clues.textContent = '';
    for (const line of problem.clues) clues.append(el('p', '', line));
    const [before, after = ''] = problem.question.split(CASE_MASK);
    question.textContent = '';
    question.append(el('span', '', before), el('span', 'pd-blank', '？'), el('span', '', after));
    hint.hidden = true; hint.textContent = ''; solved.hidden = true; solved.textContent = ''; stamp.hidden = true; hintbar.hidden = false;
    suspects.forEach((node, index) => {
      const choice = problem.choices[index];
      node.hidden = !choice; delete node.dataset.status; node.textContent = '';
      node.dataset.choiceId = choice?.choiceId ?? '';
      if (choice) { node.append(el('small', '', String(index + 1)), el('span', '', choice.text)); node.setAttribute('aria-label', `${index + 1}番 ${choice.text}`); }
    });
    note.textContent = `${problem.client}が、こまったできごとを話してくれたよ。`;
  };
  const showTry = (state, attempt) => {
    const problem = state.problem, index = problem.choices.findIndex(choice => choice.choiceId === attempt.choiceId);
    const node = suspects[index], choice = problem.choices[index];
    if (!attempt.ok && node) {
      node.dataset.status = 'alibi'; node.append(el('em', '', `アリバイあり：${choice.meaning}`));
      restartClass(node, 'ya-nudge');
      note.textContent = `「${choice.text}」は、この事件とはちがうみたい。`;
      frame.announce(`${choice.text} はちがう。${choice.meaning}`);
    }
  };
  const showSolved = state => {
    const problem = state.problem, answer = state.lastAnswer;
    const node = suspects[problem.choices.findIndex(choice => choice.choiceId === answer.correctChoiceId)];
    if (node) node.dataset.status = 'culprit';
    answers.push({ text: problem.text, correct: answer.correct });
    const [before, after = ''] = problem.question.split(CASE_MASK);
    question.textContent = '';
    question.append(el('span', '', before), el('span', 'pd-blank', problem.text), el('span', '', after));
    hint.hidden = true; hintbar.hidden = true;
    solved.textContent = '';
    solved.append(el('strong', '', problem.text), el('span', '', `よみ：${problem.reading}`), el('p', '', `いみ：${problem.meaning}`));
    solved.hidden = false; stamp.hidden = false; restartClass(stamp, 'pd-press');
    note.textContent = answer.correct ? 'みごとな推理！ 事件解決！' : '事件解決！ いみをもう一度読んでおこう。';
    if (assistant) { restartClass(helper, 'pd-cheer'); fx.pop(12, 62, `${assistant.name}「さすが名探偵！」`, 'great'); }
    frame.announce(`事件解決。${problem.text}。${problem.meaning}`);
  };

  return {
    root,
    attachCompanion(portrait) { hero.append(portrait); },
    focusPlay() { suspects[0].focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      const problem = state.problem;
      if (problem && problem.problemId !== problemId) { problemId = problem.problemId; showCase(state, problem); }
      if (state.lastTry && state.lastTry.serial !== lastTrySerial) { lastTrySerial = state.lastTry.serial; showTry(state, state.lastTry); }
      if (state.seq !== lastSeq) {
        lastSeq = state.seq;
        if (state.lastAnswer && answers.length < state.answered) showSolved(state);
      }
      const canAccuse = !state.paused && state.phase === 'answering';
      suspects.forEach(node => { node.disabled = !canAccuse || node.dataset.status === 'alibi'; });
      next.hidden = state.phase !== 'feedback';
      next.disabled = !!state.paused;
      if (state.result && review.hidden) {
        review.hidden = false; reviewList.textContent = '';
        for (const item of answers) {
          const row = el('li', '', `${item.correct ? '🔍' : '☆'} ${item.text}`);
          row.dataset.correct = String(item.correct); reviewList.append(row);
        }
      }
    },
    present(play, dt, state) {
      if (!active || !state) return;
      frame.tick(dt);
      const w = play.world || {}, p = w.progress ?? 0;
      setVar(hintbar, '--p', String(Math.min(1, p / HINT_AT)));
      // The hint names what the right proverb means; solving before it is a 名推理.
      if (!hintShown && state.phase === 'answering' && p >= HINT_AT && state.problem) {
        hintShown = true; hint.hidden = false; hintbar.hidden = true;
        hint.textContent = `🔍 ヒント：「${state.problem.meaning}」という意味のことわざだよ`;
        frame.announce('ヒントが出たよ');
      }
      hero.dataset.fever = String(!!w.fever);
      const event = w.lastEvent;
      if (event && event.id !== lastEventId) {
        lastEventId = event.id;
        if (event.type === 'hit' && event.stars === 3) fx.banner('名推理！', 'great');
        else if (event.type === 'hit') fx.pop(50, 20, 'ずばり的中！', 'good');
        else if (event.type === 'boost') { fx.banner('ひらめき！', 'great'); fx.flash('great'); }
      }
      const total = state.totalQuestions || 10, mission = w.challenge;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: (state.answered ?? 0) / total,
        progressLabel: `解決 ${w.cases?.length ?? 0} · ${Math.min(total, (state.answered ?? 0) + (state.phase === 'answering' ? 1 : 0))}/${total}件`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; suspects.forEach(node => { node.disabled = true; }); next.disabled = true; },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
