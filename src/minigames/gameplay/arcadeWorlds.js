// Worlds for the real-time arcade games. They read committed answers and the
// Host clock only: they never answer, grade, or change the learning Core.
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export const DASH_TRACK = Object.freeze({ hurdles: 10, first: 40, spacing: 36, runOut: 30, takeoff: 1.5 });
export const dashHurdleAt = index => DASH_TRACK.first + DASH_TRACK.spacing * index;
export const DASH_FINISH = dashHurdleAt(DASH_TRACK.hurdles - 1) + DASH_TRACK.runOut;

// Answering early keeps the runner moving; an unanswered hurdle only waits.
export function createDashWorld(effects, { bestTimeMs = null, course = null, pace = 'normal' } = {}) {
  const slow = pace === 'slow';
  const base = slow ? 4.2 : 7, top = slow ? 7.2 : 11.5;
  const best = !slow && Number.isFinite(bestTimeMs) && bestTimeMs > 0 ? bestTimeMs : null;
  const par = DASH_FINISH / (slow ? 5.2 : 8.4) * 1000;
  let position = 0, speed = 0, target = base, elapsed = 0, boostMs = 0, stumbleMs = 0, jumpMs = 0;
  let cleared = 0, waiting = false, bonus = 0, jumps = 0, cleanJumps = 0, trips = 0, shortcuts = 0, jumpStreak = 0;
  let completed = false, finished = false, finishMs = null, afterCompleteMs = 0, lastEvent = null, eventSerial = 0;
  const results = [];
  const mark = (type, extra = {}) => { lastEvent = Object.freeze({ id: ++eventSerial, type, ...extra }); };
  const passHurdle = result => {
    const index = cleared++;
    if (result.correct) {
      jumps++; jumpStreak++; jumpMs = 560;
      if (!result.waited) cleanJumps++;
      bonus += result.waited ? 6 : 14;
      if (course?.id === 'potato-shortcut' && jumpStreak >= 2) { shortcuts++; position += 4; bonus += 8; jumpStreak = 0; mark('shortcut', { index }); }
      else mark('jump', { index, clean: !result.waited });
    } else {
      trips++; jumpStreak = 0; stumbleMs = 900; mark('trip', { index });
    }
  };
  const hold = () => completed && !finished && afterCompleteMs < 60000;
  // Small fixed steps: a long frame can never skip a hurdle.
  const advance = dt => {
    if (finished) return;
    elapsed += dt;
    if (completed) afterCompleteMs += dt;
    boostMs = Math.max(0, boostMs - dt); stumbleMs = Math.max(0, stumbleMs - dt); jumpMs = Math.max(0, jumpMs - dt);
    // After the last answer the runner sprints home, so nobody waits long for the result.
  const want = (boostMs || completed ? top * 1.25 : target) * (stumbleMs ? .45 : 1);
    speed += (want - speed) * Math.min(1, dt / 380);
    let step = speed * dt / 1000;
    if (cleared < DASH_TRACK.hurdles) {
      const takeoff = dashHurdleAt(cleared) - DASH_TRACK.takeoff;
      if (position + step >= takeoff) {
        const result = results[cleared];
        if (!result) { position = takeoff; step = 0; speed = 0; waiting = true; }
        else { waiting = false; passHurdle(result); }
      } else waiting = false;
    }
    position += step;
    if (cleared >= DASH_TRACK.hurdles && position >= DASH_FINISH) {
      position = DASH_FINISH; finished = true; finishMs = elapsed; waiting = false;
      const timeBonus = Math.max(0, Math.round((par * 1.35 - finishMs) / 150));
      bonus += timeBonus; mark('finish', { timeBonus });
    }
  };
  return {
    update(dt) {
      let left = Number.isFinite(dt) ? Math.max(0, dt) : 0;
      while (left > 0 && !finished) { const part = Math.min(50, left); advance(part); left -= part; }
    },
    answer(correct, payload, combo = 0) {
      results.push(Object.freeze({ correct: !!correct, waited: waiting && results.length === cleared }));
      target = correct ? clamp(base + combo * .55, base, top) : base;
    },
    boost() { boostMs = 5000 * effects.potency; mark('boost'); },
    complete() { completed = true; },
    snapshot() {
      const timeMs = finishMs ?? elapsed;
      return { kind: 'race', bonus, progress: cleared / DASH_TRACK.hurdles, position, finishAt: DASH_FINISH,
        hurdles: Array.from({ length: DASH_TRACK.hurdles }, (_, index) => dashHurdleAt(index)),
        results: [...results], cleared, waiting, speed, top, pace: slow ? 'slow' : 'normal',
        boostMs, stumbleMs, jumpMs, fever: boostMs > 0, danger: waiting, timeMs, finished, holdResult: hold(),
        bestTimeMs: best, ghost: best ? Math.min(DASH_FINISH, DASH_FINISH * elapsed / best) : null,
        paceDeltaMs: best && position > 0 ? timeMs - best * position / DASH_FINISH : null,
        jumps, cleanJumps, trips, shortcuts, lastEvent,
        metric: `${(timeMs / 1000).toFixed(1)}秒`,
        caption: waiting ? 'こたえて ジャンプ！' : boostMs ? 'ゴトモンダッシュ！' : completed ? 'ラストスパート！' : '',
        summary: `ゴールタイム ${(timeMs / 1000).toFixed(1)}秒 · 止まらずジャンプ ${cleanJumps}回${course ? ` · 近道 ${shortcuts}回` : ''}${best ? ` · ベスト比 ${timeMs < best ? '−' : '+'}${(Math.abs(timeMs - best) / 1000).toFixed(1)}秒` : ''}`,
        goal: best ? 'ベストの走りを追いこそう！' : 'ハードルに着く前に答えて、止まらずに走ろう' };
    },
  };
}

export function createInvaderWorld(effects, { course = null } = {}) {
  let kills = 0, bonus = 0, feverShots = 0, streak = 0, golden = false, goldenHits = 0;
  let bossDown = false, bossFirstTry = false, escapes = 0, shield = 3;
  return {
    context(state) { if (Number.isFinite(state?.life)) shield = state.life; },
    answer(correct, payload = {}, combo = 0) {
      if (!correct) { streak = 0; if (payload?.reason === 'escaped') escapes++; return; }
      kills++; streak++;
      let points = 10 + Math.min(combo, 5) * 4;
      if (feverShots > 0) { points += 25; feverShots--; }
      if (golden) { points += 40; golden = false; goldenHits++; }
      if (payload?.boss) { bossDown = true; bossFirstTry = !payload.wrongAttempts; points += 60; }
      bonus += points;
      if (course?.id === 'corn-barrage' && streak % 3 === 0) golden = true;
    },
    boost() { feverShots = 3; },
    snapshot() {
      return { kind: 'shoot', bonus, progress: kills / 10, kills, feverShots, fever: feverShots > 0, golden, goldenHits,
        bossDown, bossFirstTry, escapes, shield,
        metric: `撃破 ${kills}/10`, caption: feverShots ? `あいぼうの連射！ あと${feverShots}発` : golden ? '次の一発は黄金弾！' : '',
        summary: `${kills}機を撃破${bossDown ? ' · ボス撃破！' : ''}${course ? ` · 黄金弾 ${goldenHits}発` : ''}`,
        goal: bossDown ? '次は連続撃破をのばそう' : '最後のボスまで撃ちぬこう' };
    },
  };
}

export function createGateWorld(effects, { course = null } = {}) {
  let correct = 0, bonus = 0, cheer = 0, wards = 0, streak = 0, wardHits = 0, escapes = 0;
  return {
    answer(success, payload = {}) {
      if (!success) { streak = 0; if (payload?.reason === 'escaped') escapes++; return; }
      correct++; streak++;
      if (cheer > 0) { bonus += Math.round(20 * effects.potency); cheer--; }
      if (wards > 0) { wards--; wardHits++; bonus += 30; }
      else if (course?.id === 'defense-ward' && streak % 2 === 0) wards = Math.min(2, wards + 1);
    },
    boost() { cheer = 3; },
    snapshot() {
      return { kind: 'defend', bonus, progress: correct / 12, correct, cheer, fever: cheer > 0, wards, wardHits, escapes,
        metric: `撃退 ${correct}/12`, caption: cheer ? `あいぼうエール！ あと${cheer}回パワーアップ` : wards ? '守りの札が光っている！' : '',
        summary: `${correct}体を撃退${course ? ` · 札で撃退 ${wardHits}回` : ''}`,
        goal: '近いモンスターから読んで、連続撃退をめざそう' };
    },
  };
}
