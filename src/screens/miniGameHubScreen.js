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
import { HUB_SUBJECTS, NEWEST, hubSections, choiceSubjects, modeForSubject } from '../minigames/hubCatalog.js';
import { createPhotoAlbumDialog } from '../ui/photoAlbumDialog.js';
import { createStickerBookDialog } from '../ui/stickerBookDialog.js';
import { createAllStickersDialog } from '../ui/allStickersDialog.js';
import { stickerSummary } from '../minigames/companionStickers.js';
import { stageData, getMonsterById } from '../loaders/dataLoader.js';

// Photo rally spots: elementary stages the child has reached in the adventure.
const rallyStages = () => {
  const visited = new Set(gotomonService.getVisitedStageIds());
  return stageData.filter(stage => stage.grade <= 6 && visited.has(stage.stageId) && stage.enemyIdList?.length);
};
const monsterInfo = id => ({ ...gotomonService.getGotomonById(id), desc: getMonsterById(id)?.desc || '', trivia: getMonsterById(id)?.trivia || '' });

const PACE_KEY = 'yomitabi.minigamePace';
const readPace = () => { try { return localStorage.getItem(PACE_KEY) === 'slow' ? 'slow' : 'normal'; } catch { return 'normal'; } };
const writePace = value => { try { localStorage.setItem(PACE_KEY, value); } catch { /* A preference only. */ } };
// The subject tab last chosen in the square.
const SUBJECT_KEY = 'yomitabi.hubSubject';
const readSubject = () => { try { const v = localStorage.getItem(SUBJECT_KEY); return HUB_SUBJECTS.some(item => item.id === v) ? v : 'all'; } catch { return 'all'; } };
const writeSubject = value => { try { localStorage.setItem(SUBJECT_KEY, value); } catch { /* A preference only. */ } };

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
    const allBooks = button(doc, 'みんなのシール帳', () => this.showAllStickers()); allBooks.dataset.action = 'all-stickers';
    if (selected) tools.append(allBooks);
    const albumButton = button(doc, 'アルバム', () => this.showAlbum());
    albumButton.dataset.action = 'photo-album';
    tools.append(albumButton, notebook, button(doc, 'タイトルへ', () => publish('changeScreen', 'title')));
    header.append(heading, tools); wrap.append(header);
    // The companion is one slim bar: every game is played with it, so cards don't repeat it.
    const banner = element(doc, 'div', 'yt-friend-banner');
    if (selected) {
      const growth = gotomonService.getGrowth(selected.id), details = element(doc, 'div', 'yt-friend-growth');
      details.append(element(doc, 'strong', '', `${selected.name} Lv${growth.level}`));
      const track = element(doc, 'progress', 'yt-xp'); track.max = 1; track.value = growth.fraction; track.setAttribute('aria-label', '次のレベルまでの経験値');
      details.append(track, element(doc, 'small', '', growth.remaining ? `あと${growth.remaining} XPでLv${growth.level + 1}` : 'MASTER · 育ちきった旅の相棒'));
      // The companion's sticker book: one sticker per game played to the end together.
      const sum = stickerSummary(gotomonService.getStickers(selected.id));
      const book = button(doc, `シール帳 ${sum.total}まい`, () => this.showStickerBook(), 'yt-sticker-open');
      book.dataset.action = 'sticker-book';
      banner.append(companionPortrait(doc, selected), details, book, element(doc, 'p', 'yt-friend-cheer', 'いっしょに あそぼう！'));
    }
    else banner.append(element(doc, 'p', '', '相棒は、冒険のステージをクリアして捕まえよう。'), button(doc, '冒険へ', () => publish('changeScreen', 'title'), 'yt-primary'));
    wrap.append(banner);
    // がんばりの称号: the newest title of each track, and the nearest next one.
    if (selected) {
      const tracks = gotomonService.getTitles(), row = element(doc, 'p', 'yt-title-row');
      const earned = tracks.filter(track => track.current);
      row.append(element(doc, 'span', 'yt-title-label', '称号'));
      for (const track of earned) row.append(element(doc, 'span', 'yt-title-chip', track.current.name));
      const next = tracks.filter(track => track.next).sort((a, b) => a.next.left - b.next.left)[0];
      if (next) row.append(element(doc, 'small', '', `${earned.length ? 'つぎは' : 'さいしょの 称号まで'} ${next.what} あと${next.next.left}${next.unit}で「${next.next.name}」`));
      wrap.append(row);
    }
    const reviewCount = englishLearningService.getReviewIds().length, progress = gotomonService.getProgress();
    const suggestions = hubRecommendations({ gameIds: Object.keys(miniGameRegistry), progress, reviewCount,
      sentenceReviewCount: sentenceLearningService.getReviewIds().length, timedReviewCount: timedLearningService.getReviewIds().length });
    // Today's picks come first (they used to sit under all forty cards, out of sight).
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
    // The games, by what the child wants to practice: a tab per subject (kept for next time),
    // and on ぜんぶ a section per subject, then the games where the subject is chosen.
    const games = new Map(Object.values(miniGameRegistry).map(definition => [definition.id, definition]));
    let subject = readSubject();
    const stickers = selected ? gotomonService.getStickers(selected.id) : {};
    const makeCard = definition => {
      const info = gameExperiences[definition.id], card = button(doc, '', () => this.selectGame(definition, { subject }), 'yt-game-card');
      card.dataset.gameId = definition.id; card.dataset.arcade = String(!!info.arcade); card.style.setProperty('--accent', info.color);
      const stats = progress.games?.[definition.id];
      const art = element(doc, 'span', 'yt-card-art'); art.dataset.scene = info.scene;
      art.append(element(doc, 'span', 'yt-card-icon', info.icon));
      // NEW only on the newest games, until they are played.
      if (NEWEST.includes(definition.id) && !stats) art.append(element(doc, 'span', 'yt-card-badge', 'NEW'));
      if (stats?.bestRank) { const medal = element(doc, 'span', 'yt-card-medal', stats.bestRank); medal.dataset.rank = stats.bestRank; art.append(medal); }
      // This companion's sticker for the game (silver / gold, a rainbow rim after the review).
      const sticker = stickers[definition.id];
      if (sticker) {
        const seal = element(doc, 'span', 'yt-card-sticker'); seal.dataset.tier = sticker.tier; seal.dataset.review = String(!!sticker.review);
        seal.setAttribute('aria-label', `${selected.name}の${sticker.tier === 'gold' ? '金' : '銀'}シール`); art.append(seal);
      }
      const body = element(doc, 'span', 'yt-card-body');
      body.append(element(doc, 'strong', 'yt-card-title', definition.title), element(doc, 'span', 'yt-card-description', info.description));
      const tags = element(doc, 'span', 'yt-card-meta');
      for (const tag of [info.time, info.difficulty]) tags.append(element(doc, 'span', '', tag));
      if (subject === 'all' && choiceSubjects(definition.id).length) tags.append(element(doc, 'span', 'yt-card-choice', choiceSubjects(definition.id).length === 3 ? '3教科' : '2教科'));
      body.append(tags);
      const featuredCourse = companionCourse(selected, definition.id);
      if (featuredCourse) body.append(element(doc, 'span', 'yt-card-course', `★ 得意コース：${featuredCourse.name}`));
      body.append(element(doc, 'small', 'yt-card-record', stats ? `BEST ${stats.bestScore} pt · ${stats.plays}回` : 'はじめての記録をつくろう'));
      card.append(art, body);
      return card;
    };
    const tabs = element(doc, 'div', 'yt-subject-tabs'); tabs.setAttribute('role', 'group'); tabs.setAttribute('aria-label', 'あそぶ 教科');
    const shelf = element(doc, 'div', 'yt-game-shelf');
    const tabButtons = HUB_SUBJECTS.map(item => {
      const tab = button(doc, item.label, () => { subject = item.id; writeSubject(subject); render(); }, 'yt-subject-tab');
      tab.dataset.subject = item.id; tabs.append(tab); return tab;
    });
    const render = () => {
      while (shelf.firstChild) shelf.firstChild.remove();
      for (const section of hubSections(subject)) {
        const block = element(doc, 'section', 'yt-game-section'); block.dataset.section = section.id;
        block.append(element(doc, 'h2', 'yt-section-title', `${section.title}（${section.games.length}）`));
        const grid = element(doc, 'div', 'yt-game-grid');
        for (const id of section.games) { const definition = games.get(id); if (definition) grid.append(makeCard(definition)); }
        block.append(grid); shelf.append(block);
      }
      tabButtons.forEach(tab => tab.setAttribute('aria-pressed', String(tab.dataset.subject === subject)));
    };
    render();
    wrap.append(tabs, shelf);
    wrap.append(element(doc, 'p', 'yt-note', '遊ぶと相棒が成長し、技が少し強くなる。新しい仲間は、本編の新しい土地で。'));
    root.append(wrap); doc.body.append(root); this.root = root; this.restore = isolateScreen(doc, root);
    tabs.querySelector('[aria-pressed=true]')?.focus({ preventScroll: true });
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
  showAllStickers() {
    const selected = gotomonService.getSelectedGotomon();
    if (!selected) return;
    this.dialog?.close(); this.dialog?.remove();
    const dialog = createAllStickersDialog({ doc: document, service: gotomonService, selectedId: selected.id,
      onOpenBook: gotomon => { this.dialog?.close(); this.showStickerBook(gotomon); },
      onSelect: gotomon => {
        // The new companion leads the square at once (its bar, its stickers on the cards).
        if (gotomonService.setSelectedGotomon(gotomon.id)?.ok) { this.dialog?.close(); publish('changeScreen', 'miniGameHub'); }
      },
      onClose: () => this.root?.querySelector('[data-action=all-stickers]')?.focus() });
    this.dialog = dialog; this.root.append(dialog); dialog.showModal();
  },
  showStickerBook(gotomon = null) {
    const selected = gotomon ?? gotomonService.getSelectedGotomon();
    if (!selected) return;
    this.dialog?.close(); this.dialog?.remove();
    const dialog = createStickerBookDialog({ doc: document, service: gotomonService, gotomon: selected, sections: hubSections('all'),
      games: miniGameRegistry, experiences: gameExperiences, onClose: () => this.root?.querySelector('[data-action=sticker-book]')?.focus(),
      // A new outfit shows at once on the companion bar too.
      onOutfit: () => { const old = this.root?.querySelector('.yt-friend-banner > .gt-portrait'); old?.replaceWith(companionPortrait(document, gotomonService.getSelectedGotomon())); } });
    this.dialog = dialog; this.root.append(dialog); dialog.showModal();
  },
  showAlbum() {
    this.dialog?.close(); this.dialog?.remove();
    const dialog = createPhotoAlbumDialog({ doc: document, service: gotomonService, stages: rallyStages(), monsterInfo,
      onClose: () => this.root?.querySelector('[data-action=photo-album]')?.focus() });
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
    let mathLevel = 'addsub';
    if (['gotomonToss', 'gotomonBubble', 'gotomonPuyo', 'gotomonBreakout', 'gotomonMeteor', 'gotomonColoring', 'gotomonMerge'].includes(definition.id)) {
      const label = element(doc, 'label', 'yt-memory-picker', 'けいさんのもんだい');
      const select = element(doc, 'select'); select.setAttribute('aria-label', 'けいさんのもんだい');
      for (const [value, text] of [['addsub', 'たし算・ひき算（20まで）'], ['times', 'かけ算（九九 2〜9の段）']]) {
        const option = element(doc, 'option', '', text); option.value = value; select.append(option);
      }
      select.onchange = () => { mathLevel = select.value; }; label.append(select); dialog.append(label,
        element(doc, 'p', 'yt-note', definition.id === 'gotomonBubble' ? 'どちらも15発。泡にとじこめられているのは、きみがつかまえたゴトモンたちです。' : definition.id === 'gotomonPuyo' ? 'どちらも16組。たまごからうまれるのは、きみが旅で出会ったゴトモンたちです。' : definition.id === 'gotomonBreakout' ? 'どちらも12問。ブロックから出てくるのは、きみが旅で出会ったゴトモンたちです。' : definition.id === 'gotomonMeteor' ? 'どちらも12こ。基地を守るのは、きみがつかまえたゴトモンたちです。' : definition.id === 'gotomonColoring' ? 'ぬりえになるのは、きみがつかまえたゴトモン（まだいなければ旅で出会ったゴトモン）です。' : definition.id === 'gotomonMerge' ? 'どちらも16問。タイルの数が大きくなると、旅で出会ったゴトモンにかわります。' : 'どちらも12球。かごを持つのは、きみがつかまえたゴトモンたちです。'));
    }
    let mode = definition.id === 'gotomonParts' ? 'easy' : ['gotomonSlash', 'gotomonDrum', 'gotomonRace', 'gotomonLink', 'gotomonSeek', 'gotomonMaze', 'gotomonJump', 'gotomonTag', 'gotomonGolf', 'gotomonHop', 'gotomonLand', 'gotomonTrace', 'gotomonPush'].includes(definition.id) ? 'kanji' : 'english';
    if (['gotomonSlash', 'gotomonDrum', 'gotomonRace', 'gotomonLink', 'gotomonSeek', 'gotomonMaze', 'gotomonJump', 'gotomonTag', 'gotomonGolf', 'gotomonHop', 'gotomonLand', 'gotomonTrace', 'gotomonPush'].includes(definition.id)) {
      const drum = definition.id === 'gotomonDrum', race = definition.id === 'gotomonRace', link = definition.id === 'gotomonLink', seek = definition.id === 'gotomonSeek', maze = definition.id === 'gotomonMaze', jump = definition.id === 'gotomonJump', tag = definition.id === 'gotomonTag', golf = definition.id === 'gotomonGolf', hop = definition.id === 'gotomonHop', land = definition.id === 'gotomonLand', trace = definition.id === 'gotomonTrace', push = definition.id === 'gotomonPush';
      const labelText = drum ? 'たいこのもんだい' : race ? 'レースのもんだい' : link ? 'つなぐもの' : seek ? 'さがすもんだい' : maze ? 'とびらのもんだい' : jump ? '雲のもんだい' : tag ? 'ふだのもんだい' : golf ? '旗のもんだい' : hop ? 'おうちのもんだい' : land ? 'ステージのもんだい' : trace ? 'なぞるもんだい' : push ? 'はこのもんだい' : '切るもんだい';
      const label = element(doc, 'label', 'yt-memory-picker', labelText);
      const select = element(doc, 'select'); select.setAttribute('aria-label', labelText);
      for (const [value, text] of [['kanji', link ? '漢字（読み・意味、さいごに行った地方の漢字）' : '漢字の読み（さいごに行った地方の漢字）'], ['english', link ? '英語（英単語と意味）' : '英語（意味・英単語）'], ['math', '算数（たし算・ひき算）']]) {
        const option = element(doc, 'option', '', text); option.value = value; select.append(option);
      }
      // Opened from a subject tab: that subject is chosen already.
      const preset = modeForSubject(definition.id, playOptions.subject);
      if (preset) { mode = preset; select.value = preset; }
      select.onchange = () => { mode = select.value; }; label.append(select); dialog.append(label,
        element(doc, 'p', 'yt-note', push ? 'どれも10へや。はこから 出てくるのは、きみが旅で出会ったゴトモンたちです。' : trace ? 'どれも12問。漢字は読み、英語は英単語の つづり、算数は 答えの 数字を なぞります。もんだいを 出すのは、きみが旅で出会ったゴトモンたちです。' : land ? 'どれも12ステージ。とびらで まっていたり、？ブロックから 出てきたりするのは、きみが旅で出会ったゴトモンたちです。' : hop ? 'どれも12問。荷車を 走らせたり、川を 泳いだり、おうちで まっていたりするのは、きみが旅で出会ったゴトモンたちです。' : golf ? 'どれも12ホール。旗を持ったり バンパーに なったりするのは、きみが旅で出会ったゴトモンたちです。' : tag ? 'どれも12問。おにごっこの あいては、きみが旅で出会ったゴトモンたちです。' : jump ? 'どれも12問。雲の上で ふだを持っているのは、きみが旅で出会ったゴトモンたちです。' : maze ? '3かい×とびら4つで12問。行き止まりで まっているのは、きみが旅で出会ったゴトモンたちです。' : seek ? 'どれも12問。かくれているのは、きみが旅で出会ったゴトモンたちです。' : link ? '6本ずつ2まい。カードを持っているのは、きみが旅で出会ったゴトモンたちです。' : race ? 'どれも12問。いっしょに走るのは相棒、ライバルは旅で出会ったゴトモンたちです。' : drum ? 'どれも12問。おどりに来るのは、きみが旅で出会ったゴトモンたちです。' : 'どれも12問。くす玉から出てくるのは、きみが旅で出会ったゴトモンたちです。'));
    }
    if (definition.id === 'gotomonParts') {
      const label = element(doc, 'label', 'yt-memory-picker', 'くみたてる漢字');
      const select = element(doc, 'select'); select.setAttribute('aria-label', 'くみたてる漢字');
      for (const [value, text] of [['easy', '1・2年の漢字'], ['all', '1〜6年の漢字（ぜんぶ）']]) {
        const option = element(doc, 'option', '', text); option.value = value; select.append(option);
      }
      select.onchange = () => { mode = select.value; }; label.append(select); dialog.append(label,
        element(doc, 'p', 'yt-note', 'どちらも10字。パーツを持っているのは、きみが旅で出会ったゴトモンたちです。'));
    }
    if (definition.id === 'gotomonShooter') {
      const label = element(doc, 'label', 'yt-memory-picker', 'ビームでこたえる問題');
      const select = element(doc, 'select'); select.setAttribute('aria-label', 'ビームでこたえる問題');
      for (const [value, text] of [['english', '英語（意味・英単語）'], ['kanji', '漢字の読み（さいごに行った地方の漢字）']]) {
        const option = element(doc, 'option', '', text); option.value = value; select.append(option);
      }
      const preset = modeForSubject(definition.id, playOptions.subject);
      if (preset) { mode = preset; select.value = preset; }
      select.onchange = () => { mode = select.value; }; label.append(select); dialog.append(label,
        element(doc, 'p', 'yt-note', 'どちらも12問。ふだを持っているのは、旅で出会ったゴトモンたちです。'));
    }
    let region = 'all';
    if (definition.id === 'gotomonDelivery') {
      const label = element(doc, 'label', 'yt-memory-picker', 'とどける地方');
      const select = element(doc, 'select'); select.setAttribute('aria-label', 'とどける地方');
      for (const [value, text] of [['all', '全国'], ['hokkaido-tohoku', '北海道・東北地方'], ['kanto', '関東地方'], ['chubu', '中部地方'],
        ['kinki', '近畿地方'], ['chugoku-shikoku', '中国・四国地方'], ['kyushu-okinawa', '九州・沖縄地方']]) {
        const option = element(doc, 'option', '', text); option.value = value; select.append(option);
      }
      select.onchange = () => { region = select.value; }; label.append(select); dialog.append(label,
        element(doc, 'p', 'yt-note', 'どの地方でも10こ。地方をえらぶと、その地方の都道府県だけが出ます。'));
    }
    let stageId = null;
    if (['photoRally', 'tripSugoroku', 'kanjiBingo', 'kanjiMemory', 'gotomonShop', 'kanjiSort'].includes(definition.id)) {
      const stages = rallyStages(), album = gotomonService.getAlbum(), journeys = gotomonService.getJourneys();
      const trip = definition.id === 'tripSugoroku', bingo = ['kanjiBingo', 'kanjiMemory', 'gotomonShop', 'kanjiSort'].includes(definition.id);
      const place = bingo ? ({ kanjiMemory: 'カードの漢字の地方', gotomonShop: 'お店をひらく地方', kanjiSort: 'パズルの漢字の地方' }[definition.id] ?? 'ビンゴの漢字の地方') : trip ? '旅する地方' : '撮影する場所';
      const label = element(doc, 'label', 'yt-memory-picker', place);
      const select = element(doc, 'select'); select.setAttribute('aria-label', place);
      for (const stage of stages) {
        const taken = stage.enemyIdList.filter(id => album[id]).length;
        const stars = journeys[stage.stageId]?.stars ?? 0;
        const option = element(doc, 'option', '', bingo ? stage.name : trip ? `${stage.name}（ボス ${stars ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : 'まだ'}）`
          : `${stage.name}（写真 ${taken}/${stage.enemyIdList.length}）`); option.value = stage.stageId; select.append(option);
      }
      // Start at the most recently reached place.
      stageId = stages.at(-1)?.stageId ?? null; select.value = stageId ?? '';
      select.onchange = () => { stageId = select.value; }; label.append(select);
      dialog.append(label, element(doc, 'p', 'yt-note', bingo ? 'その地方で習う漢字でカードを作ります。冒険を進めると、選べる地方がふえます。' : trip ? '本編で行ったことのある地方を旅できます。最後にその地方のボスが待っています。'
        : '本編で行ったことのある場所で撮影できます。冒険を進めると、撮影できる場所がふえます。'));
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
        ...(definition.id === 'sentenceOrder' ? { sentenceLevel } : {}),
        ...(['gotomonToss', 'gotomonBubble', 'gotomonPuyo', 'gotomonBreakout', 'gotomonMeteor', 'gotomonColoring', 'gotomonMerge'].includes(definition.id) ? { mathLevel } : {}),
        ...(definition.id === 'gotomonDelivery' ? { region } : {}),
        ...(['gotomonShooter', 'gotomonParts', 'gotomonSlash', 'gotomonDrum', 'gotomonRace', 'gotomonLink', 'gotomonSeek', 'gotomonMaze', 'gotomonJump', 'gotomonTag', 'gotomonGolf', 'gotomonHop', 'gotomonLand', 'gotomonTrace', 'gotomonPush'].includes(definition.id) ? { mode } : {}),
        ...(['photoRally', 'tripSugoroku', 'kanjiBingo', 'kanjiMemory', 'gotomonShop', 'kanjiSort'].includes(definition.id) ? { stageId } : {}) } });
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
