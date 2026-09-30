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
    { id: 'quick', name: 'はやわざキャッチ5回', deadline: 99, target: 5,
      rule: '宝箱が半分まで来る前に、正しい宝箱をキャッチしよう。', hint: '単語を見たら、すぐに意味を思い出そう。', value: data => data.world.quick || 0 },
    { id: 'chain', name: '5回連続でキャッチ', deadline: 99, target: 5,
      rule: '正解をつないで、宝箱を続けてキャッチしよう。', hint: 'まちがえても、次からまたつなげられる。', value: data => data.maxCombo },
  ],
  sentenceOrder: [
    { id: 'chain', name: '3つの文を連続完成', deadline: 99, target: 3,
      rule: '正しい文を3回続けてつくろう。', hint: '言葉のつながりを読んでから板をえらぼう。', value: data => data.maxCombo },
    { id: 'quick', name: '相棒を止めずに3回わたらせる', deadline: 99, target: 3,
      rule: '相棒が川岸に着く前に、橋を完成させよう。', hint: '文のはじめになる板から探そう。', value: data => data.world.quick || 0 },
  ],
  timedChoice: [
    { id: 'quick', name: 'すばやく5回たたく', deadline: 99, target: 5,
      rule: 'もぐらが出てすぐに、正しい読みをたたこう。', hint: '言葉を見たら、声に出さずに読んでみよう。', value: data => data.world.quick || 0 },
    { id: 'chain', name: '4回連続でたたく', deadline: 99, target: 4,
      rule: '正しい読みを4回続けてたたこう。', hint: 'あわてず、読みをたしかめてからたたこう。', value: data => data.maxCombo },
  ],
  multiSelect: [
    { id: 'perfect', name: '星座を3つ完成', deadline: 99, target: 3,
      rule: 'お題に合う星をぜんぶ集めて、星座を3つ完成させよう。', hint: '合わない星は、集めずに見送ろう。', value: data => data.correct },
    { id: 'chain', name: '2回連続で星座を完成', deadline: 99, target: 2,
      rule: '星座を2回続けて完成させよう。', hint: '「あつめた！」の前に、もう一度お題を読もう。', value: data => data.maxCombo },
  ],
  asyncChoice: [
    { id: 'chain', name: '4回連続で正しい線路', deadline: 99, target: 4,
      rule: '正しい線路を4回続けてえらぼう。', hint: '問題をよく読んでから線路をタップ。', value: data => data.maxCombo },
    { id: 'quick', name: 'はやわざ発見5回', deadline: 99, target: 5,
      rule: 'トロッコが分かれ道の半分まで来る前に、線路をえらぼう。', hint: 'わかる問題は、すぐにタップしよう。', value: data => data.world.quick || 0 },
  ],
  photoRally: [
    { id: 'best', name: 'ベストショット3まい', deadline: 99, target: 3,
      rule: 'ゴトモンが顔を出してすぐに読みを選び、★3の写真を撮ろう。', hint: '文を読んで、漢字の読みを思い出そう。', value: data => data.world.bestShots || 0 },
    { id: 'chain', name: '5まい連続で撮る', deadline: 99, target: 5,
      rule: '正しい読みを続けて、写真を5まい続けて撮ろう。', hint: 'まちがえても、次からまたつなげられる。', value: data => data.maxCombo },
  ],
  proverbDetective: [
    { id: 'brilliant', name: '名推理を3回', deadline: 99, target: 3,
      rule: '虫めがねのヒントが出る前に、1回で正しいことわざを当てよう。', hint: '話の中で、いちばん大事なことは何か考えよう。', value: data => data.world.brilliant || 0 },
    { id: 'chain', name: '4件連続で1回で解決', deadline: 99, target: 4,
      rule: '容疑者をまちがえずに、4件続けて解決しよう。', hint: 'まよったら、ヒントの意味を読んでから指名しよう。', value: data => data.maxCombo },
  ],
  gotomonBubble: [
    { id: 'rescue', name: 'ゴトモンを3ひき たすける', deadline: 99, target: 3,
      rule: 'ゴトモンの入った泡をわって、たすけよう。', hint: 'ゴトモンの泡の上の方をわると、下の泡もいっしょに落ちるよ。', value: data => data.world.bubbleFreed || 0 },
    { id: 'chain', name: '5発連続で同じ答えに当てる', deadline: 99, target: 5,
      rule: '同じ答えの泡に当てるのを5回つなげよう。', hint: 'うつ前に、じゅんびした泡の答えを出しておこう。', value: data => data.maxCombo },
  ],
  gotomonDelivery: [
    { id: 'sharp', name: '1回でとどける8こ', deadline: 99, target: 8,
      rule: 'ヒントをよく読んで、ふるさとの都道府県をえらぼう。', hint: '名物や場所の名前が、ふるさとの大きな手がかりだよ。', value: data => data.correct },
    { id: 'chain', name: '4こ連続で1回でとどける', deadline: 99, target: 4,
      rule: '1回でとどけるのを4回つなげよう。', hint: '地図の場所も見て、どの地方か考えよう。', value: data => data.maxCombo },
  ],
  gotomonFishing: [
    { id: 'sharp', name: '1回でつる10匹', deadline: 99, target: 10,
      rule: 'ふだをよく読んでから、合うゴトモンをつろう。', hint: '🔊で英語を聞いてから、ふだを見くらべよう。', value: data => data.correct },
    { id: 'chain', name: '5匹連続で1回でつる', deadline: 99, target: 5,
      rule: '1回でつるのを5回つなげよう。', hint: 'つる前に、4まいのふだを全部読んでみよう。', value: data => data.maxCombo },
  ],
  gotomonToss: [
    { id: 'sharp', name: '1回で入れる球を10こ', deadline: 99, target: 10,
      rule: 'ちゃんと計算してから、答えのかごをねらおう。', hint: 'かごは止まらないけど、あわてなくて大丈夫。先に答えを出してからさがそう。', value: data => data.correct },
    { id: 'chain', name: '5球連続で1回で入れる', deadline: 99, target: 5,
      rule: '1回で入れるのを5回つなげよう。', hint: '同じ数字が近くにないか、かごの数字をよく見よう。', value: data => data.maxCombo },
  ],
  kanjiSort: [
    { id: 'stars', name: '⭐を18こ', deadline: 99, target: 18,
      rule: 'カードを1回で正しい場所に入れると、パズルの⭐がふえるよ。', hint: 'まよったら、画数を指で数えたり、読みを声に出さずに読んだりしよう。', value: data => data.world.sortStars || 0 },
    { id: 'chain', name: '6回連続で1回で置く', deadline: 99, target: 6,
      rule: 'つぎに入るカードを、まちがえずに6回続けて置こう。', hint: 'ルールの「→」の向きを見てから選ぼう。', value: data => data.maxCombo },
  ],
  gotomonShop: [
    { id: 'tips', name: 'チップ⭐を25こ', deadline: 99, target: 25,
      rule: 'お客さんがごきげんなうちに、正しい漢字をわたそう。', hint: 'わかるおねがいから先にかなえると、みんなごきげん。', value: data => data.world.shopTips || 0 },
    { id: 'chain', name: '5人連続で1回でわたす', deadline: 99, target: 5,
      rule: '1回で正しい漢字をわたすのを5回つなげよう。', hint: 'ふきだしの読みを、声に出さずに読んでみよう。', value: data => data.maxCombo },
  ],
  kanjiMemory: [
    { id: 'sharp', name: 'すぐに見つけるペア8組', deadline: 99, target: 8,
      rule: '一度見たカードの場所をおぼえて、まよわずペアにしよう。', hint: '読みのカードは、声に出さずに読んでおぼえよう。', value: data => data.correct },
    { id: 'chain', name: '4組連続でそろえる', deadline: 99, target: 4,
      rule: 'ペアを4組続けてそろえよう。', hint: '👀のぞき見は、カードがたくさん残っているときに使うと強い。', value: data => data.maxCombo },
  ],
  kanjiBingo: [
    { id: 'lines', name: 'ビンゴを2列', deadline: 99, target: 2,
      rule: 'たて・よこ・ななめを2列そろえよう。', hint: '⭐スタンプは、リーチの列に使うとそろいやすい。', value: data => data.world.bingoLines || 0 },
    { id: 'chain', name: '5問連続で正解', deadline: 99, target: 5,
      rule: '1回で当てるのを5回つなげよう。', hint: 'よみの問題は、文を声に出さずに読んでみよう。', value: data => data.maxCombo },
  ],
  tripSugoroku: [
    { id: 'boss', name: 'ボスを倒す', deadline: 99, target: 1,
      rule: '道具を集めて、地方のボスを倒そう。', hint: '⭐きらきらはボスに2ダメージ。とっておこう。', value: data => data.world.bossDefeated ? 1 : 0 },
    { id: 'chain', name: '5問連続で正解', deadline: 99, target: 5,
      rule: '正解をつないで、旅の追い風に乗ろう。', hint: '🔥ヒントの火で、まよう問題を助けてもらおう。', value: data => data.maxCombo },
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
  'milk-lantern': { id: 'splash', name: 'しずくハンマーを1回', deadline: 99, target: 1,
    rule: '2回続けて正解すると、次のひとたたきがしずくハンマーになる。', hint: 'しずくハンマーは次の正解で自動で使われる。', value: data => data.world.special || 0 },
  'treasure-key': { id: 'gold', name: '金の宝箱を1つ', deadline: 99, target: 1,
    rule: '2回続けて正解すると、ひみつの鍵で次の宝箱が金の宝箱になる。', hint: '鍵は次の正解で自動で使われる。', value: data => data.world.special || 0 },
  'bridge-anchor': { id: 'rainbow', name: '虹の橋を1本', deadline: 99, target: 1,
    rule: '2つの文を続けて完成させると、次の橋が虹の橋になる。', hint: '虹の支えは次の正解で自動で使われる。', value: data => data.world.special || 0 },
  'explorer-compass': { id: 'compass', name: '羅針盤の宝を2つ', deadline: 99, target: 2,
    rule: '2回続けて正しい線路をえらぶと、羅針盤が次の宝を大きくする。', hint: '羅針盤は次の正解で自動で使われる。', value: data => data.world.special || 0 },
  'star-reserve': { id: 'shooting', name: '流れ星を1つ', deadline: 99, target: 1,
    rule: '星座を2つ続けて完成させると、次の星座に流れ星がかかる。', hint: 'たくわえた光は次の完成で自動で使われる。', value: data => data.world.special || 0 },
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
        next: status === 'achieved' ? '次は別の目標にも挑戦しよう。' : selected.hint };
    },
  };
}
