export function createChoiceComparison(doc, className) {
  const element = (tag, text = '') => { const node = doc.createElement(tag); node.textContent = text; return node; };
  const root = element('section'); root.className = `gt-choice-comparison ${className}`; root.hidden = true;
  root.setAttribute('aria-label', '今回まちがえた問題の比較');
  const list = element('ol'); root.append(element('h3', '今回まちがえた問題'), list);
  let renderedResult = null;
  return {
    root,
    update(state) {
      root.hidden = !state.result || !state.missed?.length;
      if (!state.result || renderedResult === state.result) return;
      renderedResult = state.result; list.textContent = '';
      for (const item of state.missed || []) {
        const row = element('li'); row.dataset.missedContent = item.contentId;
        const selected = element('p', item.reason === 'timeout' ? '時間切れ（回答なし）' : `選んだ答え：${item.selectedAnswer}`);
        selected.className = 'gt-comparison-selected';
        const correct = element('p', `正しい答え：${item.meaning ?? item.reading}`); correct.className = 'gt-comparison-correct';
        row.append(element('h4', `第${item.questionNumber}問 · ${item.prompt}`), selected, correct); list.append(row);
      }
    },
  };
}
