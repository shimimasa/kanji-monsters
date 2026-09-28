import { publish } from '../core/eventBus.js';
import { element, button, companionPortrait } from '../ui/adventureUI.js';
import { gameExperiences } from './gameExperiences.js';
import { createCompanionScene } from './companionScene.js';
import { createGrowthResult } from './growthResult.js';
import { friendshipTitle } from './companionGrowth.js';
import { scoreRank } from './scoreRank.js';
import { createFindings } from './scenePolish.js';

export function createMiniGameShell({ doc, view, definition, gotomon, play, onPause, onBoost, onAct, onAdvance, onBack, onReplay, award,
  onReview, onNormalPlay, onNotebook, onRetryMistakes, getMistakeCount = () => 0, getReviewCount = () => 0,
  getLearningSaveStatus = () => ({ failed: false, pending: 0 }), onRetryLearningSave }) {
  const root = view.root;
  // Headless contract fixtures supply only the v1 view interface.
  if (!root?.querySelector) return { update() {}, dispose() {} };
  const info = gameExperiences[definition.id], shell = root.querySelector('[class$="-shell"]');
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
  soundPanel.after(howTo);
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
  const hud = element(doc, 'div', 'gt-hud'), name = element(doc, 'span', 'gt-friend-name', gotomon?.name || '相棒なし');
  const courseNotice = element(doc, 'p', 'gt-course-notice');
  courseNotice.hidden = true;
  const score = element(doc, 'strong'), combo = element(doc, 'span');
  name.textContent = `${gotomon?.name || '相棒'} Lv${play.snapshot().growth.level}`;
  hud.append(name, score, combo);
  const skill = button(doc, '', onBoost, 'gt-button gt-skill'); skill.dataset.action = 'boost';
  const gauge = element(doc, 'meter'); gauge.min = 0; gauge.max = 3; gauge.value = 0; gauge.setAttribute('aria-label', '相棒ゲージ');
  const skillLabel = element(doc, 'span'); skill.append(gauge, skillLabel); hud.append(skill); howTo.after(hud);
  const scene = createCompanionScene({ doc, root, info, gotomon, act: onAct }); hud.after(courseNotice,scene.root);
  if(info.scene==='lantern')scene.root.querySelector('.gt-scene').append(skill);
  const help = element(doc, 'p', 'gt-help', info.goal); scene.root.after(help);
  const saveAlert = element(doc, 'div', 'gt-learning-save-alert');
  saveAlert.hidden = true;
  saveAlert.setAttribute('role', 'alert');
  const saveAlertText = element(doc, 'p');
  const saveAlertRetry = button(doc, 'いま保存をやり直す', () => onRetryLearningSave?.(), 'gt-button');
  saveAlertRetry.dataset.action = 'retry-learning-save';
  saveAlert.append(saveAlertText, saveAlertRetry); help.after(saveAlert);
  const sentenceExplanation = definition.id === 'sentenceOrder' ? element(doc, 'p', 'gt-sentence-explanation') : null;
  if (sentenceExplanation) { sentenceExplanation.hidden = true; sentenceExplanation.setAttribute('role', 'status'); root.querySelector('.so-feedback')?.after(sentenceExplanation); }
  // Keyboard activation of shell controls must not submit the game's answer.
  for (const node of [header, soundPanel, hud, scene.root]) {
    node.addEventListener('keydown', event => event.stopPropagation());
  }
  const result = element(doc, 'section', 'gt-result'); result.hidden = true; result.setAttribute('aria-label', '相棒とのプレイ結果');
  result.addEventListener('keydown', event => event.stopPropagation());
  const resultTitle = element(doc, 'h2', '', '相棒と、ひとつ先へ。'), portrait = companionPortrait(doc, gotomon);
  const resultName = element(doc, 'h3', '', gotomon?.name || ''), resultScore = element(doc, 'strong', 'gt-final-score');
  const stats = element(doc, 'p'), reward = element(doc, 'p', 'gt-reward'); reward.setAttribute('role', 'status');
  const record = element(doc, 'p', 'gt-record'), resultActions = element(doc, 'div', 'gt-result-actions');
  const memoryNotice = element(doc, 'p', 'gt-memory-notice'); memoryNotice.hidden = true; memoryNotice.setAttribute('role', 'status');
  const challengeResult = element(doc, 'p', 'gt-challenge-result'); challengeResult.hidden = true;
  const rankLabel = element(doc, 'strong', 'gt-rank'), nextGoal = element(doc, 'p', 'gt-replay-goal');
  const growthResult = createGrowthResult(doc, portrait);
  const findings=['treasure','explore','craft'].includes(info.scene)?createFindings(doc,info.scene==='explore'?5:info.scene==='craft'?3:4):null;
  const replay = button(doc, 'もう一度あそぶ', () => state?.mode === 'review' ? onNormalPlay() : onReplay(), 'gt-button gt-primary'); replay.dataset.action = 'replay';
  const review = button(doc, 'まちがえた語をもう一度', () => onReview?.(), 'gt-button');
  review.dataset.action = 'review'; review.hidden = true;
  review.title = 'これまで記録した間違いから、最大10問を復習します。';
  const retryMistakes = button(doc, '', () => { if (receipt?.ok && !state?.paused) onRetryMistakes?.(); }, 'gt-button');
  retryMistakes.dataset.action = 'retry-mistakes'; retryMistakes.hidden = true;
  const notebook = button(doc, '学習ノートに戻る', () => { if (receipt?.ok && !state?.paused) onNotebook?.(); }, 'gt-button');
  notebook.dataset.action = 'return-notebook'; notebook.hidden = !onNotebook;
  const retrySave = button(doc, '記録の保存を再試行', () => { receipt = null; commit(); }, 'gt-button'); retrySave.hidden = true;
  resultActions.append(notebook, retryMistakes, replay, review, button(doc, 'ミニゲーム広場へ', onBack, 'gt-button'));
  stats.className='gt-world-result';
  result.append(rankLabel, portrait, resultName, resultTitle, stats);
  if(findings)result.append(findings.root);
  result.append(growthResult.root,memoryNotice,challengeResult,nextGoal,resultActions,reward,retrySave);
  shell.append(result);
  const legacyResult = root.querySelector('[class$="-result"]:not(.gt-result)');
  if (legacyResult) legacyResult.classList.add('gt-learning-result');
  const resultDetails = element(doc, 'details', 'gt-result-details');
  resultDetails.append(element(doc, 'summary', '', 'くわしい記録・問題のふりかえり'),resultScore,record);
  if (legacyResult) { legacyResult.before(resultDetails); resultDetails.append(legacyResult); }
  result.append(resultDetails);
  resultDetails.append(button(doc, '新しい相棒を探しに冒険へ', () => { onBack(); publish('changeScreen', 'title'); }, 'gt-button'));
  let state = null, receipt = null, resultShown = false, soundAnswers=0,soundBoosts=0,soundComplete=false;
  let helpAutoPaused = false;
  let feedbackId = null, feedbackMs = 0;
  function commit() {
    const current = play.snapshot();
    receipt = award({ score: (state.result?.score ?? current.learningPoints) + current.bonus,
      correct: current.correct, maxCombo: current.maxCombo, completed: current.completed,
      finished: (state.answered ?? state.resolved ?? 0) >= (definition.id === 'kanjiDefense' ? 12 : 10), activeElapsedMs: state.activeElapsedMs, timeMs:current.world?.timeMs });
    if (receipt.ok && receipt.practice) {
      resultTitle.textContent = '復習おつかれさま！';
      reward.textContent = '復習の記録を保存しました。';
      record.textContent = '復習はランク・XP・なかよしの加算対象外です。';
    } else if (receipt.ok) {
      const value = receipt.reward;
      growthResult.show(value);
      if (value && !value.duplicate) resultTitle.textContent = friendshipTitle(value.friendship).message;
      reward.textContent = value?.duplicate ? '記録は保存済みです。' : `なかよし +${value.earned} → ${value.friendship} · いっしょに${value.plays}回${value.medals.includes('five-plays') ? ' · メダル「いつもの相棒」' : ''}`;
      record.textContent = `${value?.newBest ? '✦ 自己ベスト！ ' : 'BEST '}${value?.bestScore ?? ''}`;
      result.dataset.newBest = String(!!value?.newBest);
      const memory = !value?.duplicate && value?.memory;
      memoryNotice.textContent = memory?.firstFinish ? '思い出がふえた！ はじめて最後まであそんだね。' :
        memory?.newBest ? `この相棒との自己ベスト！ ${memory.bestScore} pt` :
        memory?.firstPlay ? 'このゲームでの、はじめての思い出ができたよ。' : '';
      memoryNotice.hidden = !memoryNotice.textContent;
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
      root.dataset.paused = String(state.paused); root.dataset.completed = String(!!state.result);
      // Pause owns all play input, while navigation, sound and resume remain active.
      for (const child of shell.children) {
        if (![header, soundPanel, howTo].includes(child)) child.inert = !!state.paused;
      }
      pause.textContent = howTo.open ? 'あそびかた確認中' : state.paused ? '再開' : '一時停止'; pause.disabled = !!state.result || howTo.open;
      howTo.hidden = !!state.result;
      gauge.value = Math.min(3, current.gauge); skill.disabled = state.paused || !!state.result || current.gauge < 3;
      skillLabel.textContent = info.scene==='lantern'?(current.gauge>=3?'光をひらく！':'正解で光がたまる'):current.gauge >= 3 ? `${info.skill} · ${info.scene==='craft'?'2ルートへ光':info.effect}` : `${info.skill} ${Math.floor(current.gauge)}/3`;
      skill.title = `${current.growth.description}・技 ${current.skillPoints}pt＋ゲーム固有効果`;
      score.textContent = `${(state.score ?? current.learningPoints) + current.bonus} pt`;
      combo.textContent = `${current.combo} COMBO`;
      courseNotice.hidden = !current.world?.course || state.mode === 'review' || !!state.result;
      if (!courseNotice.hidden) courseNotice.textContent = `★ ${gotomon?.name}の得意コース：${current.world.course.name} · ${current.world.course.description}`;
      scene.update(state, current, dt);
      if (state.mode !== 'review' && state.phase === 'feedback' && !state.paused && (state.lastAnswer?.correct || state.lastAnswer?.classification === 'fullCorrect')) {
        const id = state.problem?.problemId;
        if (feedbackId !== id) { feedbackId = id; feedbackMs = 0; }
        feedbackMs += dt;
        if (feedbackMs >= 600 && onAdvance) { feedbackMs = -Infinity; onAdvance(state); return; }
      }
      help.hidden = !!state.result; hud.hidden = !!state.result;
      const learningSave = getLearningSaveStatus();
      saveAlert.hidden = !!state.result || !learningSave.failed || !learningSave.pending;
      if (!saveAlert.hidden) saveAlertText.textContent = `${learningSave.pending}問の記録を保存できていません。「いま保存をやり直す」を押してください。画面を閉じると未保存の記録は失われます。`;
      saveAlertRetry.disabled = !!state.paused;
      if (state.mode === 'review') {
        scene.root.hidden = true; skill.hidden = true; score.hidden = true; combo.hidden = true;
        help.textContent = definition.id === 'sentenceOrder' ? '文のつながりを、相棒とたしかめよう。' : 'ことばを、相棒とたしかめよう。';
      }
      if (soundAnswers!==current.answered||soundBoosts!==current.boosts||soundComplete!==current.completed) {
        soundAnswers=current.answered;soundBoosts=current.boosts;soundComplete=current.completed;
        if (['correct','boost','celebrate'].includes(current.reaction)) publish('playSE', current.reaction==='correct'?(info.scene==='shoot'?(current.combo>=3?'defeat':'attack'):'correct'):'achievement');
        else if (current.reaction === 'incorrect') publish('playSE', 'wrong');
        else if (current.reaction === 'partial') publish('playSE','decide');
      }
      result.hidden = !state.result;
      if (state.result) {
        if (!receipt) commit();
        const reviewing = state.mode === 'review';
        growthResult.root.hidden = reviewing;
        rankLabel.hidden = reviewing;
        findings && (findings.root.hidden = reviewing);
        replay.textContent = reviewing ? '通常の10問であそぶ' : 'もう一度あそぶ';
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
        nextGoal.textContent = reviewing ? `${state.correct} / ${state.totalQuestions}${definition.id === 'sentenceOrder' ? '文' : '語'}に正解。${getReviewCount() ? 'もう一度たしかめよう。' : '今回の復習はできたね！'}` : rank.next ? rank.goal : current.world?.goal || '次は自己ベストをこえよう';
        const challenge = current.world?.challenge;
        challengeResult.hidden = !challenge;
        if (challenge) {
          challengeResult.textContent = challenge.status === 'achieved' ? challenge.message : `今回の目標「${challenge.name}」は次の挑戦へ。`;
          challengeResult.dataset.status = challenge.status;
          nextGoal.textContent = challenge.next;
        }
        growthResult.update(state.paused ? 0 : dt);
        findings?.update(current.world?.findings);
        resultScore.textContent = `${points} pt`;
        stats.textContent = reviewing ? '相棒と、ことばをたしかめたよ。' : `${current.world?.course ? `${current.world.course.name} · ` : ''}${current.world?.summary || ''}${receipt?.reward?.newTimeBest?' · タイム更新！':''}`;
        result.dataset.world=info.scene;result.dataset.triumph=String(info.scene==='craft'?current.world?.completed===3:info.scene==='shoot'?current.world?.bossHp===0:info.scene==='defend'?state.life>0:current.correct>=8);
        replay.disabled = state.paused;
        if (!resultShown) { resultShown = true; root.scrollTop = 0; (onNotebook && receipt?.ok ? notebook : replay).focus({ preventScroll: true }); }
      }
    },
    dispose() { /* The view owns the root and all its descendants. No global listeners. */ },
  };
}
