import { publish } from '../core/eventBus.js';
import { element, button, companionPortrait } from '../ui/adventureUI.js';
import { gameExperiences } from './gameExperiences.js';
import { createCompanionScene } from './companionScene.js';
import { createGrowthResult } from './growthResult.js';
import { friendshipTitle } from './companionGrowth.js';
import { scoreRank } from './scoreRank.js';
import { createFindings } from './scenePolish.js';
import { createBuildReviewPanel } from './buildReviewPanel.js';
import { outfitItem } from './companionOutfits.js';
import { moveFor, supportEffectOf } from './gotomonMoves.js';
import { LOOK_NAMES } from './companionLooks.js';
import { courseCountLabel } from './courseLength.js';

// Intro cards are shown once per game per page load; replays start directly.
const seenIntros = new Set();

export function createMiniGameShell({ doc, view, definition, gotomon, supporters = [], play, reviewMode = false, pace = 'normal', course = null, shortCourse = false, onPause, onBoost, onAct, onAdvance, onBack, onReplay, award,
  onReview, onNormalPlay, onNotebook, onEvolution, onRetryMistakes, getMistakeCount = () => 0, getReviewCount = () => 0,
  getLearningSaveStatus = () => ({ failed: false, pending: 0 }), onRetryLearningSave, onBuildReviewDone }) {
  const root = view.root;
  // Headless contract fixtures supply only the v1 view interface.
  if (!root?.querySelector) return { update() {}, dispose() {} };
  const info = gameExperiences[definition.id], shell = root.querySelector('[class$="-shell"]');
  // Arcade views draw their own world and HUD; the shell adds no in-play menus.
  // arcadeView: the view draws its own world (also in review). arcade: in-play automation.
  const arcadeView = !!info.arcade, arcade = arcadeView && !reviewMode;
  root.classList.add('yt-game'); root.dataset.experience = info.scene;
  root.style.setProperty('--accent', info.color);
  const header = root.querySelector('header');
  const actions = element(doc, 'div', 'gt-header-actions');
  const pause = button(doc, '一時停止', () => onPause(!state?.paused), 'gt-button'); pause.dataset.action = 'pause';
  const sound = button(doc, '音量', () => { soundPanel.hidden = !soundPanel.hidden; sound.setAttribute('aria-expanded', String(!soundPanel.hidden)); }, 'gt-button');
  sound.setAttribute('aria-expanded', 'false');
  actions.append(pause, sound); header.append(actions);
  const back = root.querySelector('[data-action=back]'); back.textContent = '広場へ';
  actions.append(back);
  const soundPanel = element(doc, 'div', 'gt-sound'); soundPanel.hidden = true;
  for (const [name, event] of [['BGM', 'BGM'], ['効果音', 'SE']]) {
    const label = element(doc, 'label', '', name), slider = element(doc, 'input');
    slider.type = 'range'; slider.min = '0'; slider.max = '1'; slider.step = '.05'; slider.setAttribute('aria-label', `${name}音量`);
    publish(`get${event}Volume`, value => { slider.value = String(value); });
    slider.oninput = () => publish(`set${event}Volume`, Number(slider.value)); label.append(slider); soundPanel.append(label);
  }
  soundPanel.append(button(doc, 'ミュート', () => {
    for (const [index, event] of ['BGM', 'SE'].entries()) {
      publish(`set${event}Volume`, 0); soundPanel.querySelectorAll('input')[index].value = '0';
    }
  }, 'gt-button'));
  header.after(soundPanel);
  const howTo = element(doc, 'details', 'gt-how-to');
  const howToSummary = element(doc, 'summary', '', 'あそびかた');
  const howToList = element(doc, 'ol');
  for (const step of info.howTo) howToList.append(element(doc, 'li', '', step));
  howTo.append(howToSummary, howToList);
  if (!arcadeView) soundPanel.after(howTo);
  howTo.addEventListener('keydown', event => event.stopPropagation());
  howTo.addEventListener('toggle', () => {
    if (howTo.open && !state?.paused && !state?.result) {
      helpAutoPaused = true;
      onPause(true);
    } else if (!howTo.open && helpAutoPaused) {
      helpAutoPaused = false;
      onPause(false);
    }
  });
  const hud = element(doc, 'div', 'gt-hud'), name = element(doc, 'span', 'gt-friend-name', gotomon?.name || 'あいぼうなし');
  const score = element(doc, 'strong'), combo = element(doc, 'span');
  name.textContent = `${gotomon?.name || 'あいぼう'} Lv${play.snapshot().growth.level}${supporters.length ? ` ＋サポーター${supporters.length}` : ''}`;
  // わざ: the type's move replaces the game's skill name (the game's own effect stays).
  const move = play.snapshot().move, skillName = move?.name ?? info.skill;
  if (supporters.length) name.title = supporters.map(item => `${item.name}：${supportEffectOf(item.type).text}`).join(' / ');
  // パーティ: the supporters' small pictures beside the name (with their しんか and other looks).
  const party = element(doc, 'span', 'gt-party');
  for (const item of supporters) { const face = companionPortrait(doc, item, 'gt-party-face'); face.title = `${item.name}：${supportEffectOf(item.type).text}`; party.append(face); }
  hud.append(name, ...(supporters.length ? [party] : []), score, combo);
  const skill = button(doc, '', onBoost, 'gt-button gt-skill'); skill.dataset.action = 'boost';
  const gauge = element(doc, 'meter'); gauge.min = 0; gauge.max = 3; gauge.value = 0; gauge.setAttribute('aria-label', 'あいぼうゲージ');
  const skillLabel = element(doc, 'span'); skill.append(gauge, skillLabel); hud.append(skill);
  const moveBurst = element(doc, 'span', 'gt-move-burst'); moveBurst.setAttribute('aria-hidden', 'true');
  moveBurst.dataset.type = move?.type || gotomon?.type || 'odd';
  moveBurst.textContent = ({ food: '🍞', nature: '🍃', legend: '✨', fest: '🥁', history: '📜', craft: '⚙️', odd: '💫' })[moveBurst.dataset.type] || '💫';
  skill.append(moveBurst);
  if (!arcadeView) howTo.after(hud);
  const scene = arcadeView ? null : createCompanionScene({ doc, root, info, gotomon, act: onAct });
  if (scene) hud.after(scene.root);
  // Not '*-companion': minigame-shell.css hides that suffix for the older games' canvas figures.
  else {
    // パーティ: in the arcade games the supporters stand beside the companion's picture.
    const buddy = companionPortrait(doc, gotomon, 'ya-buddy');
    // Beside it, not inside it, so the companion's かがやき/色ちがい does not spread to them.
    const holder = supporters.length ? element(doc, 'span', 'gt-buddy-wrap') : buddy;
    if (supporters.length) { const side = element(doc, 'span', 'gt-party gt-party-side'); for (const item of supporters) { const face = companionPortrait(doc, item, 'gt-party-face'); face.title = item.name; side.append(face); } holder.append(buddy, side); }
    view.attachCompanion?.(holder);
  }
  const sceneCanvas = scene?.root.querySelector('.gt-scene');
  if (!reviewMode && !arcadeView) {
    root.classList.add('gt-fullscreen-play');
    const arena = root.querySelector('.mi-board, .kd-board') || sceneCanvas;
    const playControls = root.querySelector('.ms-play > div, .ec-play > div, .so-play > div, .tc-play > div, .ac-play > div, .mi-controls, .kd-controls');
    for (const node of [hud, scene.root.querySelector('.gt-goal-picker'), scene.root.querySelector('.gt-goal-status'),
      root.querySelector('.ms-progress, .ec-progress, .so-progress, .tc-progress, .ac-progress, .mi-hud, .kd-hud'),
      root.querySelector('.mi-instruction, .kd-instruction'), playControls]) {
      if (node) { node.classList.add('gt-in-world'); arena.append(node); }
    }
    if (playControls) playControls.classList.add('gt-play-controls');
    const worldActions = scene.root.querySelector('.gt-world-actions');
    if (worldActions && worldActions.parentElement !== arena) arena.append(worldActions);
  }
  const help = element(doc, 'p', 'gt-help', info.goal); if (scene) scene.root.after(help);
  const saveAlert = element(doc, 'div', 'gt-learning-save-alert');
  saveAlert.hidden = true;
  saveAlert.setAttribute('role', 'alert');
  const saveAlertText = element(doc, 'p');
  const saveAlertRetry = button(doc, 'いま保存をやり直す', () => onRetryLearningSave?.(), 'gt-button');
  saveAlertRetry.dataset.action = 'retry-learning-save';
  saveAlert.append(saveAlertText, saveAlertRetry);
  if (scene) help.after(saveAlert); else soundPanel.after(saveAlert);
  const sentenceExplanation = definition.id === 'sentenceOrder' ? element(doc, 'p', 'gt-sentence-explanation') : null;
  if (sentenceExplanation) { sentenceExplanation.hidden = true; sentenceExplanation.setAttribute('role', 'status'); root.querySelector('.so-feedback')?.after(sentenceExplanation); }
  // Keyboard activation of shell controls must not submit the game's answer.
  for (const node of [header, soundPanel, hud, root.querySelector('.gt-goal-picker'), root.querySelector('.gt-world-actions')]) {
    node?.addEventListener('keydown', event => event.stopPropagation());
  }
  const result = element(doc, 'section', 'gt-result'); result.hidden = true; result.setAttribute('aria-label', 'あいぼうとのプレイ結果');
  result.addEventListener('keydown', event => event.stopPropagation());
  const resultTitle = element(doc, 'h2', '', 'あいぼうと、ひとつ先へ。'), portrait = companionPortrait(doc, gotomon);
  const resultName = element(doc, 'h3', '', gotomon?.name || ''), resultScore = element(doc, 'strong', 'gt-final-score');
  const stats = element(doc, 'p'), reward = element(doc, 'p', 'gt-reward'); reward.setAttribute('role', 'status');
  const record = element(doc, 'p', 'gt-record'), resultActions = element(doc, 'div', 'gt-result-actions');
  const memoryNotice = element(doc, 'p', 'gt-memory-notice'); memoryNotice.hidden = true; memoryNotice.setAttribute('role', 'status');
  const captureNotice = element(doc, 'div', 'gt-capture-notice'); captureNotice.hidden = true; captureNotice.setAttribute('role', 'status');
  // パーティ: the supporters' XP and a newly learned わざ.
  const partyNotice = element(doc, 'p', 'gt-party-notice'); partyNotice.hidden = true; partyNotice.setAttribute('role', 'status');
  // The sticker book: a new or golden sticker for this companion, and the がんばり mark after the review.
  const stickerNotice = element(doc, 'p', 'gt-sticker-notice'); stickerNotice.hidden = true; stickerNotice.setAttribute('role', 'status');
  const showSticker = (tier, text) => { stickerNotice.dataset.tier = tier; stickerNotice.textContent = text; stickerNotice.hidden = false; };
  const challengeResult = element(doc, 'p', 'gt-challenge-result'); challengeResult.hidden = true;
  const rankLabel = element(doc, 'strong', 'gt-rank'), nextGoal = element(doc, 'p', 'gt-replay-goal');
  const growthResult = createGrowthResult(doc, portrait);
  const findings=['treasure','explore','craft'].includes(info.scene)?createFindings(doc,info.scene==='explore'?5:info.scene==='craft'?3:4):null;
  const replay = button(doc, 'もう一度あそぶ', () => state?.mode === 'review' ? onNormalPlay() : onReplay(), 'gt-button gt-primary'); replay.dataset.action = 'replay';
  const evolveAction = button(doc, 'しんかのへやへ', () => onEvolution?.(), 'gt-button gt-primary');
  evolveAction.dataset.action = 'open-evolution'; evolveAction.hidden = true;
  const review = button(doc, 'まちがえた語をもう一度', () => onReview?.(), 'gt-button');
  review.dataset.action = 'review'; review.hidden = true;
  review.title = 'これまで記録した間違いから、最大10問を復習します。';
  const retryMistakes = button(doc, '', () => { if (receipt?.ok && !state?.paused) onRetryMistakes?.(); }, 'gt-button');
  retryMistakes.dataset.action = 'retry-mistakes'; retryMistakes.hidden = true;
  const notebook = button(doc, '学習ノートに戻る', () => { if (receipt?.ok && !state?.paused) onNotebook?.(); }, 'gt-button');
  notebook.dataset.action = 'return-notebook'; notebook.hidden = !onNotebook;
  const retrySave = button(doc, '記録の保存を再試行', () => { receipt = null; commit(); }, 'gt-button'); retrySave.hidden = true;
  resultActions.append(notebook, retryMistakes, evolveAction, replay, review, button(doc, 'ミニゲーム広場へ', onBack, 'gt-button'));
  stats.className='gt-world-result';
  result.append(rankLabel, portrait, resultName, resultTitle, stats);
  if(findings)result.append(findings.root);
  // The run's missed questions, built again from letter cards (games whose missed list carries `build`).
  const buildReview = createBuildReviewPanel(doc, { onDone: () => {
    const done = onBuildReviewDone?.();
    if (done?.mark) showSticker('review', `がんばりマークが ついた！ シール帳の シールに にじの ふち${done.newTitles?.length ? `　称号「${done.newTitles.join('」「')}」に なった！` : ''}`);
  } });
  result.append(growthResult.root,captureNotice,stickerNotice,partyNotice,memoryNotice,challengeResult,nextGoal,buildReview.root,resultActions,reward,retrySave);
  shell.append(result);
  const legacyResult = root.querySelector('[class$="-result"]:not(.gt-result)');
  if (legacyResult) legacyResult.classList.add('gt-learning-result');
  const resultDetails = element(doc, 'details', 'gt-result-details');
  resultDetails.append(element(doc, 'summary', '', 'くわしい記録・問題のふりかえり'),resultScore,record);
  if (legacyResult) { legacyResult.before(resultDetails); resultDetails.append(legacyResult); }
  result.append(resultDetails);
  resultDetails.append(button(doc, '新しいあいぼうを探しに冒険へ', () => { onBack(); publish('changeScreen', 'title'); }, 'gt-button'));
  let state = null, receipt = null, resultShown = false, soundAnswers=0,soundBoosts=0,soundComplete=false;
  let helpAutoPaused = false;
  let feedbackId = null, feedbackMs = 0;
  // わざ: a short toast when the skill fires (arcade views draw their own HUD, so the shell shows it for every game).
  const moveToast = element(doc, 'p', 'gt-move-toast'); moveToast.hidden = true; moveToast.setAttribute('aria-live', 'polite');
  root.append(moveToast);
  let toastBoosts = 0, toastMs = 0;
  let introOpen = false;
  if (arcade && !seenIntros.has(definition.id)) {
    const intro = element(doc, 'div', 'ya-intro');
    intro.setAttribute('role', 'dialog'); intro.setAttribute('aria-modal', 'true');
    intro.setAttribute('aria-label', `${definition.title}のあそびかた`);
    const card = element(doc, 'div', 'ya-intro-card');
    const steps = element(doc, 'ol');
    info.howTo.forEach((step, index) => { const item = element(doc, 'li'); item.append(element(doc, 'b', '', String(index + 1)), element(doc, 'span', '', step)); steps.append(item); });
    const meta = element(doc, 'div', 'ya-intro-meta');
    meta.append(element(doc, 'span', pace === 'slow' ? 'ya-pace-slow' : '', pace === 'slow' ? 'ゆっくりモード' : 'ふつうのはやさ'));
    const mission = play.snapshot().world?.challenge;
    if (mission && !shortCourse) meta.append(element(doc, 'span', '', `ミッション：${mission.name}`));
    if (shortCourse) meta.append(element(doc, 'span', '', `ちょこっとコース：${courseCountLabel(definition.id, true)}`));
    if (course) meta.append(element(doc, 'span', '', `★ ${course.name}`));
    if (move) meta.append(element(doc, 'span', '', `わざ：${move.name}（${move.text}）`));
    const start = button(doc, 'スタート！', () => {
      if (!introOpen) return;
      introOpen = false; seenIntros.add(definition.id); intro.remove(); onPause(false); view.focusPlay?.();
    }, 'ya-intro-start');
    start.dataset.action = 'start-play';
    card.append(element(doc, 'div', 'ya-intro-icon', info.icon), element(doc, 'h2', '', definition.title),
      element(doc, 'p', 'ya-intro-tagline', info.description), steps, meta, start);
    if (info.controlsNote) card.append(element(doc, 'p', 'ya-intro-note', info.controlsNote));
    intro.append(card);
    // Keys inside the card never reach the game's document key bindings.
    intro.addEventListener('keydown', event => event.stopPropagation());
    root.append(intro); introOpen = true; onPause(true); start.focus?.({ preventScroll: true });
  }
  function commit() {
    const current = play.snapshot();
    evolveAction.hidden = true;
    receipt = award({ score: (state.result?.score ?? current.learningPoints) + current.bonus,
      correct: current.correct, maxCombo: current.maxCombo, completed: current.completed,
      finished: state.result?.finished ?? (state.answered ?? state.resolved ?? 0) >= (definition.id === 'kanjiDefense' ? 12 : 10), activeElapsedMs: state.activeElapsedMs, timeMs:current.world?.timeMs,
      ...(current.world?.photos ? { photos: current.world.photos } : {}), ...(current.world?.cases ? { cases: current.world.cases } : {}), ...(state.result?.journey ? { journey: state.result.journey } : {}) });
    if (receipt.ok && receipt.practice) {
      resultTitle.textContent = '復習おつかれさま！';
      reward.textContent = '復習の記録を保存しました。';
      record.textContent = '復習はランク・XP・なかよしの加算対象外です。';
    } else if (receipt.ok) {
      const value = receipt.reward;
      growthResult.show(value);
      captureNotice.replaceChildren();
      if (value?.newGotomon && !value.duplicate) {
        const image = element(doc, 'img'); image.src = value.newGotomon.imageUrl; image.alt = value.newGotomon.name;
        image.width = 84; image.height = 84;
        captureNotice.append(image, element(doc, 'strong', '', `${value.newGotomon.name}が なかまになった！ ゴトモン図鑑でも 会えるよ。`));
        captureNotice.hidden = false;
      } else captureNotice.hidden = true;
      if (value && !value.duplicate) resultTitle.textContent = friendshipTitle(value.friendship).message;
      reward.textContent = value?.duplicate ? '記録は保存済みです。' : `なかよし +${value.earned} → ${value.friendship} · いっしょに${value.plays}回${value.medals.includes('five-plays') ? ' · メダル「いつものあいぼう」' : ''}`;
      record.textContent = shortCourse ? 'ちょこっとコースで あそんだよ。あいぼうは そだつよ。' : `${value?.newBest ? '✦ 自己ベスト！ ' : 'BEST '}${value?.bestScore ?? ''}`;
      result.dataset.newBest = String(!!value?.newBest);
      const memory = !value?.duplicate && value?.memory;
      const newPhotos = value?.duplicate ? [] : value?.newPhotos ?? [], newCases = value?.duplicate ? [] : value?.newCases ?? [];
      memoryNotice.textContent = newPhotos.length ? `アルバムに新しい写真が${newPhotos.length}まい入ったよ！` :
        newCases.length ? `ことわざ図鑑に「解決」の印が${newCases.length}こふえたよ！` :
        value?.journeyBest ? `${state.stage?.name ?? 'この地方'}のボスの記録が ★${value.journeyBest} になったよ！` :
        memory?.firstFinish ? '思い出がふえた！ はじめて最後まであそんだね。' :
        memory?.newBest ? `このあいぼうとの自己ベスト！ ${memory.bestScore} pt` :
        memory?.firstPlay ? 'このゲームでの、はじめての思い出ができたよ。' : '';
      memoryNotice.hidden = !memoryNotice.textContent;
      const mates = value?.duplicate ? [] : value?.supporters ?? [];
      const learned = !value?.duplicate && value?.newMove && gotomon?.type ? moveFor(gotomon.type, value.after.level).name : null;
      partyNotice.textContent = [learned ? `${gotomon.name}が あたらしい わざ「${learned}」を おぼえた！` : '',
        ...mates.map((mate, i) => { const friend = supporters.find(item => item.id === mate.id);
          return `${i ? '' : 'サポーター '}${friend?.name ?? 'サポーター'} XP +${mate.earnedXP}${mate.levelUp ? ` → Lv${mate.level}になった！` : ''}${mate.newMove && friend?.type ? ` わざ「${moveFor(friend.type, mate.level).name}」を おぼえた！` : ''}`; })].filter(Boolean).join(' · ');
      partyNotice.hidden = !partyNotice.textContent;
      const sticker = !value?.duplicate && value?.sticker;
      if (sticker?.isNew || sticker?.upgraded) showSticker(sticker.tier, sticker.upgraded ? `シール帳の「${definition.title}」が 金シールに かわった！` : `シール帳に「${definition.title}」の ${sticker.tier === 'gold' ? '金' : '銀'}シール！`);
      const opened = value?.duplicate ? [] : (value?.newOutfits ?? []).map(outfitItem).filter(Boolean);
      const titles = value?.duplicate ? [] : value?.newTitles ?? [];
      if (titles.length) showSticker(stickerNotice.hidden ? 'title' : stickerNotice.dataset.tier, `${stickerNotice.hidden ? '' : `${stickerNotice.textContent} `}称号「${titles.join('」「')}」に なった！`);
      const secrets = value?.duplicate ? [] : value?.newSecrets ?? [];
      if (secrets.length) showSticker(stickerNotice.hidden ? 'secret' : stickerNotice.dataset.tier, `${stickerNotice.hidden ? '' : `${stickerNotice.textContent} `}ひみつノートに「${secrets.join('」「')}」が ひらいた！`);
      const looks = value?.duplicate ? [] : value?.newLooks ?? [];
      if (looks.length) showSticker(stickerNotice.hidden ? 'outfit' : stickerNotice.dataset.tier, `${stickerNotice.hidden ? '' : `${stickerNotice.textContent} `}すがた「${looks.map(key => LOOK_NAMES[key]).join('」「')}」が ひらいた！ ${looks.includes('evolve') ? 'しんかのへやで しんかさせよう！' : 'シール帳で かえられるよ'}`);
      evolveAction.hidden = !looks.includes('evolve') || !onEvolution;
      if (opened.length) showSticker(stickerNotice.hidden ? 'outfit' : stickerNotice.dataset.tier, `${stickerNotice.hidden ? '' : `${stickerNotice.textContent} `}きせかえ ${opened.map(item => `${item.icon}${item.name}`).join('・')} が ひらいた！ シール帳で つけられるよ`);
      // ごほうびが同時に届いてもジングルは1回だけ。復習や保存済みの結果では鳴らさない。
      if (sticker?.isNew || sticker?.upgraded || opened.length || titles.length || secrets.length || looks.length) publish('playSE', 'reward');
      resultDetails.append(reward);
    } else reward.textContent = '記録を保存できませんでした。この画面で「記録の保存を再試行」を押してください。画面を閉じると未保存の記録は失われます。';
    retrySave.hidden = receipt.ok;
  }
  return {
    update(next, dt = 0) {
      state = next; const current = play.snapshot();
      if (definition.id === 'sentenceOrder') {
        header.querySelector('h1').textContent = `文ならべ · ${state.mode === 'review' ? '復習 · ' : ''}${state.problem?.chunks.length || 3}ピース`;
        sentenceExplanation.hidden = !state.lastAnswer || (state.lastAnswer.correct && state.mode !== 'review') || !state.problem?.explanation;
        sentenceExplanation.textContent = state.problem?.explanation || '';
        if (state.result && sentenceExplanation.parentNode !== resultDetails) resultDetails.append(sentenceExplanation);
      }
      // A world may hold the result briefly (the runner still crossing the goal).
      const showResult = !!state.result && !(arcade && current.world?.holdResult);
      root.dataset.paused = String(state.paused); root.dataset.completed = String(showResult);
      // Pause owns all play input, while navigation, sound and resume remain active.
      for (const child of shell.children) {
        if (![header, soundPanel, howTo].includes(child)) child.inert = !!state.paused;
      }
      pause.textContent = showResult ? '' : introOpen ? 'じゅんび中' : howTo.open ? 'あそびかた確認中' : state.paused ? '再開' : '一時停止';
      pause.hidden = showResult;
      pause.disabled = !!state.result || howTo.open || introOpen;
      howTo.hidden = !!state.result;
      // Arcade: the companion's skill fires on its own as a fever when the gauge fills.
      // The Host re-renders after an accepted boost, so this pass stops here.
      if (arcade && current.gauge >= 3 && !state.paused && !state.result && !introOpen && onBoost()) return;
      gauge.value = Math.min(3, current.gauge); skill.disabled = state.paused || !!state.result || current.gauge < 3;
      skillLabel.textContent = info.scene==='lantern'?(current.gauge>=3?'光をひらく！':'正解で光がたまる'):current.gauge >= 3 ? `${skillName} · ${info.scene==='craft'?'2ルートへ光':info.effect}` : `${skillName} ${Math.floor(current.gauge)}/3`;
      skill.title = `${current.growth.description}・技 ${current.skillPoints}pt＋ゲーム固有効果${move ? `・わざ「${move.name}」${move.text}` : ''}`;
      score.textContent = `${(state.score ?? current.learningPoints) + current.bonus} pt`;
      combo.textContent = `${current.combo} COMBO`;
      scene?.update(state, current, dt);
      if (move && current.boosts > toastBoosts && !state.result) {
        moveToast.textContent = `${gotomon?.name ?? 'あいぼう'}の ${move.name}！ ${move.text}`; moveToast.hidden = false; toastMs = 1800;
        moveBurst.classList.remove('is-active'); void moveBurst.offsetWidth; moveBurst.classList.add('is-active');
        publish('playSE', 'miniPickup');
      }
      toastBoosts = current.boosts;
      if (toastMs > 0) { toastMs -= dt; if (toastMs <= 0 || state.result) { moveToast.hidden = true; toastMs = 0; } }
      view.present?.(play.snapshot(), dt, state);
      const answeredWell = state.lastAnswer?.correct || state.lastAnswer?.classification === 'fullCorrect';
      // manualNext games (reading-heavy ones) wait for the child's own つぎへ.
      const advanceAfter = state.mode === 'review' || info.manualNext || state.phase !== 'feedback' || state.paused ? null
        : answeredWell ? (arcade ? 450 : 600) : arcade ? 1400 : null;
      if (advanceAfter !== null) {
        const id = state.problem?.problemId;
        if (feedbackId !== id) { feedbackId = id; feedbackMs = 0; }
        feedbackMs += dt;
        if (feedbackMs >= advanceAfter && onAdvance) { feedbackMs = -Infinity; onAdvance(state); return; }
      }
      help.hidden = !!state.result; hud.hidden = !!state.result;
      const learningSave = getLearningSaveStatus();
      saveAlert.hidden = !!state.result || !learningSave.failed || !learningSave.pending;
      if (!saveAlert.hidden) saveAlertText.textContent = `${learningSave.pending}問の記録を保存できていません。「いま保存をやり直す」を押してください。画面を閉じると未保存の記録は失われます。`;
      saveAlertRetry.disabled = !!state.paused;
      if (state.mode === 'review') {
        if (scene) scene.root.hidden = true;
        skill.hidden = true; score.hidden = true; combo.hidden = true;
        help.textContent = definition.id === 'sentenceOrder' ? '文のつながりを、あいぼうとたしかめよう。' : 'ことばを、あいぼうとたしかめよう。';
      }
      if (soundAnswers!==current.answered||soundBoosts!==current.boosts||soundComplete!==current.completed) {
        soundAnswers=current.answered;soundBoosts=current.boosts;soundComplete=current.completed;
        if (['correct','boost','celebrate'].includes(current.reaction)) publish('playSE', current.reaction==='correct'?(info.scene==='shoot'?(current.combo>=3?'defeat':'attack'):'correct'):'achievement');
        else if (current.reaction === 'incorrect') publish('playSE', 'wrong');
        // An enemy reached the barrier or the gate: the shield sound, never the wrong-answer buzzer.
        else if (current.reaction === 'timeout') publish('playSE', 'shield1');
        else if (current.reaction === 'partial') publish('playSE','decide');
      }
      result.hidden = !showResult;
      if (showResult) {
        if (!receipt) commit();
        const reviewing = state.mode === 'review';
        growthResult.root.hidden = reviewing;
        rankLabel.hidden = reviewing || shortCourse;
        findings && (findings.root.hidden = reviewing);
        replay.textContent = reviewing ? 'ふつうにあそぶ' : 'もう一度あそぶ';
        review.hidden = !onReview || !receipt?.ok || !getReviewCount();
        review.disabled = state.paused;
        notebook.disabled = state.paused || !receipt?.ok;
        const mistakeCount = getMistakeCount();
        retryMistakes.hidden = !onRetryMistakes || !receipt?.ok || !mistakeCount;
        retryMistakes.disabled = state.paused;
        retryMistakes.textContent = `今回まちがえた${mistakeCount}問を練習`;
        review.textContent = definition.id === 'timedChoice' ? `時間なしで復習する（${getReviewCount()}語）` : definition.id === 'sentenceOrder' ? `まちがえた文をもう一度（${getReviewCount()}文）` : `まちがえた語をもう一度（${getReviewCount()}語）`;
        const points = (state.result.score ?? current.learningPoints) + current.bonus;
        const rank = scoreRank(definition.id, points, current.correct);
        rankLabel.textContent = `${rank.rank} RANK`; rankLabel.dataset.rank = rank.rank;
        nextGoal.textContent = reviewing ? `${state.correct} / ${state.totalQuestions}${definition.id === 'sentenceOrder' ? '文' : '語'}に正解。${getReviewCount() ? 'もう一度たしかめよう。' : '今回の復習はできたね！'}` : shortCourse ? 'また あそぼう！ いつものコースにも ちょうせんできるよ。' : rank.next ? rank.goal : current.world?.goal || '次は自己ベストをこえよう';
        const challenge = reviewing || shortCourse ? null : current.world?.challenge;
        challengeResult.hidden = !challenge;
        if (challenge) {
          challengeResult.textContent = challenge.status === 'achieved' ? challenge.message : `今回の目標「${challenge.name}」は次の挑戦へ。`;
          challengeResult.dataset.status = challenge.status;
          nextGoal.textContent = challenge.next;
        }
        if (reviewing) buildReview.hide(); else buildReview.sync(state.missed, state.sessionId);
        growthResult.update(state.paused ? 0 : dt);
        findings?.update(current.world?.findings);
        resultScore.textContent = `${points} pt`;
        stats.textContent = reviewing ? 'あいぼうと、ことばをたしかめたよ。' : `${current.world?.course ? `${current.world.course.name} · ` : ''}${current.world?.summary || ''}${receipt?.reward?.newTimeBest?' · タイム更新！':''}`;
        result.dataset.world=info.scene;result.dataset.triumph=String(shortCourse ? !!state.result?.finished : info.scene==='craft'?current.world?.completed===3:info.scene==='shoot'?!!current.world?.bossDown:info.scene==='defend'?state.life>0:current.correct>=8);
        replay.disabled = state.paused;
        if (!resultShown) { resultShown = true; root.scrollTop = 0; (onNotebook && receipt?.ok ? notebook : replay).focus({ preventScroll: true }); }
      }
    },
    dispose() { /* The view owns the root and all its descendants. No global listeners. */ },
  };
}
