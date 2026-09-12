const CSS = `
#multiSelectScreen{position:fixed;inset:0;z-index:100010;background:#f4f7ee;color:#23331f;overflow:auto;overscroll-behavior:contain;font:18px system-ui,sans-serif;box-sizing:border-box;padding:12px max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom));touch-action:manipulation}
#multiSelectScreen *{box-sizing:border-box}#multiSelectScreen [hidden]{display:none!important}.ms-shell{max-width:760px;margin:0 auto}.ms-header{display:flex;gap:12px;align-items:center;justify-content:space-between;position:sticky;top:-12px;z-index:2;background:#f4f7ee;padding:4px 0}.ms-header h1{font-size:clamp(20px,5vw,28px);margin:0}
#multiSelectScreen button{min-width:44px;min-height:44px;border:2px solid #42633a;border-radius:11px;background:#fff;color:#23331f;font:inherit;padding:9px 14px;cursor:pointer}#multiSelectScreen button:disabled{opacity:.62;cursor:default}#multiSelectScreen button:focus-visible{outline:3px solid #8b4d13;outline-offset:2px}.ms-progress{display:flex;justify-content:space-between;gap:12px;margin:10px 0;font-weight:700}.ms-pause{color:#704b16;margin:8px 0}.ms-play{display:grid;grid-template-columns:minmax(0,1fr) 190px;gap:16px;align-items:start}.ms-prompt{font-size:clamp(23px,5vw,34px);font-weight:800;text-align:center;margin:12px 0}.ms-help{text-align:center;margin:5px 0 12px;color:#50634b}.ms-choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.ms-choice{width:100%;min-height:56px;text-align:left}.ms-choice[aria-pressed=true]{background:#e1f0d9;border-width:4px;padding:7px 12px}.ms-choice[data-status=selected-correct]{background:#d7f3dc;border-color:#27723c}.ms-choice[data-status=selected-wrong]{background:#ffe0dc;border-color:#9b332d}.ms-choice[data-status=missed-correct]{background:#fff3bd;border-color:#8b6811}.ms-actions{display:flex;justify-content:center;margin-top:12px}.ms-primary{background:#376a43!important;color:#fff!important;border-color:#376a43!important;min-width:150px!important}.ms-feedback{min-height:64px;margin:10px 0;line-height:1.5}.ms-feedback strong{display:block;font-size:22px}.ms-companion{pointer-events:none;text-align:center;margin:0;padding-top:4px;color:#50634b;font-size:14px}.ms-companion canvas{display:block;width:180px;height:90px;max-width:100%;margin:auto}.ms-result{text-align:center;padding:12px}.ms-result h2{font-size:28px}.ms-result p{font-size:19px;margin:10px}.ms-result strong{display:block;font-size:26px}
@media(max-width:540px){.ms-play{grid-template-columns:1fr}.ms-companion{padding:0}.ms-companion canvas{width:140px;height:70px}.ms-choices{grid-template-columns:1fr}.ms-prompt{margin:6px 0}.ms-choice{min-height:52px}}
@media(max-height:430px) and (min-width:541px){.ms-prompt{font-size:25px;margin:2px 0}.ms-help,.ms-progress,.ms-feedback{margin:3px 0}.ms-choice{min-height:44px;padding:5px}.ms-companion canvas{width:120px;height:60px}.ms-result{padding:4px}}
`;

export function createMultiSelectView({ document: doc, onBack, onReplay, dispatch, getSnapshot }) {
  let active = true, root = null, shownProblemId = null;
  const removes = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const el = (tag, className = '', text = '') => {
    const node = doc.createElement(tag); node.className = className; node.textContent = text; return node;
  };
  root = el('section'); root.id = 'multiSelectScreen'; root.setAttribute('aria-label', 'えらんで完成');
  const style = el('style'); style.textContent = CSS; root.append(style);
  const shell = el('div', 'ms-shell'); root.append(shell);
  const header = el('header', 'ms-header'); shell.append(header); header.append(el('h1', '', 'えらんで完成'));
  const back = el('button', '', 'もどる'); back.type = 'button'; back.dataset.action = 'back'; header.append(back);
  on(back, 'click', () => { if (active) onBack(); });
  const progress = el('div', 'ms-progress'), position = el('span'), score = el('span'); progress.append(position, score); shell.append(progress);
  const pause = el('p', 'ms-pause', 'おやすみ中'); pause.hidden = true; shell.append(pause);
  const play = el('div', 'ms-play'), controls = el('div'); shell.append(play); play.append(controls);
  const help = el('p', 'ms-help', 'あてはまるものをすべて選んで、決定しよう（数字キーでも選べます）'); controls.append(help);
  const prompt = el('div', 'ms-prompt'); prompt.dataset.role = 'problem'; controls.append(prompt);
  const choiceArea = el('div', 'ms-choices'); choiceArea.setAttribute('aria-label', '選択肢'); controls.append(choiceArea);
  const choiceButtons = Array.from({ length: 6 }, (_, index) => {
    const button = el('button', 'ms-choice'); button.type = 'button'; button.dataset.choiceIndex = String(index + 1);
    button.setAttribute('aria-pressed', 'false'); choiceArea.append(button); return button;
  });
  const toggle = index => {
    const state = getSnapshot(), choice = state.problem?.choices[index];
    if (!active || state.paused || state.phase !== 'answering' || !state.attemptId || !choice) return false;
    return dispatch({ type: 'toggle', payload: { sessionId: state.sessionId, problemId: state.problem.problemId,
      attemptId: state.attemptId, choiceId: choice.choiceId } });
  };
  choiceButtons.forEach((button, index) => on(button, 'click', () => toggle(index)));
  const submit = () => {
    const state = getSnapshot();
    if (!active || state.paused || state.phase !== 'answering' || !state.attemptId) return false;
    return dispatch({ type: 'submit', payload: { sessionId: state.sessionId,
      problemId: state.problem.problemId, attemptId: state.attemptId } });
  };
  const submitButton = el('button', 'ms-primary', '決定'); submitButton.type = 'button'; submitButton.dataset.action = 'submit';
  const actions = el('div', 'ms-actions'); actions.append(submitButton); controls.append(actions); on(submitButton, 'click', submit);
  on(doc, 'keydown', event => {
    if (!active || event.defaultPrevented || event.repeat || event.isComposing ||
        event.altKey || event.ctrlKey || event.metaKey) return;
    const choiceIndex = ['1', '2', '3', '4', '5', '6'].indexOf(event.key);
    if (choiceIndex >= 0 && toggle(choiceIndex)) event.preventDefault();
    else if (event.key === 'Enter' && submit()) event.preventDefault();
  });
  const feedback = el('div', 'ms-feedback'); feedback.setAttribute('aria-live', 'polite'); controls.append(feedback);
  const feedbackTitle = el('strong'), feedbackDetail = el('span'); feedback.append(feedbackTitle, feedbackDetail);
  const next = el('button', 'ms-primary', '次へ'); next.type = 'button'; next.dataset.action = 'next'; controls.append(next);
  on(next, 'click', () => {
    const state = getSnapshot();
    if (active && state.phase === 'feedback' && !state.paused) dispatch({ type: 'next',
      payload: { sessionId: state.sessionId, problemId: state.problem.problemId } });
  });
  const companion = el('figure', 'ms-companion'), canvas = el('canvas'); canvas.width = 280; canvas.height = 140;
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', '仲間のジャガイモスライム');
  const caption = el('figcaption', '', 'ジャガイモスライム'); companion.append(canvas, caption); play.append(companion);
  const result = el('div', 'ms-result'); result.hidden = true; shell.append(result); result.append(el('h2', '', '10もん おつかれさま！'));
  const resultPoints = el('strong'), resultFull = el('strong'), resultPartial = el('strong'), resultZero = el('strong');
  for (const [label, value] of [['得点率', resultPoints], ['ぜんぶ正解', resultFull], ['一部正解', resultPartial], ['0点', resultZero]]) {
    const row = el('p', '', label); row.append(value); result.append(row);
  }
  const replay = el('button', 'ms-primary', 'もういちど'); replay.type = 'button'; replay.dataset.action = 'replay'; result.append(replay);
  on(replay, 'click', () => { if (active && !getSnapshot().paused) onReplay(); });
  doc.body.append(root);

  return {
    root, canvas,
    update(state, companionState) {
      if (!active) return;
      const problem = state.problem;
      if (problem && shownProblemId !== problem.problemId) {
        shownProblemId = problem.problemId; prompt.textContent = problem.prompt;
        choiceButtons.forEach((button, index) => {
          const choice = problem.choices[index]; button.hidden = !choice;
          if (choice) { button.dataset.choiceId = choice.choiceId; button.textContent = `${index + 1}. ${choice.text}`; }
        });
      }
      const selectedIds = new Set(state.selectedChoiceIds), answer = state.lastAnswer;
      choiceButtons.forEach((button, index) => {
        const choice = problem?.choices[index], selected = choice && selectedIds.has(choice.choiceId);
        button.setAttribute('aria-pressed', String(!!selected)); button.disabled = !choice || state.paused || state.phase !== 'answering';
        button.dataset.status = '';
        if (choice) button.textContent = `${selected ? '✓ ' : ''}${index + 1}. ${choice.text}`;
        if (choice && answer) {
          const correct = answer.correctChoiceIds.includes(choice.choiceId), chosen = answer.selectedChoiceIds.includes(choice.choiceId);
          button.dataset.status = correct && chosen ? 'selected-correct' : !correct && chosen ? 'selected-wrong' : correct ? 'missed-correct' : '';
          const marker = correct && chosen ? '○ 選択した正解' : !correct && chosen ? '× 誤って選択' : correct ? '△ 選ばなかった正解' : '・';
          button.textContent = `${marker} ${choice.text}`;
        }
      });
      if (answer) {
        feedbackTitle.textContent = answer.classification === 'fullCorrect' ? 'ぜんぶ正解！' :
          answer.classification === 'partial' ? '一部正解' : '今回は0点';
        const correctTexts = problem.choices.filter(choice => answer.correctChoiceIds.includes(choice.choiceId)).map(choice => choice.text);
        feedbackDetail.textContent = `${answer.earnedPoints} / ${answer.maxPoints}点　正解: ${correctTexts.join('、')}`;
      } else { feedbackTitle.textContent = ''; feedbackDetail.textContent = ''; }
      submitButton.hidden = state.phase !== 'answering'; submitButton.disabled = state.paused;
      next.hidden = state.phase !== 'feedback'; next.disabled = state.paused; pause.hidden = !state.paused;
      position.textContent = `${Math.min(10, state.answered + (state.phase === 'answering' ? 1 : 0))} / 10`;
      score.textContent = `合計 ${state.totalPoints} / ${state.maxPoints || 0}点`;
      controls.hidden = !!state.result; result.hidden = !state.result; play.style.display = state.result ? 'flex' : '';
      play.style.justifyContent = state.result ? 'center' : '';
      if (state.result) {
        resultPoints.textContent = `${Math.round(state.result.scoreRate * 100)}%`;
        resultFull.textContent = `${state.result.fullCorrect} / 10`;
        resultPartial.textContent = String(state.result.partial); resultZero.textContent = String(state.result.incorrect);
      }
      companion.hidden = !companionState.selected;
      caption.textContent = companionState.motion?.imageState === 'failed' ? '仲間といっしょに！' : 'ジャガイモスライム';
    },
    stopInput() { active = false; [...choiceButtons, submitButton, next, replay, back].forEach(button => { button.disabled = true; }); },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); root?.remove(); root = null; },
  };
}
