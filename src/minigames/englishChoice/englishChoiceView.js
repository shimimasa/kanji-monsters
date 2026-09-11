const CSS = `
#englishChoiceScreen{position:fixed;inset:0;z-index:100010;background:#f5f1ff;color:#29233a;overflow:auto;overscroll-behavior:contain;font:18px system-ui,sans-serif;box-sizing:border-box;padding:12px max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom));touch-action:manipulation}
#englishChoiceScreen *{box-sizing:border-box}#englishChoiceScreen [hidden]{display:none!important}
#englishChoiceScreen .ec-shell{max-width:720px;margin:0 auto}#englishChoiceScreen header{display:flex;gap:12px;align-items:center;justify-content:space-between;position:sticky;top:-12px;z-index:2;background:#f5f1ff;padding:4px 0}
#englishChoiceScreen h1{font-size:clamp(19px,4.8vw,27px);margin:0}#englishChoiceScreen button{min-width:44px;min-height:44px;border:2px solid #74658f;border-radius:11px;background:#fff;color:#29233a;font:inherit;padding:9px 14px;cursor:pointer}
#englishChoiceScreen button:disabled{opacity:.55;cursor:default}#englishChoiceScreen button:focus-visible{outline:3px solid #19766d;outline-offset:2px}.ec-progress{display:flex;justify-content:space-between;gap:12px;margin:10px 0;font-weight:700}.ec-pause{color:#6b527b;margin:8px 0}
#englishChoiceScreen .ec-play{display:grid;grid-template-columns:minmax(0,1fr) 190px;gap:16px;align-items:start}.ec-prompt{font-size:clamp(34px,9vw,54px);font-weight:800;text-align:center;margin:10px 0 16px;letter-spacing:.5px}.ec-help{text-align:center;margin:5px 0 12px;color:#594d6e}
#englishChoiceScreen .ec-choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.ec-choice{width:100%;min-height:56px}.ec-choice[data-status=correct]{background:#d9f4df;border-color:#237340}.ec-choice[data-status=incorrect]{background:#ffe1df;border-color:#a53730}.ec-feedback{min-height:32px;margin:10px 0;line-height:1.5}.ec-primary{background:#60468a!important;color:#fff!important;border-color:#60468a!important}
#englishChoiceScreen .ec-companion{pointer-events:none;text-align:center;margin:0;padding-top:4px;color:#65587b;font-size:14px}.ec-companion canvas{display:block;width:180px;height:90px;max-width:100%;margin:auto}.ec-result{text-align:center;padding:12px}.ec-result h2{font-size:28px}.ec-result p{font-size:19px;margin:10px}.ec-result strong{display:block;font-size:28px}
@media(max-width:540px){#englishChoiceScreen .ec-play{grid-template-columns:1fr}.ec-companion{padding:0}.ec-companion canvas{width:140px;height:70px}.ec-prompt{margin:4px 0 10px}.ec-choice{min-height:52px}}
@media(max-height:430px) and (min-width:541px){#englishChoiceScreen .ec-prompt{font-size:34px;margin:2px 0}.ec-help,.ec-progress,.ec-feedback{margin:3px 0}.ec-choice{min-height:44px;padding:5px}.ec-companion canvas{width:130px;height:65px}.ec-result{padding:4px}}
`;

export function createEnglishChoiceView({ document: doc, onBack, onReplay, onNext, onAnswer, getSnapshot }) {
  let active = true, root = null, shownProblemId = null;
  const removes = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const el = (tag, className = '', text = '') => {
    const node = doc.createElement(tag); node.className = className; node.textContent = text; return node;
  };
  root = el('section'); root.id = 'englishChoiceScreen'; root.setAttribute('aria-label', 'えいたんご4たく');
  const style = el('style'); style.textContent = CSS; root.append(style);
  const shell = el('div', 'ec-shell'); root.append(shell);
  const header = el('header'); shell.append(header); header.append(el('h1', '', 'えいたんご4たく'));
  const back = el('button', '', 'もどる'); back.type = 'button'; back.dataset.action = 'back'; header.append(back);
  on(back, 'click', () => { if (active) onBack(); });
  const progress = el('div', 'ec-progress'), position = el('span'), score = el('span'); progress.append(position, score); shell.append(progress);
  const pause = el('p', 'ec-pause', 'おやすみ中'); pause.hidden = true; shell.append(pause);
  const play = el('div', 'ec-play'), controls = el('div'); shell.append(play); play.append(controls);
  const help = el('p', 'ec-help', 'いみを えらんでね'); controls.append(help);
  const prompt = el('div', 'ec-prompt'); prompt.dataset.role = 'problem'; controls.append(prompt);
  const choiceArea = el('div', 'ec-choices'); choiceArea.setAttribute('aria-label', 'こたえの候補'); controls.append(choiceArea);
  const choiceButtons = Array.from({ length: 4 }, (_, index) => {
    const button = el('button', 'ec-choice'); button.type = 'button'; button.dataset.choiceIndex = String(index + 1);
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
    const index = ['1', '2', '3', '4'].indexOf(event.key);
    if (index >= 0 && choose(index)) event.preventDefault();
  });
  const feedback = el('p', 'ec-feedback'); feedback.setAttribute('aria-live', 'polite'); controls.append(feedback);
  const next = el('button', 'ec-primary', '次へ'); next.type = 'button'; next.dataset.action = 'next'; controls.append(next);
  on(next, 'click', () => {
    const state = getSnapshot();
    if (active && state.phase === 'feedback' && !state.paused) onNext(state.sessionId, state.problem.problemId);
  });
  const companion = el('figure', 'ec-companion'), canvas = el('canvas'); canvas.width = 280; canvas.height = 140;
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', '仲間のジャガイモスライム');
  const caption = el('figcaption', '', 'ジャガイモスライム'); companion.append(canvas, caption); play.append(companion);
  const result = el('div', 'ec-result'); result.hidden = true; shell.append(result); result.append(el('h2', '', '10もん おつかれさま！'));
  const resultCorrect = el('strong'), resultIncorrect = el('strong'), resultAccuracy = el('strong');
  for (const [label, value] of [['せいかい', resultCorrect], ['まちがい', resultIncorrect], ['せいかいりつ', resultAccuracy]]) {
    const row = el('p', '', label); row.append(value); result.append(row);
  }
  const replay = el('button', 'ec-primary', 'もういちど'); replay.type = 'button'; replay.dataset.action = 'replay'; result.append(replay);
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
        feedback.textContent = state.lastAnswer.correct ? 'せいかい！' : `こたえは「${correctChoice?.text ?? ''}」だよ`;
      } else feedback.textContent = '';
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
        resultAccuracy.textContent = `${Math.round(state.result.accuracy * 100)}%`;
      }
      companion.hidden = !companionState.selected;
      caption.textContent = companionState.motion?.imageState === 'failed' ? '仲間といっしょに！' : 'ジャガイモスライム';
    },
    stopInput() { active = false; choiceButtons.forEach(button => { button.disabled = true; }); },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); root?.remove(); root = null; },
  };
}
