const CSS = `
#asyncChoiceScreen{position:fixed;inset:0;z-index:100010;background:#eef5fb;color:#1e3040;overflow:auto;overscroll-behavior:contain;font:18px system-ui,sans-serif;box-sizing:border-box;padding:12px max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom));touch-action:manipulation}
#asyncChoiceScreen *{box-sizing:border-box}#asyncChoiceScreen [hidden]{display:none!important}.ac-shell{max-width:720px;margin:0 auto}.ac-header{display:flex;gap:12px;align-items:center;justify-content:space-between;position:sticky;top:-12px;z-index:2;background:#eef5fb;padding:4px 0}.ac-header h1{font-size:clamp(20px,5vw,28px);margin:0}#asyncChoiceScreen button{min-width:44px;min-height:44px;border:2px solid #315b8a;border-radius:11px;background:#fff;color:#1e3040;font:inherit;padding:9px 14px;cursor:pointer}#asyncChoiceScreen button:disabled{opacity:.58;cursor:default}#asyncChoiceScreen button:focus-visible{outline:3px solid #a14f19;outline-offset:2px}.ac-status{text-align:center;padding:48px 12px;font-size:22px;font-weight:700}.ac-status small{display:block;font-size:16px;font-weight:400;margin-top:12px}.ac-progress{display:flex;justify-content:space-between;gap:12px;margin:10px 0;font-weight:700}.ac-pause{color:#76501a;margin:8px 0}.ac-play{display:grid;grid-template-columns:minmax(0,1fr) 190px;gap:16px;align-items:start}.ac-prompt{font-size:clamp(24px,6vw,38px);font-weight:800;text-align:center;margin:16px 0}.ac-help{text-align:center;color:#50667a}.ac-choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.ac-choice{width:100%;min-height:56px}.ac-choice[data-status=correct]{background:#d8f1de;border-color:#26703c}.ac-choice[data-status=incorrect]{background:#ffe0dc;border-color:#9b332d}.ac-feedback{min-height:42px;margin:12px 0;line-height:1.5}.ac-primary{background:#315b8a!important;color:#fff!important;border-color:#315b8a!important}.ac-companion{pointer-events:none;text-align:center;margin:0;padding-top:4px;color:#50667a;font-size:14px}.ac-companion canvas{display:block;width:180px;height:90px;max-width:100%;margin:auto}.ac-result{text-align:center;padding:12px}.ac-result h2{font-size:28px}.ac-result strong{display:block;font-size:30px;margin:12px}
@media(max-width:540px){.ac-play{grid-template-columns:1fr}.ac-companion{padding:0}.ac-companion canvas{width:140px;height:70px}.ac-choices{grid-template-columns:1fr}.ac-choice{min-height:52px}.ac-prompt{margin:8px 0}}
@media(max-height:430px) and (min-width:541px){.ac-status{padding:18px 8px}.ac-prompt{font-size:27px;margin:3px 0}.ac-help,.ac-progress,.ac-feedback{margin:3px 0}.ac-choice{min-height:44px;padding:5px}.ac-companion canvas{width:120px;height:60px}}
`;

export function createAsyncChoiceView({ document: doc, onBack, onReplay, onNext, onAnswer, getSnapshot }) {
  let active = true, root = null, shownProblemId = null;
  const removes = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const el = (tag, className = '', text = '') => { const node = doc.createElement(tag); node.className = className; node.textContent = text; return node; };
  root = el('section'); root.id = 'asyncChoiceScreen'; root.setAttribute('aria-label', 'よみこみクイズ');
  const style = el('style'); style.textContent = CSS; root.append(style);
  const shell = el('div', 'ac-shell'); root.append(shell);
  const header = el('header', 'ac-header'); shell.append(header); header.append(el('h1', '', 'よみこみクイズ'));
  const back = el('button', '', 'もどる'); back.type = 'button'; back.dataset.action = 'back'; header.append(back); on(back, 'click', () => { if (active) onBack(); });
  const loading = el('div', 'ac-status', '問題を読み込んでいます…'); loading.dataset.role = 'loading'; loading.setAttribute('role', 'status'); loading.append(el('small', '', '少し待ってね'));
  const failure = el('div', 'ac-status', '問題を読み込めませんでした'); failure.dataset.role = 'failure'; failure.setAttribute('role', 'alert'); failure.append(el('small', '', 'もどって、もう一度ためしてください'));
  shell.append(loading, failure);
  const gameArea = el('div'); shell.append(gameArea);
  const progress = el('div', 'ac-progress'), position = el('span'), score = el('span'); progress.append(position, score); gameArea.append(progress);
  const pause = el('p', 'ac-pause', 'おやすみ中'); pause.hidden = true; gameArea.append(pause);
  const play = el('div', 'ac-play'), controls = el('div'); gameArea.append(play); play.append(controls);
  controls.append(el('p', 'ac-help', '正しいものを一つ選ぼう（数字キーでも選べます）'));
  const prompt = el('div', 'ac-prompt'); prompt.dataset.role = 'problem'; controls.append(prompt);
  const choiceArea = el('div', 'ac-choices'); choiceArea.setAttribute('aria-label', '選択肢'); controls.append(choiceArea);
  const choiceButtons = Array.from({ length: 4 }, (_, index) => {
    const button = el('button', 'ac-choice'); button.type = 'button'; button.dataset.choiceIndex = String(index + 1); choiceArea.append(button); return button;
  });
  const choose = index => {
    const state = getSnapshot(), choice = state.problem?.choices[index];
    if (!active || state.paused || state.phase !== 'answering' || !state.attemptId || !choice) return false;
    return onAnswer({ sessionId: state.sessionId, problemId: state.problem.problemId,
      attemptId: state.attemptId, choiceId: choice.choiceId });
  };
  choiceButtons.forEach((button, index) => on(button, 'click', () => choose(index)));
  on(doc, 'keydown', event => {
    if (!active || event.defaultPrevented || event.repeat || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    const choiceIndex = ['1', '2', '3', '4'].indexOf(event.key);
    if (choiceIndex >= 0 && choose(choiceIndex)) event.preventDefault();
  });
  const feedback = el('p', 'ac-feedback'); feedback.setAttribute('aria-live', 'polite'); controls.append(feedback);
  const next = el('button', 'ac-primary', '次へ'); next.type = 'button'; next.dataset.action = 'next'; controls.append(next);
  on(next, 'click', () => { const state = getSnapshot(); if (active && state.phase === 'feedback' && !state.paused) onNext(state.sessionId, state.problem.problemId); });
  const companion = el('figure', 'ac-companion'), canvas = el('canvas'); canvas.width = 280; canvas.height = 140;
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', '仲間のジャガイモスライム');
  const caption = el('figcaption', '', 'ジャガイモスライム'); companion.append(canvas, caption); play.append(companion);
  const result = el('div', 'ac-result'); result.hidden = true; shell.append(result); result.append(el('h2', '', '10もん おつかれさま！'));
  const resultScore = el('strong'); result.append(resultScore);
  const replay = el('button', 'ac-primary', 'もういちど'); replay.type = 'button'; replay.dataset.action = 'replay'; result.append(replay);
  on(replay, 'click', () => { if (active && !getSnapshot().paused) onReplay(); });
  doc.body.append(root);

  return {
    root, canvas,
    update(state, companionState) {
      if (!active) return;
      loading.hidden = state.phase !== 'loading'; failure.hidden = state.phase !== 'failed';
      const showGame = ['answering', 'feedback', 'completed'].includes(state.phase); gameArea.hidden = !showGame;
      const problem = state.problem;
      if (problem && shownProblemId !== problem.problemId) {
        shownProblemId = problem.problemId; prompt.textContent = problem.prompt;
        choiceButtons.forEach((button, index) => { const choice = problem.choices[index]; button.hidden = !choice;
          if (choice) { button.dataset.choiceId = choice.choiceId; button.textContent = `${index + 1}. ${choice.text}`; } });
      }
      const canAnswer = !state.paused && state.phase === 'answering';
      choiceButtons.forEach(button => { button.disabled = !canAnswer; button.dataset.status = ''; });
      if (state.lastAnswer) {
        const correctChoice = problem?.choices.find(choice => choice.choiceId === state.lastAnswer.correctChoiceId);
        for (const button of choiceButtons) {
          if (button.dataset.choiceId === state.lastAnswer.correctChoiceId) button.dataset.status = 'correct';
          else if (button.dataset.choiceId === state.lastAnswer.choiceId) button.dataset.status = 'incorrect';
        }
        feedback.textContent = state.lastAnswer.correct ? '正解！' : `正解は「${correctChoice?.text ?? ''}」です`;
      } else feedback.textContent = '';
      next.hidden = state.phase !== 'feedback'; next.disabled = state.paused; pause.hidden = !state.paused;
      position.textContent = `${Math.min(10, state.answered + (state.phase === 'answering' ? 1 : 0))} / 10`; score.textContent = `正解 ${state.correct}`;
      result.hidden = !state.result; play.hidden = !!state.result;
      if (state.result) resultScore.textContent = `${state.result.correct} / 10 正解`;
      companion.hidden = !companionState.selected || !showGame;
      caption.textContent = companionState.motion?.imageState === 'failed' ? '仲間といっしょに！' : 'ジャガイモスライム';
    },
    stopInput() { active = false; [...choiceButtons, next, replay, back].forEach(button => { button.disabled = true; }); },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); root?.remove(); root = null; },
  };
}
