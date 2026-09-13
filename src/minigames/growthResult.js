import { element } from '../ui/adventureUI.js';
import { growthStatus, friendshipTitle } from './companionGrowth.js';

export function createGrowthResult(doc, portrait) {
  const root=element(doc,'div','gt-growth-result'), title=element(doc,'strong');
  const track=element(doc,'div','gt-xp-track'), fill=element(doc,'span'), detail=element(doc,'p','gt-growth-detail'), goal=element(doc,'p','gt-replay-goal');
  track.setAttribute('role','progressbar');track.setAttribute('aria-label','相棒の経験値');track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.append(fill);
  root.append(title,track,detail,goal); root.hidden=true; let reward=null,elapsed=0;
  return {root,show(value){reward=value;elapsed=0;root.hidden=!value?.after||!!value.duplicate;},update(dt=0){
    if(!reward?.after || reward.duplicate)return;
    elapsed+=dt;const ratio=Math.min(1,elapsed/(reward.levelUp?1400:700));
    const current=growthStatus({xp:Math.floor(reward.before.xp+(reward.after.xp-reward.before.xp)*ratio)});
    const levelUp=reward.levelUp&&current.level>reward.before.level;
    fill.style.width=`${current.fraction*100}%`;track.setAttribute('aria-valuenow',String(Math.round(current.fraction*100)));
    title.textContent=levelUp?`Lv ${current.level}になった！ +${reward.earnedXP}XP`:`Lv ${current.level} · XP +${reward.earnedXP}`;
    portrait.classList.toggle('gt-level-up',levelUp&&elapsed<2200);root.dataset.levelUp=String(levelUp);
    detail.textContent=reward.earnedXP===0&&reward.after.level<10?'短時間プレイはXP対象外。記録は保存済み':reward.levelUp&&reward.before.tier!==reward.after.tier?reward.after.description:reward.after.nextUnlock;
    const bond=friendshipTitle(reward.friendship);
    goal.textContent=reward.after.remaining?`あと${reward.after.remaining} XPでLv${reward.after.level+1}`:bond.next?`なかよし あと${bond.next-reward.friendship}で「${friendshipTitle(bond.next).title}」`:'育ちきった相棒で、記録を更新しよう';
  }};
}
