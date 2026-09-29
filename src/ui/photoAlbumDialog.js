import { element, button, companionPortrait } from './adventureUI.js';

// Photo rally album: one page per visited stage, one card per monster of that stage.
// Taken photos show the monster, its stars and its lore; the rest stay as silhouettes.
export function createPhotoAlbumDialog({ doc, service, stages, monsterInfo, onClose }) {
  const dialog = element(doc, 'dialog', 'yt-companion-dialog yt-album-dialog');
  dialog.setAttribute('aria-label', 'ゴトモン写真アルバム');
  const header = element(doc, 'div', 'yt-picker-header');
  header.append(element(doc, 'h2', '', 'ゴトモン写真アルバム'), button(doc, '閉じる', () => dialog.close()));
  const album = service.getAlbum();
  const taken = stage => (stage.enemyIdList || []).filter(id => album[id]).length;
  const label = element(doc, 'label', 'yt-memory-picker', 'ページ');
  const select = element(doc, 'select'); select.setAttribute('aria-label', 'アルバムのページ');
  for (const stage of stages) {
    const option = element(doc, 'option', '', `${stage.name}（${taken(stage)}/${(stage.enemyIdList || []).length}まい）`);
    option.value = stage.stageId; select.append(option);
  }
  label.append(select);
  const content = element(doc, 'div', 'yt-album-content'); content.setAttribute('aria-live', 'polite');
  dialog.append(header, label, content);
  function render() {
    content.replaceChildren();
    const stage = stages.find(item => item.stageId === select.value);
    if (!stage) { content.append(element(doc, 'p', '', '写真ラリーで写真を撮ると、ここにたまっていくよ。')); return; }
    const ids = stage.enemyIdList || [], count = taken(stage);
    content.append(element(doc, 'p', 'yt-album-summary', count === ids.length && ids.length
      ? `${stage.name}のページが完成！ ${ids.length}体ぜんぶ撮れたね。` : `${stage.name}で ${count}体を撮ったよ。あと${ids.length - count}体。`));
    const grid = element(doc, 'ul', 'yt-album-grid');
    for (const id of ids) {
      const card = element(doc, 'li', 'yt-album-card'), photo = album[id], info = monsterInfo(id);
      card.dataset.monsterId = id; card.dataset.taken = String(!!photo);
      if (photo) {
        card.append(companionPortrait(doc, info), element(doc, 'strong', '', info.name),
          element(doc, 'span', 'yt-album-stars', '★'.repeat(photo.stars) + '☆'.repeat(3 - photo.stars)));
        if (info.desc || info.trivia) {
          const more = element(doc, 'details', 'yt-album-more');
          more.append(element(doc, 'summary', '', 'くわしく'));
          if (info.desc) more.append(element(doc, 'p', '', info.desc));
          if (info.trivia) more.append(element(doc, 'p', 'yt-album-trivia', `豆知識：${info.trivia}`));
          card.append(more);
        }
      } else card.append(element(doc, 'span', 'yt-album-unknown', '？'), element(doc, 'small', '', 'まだ撮っていない'));
      grid.append(card);
    }
    content.append(grid);
  }
  select.onchange = render;
  dialog.addEventListener('close', () => { dialog.remove(); onClose?.(); }, { once: true });
  render(); return dialog;
}
