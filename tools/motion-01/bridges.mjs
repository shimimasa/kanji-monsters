// Bridges observe display values only. Never import battleScreen or a game state.
export function yomitabiView({ session, monsterId, enemyAction, enemyActionTimer,
  actionRevision, reducedMotion, elapsedMs }) {
  const action = enemyAction === 'damage' ? 'hit' :
    ['attack', 'defeat'].includes(enemyAction) ? enemyAction : 'idle';
  const durationMs = { attack: 750, hit: 500, defeat: 1000 }[action] || 2000;
  return Object.freeze({ session, monsterId, action, remainingMs: enemyActionTimer,
    durationMs, actionRevision, reducedMotion, elapsedMs });
}
export function sprintView({ session, monsterId, notification, remainingMs,
  actionRevision, reducedMotion, elapsedMs }) {
  // Only four clips in MOTION-01; no separate celebrate clip yet.
  const action = notification === 'correct' ? 'attack' : 'idle';
  return Object.freeze({ session, monsterId, action, remainingMs,
    durationMs: action === 'attack' ? 750 : 2000, actionRevision, reducedMotion, elapsedMs });
}
