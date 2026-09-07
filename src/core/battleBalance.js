export const BALANCE_VERSION = 2;

function isBonusStage(stage) {
  const id = String(stage?.stageId || '');
  return /^bonus_/i.test(id) || /_bonus$/i.test(id);
}

function stageGroup(stage) {
  const grade = Number(stage?.grade);
  if (Number.isFinite(grade) && grade > 0) return `grade-${grade}`;
  return String(stage?.stageId || '').split('_')[0] || 'unknown';
}

/** Difficulty reflects experience within the selected course, not school grade. */
export function getStageDifficultyIndex(stageId, stages = []) {
  const current = stages.find(stage => stage?.stageId === stageId);
  if (!current) return 0;
  const group = stageGroup(current);
  const peers = stages.filter(stage => !isBonusStage(stage) && stageGroup(stage) === group);
  if (isBonusStage(current)) return peers.length;
  return Math.max(0, peers.findIndex(stage => stage.stageId === stageId));
}

export function computeEnemyParams({
  isBoss,
  stageIndex = 0,
  playerLevel = 1,
  playerAtk = 0,
  playerMaxHp = 1,
}) {
  const idx = Math.max(0, Number(stageIndex) || 0);
  const levelValue = Math.max(1, Number(playerLevel) || 1);
  const hp = Math.max(15, Math.round(
    isBoss
      ? (60 + 2.2 * idx + 1.6 * levelValue)
      : (30 + 1.6 * idx + 1.1 * levelValue)
  ));
  const atkBase = isBoss
    ? (5 + 0.08 * idx + 0.20 * levelValue)
    : (4 + 0.06 * idx + 0.12 * levelValue);
  const uncapped = isBoss
    ? (atkBase + 0.22 * playerAtk + 0.04 * playerMaxHp)
    : (atkBase + 0.18 * playerAtk + 0.03 * playerMaxHp);
  const cap = Math.max(1, Math.floor(playerMaxHp * (isBoss ? 0.30 : 0.25)));
  const atk = Math.max(1, Math.min(cap, Math.round(uncapped)));
  const level = Math.max(1, Math.round(0.7 * levelValue + 0.3 * (1 + idx / 10)));
  const expBase = isBoss
    ? (35 + 0.6 * idx + 1.2 * levelValue)
    : (25 + 0.4 * idx + 0.8 * levelValue);
  return { hp, atk, level, exp: Math.max(5, Math.round(expBase)) };
}

export function getBossShieldHits(stageIndex = 0) {
  return Math.min(3, 1 + Math.floor(Math.max(0, Number(stageIndex) || 0) / 3));
}

export function requiredCorrectAnswers(enemyHp, playerAttack) {
  return Math.ceil(Math.max(0, enemyHp) / Math.max(1, playerAttack));
}

export function stageBestTimeKey(stageId) {
  return `${stageId}@balance-${BALANCE_VERSION}`;
}
