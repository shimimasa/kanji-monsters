// This clock observes value snapshots even while the renderer module is pending.
export function createGLBTimeline() {
  let identity = '', action = '', previous = 0, duration = 1, idle = 0, revision = 0, defeated = false;
  let value = { clip: 'idle', progress: 0, revision: 0, reducedMotion: false };
  return {
    observe(s, dt) {
      const next = `${s.generation}/${s.session}/${s.enemyIndex}/${s.enemyId}`;
      if (next !== identity) { identity = next; action = ''; idle = 0; defeated = false; }
      const raw = s.enemyAction === 'damage' ? 'hit' : ['attack', 'defeat'].includes(s.enemyAction) ? s.enemyAction : 'idle';
      if (raw === 'defeat') defeated = true;
      if (Number.isFinite(s.enemyHp) && s.enemyHp > 0 && raw !== 'defeat') defeated = false;
      const clip = defeated && s.enemyHp === 0 ? 'defeat' : raw;
      const timer = Number.isFinite(s.enemyActionTimer) ? Math.max(0, s.enemyActionTimer) : 0;
      if (clip !== action || (clip !== 'idle' && timer > previous + 1)) {
        action = clip; duration = Math.max(1, timer); revision++;
      }
      previous = timer;
      idle += Math.min(100, Math.max(0, dt || 0));
      value = { clip, progress: clip === 'idle' ? (idle % 2000) / 2000 :
        (defeated && raw === 'idle' ? 1 : Math.max(0, Math.min(1, 1 - timer / duration))),
      revision, reducedMotion: !!s.reducedMotion };
      return value;
    },
    current: () => value,
  };
}

export function createGLBPlayback(groups, motion) {
  let selected = null, revision = -1, starts = 0;
  const neutral = scale => {
    motion.position.set(0, 0, 0); motion.rotationQuaternion.set(0, 0, 0, 1); motion.scaling.setAll(scale);
  };
  const stop = () => { selected?.stop(true); selected = null; revision = -1; };
  return {
    sample(state) {
      if (state.reducedMotion) { stop(); neutral(state.clip === 'defeat' ? 0.25 : 1); return; }
      const group = groups[state.clip];
      if (!group) throw new Error('Missing display clip');
      if (selected !== group || revision !== state.revision) {
        stop(); neutral(1); selected = group; revision = state.revision;
        group.start(false, 1, group.from, group.to); group.pause(); starts++;
      }
      group.goToFrame(group.from + state.progress * (group.to - group.from));
    },
    stop,
    resources: () => ({ animations: selected ? 1 : 0, starts }),
  };
}
