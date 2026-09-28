// Keep the correct answer and one distractor, preserving the original button order.
export function choiceHintIds(problem) {
  if (!problem?.choices?.some(choice => choice.choiceId === problem.correctChoiceId)) return [];
  const others = problem.choices.filter(choice => choice.choiceId !== problem.correctChoiceId);
  if (!others.length) return [];
  let hash = 0;
  for (const character of problem.problemId || '') hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0;
  return [problem.correctChoiceId, others[hash % others.length].choiceId];
}

export function createChoiceHint({ doc, container, getSnapshot, onChange }) {
  let active = true, problemId = null, kept = null;
  const root = doc.createElement('div'); root.className = 'gt-choice-hint';
  const button = doc.createElement('button'); button.type = 'button'; button.dataset.action = 'choice-hint';
  const text = doc.createElement('p'); text.setAttribute('role', 'status'); root.append(button, text); container.append(root);
  const stopKeys = event => event.stopPropagation();
  const reveal = () => {
    const state = getSnapshot();
    if (!active || state.mode !== 'review' || state.paused || state.phase !== 'answering' || !state.attemptId ||
        state.problem?.problemId !== problemId || kept) return;
    const ids = choiceHintIds(state.problem);
    if (ids.length !== 2) return;
    kept = ids; onChange();
  };
  root.addEventListener('keydown', stopKeys); button.addEventListener('click', reveal);
  return {
    update(state) {
      if (problemId !== state.problem?.problemId) { problemId = state.problem?.problemId; kept = null; }
      root.hidden = state.mode !== 'review' || !!state.result;
      button.disabled = !active || state.paused || state.phase !== 'answering' || !!kept;
      button.textContent = kept ? 'ヒントを使ったよ' : 'ヒント：2つにしぼる';
      const message = kept ? '残った2つから選ぼう。番号はそのままだよ。' : '困ったら、選択肢を2つにできるよ。';
      if (text.textContent !== message) text.textContent = message;
    },
    excludes(state, id) { return state.mode === 'review' && problemId === state.problem?.problemId && !!kept && !kept.includes(id); },
    stopInput() { active = false; button.disabled = true; },
    dispose() { this.stopInput(); root.removeEventListener('keydown', stopKeys); button.removeEventListener('click', reveal); },
  };
}
