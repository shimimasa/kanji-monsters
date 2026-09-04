// src/core/sessionTimer.js
//
// 「きょうは ○ふん」で区切るための時計。
//
// なぜ要るか:
//   授業の残り時間で切り上げると、子どもの側には「途中でやめた」形しか残らない。
//   はじめに時間を決めておいて、区切りのいいところで「きょうは ここまで！」と
//   終われるほうが、やった分がそのまま手応えになる。
//
// 作りの方針:
//   ・切るのは敵と敵の間だけ。問題の途中では絶対に止めない。
//   ・止めたところまでは、既にあるチェックポイント（5体で旗）で残る。
//   ・始まりの時刻は localStorage に置く。読み込み直しても続く
//     （リロードで時間が巻き戻せてしまうと、区切りの意味が無くなる）。
//   ・ただし前の日の始まりが残っていると、開いた瞬間に「時間だよ」になって
//     しまうので、しばらく経っていたら新しい回として始め直す。

const MINUTES_KEY = 'sessionMinutes';     // 0 なら区切らない
const STARTED_AT_KEY = 'sessionStartedAt';

/** これだけ間が空いていたら、前の回の続きではなく新しい回とみなす */
const STALE_AFTER_MS = 3 * 60 * 60 * 1000; // 3時間

/** 選べる長さ（分）。0 は「区切らない」 */
export const SESSION_CHOICES = [0, 10, 15, 20];

export function getMinutes() {
  try {
    const raw = parseInt(localStorage.getItem(MINUTES_KEY) || '0', 10);
    return SESSION_CHOICES.includes(raw) ? raw : 0;
  } catch {
    return 0;
  }
}

export function setMinutes(minutes) {
  const value = SESSION_CHOICES.includes(Number(minutes)) ? Number(minutes) : 0;
  try {
    localStorage.setItem(MINUTES_KEY, String(value));
    // 長さを決め直したら、その場から数え直す
    localStorage.removeItem(STARTED_AT_KEY);
  } catch {}
}

/** 区切る設定になっているか */
export function isEnabled() {
  return getMinutes() > 0;
}

function readStartedAt() {
  try {
    const raw = parseInt(localStorage.getItem(STARTED_AT_KEY) || '0', 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  } catch {
    return 0;
  }
}

/**
 * まだ数え始めていなければ、いまから数え始める。
 * バトルに入った時に呼ぶ（メニューを見ている時間は数えない）。
 */
export function startIfNeeded() {
  if (!isEnabled()) return;
  const now = Date.now();
  const startedAt = readStartedAt();
  if (startedAt && (now - startedAt) < STALE_AFTER_MS) return;
  try { localStorage.setItem(STARTED_AT_KEY, String(now)); } catch {}
}

/** 次の回のために数えるのをやめる */
export function reset() {
  try { localStorage.removeItem(STARTED_AT_KEY); } catch {}
}

/** 残り時間（ミリ秒）。区切らない設定なら Infinity */
export function remainingMs() {
  if (!isEnabled()) return Infinity;
  const startedAt = readStartedAt();
  if (!startedAt) return getMinutes() * 60000;
  const elapsed = Date.now() - startedAt;
  if (elapsed >= STALE_AFTER_MS) return getMinutes() * 60000; // 前の回の残りは見ない
  return getMinutes() * 60000 - elapsed;
}

/** 決めた時間が過ぎたか */
export function isOver() {
  return remainingMs() <= 0;
}

export default { SESSION_CHOICES, getMinutes, setMinutes, isEnabled, startIfNeeded, reset, remainingMs, isOver };
