// Worlds for the one-question-at-a-time arcade games. The current question's
// targets approach while it is unanswered and wait at the end instead of failing;
// answering earlier earns more. Worlds read committed answers and the Host clock
// only: they never answer, grade, or change the learning Core.
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

const KINDS = Object.freeze({
  // travel: how long the targets take to arrive (normal / slow pace), in ms.
  chest: { travel: [7000, 11000], label: '宝箱', unit: 'つ', verb: 'キャッチ', skill: 'おたからフィーバー', special: '金の宝箱' },
  mole: { travel: [5000, 8000], label: 'ゴトモン', unit: '匹', verb: 'ハイタッチ', skill: 'ゴトモンフィーバー', special: 'しずくハンマー' },
  cart: { travel: [8000, 12000], label: '宝石', unit: 'こ', verb: '発見', skill: '発見フィーバー', special: '羅針盤の宝' },
  stars: { travel: [12000, 18000], label: '星座', unit: 'つ', verb: '完成', skill: '星のきらめき', special: '流れ星' },
  bridge: { travel: [9000, 14000], label: '橋', unit: '本', verb: 'かけた', skill: '虹のかけ橋', special: '虹の橋' },
  photo: { travel: [6000, 9500], label: '写真', unit: 'まい', verb: '撮った', skill: 'シャッターチャンス', special: 'ベストショット' },
  trip: { travel: [9000, 13000], label: '旅', unit: '問', verb: '進んだ', skill: '旅の追い風', special: '追い風' },
  slash: { travel: [6000, 9500], label: 'くす玉', unit: 'こ', verb: 'パカッ', skill: 'スラッシュフィーバー', special: 'いっとう両断' },
  coloring: { travel: [5000, 8000], label: 'マス', unit: 'マス', verb: 'ぬった', skill: 'ぬりぬりフィーバー', special: 'ぴったり色' },
  tag: { travel: [8000, 11000], label: 'ふだ', unit: '問', verb: 'とった', skill: 'おにごっこフィーバー', special: 'パワーアップ' },
  golf: { travel: [9000, 12000], label: 'カップ', unit: 'こ', verb: 'いれた', skill: 'ゴルフフィーバー', special: 'ホールインワン' },
  jump: { travel: [7000, 10000], label: '雲', unit: 'こ', verb: 'のった', skill: 'ジャンプフィーバー', special: 'スーパージャンプ' },
  maze: { travel: [9000, 13000], label: 'とびら', unit: 'こ', verb: 'あけた', skill: '迷路フィーバー', special: 'いっぱつ' },
  seek: { travel: [8000, 12000], label: 'ゴトモン', unit: '回', verb: 'みつけた', skill: 'さがしフィーバー', special: 'はやみつけ' },
  othello: { travel: [10000, 15000], label: '石', unit: '問', verb: 'こたえた', skill: 'オセロフィーバー', special: 'ほしの石' },
  link: { travel: [9000, 13000], label: '線', unit: '本', verb: 'つないだ', skill: 'つなぎフィーバー', special: 'ぴったり' },
  merge: { travel: [8000, 12000], label: 'タイル', unit: '問', verb: 'こたえた', skill: 'がったいフィーバー', special: 'ぴったり' },
  race: { travel: [5200, 7200], label: 'ゲート', unit: '問', verb: 'くぐった', skill: 'レースフィーバー', special: 'ロケットダッシュ' },
  drum: { travel: [4800, 6000], label: 'ふだ', unit: '問', verb: 'たたいた', skill: 'おまつりフィーバー', special: 'かんぺき' },
  parts: { travel: [9000, 14000], label: '漢字', unit: '字', verb: 'くみたてた', skill: 'がったいフィーバー', special: 'ぴったり' },
  snake: { travel: [14000, 22000], label: '英単語', unit: '語', verb: 'つづった', skill: 'スペルフィーバー', special: 'ノーミス' },
  meteor: { travel: [6000, 10000], label: 'いん石', unit: 'こ', verb: 'げいげき', skill: 'スターげいげき', special: 'ながれ星' },
  breakout: { travel: [14000, 22000], label: 'ブロック', unit: '問', verb: 'パカーン', skill: 'パカーンフィーバー', special: 'ナイスショット' },
  shooter: { travel: [7000, 11000], label: 'なかま', unit: 'ひき', verb: 'ふやした', skill: 'なかよしフィーバー', special: 'スターショット' },
  puyo: { travel: [9000, 14000], label: 'たまご', unit: '組', verb: 'つんだ', skill: 'ぷよフィーバー', special: 'れんさ' },
  bubble: { travel: [10000, 15000], label: '泡', unit: '発', verb: 'うった', skill: 'バブルフィーバー', special: 'れんさ' },
  delivery: { travel: [12000, 18000], label: 'おとどけ', unit: 'こ', verb: 'とどけた', skill: 'スピード配達', special: '速達' },
  fish: { travel: [7000, 11000], label: 'つり', unit: '匹', verb: 'つった', skill: '大漁フィーバー', special: '大物' },
  toss: { travel: [6000, 9500], label: '玉', unit: '球', verb: '入れた', skill: '玉入れフィーバー', special: 'ナイスシュート' },
  sort: { travel: [9000, 14000], label: 'パズル', unit: 'こ', verb: '完成', skill: 'ならべ名人', special: 'ぴったり' },
  shop: { travel: [9000, 14000], label: 'おねがい', unit: '人', verb: 'かなえた', skill: '大はんじょう', special: 'ごきげん' },
  memory: { travel: [10000, 15000], label: 'ペア', unit: '組', verb: 'そろえた', skill: 'めくりの達人', special: 'ひらめき' },
  bingo: { travel: [8000, 12000], label: 'ビンゴ', unit: '問', verb: 'あてた', skill: 'ビンゴチャンス', special: 'ラッキー' },
  case: { travel: [14000, 20000], label: '事件', unit: '件', verb: '解決', skill: 'ひらめき', special: '名推理' },
});

// Two correct answers in a row charge the companion's course; the next correct
// answer uses it. Course ids stay stable because saved stats refer to them.
const COURSE_KIND = Object.freeze({ 'treasure-key': 'chest', 'milk-lantern': 'mole', 'explorer-compass': 'cart',
  'star-reserve': 'stars', 'bridge-anchor': 'bridge' });

export function createQuizWorld(kind, effects, { course = null, pace = 'normal' } = {}) {
  const spec = KINDS[kind];
  const slow = pace === 'slow';
  const travelMs = spec.travel[slow ? 1 : 0];
  const courseOn = COURSE_KIND[course?.id] === kind;
  let problemId = null, elapsed = 0, open = false, review = false;
  let bonus = 0, correct = 0, answered = 0, quick = 0, streak = 0, feverLeft = 0, charged = false, special = 0;
  let lastEvent = null, eventSerial = 0, completed = false;
  // Some games keep their ending on screen for a moment before the results (the finished picture, the last dance, the finish line, the last board).
  const HOLD = { coloring: 2600, drum: 1800, race: 1800, merge: 2000, link: 1200, othello: 2200, maze: 1200, jump: 1200, tag: 1000, golf: 1000 };
  let holdLeft = HOLD[kind] ?? 0;
  // Photo rally: each correct shot keeps a photo whose stars follow how early it was taken.
  // Proverb detective: every solved case is filed; first-try, pre-hint solves earn the most stars.
  const photos = [], cases = [];
  // Trip sugoroku: boss damage adds up from each committed answer (5 knocks the boss out).
  let bossDamage = 0;
  // Kanji bingo: completed lines and opened squares, read from the Core (stamps add lines too).
  let bingoLines = 0, bingoMarked = 0;
  // Gotomon shop: requests served and tips, read from the Core (a later hand-over serves too).
  let shopServed = 0, shopTips = 0;
  // Bubbles: popped and fallen bubbles and freed Gotomon, read from the Core.
  let bubbleBroken = 0, bubbleFreed = 0;
  // Eggs: hatched groups and the longest chain, read from the Core.
  let puyoHatched = 0, puyoChain = 0;
  // Kanji puzzles: finished puzzles and stars, read from the Core.
  let sortSolved = 0, sortStars = 0;
  // Race: the place at the finish, read from the Core.
  let racePlace = null;
  // 2048: the biggest tile and the merges, read from the Core.
  let mergeBest = 0, mergeJoined = 0;
  // Othello: the stones at the end, read from the Core.
  let othelloEnd = null;
  // Maze: the friends met, read from the Core.
  let mazeFriends = 0;
  // Jump: the stars and balloon friends, read from the Core.
  let jumpStars = 0, jumpFriends = 0;
  // Tag: the friends made, read from the Core.
  let tagFriends = 0;
  // Golf: the hole-in-ones, read from the Core.
  let golfHoleInOnes = 0;
  const mark = (type, extra = {}) => { lastEvent = Object.freeze({ id: ++eventSerial, type, ...extra }); };
  const progress = () => clamp(elapsed / travelMs, 0, 1);
  return {
    context(state) {
      review = state?.mode === 'review';
      const id = state?.problem?.problemId ?? null;
      if (id !== problemId) { problemId = id; elapsed = 0; }
      open = state?.phase === 'answering';
      if (kind === 'puyo' && state?.mode === 'puyo') { puyoHatched = Math.max(puyoHatched, state.hatched || 0); puyoChain = Math.max(puyoChain, state.bestChain || 0); }
      if (kind === 'bubble' && state?.mode === 'bubble') { bubbleBroken = Math.max(bubbleBroken, (state.popped || 0) + (state.dropped || 0)); bubbleFreed = Math.max(bubbleFreed, state.freed?.length || 0); }
      if (kind === 'race' && state?.mode === 'race' && state.result) racePlace = state.result.place;
      if (kind === 'othello' && state?.mode === 'othello' && state.result) othelloEnd = state.result;
      if (kind === 'golf' && state?.mode === 'golf') golfHoleInOnes = Math.max(golfHoleInOnes, state.holeInOnes || 0);
      if (kind === 'tag' && state?.mode === 'tag') tagFriends = Math.max(tagFriends, state.friends || 0);
      if (kind === 'jump' && state?.mode === 'jump') { jumpStars = Math.max(jumpStars, state.starsTaken || 0); jumpFriends = Math.max(jumpFriends, state.friends || 0); }
      if (kind === 'maze' && state?.mode === 'maze') mazeFriends = Math.max(mazeFriends, state.friendsMet || 0);
      if (kind === 'merge' && state?.mode === 'merge') { mergeBest = Math.max(mergeBest, state.best || 0); mergeJoined = Math.max(mergeJoined, state.merges || 0); }
      if (kind === 'sort' && state?.mode === 'sort') { sortSolved = Math.max(sortSolved, state.solved || 0); sortStars = Math.max(sortStars, state.stars || 0); }
      if (kind === 'shop' && state?.mode === 'shop') { shopServed = Math.max(shopServed, state.served || 0); shopTips = Math.max(shopTips, state.tips || 0); }
      if (kind === 'bingo' && state?.bingo) { bingoLines = Math.max(bingoLines, state.bingo.lines || 0); bingoMarked = Math.max(bingoMarked, state.bingo.marked || 0); }
    },
    update(dt) {
      if (completed) { holdLeft = Math.max(0, holdLeft - (Number.isFinite(dt) ? Math.max(0, dt) : 0)); return; }
      if (open && !review) elapsed = Math.min(travelMs, elapsed + (Number.isFinite(dt) ? Math.max(0, dt) : 0));
    },
    answer(success, payload = {}, combo = 0) {
      answered++;
      // Review counts what was read but gives no speed bonus.
      if (review) { if (success) correct++; return; }
      const early = 1 - progress();
      if (!success) {
        streak = 0; charged = false;
        if (kind === 'case' && payload?.caseId) cases.push(Object.freeze({ caseId: payload.caseId, stars: 1 }));
        // Partly right choices (e.g. some of the stars) still light up a little.
        const partial = clamp(Number(payload?.score) || 0, 0, 1);
        if (partial > 0) bonus += Math.round(partial * 15);
        mark('miss', { partial: partial > 0 });
        return;
      }
      correct++; streak++;
      if (kind === 'trip') bossDamage += Math.max(0, Number(payload?.damage) || 0);
      if (kind === 'bingo') bingoLines = Math.max(bingoLines, Number(payload?.lines) || 0);
      let points = 20 + Math.round(early * 40) + Math.min(combo, 5) * 4;
      if (early >= .5) quick++;
      if (feverLeft > 0) { points += Math.round(25 * effects.potency); feverLeft--; }
      let used = false;
      if (charged) { points += 40; special++; charged = false; used = true; }
      else if (courseOn && streak % 2 === 0) charged = true;
      bonus += points;
      let stars = null;
      if (kind === 'photo' && payload?.monsterId) {
        stars = early >= .6 ? 3 : early >= .25 ? 2 : 1;
        photos.push(Object.freeze({ monsterId: payload.monsterId, stars }));
      }
      if (kind === 'case' && payload?.caseId) {
        stars = early >= .5 ? 3 : 2;
        cases.push(Object.freeze({ caseId: payload.caseId, stars }));
      }
      mark('hit', { points, quick: early >= .5, special: used, stars });
    },
    boost() { feverLeft = 3; mark('boost'); },
    complete() { completed = true; },
    snapshot() {
      const p = progress();
      return { kind, bonus, progress: p, arrived: p >= 1, travelMs, pace: slow ? 'slow' : 'normal', review,
        correct, answered, quick, streak, fever: feverLeft > 0, feverLeft, charged, special, lastEvent, completed,
        ...(kind in HOLD ? { holdResult: completed && holdLeft > 0 } : {}),
        photos: [...photos], bestShots: photos.filter(photo => photo.stars === 3).length,
        cases: [...cases], brilliant: cases.filter(item => item.stars === 3).length,
        bossDamage, bossDefeated: kind === 'trip' && bossDamage >= 5, bingoLines, bingoMarked, shopServed, shopTips, sortSolved, sortStars, bubbleBroken, bubbleFreed, puyoHatched, puyoChain,
        metric: `${spec.label} ${correct}`,
        caption: feverLeft ? `${spec.skill}！ あと${feverLeft}回` : charged ? `次の正解で${spec.special}！` : '',
        // Never lead with a zero: a run without hits still reads as time played together.
        summary: kind === 'trip' ? `${correct ? `${correct}問正解` : `${answered}問に挑戦`} · ボスに${bossDamage}ダメージ${bossDamage >= 5 ? ' · ボス撃破！' : ` · あと${5 - bossDamage}でボス撃破`}`
          : kind === 'mole' && correct ? `ゴトモン${correct}匹とハイタッチ${quick ? ` · はやわざ ${quick}回` : ''}${courseOn && special ? ` · ${spec.special} ${special}回` : ''}`
          : kind === 'golf' && answered ? `${answered}ホール クリア · 1回で 答えの旗 ${correct}こ${golfHoleInOnes ? ` · ホールインワン ${golfHoleInOnes}回` : ''}`
          : kind === 'tag' && answered ? `ふだを${answered}問 とった · 1回で ${correct}問${tagFriends ? ` · なかま ${tagFriends}ひき` : ''}`
          : kind === 'jump' && answered ? `雲を${answered}こ のぼった · 1回で ${correct}こ · ⭐${jumpStars}${jumpFriends ? ` · なかま ${jumpFriends}ひき` : ''}`
          : kind === 'maze' && answered ? `とびらを${answered}こ あけた · 1回で ${correct}こ · なかま ${mazeFriends}ひき`
          : kind === 'seek' && answered ? `${answered}回 みつけた · 1回で ${correct}回`
          : kind === 'othello' && answered ? `${othelloEnd ? `${othelloEnd.outcome === 'win' ? '勝ち' : othelloEnd.outcome === 'draw' ? 'ひきわけ' : 'あいての勝ち'}（きみ ${othelloEnd.mine}まい・あいて ${othelloEnd.theirs}まい） · ` : ''}${answered}問中 ${correct}問せいかい`
          : kind === 'link' && answered ? `${answered}本 つないだ · 1回で ${correct}本`
          : kind === 'merge' && answered ? `いちばん大きい ${mergeBest} · 合体 ${mergeJoined}回 · ${answered}問中 ${correct}問せいかい`
          : kind === 'race' && answered ? `${racePlace ? `${racePlace}位でゴール · ` : ''}ゲート${answered}問 · 1回で正解 ${correct}問`
          : kind === 'drum' && answered ? `${answered}問 たたいた · 1回で正解 ${correct}問`
          : kind === 'coloring' && answered ? `${answered}マス ぬった · 1回で答え ${correct}マス`
          : kind === 'slash' && answered ? `くす玉を${answered}こ パカッ · 1回で答え ${correct}こ`
          : kind === 'parts' && answered ? `漢字を${answered}字くみたてた${correct ? ` · 1回で合体 ${correct}字` : ''}`
          : kind === 'snake' && answered ? `英単語を${answered}語つづった${correct ? ` · まちがいなし ${correct}語` : ''}`
          : kind === 'meteor' && answered ? `いん石を${answered}こ むかえた${correct ? ` · 1回でげいげき ${correct}こ` : ''}`
          : kind === 'breakout' && answered ? `答えのブロックを${answered}こ パカーン · ゴトモンが${answered}ひき出てきた${correct ? ` · ねらいどおり ${correct}こ` : ''}`
          : kind === 'shooter' && correct ? `${answered}ひきと なかよくなった · 1回でなかまにした ${correct}ひき`
          : kind === 'puyo' && answered ? `たまごを${answered}組つんだ${puyoHatched ? ` · ゴトモンが${puyoHatched}ひき うまれた` : ''}${puyoChain >= 2 ? ` · 最大${puyoChain}れんさ` : ''}`
          : kind === 'bubble' && bubbleBroken ? `泡を${bubbleBroken}こ わった${bubbleFreed ? ` · ゴトモンを${bubbleFreed}ひき たすけた` : ''}`
          : kind === 'delivery' && correct ? `ふるさとに${answered}こ とどけた · 1回でとどいた ${correct}こ`
          : kind === 'fish' && correct ? `ゴトモンを${answered}匹つった · 1回でつれた ${correct}匹`
          : kind === 'toss' && correct ? `玉を${answered}球入れた · 1回で入った ${correct}球`
          : kind === 'sort' && sortSolved ? `パズルを${sortSolved}こ完成 · ⭐${sortStars}`
          : kind === 'shop' && shopServed ? `${shopServed}人のおねがいをかなえた · チップ⭐${shopTips}`
          : kind === 'memory' && answered ? `ペアを${answered}組そろえた${correct ? ` · すぐに見つけた ${correct}組` : ''}`
          : kind === 'bingo' ? (bingoLines ? `ビンゴ${bingoLines}列 · ${bingoMarked}マスあけた` : `${bingoMarked}マスあけた · ビンゴまであと少し`)
          : kind === 'case' && cases.length ? `事件を${cases.length}件解決${cases.some(item => item.stars === 3) ? ` · 名推理 ${cases.filter(item => item.stars === 3).length}回` : ''}`
          : correct ? `${spec.label}を${correct}${spec.unit}${spec.verb}${quick ? ` · はやわざ ${quick}回` : ''}${courseOn && special ? ` · ${spec.special} ${special}回` : ''}`
          : `相棒といっしょに、さいごまで${answered}問あそんだ`,
        goal: 'はやく答えるほど、得点がのびる' };
    },
  };
}

export const createChestWorld = (effects, options) => createQuizWorld('chest', effects, options);
export const createMoleWorld = (effects, options) => createQuizWorld('mole', effects, options);
export const createCartWorld = (effects, options) => createQuizWorld('cart', effects, options);
export const createStarWorld = (effects, options) => createQuizWorld('stars', effects, options);
export const createBridgeRunWorld = (effects, options) => createQuizWorld('bridge', effects, options);
export const createPhotoWorld = (effects, options) => createQuizWorld('photo', effects, options);
export const createCaseWorld = (effects, options) => createQuizWorld('case', effects, options);
export const createTripWorld = (effects, options) => createQuizWorld('trip', effects, options);
export const createBingoWorld = (effects, options) => createQuizWorld('bingo', effects, options);
export const createMemoryWorld = (effects, options) => createQuizWorld('memory', effects, options);
export const createShopWorld = (effects, options) => createQuizWorld('shop', effects, options);
export const createSortWorld = (effects, options) => createQuizWorld('sort', effects, options);
export const createTossWorld = (effects, options) => createQuizWorld('toss', effects, options);
export const createFishWorld = (effects, options) => createQuizWorld('fish', effects, options);
export const createDeliveryWorld = (effects, options) => createQuizWorld('delivery', effects, options);
export const createBubbleWorld = (effects, options) => createQuizWorld('bubble', effects, options);
export const createPuyoWorld = (effects, options) => createQuizWorld('puyo', effects, options);
export const createShooterWorld = (effects, options) => createQuizWorld('shooter', effects, options);
export const createBreakoutWorld = (effects, options) => createQuizWorld('breakout', effects, options);
export const createMeteorWorld = (effects, options) => createQuizWorld('meteor', effects, options);
export const createSnakeWorld = (effects, options) => createQuizWorld('snake', effects, options);
export const createPartsWorld = (effects, options) => createQuizWorld('parts', effects, options);
export const createSlashWorld = (effects, options) => createQuizWorld('slash', effects, options);
export const createColoringWorld = (effects, options) => createQuizWorld('coloring', effects, options);
export const createDrumWorld = (effects, options) => createQuizWorld('drum', effects, options);
export const createRaceWorld = (effects, options) => createQuizWorld('race', effects, options);
export const createMergeWorld = (effects, options) => createQuizWorld('merge', effects, options);
export const createLinkWorld = (effects, options) => createQuizWorld('link', effects, options);
export const createOthelloWorld = (effects, options) => createQuizWorld('othello', effects, options);
export const createSeekWorld = (effects, options) => createQuizWorld('seek', effects, options);
export const createMazeWorld = (effects, options) => createQuizWorld('maze', effects, options);
export const createJumpWorld = (effects, options) => createQuizWorld('jump', effects, options);
export const createTagWorld = (effects, options) => createQuizWorld('tag', effects, options);
export const createGolfWorld = (effects, options) => createQuizWorld('golf', effects, options);
