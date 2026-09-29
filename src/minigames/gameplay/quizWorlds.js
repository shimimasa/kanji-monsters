// Worlds for the one-question-at-a-time arcade games. The current question's
// targets approach while it is unanswered and wait at the end instead of failing;
// answering earlier earns more. Worlds read committed answers and the Host clock
// only: they never answer, grade, or change the learning Core.
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

const KINDS = Object.freeze({
  // travel: how long the targets take to arrive (normal / slow pace), in ms.
  chest: { travel: [7000, 11000], label: '宝箱', unit: 'つ', verb: 'キャッチ', skill: 'おたからフィーバー', special: '金の宝箱' },
  mole: { travel: [5000, 8000], label: 'もぐら', unit: '匹', verb: 'たたいた', skill: 'もぐらフィーバー', special: 'しずくハンマー' },
  cart: { travel: [8000, 12000], label: '宝石', unit: 'こ', verb: '発見', skill: '発見フィーバー', special: '羅針盤の宝' },
  stars: { travel: [12000, 18000], label: '星座', unit: 'つ', verb: '完成', skill: '星のきらめき', special: '流れ星' },
  bridge: { travel: [9000, 14000], label: '橋', unit: '本', verb: 'かけた', skill: '虹のかけ橋', special: '虹の橋' },
  photo: { travel: [6000, 9500], label: '写真', unit: 'まい', verb: '撮った', skill: 'シャッターチャンス', special: 'ベストショット' },
  trip: { travel: [9000, 13000], label: '旅', unit: '問', verb: '進んだ', skill: '旅の追い風', special: '追い風' },
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
  // Photo rally: each correct shot keeps a photo whose stars follow how early it was taken.
  // Proverb detective: every solved case is filed; first-try, pre-hint solves earn the most stars.
  const photos = [], cases = [];
  // Trip sugoroku: boss damage adds up from each committed answer (5 knocks the boss out).
  let bossDamage = 0;
  // Kanji bingo: completed lines and opened squares, read from the Core (stamps add lines too).
  let bingoLines = 0, bingoMarked = 0;
  const mark = (type, extra = {}) => { lastEvent = Object.freeze({ id: ++eventSerial, type, ...extra }); };
  const progress = () => clamp(elapsed / travelMs, 0, 1);
  return {
    context(state) {
      review = state?.mode === 'review';
      const id = state?.problem?.problemId ?? null;
      if (id !== problemId) { problemId = id; elapsed = 0; }
      open = state?.phase === 'answering';
      if (kind === 'bingo' && state?.bingo) { bingoLines = Math.max(bingoLines, state.bingo.lines || 0); bingoMarked = Math.max(bingoMarked, state.bingo.marked || 0); }
    },
    update(dt) { if (open && !review) elapsed = Math.min(travelMs, elapsed + (Number.isFinite(dt) ? Math.max(0, dt) : 0)); },
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
        photos: [...photos], bestShots: photos.filter(photo => photo.stars === 3).length,
        cases: [...cases], brilliant: cases.filter(item => item.stars === 3).length,
        bossDamage, bossDefeated: kind === 'trip' && bossDamage >= 5, bingoLines, bingoMarked,
        metric: `${spec.label} ${correct}`,
        caption: feverLeft ? `${spec.skill}！ あと${feverLeft}回` : charged ? `次の正解で${spec.special}！` : '',
        // Never lead with a zero: a run without hits still reads as time played together.
        summary: kind === 'trip' ? `${correct ? `${correct}問正解` : `${answered}問に挑戦`} · ボスに${bossDamage}ダメージ${bossDamage >= 5 ? ' · ボス撃破！' : ` · あと${5 - bossDamage}でボス撃破`}`
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
