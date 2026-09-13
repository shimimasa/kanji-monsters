import { publish } from '../core/eventBus.js';
import { element, button, companionPortrait } from '../ui/adventureUI.js';
import { gameExperiences } from './gameExperiences.js';
import { createCompanionScene } from './companionScene.js';
import { createGrowthResult } from './growthResult.js';
import { friendshipTitle } from './companionGrowth.js';
import { scoreRank } from './scoreRank.js';
import { createFindings } from './scenePolish.js';

export function createMiniGameShell({ doc, view, definition, gotomon, play, onPause, onBoost, onAct, onAdvance, onBack, onReplay, award }) {
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
  const hud = element(doc, 'div', 'gt-hud'), name = element(doc, 'span', 'gt-friend-name', gotomon?.name || '相棒なし');
  const score = element(doc, 'strong'), combo = element(doc, 'span');
  name.textContent = `${gotomon?.name || '相棒'} Lv${play.snapshot().growth.level}`;
  hud.append(name, score, combo);
  const skill = button(doc, '', onBoost, 'gt-button gt-skill'); skill.dataset.action = 'boost';
  const gauge = element(doc, 'meter'); gauge.min = 0; gauge.max = 3; gauge.value = 0; gauge.setAttribute('aria-label', '相棒ゲージ');
  const skillLabel = element(doc, 'span'); skill.append(gauge, skillLabel); hud.append(skill); soundPanel.after(hud);
  const scene = createCompanionScene({ doc, root, info, gotomon, act: onAct }); hud.after(scene.root);
  if(info.scene==='lantern')scene.root.querySelector('.gt-scene').append(skill);
  const help = element(doc, 'p', 'gt-help', info.goal); scene.root.after(help);
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
  const rankLabel = element(doc, 'strong', 'gt-rank'), nextGoal = element(doc, 'p', 'gt-replay-goal');
  const growthResult = createGrowthResult(doc, portrait);
  const findings=['treasure','explore','craft'].includes(info.scene)?createFindings(doc,info.scene==='explore'?5:info.scene==='craft'?3:4):null;
  const replay = button(doc, 'もう一度あそぶ', onReplay, 'gt-button gt-primary'); replay.dataset.action = 'replay';
  const retrySave = button(doc, '記録の保存を再試行', () => { receipt = null; commit(); }, 'gt-button'); retrySave.hidden = true;
  resultActions.append(replay, button(doc, 'ミニゲーム広場へ', onBack, 'gt-button'));
  stats.className='gt-world-result';
  result.append(rankLabel, portrait, resultName, resultTitle, stats);
  if(findings)result.append(findings.root);
  result.append(growthResult.root,nextGoal,resultActions,reward,retrySave);
  shell.append(result);
  const legacyResult = root.querySelector('[class$="-result"]:not(.gt-result)');
  if (legacyResult) legacyResult.classList.add('gt-learning-result');
  const resultDetails = element(doc, 'details', 'gt-result-details');
  resultDetails.append(element(doc, 'summary', '', 'くわしい記録・問題のふりかえり'),resultScore,record);
  if (legacyResult) { legacyResult.before(resultDetails); resultDetails.append(legacyResult); }
  result.append(resultDetails);
  resultDetails.append(button(doc, '新しい相棒を探しに冒険へ', () => { onBack(); publish('changeScreen', 'title'); }, 'gt-button'));
  let state = null, receipt = null, resultShown = false, soundAnswers=0,soundBoosts=0,soundComplete=false;
  let feedbackId = null, feedbackMs = 0;
  function commit() {
    const current = play.snapshot();
    receipt = award({ score: (state.result?.score ?? current.learningPoints) + current.bonus,
      correct: current.correct, maxCombo: current.maxCombo, completed: current.completed,
      finished: (state.answered ?? state.resolved ?? 0) >= (definition.id === 'kanjiDefense' ? 12 : 10), activeElapsedMs: state.activeElapsedMs, timeMs:current.world?.timeMs });
    if (receipt.ok) {
      const value = receipt.reward;
      growthResult.show(value);
      if (value && !value.duplicate) resultTitle.textContent = friendshipTitle(value.friendship).message;
      reward.textContent = value?.duplicate ? '記録は保存済みです。' : `なかよし +${value.earned} → ${value.friendship} · いっしょに${value.plays}回${value.medals.includes('five-plays') ? ' · メダル「いつもの相棒」' : ''}`;
      record.textContent = `${value?.newBest ? '✦ 自己ベスト！ ' : 'BEST '}${value?.bestScore ?? ''}`;
      result.dataset.newBest = String(!!value?.newBest);
      resultDetails.append(reward);
    } else reward.textContent = '記録を保存できませんでした。画面を閉じる前に再試行できます。';
    retrySave.hidden = receipt.ok;
  }
  return {
    update(next, dt = 0) {
      state = next; const current = play.snapshot();
      root.dataset.paused = String(state.paused); root.dataset.completed = String(!!state.result);
      // Pause owns all play input, while navigation, sound and resume remain active.
      for (const child of shell.children) {
        if (![header, soundPanel].includes(child)) child.inert = !!state.paused;
      }
      pause.textContent = state.paused ? '再開' : '一時停止'; pause.disabled = !!state.result;
      gauge.value = Math.min(3, current.gauge); skill.disabled = state.paused || !!state.result || current.gauge < 3;
      skillLabel.textContent = info.scene==='lantern'?(current.gauge>=3?'光をひらく！':'正解で光がたまる'):current.gauge >= 3 ? `${info.skill} · ${info.scene==='craft'?'2ルートへ光':info.effect}` : `${info.skill} ${Math.floor(current.gauge)}/3`;
      skill.title = `${current.growth.description}・技 ${current.skillPoints}pt＋ゲーム固有効果`;
      score.textContent = `${(state.score ?? current.learningPoints) + current.bonus} pt`;
      combo.textContent = `${current.combo} COMBO`;
      scene.update(state, current, dt);
      if (state.phase === 'feedback' && !state.paused && (state.lastAnswer?.correct || state.lastAnswer?.classification === 'fullCorrect')) {
        const id = state.problem?.problemId;
        if (feedbackId !== id) { feedbackId = id; feedbackMs = 0; }
        feedbackMs += dt;
        if (feedbackMs >= 600 && onAdvance) { feedbackMs = -Infinity; onAdvance(state); return; }
      }
      help.hidden = !!state.result; hud.hidden = !!state.result;
      if (soundAnswers!==current.answered||soundBoosts!==current.boosts||soundComplete!==current.completed) {
        soundAnswers=current.answered;soundBoosts=current.boosts;soundComplete=current.completed;
        if (['correct','boost','celebrate'].includes(current.reaction)) publish('playSE', current.reaction==='correct'?(info.scene==='shoot'?(current.combo>=3?'defeat':'attack'):'correct'):'achievement');
        else if (current.reaction === 'incorrect') publish('playSE', 'wrong');
        else if (current.reaction === 'partial') publish('playSE','decide');
      }
      result.hidden = !state.result;
      if (state.result) {
        if (!receipt) commit();
        const points = (state.result.score ?? current.learningPoints) + current.bonus;
        const rank = scoreRank(definition.id, points, current.correct);
        rankLabel.textContent = `${rank.rank} RANK`; rankLabel.dataset.rank = rank.rank;
        nextGoal.textContent = rank.next ? rank.goal : current.world?.goal || '次は自己ベストをこえよう';
        growthResult.update(state.paused ? 0 : dt);
        findings?.update(current.world?.findings);
        resultScore.textContent = `${points} pt`;
        stats.textContent = `${current.world?.summary || ''}${receipt?.reward?.newTimeBest?' · タイム更新！':''}`;
        result.dataset.world=info.scene;result.dataset.triumph=String(info.scene==='craft'?current.world?.completed===3:info.scene==='shoot'?current.world?.bossHp===0:info.scene==='defend'?state.life>0:current.correct>=8);
        replay.disabled = state.paused;
        if (!resultShown) { resultShown = true; root.scrollTop = 0; replay.focus({ preventScroll: true }); }
      }
    },
    dispose() { /* The view owns the root and all its descendants. No global listeners. */ },
  };
}
