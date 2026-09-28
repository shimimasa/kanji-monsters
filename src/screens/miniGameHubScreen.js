import { publish } from '../core/eventBus.js';
import { miniGameRegistry } from '../minigames/registry.js';
import { gameExperiences } from '../minigames/gameExperiences.js';
import { gotomonService } from '../minigames/gotomonService.js';
import { element, button, companionPortrait, isolateScreen } from '../ui/adventureUI.js';
import { PLAYTEST_ENABLED, trackPlaytest } from '../playtest/developmentLogger.js';
import { englishLearningService } from '../minigames/englishChoice/englishLearningService.js';
import { timedLearningService } from '../minigames/timedChoice/timedLearningService.js';
import { sentenceLearningService } from '../minigames/sentenceOrder/sentenceLearningService.js';
import { hubRecommendations } from '../minigames/hubRecommendations.js';
import { createCompanionMemoryDialog } from '../ui/companionMemoryDialog.js';
import { createLearningNotebookDialog } from '../ui/learningNotebookDialog.js';
import { companionCourse } from '../minigames/companionCourses.js';

const PACE_KEY = 'yomitabi.minigamePace';
const readPace = () => { try { return localStorage.getItem(PACE_KEY) === 'slow' ? 'slow' : 'normal'; } catch { return 'normal'; } };
const writePace = value => { try { localStorage.setItem(PACE_KEY, value); } catch { /* A preference only. */ } };

const hub = {
  enter(props = {}) {
    this.exit();
    const doc = document, root = element(doc, 'section', 'yt-world yt-hub'); root.id = 'miniGameHub';
    root.setAttribute('aria-label', 'ミニゲーム広場');
    const wrap = element(doc, 'div', 'yt-hub-content'), header = element(doc, 'header', 'yt-hub-header');
    const heading = element(doc, 'div', 'yt-hub-heading');
    heading.append(element(doc, 'small', '', 'ヨミタビ / 旅のよりみち'), element(doc, 'h1', '', 'ミニゲーム広場'));
    const tools = element(doc, 'div', 'yt-hub-tools');
    const selected = gotomonService.getSelectedGotomon();
    if (selected) {
      const memories = button(doc, '思い出', () => this.showMemories(), 'yt-memory-open');
      memories.dataset.action = 'memories'; tools.append(memories);
    }
    const notebook = button(doc, '学習ノート', () => this.showLearningNotebook());
    notebook.dataset.action = 'learning-notebook';
    tools.append(notebook, button(doc, 'タイトルへ', () => publish('changeScreen', 'title')));
    header.append(heading, tools); wrap.append(header);
    // The companion is one slim bar: every game is played with it, so cards don't repeat it.
    const banner = element(doc, 'div', 'yt-friend-banner');
    if (selected) {
      const growth = gotomonService.getGrowth(selected.id), details = element(doc, 'div', 'yt-friend-growth');
      details.append(element(doc, 'strong', '', `${selected.name} Lv${growth.level}`));
      const track = element(doc, 'progress', 'yt-xp'); track.max = 1; track.value = growth.fraction; track.setAttribute('aria-label', '次のレベルまでの経験値');
      details.append(track, element(doc, 'small', '', growth.remaining ? `あと${growth.remaining} XPでLv${growth.level + 1}` : 'MASTER · 育ちきった旅の相棒'));
      banner.append(companionPortrait(doc, selected), details, element(doc, 'p', 'yt-friend-cheer', 'いっしょに あそぼう！'));
    }
    else banner.append(element(doc, 'p', '', '相棒は、冒険のステージをクリアして捕まえよう。'), button(doc, '冒険へ', () => publish('changeScreen', 'title'), 'yt-primary'));
    wrap.append(banner);
    const reviewCount = englishLearningService.getReviewIds().length, progress = gotomonService.getProgress();
    const suggestions = hubRecommendations({ gameIds: Object.keys(miniGameRegistry), progress, reviewCount,
      sentenceReviewCount: sentenceLearningService.getReviewIds().length, timedReviewCount: timedLearningService.getReviewIds().length });
    const grid = element(doc, 'div', 'yt-game-grid');
    for (const definition of Object.values(miniGameRegistry)) {
      const info = gameExperiences[definition.id], card = button(doc, '', () => this.selectGame(definition), 'yt-game-card');
      card.dataset.gameId = definition.id; card.dataset.arcade = String(!!info.arcade); card.style.setProperty('--accent', info.color);
      const stats = progress.games?.[definition.id];
      const art = element(doc, 'span', 'yt-card-art'); art.dataset.scene = info.scene;
      art.append(element(doc, 'span', 'yt-card-icon', info.icon));
      if (info.badge) art.append(element(doc, 'span', 'yt-card-badge', info.badge));
      if (stats?.bestRank) { const medal = element(doc, 'span', 'yt-card-medal', stats.bestRank); medal.dataset.rank = stats.bestRank; art.append(medal); }
      const body = element(doc, 'span', 'yt-card-body');
      body.append(element(doc, 'strong', 'yt-card-title', definition.title), element(doc, 'span', 'yt-card-description', info.description));
      const tags = element(doc, 'span', 'yt-card-meta');
      for (const tag of [info.genre, info.difficulty, info.time]) tags.append(element(doc, 'span', '', tag));
      body.append(tags);
      const featuredCourse = companionCourse(selected, definition.id);
      if (featuredCourse) body.append(element(doc, 'span', 'yt-card-course', `★ 得意コース：${featuredCourse.name}`));
      body.append(element(doc, 'small', 'yt-card-record', stats ? `BEST ${stats.bestScore} pt · ${stats.plays}回あそんだ` : 'はじめての記録をつくろう'));
      card.append(art, body);
      grid.append(card);
    }
    wrap.append(grid);
    if (selected && suggestions.length) {
      const recommendation = element(doc, 'section', 'yt-recommendations');
      recommendation.setAttribute('aria-label', '今日のおすすめ');
      recommendation.append(element(doc, 'h2', '', '今日のおすすめ'));
      const list = element(doc, 'div', 'yt-recommendation-list');
      for (const suggestion of suggestions) {
        const definition = miniGameRegistry[suggestion.gameId];
        const card = button(doc, '', () => this.selectGame(definition, { review: !!suggestion.review }), 'yt-recommendation');
        card.dataset.recommendation = suggestion.kind;
        card.style.setProperty('--accent', gameExperiences[definition.id].color);
        card.setAttribute('aria-label', `${suggestion.action}：${definition.title}`);
        card.append(element(doc, 'small', '', suggestion.label), element(doc, 'strong', '', definition.title),
          element(doc, 'span', '', suggestion.reason), element(doc, 'span', 'yt-recommendation-action', suggestion.action));
        list.append(card);
      }
      recommendation.append(list);
      wrap.append(recommendation);
    }
    wrap.append(element(doc, 'p', 'yt-note', '遊ぶと相棒が成長し、技が少し強くなる。新しい仲間は、本編の新しい土地で。'));
    root.append(wrap); doc.body.append(root); this.root = root; this.restore = isolateScreen(doc, root);
    grid.querySelector('button').focus({ preventScroll: true });
    if (PLAYTEST_ENABLED) trackPlaytest('hubShown', {});
    if (props?.notebookContext) this.showLearningNotebook(props.notebookContext);
  },
  showLearningNotebook(initialContext) {
    this.dialog?.close(); this.dialog?.remove();
    const dialog = createLearningNotebookDialog({ doc: document, initialContext,
      services: { englishChoice: englishLearningService, timedChoice: timedLearningService, sentenceOrder: sentenceLearningService },
      canReview: !!gotomonService.getSelectedGotomon(),
      onReview: (gameId, practiceContentIds, notebookContext) => { dialog.remove(); this.selectGame(miniGameRegistry[gameId], { review: true, practiceContentIds, notebookContext }); },
      onClose: () => this.root?.querySelector('[data-action=learning-notebook]')?.focus() });
    this.dialog = dialog; this.root.append(dialog); dialog.showModal();
  },
  showMemories() {
    this.dialog?.close(); this.dialog?.remove();
    const dialog = createCompanionMemoryDialog({ doc: document, service: gotomonService, definitions: miniGameRegistry,
      onClose: () => this.root?.querySelector('[data-action=memories]')?.focus() });
    this.dialog = dialog; this.root.append(dialog); dialog.showModal();
  },
  selectGame(definition, playOptions = {}) {
    if (PLAYTEST_ENABLED) trackPlaytest('gameChosen', {gameId:definition.id});
    this.dialog?.remove();
    const doc = document, dialog = element(doc, 'dialog', 'yt-companion-dialog');
    dialog.setAttribute('aria-label', '相棒ゴトモンを選ぶ');
    const header = element(doc, 'div', 'yt-picker-header');
    header.append(element(doc, 'h2', '', definition.title), button(doc, '閉じる', () => dialog.close()));
    dialog.append(header, element(doc, 'p', '', '今回いっしょに遊ぶ相棒を選ぼう。'));
    const guide = element(doc, 'section', 'yt-game-guide');
    guide.append(element(doc, 'h3', '', 'あそびかた'));
    const steps = element(doc, 'ol');
    for (const step of gameExperiences[definition.id].howTo) steps.append(element(doc, 'li', '', step));
    guide.append(steps);
    // Arcade games explain themselves on an intro card right before play.
    if (!gameExperiences[definition.id].arcade) dialog.append(guide);
    if (!playOptions.review && ['englishChoice', 'timedChoice', 'sentenceOrder'].includes(definition.id)) {
      dialog.append(element(doc, 'p', 'yt-note', '記録に合わせて、まちがえた問題・まだ解いていない問題・前に正解した問題を組み合わせます。'));
    }
    let sentenceLevel = 'standard';
    if (playOptions.practiceContentIds) dialog.append(element(doc, 'p', 'yt-note', '学習ノートで選んだ問題を練習します。得点や相棒の成長は増えません。'));
    else if (definition.id === 'sentenceOrder' && playOptions.review) dialog.append(element(doc, 'p', 'yt-note', '3ピース・4ピースでまちがえた文を、最大10文ずつ復習します。'));
    if (definition.id === 'sentenceOrder' && !playOptions.review) {
      const label = element(doc, 'label', 'yt-memory-picker', '文ならべのコース');
      const select = element(doc, 'select'); select.setAttribute('aria-label', '文ならべのコース');
      for (const [value, text] of [['standard', 'いつもの3ピース（120文）'], ['challenge', '4ピースに挑戦（10文）']]) {
        const option = element(doc, 'option', '', text); option.value = value; select.append(option);
      }
      select.onchange = () => { sentenceLevel = select.value; }; label.append(select); dialog.append(label,
        element(doc, 'p', 'yt-note', 'どちらも10問。挑戦コースは10文を順番を変えて出題します。得点・ランク・相棒の記録は共通です。'));
    }
    // Real-time games offer ゆっくり: slower enemies/runner for children who need time.
    let pace = readPace();
    if (gameExperiences[definition.id].paced && !playOptions.review) {
      const paceBox = element(doc, 'div', 'yt-pace'); paceBox.setAttribute('role', 'radiogroup'); paceBox.setAttribute('aria-label', 'はやさ');
      paceBox.append(element(doc, 'span', 'yt-pace-label', 'はやさ'));
      const choices = [['normal', 'ふつう', 'いつものはやさ'], ['slow', 'ゆっくり', '敵や相棒がゆっくり動く']].map(([value, label, hint]) => {
        const choice = button(doc, '', () => { pace = value; writePace(value); sync(); }, 'yt-pace-choice');
        choice.setAttribute('role', 'radio'); choice.dataset.pace = value;
        choice.append(element(doc, 'strong', '', label), element(doc, 'small', '', hint));
        paceBox.append(choice); return choice;
      });
      const sync = () => choices.forEach(choice => choice.setAttribute('aria-checked', String(choice.dataset.pace === pace)));
      sync(); dialog.append(paceBox);
    }
    const owned = gotomonService.getOwnedGotomon(), selected = gotomonService.getSelectedGotomon();
    let selectedId = selected?.id;
    const courseLabel = element(doc, 'label', 'yt-course-choice');
    const courseCheck = element(doc, 'input'); courseCheck.type = 'checkbox'; courseCheck.checked = true;
    const courseText = element(doc, 'span'); courseLabel.append(courseCheck, courseText);
    const updateCourse = () => {
      const course = !playOptions.review && !playOptions.practiceContentIds && companionCourse(owned.find(item => item.id === selectedId), definition.id);
      courseLabel.hidden = !course;
      courseText.textContent = course ? `得意コース「${course.name}」で遊ぶ · ${course.description}` : '';
      courseCheck.checked = !!course;
    };
    updateCourse();
    const message = element(doc, 'p', 'yt-note'); message.setAttribute('role', 'status');
    const begin = button(doc, selected ? `${selected.name}とスタート` : '相棒が必要です', () => {
      const result = gotomonService.setSelectedGotomon(selectedId);
      if (!result.ok) { message.textContent = '相棒を保存できませんでした。保存状態を確認して、もう一度お試しください。'; return; }
      dialog.close(); publish('changeScreen', { name: 'miniGame', props: { ...playOptions, gameId: definition.id, gotomonId: selectedId,
        courseId: courseCheck.checked && !courseLabel.hidden ? companionCourse(owned.find(item => item.id === selectedId), definition.id)?.id : null,
        ...(gameExperiences[definition.id].paced ? { pace } : {}),
        ...(definition.id === 'sentenceOrder' ? { sentenceLevel } : {}) } });
    }, 'yt-primary'); begin.dataset.action = 'start-game'; begin.disabled = !owned.length;
    const grid = element(doc, 'div', 'yt-picker-grid');
    const stats = gotomonService.getProgress().companions ?? {};
    for (const friend of owned) {
      const choice = button(doc, '', () => {
        if (PLAYTEST_ENABLED) trackPlaytest('companionChosen', {gameId:definition.id,gotomonId:friend.id});
        selectedId = friend.id;
        updateCourse();
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
    dialog.append(grid, courseLabel, message, begin, element(doc, 'p', 'yt-note', '通常コースと復習は、どの相棒でも遊べます。得意コースでも問題の正解は同じです。'));
    this.root.append(dialog); this.dialog = dialog; dialog.showModal();
    if (selected) begin.focus();
  },
  update() {},
  exit() { this.dialog?.close(); this.dialog?.remove(); this.dialog = null; this.restore?.(); this.restore = null; this.root?.remove(); this.root = null; },
};
export default hub;
