import { element, button, companionPortrait } from './adventureUI.js';
import { stickerSummary } from '../minigames/companionStickers.js';

// The sticker book of one companion: one sticker per mini-game, grouped like the square.
// Silver: played to the end together. Gold: rank A or S. The rainbow rim: the review done after it.
export function createStickerBookDialog({ doc, service, gotomon, sections, games, experiences, onClose }) {
  const dialog = element(doc, 'dialog', 'yt-companion-dialog yt-sticker-dialog');
  dialog.setAttribute('aria-label', `${gotomon.name}のシール帳`);
  const header = element(doc, 'div', 'yt-picker-header');
  header.append(element(doc, 'h2', '', `${gotomon.name}のシール帳`), button(doc, '閉じる', () => dialog.close()));
  const stickers = service.getStickers(gotomon.id), sum = stickerSummary(stickers);
  const ids = [...new Set(sections.flatMap(section => section.games))].filter(id => games[id]);
  const who = element(doc, 'div', 'yt-sticker-who');
  const counts = element(doc, 'p', 'yt-sticker-counts');
  for (const [label, value] of [['シール', `${sum.total} / ${ids.length}`], ['金', sum.gold], ['がんばり', sum.review]]) {
    counts.append(element(doc, 'span', '', `${label} ${value}`));
  }
  who.append(companionPortrait(doc, gotomon), counts);
  const how = element(doc, 'p', 'yt-note', `${gotomon.name}と ミニゲームを さいごまで あそぶと 銀シール、ランク A 以上で 金シール。` +
    'まちがえた問題の「もじを ならべて ふくしゅう」を さいごまで やると、シールに にじの ふちが つくよ。');
  dialog.append(header, who, how);
  for (const section of sections) {
    const list = section.games.filter(id => games[id]);
    if (!list.length) continue;
    const have = list.filter(id => stickers[id]).length;
    const block = element(doc, 'section', 'yt-sticker-section');
    block.append(element(doc, 'h3', '', `${section.title}　${have} / ${list.length}`));
    const grid = element(doc, 'ul', 'yt-sticker-grid');
    for (const id of list) {
      const sticker = stickers[id], info = experiences[id], item = element(doc, 'li', 'yt-sticker');
      item.dataset.gameId = id; item.dataset.tier = sticker?.tier ?? 'none'; item.dataset.review = String(!!sticker?.review);
      const seal = element(doc, 'span', 'yt-sticker-seal', info?.icon ?? '★');
      seal.setAttribute('aria-hidden', 'true');
      const state = !sticker ? 'まだ' : `${sticker.tier === 'gold' ? '金' : '銀'}シール${sticker.review ? '・がんばり' : ''}`;
      item.setAttribute('aria-label', `${games[id].title}：${state}`);
      item.append(seal, element(doc, 'small', '', games[id].title.replace(/^ゴトモン[・ ]?/, '')));
      grid.append(item);
    }
    block.append(grid); dialog.append(block);
  }
  dialog.addEventListener('close', () => { dialog.remove(); onClose?.(); }, { once: true });
  return dialog;
}
