import { publish } from '../core/eventBus.js';
import { audio } from '../audio/audio.js';
import { EVOLVE_LEVEL } from '../minigames/companionLooks.js';
import { XP_THRESHOLDS } from '../minigames/companionGrowth.js';
import { element, button, companionPortrait } from './adventureUI.js';

const CSS = `
#yt-evolution-room{width:min(980px,calc(100vw - 20px));height:min(740px,calc(100dvh - 20px));max-height:none;padding:0;background:#123b38;color:#fff;border:3px solid #f5cf75;overflow:auto}
#yt-evolution-room .yt-evo-inner{min-height:100%;padding:20px;background:radial-gradient(circle at 50% 42%,#438a75 0,#174d49 47%,#10342f 100%)}
#yt-evolution-room .yt-picker-header{align-items:flex-start}
#yt-evolution-room h2{font-size:clamp(26px,5vw,40px);color:#fff3bd}
#yt-evolution-room .yt-evo-lead{margin:10px 0 18px;line-height:1.6;font-weight:700}
#yt-evolution-room .yt-evo-layout{display:grid;grid-template-columns:minmax(180px,250px) minmax(0,1fr);gap:18px}
#yt-evolution-room .yt-evo-list{display:grid;align-content:start;gap:8px;max-height:54vh;overflow:auto;padding:3px}
#yt-evolution-room .yt-evo-pick{display:flex;align-items:center;gap:10px;min-height:62px;padding:7px 10px;text-align:left;border:2px solid #a9cfbe;border-radius:14px;background:#f7fff8;color:#15362c;font:inherit;cursor:pointer}
#yt-evolution-room .yt-evo-pick[aria-pressed=true]{border-color:#ffd66e;background:#fff4cb;box-shadow:0 0 0 2px #ffd66e55}
#yt-evolution-room .yt-evo-pick .gt-portrait{width:48px;height:48px}
#yt-evolution-room .yt-evo-pick span:last-child{display:grid;gap:2px}
#yt-evolution-room .yt-evo-pick small{font-size:12px}
#yt-evolution-room .yt-evo-main{text-align:center;min-width:0}
#yt-evolution-room .yt-evo-name{margin:0 0 6px;font-size:clamp(22px,4vw,34px)}
#yt-evolution-room .yt-evo-level{margin:0 auto 12px;max-width:430px;font-weight:800}
#yt-evolution-room .yt-evo-level progress{display:block;width:100%;height:15px;margin-top:5px;accent-color:#ffcf55}
#yt-evolution-room .yt-evo-stage{position:relative;display:flex;align-items:center;justify-content:center;gap:20px;min-height:270px;padding:20px;border:2px solid #9edbc3;border-radius:24px;background:radial-gradient(circle,#e9ffb02e,#fff0 65%),#133e3b}
#yt-evolution-room .yt-evo-stage .gt-portrait{width:min(34vw,210px);height:220px}
#yt-evolution-room .yt-evo-stage .gt-portrait img{image-rendering:pixelated}
#yt-evolution-room .yt-evo-arrow{font-size:clamp(30px,5vw,50px);color:#ffe083}
#yt-evolution-room .yt-evo-future{display:grid;place-items:center;width:min(34vw,210px);height:220px;border:2px dashed #b7d8c9;border-radius:22px;color:#fff2b6;font-size:76px;font-weight:900}
#yt-evolution-room .yt-evo-stage[data-phase=evolving] .gt-portrait{animation:yt-evo-rise 3.55s ease-in-out forwards}
#yt-evolution-room .yt-evo-stage[data-phase=evolving] .yt-evo-future{animation:yt-evo-flash 3.55s ease-in-out forwards}
#yt-evolution-room .yt-evo-status{min-height:42px;margin:12px 0;font-size:clamp(16px,2.5vw,21px);font-weight:800;line-height:1.5}
#yt-evolution-room .yt-evo-action{min-height:56px;padding:10px 28px;border:0;border-radius:16px;background:#ffcf54;color:#3d2900;font:inherit;font-size:20px;font-weight:900;cursor:pointer;box-shadow:0 5px 0 #9b6c17}
#yt-evolution-room .yt-evo-action:disabled{background:#d5e2d9;color:#435e50;box-shadow:none;cursor:default}
#yt-evolution-room .yt-evo-play{display:block;margin:12px auto 0;min-height:48px;padding:8px 20px;border:2px solid #e4ffe8;border-radius:14px;background:#e4ffe8;color:#15362c;font:inherit;font-weight:800;cursor:pointer}
#yt-evolution-room .yt-evo-foot{margin:16px 0 0;color:#e8f7ee;font-size:14px;line-height:1.5}
@keyframes yt-evo-rise{50%{transform:scale(1.2);filter:brightness(2.5)}100%{transform:scale(.78);opacity:.2}}
@keyframes yt-evo-flash{50%{background:#fff7bd;box-shadow:0 0 60px #ffe68d}100%{background:#fff7bd}}
@media(max-width:620px){#yt-evolution-room .yt-evo-inner{padding:14px}#yt-evolution-room .yt-evo-layout{display:flex;flex-direction:column}#yt-evolution-room .yt-evo-list{display:flex;max-height:none;overflow-x:auto;gap:7px}#yt-evolution-room .yt-evo-pick{min-width:145px}#yt-evolution-room .yt-evo-stage{min-height:200px;padding:10px;gap:8px}#yt-evolution-room .yt-evo-stage .gt-portrait,#yt-evolution-room .yt-evo-future{width:36vw;height:160px}#yt-evolution-room .yt-evo-future{font-size:48px}}
@media(prefers-reduced-motion:reduce){#yt-evolution-room .yt-evo-stage[data-phase=evolving] .gt-portrait,#yt-evolution-room .yt-evo-stage[data-phase=evolving] .yt-evo-future{animation:none}}
`;

export function createEvolutionDialog({ doc, service, selectedId, onClose, onChanged, onPlay }) {
  const dialog = element(doc, 'dialog', 'yt-companion-dialog yt-evolution');
  dialog.id = 'yt-evolution-room'; dialog.setAttribute('aria-label', 'しんかのへや');
  const style = element(doc, 'style'); style.textContent = CSS; dialog.append(style);
  const inner = element(doc, 'div', 'yt-evo-inner'); dialog.append(inner);
  const header = element(doc, 'div', 'yt-picker-header');
  header.append(element(doc, 'h2', '', 'しんかのへや'), button(doc, '広場へもどる', () => dialog.close()));
  const lead = element(doc, 'p', 'yt-evo-lead', `あいぼうと あそんで Lv${EVOLVE_LEVEL}に なると、ここで しんかさせられるよ。しんかしても なかまは そのまま！`);
  const layout = element(doc, 'div', 'yt-evo-layout'), list = element(doc, 'div', 'yt-evo-list');
  list.setAttribute('aria-label', 'しんかさせる ゴトモン');
  const main = element(doc, 'div', 'yt-evo-main'), name = element(doc, 'h3', 'yt-evo-name'), level = element(doc, 'div', 'yt-evo-level');
  const stage = element(doc, 'div', 'yt-evo-stage'), status = element(doc, 'p', 'yt-evo-status');
  status.setAttribute('role', 'status');
  const action = button(doc, '', () => act(), 'yt-evo-action'); action.dataset.action = 'evolve';
  const playAction = button(doc, '広場で あそぶ ゲームを えらぶ', () => onPlay?.(), 'yt-evo-play');
  playAction.dataset.action = 'play-to-evolve';
  main.append(name, level, stage, status, action, playAction);
  layout.append(list, main);
  inner.append(header, lead, layout, element(doc, 'p', 'yt-evo-foot', 'Lvは ミニゲームを さいごまで あそぶと 上がるよ。しんかした あとでも、もとの すがたを えらべるよ。'));

  const friends = service.getOwnedGotomon().filter(friend => service.getLook(friend.id).progress.evolve);
  let currentId = friends.some(friend => friend.id === selectedId) ? selectedId : friends[0]?.id;
  let busy = false, timer = null, musicTimer = null, musicActive = false;
  const render = (message = '') => {
    const friend = friends.find(item => item.id === currentId);
    list.replaceChildren(...friends.map(item => {
      const look = service.getLook(item.id), growth = service.getGrowth(item.id);
      const pick = button(doc, '', () => { if (busy) return; currentId = item.id; render(); }, 'yt-evo-pick');
      pick.dataset.gotomonId = item.id; pick.setAttribute('aria-pressed', String(item.id === currentId));
      pick.append(companionPortrait(doc, service.getGotomonById(item.id)),
        element(doc, 'span', '', ''));
      pick.lastChild.append(element(doc, 'strong', '', item.name),
        element(doc, 'small', '', look.chosen.evolve ? 'しんかした すがた' : look.progress.evolve.unlocked ? 'しんかできる！' : `Lv${growth.level} → Lv${EVOLVE_LEVEL}`));
      return pick;
    }));
    if (!friend) {
      name.textContent = 'あいぼうを さがしに いこう'; level.textContent = '';
      stage.replaceChildren(element(doc, 'p', '', '冒険で ゴトモンと なかまに なろう。'));
      status.textContent = 'なかまが できたら、また ここに 来てね。'; action.hidden = true; playAction.hidden = true; return;
    }
    const look = service.getLook(friend.id), growth = service.getGrowth(friend.id), evolved = !!look.chosen.evolve && look.progress.evolve.unlocked;
    name.textContent = friend.name;
    const needXp = XP_THRESHOLDS[EVOLVE_LEVEL - 1];
    level.replaceChildren(element(doc, 'span', '', look.progress.evolve.unlocked ? `Lv${growth.level}　しんかできるよ！` : `いま Lv${growth.level}　しんかまで あと ${needXp - growth.xp} XP`));
    const progress = element(doc, 'progress'); progress.max = needXp; progress.value = Math.min(growth.xp, needXp);
    progress.setAttribute('aria-label', 'しんかまでのレベル'); level.append(progress);
    const base = companionPortrait(doc, service.getBaseGotomonById(friend.id));
    const future = evolved ? companionPortrait(doc, service.getGotomonById(friend.id)) : element(doc, 'span', 'yt-evo-future', '？');
    stage.replaceChildren(base, element(doc, 'span', 'yt-evo-arrow', '→'), future);
    stage.dataset.phase = evolved ? 'evolved' : 'ready';
    status.textContent = message || (evolved ? 'しんかした すがたで いっしょに あそんでいるよ！' :
      look.progress.evolve.unlocked ? 'じゅんび OK！ 「しんかさせる」を おしてね。' : `あと ${needXp - growth.xp} XP。ミニゲームで いっしょに あそぼう！`);
    action.hidden = false; action.disabled = !look.progress.evolve.unlocked;
    playAction.hidden = look.progress.evolve.unlocked || !onPlay;
    action.textContent = evolved ? 'もとの すがたで あそぶ' : 'しんかさせる！';
  };
  const act = () => {
    if (!currentId || busy) return;
    const look = service.getLook(currentId), evolved = !!look.chosen.evolve && look.progress.evolve?.unlocked;
    if (!look.progress.evolve?.unlocked) return;
    const outcome = service.setLook({ gotomonId: currentId, key: 'evolve', on: !evolved });
    if (!outcome?.ok) { render('記録を たしかめて、もう一度 ためしてね。'); return; }
    onChanged?.();
    if (evolved) { publish('playSE', 'cancel'); render('もとの すがたで あそぶよ。しんかした すがたには いつでも もどせるよ。'); return; }
    busy = true; action.disabled = true; stage.dataset.phase = 'evolving'; status.textContent = `${friends.find(item => item.id === currentId)?.name}が しんかするよ…`;
    const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!reducedMotion) {
      audio.playBGM('evolution', false);
      musicActive = true;
      audio.playSE('evolutionGlimmer');
    }
    timer = setTimeout(() => {
      timer = null;
      if (!dialog.isConnected) return;
      audio.playSE('evolutionReveal');
      render(`${friends.find(item => item.id === currentId)?.name}が しんかした！ いっしょに あそぼう！`);
      if (musicActive) {
        action.disabled = true;
        musicTimer = setTimeout(() => {
          musicTimer = null;
          if (musicActive) { audio.playBGM('miniGameHub'); musicActive = false; }
          busy = false; action.disabled = false;
        }, 1150);
      } else busy = false;
    }, reducedMotion ? 0 : 3550);
  };
  render();
  dialog.addEventListener('close', () => {
    if (timer) clearTimeout(timer);
    if (musicTimer) clearTimeout(musicTimer);
    if (musicActive) { audio.playBGM('miniGameHub'); musicActive = false; }
    dialog.remove(); onClose?.();
  }, { once: true });
  return dialog;
}
