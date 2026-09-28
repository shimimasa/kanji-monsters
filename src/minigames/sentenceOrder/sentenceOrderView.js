import { publish } from '../../core/eventBus.js';
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
#sentenceOrderScreen .so-hints{border:1px solid #779780;border-radius:12px;padding:10px;margin:10px 0;background:#fffaf0}.so-hints p{margin:8px 0 0;line-height:1.5;font-size:16px;overflow-wrap:anywhere}#sentenceOrderScreen .so-chunk[data-hint=first]::after,#sentenceOrderScreen .so-chunk[data-hint=last]::after{display:block;font-size:13px;font-weight:700;color:#275438}#sentenceOrderScreen .so-chunk[data-hint=first]::after{content:'ヒント：はじめ'}#sentenceOrderScreen .so-chunk[data-hint=last]::after{content:'ヒント：おわり'}
#sentenceOrderScreen .so-missed{text-align:left;margin-top:18px;overflow-wrap:anywhere}#sentenceOrderScreen .so-missed h3{font-size:20px}#sentenceOrderScreen .so-missed h4{font-size:16px;margin:10px 0 6px}#sentenceOrderScreen .so-missed p{font-size:16px;margin:8px 0;line-height:1.6}.so-missed-list{list-style:none;padding:0}.so-missed-list>li{border-top:1px solid #779780;padding:12px 0}.so-comparison{list-style:none;display:flex;flex-wrap:wrap;gap:6px;padding:0;margin:6px 0}.so-comparison li{border:1px solid #779780;border-radius:8px;padding:6px;font-size:16px;max-width:100%}.so-comparison .so-order-difference{background:#fff0cb;border:2px solid #9b5c00}
@media(max-width:540px){#sentenceOrderScreen .so-play{grid-template-columns:1fr}.so-companion{padding:0}.so-companion canvas{width:140px;height:70px}.so-chunk{flex:1 1 calc(50% - 8px)}.so-prompt{margin:4px 0}}
@media(max-height:430px) and (min-width:541px){#sentenceOrderScreen .so-prompt,.so-help,.so-progress,.so-feedback,.so-moves{margin:3px 0}.so-chunk{min-height:44px;padding:5px 9px}.so-companion canvas{width:120px;height:60px}.so-result{padding:4px}}
`;

export function createSentenceOrderView({ document: doc, dispatch, onBack, onReplay, getSnapshot }) {
  let active = true, root = null, shownProblemId = null, selectedChunkId = null, refocusSelected = false;
  let hintStep = 0;
  let displayedResult = null;
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
  const help = el('p', 'so-help', '板をつかんで移動。選んで「左右」でも並べ替えできます。'); controls.append(help);
  const hints = el('div', 'so-hints'), hintButton = el('button', '', 'ヒント：はじめの言葉');
  hintButton.type = 'button'; hintButton.dataset.action = 'sentence-hint';
  const hintText = el('p'); hintText.setAttribute('role', 'status'); hints.append(hintButton, hintText); controls.append(hints);
  on(hints, 'keydown', event => event.stopPropagation());
  on(hintButton, 'click', () => {
    const state = getSnapshot();
    if (!active || state.mode !== 'review' || state.paused || state.phase !== 'answering' ||
        !state.attemptId || state.problem?.problemId !== shownProblemId || hintStep >= 2) return;
    hintStep++; updateHints(state);
  });
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
  let drag = null;
  on(chunkArea, 'pointerdown', event => {
    const target = event.target.closest?.('[data-chunk-id]');
    if (!target || event.button !== 0 || !select(target)) return;
    drag = { id: target.dataset.chunkId, identity: identity(getSnapshot()), x: event.clientX, y: event.clientY, moved: false, target };
    target.setPointerCapture?.(event.pointerId); updateSelection();
  });
  on(chunkArea, 'pointermove', event => {
    if (!drag) return;
    const dx = event.clientX-drag.x, dy=event.clientY-drag.y;
    if (Math.hypot(dx,dy)>8) drag.moved=true;
    if (drag.moved) {
      drag.target.classList.add('gt-dragging'); drag.target.style.translate=`${dx}px ${dy}px`;
      // Hit-test the other planks, not the lifted piece itself.
      drag.target.style.pointerEvents='none';
      const over=doc.elementFromPoint?.(event.clientX,event.clientY)?.closest?.('[data-chunk-id]');
      drag.target.style.pointerEvents='';
      for (const node of chunkButtons) node.classList.toggle('gt-drop-target',node===over);
    }
  });
  const endDrag = (event, cancelled = false) => {
    if (!drag) return;
    const moving=drag;drag=null;
    moving.target.style.pointerEvents='none';
    const over=doc.elementFromPoint?.(event.clientX,event.clientY)?.closest?.('[data-chunk-id]');
    moving.target.style.pointerEvents='';moving.target.style.translate='';moving.target.classList.remove('gt-dragging');
    for (const node of chunkButtons) node.classList.remove('gt-drop-target');
    if (!cancelled && moving.moved && over) {
      selectedChunkId=moving.id;refocusSelected=true;
      if(dispatch({type:'place',payload:{...moving.identity,chunkId:moving.id,to:getSnapshot().currentOrder.indexOf(over.dataset.chunkId)}})) {
        publish('playSE','decide');
        const landed=chunkButtons.find(node=>node.dataset.chunkId===moving.id);
        if(landed){landed.classList.remove('gt-landed');void landed.offsetWidth;landed.classList.add('gt-landed');}
      }
    }
  };
  on(chunkArea,'pointerup',event=>endDrag(event));on(chunkArea,'pointercancel',event=>endDrag(event,true));
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
  const result = el('div', 'so-result'); result.hidden = true; shell.append(result); const resultHeading = el('h2'); result.append(resultHeading);
  const finalFeedback = el('p', 'so-feedback'); finalFeedback.setAttribute('aria-live', 'polite'); result.append(finalFeedback);
  const missedSection = el('section', 'so-missed'), missedList = el('ol', 'so-missed-list'); missedSection.hidden = true;
  missedSection.setAttribute('aria-label', '今回まちがえた文の比較');
  missedSection.append(el('h3', '', '今回まちがえた文'), missedList); result.append(missedSection);
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

  const updateHints = state => {
    hints.hidden = state.mode !== 'review' || !!state.result;
    hintButton.disabled = state.paused || state.phase !== 'answering' || hintStep >= 2;
    hintButton.textContent = hintStep === 0 ? 'ヒント：はじめの言葉' : hintStep === 1 ? 'ヒント：おわりの言葉' : 'ヒントを確認したよ';
    const problem = state.problem, first = problem?.correctOrder[0], last = problem?.correctOrder.at(-1);
    const textFor = id => problem?.chunks.find(chunk => chunk.chunkId === id)?.text || '';
    const text = hintStep === 0 ? '困ったら、言葉の位置をたしかめよう。' :
      `はじめは「${textFor(first)}」。${hintStep > 1 ? `おわりは「${textFor(last)}」。` : ''}自分で並べてみよう。`;
    if (hintText.textContent !== text) hintText.textContent = text;
    for (const button of chunkButtons) {
      const id = button.dataset.chunkId;
      const marker = state.mode === 'review' && hintStep > 0 && id === first ? 'first' :
        state.mode === 'review' && hintStep > 1 && id === last ? 'last' : '';
      button.dataset.hint = marker;
      button.setAttribute('aria-label', `${textFor(id)}${marker ? `（ヒント：${marker === 'first' ? 'はじめ' : 'おわり'}）` : ''}`);
    }
  };

  return {
    root,
    canvas,
    update(state, companionState) {
      if (!active) return;
      const problem = state.problem;
      if (problem && shownProblemId !== problem.problemId) {
        hintStep = 0;
        shownProblemId = problem.problemId; selectedChunkId = state.currentOrder[0] ?? null; prompt.textContent = problem.prompt;
      }
      const chunksById = new Map(problem?.chunks.map(chunk => [chunk.chunkId, chunk]) ?? []);
      chunkButtons.forEach((button, index) => {
        const chunkId = state.currentOrder[index], chunk = chunksById.get(chunkId);
        button.hidden = !chunk; button.disabled = state.paused || state.phase !== 'answering';
        button.dataset.chunkId = chunkId ?? ''; button.textContent = chunk?.text ?? '';
      });
      updateSelection();
      updateHints(state);
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
      position.textContent = `${Math.min(state.totalQuestions, state.answered + (answering ? 1 : 0))} / ${state.totalQuestions}`;
      score.textContent = `せいかい ${state.correct}`;
      controls.hidden = !!state.result; result.hidden = !state.result;
      play.style.display = state.result ? 'flex' : '';
      play.style.justifyContent = state.result ? 'center' : '';
      if (state.result) {
        if (displayedResult !== state.result) {
          displayedResult = state.result; missedList.textContent = '';
          missedSection.hidden = !state.missed?.length;
          for (const item of state.missed || []) {
            const row = el('li'); row.dataset.missedContent = item.contentId;
            row.append(el('h4', '', `第${item.questionNumber}問 · ${item.correctParts.length}ピース`));
            for (const [label, parts, submitted] of [['あなたの並び', item.submittedParts, true], ['正しい並び', item.correctParts, false]]) {
              const list = el('ol', 'so-comparison'); list.setAttribute('aria-label', label);
              row.append(el('p', '', label), list);
              parts.forEach((text, index) => {
                const differs = submitted && text !== item.correctParts[index];
                list.append(el('li', differs ? 'so-order-difference' : '', `${index + 1}. ${text}${differs ? '（位置を確認）' : ''}`));
              });
            }
            row.append(el('p', 'so-missed-explanation', item.explanation)); missedList.append(row);
          }
        }
        resultHeading.textContent = `${state.totalQuestions}問 おつかれさま！`;
        resultCorrect.textContent = `${state.result.correct} / ${state.totalQuestions}`;
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
      [...chunkButtons, left, right, submitButton, next, replay, back, hintButton].forEach(button => { button.disabled = true; });
    },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); root?.remove(); root = null; },
  };
}
