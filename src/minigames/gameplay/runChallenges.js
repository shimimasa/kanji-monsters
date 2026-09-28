// Optional goals are local to a run. They guide play without changing answers or scores.
const GOALS = Object.freeze({
  mathSprint: [
    { id: 'jump', name: '障害を2回ジャンプ', deadline: 9, target: 2,
      rule: '力を2ためて、障害区間で「攻める」を選ぼう。', hint: '障害は3・6・9区間目。', value: data => data.jumps },
    { id: 'pace', name: '7問目までに加速3.5', deadline: 7, target: 3.5,
      rule: '正解を重ねてスピードを上げよう。', hint: '間違えるとスピードが下がる。', value: data => data.world.speed || 0 },
  ],
  mathInvader: [
    { id: 'priority', name: '手前の敵を3回ねらう', deadline: 8, target: 3,
      rule: '迫っている敵を選び、計算を正解しよう。', hint: '近い敵は目印がつく。', value: data => data.priorityHits },
    { id: 'chain', name: '4回連続で撃破', deadline: 8, target: 4,
      rule: '正解をつなげて連続撃破しよう。', hint: '敵を選んでから計算に集中。', value: data => data.maxCombo },
  ],
  englishChoice: [
    { id: 'rare', name: 'レア宝箱を1つ発見', deadline: 6, target: 1,
      rule: 'レアな道を選び、部屋の問題をすべて正解しよう。', hint: '部屋の途中では道を変えられない。',
      value: data => data.world.findings?.filter(item => item.kind === 'rare').length || 0 },
    { id: 'chests', name: '3部屋で宝箱を発見', deadline: 9, target: 3,
      rule: '最初の3部屋で宝箱を集めよう。', hint: '安全な道でも宝箱は見つかる。', value: data => data.world.chests || 0 },
  ],
  sentenceOrder: [
    { id: 'chain', name: '3つの文を連続完成', deadline: 6, target: 3,
      rule: '正しい文を3回続けてつくろう。', hint: '言葉のつながりを読んでから決定。', value: data => data.maxCombo },
    { id: 'rainbow', name: '虹の橋を2本かける', deadline: 8, target: 2,
      rule: '連続正解や相棒技で虹の橋をつくろう。', hint: '3連続正解でも虹の橋になる。', value: data => data.world.special || 0 },
  ],
  timedChoice: [
    { id: 'towers', name: '8問目までに灯台を3つ', deadline: 8, target: 3,
      rule: '正解で光を回復し、灯台へ分けよう。', hint: '光が35以上なら灯台に灯せる。', value: data => data.world.towers || 0 },
    { id: 'balance', name: '灯台2つと光40を残す', deadline: 8, target: 3,
      rule: '灯台を2つ灯し、光を40以上保とう。', hint: '光が減る前に答え、技も使ってみよう。',
      value: data => Math.min(2, data.world.towers || 0) + ((data.world.light || 0) >= 40 ? 1 : 0) },
  ],
  asyncChoice: [
    { id: 'rare', name: '遺跡でレア発見', deadline: 6, target: 1,
      rule: '林道と海辺で手がかりを集め、遺跡を調べよう。', hint: '遺跡は手がかり2つと2問正解で特別な発見。', value: data => data.world.rare || 0 },
    { id: 'rumor', name: '3地点目までにうわさの場所へ', deadline: 6, target: 1,
      rule: '地図の☆の場所を早めに調べよう。', hint: '行き先はつながった道から選ぶ。',
      value: data => { const index = data.world.path?.indexOf(data.world.featured) ?? -1;
        return index >= 0 && index < 3 && (data.world.findings?.[index]?.points || 0) >= 25 ? 1 : 0; } },
  ],
  kanjiDefense: [
    { id: 'chain', name: '4回連続で読みを正解', deadline: 8, target: 4,
      rule: '敵を選び、読みを4回続けて正解しよう。', hint: '落ち着いて読むことが旅路を守る。', value: data => data.maxCombo },
    { id: 'clear', name: '12問で9問正解', deadline: 12, target: 9,
      rule: '最後まで進み、9問以上の読みを正解しよう。', hint: '間違えた読みは結果で確かめられる。', value: data => data.correct },
  ],
});

export function createRunChallenge(gameId, variation = 0) {
  const goals = GOALS[gameId];
  if (!goals) return null;
  let selected = goals[Math.abs(variation) % goals.length];
  const data = { answered: 0, correct: 0, maxCombo: 0, jumps: 0, priorityHits: 0, world: {} };
  let status = 'active', achievedAt = null;
  const evaluate = () => {
    if (status !== 'active') return;
    if (selected.value(data) >= selected.target) { status = 'achieved'; achievedAt = data.answered; }
    else if (data.answered >= selected.deadline) status = 'missed';
  };
  return {
    choose(action) {
      const goal = goals.find(item => action === `run-goal-${item.id}`);
      if (data.answered || !goal) return false;
      selected = goal; evaluate(); return true;
    },
    observeAction(world) { data.world = world; evaluate(); },
    observeAnswer({ correct, combo, before, world, state }) {
      if (correct && gameId === 'mathSprint' && before.danger && before.energy >= 2 && before.actions?.some(action => action.id === 'push' && action.selected)) data.jumps++;
      if (correct && gameId === 'mathInvader' && state?.selectedEnemy?.enemyId && state.selectedEnemy.enemyId === before.priority) data.priorityHits++;
      data.answered++; if (correct) data.correct++;
      data.maxCombo = Math.max(data.maxCombo, combo || 0);
      data.world = world; evaluate();
    },
    complete() { if (status === 'active') status = 'missed'; },
    snapshot() {
      const value = selected.value(data);
      const progress = `${Math.min(selected.target, Math.round(value * 10) / 10)}/${selected.target}`;
      const remaining = Math.max(0, selected.deadline - data.answered);
      return { id: selected.id, name: selected.name, rule: selected.rule, hint: selected.hint,
        status, progress, remaining, achievedAt, canChoose: data.answered === 0,
        choices: goals.map(goal => ({ id: `run-goal-${goal.id}`, label: goal.name, hint: goal.rule,
          selected: goal === selected, enabled: data.answered === 0 })),
        message: status === 'achieved' ? `目標達成！「${selected.name}」` :
          status === 'missed' ? `「${selected.name}」は次の挑戦へ。` : `${selected.rule} あと${remaining}問。`,
        next: status === 'achieved' ? '次は別の目標を選んで挑戦しよう。' : selected.hint };
    },
  };
}
