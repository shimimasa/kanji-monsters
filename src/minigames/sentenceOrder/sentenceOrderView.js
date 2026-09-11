const CSS = `
#sentenceOrderScreen{position:fixed;inset:0;z-index:100010;background:#f4f7ef;color:#263126;overflow:auto;overscroll-behavior:contain;font:18px system-ui,sans-serif;box-sizing:border-box;padding:12px max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom));touch-action:manipulation}
#sentenceOrderScreen *{box-sizing:border-box}#sentenceOrderScreen [hidden]{display:none!important}
#sentenceOrderScreen .so-shell{max-width:760px;margin:0 auto}#sentenceOrderScreen header{display:flex;gap:12px;align-items:center;justify-content:space-between;position:sticky;top:-12px;z-index:2;background:#f4f7ef;padding:4px 0}
#sentenceOrderScreen h1{font-size:clamp(20px,5vw,28px);margin:0}#sentenceOrderScreen button{min-width:44px;min-height:44px;border:2px solid #57715b;border-radius:11px;background:#fff;color:#263126;font:inherit;padding:9px 13px;cursor:pointer}
#sentenceOrderScreen button:disabled{opacity:.52;cursor:default}#sentenceOrderScreen button:focus-visible{outline:3px solid #8a4b00;outline-offset:2px}.so-progress{display:flex;justify-content:space-between;gap:12px;margin:10px 0;font-weight:700}.so-pause{color:#795b17;margin:8px 0}
#sentenceOrderScreen .so-play{display:grid;grid-template-columns:minmax(0,1fr) 190px;gap:16px;align-items:start}.so-prompt{text-align:center;margin:8px 0}.so-help{text-align:center;margin:4px 0 10px;color:#495d4d;font-size:15px}
#sentenceOrderScreen .so-chunks{display:flex;gap:8px;align-items:stretch;justify-content:center;flex-wrap:wrap;margin:10px 0;min-height:58px}.so-chunk{min-height:52px;max-width:100%;overflow-wrap:anywhere}.so-chunk[aria-pressed=true]{background:#fff0cb;border-color:#9b5c00;box-shadow:0 0 0 2px #e2a72e}
#sentenceOrderScreen .so-moves{display:flex;gap:10px;justify-content:center;margin:10px 0}.so-moves button{flex:0 1 180px}.so-feedback{min-height:54px;margin:9px 0;line-height:1.5}.so-feedback strong{display:block}.so-actions{text-align:center}.so-primary{background:#376a43!important;color:#fff!important;border-color:#376a43!important;min-width:180px!important}
#sentenceOrderScreen .so-companion{pointer-events:none;text-align:center;margin:0;padding-top:4px;color:#55665a;font-size:14px}.so-companion canvas{display:block;width:180px;height:90px;max-width:100%;margin:auto}.so-result{text-align:center;padding:12px}.so-result h2{font-size:28px}.so-result p{font-size:19px;margin:10px}.so-result strong{display:block;font-size:28px}
@media(max-width:540px){#sentenceOrderScreen .so-play{grid-template-columns:1fr}.so-companion{padding:0}.so-companion canvas{width:140px;height:70px}.so-chunk{flex:1 1 calc(50% - 8px)}.so-prompt{margin:4px 0}}
@media(max-height:430px) and (min-width:541px){#sentenceOrderScreen .so-prompt,.so-help,.so-progress,.so-feedback,.so-moves{margin:3px 0}.so-chunk{min-height:44px;padding:5px 9px}.so-companion canvas{width:120px;height:60px}.so-result{padding:4px}}
`;

export function createSentenceOrderView({ document: doc, dispatch, onBack, onReplay, getSnapshot }) {
  let active = true, root = null, shownProblemId = null, selectedChunkId = null, refocusSelected = false;
  const removes = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const el = (tag, className = '', text = '') => {
    const node = doc.createElement(tag); node.className = className; node.textContent = text; return node;
  };
  root = el('section'); root.id = 'sentenceOrderScreen'; root.setAttribute('aria-label', '文ならべ');
  const style = el('style'); style.textContent = CSS; root.append(style);
  const shell = el('div', 'so-shell'); root.append(shell);
  const header = el('header'); shell.append(header); header.append(el('h1', '', '文ならべ'));
  const back = el('button', '', 'もどる'); back.type = 'button'; back.dataset.action = 'back'; header.append(back);
  on(back, 'click', () => { if (active) onBack(); });
  const progress = el('div', 'so-progress'), position = el('span'), score = el('span'); progress.append(position, score); shell.append(progress);
  const pause = el('p', 'so-pause', 'おやすみ中'); pause.hidden = true; shell.append(pause);
  const play = el('div', 'so-play'), controls = el('div'); shell.append(play); play.append(controls);
  const prompt = el('p', 'so-prompt'); prompt.dataset.role = 'problem'; controls.append(prompt);
  const help = el('p', 'so-help', '文節を選び、左右のボタンか矢印キーで動かします。Enterで決定します。'); controls.append(help);
  const chunkArea = el('div', 'so-chunks'); chunkArea.setAttribute('aria-label', '現在の文節の並び'); controls.append(chunkArea);
  const chunkButtons = Array.from({ length: 6 }, (_, index) => {
    const button = el('button', 'so-chunk'); button.type = 'button'; button.dataset.chunkPosition = String(index + 1);
    chunkArea.append(button); return button;
  });
  const select = button => {
    const state = getSnapshot();
    if (!active || state.paused || state.phase !== 'answering' || !state.attemptId || button.hidden) return false;
    selectedChunkId = button.dataset.chunkId; refocusSelected = true; return true;
  };
  chunkButtons.forEach(button => on(button, 'click', () => {
    if (select(button)) updateSelection();
  }));
  const identity = state => ({
    sessionId: state.sessionId, problemId: state.problem.problemId, attemptId: state.attemptId,
  });
  const move = direction => {
    const state = getSnapshot();
    if (!active || state.paused || state.phase !== 'answering' || !state.attemptId || !selectedChunkId) return false;
    refocusSelected = true;
    return dispatch({ type: 'reorder', payload: { ...identity(state), chunkId: selectedChunkId, direction } });
  };
  const submit = () => {
    const state = getSnapshot();
    if (!active || state.paused || state.phase !== 'answering' || !state.attemptId) return false;
    return dispatch({ type: 'submit', payload: identity(state) });
  };
  const moves = el('div', 'so-moves'), left = el('button', '', '← 左へ'), right = el('button', '', '右へ →');
  left.type = right.type = 'button'; left.dataset.action = 'move-left'; right.dataset.action = 'move-right';
  moves.append(left, right); controls.append(moves);
  on(left, 'click', () => move('left')); on(right, 'click', () => move('right'));
  const feedback = el('p', 'so-feedback'); feedback.setAttribute('aria-live', 'polite'); controls.append(feedback);
  const actions = el('div', 'so-actions'), submitButton = el('button', 'so-primary', 'これで決定');
  submitButton.type = 'button'; submitButton.dataset.action = 'submit'; actions.append(submitButton); controls.append(actions);
  on(submitButton, 'click', submit);
  const next = el('button', 'so-primary', '次へ'); next.type = 'button'; next.dataset.action = 'next'; actions.append(next);
  on(next, 'click', () => {
    const state = getSnapshot();
    if (active && !state.paused && state.phase === 'feedback') dispatch({
      type: 'next', payload: { sessionId: state.sessionId, problemId: state.problem.problemId },
    });
  });
  on(doc, 'keydown', event => {
    if (!active || event.defaultPrevented || event.repeat || event.isComposing ||
        event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Enter' && ['back', 'next', 'replay'].includes(event.target?.dataset?.action)) return;
    let accepted = false;
    if (event.key === 'ArrowLeft') accepted = move('left');
    else if (event.key === 'ArrowRight') accepted = move('right');
    else if (event.key === 'Enter') accepted = submit();
    if (accepted) event.preventDefault();
  });
  const companion = el('figure', 'so-companion'), canvas = el('canvas'); canvas.width = 280; canvas.height = 140;
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', '仲間のジャガイモスライム');
  const caption = el('figcaption', '', 'ジャガイモスライム'); companion.append(canvas, caption); play.append(companion);
  const result = el('div', 'so-result'); result.hidden = true; shell.append(result); result.append(el('h2', '', '10問 おつかれさま！'));
  const finalFeedback = el('p', 'so-feedback'); finalFeedback.setAttribute('aria-live', 'polite'); result.append(finalFeedback);
  const resultCorrect = el('strong'), resultIncorrect = el('strong'), resultAccuracy = el('strong');
  for (const [label, value] of [['せいかい', resultCorrect], ['まちがい', resultIncorrect], ['せいかいりつ', resultAccuracy]]) {
    const row = el('p', '', label); row.append(value); result.append(row);
  }
  const replay = el('button', 'so-primary', 'もういちど'); replay.type = 'button'; replay.dataset.action = 'replay'; result.append(replay);
  on(replay, 'click', () => { if (active && !getSnapshot().paused) onReplay(); });
  doc.body.append(root);

  const updateSelection = () => {
    const state = getSnapshot(), selectedIndex = state.currentOrder.indexOf(selectedChunkId);
    chunkButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.chunkId === selectedChunkId)));
    const canMove = active && !state.paused && state.phase === 'answering' && selectedIndex >= 0;
    left.disabled = !canMove || selectedIndex === 0;
    right.disabled = !canMove || selectedIndex === state.currentOrder.length - 1;
  };

  return {
    root,
    canvas,
    update(state, companionState) {
      if (!active) return;
      const problem = state.problem;
      if (problem && shownProblemId !== problem.problemId) {
        shownProblemId = problem.problemId; selectedChunkId = state.currentOrder[0] ?? null; prompt.textContent = problem.prompt;
      }
      const chunksById = new Map(problem?.chunks.map(chunk => [chunk.chunkId, chunk]) ?? []);
      chunkButtons.forEach((button, index) => {
        const chunkId = state.currentOrder[index], chunk = chunksById.get(chunkId);
        button.hidden = !chunk; button.disabled = state.paused || state.phase !== 'answering';
        button.dataset.chunkId = chunkId ?? ''; button.textContent = chunk?.text ?? '';
      });
      updateSelection();
      if (refocusSelected) {
        chunkButtons.find(button => button.dataset.chunkId === selectedChunkId)?.focus(); refocusSelected = false;
      }
      if (state.lastAnswer) {
        const correctText = state.lastAnswer.correctOrder.map(chunkId => chunksById.get(chunkId)?.text ?? '').join(' ');
        feedback.textContent = state.lastAnswer.correct ? 'せいかい！' : `おしい！ 正しい文：${correctText}`;
      } else feedback.textContent = '';
      const answering = state.phase === 'answering';
      submitButton.hidden = !answering; submitButton.disabled = state.paused;
      next.hidden = state.phase !== 'feedback'; next.disabled = state.paused;
      pause.hidden = !state.paused;
      position.textContent = `${Math.min(10, state.answered + (answering ? 1 : 0))} / 10`;
      score.textContent = `せいかい ${state.correct}`;
      controls.hidden = !!state.result; result.hidden = !state.result;
      play.style.display = state.result ? 'flex' : '';
      play.style.justifyContent = state.result ? 'center' : '';
      if (state.result) {
        resultCorrect.textContent = `${state.result.correct} / 10`;
        resultIncorrect.textContent = String(state.result.incorrect);
        resultAccuracy.textContent = `${Math.round(state.result.accuracy * 100)}%`;
        const correctText = state.lastAnswer?.correctOrder.map(chunkId => chunksById.get(chunkId)?.text ?? '').join(' ');
        finalFeedback.textContent = state.lastAnswer?.correct ? '最後の問題もせいかい！' : `最後の問題の正しい文：${correctText}`;
      }
      companion.hidden = !companionState.selected;
      caption.textContent = companionState.motion?.imageState === 'failed' ? '仲間といっしょに！' : 'ジャガイモスライム';
    },
    stopInput() {
      active = false;
      [...chunkButtons, left, right, submitButton, next, replay, back].forEach(button => { button.disabled = true; });
    },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); root?.remove(); root = null; },
  };
}
