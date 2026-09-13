import { element, button, companionPortrait, isolateScreen } from '../ui/adventureUI.js';
import { gotomonService } from '../minigames/gotomonService.js';

export function createAdventureTitle({ document: doc = document, playerName, onStart, onHub, onSettings, onSlots, onDex, onResume, onReset }) {
  const root = element(doc, 'section', 'yt-world yt-title'); root.id = 'adventureTitle';
  root.setAttribute('aria-label', 'ヨミタビ タイトル');
  const content = element(doc, 'div', 'yt-title-content'); root.append(content);
  content.append(element(doc, 'p', 'yt-eyebrow', 'ことばを読んで、まだ見ぬ仲間に会いに。'));
  const logo = element(doc, 'img', 'yt-logo'); logo.src = '/assets/images/logo.png'; logo.alt = 'ヨミタビ ゴトモン'; content.append(logo);
  const landscape = element(doc, 'div', 'yt-landscape'); landscape.setAttribute('aria-hidden', 'true');
  const friend = gotomonService.getSelectedGotomon();
  landscape.append(element(doc, 'span', 'yt-mountain'), element(doc, 'span', 'yt-path'), element(doc, 'span', 'yt-flag', '⚑'));
  if (friend) landscape.append(companionPortrait(doc, friend));
  content.append(landscape);
  content.append(element(doc, 'p', 'yt-welcome', playerName ? `${playerName}さん、旅のつづきを。` : '読むたび、世界が広がる。'));
  const actions = element(doc, 'div', 'yt-title-actions');
  const start = button(doc, playerName ? 'つづきから' : '冒険をはじめる', onStart, 'yt-primary'); start.id = 'titleAdventureButton';
  const hub = button(doc, 'ミニゲーム', onHub, 'yt-secondary'); hub.id = 'titleMiniGameButton';
  actions.append(start, hub); content.append(actions);
  content.append(element(doc, 'p', 'yt-note', friend ? `${friend.name}と、ミニゲームでも冒険しよう。` : '冒険で捕まえたゴトモンが、ミニゲームの相棒になる。'));
  const links = element(doc, 'nav', 'yt-title-links'); links.setAttribute('aria-label', '補助メニュー');
  links.append(button(doc, 'ゴトモン図鑑', onDex), button(doc, 'せってい', onSettings), button(doc, 'だれが あそぶ？', onSlots));
  if (onResume) links.append(button(doc, 'まえの場所から', onResume));
  if (onReset) {
    const details = element(doc, 'details'); details.append(element(doc, 'summary', '', 'データ管理'), button(doc, 'はじめから（全データリセット）', onReset)); links.append(details);
  }
  content.append(links, element(doc, 'small', 'yt-credit', '© 清水 2025'));
  doc.body.append(root); const restore = isolateScreen(doc, root);
  return { root, start, dispose() { restore(); root.remove(); } };
}
