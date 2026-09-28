import { element, button } from './adventureUI.js';
import { learningBanks, summarizeLearning, filterLearningEntries, searchPracticeIds, notebookContext } from '../minigames/learningNotebook.js';

export function createLearningNotebookDialog({ doc, services, canReview, onReview, onClose, initialContext }) {
  let restored = notebookContext(initialContext);
  const selectedIds = new Set();
  const dialog = element(doc, 'dialog', 'yt-companion-dialog yt-memory-dialog yt-learning-notebook');
  dialog.setAttribute('aria-label', '学習ノート');
  const header = element(doc, 'div', 'yt-picker-header');
  header.append(element(doc, 'h2', '', '学習ノート'), button(doc, '閉じる', () => dialog.close()));
  const label = element(doc, 'label', 'yt-memory-picker', 'ゲームを選ぶ');
  const select = element(doc, 'select'); select.setAttribute('aria-label', '学習ノートのゲーム');
  for (const bank of learningBanks) {
    const option = element(doc, 'option', '', bank.title); option.value = bank.gameId; select.append(option);
  }
  label.append(select);
  const searchLabel = element(doc, 'label', 'yt-memory-picker', '記録した問題を検索');
  const search = element(doc, 'input'); search.type = 'search'; search.maxLength = 100;
  search.setAttribute('aria-label', '記録した問題を検索'); search.placeholder = 'ことば・意味・よみ';
  searchLabel.append(search);
  const clear = button(doc, '検索をクリア', () => { search.value = ''; render(); search.focus(); });
  clear.dataset.action = 'clear-notebook-search';
  const content = element(doc, 'div'); content.setAttribute('aria-live', 'polite');
  const startReview = (gameId, ids) => onReview(gameId, ids, notebookContext({ gameId, query: search.value,
    correctOpen: content.querySelector('details')?.open }));
  const selection = element(doc, 'section', 'yt-practice-selection'); selection.hidden = true;
  selection.setAttribute('aria-label', '選んだ問題');
  const selectionStatus = element(doc, 'p'); selectionStatus.setAttribute('role', 'status');
  const selectedList = element(doc, 'ul', 'yt-selected-list'); selectedList.hidden = true;
  const selectedSummary = button(doc, '選んだ問題を確認', () => {
    selectedList.hidden = !selectedList.hidden; selectedSummary.setAttribute('aria-expanded', String(!selectedList.hidden));
  });
  selectedSummary.setAttribute('aria-expanded', 'false');
  const startSelected = button(doc, '', () => startReview(select.value, [...selectedIds]), 'yt-primary');
  startSelected.dataset.action = 'practice-selected';
  const clearSelected = button(doc, '選択をすべて解除', () => { selectedIds.clear(); syncSelection(); search.focus(); });
  clearSelected.dataset.action = 'clear-practice-selection';
  const selectionActions = element(doc, 'div', 'yt-selection-actions'); selectionActions.append(startSelected, clearSelected);
  selection.append(selectionStatus, selectedSummary, selectedList, selectionActions);
  let currentEntries = [];
  function syncSelection() {
    selection.hidden = !selectedIds.size;
    const outside = [...selectedIds].filter(id => !filterLearningEntries(currentEntries.filter(e => e.id === id), search.value).length).length;
    selectionStatus.textContent = `${selectedIds.size} / 10問を選択${outside ? `（検索条件に合わない選択 ${outside}問も含む）` : ''}`;
    startSelected.textContent = `選んだ${selectedIds.size}問を練習`;
    startSelected.disabled = !canReview || !selectedIds.size;
    for (const node of content.querySelectorAll('[data-action=practice-search], [data-action=notebook-review], .yt-batch-marker')) node.hidden = !!selectedIds.size;
    for (const checkbox of content.querySelectorAll('[data-select-content]')) {
      checkbox.checked = selectedIds.has(checkbox.dataset.selectContent);
      checkbox.disabled = !canReview || (!checkbox.checked && selectedIds.size >= 10);
    }
    selectedList.replaceChildren();
    for (const id of selectedIds) {
      const entry = currentEntries.find(e => e.id === id);
      const row = element(doc, 'li'), remove = button(doc, '外す', () => { selectedIds.delete(id); syncSelection(); if (selectedIds.size) selectedSummary.focus(); else search.focus(); });
      remove.setAttribute('aria-label', `選択から外す：${entry.text}`);
      row.append(element(doc, 'span', '', entry.text), remove); selectedList.append(row);
    }
  }
  dialog.append(header, label, searchLabel, clear, element(doc, 'p', 'yt-note', 'この機能で記録した問題の、最後の回答を表示します。正解は「覚えきった」という意味ではありません。「練習に選ぶ」で最大10問を自由に選べます。検索を変えても選択は残り、ゲームを変えると解除されます。'), content, selection);
  function render() {
    content.replaceChildren();
    const bank = learningBanks.find(b => b.gameId === select.value), summary = summarizeLearning(bank, services[bank.gameId].getHistory());
    currentEntries = [...summary.pending, ...summary.correct];
    for (const id of selectedIds) if (!currentEntries.some(e => e.id === id)) selectedIds.delete(id);
    const searching = !!search.value.trim(); clear.disabled = !search.value;
    const pending = filterLearningEntries(summary.pending, search.value), correct = filterLearningEntries(summary.correct, search.value);
    const practiceIds = searchPracticeIds(summary, search.value);
    content.append(element(doc, 'p', 'yt-learning-summary', `記録あり ${summary.attempted} / ${summary.total}${bank.unit} · まだ記録なし ${summary.unseen}${bank.unit}`),
      element(doc, 'p', '', `復習する ${summary.pending.length}${bank.unit} · 最後に正解 ${summary.correct.length}${bank.unit}`));
    if (!summary.attempted) content.append(element(doc, 'p', '', 'ノートはこれから。ゲームで答えると記録が増えるよ。'));
    if (searching) {
      const status = element(doc, 'p', 'yt-search-status', `検索結果 ${pending.length + correct.length}${bank.unit}（復習 ${pending.length}・最後に正解 ${correct.length}）`);
      content.append(status);
      if (!pending.length && !correct.length) content.append(element(doc, 'p', '', '記録した問題に見つかりませんでした。別のことばで検索するか、検索をクリアしてね。'));
      else {
        const practice = button(doc, `検索結果をまとめて練習（今回${practiceIds.length}${bank.unit}）`, () => startReview(bank.gameId, practiceIds), 'yt-primary');
        practice.dataset.action = 'practice-search'; practice.disabled = !canReview; content.append(practice);
        content.append(element(doc, 'p', 'yt-note', canReview
          ? '最大10問。まちがえた問題を優先し、正解済みは最後に答えた日が古いものから選びます。「今回のまとめ練習」が出題の目印です。'
          : '練習は、冒険で相棒を見つけてから始められます。'));
      }
    }
    if (summary.pending.length && !searching) {
      const start = button(doc, `復習する（今回${Math.min(10, summary.pending.length)}${bank.unit}）`, () => {
        startReview(bank.gameId);
      }, 'yt-primary'); start.disabled = !canReview; start.dataset.action = 'notebook-review'; content.append(start);
      content.append(element(doc, 'p', 'yt-note', canReview ? '最近まちがえた問題から最大10問ずつ。正解した問題は復習の一覧から外れます。' : '復習は、冒険で相棒を見つけてから始められます。'));
    } else if (!summary.pending.length && summary.attempted) content.append(element(doc, 'p', '', '今、復習が必要な問題はありません。'));
    function list(entries) {
      const rows = element(doc, 'ul', 'yt-memory-list');
      for (const entry of entries) {
        const row = element(doc, 'li'); row.dataset.contentId = entry.id;
        row.append(element(doc, 'strong', '', entry.text), element(doc, 'p', '', entry.answer));
        if (practiceIds.includes(entry.id)) row.append(element(doc, 'p', 'yt-batch-marker', '今回のまとめ練習'));
        if (entry.timedOut) row.append(element(doc, 'small', '', '前回は時間切れ'));
        const choiceLabel = element(doc, 'label', 'yt-practice-choice'), checkbox = element(doc, 'input');
        checkbox.type = 'checkbox'; checkbox.dataset.selectContent = entry.id;
        checkbox.setAttribute('aria-label', `練習に選ぶ：${entry.text}`);
        checkbox.addEventListener('change', () => {
          if (!checkbox.checked) selectedIds.delete(entry.id);
          else if (canReview && selectedIds.size < 10) selectedIds.add(entry.id);
          syncSelection();
        });
        choiceLabel.append(checkbox, element(doc, 'span', '', '練習に選ぶ')); row.append(choiceLabel);
        const practice = button(doc, 'この問題だけ練習', () => startReview(bank.gameId, [entry.id]));
        practice.dataset.action = 'practice-one'; practice.disabled = !canReview;
        practice.setAttribute('aria-label', `この問題だけ練習：${entry.text}`);
        row.append(practice);
        rows.append(row);
      }
      return rows;
    }
    if (pending.length) content.append(element(doc, 'h3', '', '復習する問題'), list(pending));
    if (correct.length) {
      const details = element(doc, 'details'); details.open = searching || !!restored?.correctOpen;
      details.append(element(doc, 'summary', '', `最後に正解した問題（${correct.length}${bank.unit}）`), list(correct)); content.append(details);
    }
    syncSelection();
  }
  select.value = restored?.gameId || learningBanks[0].gameId; search.value = restored?.query || '';
  select.onchange = () => { restored = null; selectedIds.clear(); search.value = ''; render(); };
  search.addEventListener('input', event => { if (!event.isComposing) render(); });
  search.addEventListener('compositionend', render);
  dialog.addEventListener('close', () => { dialog.remove(); onClose?.(); }, { once: true });
  render(); return dialog;
}
