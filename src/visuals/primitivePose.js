// Stateless poses follow the existing controller timer. No completion callbacks or randomness.
export function createPrimitivePose() {
  let key = '', previousTimer = 0, duration = 1, idleTime = 0, starts = 0;
  return {
    sample(s, dt) {
      const action = s.enemyAction === 'damage' ? 'hit' : ['attack', 'defeat'].includes(s.enemyAction) ? s.enemyAction : 'idle';
      const next = `${s.generation}/${s.session}/${s.enemyIndex}/${s.enemyId}/${action}`;
      if (next !== key || (action !== 'idle' && s.enemyActionTimer > previousTimer + 1)) {
        key = next; duration = Math.max(1, s.enemyActionTimer); starts++;
      }
      previousTimer = s.enemyActionTimer;
      idleTime += Math.min(100, Math.max(0, dt || 0));
      const p = Math.max(0, Math.min(1, 1 - s.enemyActionTimer / duration));
      const wave = Math.sin(Math.PI * p);
      const pose = { action, starts, x: 0, y: 0, scale: 1, rotation: 0, glow: 0 };
      if (s.reducedMotion) {
        if (action === 'defeat') pose.scale = 0.25;
        return pose;
      }
      if (action === 'idle') pose.y = Math.sin(idleTime / 650) * 0.035;
      if (action === 'attack') pose.x = -0.2 * wave;
      if (action === 'hit') { pose.scale = 1 - 0.15 * wave; pose.rotation = 0.12 * wave; pose.glow = 0.2 * wave; }
      if (action === 'defeat') { pose.scale = Math.max(0.01, 1 - p); pose.rotation = p * Math.PI / 2; }
      return pose;
    },
  };
}
