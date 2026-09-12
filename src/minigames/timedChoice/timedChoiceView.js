const CSS = `
#timedChoiceScreen{position:fixed;inset:0;z-index:100010;background:#fff7e8;color:#332814;overflow:auto;overscroll-behavior:contain;font:18px system-ui,sans-serif;box-sizing:border-box;padding:12px max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom));touch-action:manipulation}
#timedChoiceScreen *{box-sizing:border-box}#timedChoiceScreen [hidden]{display:none!important}
#timedChoiceScreen .tc-shell{max-width:720px;margin:0 auto}#timedChoiceScreen header{display:flex;gap:12px;align-items:center;justify-content:space-between;position:sticky;top:-12px;z-index:2;background:#fff7e8;padding:4px 0}
#timedChoiceScreen h1{font-size:clamp(20px,5vw,28px);margin:0}#timedChoiceScreen button{min-width:44px;min-height:44px;border:2px solid #8a6422;border-radius:11px;background:#fff;color:#332814;font:inherit;padding:9px 14px;cursor:pointer}
#timedChoiceScreen button:disabled{opacity:.55;cursor:default}#timedChoiceScreen button:focus-visible{outline:3px solid #176b73;outline-offset:2px}.tc-progress{display:flex;justify-content:space-between;gap:12px;margin:10px 0;font-weight:700}.tc-pause{color:#7a531a;margin:8px 0}
#timedChoiceScreen .tc-play{display:grid;grid-template-columns:minmax(0,1fr) 190px;gap:16px;align-items:start}.tc-timer-label{text-align:center;font-weight:800;margin:5px 0}.tc-timer-track{height:14px;border:1px solid #80632f;border-radius:10px;background:#eadfc8;overflow:hidden}.tc-timer-bar{height:100%;width:100%;background:#d47920}
#timedChoiceScreen .tc-prompt{font-size:clamp(28px,7vw,46px);font-weight:800;text-align:center;margin:12px 0}.tc-help{text-align:center;margin:5px 0 12px;color:#66532f}.tc-choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.tc-choice{width:100%;min-height:56px}.tc-choice[data-status=correct]{background:#d9f4df;border-color:#237340}.tc-choice[data-status=incorrect]{background:#ffe1df;border-color:#a53730}.tc-feedback{min-height:38px;margin:10px 0;line-height:1.5}.tc-primary{background:#9a5518!important;color:#fff!important;border-color:#9a5518!important}
#timedChoiceScreen .tc-companion{pointer-events:none;text-align:center;margin:0;padding-top:4px;color:#66583b;font-size:14px}.tc-companion canvas{display:block;width:180px;height:90px;max-width:100%;margin:auto}.tc-result{text-align:center;padding:12px}.tc-result h2{font-size:28px}.tc-result p{font-size:19px;margin:10px}.tc-result strong{display:block;font-size:28px}
@media(max-width:540px){#timedChoiceScreen .tc-play{grid-template-columns:1fr}.tc-companion{padding:0}.tc-companion canvas{width:140px;height:70px}.tc-prompt{margin:6px 0}.tc-choice{min-height:52px}}
@media(max-height:430px) and (min-width:541px){#timedChoiceScreen .tc-prompt{font-size:30px;margin:2px 0}.tc-help,.tc-progress,.tc-feedback,.tc-timer-label{margin:3px 0}.tc-choice{min-height:44px;padding:5px}.tc-companion canvas{width:120px;height:60px}.tc-result{padding:4px}}
`;

export function createTimedChoiceView({ document: doc, onBack, onReplay, onNext, onAnswer, getSnapshot }) {
  let active = true, root = null, shownProblemId = null;
  const removes = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const el = (tag, className = '', text = '') => {
    const node = doc.createElement(tag); node.className = className; node.textContent = text; return node;
  };
  root = el('section'); root.id = 'timedChoiceScreen'; root.setAttribute('aria-label', 'タイムことば');
  const style = el('style'); style.textContent = CSS; root.append(style);
  const shell = el('div', 'tc-shell'); root.append(shell);
  const header = el('header'); shell.append(header); header.append(el('h1', '', 'タイムことば'));
  const back = el('button', '', 'もどる'); back.type = 'button'; back.dataset.action = 'back'; header.append(back);
  on(back, 'click', () => { if (active) onBack(); });
  const progress = el('div', 'tc-progress'), position = el('span'), score = el('span'); progress.append(position, score); shell.append(progress);
  const pause = el('p', 'tc-pause', 'おやすみ中'); pause.hidden = true; shell.append(pause);
  const play = el('div', 'tc-play'), controls = el('div'); shell.append(play); play.append(controls);
  const timerLabel = el('p', 'tc-timer-label'); timerLabel.dataset.role = 'remaining'; controls.append(timerLabel);
  const timerTrack = el('div', 'tc-timer-track'); timerTrack.setAttribute('role', 'progressbar');
  timerTrack.setAttribute('aria-valuemin', '0'); const timerBar = el('div', 'tc-timer-bar'); timerTrack.append(timerBar); controls.append(timerTrack);
  const help = el('p', 'tc-help', '時間内に よみを えらんでね'); controls.append(help);
  const prompt = el('div', 'tc-prompt'); prompt.dataset.role = 'problem'; controls.append(prompt);
  const choiceArea = el('div', 'tc-choices'); choiceArea.setAttribute('aria-label', 'こたえの候補'); controls.append(choiceArea);
  const choiceButtons = Array.from({ length: 4 }, (_, index) => {
    const button = el('button', 'tc-choice'); button.type = 'button'; button.dataset.choiceIndex = String(index + 1);
    choiceArea.append(button); return button;
  });
  const choose = index => {
    const state = getSnapshot(), choice = state.problem?.choices[index];
    if (!active || state.paused || state.phase !== 'answering' || !state.attemptId || !choice) return false;
    return onAnswer({
      sessionId: state.sessionId, problemId: state.problem.problemId,
      attemptId: state.attemptId, choiceId: choice.choiceId,
    });
  };
  choiceButtons.forEach((button, index) => on(button, 'click', () => choose(index)));
  on(doc, 'keydown', event => {
    if (!active || event.defaultPrevented || event.repeat || event.isComposing ||
        event.altKey || event.ctrlKey || event.metaKey) return;
    const choiceIndex = ['1', '2', '3', '4'].indexOf(event.key);
    if (choiceIndex >= 0 && choose(choiceIndex)) event.preventDefault();
  });
  const feedback = el('p', 'tc-feedback'); feedback.setAttribute('aria-live', 'polite'); controls.append(feedback);
  const next = el('button', 'tc-primary', '次へ'); next.type = 'button'; next.dataset.action = 'next'; controls.append(next);
  on(next, 'click', () => {
    const state = getSnapshot();
    if (active && state.phase === 'feedback' && !state.paused) onNext(state.sessionId, state.problem.problemId);
  });
  const companion = el('figure', 'tc-companion'), canvas = el('canvas'); canvas.width = 280; canvas.height = 140;
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', '仲間のジャガイモスライム');
  const caption = el('figcaption', '', 'ジャガイモスライム'); companion.append(canvas, caption); play.append(companion);
  const result = el('div', 'tc-result'); result.hidden = true; shell.append(result); result.append(el('h2', '', '10もん おつかれさま！'));
  const resultCorrect = el('strong'), resultIncorrect = el('strong'), resultTimedOut = el('strong'), resultAccuracy = el('strong');
  for (const [label, value] of [['せいかい', resultCorrect], ['まちがい', resultIncorrect], ['時間切れ', resultTimedOut], ['せいかいりつ', resultAccuracy]]) {
    const row = el('p', '', label); row.append(value); result.append(row);
  }
  const replay = el('button', 'tc-primary', 'もういちど'); replay.type = 'button'; replay.dataset.action = 'replay'; result.append(replay);
  on(replay, 'click', () => { if (active && !getSnapshot().paused) onReplay(); });
  doc.body.append(root);

  return {
    root,
    canvas,
    update(state, companionState) {
      if (!active) return;
      const problem = state.problem;
      if (problem && shownProblemId !== problem.problemId) {
        shownProblemId = problem.problemId; prompt.textContent = problem.prompt;
        problem.choices.forEach((choice, index) => {
          choiceButtons[index].textContent = `${index + 1}. ${choice.text}`;
          choiceButtons[index].dataset.choiceId = choice.choiceId;
        });
      }
      const canAnswer = !state.paused && state.phase === 'answering';
      choiceButtons.forEach(button => { button.disabled = !canAnswer; button.dataset.status = ''; });
      if (state.lastAnswer) {
        const correctChoice = problem?.choices.find(choice => choice.choiceId === state.lastAnswer.correctChoiceId);
        for (const button of choiceButtons) {
          if (button.dataset.choiceId === state.lastAnswer.correctChoiceId) button.dataset.status = 'correct';
          else if (button.dataset.choiceId === state.lastAnswer.choiceId) button.dataset.status = 'incorrect';
        }
        feedback.textContent = state.lastAnswer.reason === 'timeout'
          ? `時間切れ。こたえは「${correctChoice?.text ?? ''}」だよ`
          : state.lastAnswer.correct ? 'せいかい！' : `こたえは「${correctChoice?.text ?? ''}」だよ`;
      } else feedback.textContent = '';
      const remaining = Math.max(0, state.remainingMs);
      const percent = state.deadlineMs > 0 ? Math.min(100, remaining / state.deadlineMs * 100) : 0;
      timerLabel.textContent = `のこり ${(remaining / 1000).toFixed(1)} 秒`;
      timerTrack.setAttribute('aria-valuemax', String(state.deadlineMs));
      timerTrack.setAttribute('aria-valuenow', String(Math.round(remaining)));
      timerBar.style.width = `${percent}%`;
      timerTrack.hidden = state.phase !== 'answering'; timerLabel.hidden = state.phase !== 'answering';
      next.hidden = state.phase !== 'feedback'; next.disabled = state.paused;
      pause.hidden = !state.paused;
      position.textContent = `${Math.min(10, state.answered + (state.phase === 'answering' ? 1 : 0))} / 10`;
      score.textContent = `せいかい ${state.correct}`;
      controls.hidden = !!state.result; result.hidden = !state.result;
      play.style.display = state.result ? 'flex' : '';
      play.style.justifyContent = state.result ? 'center' : '';
      if (state.result) {
        resultCorrect.textContent = `${state.result.correct} / 10`;
        resultIncorrect.textContent = String(state.result.incorrect);
        resultTimedOut.textContent = String(state.result.timedOut);
        resultAccuracy.textContent = `${Math.round(state.result.accuracy * 100)}%`;
      }
      companion.hidden = !companionState.selected;
      caption.textContent = companionState.motion?.imageState === 'failed' ? '仲間といっしょに！' : 'ジャガイモスライム';
    },
    stopInput() { active = false; [...choiceButtons, next, replay, back].forEach(button => { button.disabled = true; }); },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); root?.remove(); root = null; },
  };
}
