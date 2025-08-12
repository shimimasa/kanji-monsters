// src/core/bonusManager.js
import { stageData } from '../loaders/dataLoader.js';
import { gameState, unlockAchievement } from './gameState.js';

const TITLE_THRESHOLDS = { conqueror: 3, guardian: 5, champion: 10 }; // 征服者/守護者/覇者
const RANK_THRESHOLDS = { S: 85, A: 70 }; // S>=85, A>=70, B<70
const RANK_MULTIPLIERS = { S: 1.5, A: 1.2, B: 1.0 };

export function isBonusStage(stageId) {
  return /^bonus_g\d+$/i.test(String(stageId || ''));
}
export function fightsForGrade(grade) {
  return grade <= 6 ? 3 : 4;
}
/** 学年内の通常ステージ全クリ判定 */
export function isBonusUnlocked(grade) {
  const targets = stageData.filter(s => s.grade === grade && !/^bonus_/i.test(s.stageId));
  if (targets.length === 0) return false;
  return targets.every(s => {
    const ls = localStorage.getItem(`clear_${s.stageId}`) === '1';
    const gs = gameState.stageProgress?.[s.stageId]?.cleared;
    return !!(ls || gs);
  });
}

/** 係数など定義 */
function perBoss(grade) {
  return 60 + 10 * grade;
}
function firstClearBonus(grade) {
  return 200 + 30 * grade;
}

/** ランク算出 */
function computeRank(accuracyPct, remHpPct) {
  const score = Math.floor(0.6 * accuracyPct + 0.4 * remHpPct);
  let rank = 'B';
  if (score >= RANK_THRESHOLDS.S) rank = 'S';
  else if (score >= RANK_THRESHOLDS.A) rank = 'A';
  const multiplier = RANK_MULTIPLIERS[rank];
  return { score, rank, multiplier };
}

/** 途中敗退用XP */
export function calcFailXP(grade, clearedFights) {
  return Math.floor(perBoss(grade) * Math.max(0, clearedFights) * 0.4);
}

/** 進捗保存（A以上のみカウント）＆称号アンロック */
function updateTitleProgress(grade, rank) {
  const keyCount = `bonus_${grade}_clearCount`;
  const keyFirst = `bonus_${grade}_firstClear`;
  let clearCount = parseInt(localStorage.getItem(keyCount) || '0', 10);
  let gained = false;

  // 初回クリアフラグ（参考用途）
  if (localStorage.getItem(keyFirst) !== '1') {
    // フラグ付けはcalcBonusRewardの返却時にまとめて行う
  }

  // カウントはA以上のみ
  if (rank === 'S' || rank === 'A') {
    clearCount += 1;
    localStorage.setItem(keyCount, String(clearCount));
    gained = true;
  }

  const unlocked = [];
  // しきい値到達ごとに実績アンロック
  if (clearCount === TITLE_THRESHOLDS.conqueror) {
    const id = `title_conqueror_g${grade}`;
    unlockAchievement(id);
    unlocked.push(id);
  }
  if (clearCount === TITLE_THRESHOLDS.guardian) {
    const id = `title_guardian_g${grade}`;
    unlockAchievement(id);
    unlocked.push(id);
  }
  if (clearCount === TITLE_THRESHOLDS.champion) {
    const id = `title_champion_g${grade}`;
    unlockAchievement(id);
    unlocked.push(id);
  }

  const nextThreshold = [TITLE_THRESHOLDS.conqueror, TITLE_THRESHOLDS.guardian, TITLE_THRESHOLDS.champion]
    .find(t => clearCount < t) || null;

  return { count: clearCount, nextThreshold, gained, titlesUnlocked: unlocked };
}

/** ボーナス報酬メイン */
export function calcBonusReward({ grade, fights, cleared, accuracyPct, remHpPct, firstClear }) {
  const { score, rank, multiplier } = computeRank(accuracyPct, remHpPct);
  const baseXP = perBoss(grade) * fights;
  const firstClearB = firstClear ? firstClearBonus(grade) : 0;

  let xp;
  if (firstClear) {
    xp = Math.floor(baseXP * multiplier + firstClearB);
  } else {
    xp = Math.floor(baseXP * 0.4 * multiplier);
  }

  // 進捗更新（A以上のみ）
  const titleProgress = updateTitleProgress(grade, rank);

  return {
    score, rank, multiplier,
    baseXP, firstClearBonus: firstClearB, xp,
    titleProgress
  };
}

/** 初回クリアフラグの保存（クリア時のみ呼び出し） */
export function markBonusFirstClear(grade) {
  const keyFirst = `bonus_${grade}_firstClear`;
  if (localStorage.getItem(keyFirst) !== '1') {
    localStorage.setItem(keyFirst, '1');
    return true;
  }
  return false;
}

/** 既に初回済みか */
export function isFirstClear(grade) {
  return localStorage.getItem(`bonus_${grade}_firstClear`) !== '1';
}
