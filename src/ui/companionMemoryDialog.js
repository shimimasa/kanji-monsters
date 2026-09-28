import { element, button, companionPortrait } from './adventureUI.js';

export function createCompanionMemoryDialog({ doc, service, definitions, onClose }) {
  const dialog = element(doc, 'dialog', 'yt-companion-dialog yt-memory-dialog');
  dialog.setAttribute('aria-label', '相棒との思い出');
  const header = element(doc, 'div', 'yt-picker-header');
  const close = button(doc, '閉じる', () => dialog.close());
  header.append(element(doc, 'h2', '', '相棒との思い出'), close);
  const label = element(doc, 'label', 'yt-memory-picker', '相棒を選ぶ');
  const select = element(doc, 'select'); select.setAttribute('aria-label', '思い出を見る相棒');
  const owned = service.getOwnedGotomon();
  for (const friend of owned) { const option = element(doc, 'option', '', friend.name); option.value = friend.id; select.append(option); }
  select.value = service.getSelectedGotomon()?.id || owned[0]?.id || '';
  label.append(select);
  const content = element(doc, 'div', 'yt-memory-content'); content.setAttribute('aria-live', 'polite');
  dialog.append(header, label, element(doc, 'p', 'yt-note', 'この機能を使い始めてからの思い出です。短い復習は含みません。'), content);
  const date = value => new Date(value).toLocaleDateString('ja-JP');
  function render() {
    content.replaceChildren();
    const friend = owned.find(friend => friend.id === select.value);
    if (!friend) return;
    const games = service.getProgress().companions?.[friend.id]?.memories?.games || {};
    const entries = Object.entries(games).filter(([id]) => Object.hasOwn(definitions, id));
    const intro = element(doc, 'div', 'yt-memory-intro');
    intro.append(companionPortrait(doc, friend), element(doc, 'strong', '', `${friend.name}と ${entries.length}種類のゲームで遊んだよ`));
    content.append(intro);
    if (!entries.length) {
      content.append(element(doc, 'p', '', '思い出はこれから。相棒とゲームを遊び、結果を保存すると増えていくよ。'));
      return;
    }
    const list = element(doc, 'ul', 'yt-memory-list');
    entries.sort((a, b) => b[1].lastPlayedAt - a[1].lastPlayedAt);
    for (const [id, memory] of entries) {
      const row = element(doc, 'li'); row.dataset.memoryGame = id;
      row.append(element(doc, 'h3', '', definitions[id].title),
        element(doc, 'p', '', `一緒に遊んだ記録 ${memory.plays}回 · この相棒とのベスト ${memory.bestScore} pt`),
        element(doc, 'p', '', `はじめての記録：${date(memory.firstPlayedAt)} · 最近の記録：${date(memory.lastPlayedAt)}`),
        element(doc, 'p', '', memory.firstFinishedAt === null ? '最後まで遊ぶことに挑戦中' : `はじめて最後まで遊んだ日：${date(memory.firstFinishedAt)}`),
        element(doc, 'p', '', `ベストを記録した日：${date(memory.bestAt)}`));
      list.append(row);
    }
    content.append(list);
  }
  select.onchange = render;
  dialog.addEventListener('close', () => { dialog.remove(); onClose?.(); }, { once: true });
  render(); return dialog;
}
