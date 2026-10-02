import { element, button, companionPortrait } from './adventureUI.js';
import { OUTFIT_ITEMS } from '../minigames/companionOutfits.js';

const PAGE = 30;

// みんなのシール帳: the child's titles, then every owned companion with how far it has come
// (stickers, きせかえ, ひみつ), so the next one to raise is easy to pick.
export function createAllStickersDialog({ doc, service, selectedId, onOpenBook, onSelect, onClose }) {
  const dialog = element(doc, 'dialog', 'yt-companion-dialog yt-all-stickers');
  dialog.setAttribute('aria-label', 'みんなのシール帳');
  const header = element(doc, 'div', 'yt-picker-header');
  header.append(element(doc, 'h2', '', 'みんなのシール帳'), button(doc, '閉じる', () => dialog.close()));
  dialog.append(header);

  // がんばりの称号: each track's newest title and the next one.
  const titles = element(doc, 'section', 'yt-title-tracks'); titles.setAttribute('aria-label', 'がんばりの称号');
  titles.append(element(doc, 'h3', '', 'がんばりの称号'));
  for (const track of service.getTitles()) {
    const row = element(doc, 'div', 'yt-title-track'); row.dataset.track = track.id;
    const last = track.next?.at ?? track.current?.at ?? 1;
    const meter = element(doc, 'progress'); meter.max = last; meter.value = Math.min(track.have, last);
    meter.setAttribute('aria-label', `${track.label}：${track.what} ${track.have}${track.unit}`);
    row.append(element(doc, 'strong', '', track.current ? track.current.name : `${track.label}の称号は まだ`), meter,
      element(doc, 'small', '', track.next ? `${track.what} あと${track.next.left}${track.unit}で「${track.next.name}」（いま ${track.have}${track.unit}）` : `ぜんぶの称号を とったよ！（${track.what} ${track.have}${track.unit}）`));
    titles.append(row);
  }
  dialog.append(titles);

  // Every companion: the chosen one first, then the ones with the most stickers.
  const cards = [...service.getCompanionCards()].sort((a, b) => (b.gotomon.id === selectedId) - (a.gotomon.id === selectedId)
    || b.stickers.total - a.stickers.total || b.friendship - a.friendship || a.gotomon.name.localeCompare(b.gotomon.name, 'ja'));
  const total = cards.reduce((sum, card) => sum + card.stickers.total, 0);
  dialog.append(element(doc, 'p', 'yt-note', `${cards.length}ひきの ゴトモンで、シール ぜんぶで ${total}まい。シールが ふえると、その子の きせかえや ひみつが ひらくよ。`));
  const list = element(doc, 'ul', 'yt-all-list'), more = button(doc, '', () => { shown += PAGE; render(); }, 'yt-all-more');
  let shown = PAGE;
  const render = () => {
    list.replaceChildren(...cards.slice(0, shown).map(card => {
      const row = element(doc, 'li', 'yt-all-card'); row.dataset.gotomonId = card.gotomon.id;
      const chips = element(doc, 'p', 'yt-all-chips');
      for (const text of [`シール ${card.stickers.total}/${service.gameCount}`, `金 ${card.stickers.gold}`, `がんばり ${card.stickers.review}`,
        `きせかえ ${card.outfits}/${OUTFIT_ITEMS.length}`, `ひみつ ${card.secrets}/${card.secretTotal}`]) chips.append(element(doc, 'span', '', text));
      const body = element(doc, 'div', 'yt-all-body');
      body.append(element(doc, 'strong', '', `${card.gotomon.name}${card.gotomon.id === selectedId ? '（いまの相棒）' : ''}`),
        element(doc, 'small', '', `Lv${card.level} · なかよし ${card.friendship}`), chips);
      const actions = element(doc, 'div', 'yt-all-actions');
      const open = button(doc, 'シール帳', () => onOpenBook?.(card.gotomon), 'yt-all-open'); open.dataset.action = 'open-book';
      actions.append(open);
      if (card.gotomon.id !== selectedId) {
        const pick = button(doc, '相棒にする', () => onSelect?.(card.gotomon), 'yt-all-pick'); pick.dataset.action = 'make-companion';
        actions.append(pick);
      }
      row.append(companionPortrait(doc, card.gotomon), body, actions);
      return row;
    }));
    more.hidden = cards.length <= shown;
    more.textContent = `もっと見る（のこり ${cards.length - shown}ひき）`;
  };
  render();
  dialog.append(list, more);
  dialog.addEventListener('close', () => { dialog.remove(); onClose?.(); }, { once: true });
  return dialog;
}
