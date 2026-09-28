// Optional goals are local to a run. They guide play without changing answers or scores.
const GOALS = Object.freeze({
  // Arcade goals run for the whole session (deadline 99), so nothing is marked
  // "missed" in the middle of play.
  mathSprint: [
    { id: 'clean', name: '止まらずに5回ジャンプ', deadline: 99, target: 5,
      rule: 'ハードルに着く前に答えて、止まらずにとびこえよう。', hint: '早めに答えるほど、走り続けられる。', value: data => data.world.cleanJumps || 0 },
    { id: 'chain', name: '5回連続でジャンプ', deadline: 99, target: 5,
      rule: '正解をつないで、ハードルを続けてとびこえよう。', hint: 'まちがえても、次からまたつなげられる。', value: data => data.maxCombo },
  ],
  mathInvader: [
    { id: 'chain', name: '4回連続で撃破', deadline: 99, target: 4,
      rule: '正解をつなげて連続撃破しよう。', hint: '近い敵から順にねらうと、つなげやすい。', value: data => data.maxCombo },
    { id: 'boss', name: 'ボスをいっぱつで撃破', deadline: 99, target: 1,
      rule: '最後に出てくるボスを、1回で撃ちぬこう。', hint: 'ボスはゆっくり。落ち着いて計算しよう。', value: data => data.world.bossFirstTry ? 1 : 0 },
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
    { id: 'chain', name: '4回連続で読みを正解', deadline: 99, target: 4,
      rule: '読みを4回続けて正解しよう。', hint: '落ち着いて読むことが旅路を守る。', value: data => data.maxCombo },
    { id: 'clear', name: '12体中9体を撃退', deadline: 99, target: 9,
      rule: '最後まで守り、9体以上を読みで撃退しよう。', hint: '読めなかった字は結果で確かめられる。', value: data => data.correct },
  ],
});

const COURSE_GOALS = Object.freeze({
  'potato-shortcut': { id: 'shortcut', name: 'ころころ近道を2回', deadline: 99, target: 2,
    rule: '2回続けて正解ジャンプすると、転がって近道できる。', hint: '早めに答えて、ジャンプをつなげよう。', value: data => data.world.shortcuts || 0 },
  'corn-barrage': { id: 'golden', name: '黄金弾を1発当てる', deadline: 99, target: 1,
    rule: '3回続けて撃破すると、次の一発が黄金弾になる。', hint: '黄金弾は次の正解で自動で撃てる。', value: data => data.world.goldenHits || 0 },
  'milk-lantern': { id: 'drops', name: 'しずくで灯台を3つ', deadline: 8, target: 3,
    rule: 'しずくを使い、問題に答えながら灯台を3つ灯そう。', hint: 'しずくは問題ごとに1つ蓄えられる。',
    value: data => data.world.poured ? data.world.towers || 0 : 0 },
  'treasure-key': { id: 'key', name: '鍵で宝箱を守る', deadline: 9, target: 1,
    rule: '2回続けて正解し、作った鍵で宝箱を見つけよう。', hint: '鍵は部屋の途中でも使える。', value: data => data.world.guardedChests || 0 },
  'bridge-anchor': { id: 'anchor', name: '支えで虹の橋をかける', deadline: 8, target: 1,
    rule: '文を続けて完成し、支えを使って次の橋を虹色に。', hint: '支えを使った次の文を正解しよう。', value: data => data.world.anchorBridges || 0 },
  'explorer-compass': { id: 'compass', name: '羅針盤で2地点発見', deadline: 8, target: 2,
    rule: '2問続けて正解し、次の探索で羅針盤を使おう。', hint: '地点を選ぶ前に使える。', value: data => data.world.compassFindings || 0 },
  'defense-ward': { id: 'ward', name: '札で2回撃退', deadline: 99, target: 2,
    rule: '2回続けて正解すると札ができ、次の撃退が強くなる。', hint: '札は次の正解で自動で使われる。', value: data => data.world.wardHits || 0 },
});

export function createRunChallenge(gameId, variation = 0, course = null) {
  const base = GOALS[gameId];
  if (!base) return null;
  const courseGoal = COURSE_GOALS[course?.id];
  const goals = courseGoal ? [courseGoal, ...base] : base;
  let selected = courseGoal || goals[Math.abs(variation) % goals.length];
  const data = { answered: 0, correct: 0, maxCombo: 0, world: {} };
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
    observeAnswer({ correct, combo, world }) {
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
