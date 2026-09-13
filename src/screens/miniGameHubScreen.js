import { publish } from '../core/eventBus.js';
import { miniGameRegistry } from '../minigames/registry.js';
import { gameExperiences } from '../minigames/gameExperiences.js';
import { gotomonService } from '../minigames/gotomonService.js';
import { element, button, companionPortrait, isolateScreen } from '../ui/adventureUI.js';
import { PLAYTEST_ENABLED, trackPlaytest } from '../playtest/developmentLogger.js';

const hub = {
  enter() {
    this.exit();
    const doc = document, root = element(doc, 'section', 'yt-world yt-hub'); root.id = 'miniGameHub';
    root.setAttribute('aria-label', 'ミニゲーム広場');
    const wrap = element(doc, 'div', 'yt-hub-content'), header = element(doc, 'header', 'yt-hub-header');
    header.append(element(doc, 'div', '', 'ヨミタビ / 旅のよりみち'), button(doc, 'タイトルへ', () => publish('changeScreen', 'title')));
    wrap.append(header, element(doc, 'h1', '', 'ミニゲーム広場'), element(doc, 'p', 'yt-hub-lead', '今日の相棒と、ひと勝負。'));
    const selected = gotomonService.getSelectedGotomon(), owned = gotomonService.getOwnedGotomon();
    const banner = element(doc, 'div', 'yt-friend-banner');
    if (selected) {
      const growth = gotomonService.getGrowth(selected.id), details = element(doc, 'div', 'yt-friend-growth');
      details.append(element(doc, 'strong', '', `${selected.name} Lv${growth.level}`));
      const track = element(doc, 'progress', 'yt-xp'); track.max = 1; track.value = growth.fraction; track.setAttribute('aria-label', '次のレベルまでの経験値');
      details.append(track, element(doc, 'small', '', growth.remaining ? `あと${growth.remaining} XPでLv${growth.level + 1}` : 'MASTER · 育ちきった旅の相棒'));
      banner.append(companionPortrait(doc, selected), details);
    }
    else banner.append(element(doc, 'p', '', '相棒は、冒険のステージをクリアして捕まえよう。'), button(doc, '冒険へ', () => publish('changeScreen', 'title'), 'yt-primary'));
    wrap.append(banner);
    const grid = element(doc, 'div', 'yt-game-grid'), progress = gotomonService.getProgress();
    for (const definition of Object.values(miniGameRegistry)) {
      const info = gameExperiences[definition.id], card = button(doc, '', () => this.selectGame(definition), 'yt-game-card');
      card.dataset.gameId = definition.id; card.style.setProperty('--accent', info.color);
      card.append(element(doc, 'span', 'yt-card-icon', info.icon), element(doc, 'span', 'yt-card-meta', `${info.genre} · ${info.difficulty} · ${info.time}`),
        element(doc, 'strong', 'yt-card-title', definition.title), element(doc, 'span', 'yt-card-description', info.description));
      const foot = element(doc, 'span', 'yt-card-foot');
      if (selected) foot.append(companionPortrait(doc, selected));
      foot.append(element(doc, 'span', '', selected?.name || '冒険で相棒を見つけよう'));
      const stats = progress.games?.[definition.id];
      card.append(foot, element(doc, 'small', 'yt-card-record', stats ? `${stats.bestRank || 'C'} RANK · BEST ${stats.bestScore} · ${stats.plays}回` : 'はじめての記録をつくろう'));
      grid.append(card);
    }
    wrap.append(grid, element(doc, 'p', 'yt-note', '遊ぶと相棒が成長し、技が少し強くなる。新しい仲間は、本編の新しい土地で。'));
    root.append(wrap); doc.body.append(root); this.root = root; this.restore = isolateScreen(doc, root);
    header.querySelector('button').focus();
    if (PLAYTEST_ENABLED) trackPlaytest('hubShown', {});
  },
  selectGame(definition) {
    if (PLAYTEST_ENABLED) trackPlaytest('gameChosen', {gameId:definition.id});
    this.dialog?.remove();
    const doc = document, dialog = element(doc, 'dialog', 'yt-companion-dialog');
    dialog.setAttribute('aria-label', '相棒ゴトモンを選ぶ');
    const header = element(doc, 'div', 'yt-picker-header');
    header.append(element(doc, 'h2', '', definition.title), button(doc, '閉じる', () => dialog.close()));
    dialog.append(header, element(doc, 'p', '', '今回いっしょに遊ぶ相棒を選ぼう。'));
    const owned = gotomonService.getOwnedGotomon(), selected = gotomonService.getSelectedGotomon();
    let selectedId = selected?.id;
    const message = element(doc, 'p', 'yt-note'); message.setAttribute('role', 'status');
    const begin = button(doc, selected ? `${selected.name}とスタート` : '相棒が必要です', () => {
      const result = gotomonService.setSelectedGotomon(selectedId);
      if (!result.ok) { message.textContent = '相棒を保存できませんでした。保存状態を確認して、もう一度お試しください。'; return; }
      dialog.close(); publish('changeScreen', { name: 'miniGame', props: { gameId: definition.id, gotomonId: selectedId } });
    }, 'yt-primary'); begin.dataset.action = 'start-game'; begin.disabled = !owned.length;
    const grid = element(doc, 'div', 'yt-picker-grid');
    const stats = gotomonService.getProgress().companions ?? {};
    for (const friend of owned) {
      const choice = button(doc, '', () => {
        if (PLAYTEST_ENABLED) trackPlaytest('companionChosen', {gameId:definition.id,gotomonId:friend.id});
        selectedId = friend.id;
        for (const node of grid.children) node.setAttribute('aria-pressed', String(node.dataset.gotomonId === selectedId));
        begin.textContent = `${friend.name}とスタート`;
        const growth = gotomonService.getGrowth(friend.id);
        message.textContent = `${growth.description} · ${friend.support?.name || 'マイペース'}：${friend.support?.description || 'いつでも応援'}`;
      }, 'yt-friend-choice');
      choice.dataset.gotomonId = friend.id; choice.setAttribute('aria-pressed', String(friend.id === selectedId));
      choice.append(companionPortrait(doc, friend), element(doc, 'strong', '', friend.name),
        element(doc, 'small', '', `Lv${gotomonService.getGrowth(friend.id).level} · なかよし ${stats[friend.id]?.friendship ?? 0}`)); grid.append(choice);
    }
    if (!owned.length) dialog.append(element(doc, 'p', '', 'まだ捕獲したゴトモンがいません。本編でステージをクリアし、仲間に迎えよう。'), button(doc, '冒険へ', () => publish('changeScreen', 'title')));
    dialog.append(grid, message, begin, element(doc, 'p', 'yt-note', '好きな相棒を選んでOK。答えや難しさは変わりません。'));
    this.root.append(dialog); this.dialog = dialog; dialog.showModal();
    if (selected) begin.focus();
  },
  update() {},
  exit() { this.dialog?.close(); this.dialog?.remove(); this.dialog = null; this.restore?.(); this.restore = null; this.root?.remove(); this.root = null; },
};
export default hub;
